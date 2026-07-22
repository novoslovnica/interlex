import { prismaData, prismaCorpus } from "@/lib/prisma"

export interface CefrResult {
  updated: number
  totalTokens: number
  totalLexemes: number
}

const SLAVIC_LANG_CODES = [
  "ru", "uk", "be", "pl", "cs", "sk", "sl", "hr", "sr", "mk", "bg",
] as const

function computeKSlav(intelligibility: string | null): number {
  if (!intelligibility) return 1.3
  const parts = intelligibility.split(" ").filter(Boolean)
  let plusCount = 0
  let totalCount = 0
  for (const part of parts) {
    const code = part.slice(0, 2)
    const mark = part.slice(2)
    if (SLAVIC_LANG_CODES.includes(code as (typeof SLAVIC_LANG_CODES)[number])) {
      totalCount++
      if (mark === "+") plusCount++
    }
  }
  if (totalCount === 0) return 1.3
  const ratio = plusCount / totalCount
  return 1.0 + 0.3 * ratio
}

interface GenreCount {
  genre: string
  count: number
}

interface LemmaGenreData {
  slug: string
  genreCounts: GenreCount[]
  totalCount: number
}

interface GenreTotal {
  genre: string
  total: number
}

async function getPerGenreAggregation(): Promise<{
  lemmaData: LemmaGenreData[]
  genreTotals: GenreTotal[]
  grandTotal: number
}> {
  const rows = await prismaCorpus.$queryRawUnsafe<
    { wordSlug: string; genre: string; count: bigint }[]
  >(
    `SELECT ct."wordSlug", cd."genre", COUNT(*) as "count"
     FROM "CorpusToken" ct
     JOIN "CorpusDocument" cd ON ct."documentSlug" = cd."slug"
     WHERE ct."wordSlug" IS NOT NULL
     GROUP BY ct."wordSlug", cd."genre"
     ORDER BY ct."wordSlug", cd."genre"`,
  )

  const genreTotalsRaw = await prismaCorpus.$queryRawUnsafe<
    { genre: string; total: bigint }[]
  >(
    `SELECT cd."genre", COUNT(*) as "total"
     FROM "CorpusToken" ct
     JOIN "CorpusDocument" cd ON ct."documentSlug" = cd."slug"
     WHERE ct."wordSlug" IS NOT NULL
     GROUP BY cd."genre"`,
  )

  const genreTotals: GenreTotal[] = genreTotalsRaw.map((r) => ({
    genre: r.genre,
    total: Number(r.total),
  }))
  const grandTotal = genreTotals.reduce((s, g) => s + g.total, 0)

  const slugMap = new Map<string, GenreCount[]>()
  for (const row of rows) {
    const existing = slugMap.get(row.wordSlug) ?? []
    existing.push({ genre: row.genre, count: Number(row.count) })
    slugMap.set(row.wordSlug, existing)
  }

  const lemmaData: LemmaGenreData[] = []
  for (const [slug, genreCounts] of slugMap) {
    const totalCount = genreCounts.reduce((s, g) => s + g.count, 0)
    lemmaData.push({ slug, genreCounts, totalCount })
  }

  return { lemmaData, genreTotals, grandTotal }
}

function computeJuillandsD(genreCounts: GenreCount[], genreCount: number): number {
  if (genreCount <= 1) return 0.01

  const mean = genreCounts.reduce((s, g) => s + g.count, 0) / genreCount
  if (mean === 0) return 0.01

  const variance = genreCounts.reduce((s, g) => s + (g.count - mean) ** 2, 0) / (genreCount - 1)
  const std = Math.sqrt(variance)
  const V = std / mean

  let D = 1 - V / Math.sqrt(genreCount - 1)
  D = Math.max(0.01, Math.min(1.0, D))
  return Math.round(D * 100) / 100
}

function getCefrLevel(index: number, totalWithScore: number): string {
  let cumulative = 0
  const tiers: [number, string][] = [
    [500, "A1"],
    [1000, "A2"],
    [2000, "B1"],
    [3000, "B2"],
    [5000, "C1"],
  ]
  for (const [size, level] of tiers) {
    cumulative += size
    if (index < cumulative) return level
  }
  return "C2"
}

export async function computeCefrLevels(): Promise<CefrResult> {
  const { lemmaData, genreTotals, grandTotal } = await getPerGenreAggregation()
  const genreCount = genreTotals.length

  const slugKSlav = new Map<string, number>()
  const allLexemes = await prismaData.lexeme.findMany({
    select: { slug: true, intelligibility: true },
  })
  for (const lex of allLexemes) {
    slugKSlav.set(lex.slug, computeKSlav(lex.intelligibility))
  }

  const scored: {
    slug: string
    totalCount: number
    fIpm: number
    distributionD: number
    usageScore: number
  }[] = []

  for (const entry of lemmaData) {
    const fIpm = grandTotal > 0 ? (entry.totalCount / grandTotal) * 1_000_000 : 0
    const distributionD = computeJuillandsD(entry.genreCounts, genreCount)
    const kSlav = slugKSlav.get(entry.slug) ?? 1.3
    const usageScore = fIpm * distributionD * kSlav

    scored.push({
      slug: entry.slug,
      totalCount: entry.totalCount,
      fIpm: Math.round(fIpm * 100) / 100,
      distributionD,
      usageScore: Math.round(usageScore * 100) / 100,
    })
  }

  scored.sort((a, b) => b.usageScore - a.usageScore)

  const scoredWithScore = scored.filter((s) => s.usageScore > 0)
  const existingSlugs = new Set(scored.map((s) => s.slug))

  await prismaData.$executeRawUnsafe(
    `UPDATE lexemes SET "distributionD" = NULL, "usageScore" = NULL, "cefrLevel" = NULL`,
  )

  const BATCH_SIZE = 1000
  for (let i = 0; i < scored.length; i += BATCH_SIZE) {
    const batch = scored.slice(i, i + BATCH_SIZE)
    await prismaData.$transaction(
      batch.map((s) => {
        const cefrLevel = s.usageScore > 0
          ? getCefrLevel(scoredWithScore.indexOf(s), scoredWithScore.length)
          : "C2"
        return prismaData.lexeme.updateMany({
          where: { slug: s.slug },
          data: {
            corpusFrequency: s.totalCount,
            corpusFrequencyPerMln: s.fIpm,
            distributionD: s.distributionD,
            usageScore: s.usageScore,
            cefrLevel,
          },
        })
      }),
    )
  }

  const zeroSlugs = allLexemes
    .filter((l) => !existingSlugs.has(l.slug))
    .map((l) => l.slug)
  for (let i = 0; i < zeroSlugs.length; i += BATCH_SIZE) {
    const batch = zeroSlugs.slice(i, i + BATCH_SIZE)
    await prismaData.$transaction(
      batch.map((slug) =>
        prismaData.lexeme.updateMany({
          where: { slug },
          data: {
            corpusFrequency: 0,
            corpusFrequencyPerMln: 0,
            distributionD: 0.01,
            usageScore: 0,
            cefrLevel: "C2",
          },
        }),
      ),
    )
  }

  await prismaCorpus.corpusConfig.upsert({
    where: { key: "cefr_last_recalculated" },
    create: { key: "cefr_last_recalculated", value: new Date().toISOString() },
    update: { value: new Date().toISOString() },
  })

  return {
    updated: scored.length + zeroSlugs.length,
    totalTokens: grandTotal,
    totalLexemes: allLexemes.length,
  }
}