import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { fetchReviewBatches, undoHomonymReview, withHomonymReviewDb } from "@/lib/corpus/homonymReview"

export async function GET() {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  return NextResponse.json(withHomonymReviewDb(fetchReviewBatches))
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || !("batchId" in body) || typeof body.batchId !== "string" || !body.batchId) {
    return NextResponse.json({ error: "batchId is required" }, { status: 400 })
  }
  const { batchId } = body
  const result = withHomonymReviewDb((db) => undoHomonymReview(db, batchId, session.user?.id ?? session.user?.email ?? "unknown"))
  if (!result) return NextResponse.json({ error: "Пакет не найден" }, { status: 404 })
  return NextResponse.json({ ok: true, ...result })
}
