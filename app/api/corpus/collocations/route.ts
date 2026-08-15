import { NextRequest, NextResponse } from "next/server"
import { prismaData } from "@/lib/prisma"
import { resolveLexemeDisplayValues } from "@/lib/lexemeDisplayValue"

const DEFAULT_LIMIT = 30
const MAX_LIMIT = 100

// Идиомы/устойчивые словосочетания (Lexeme.isCollocation=true), уже
// имеющие реальную частоту из scripts/compute-lexicon-frequency.ts — ничего
// нового вычислять не нужно, только отдать список (roadmap #44, вкладка
// "Идиомы"). Без авторизации — те же данные (и больше) публично видны на
// странице отдельного слова.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const search = searchParams.get("search")?.trim() || ""
  const offset = Math.max(0, Number(searchParams.get("offset")) || 0)
  const limit = Math.min(MAX_LIMIT, Math.max(1, Number(searchParams.get("limit")) || DEFAULT_LIMIT))

  // l.value is a search/matching-normalization field, not the real written
  // form — safe to filter on for "search" here, but not to display (see
  // lib/lexemeDisplayValue.ts).
  const where = {
    isCollocation: true,
    ...(search ? { value: { contains: search } } : {}),
  }

  const [rows, total] = await Promise.all([
    prismaData.lexeme.findMany({
      where,
      select: {
        id: true,
        slug: true,
        value: true,
        pos: true,
        mainCategory: true,
        corpusFrequency: true,
        corpusFrequencyPerMln: true,
      },
      orderBy: { corpusFrequency: "desc" },
      skip: offset,
      take: limit,
    }),
    prismaData.lexeme.count({ where }),
  ])

  const displayBySlug = await resolveLexemeDisplayValues(rows.map((r) => r.slug))
  const items = rows.map((r) => ({ ...r, value: displayBySlug.get(r.slug)?.value ?? r.value }))

  return NextResponse.json({ items, total, offset, limit })
}
