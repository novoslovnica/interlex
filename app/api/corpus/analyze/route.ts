import { NextRequest, NextResponse } from "next/server"
import { prismaData } from "@/lib/prisma"
import { DbAnalyzer, WordBaseRecord } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"

interface TokenResult {
    surfaceForm: string
    isPunctuation: boolean
    isRecognized: boolean
    isPartialMatch: boolean
    lemma: string
    pos: string
    wordSlug: string | null
    feats: Record<string, string>
    matchCount: number
}

interface SentenceResult {
    position: number
    rawText: string
    tokens: TokenResult[]
}

interface Stats {
    totalTokens: number
    recognizedWords: number
    unrecognizedWords: number
    punctuationCount: number
}

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
    const { text } = await request.json()
    if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const rawSentences = Tokenizer.splitSentences(text)
    const sentences: SentenceResult[] = []
    const stats: Stats = { totalTokens: 0, recognizedWords: 0, unrecognizedWords: 0, punctuationCount: 0 }

    for (let pos = 0; pos < rawSentences.length; pos++) {
        const tokens = await Tokenizer.tokenizeSentence(rawSentences[pos], analyzer)

        const tokenResults: TokenResult[] = tokens.map((t) => {
            const isRecognized = !t.isPunctuation && t.analysis.wordSlug !== null && !t.analysis.isPartialMatch
            const isPartialMatch = !t.isPunctuation && t.analysis.wordSlug !== null && !!t.analysis.isPartialMatch
            return {
                surfaceForm: t.surfaceForm,
                isPunctuation: t.isPunctuation,
                isRecognized,
                isPartialMatch,
                lemma: t.analysis.lemma,
                pos: t.analysis.pos,
                wordSlug: t.analysis.wordSlug,
                feats: t.analysis.feats as Record<string, string>,
                matchCount: t.analysis.matchCount ?? 0,
            }
        })

        stats.totalTokens += tokenResults.length
        for (const t of tokenResults) {
            if (t.isPunctuation) stats.punctuationCount++
            else if (t.isRecognized) stats.recognizedWords++
            else stats.unrecognizedWords++
        }

        sentences.push({
            position: pos,
            rawText: rawSentences[pos],
            tokens: tokenResults,
        })
    }

    return NextResponse.json({ sentences, stats })
}