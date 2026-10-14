import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { resolveTokenHomonymGroup } from "@/lib/corpus/resolveTokenHomonym"

/**
 * Массовое разрешение омонимов группы (roadmap п.111): одно решение модератора
 * закрывает все неразрешённые токены группы. Логика — в
 * lib/corpus/resolveTokenHomonym.ts (resolveTokenHomonymGroup), здесь только
 * сессия, гейт и разбор тела — тот же приём, что и у точечного resolve-роута.
 */
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | { groupKey?: string; wordSlug?: string }
    | null
  if (!body || typeof body.groupKey !== "string" || typeof body.wordSlug !== "string") {
    return NextResponse.json({ error: "groupKey and wordSlug are required" }, { status: 400 })
  }

  const result = await resolveTokenHomonymGroup(body.groupKey, body.wordSlug)

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Group has no unresolved tokens" }, { status: 404 })
  }
  if (result.status === "invalid_input") {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({
    ok: true,
    resolvedTokens: result.resolvedTokens,
    wordSlug: result.wordSlug,
    lemma: result.lemma,
    pos: result.pos,
  })
}
