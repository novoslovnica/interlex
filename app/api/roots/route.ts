import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get("query") || ""
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = parseInt(searchParams.get("limit") || "50")
    const admin = searchParams.get("admin") === "true"

    const where: Record<string, unknown> = {}
    if (query.trim()) {
      where.value = { contains: query }
    }

    if (admin) {
      const [items, total] = await Promise.all([
        db.root.findMany({
          where,
          orderBy: { value: "asc" },
          skip: offset,
          take: limit,
        }),
        db.root.count({ where }),
      ])
      return NextResponse.json({ items, total })
    }

    const roots = await db.root.findMany({
      where: query.trim() ? where : undefined,
      select: {
        id: true,
        value: true,
        roots_words: {
          take: 10,
          select: {
            id: true,
            word: {
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