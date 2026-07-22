import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { computeLexiconFrequencies } from "@/lib/corpus/frequencies/compute-frequencies"
import { computeCefrLevels } from "@/lib/corpus/frequencies/compute-cefr-levels"

export async function POST(_request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const freqResult = await computeLexiconFrequencies()
    const cefrResult = await computeCefrLevels()
    return NextResponse.json({
      ok: true,
      updated: freqResult.updated,
      totalTokens: freqResult.totalTokens,
      zipfAlpha: freqResult.zipfAlpha,
      cefrUpdated: cefrResult.updated,
      cefrTotalLexemes: cefrResult.totalLexemes,
    })
  } catch (error) {
    console.error("Frequency recomputation failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}