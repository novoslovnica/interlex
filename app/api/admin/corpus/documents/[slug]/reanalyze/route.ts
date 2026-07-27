import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, createQueryWordsByBase } from "@/lib/corpus/tokenizer/analyzer-factory"

interface TokenUpdate {
  id: bigint
  data: { lemma: string; pos: string; wordSlug: string | null; matchCount: number; feats: Record<string, string> }
}

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth()
  if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
  }

  const { slug } = await params

  const doc = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
  if (!doc) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 })
  }

  try {
    const validEndings = await buildValidEndings()
    const knownPrepositions = await buildKnownPrepositions()
    const analyzer = new DbAnalyzer(createQueryWordsByBase(), validEndings, knownPrepositions)
    const collocationMatcher = new CollocationMatcher(await buildCollocationRecords())

    const tokens = await prismaCorpus.corpusToken.findMany({
      where: { documentSlug: slug },
      select: { id: true, surfaceForm: true, wordIndex: true, sentenceId: true },
      orderBy: { tokenIndex: "asc" },
    })

    // Группируем по предложению (в порядке tokenIndex), чтобы дать
    // CollocationMatcher видеть последовательность токенов, а не по одному —
    // иначе многословные лексемы никогда не находятся.
    const bySentence = new Map<string, typeof tokens>()
    for (const t of tokens) {
      const arr = bySentence.get(t.sentenceId)
      if (arr) arr.push(t)
      else bySentence.set(t.sentenceId, [t])
    }

    let analyzed = 0
    let failed = 0
    const updates: TokenUpdate[] = []

    for (const sentenceTokens of bySentence.values()) {
      const surfaceForms = sentenceTokens.map((t) => t.surfaceForm)
      let i = 0
      while (i < sentenceTokens.length) {
        const token = sentenceTokens[i]

        if (token.wordIndex === -1) {
          updates.push({ id: token.id, data: { pos: "PUNCT", lemma: token.surfaceForm, wordSlug: null, matchCount: 0, feats: {} } })
          i++
          continue
        }

        const collocationMatch = collocationMatcher.matchAt(surfaceForms, i)
        if (collocationMatch) {
          analyzed += collocationMatch.length
          for (let k = 0; k < collocationMatch.length; k++) {
            updates.push({
              id: sentenceTokens[i + k].id,
              data: {
                lemma: collocationMatch.record.lemma,
                pos: collocationMatch.record.pos,
                wordSlug: collocationMatch.record.wordSlug,
                matchCount: 1,
                feats: {},
              },
            })
          }
          i += collocationMatch.length
          continue
        }

        const analysis = await analyzer.analyzeWord(token.surfaceForm)

        if (!analysis) {
          failed++
          updates.push({ id: token.id, data: { pos: "X", lemma: token.surfaceForm, wordSlug: null, matchCount: 0, feats: {} } })
        } else {
          analyzed++
          updates.push({
            id: token.id,
            data: {
              lemma: analysis.lemma,
              pos: analysis.pos,
              wordSlug: analysis.wordSlug,
              matchCount: analysis.matchCount ?? 0,
              feats: analysis.feats as Record<string, string>,
            },
          })
        }
        i++
      }
    }

    const BATCH_SIZE = 1000
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE)
      await prismaCorpus.$transaction(async (tx) => {
        for (const u of batch) {
          await tx.corpusToken.updateMany({ where: { id: u.id, documentSlug: slug }, data: u.data })
        }
      })
    }

    await prismaCorpus.corpusDocument.update({
      where: { slug },
      data: {},
    })

    return NextResponse.json({
      ok: true,
      analyzed,
      failed,
      total: tokens.length,
    })
  } catch (error) {
    console.error("Reanalysis failed:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    )
  }
}