import { prismaCorpus, prismaData } from "@/lib/prisma"
import {
  buildEndingReverseIndex,
  buildHypothesesForSurfaceForm,
  buildStemTypeSupport,
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
  restoredToPending: number
  movedToDeferred: number
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
  /** Порог попадания в рабочую очередь, см. PENDING_MIN_OCCURRENCES. */
  pendingMinOccurrences?: number
  /**
   * Ограничить генерацию перечисленными кластерами. Нужен точечному
   * обновлению (lib/corpus/refresh.ts): после заведения нескольких лексем
   * пересчитывать все 186 тысяч кластеров бессмысленно.
   */
  clusterKeys?: string[]
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
/**
 * Сколько раз слово должно встретиться в корпусе, чтобы попасть в очередь на
 * ревью, а не в отложенные.
 *
 * Замер на живом корпусе (186 761 кластер): 109 173 из них (58%) — гапаксы,
 * то есть одно вхождение на 5,1 млн токенов; ещё 34 779 встретились дважды.
 * Разобрать 186 тысяч решений вручную нереально, а гапакс в корпусе такого
 * размера почти всегда опечатка, имя собственное или иностранное слово.
 *
 * Значение 2 — самое осторожное из осмысленных: откладывает только настоящие
 * гапаксы и убирает из очереди 58%, не трогая ничего, что встретилось хотя бы
 * дважды. Более агрессивная отсечка — решение мейнтейнера, поэтому порог
 * вынесен в параметр.
 *
 * ВАЖНО: отложенное — это НЕ отклонённое. Статус 'deferred' означает "пока
 * не показываем", и при следующей перегенерации слово вернётся в очередь
 * само, если наберёт вхождения (см. syncUnreviewedStatuses). Отклонение
 * ('rejected') — утверждение "это не слово", которого мы про гапаксы не знаем.
 */
export const PENDING_MIN_OCCURRENCES = 2

export async function generateCorpusCandidateProposals(
  options: GenerateProposalsOptions = {},
): Promise<GenerateProposalsResult> {
  const reverseIndex = await buildEndingReverseIndex()
  // Доля словаря по классам основ — чтобы не предлагать классы, которых в
  // языке фактически нет (см. buildStemTypeSupport).
  const stemTypeSupport = await buildStemTypeSupport()
  const pendingMin = options.pendingMinOccurrences ?? PENDING_MIN_OCCURRENCES

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

  if (options.clusterKeys) {
    const wanted = new Set(options.clusterKeys)
    redClusters = new Map([...redClusters].filter(([key]) => wanted.has(key)))
    yellowClusters = new Map([...yellowClusters].filter(([key]) => wanted.has(key)))
  }

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
    const hypotheses = buildHypothesesForSurfaceForm(cluster.surfaceForm, reverseIndex, stemTypeSupport)
    for (const h of hypotheses) {
      buffer.push(buildProposalUpsert(clusterKey, "red_reverse_lookup", h, cluster.tokenIds, null, false, pendingMin))
      if (buffer.length >= UPSERT_BATCH_SIZE) await flush()
    }
  }

  for (const [clusterKey, cluster] of yellowClusters) {
    const hypotheses = buildHypothesesForSurfaceForm(cluster.surfaceForm, reverseIndex, stemTypeSupport)
    const siblingStem = cluster.siblingWordSlug ? siblingStemBySlug.get(cluster.siblingWordSlug) : undefined
    for (const h of hypotheses) {
      const possibleEndingGap = !!siblingStem && h.guessedStem.toLowerCase() === siblingStem
      buffer.push(buildProposalUpsert(clusterKey, "yellow_stem_sibling", h, cluster.tokenIds, cluster.siblingWordSlug, possibleEndingGap, pendingMin))
      if (buffer.length >= UPSERT_BATCH_SIZE) await flush()
    }
  }

  await flush()

  const statusSync = await syncUnreviewedStatuses(pendingMin)

  return {
    ...statusSync,
    clustersProcessed: redClusters.size + yellowClusters.size,
    hypothesesUpserted,
    redTokens: redTokenRows.length,
    yellowTokens: yellowTokenRows.length,
  }
}

/**
 * Приводит статус НЕ рассмотренных строк в соответствие с их текущей
 * частотностью: слово, набравшее вхождения, возвращается в очередь, а
 * упавшее ниже порога — уходит в отложенные.
 *
 * Трогает только пару pending <-> deferred. Решения модератора
 * ('rejected'/'promoted'/'merged_into_existing') не затрагиваются ни при
 * каких условиях — та же гарантия, что и у upsert, который сознательно не
 * пишет status в ветке update.
 *
 * Два отдельных updateMany, а не пересчёт по строкам: обе выборки
 * покрываются существующим индексом (status, occurrenceCount).
 */
async function syncUnreviewedStatuses(pendingMinOccurrences: number): Promise<{
  restoredToPending: number
  movedToDeferred: number
}> {
  const restored = await prismaCorpus.corpusCandidateProposal.updateMany({
    where: { status: "deferred", occurrenceCount: { gte: pendingMinOccurrences } },
    data: { status: "pending" },
  })
  const deferred = await prismaCorpus.corpusCandidateProposal.updateMany({
    where: { status: "pending", occurrenceCount: { lt: pendingMinOccurrences } },
    data: { status: "deferred" },
  })
  return { restoredToPending: restored.count, movedToDeferred: deferred.count }
}

/**
 * Закрывает предложения по словам, которые перестали быть красными или
 * жёлтыми: их завели в словарь, или они распознались после правки движка.
 *
 * Без этого очередь не сходится ни при каких условиях: генератор работает
 * upsert-ом и никогда не удаляет строки, поэтому кластер, once попавший в
 * таблицу, оставался бы в ней вечно. Именно так 74 831 кластер, посчитанный
 * по корпусу из 300 документов, дожил до корпуса из 3 509 — их пришлось
 * вычищать вручную.
 *
 * Не удаляет, а помечает 'resolved_recognized': видно, что слово прошло
 * через очередь и чем закончилось. Решения модератора не трогаются — только
 * 'pending' и 'deferred'.
 */
export async function reconcileProposals(): Promise<{
  closedClusters: number
  closedRows: number
}> {
  const live = new Set<string>()

  const redRows = await prismaCorpus.corpusToken.findMany({
    where: { matchCount: 0, wordIndex: { not: -1 } },
    select: { surfaceForm: true },
  })
  for (const t of redRows) {
    const key = normalizeSurfaceForm(t.surfaceForm)
    if (key) live.add(key)
  }

  const yellowRows = await prismaCorpus.corpusToken.findMany({
    where: { matchCount: 1, isPartialMatch: true, wordSlug: { not: null }, wordIndex: { not: -1 } },
    select: { surfaceForm: true },
  })
  for (const t of yellowRows) {
    const key = normalizeSurfaceForm(t.surfaceForm)
    if (key) live.add(key)
  }

  const open = await prismaCorpus.corpusCandidateProposal.findMany({
    where: { status: { in: ["pending", "deferred"] } },
    select: { clusterKey: true },
    distinct: ["clusterKey"],
  })
  const stale = open.map((o) => o.clusterKey).filter((key) => !live.has(key))
  if (stale.length === 0) return { closedClusters: 0, closedRows: 0 }

  // Разбиваем на части: SQLite ограничивает число параметров в IN.
  const CHUNK = 500
  let closedRows = 0
  for (let i = 0; i < stale.length; i += CHUNK) {
    const result = await prismaCorpus.corpusCandidateProposal.updateMany({
      where: { clusterKey: { in: stale.slice(i, i + CHUNK) }, status: { in: ["pending", "deferred"] } },
      data: {
        status: "resolved_recognized",
        resolutionNote: "слово больше не красное и не жёлтое — распознаётся корпусом",
        reviewedAt: new Date(),
      },
    })
    closedRows += result.count
  }

  return { closedClusters: stale.length, closedRows }
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
  pendingMinOccurrences: number,
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
      status: tokenIds.length >= pendingMinOccurrences ? "pending" : "deferred",
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
