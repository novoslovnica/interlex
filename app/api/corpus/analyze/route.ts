import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { checkPermission } from "@/lib/permissions"
import { Feature } from "@/config/features"
import { DbAnalyzer } from "@/lib/corpus/tokenizer/dbAnalyzer"
import { Tokenizer } from "@/lib/corpus/tokenizer/tokenizer"
import { CollocationMatcher } from "@/lib/corpus/tokenizer/collocationMatcher"
import { buildValidEndings, buildKnownPrepositions, buildCollocationRecords, createQueryWordsByBase } from "@/lib/corpus/tokenizer/analyzer-factory"

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

let analyzer: DbAnalyzer | null = null
async function getAnalyzer(): Promise<DbAnalyzer> {
    if (analyzer) return analyzer
    const validEndings = await buildValidEndings()
    const knownPrepositions = await buildKnownPrepositions()
    analyzer = new DbAnalyzer(createQueryWordsByBase(), validEndings, knownPrepositions)
    return analyzer
}

let collocationMatcher: CollocationMatcher | null = null
async function getCollocationMatcher(): Promise<CollocationMatcher> {
    if (collocationMatcher) return collocationMatcher
    collocationMatcher = new CollocationMatcher(await buildCollocationRecords())
    return collocationMatcher
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
    const theCollocationMatcher = await getCollocationMatcher()
    const rawSegments = Tokenizer.splitIntoSegments(text)
    const segments: SegmentResult[] = []
    const stats: Stats = { totalTokens: 0, recognizedWords: 0, unrecognizedWords: 0, punctuationCount: 0 }

    for (let segIdx = 0; segIdx < rawSegments.length; segIdx++) {
        const rawSentences = Tokenizer.splitSentences(rawSegments[segIdx])
        const sentences: SentenceResult[] = []

        for (let pos = 0; pos < rawSentences.length; pos++) {
            const tokens = await Tokenizer.tokenizeSentence(rawSentences[pos], theAnalyzer, theCollocationMatcher)

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