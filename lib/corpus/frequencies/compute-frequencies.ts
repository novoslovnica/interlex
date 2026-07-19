import { prismaData, prismaCorpus } from "@/lib/prisma"

export interface FrequencyResult {
  updated: number
  totalTokens: number
  zipfAlpha: number | null
}

async function getCorpusAggregation(): Promise<{ slug: string; count: number }[]> {
  const rows = await prismaCorpus.$queryRawUnsafe<
    { wordSlug: string | null; count: bigint }[]
  >(
    `SELECT "wordSlug", COUNT(*) as "count" FROM "CorpusToken" WHERE "wordSlug" IS NOT NULL GROUP BY "wordSlug"`,
  )

  return rows
    .filter((r) => r.wordSlug !== null)
    .map((r) => ({ slug: r.wordSlug!, count: Number(r.count) }))
    .sort((a, b) => b.count - a.count)
}

function computeZipfAlpha(
  points: { rank: number; freq: number }[],
): number | null {
  if (points.length < 2) return null

  const n = points.length
  let sumX = 0
  let sumY = 0
  let sumXY = 0
  let sumX2 = 0

  for (const p of points) {
    const x = Math.log(p.rank)
    const y = Math.log(p.freq)
    sumX += x
    sumY += y
    sumXY += x * y
    sumX2 += x * x
  }

  const denominator = n * sumX2 - sumX * sumX
  if (denominator === 0) return null

  const slope = (n * sumXY - sumX * sumY) / denominator
  return -slope
}

export async function computeLexiconFrequencies(): Promise<FrequencyResult> {
  const aggregated = await getCorpusAggregation()
  const totalTokens = aggregated.reduce((s, r) => s + r.count, 0)

  const updates: {
    slug: string
    corpusFrequency: number
    corpusFrequencyPerMln: number
    corpusRank: number
    corpusHapax: boolean
  }[] = []

  const regressionPoints: { rank: number; freq: number }[] = []

  for (let i = 0; i < aggregated.length; i++) {
    const rank = i + 1
    const count = aggregated[i].count
    const perMln = totalTokens > 0 ? (count / totalTokens) * 1_000_000 : 0

    updates.push({
      slug: aggregated[i].slug,
      corpusFrequency: count,
      corpusFrequencyPerMln: Math.round(perMln * 10000) / 10000,
      corpusRank: rank,
      corpusHapax: count === 1,
    })

    if (count >= 2) {
      regressionPoints.push({ rank, freq: count })
    }
  }

  const zipfAlpha = computeZipfAlpha(regressionPoints)

  await prismaData.$executeRawUnsafe(
    `UPDATE lexemes SET "corpusFrequency" = 0, "corpusFrequencyPerMln" = NULL, "corpusRank" = NULL, "corpusHapax" = NULL`,
  )

  const BATCH_SIZE = 1000
  for (let i = 0; i < updates.length; i += BATCH_SIZE) {
    const batch = updates.slice(i, i + BATCH_SIZE)
    await prismaData.$transaction(
      batch.map((u) =>
        prismaData.lexeme.update({
          where: { slug: u.slug },
          data: {
            corpusFrequency: u.corpusFrequency,
            corpusFrequencyPerMln: u.corpusFrequencyPerMln,
            corpusRank: u.corpusRank,
            corpusHapax: u.corpusHapax,
          },
        }),
      ),
    )
  }

  if (zipfAlpha !== null) {
    await prismaCorpus.corpusConfig.upsert({
      where: { key: "zipf_alpha" },
      create: { key: "zipf_alpha", value: String(zipfAlpha) },
      update: { value: String(zipfAlpha) },
    })
  }

  return {
    updated: updates.length,
    totalTokens,
    zipfAlpha,
  }
}