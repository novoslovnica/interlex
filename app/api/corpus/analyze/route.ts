import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prismaData } from "@/lib/prisma"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
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
    flavor?: string
}

interface SentenceResult {
    position: number
    segmentIndex: number
    rawText: string
    tokens: TokenResult[]
}

interface SegmentResult {
    position: number
    rawText: string
    sentences: SentenceResult[]
}

interface Stats {
    totalTokens: number
    recognizedWords: number
    unrecognizedWords: number
    punctuationCount: number
}

async function buildValidEndings(): Promise<Set<string>> {
    const rows = await prismaData.endingAllophone.findMany({
        select: { value: true },
    })
    const endings = new Set<string>(rows.map(r => r.value))
    endings.add('')
    return endings
}

let analyzer: DbAnalyzer | null = null
async function getAnalyzer(): Promise<DbAnalyzer> {
    if (analyzer) return analyzer
    const validEndings = await buildValidEndings()
    analyzer = new DbAnalyzer(async (bases): Promise<WordBaseRecord[]> => {
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
    return analyzer
}

export async function POST(request: NextRequest) {
    const session = await auth()
    if (!session || !(await checkPermission(session, Feature.CorpusBuilder))) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }

    const { text } = await request.json()
    if (!text || typeof text !== "string") {
        return NextResponse.json({ error: "Text is required" }, { status: 400 })
    }

    const theAnalyzer = await getAnalyzer()
    const rawSegments = Tokenizer.splitIntoSegments(text)
    const segments: SegmentResult[] = []
    const stats: Stats = { totalTokens: 0, recognizedWords: 0, unrecognizedWords: 0, punctuationCount: 0 }

    for (let segIdx = 0; segIdx < rawSegments.length; segIdx++) {
        const rawSentences = Tokenizer.splitSentences(rawSegments[segIdx])
        const sentences: SentenceResult[] = []

        for (let pos = 0; pos < rawSentences.length; pos++) {
            const tokens = await Tokenizer.tokenizeSentence(rawSentences[pos], theAnalyzer)

            const tokenResults: TokenResult[] = tokens.map((t) => {
                const a = t.analysis
                const isRecognized = !t.isPunctuation && a.wordSlug !== null && !a.isPartialMatch
                const isPartialMatch = !t.isPunctuation && a.wordSlug !== null && !!a.isPartialMatch
                return {
                    surfaceForm: t.surfaceForm,
                    isPunctuation: t.isPunctuation,
                    isRecognized,
                    isPartialMatch,
                    lemma: a.lemma,
                    pos: a.pos,
                    wordSlug: a.wordSlug,
                    feats: a.feats as Record<string, string>,
                    matchCount: a.matchCount ?? 0,
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
                segmentIndex: segIdx,
                rawText: rawSentences[pos],
                tokens: tokenResults,
            })
        }

        segments.push({
            position: segIdx,
            rawText: rawSegments[segIdx],
            sentences,
        })
    }

    return NextResponse.json({ segments, stats })
}