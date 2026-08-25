import { prismaCorpus } from "@/lib/prisma"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { MorphoCandidate } from "@/lib/corpus/tokenizer/types"
import { applyDocumentFlavorBias } from "@/lib/corpus/tokenizer/flavorBias"

interface TokenUpdate {
  id: bigint
  data: { lemma: string; pos: string; wordSlug: string | null; matchCount: number; isPartialMatch: boolean; feats: Record<string, string> }
  candidates: MorphoCandidate[]
}

export interface ReanalyzeResult {
  analyzed: number
  failed: number
  skippedManual: number
  total: number
}

type SentenceTokenRow = {
  id: bigint
  surfaceForm: string
  wordIndex: number
  sentenceId: string
  resolutionSource: string
}

/**
 * Разбор одного предложения — общее ядро для пересчёта целого документа и для
 * точечного пересчёта отдельных предложений (см. reanalyzeCorpusSentences).
 * Вынесено ровно затем, чтобы два пути не разъехались: в этом проекте
 * параллельные реализации одной и той же операции уже расходились не раз
 * (engine.ts против declineNoun.ts, два спрягателя глагола).
 */
function analyzeSentence(
  sentenceTokens: SentenceTokenRow[],
  analyzer: DbAnalyzer,
  collocationMatcher: CollocationMatcher,
  updates: TokenUpdate[],
  counters: { analyzed: number; failed: number; skippedManual: number },
): Promise<void> {
  return (async () => {
    let analyzed = counters.analyzed
    let failed = counters.failed
    let skippedManual = counters.skippedManual

  const surfaceForms = sentenceTokens.map((t) => t.surfaceForm)
  let i = 0
  while (i < sentenceTokens.length) {
    const token = sentenceTokens[i]

    // Ручной выбор омонима (см. CorpusTokenCandidate/resolve-эндпоинт)
    // не должен затираться реанализом — тот же guard, что уже есть у
    // CorpusDependency.source.
    if (token.resolutionSource === "manual") {
      skippedManual++
      i++
      continue
    }

    if (token.wordIndex === -1) {
      // matchCount: 1, not 0 - see the matching comment in
      // lib/corpus/tokenizer/tokenizer.ts's punctuation branch. 0 is
      // reserved for "genuinely unrecognized word".
      updates.push({ id: token.id, data: { pos: "PUNCT", lemma: token.surfaceForm, wordSlug: null, matchCount: 1, isPartialMatch: false, feats: {} }, candidates: [] })
      i++
      continue
    }

    const collocationMatch = collocationMatcher.matchAt(surfaceForms, i)
    if (collocationMatch) {
      const span = sentenceTokens.slice(i, i + collocationMatch.length)
      const spanHasManual = span.some((t) => t.resolutionSource === "manual")
      if (spanHasManual) {
        // Не трогаем весь фразовый спан, если хоть один токен в нём уже
        // разрешён вручную — частичная перезапись фразы дала бы
        // рассогласованную разметку.
        skippedManual++
        i++
        continue
      }
      analyzed += collocationMatch.length
      for (let k = 0; k < collocationMatch.length; k++) {
        updates.push({
          id: sentenceTokens[i + k].id,
          data: {
            lemma: collocationMatch.record.lemma,
            pos: collocationMatch.record.pos,
            wordSlug: collocationMatch.record.wordSlug,
            matchCount: 1,
            isPartialMatch: false,
            feats: {},
          },
          candidates: [{
            wordSlug: collocationMatch.record.wordSlug,
            lemma: collocationMatch.record.lemma,
            pos: collocationMatch.record.pos as MorphoCandidate["pos"],
            feats: {},
            score: 1,
            source: "collocation",
          }],
        })
      }
      i += collocationMatch.length
      continue
    }

    const leftNeighbor = i > 0 ? surfaceForms[i - 1] : undefined
    const analysis = await analyzer.analyzeWord(token.surfaceForm, { leftNeighbor })

    if (!analysis) {
      failed++
      updates.push({ id: token.id, data: { pos: "X", lemma: token.surfaceForm, wordSlug: null, matchCount: 0, isPartialMatch: false, feats: {} }, candidates: [] })
    } else {
      analyzed++
      updates.push({
        id: token.id,
        data: {
          lemma: analysis.lemma,
          pos: analysis.pos,
          wordSlug: analysis.wordSlug,
          matchCount: analysis.matchCount ?? 0,
          isPartialMatch: !!analysis.isPartialMatch,
          feats: analysis.feats as Record<string, string>,
        },
        candidates: analysis.candidates ?? [],
      })
    }
    i++
  }

    counters.analyzed = analyzed
    counters.failed = failed
    counters.skippedManual = skippedManual
  })()
}

/**
 * Пересчитывает POS-tagging/леммы/кандидатов-омонимов для одного документа.
 * analyzer/collocationMatcher строятся вызывающей стороной один раз —
 * при массовом прогоне по многим документам (см.
 * scripts/db/2026-07-28-reanalyze-all-documents.ts) их пересборка на
 * каждый документ была бы избыточной (buildValidEndings/buildCollocationRecords
 * читают всю таблицу лексем).
 *
 * Возвращает null, если документа с таким slug нет.
 */
export async function reanalyzeCorpusDocument(
  slug: string,
  analyzer: DbAnalyzer,
  collocationMatcher: CollocationMatcher,
): Promise<ReanalyzeResult | null> {
  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
  if (!doc) return null

  const tokens = await prismaCorpus.corpusToken.findMany({
    where: { documentSlug: slug },
    select: { id: true, surfaceForm: true, wordIndex: true, sentenceId: true, resolutionSource: true },
    orderBy: { tokenIndex: "asc" },
  })

  // Группируем по предложению (в порядке tokenIndex), чтобы дать
  // CollocationMatcher видеть последовательность токенов, а не по одному —
  // иначе многословные лексемы никогда не находятся.
  const bySentence = new Map<string, typeof tokens>()
  for (const t of tokens) {
    const arr = bySentence.get(t.sentenceId)
    if (arr) arr.push(t)
    else bySentence.set(t.sentenceId, [t])
  }

  const counters = { analyzed: 0, failed: 0, skippedManual: 0 }
  const updates: TokenUpdate[] = []

  for (const sentenceTokens of bySentence.values()) {
    await analyzeSentence(sentenceTokens, analyzer, collocationMatcher, updates, counters)
  }

  applyDocumentFlavorBias(
    updates,
    (u) => u.candidates,
    (u) => u.data.matchCount,
    (u, winner) => {
      u.data.wordSlug = winner.wordSlug
      u.data.lemma = winner.lemma
      u.data.pos = winner.pos
      u.data.feats = winner.feats as Record<string, string>
    },
  )

  await persistUpdates(updates, slug)

  await prismaCorpus.corpusDocument.update({
    where: { slug },
    data: {},
  })

  return { ...counters, total: tokens.length }
}

/**
 * Запись результатов разбора. Общая для обоих путей — документного и
 * пооткрытого по предложениям.
 */
async function persistUpdates(updates: TokenUpdate[], documentSlug?: string): Promise<void> {
  const BATCH_SIZE = 1000
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    await prismaCorpus.$transaction(async (tx) => {
      for (const u of batch) {
        await tx.corpusToken.updateMany({
          where: documentSlug ? { id: u.id, documentSlug } : { id: u.id },
          data: u.data,
        })
        await tx.corpusTokenCandidate.deleteMany({ where: { tokenId: u.id } })
        if (u.candidates.length > 0) {
          await tx.corpusTokenCandidate.createMany({
            data: u.candidates.map((c, rank) => ({
              tokenId: u.id,
              wordSlug: c.wordSlug,
              lemma: c.lemma,
              pos: c.pos,
              feats: c.feats as Record<string, string>,
              flavor: c.flavor,
              score: c.score,
              source: c.source,
              rank,
            })),
          })
        }
      }
    })
  }
}

/**
 * Точечный пересчёт: разбирает только перечисленные предложения.
 *
 * Единица — предложение, а не документ и не токен. Документ слишком крупен:
 * формы одного частотного слова разбросаны по 613 документам из 3 509, то
 * есть «инкрементальный» пересчёт выродился бы в шестую часть полного.
 * Отдельный токен слишком мелок: и сопоставление многословных лексем, и
 * контекст «слово слева» для управления предлога определены на предложении.
 *
 * Отличие от документного пути ровно одно: не применяется
 * applyDocumentFlavorBias — он считает перевес флейвора по однозначным
 * токенам всего документа, а здесь документа целиком нет. На текущих данных
 * это без последствий (в словаре всего три не-CORE флейворные пометки, ни у
 * одного документа перевеса не набирается), но при накоплении флейворной
 * разметки полный прогон останется единственным местом, где смещение
 * учитывается.
 */
export async function reanalyzeCorpusSentences(
  sentenceIds: string[],
  analyzer: DbAnalyzer,
  collocationMatcher: CollocationMatcher,
): Promise<ReanalyzeResult> {
  const counters = { analyzed: 0, failed: 0, skippedManual: 0 }
  if (sentenceIds.length === 0) return { ...counters, total: 0 }

  // Идентификаторы отдаются частями: и SQLite ограничивает число параметров,
  // и Prisma рендерит IN рекурсивно — на 241 141 значении это укладывает
  // движок в RangeError (поймано на первом же сквозном прогоне).
  const ID_CHUNK = 500
  const tokens: SentenceTokenRow[] = []
  for (let i = 0; i < sentenceIds.length; i += ID_CHUNK) {
    const chunk = await prismaCorpus.corpusToken.findMany({
      where: { sentenceId: { in: sentenceIds.slice(i, i + ID_CHUNK) } },
      select: { id: true, surfaceForm: true, wordIndex: true, sentenceId: true, resolutionSource: true },
      orderBy: { tokenIndex: "asc" },
    })
    tokens.push(...chunk)
  }

  const bySentence = new Map<string, SentenceTokenRow[]>()
  for (const t of tokens) {
    const arr = bySentence.get(t.sentenceId)
    if (arr) arr.push(t)
    else bySentence.set(t.sentenceId, [t])
  }

  const updates: TokenUpdate[] = []
  for (const sentenceTokens of bySentence.values()) {
    await analyzeSentence(sentenceTokens, analyzer, collocationMatcher, updates, counters)
  }

  await persistUpdates(updates)

  return { ...counters, total: tokens.length }
}
