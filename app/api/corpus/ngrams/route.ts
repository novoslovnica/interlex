import { NextRequest, NextResponse } from "next/server"
import { prismaCorpus, prismaData } from "@/lib/prisma"
import { NGRAM_SIZES } from "@/lib/corpus/collocations/computeNgrams"

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

// Публичный браузер n-грамм (roadmap #44, вкладка "N-граммы") — читает
// CorpusNgram, уже посчитанную lib/corpus/collocations/computeNgrams.ts.
// Без авторизации, только чтение.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const nParam = Number(searchParams.get("n"))
  const n = (NGRAM_SIZES as readonly number[]).includes(nParam) ? nParam : 2

  const search = searchParams.get("search")?.trim() || ""
  const sort = searchParams.get("sort") === "score" ? "score" : "frequency"
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT))

  const where = {
    n,
    ...(search ? { displayText: { contains: search } } : {}),
  }

  const [ngramRows, total] = await Promise.all([
    prismaCorpus.corpusNgram.findMany({
      where,
      orderBy: { [sort]: "desc" },
      skip: offset,
      take: limit,
    }),
    prismaCorpus.corpusNgram.count({ where }),
  ])

  // CorpusNgram only stores Lexeme.slug (corpus.db/interlex.db never share
  // a query) — resolve /words/[id] links here with one batched interlex.db
  // lookup, same merge-in-JS pattern compute-collocations.ts already uses.
  const distinctSlugs = [...new Set(ngramRows.flatMap((r) => r.slugs as string[]))]
  const lexemes = await prismaData.lexeme.findMany({
    where: { slug: { in: distinctSlugs } },
    select: { slug: true, id: true },
  })
  const idBySlug = new Map(lexemes.map((l) => [l.slug, l.id]))

  const items = ngramRows.map((r) => ({
    ...r,
    wordIds: (r.slugs as string[]).map((s) => idBySlug.get(s) ?? null),
  }))

  return NextResponse.json({ items, total, offset, limit, n, sort })
}
