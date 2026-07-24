import { prismaCorpus, prismaData } from "@/lib/prisma"
import {
  diceCoefficient,
  pmi,
  logLikelihood,
  classifyByLogLikelihood,
  type CollocateClass,
} from "./metrics"

export interface CollocateResult {
  slug: string
  value: string | null
  f1: number
  f2: number
  f12: number
  dice: number
  pmi: number | null
  logLikelihood: number
  classification: CollocateClass
}

export interface CollocationAnalysis {
  targetSlug: string
  targetValue: string | null
  window: number
  totalCorpusTokens: number
  targetFrequency: number
  collocates: CollocateResult[]
}

export const DEFAULT_WINDOW = 5
export const MIN_WINDOW = 1
export const MAX_WINDOW = 20

// Finds the corpus collocates of `targetSlug` (a Lexeme.slug) within a
// symmetric token window, and classifies each as "core"/"periphery" of the
// word's distributional semantic field via log-likelihood significance
// (see lib/corpus/collocations/metrics.ts). Computed on demand per word, not
// batched over the whole vocabulary — this is an analytical lookup tool, not
// a nightly job.
export async function computeCollocations(
  targetSlug: string,
  window: number = DEFAULT_WINDOW,
): Promise<CollocationAnalysis> {
  const clampedWindow = Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, window))

  const targetLexeme = await prismaData.lexeme.findUnique({
    where: { slug: targetSlug },
    select: { value: true },
  })

  const [n, f1] = await Promise.all([
    prismaCorpus.corpusToken.count({ where: { wordSlug: { not: null } } }),
    prismaCorpus.corpusToken.count({ where: { wordSlug: targetSlug } }),
  ])

  if (f1 === 0) {
    return {
      targetSlug,
      targetValue: targetLexeme?.value ?? null,
      window: clampedWindow,
      totalCorpusTokens: n,
      targetFrequency: 0,
      collocates: [],
    }
  }

  // Windowed self-join: for every occurrence of the target word, count every
  // other word appearing within ±window token positions in the same
  // document. Windows around nearby occurrences of the target can overlap,
  // so a neighboring word can be counted more than once — this is the
  // standard per-occurrence span-counting convention used by collocation
  // extraction tools (e.g. Sketch Engine word sketches), not a bug.
  const coOccurrenceRows = await prismaCorpus.$queryRaw<{ wordSlug: string; f12: bigint }[]>`
    SELECT b."wordSlug" AS "wordSlug", COUNT(*) AS "f12"
    FROM "CorpusToken" a
    JOIN "CorpusToken" b
      ON a."documentSlug" = b."documentSlug"
     AND b."wordIndex" BETWEEN a."wordIndex" - ${clampedWindow} AND a."wordIndex" + ${clampedWindow}
     AND b."wordIndex" != a."wordIndex"
    WHERE a."wordSlug" = ${targetSlug}
      AND b."wordSlug" IS NOT NULL
      AND b."wordSlug" != ${targetSlug}
    GROUP BY b."wordSlug"
  `

  if (coOccurrenceRows.length === 0) {
    return {
      targetSlug,
      targetValue: targetLexeme?.value ?? null,
      window: clampedWindow,
      totalCorpusTokens: n,
      targetFrequency: f1,
      collocates: [],
    }
  }

  const candidateSlugs = coOccurrenceRows.map((r) => r.wordSlug)

  // Marginal frequency of each candidate, computed fresh from CorpusToken
  // (not the cached Lexeme.corpusFrequency) so the UI never shows two
  // disagreeing "frequency" numbers for the same word.
  const marginalCounts = await prismaCorpus.corpusToken.groupBy({
    by: ["wordSlug"],
    where: { wordSlug: { in: candidateSlugs } },
    _count: { _all: true },
  })
  const f2BySlug = new Map(marginalCounts.map((r) => [r.wordSlug as string, r._count._all]))

  const candidateLexemes = await prismaData.lexeme.findMany({
    where: { slug: { in: candidateSlugs } },
    select: { slug: true, value: true },
  })
  const valueBySlug = new Map(candidateLexemes.map((l) => [l.slug, l.value]))

  const collocates: CollocateResult[] = []
  for (const row of coOccurrenceRows) {
    const f12 = Number(row.f12)
    const f2 = f2BySlug.get(row.wordSlug) ?? f12
    const counts = { f1, f2, f12, n }
    const ll = logLikelihood(counts)
    const classification = classifyByLogLikelihood(ll)
    if (classification === null) continue // below significance floor — noise

    collocates.push({
      slug: row.wordSlug,
      value: valueBySlug.get(row.wordSlug) ?? null,
      f1,
      f2,
      f12,
      dice: diceCoefficient(counts),
      pmi: pmi(counts),
      logLikelihood: ll,
      classification,
    })
  }

  collocates.sort((a, b) => b.logLikelihood - a.logLikelihood)

  return {
    targetSlug,
    targetValue: targetLexeme?.value ?? null,
    window: clampedWindow,
    totalCorpusTokens: n,
    targetFrequency: f1,
    collocates,
  }
}
