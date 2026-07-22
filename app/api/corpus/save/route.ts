import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus, prismaData } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { randomUUID } from "crypto"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"
import { DbAnalyzer, WordBaseRecord } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CorpusTokenInput } from "@/lib/corpus/tokenizer/types"
import { computeLexiconFrequencies } from "@/lib/corpus/frequencies/compute-frequencies"
import { computeCefrLevels } from "@/lib/corpus/frequencies/compute-cefr-levels"

async function buildValidEndings(): Promise<Set<string>> {
    const rows = await prismaData.endingAllophone.findMany({
        select: { value: true },
    })
    const endings = new Set<string>(rows.map(r => r.value))
    endings.add('')
    return endings
}

const analyzerPromise = buildValidEndings().then((validEndings) =>
    new DbAnalyzer(async (bases): Promise<WordBaseRecord[]> => {
        const homonyms = await prismaData.baseHomonym.findMany({
            where: { base: { in: bases } },
        })

        const lexemeFlavors = new Map<number, string>()
        for (const h of homonyms) {
            const parsed = JSON.parse(h.wordIds)
            if (Array.isArray(parsed)) {
                if (parsed.length > 0 && typeof parsed[0] === 'number') {
                    for (const id of parsed as number[]) {
                        lexemeFlavors.set(id, 'CORE')
                    }
                } else {
                    for (const item of parsed as Array<{ id: number; flavor?: string }>) {
                        lexemeFlavors.set(item.id, item.flavor || 'CORE')
                    }
                }
            }
        }

        const ids = [...lexemeFlavors.keys()]
        if (ids.length === 0) return []

        const rows = await prismaData.lexeme.findMany({
            where: { id: { in: ids } },
            select: {
                id: true,
                slug: true,
                value: true,
                pos: true,
                protoStemClass: true,
                stemExtension: true,
                paradigm: true,
                stem: true,
                gender: true,
            },
        })
        return rows.map((r) => ({
            id: r.id,
            slug: r.slug,
            isv: r.value,
            pos: r.pos,
            protoStemClass: r.protoStemClass,
            stemExtension: r.stemExtension,
            paradigm: r.paradigm,
            stem: r.stem,
            gender: r.gender,
            base: null,
            alternationType: null,
            fleetingVowelAt: null,
            flavor: lexemeFlavors.get(r.id) ?? 'CORE',
        }))
    }, validEndings)
)

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
    const { segments, sentences, tokenInputs } = await Tokenizer.tokenizeDocument(slug, rawText, randomUUID, analyzer)

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