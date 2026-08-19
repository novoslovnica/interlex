import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { decodeSlugParam } from "@/lib/slug"

/**
 * Читает CorpusTokenCandidate для одного токена — данные, на основании
 * которых Фаза 5 (ручное разрешение омонимии) строит выбор в TokenSidebar.
 * Гейтится той же Feature.CorpusTokenDisambiguate, что и сам resolve —
 * список кандидатов имеет смысл только внутри этого действия админки.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; tokenId: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusTokenDisambiguate))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug: rawSlug, tokenId } = await params
  const slug = decodeSlugParam(rawSlug)

  let id: bigint
  try {
    id = BigInt(tokenId)
  } catch {
    return NextResponse.json({ error: "Invalid tokenId" }, { status: 400 })
  }

  const token = await prismaCorpus.corpusToken.findFirst({
    where: { id, documentSlug: slug },
    select: {
      id: true,
      surfaceForm: true,
      wordSlug: true,
      lemma: true,
      pos: true,
      feats: true,
      matchCount: true,
      resolutionSource: true,
    },
  })
  if (!token) {
    return NextResponse.json({ error: "Token not found" }, { status: 404 })
  }

  const candidates = await prismaCorpus.corpusTokenCandidate.findMany({
    where: { tokenId: id },
    orderBy: { rank: "asc" },
  })

  return NextResponse.json({
    token: {
      id: token.id.toString(),
      surfaceForm: token.surfaceForm,
      wordSlug: token.wordSlug,
      lemma: token.lemma,
      pos: token.pos,
      feats: token.feats ?? {},
      matchCount: token.matchCount,
      resolutionSource: token.resolutionSource,
    },
    candidates: candidates.map((c) => ({
      id: c.id,
      wordSlug: c.wordSlug,
      lemma: c.lemma,
      pos: c.pos,
      feats: c.feats ?? {},
      flavor: c.flavor,
      score: c.score,
      source: c.source,
      rank: c.rank,
    })),
  })
}
