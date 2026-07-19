import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import type { TokenResult, SegmentResult } from "@/components/CorpusTokenDisplay"

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string; position: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug, position } = await params
  const pos = parseInt(position, 10)
  if (isNaN(pos)) {
    return NextResponse.json({ error: "Invalid position" }, { status: 400 })
  }

  const segment = await prismaCorpus.corpusSegment.findFirst({
    where: { documentSlug: slug, position: pos },
  })
  if (!segment) {
    return NextResponse.json({ error: "Segment not found" }, { status: 404 })
  }

  const sentences = await prismaCorpus.corpusSentence.findMany({
    where: { documentSlug: slug, segmentId: segment.id },
    orderBy: { position: "asc" },
    include: {
      tokens: {
        where: { documentSlug: slug },
        orderBy: { tokenIndex: "asc" },
        select: {
          surfaceForm: true,
          lemma: true,
          pos: true,
          wordSlug: true,
          feats: true,
          wordIndex: true,
        },
      },
    },
  })

  const segmentResult: SegmentResult = {
    position: segment.position,
    rawText: segment.rawText,
    sentences: sentences.map((s) => ({
      position: s.position,
      segmentIndex: segment.position,
      rawText: s.rawText,
      tokens: s.tokens.map((t) => {
        const isPunctuation = t.wordIndex === -1
        const isRecognized = !isPunctuation && t.wordSlug !== null
        return {
          surfaceForm: t.surfaceForm,
          isPunctuation,
          isRecognized,
          isPartialMatch: false,
          lemma: t.lemma,
          pos: t.pos,
          wordSlug: t.wordSlug,
          feats: (t.feats ?? {}) as Record<string, string>,
          matchCount: 1,
        } satisfies TokenResult
      }),
    })),
  }

  return NextResponse.json({ segment: segmentResult })
}