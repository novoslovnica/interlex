import { unstable_cache } from "next/cache"
import { NextResponse } from "next/server"
import { prismaLibrary, prismaData } from "@/lib/prisma"
import { decompressBody } from "@/lib/body"
import { getAnalyzerIfReady, waitForAnalyzer } from "@/lib/bots/core/analyzer"
import { TOKEN_PATTERN, NON_TEXT_SPANS } from "@/lib/corpus/tokenizer/patterns"
import { READING_WORD_PATTERN } from "@/lib/library/readingWord"
import { knownReadingLevel, readingWordKey, supportsReadingHighlights, type ReadingWordLevels } from "@/lib/library/readingLevels"
import { cyrillicToLatin, isCyrillicText } from "@/lib/orthography/standard"

const getWordLevels = unstable_cache(async (content: string): Promise<ReadingWordLevels> => {
    const analyzer = await waitForAnalyzer()
    const surfaces = new Set(
        (content.replace(NON_TEXT_SPANS, " ").match(TOKEN_PATTERN) ?? [])
            .map(readingWordKey)
            .filter(surface => READING_WORD_PATTERN.test(surface)),
    )
    const resolved = new Map<string, string>()
    for (const surface of surfaces) {
        const query = isCyrillicText(surface) ? cyrillicToLatin(surface) : surface
        const analysis = await analyzer.analyzeWord(query, { exactOnly: true })
        if (!analysis?.wordSlug || analysis.isPartialMatch) continue
        if (analysis.candidates?.some(candidate => candidate.wordSlug !== analysis.wordSlug)) continue
        resolved.set(surface, analysis.wordSlug)
    }
    if (!resolved.size) return {}

    const words = await prismaData.lexeme.findMany({
        where: { slug: { in: [...new Set(resolved.values())] }, isPublic: true },
        select: { slug: true, cefrLevel: true },
    })
    const bySlug = new Map(words.map(word => [word.slug, knownReadingLevel(word.cefrLevel)]))
    const levels: ReadingWordLevels = Object.create(null)
    for (const [surface, slug] of resolved) {
        const level = bySlug.get(slug)
        if (level) levels[surface] = level
    }
    return levels
}, ["reader-word-levels-v1"], { revalidate: 300 })

export async function GET(request: Request) {
    const slug = new URL(request.url).searchParams.get("slug")
    if (!slug || slug.length > 180) return NextResponse.json({ error: "Invalid slug" }, { status: 400 })

    const entry = await prismaLibrary.libraryEntry.findFirst({
        where: { slug, isPublic: true, readabilityLevel: { in: ["A1", "A2"] } },
        select: { body: true, readabilityLevel: true },
    })
    const content = entry?.body ? decompressBody(entry.body) : ""
    if (!entry || !supportsReadingHighlights(entry.readabilityLevel, content)) {
        return NextResponse.json({ error: "Highlighting unavailable" }, { status: 404 })
    }
    if (!getAnalyzerIfReady()) {
        return NextResponse.json({ warmingUp: true }, { status: 202, headers: { "Retry-After": "3", "Cache-Control": "no-store" } })
    }

    return NextResponse.json({ levels: await getWordLevels(content) }, { headers: { "Cache-Control": "no-store" } })
}
