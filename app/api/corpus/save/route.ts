import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaCorpus, prismaData } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { randomUUID } from "crypto"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"
import { DbAnalyzer, WordBaseRecord } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { CorpusTokenInput } from "@/lib/corpus/tokenizer/types"

const analyzer = new DbAnalyzer(async (bases): Promise<WordBaseRecord[]> => {
    const homonyms = await prismaData.baseHomonym.findMany({
        where: { base: { in: bases } },
    })
    const ids = [...new Set(homonyms.flatMap(h => {
        const parsed = JSON.parse(h.wordIds)
        return Array.isArray(parsed) && typeof parsed[0] === 'number'
            ? parsed as number[]
            : (parsed as Array<{ id: number }>).map(item => item.id)
    }))]
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
    }))
})

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

    const { sentences, tokenInputs } = await Tokenizer.tokenizeDocument(slug, rawText, randomUUID, analyzer)

    try {
        await prismaCorpus.$transaction(async (tx) => {
            await tx.corpusDocument.create({
                data: { title, slug, rawText, author, language: "is" },
            })

            await tx.corpusSentence.createMany({
                data: sentences.map((s) => ({
                    id: s.id,
                    documentSlug: slug,
                    position: s.position,
                    rawText: s.rawText,
                })),
            })

            const chunkSize = 5000
            for (let i = 0; i < tokenInputs.length; i += chunkSize) {
                await tx.corpusToken.createMany({
                    data: tokenInputs.slice(i, i + chunkSize).map((t: CorpusTokenInput) => ({
                        documentSlug: slug,
                        sentenceId: t.sentenceId,
                        tokenIndex: t.tokenIndex,
                        wordIndex: t.wordIndex,
                        surfaceForm: t.surfaceForm,
                        lemma: t.lemma,
                        pos: t.pos,
                        wordSlug: t.wordSlug,
                        feats: t.feats as Record<string, string>,
                    })),
                })
            }
        })

        return NextResponse.json({ success: true, tokensProcessed: tokenInputs.length })
    } catch (error) {
        console.error("Failed to save corpus document:", error)
        return NextResponse.json({ error: "Failed to save document" }, { status: 500 })
    }
}