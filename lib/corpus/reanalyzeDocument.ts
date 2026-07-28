import { prismaCorpus } from "@/lib/prisma"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { MorphoCandidate } from "@/lib/corpus/tokenizer/types"
import { applyDocumentFlavorBias } from "@/lib/corpus/tokenizer/flavorBias"

interface TokenUpdate {
  id: bigint
  data: { lemma: string; pos: string; wordSlug: string | null; matchCount: number; feats: Record<string, string> }
  candidates: MorphoCandidate[]
}

export interface ReanalyzeResult {
  analyzed: number
  failed: number
  skippedManual: number
  total: number
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

  let analyzed = 0
  let failed = 0
  let skippedManual = 0
  const updates: TokenUpdate[] = []

  for (const sentenceTokens of bySentence.values()) {
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
        updates.push({ id: token.id, data: { pos: "PUNCT", lemma: token.surfaceForm, wordSlug: null, matchCount: 0, feats: {} }, candidates: [] })
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
        updates.push({ id: token.id, data: { pos: "X", lemma: token.surfaceForm, wordSlug: null, matchCount: 0, feats: {} }, candidates: [] })
      } else {
        analyzed++
        updates.push({
          id: token.id,
          data: {
            lemma: analysis.lemma,
            pos: analysis.pos,
            wordSlug: analysis.wordSlug,
            matchCount: analysis.matchCount ?? 0,
            feats: analysis.feats as Record<string, string>,
          },
          candidates: analysis.candidates ?? [],
        })
      }
      i++
    }
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

  const BATCH_SIZE = 1000
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    await prismaCorpus.$transaction(async (tx) => {
      for (const u of batch) {
        await tx.corpusToken.updateMany({ where: { id: u.id, documentSlug: slug }, data: u.data })
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

  await prismaCorpus.corpusDocument.update({
    where: { slug },
    data: {},
  })

  return { analyzed, failed, skippedManual, total: tokens.length }
}
