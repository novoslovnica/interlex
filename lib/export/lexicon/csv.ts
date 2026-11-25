import type Database from "better-sqlite3"
import { publicLexiconRows } from "./publicRows"

const header = [
    "slug", "search_key", "core", "pos", "meaning_number", "meaning", "translation_language", "translation", "translation_verified",
]

function cell(value: string | number | null): string {
    let text = String(value ?? "")
    // Quoting controls CSV syntax. A leading apostrophe keeps spreadsheet
    // applications from interpreting dictionary text as a formula.
    if (/^(?:\s*[=+@\-＝＋＠－]|[\t\r\n])/.test(text)) text = "'" + text
    return `"${text.replaceAll('"', '""')}"`
}

export function* lexiconCsvRows(db: Database.Database): Generator<string> {
    const rows = publicLexiconRows(db)

    yield "\uFEFF" + header.join(",") + "\r\n"
    let previousSlug: string | undefined
    let previousMeaningId: number | null = null
    let meaningNumber = 0
    for (const row of rows) {
        if (row.slug !== previousSlug) {
            meaningNumber = 0
            previousMeaningId = null
            previousSlug = row.slug
        }
        if (row.meaningId !== previousMeaningId) {
            meaningNumber++
            previousMeaningId = row.meaningId
        }
        yield [
            row.slug, row.searchKey, row.core?.trim() || null, row.pos,
            row.meaningId === null ? null : meaningNumber, row.meaning, row.language, row.translation,
            row.translation === null ? null : Number(row.verified === 1),
        ].map(cell).join(",") + "\r\n"
    }
}

export function streamLexiconCsv(db: Database.Database): ReadableStream<Uint8Array> {
    const rows = lexiconCsvRows(db)
    const encoder = new TextEncoder()
    return new ReadableStream({
        pull(controller) {
            const chunk: string[] = []
            try {
                for (let i = 0; i < 512; i++) {
                    const next = rows.next()
                    if (next.done) {
                        if (chunk.length) controller.enqueue(encoder.encode(chunk.join("")))
                        db.close()
                        controller.close()
                        return
                    }
                    chunk.push(next.value)
                }
                controller.enqueue(encoder.encode(chunk.join("")))
            } catch (error) {
                rows.return(undefined)
                db.close()
                controller.error(error)
            }
        },
        cancel() {
            rows.return(undefined)
            db.close()
        },
    })
}
