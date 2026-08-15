import { NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { computeNgrams } from "@/lib/corpus/collocations/computeNgrams"

export async function POST() {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  try {
    const result = await computeNgrams()
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    console.error("N-gram recomputation failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}
