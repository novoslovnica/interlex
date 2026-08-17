import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || ""
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = parseInt(searchParams.get("limit") || "50")
    const admin = searchParams.get("admin") === "true"
    const flagged = searchParams.get("flagged") === "true"
    const protoPending = searchParams.get("protoPending") === "true"
    const noProto = searchParams.get("noProto") === "true"

    const where: Record<string, unknown> = {}
    if (query.trim()) {
      where.value = { contains: query }
    }
    if (flagged) where.qualityFlagStatus = "pending"
    if (protoPending) where.protoSuggestionStatus = "pending"
    if (noProto) where.protoSlavicWordId = null

    if (admin) {
      const [items, total] = await Promise.all([
        db.morpheme.findMany({
          where,
          include: { protoSuggestion: { select: { id: true, lemma: true } } },
          orderBy: { value: "asc" },
          skip: offset,
          take: limit,
        }),
        db.morpheme.count({ where }),
      ])
      return NextResponse.json({ items, total })
    }

    const roots = await db.morpheme.findMany({
      where: query.trim() ? where : undefined,
      select: {
        id: true,
        value: true,
        lexemes_morphemes: {
          take: 10,
          select: {
            id: true,
            lexeme: {
              select: {
                id: true,
                value: true,
              },
            },
          },
        },
      },
      orderBy: { value: "asc" },
      take: 30,
    })

    return NextResponse.json(roots)
  } catch (error) {
    console.error("API Roots Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}