import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { generateTeiXml, type TeiDocument, type TeiSegment, type TeiSentence, type TeiToken } from "@/lib/tei"

export const maxDuration = 60

const BATCH_SIZE = 50

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug } = await params

  const document = await prismaCorpus.corpusDocument.findUnique({
    where: { slug },
    select: { title: true, author: true },
  })

  if (!document) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  const segments = await prismaCorpus.corpusSegment.findMany({
    where: { documentSlug: slug },
    orderBy: { position: "asc" },
    select: { id: true, position: true },
  })

  const teiSegments: TeiSegment[] = []

  for (const seg of segments) {
    const teiSentences: TeiSentence[] = []
    let skip = 0
    let hasMore = true

    while (hasMore) {
      const sentences = await prismaCorpus.corpusSentence.findMany({
        where: { documentSlug: slug, segmentId: seg.id },
        orderBy: { position: "asc" },
        skip,
        take: BATCH_SIZE,
        select: {
          position: true,
          tokens: {
            orderBy: { tokenIndex: "asc" },
            select: {
              surfaceForm: true,
              lemma: true,
              pos: true,
              wordIndex: true,
              matchCount: true,
              wordSlug: true,
              feats: true,
            },
          },
        },
      })

      for (const sent of sentences) {
        teiSentences.push({
          position: sent.position,
          tokens: sent.tokens.map((t) => ({
            surfaceForm: t.surfaceForm,
            lemma: t.lemma,
            pos: t.pos,
            wordIndex: t.wordIndex,
            matchCount: t.matchCount,
            wordSlug: t.wordSlug,
            feats: (t.feats ?? {}) as Record<string, string>,
          })),
        })
      }

      hasMore = sentences.length === BATCH_SIZE
      skip += BATCH_SIZE
    }

    teiSegments.push({ position: seg.position, sentences: teiSentences })
  }

  const teiDoc: TeiDocument = {
    title: document.title,
    author: document.author,
    segments: teiSegments,
  }

  const xml = generateTeiXml(teiDoc)

  return new NextResponse(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Content-Disposition": `attachment; filename="${slug}.tei.xml"`,
    },
  })
}