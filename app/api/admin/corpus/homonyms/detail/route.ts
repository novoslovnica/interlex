import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { fetchReviewContexts, withHomonymReviewDb } from "@/lib/corpus/homonymReview"
import { fetchHomonymGroupDetail } from "@/lib/corpus/fetchHomonymGroups"

/** Candidates plus a bounded page of contexts, protected by the same
 * feature permission as applying and undoing reviews. */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as { groupKey?: string; after?: string } | null
  if (!body || typeof body.groupKey !== "string" || body.groupKey.length === 0) {
    return NextResponse.json({ error: "groupKey is required" }, { status: 400 })
  }

  if (body.after !== undefined && (typeof body.after !== "string" || !/^\d{1,19}$/.test(body.after) || BigInt(body.after) > 9223372036854775807n)) {
    return NextResponse.json({ error: "Invalid cursor" }, { status: 400 })
  }
  const detail = await fetchHomonymGroupDetail(body.groupKey)
  const page = withHomonymReviewDb((db) => db.transaction(() => fetchReviewContexts(db, body.groupKey!, body.after)).deferred())
  return NextResponse.json({ ...detail, ...page })
}
