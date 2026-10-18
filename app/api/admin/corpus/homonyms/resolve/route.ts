import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { applyHomonymReview, HomonymReviewConflict, isReviewedTokens, withHomonymReviewDb } from "@/lib/corpus/homonymReview"

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }
  const body: unknown = await request.json().catch(() => null)
  if (!body || typeof body !== "object" || !("groupKey" in body) || !("wordSlug" in body) || !("tokens" in body)
    || typeof body.groupKey !== "string" || !body.groupKey || typeof body.wordSlug !== "string" || !body.wordSlug
    || !isReviewedTokens(body.tokens)) {
    return NextResponse.json({ error: "Выберите от 1 до 50 проверенных вхождений. Решение для всей группы запрещено." }, { status: 400 })
  }
  const { groupKey, wordSlug, tokens } = body
  try {
    const result = withHomonymReviewDb((db) => applyHomonymReview(db, {
      groupKey, wordSlug, tokens, user: session.user ?? {},
    }))
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    if (error instanceof HomonymReviewConflict) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    throw error
  }
}
