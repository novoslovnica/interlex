import { prismaCorpus, prismaData } from "@/lib/prisma"
import {
  buildEndingReverseIndex,
  buildHypothesesForSurfaceForm,
  normalizeSurfaceForm,
  CandidateHypothesis,
  ReconstructionRuleSource,
} from "./reconstruct"

const EXAMPLE_TOKEN_LIMIT = 5
// Пачки транзакций, а не одна операция на коммит — та же причина, что и у
// BATCH_SIZE в reanalyzeDocument.ts: корпус даёт десятки тысяч кластеров,
// коммит по одному был бы на порядки медленнее.
const UPSERT_BATCH_SIZE = 500

export interface GenerateProposalsResult {
  clustersProcessed: number
  hypothesesUpserted: number
  redTokens: number
  yellowTokens: number
}

export interface GenerateProposalsOptions {
  // Смещение/ограничение по числу обрабатываемых кластеров (не токенов) —
  // для прогона по частям на очень большом корпусе несколькими отдельными
  // процессами. См. комментарий в
  // scripts/db/generate-corpus-candidate-proposals.ts о том, зачем это
  // понадобилось на практике.
  clusterOffset?: number
  clusterLimit?: number
}

interface Cluster {
  surfaceForm: string
  tokenIds: bigint[]
  siblingWordSlug: string | null
}

/**
 * Строит/обновляет CorpusCandidateProposal по всем токенам, у которых
 * DbAnalyzer не смог подобрать готовую словоформу — "красным" (matchCount=0,
 * включая вырожденный жёлтый случай без реального совпадения стема, см.
 * dbAnalyzer.ts) и "жёлтым" (matchCount=1 && isPartialMatch, т.е.
 * matchByStemPrefix нашёл существующую лексему, но ни одна её словоформа не
 * совпала). Обе ветки прогоняются через один и тот же reverse-lookup
 * алгоритм (buildHypothesesForSurfaceForm) — известный сосед не меняет
 * механику реконструкции, только помечает провенанс и приоритет ревью.
 *
 * Безопасно перезапускать: upsert по (clusterKey, ruleSource,
 * guessedStemType, guessedGrammeme) пересчитывает occurrenceCount/
 * exampleTokenIds/lastSeenAt/rank/possibleEndingGap заново из текущего
 * состояния CorpusToken, но никогда не трогает status/resolutionNote/
 * candidateId — решение модератора не может быть затёрто повторным
 * прогоном (тот же приём, что и у CorpusToken.resolutionSource/
 * CorpusDependency.source/semantic_relations.source в этом проекте).
 */
export async function generateCorpusCandidateProposals(
  options: GenerateProposalsOptions = {},
): Promise<GenerateProposalsResult> {
  const reverseIndex = await buildEndingReverseIndex()

  const redTokenRows = await prismaCorpus.corpusToken.findMany({
    // wordIndex=-1 — пунктуация (см. tokenizer.ts/reanalyzeDocument.ts):
    // её ветка анализа не заполняет matchCount вовсе, поэтому она тоже
    // сериализуется как matchCount=0 и без этого фильтра затопила бы
    // кластеры запятыми/точками (обнаружено на реальном прогоне).
    where: { matchCount: 0, wordIndex: { not: -1 } },
    select: { id: true, surfaceForm: true },
  })
  let redClusters = groupIntoClusters(
    redTokenRows.map((t) => ({ id: t.id, surfaceForm: t.surfaceForm, siblingWordSlug: null as string | null })),
  )

  const yellowTokenRows = await prismaCorpus.corpusToken.findMany({
    where: { matchCount: 1, isPartialMatch: true, wordSlug: { not: null }, wordIndex: { not: -1 } },
    select: { id: true, surfaceForm: true, wordSlug: true },
  })
  let yellowClusters = groupIntoClusters(
    yellowTokenRows.map((t) => ({ id: t.id, surfaceForm: t.surfaceForm, siblingWordSlug: t.wordSlug })),
  )

  if (options.clusterOffset !== undefined || options.clusterLimit !== undefined) {
    const offset = options.clusterOffset ?? 0
    const limit = options.clusterLimit ?? Number.POSITIVE_INFINITY
    // Красные и жёлтые считаются одной сквозной последовательностью
    // кластеров для целей offset/limit (сначала все красные, потом жёлтые) —
    // так несколько последовательных вызовов с растущим offset детерминированно
    // покрывают весь корпус без пропусков и повторов (при неизменном corpus.db
    // между вызовами; upsert всё равно идемпотентен, если это не так).
    const redEntries = [...redClusters]
    const yellowEntries = [...yellowClusters]
    const combinedSlice = [...redEntries, ...yellowEntries].slice(offset, offset + limit)
    const redSlice = combinedSlice.slice(0, Math.max(0, redEntries.length - offset))
    const yellowSlice = combinedSlice.slice(redSlice.length)
    redClusters = new Map(redSlice)
    yellowClusters = new Map(yellowSlice)
  }

  const siblingSlugs = [...new Set(
    [...yellowClusters.values()].map((c) => c.siblingWordSlug).filter((s): s is string => !!s),
  )]
  const siblingLexemes = siblingSlugs.length > 0
    ? await prismaData.lexeme.findMany({
        where: { slug: { in: siblingSlugs } },
        select: { slug: true, stem: true, value: true },
      })
    : []
  const siblingStemBySlug = new Map(
    siblingLexemes.map((l) => [l.slug, (l.stem || l.value || "").toLowerCase()]),
  )

  // Копим Prisma-промисы в небольшом буфере и коммитим пачками по мере
  // накопления, а не строим один массив на весь корпус целиком — на
  // ~74 тыс. кластеров держать в памяти сразу все несколько сотен тысяч
  // объектов-операций (до их исполнения) уводит процесс в OOM (проверено
  // эмпирически на реальном корпусе).
  let buffer: ReturnType<typeof buildProposalUpsert>[] = []
  let hypothesesUpserted = 0
  const flush = async () => {
    if (buffer.length === 0) return
    await prismaCorpus.$transaction(buffer)
    hypothesesUpserted += buffer.length
    buffer = []
  }

  for (const [clusterKey, cluster] of redClusters) {
    const hypotheses = buildHypothesesForSurfaceForm(cluster.surfaceForm, reverseIndex)
    for (const h of hypotheses) {
      buffer.push(buildProposalUpsert(clusterKey, "red_reverse_lookup", h, cluster.tokenIds, null, false))
      if (buffer.length >= UPSERT_BATCH_SIZE) await flush()
    }
  }

  for (const [clusterKey, cluster] of yellowClusters) {
    const hypotheses = buildHypothesesForSurfaceForm(cluster.surfaceForm, reverseIndex)
    const siblingStem = cluster.siblingWordSlug ? siblingStemBySlug.get(cluster.siblingWordSlug) : undefined
    for (const h of hypotheses) {
      const possibleEndingGap = !!siblingStem && h.guessedStem.toLowerCase() === siblingStem
      buffer.push(buildProposalUpsert(clusterKey, "yellow_stem_sibling", h, cluster.tokenIds, cluster.siblingWordSlug, possibleEndingGap))
      if (buffer.length >= UPSERT_BATCH_SIZE) await flush()
    }
  }

  await flush()

  return {
    clustersProcessed: redClusters.size + yellowClusters.size,
    hypothesesUpserted,
    redTokens: redTokenRows.length,
    yellowTokens: yellowTokenRows.length,
  }
}

function groupIntoClusters(
  tokens: { id: bigint; surfaceForm: string; siblingWordSlug: string | null }[],
): Map<string, Cluster> {
  const clusters = new Map<string, Cluster>()
  for (const t of tokens) {
    const key = normalizeSurfaceForm(t.surfaceForm)
    if (!key) continue
    const existing = clusters.get(key)
    if (existing) {
      existing.tokenIds.push(t.id)
    } else {
      clusters.set(key, { surfaceForm: t.surfaceForm, tokenIds: [t.id], siblingWordSlug: t.siblingWordSlug })
    }
  }
  return clusters
}

function buildProposalUpsert(
  clusterKey: string,
  ruleSource: ReconstructionRuleSource,
  h: CandidateHypothesis,
  tokenIds: bigint[],
  siblingWordSlug: string | null,
  possibleEndingGap: boolean,
) {
  const exampleTokenIds = tokenIds.slice(0, EXAMPLE_TOKEN_LIMIT).map((id) => id.toString())

  return prismaCorpus.corpusCandidateProposal.upsert({
    where: {
      clusterKey_ruleSource_guessedStemType_guessedGrammeme: {
        clusterKey,
        ruleSource,
        guessedStemType: h.guessedStemType,
        guessedGrammeme: h.guessedGrammeme,
      },
    },
    create: {
      clusterKey,
      ruleSource,
      guessedPos: h.guessedPos,
      guessedStemType: h.guessedStemType,
      guessedGrammeme: h.guessedGrammeme,
      guessedStem: h.guessedStem,
      reconstructedForm: h.reconstructedForm,
      siblingWordSlug,
      possibleEndingGap,
      rank: h.rank,
      occurrenceCount: tokenIds.length,
      exampleTokenIds,
    },
    update: {
      occurrenceCount: tokenIds.length,
      exampleTokenIds,
      lastSeenAt: new Date(),
      rank: h.rank,
      possibleEndingGap,
      // status/resolutionNote/candidateId/reviewedBy* сознательно не
      // перечислены — см. комментарий над функцией.
    },
  })
}
