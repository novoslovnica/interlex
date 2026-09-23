// Builds the queue for /admin/proper-nouns: every public lexeme with
// properNoun unset and at least one capitalized translation (outside the
// languages where a capital says nothing - de/nl/cu/eo), plus two signals
// that pre-tick the "proper noun" box on the review page:
//   refCapitalized  - ALL proofread reference languages (pl cs sk hr sl uk be)
//                     with a translation for the lexeme write it capitalized,
//                     and there are at least 2 of them;
//   corpusMidCap /   - how often the word is capitalized in the ISV corpus
//   corpusMidTotal     when it is NOT the first token of its sentence
//                     (up to 400 tokens sampled per lexeme).
// Neither signal decides anything - a person does, on the page. Rows are
// deleted by the page as decisions are made; re-running this script
// refreshes the rest. Creates the table itself (idempotent). Read-only on
// corpus.db; do not run while a corpus reanalysis is writing (AGENTS.md).
//
// Usage:
//   npx tsx scripts/db/compute-proper-noun-signals.ts

import Database from "better-sqlite3"
import path from "path"
import { isUpperLetter, firstLetter, CAPITALIZATION_SKIPPED_LANGUAGES } from "../../lib/capitalization"

const DATA_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const CORPUS_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
const REFERENCE_LANGUAGES = ["pl", "cs", "sk", "hr", "sl", "uk", "be"]
const CORPUS_SAMPLE = 400

const data = new Database(DATA_PATH)
const corpus = new Database(CORPUS_PATH, { readonly: true })

data.exec(`
    CREATE TABLE IF NOT EXISTS "proper_noun_signals" (
        "lexemeId" INTEGER PRIMARY KEY,
        "refCapitalized" INTEGER NOT NULL DEFAULT 0,
        "corpusMidCap" INTEGER NOT NULL DEFAULT 0,
        "corpusMidTotal" INTEGER NOT NULL DEFAULT 0,
        "computedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        CONSTRAINT "proper_noun_signals_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE
    )
`)

const lexemes = data.prepare(`SELECT id, slug FROM lexemes WHERE COALESCE(properNoun, 0) = 0 AND isPublic = 1`).all() as { id: number; slug: string }[]
const translations = data.prepare(`
    SELECT m.lexemeId AS lexemeId, t.language AS language, t.value AS value
    FROM translations t JOIN meanings m ON m.id = t.meaningId
    WHERE t.value IS NOT NULL AND TRIM(t.value) != ''
`).all() as { lexemeId: number; language: string; value: string }[]
const byLexeme = new Map<number, { language: string; value: string }[]>()
for (const row of translations) {
    const list = byLexeme.get(row.lexemeId)
    if (list) list.push(row)
    else byLexeme.set(row.lexemeId, [row])
}

const tokensOf = corpus.prepare(`
    SELECT t.surfaceForm AS surfaceForm, t.tokenIndex AS tokenIndex,
           (SELECT MIN(f.tokenIndex) FROM CorpusToken f WHERE f.sentenceId = t.sentenceId AND f.wordIndex != -1) AS firstIndex
    FROM CorpusToken t WHERE t.wordSlug = ? LIMIT ${CORPUS_SAMPLE}
`)
const upsert = data.prepare(`
    INSERT INTO proper_noun_signals (lexemeId, refCapitalized, corpusMidCap, corpusMidTotal, computedAt)
    VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    ON CONFLICT (lexemeId) DO UPDATE SET refCapitalized = excluded.refCapitalized, corpusMidCap = excluded.corpusMidCap,
        corpusMidTotal = excluded.corpusMidTotal, computedAt = CURRENT_TIMESTAMP
`)

let queued = 0
const keep = new Set<number>()
const write = data.transaction(() => {
    for (const lexeme of lexemes) {
        const list = byLexeme.get(lexeme.id) ?? []
        if (!list.some((t) => !CAPITALIZATION_SKIPPED_LANGUAGES.has(t.language) && isUpperLetter(firstLetter(t.value)))) continue

        const perReference = new Map<string, boolean>()
        for (const t of list) {
            if (!REFERENCE_LANGUAGES.includes(t.language)) continue
            perReference.set(t.language, (perReference.get(t.language) ?? true) && isUpperLetter(firstLetter(t.value)))
        }
        const refCapitalized = perReference.size >= 2 && [...perReference.values()].every(Boolean) ? 1 : 0

        const tokens = tokensOf.all(lexeme.slug) as { surfaceForm: string; tokenIndex: number; firstIndex: number }[]
        const mid = tokens.filter((t) => t.tokenIndex !== t.firstIndex)
        const midCap = mid.filter((t) => isUpperLetter(t.surfaceForm[0])).length

        upsert.run(lexeme.id, refCapitalized, midCap, mid.length)
        keep.add(lexeme.id)
        queued++
    }
    // Лексемы, у которых заглавных переводов больше нет, из очереди уходят.
    const stale = (data.prepare(`SELECT lexemeId FROM proper_noun_signals`).all() as { lexemeId: number }[]).filter((row) => !keep.has(row.lexemeId))
    const remove = data.prepare(`DELETE FROM proper_noun_signals WHERE lexemeId = ?`)
    for (const row of stale) remove.run(row.lexemeId)
    console.log(`removed stale: ${stale.length}`)
})
write()

const suggested = (data.prepare(`SELECT COUNT(*) c FROM proper_noun_signals WHERE refCapitalized = 1 OR (corpusMidTotal >= 3 AND corpusMidCap * 1.0 / corpusMidTotal >= 0.8)`).get() as { c: number }).c
console.log(`queued: ${queued}, suggested as proper: ${suggested}`)
data.close()
corpus.close()
