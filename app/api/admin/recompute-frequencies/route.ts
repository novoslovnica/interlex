import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { computeLexiconFrequencies } from "@/lib/corpus/frequencies/compute-frequencies"

export async function POST(_request: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  }

  try {
    const result = await computeLexiconFrequencies()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("Frequency recomputation failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}