import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { randomUUID } from "crypto"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { CorpusTokenInput } from "@/lib/corpus/tokenizer/types"
import { computeLexiconFrequencies } from "@/lib/corpus/frequencies/compute-frequencies"
import { computeCefrLevels } from "@/lib/corpus/frequencies/compute-cefr-levels"
import { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, createQueryWordsByBase } from "@/lib/corpus/tokenizer/analyzer-factory"

const analyzerPromise = Promise.all([buildValidEndings(), buildKnownPrepositions()]).then(
    ([validEndings, knownPrepositions]) => new DbAnalyzer(createQueryWordsByBase(), validEndings, knownPrepositions)
)
const collocationMatcherPromise = buildCollocationRecords().then((records) => new CollocationMatcher(records))

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 403 })
    }

    const { title, slug, rawText, author } = await request.json()
    if (!title || !slug || !rawText) {
        return NextResponse.json({ error: "title, slug, and rawText are required" }, { status: 400 })
    }

    const existing = await prismaCorpus.corpusDocument.findUnique({ where: { slug } })
    if (existing) {
        return NextResponse.json({ error: "Document with this slug already exists" }, { status: 409 })
    }

    const analyzer = await analyzerPromise
    const collocationMatcher = await collocationMatcherPromise
    const { segments, sentences, tokenInputs } = await Tokenizer.tokenizeDocument(slug, rawText, randomUUID, analyzer, collocationMatcher)

    const maxIdResult = await prismaCorpus.corpusToken.findFirst({ orderBy: { id: "desc" }, select: { id: true } })
    let nextTokenId = maxIdResult ? Number(maxIdResult.id) + 1 : 1

    try {
        await prismaCorpus.$transaction(async (tx) => {
            await tx.corpusDocument.create({
                data: { title, slug, rawText, author, language: "is" },
            })

            await tx.corpusSegment.createMany({
                data: segments.map((s) => ({
                    id: s.id,
                    documentSlug: slug,
                    position: s.position,
                    rawText: s.rawText,
                })),
            })

            await tx.corpusSentence.createMany({
                data: sentences.map((s) => ({
                    id: s.id,
                    documentSlug: slug,
                    segmentId: s.segmentId,
                    position: s.position,
                    rawText: s.rawText,
                })),
            })

            const chunkSize = 5000
            for (let i = 0; i < tokenInputs.length; i += chunkSize) {
                const chunk = tokenInputs.slice(i, i + chunkSize)
                await tx.corpusToken.createMany({
                    data: chunk.map((t: CorpusTokenInput) => ({
                        id: BigInt(nextTokenId++),
                        documentSlug: slug,
                        sentenceId: t.sentenceId,
                        tokenIndex: t.tokenIndex,
                        wordIndex: t.wordIndex,
                        surfaceForm: t.surfaceForm,
                        lemma: t.lemma,
                        pos: t.pos,
                        wordSlug: t.wordSlug,
                        matchCount: t.matchCount,
                        feats: t.feats as Record<string, string>,
                    })),
                })
            }
        })

        triggerRecomputation()

        return NextResponse.json({ success: true, tokensProcessed: tokenInputs.length })
    } catch (error) {
        console.error("Failed to save corpus document:", error)
        return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }
}

async function triggerRecomputation(): Promise<void> {
    try {
        await computeLexiconFrequencies()
        await computeCefrLevels()
    } catch (e) {
        console.error("Background recomputation after save failed:", e)
    }
}