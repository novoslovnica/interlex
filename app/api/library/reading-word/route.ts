import { NextResponse } from "next/server"
import { getAnalyzerIfReady } from "@/lib/bots/core/analyzer"
import { lookupInDb } from "@/lib/bots/core/lookup"
import { init } from "@/lib/sqlite"
import { READING_WORD_PATTERN, type ReadingResult } from "@/lib/library/readingWord"

export const runtime = "nodejs"

export async function GET(request: Request) {
    const params = new URL(request.url).searchParams
    const word = params.get("word")?.normalize("NFC") ?? ""
    const language = params.get("lang")
    if (!READING_WORD_PATTERN.test(word) || !language || !["ru", "en", "isv"].includes(language)) {
        return NextResponse.json({ error: "Invalid lookup" }, { status: 400 })
    }

    const analyzer = getAnalyzerIfReady()
    const db = await init()
    try {
        const result = await lookupInDb(db, word, language === "isv" ? [] : [language], analyzer, true)
        const core = db.prepare<[number], { value: string }>(`
            SELECT a.value FROM lexeme_allophones a
            JOIN allophone_flavors f ON f.id = a.flavorId
            WHERE a.lexemeId = ? AND a.type = 'standard' AND f.code = 'CORE'
        `)
        const response: ReadingResult = {
            entries: result.entries.map(entry => ({
                id: entry.id,
                word: core.get(entry.id)?.value.trim() || entry.value,
                pos: entry.pos,
                translations: entry.translations[0]?.values ?? [],
                meanings: entry.meanings,
            })),
            readings: result.entries.length === 1 ? result.formReadings ?? [] : [],
            warmingUp: analyzer === null,
        }
        return NextResponse.json(response, { headers: { "Cache-Control": "no-store" } })
    } finally {
        db.close()
    }
}
