import { NextRequest, NextResponse } from "next/server"
import { prismaLibrary as db } from "@/lib/prisma"

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query") || ""
  if (!query.trim()) return NextResponse.json([])

  const entries = await db.libraryEntry.findMany({
    where: { title: { contains: query } },
    select: { id: true, title: true, slug: true },
    take: 20,
    orderBy: { title: "asc" },
  })

  return NextResponse.json(entries)
}