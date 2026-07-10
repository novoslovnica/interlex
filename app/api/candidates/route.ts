import { NextResponse } from "next/server"
import { prismaData as db } from "@/lib/prisma"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.CandidatesPromote)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get("search") || ""
    const offset = parseInt(searchParams.get("offset") || "0")
    const limit = parseInt(searchParams.get("limit") || "50")

    const where: Record<string, unknown> = {}
    if (query.trim()) {
      where.OR = [
        { value: { contains: query } },
        { isv: { contains: query } },
        { nsl: { contains: query } },
      ]
    }

    const [items, total] = await Promise.all([
      db.candidate.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: offset,
        take: limit,
      }),
      db.candidate.count({ where }),
    ])

    return NextResponse.json({ items, total })
  } catch (error) {
    console.error("API Candidates Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await auth()
    if (!await checkPermission(session, Feature.CandidatesDelete)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { ids } = await request.json()
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "ids array required" }, { status: 400 })
    }

    await db.candidate.deleteMany({
      where: { id: { in: ids } },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("API Candidates Delete Error:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}