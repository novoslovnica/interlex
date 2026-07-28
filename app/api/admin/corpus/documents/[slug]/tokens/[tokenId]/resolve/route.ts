import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { resolveTokenHomonym, ResolveTokenInput } from "@/lib/corpus/resolveTokenHomonym"

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string; tokenId: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug, tokenId } = await params

  let id: bigint
  try {
    id = BigInt(tokenId)
  } catch {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 })
  }

  const body = (await request.json().catch(() => null)) as ResolveTokenInput | null
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 })
  }

  const result = await resolveTokenHomonym(slug, id, body)

  if (result.status === "not_found") {
    return NextResponse.json({ error: "Token not found" }, { status: 404 })
  }
  if (result.status === "invalid_input") {
    return NextResponse.json({ error: result.message }, { status: 400 })
  }

  return NextResponse.json({ ok: true, wordSlug: result.wordSlug, lemma: result.lemma, pos: result.pos, feats: result.feats })
}
