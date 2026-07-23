import path from "path"
import Database from "better-sqlite3"

// One-time, lossless copy of all rows from the 18 per-language translation
// tables into the consolidated `translations` table (see
// 2026-07-23-add-translation-table.ts, which must be run first). Every row
// from every old table becomes exactly one row here, tagged with its
// language — no WHERE, no dedup, no INSERT OR IGNORE. This is a historical
// one-time copy (not a repeated reimport), so nothing may be filtered out.
//
// Old `wordId` is preserved verbatim as `legacyWordId` (archival only, not a
// live FK — see AGENTS.md/the add-table script for why).
//
// NOT idempotent by design (a second run would double every row) — guarded:
// aborts if `translations` already has rows.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-23-copy-translations-data.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

// A small number of hsb/dsb rows in the OLD tables already have a meaningId
// pointing at a Meaning that no longer exists (181 rows each — a pre-existing
// data-quality issue found and flagged separately, unrelated to this
// migration; see the "Investigate orphaned hsb/dsb translation rows" task).
// better-sqlite3 enforces foreign keys by default, which would otherwise
// reject these rows outright. Since data must not be lost, foreign key
// enforcement is disabled for this copy only, so these rows carry over
// verbatim (still dangling) rather than being silently dropped or altered.
db.pragma("foreign_keys = OFF")

const LANGUAGES = [
    "en", "ru", "mk", "sr", "uk", "bg", "pl", "be", "cs", "sk",
    "sl", "hr", "cu", "de", "nl", "eo", "hsb", "dsb",
] as const

const existingCount = (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c
if (existingCount > 0) {
    console.error(`ABORT: translations already has ${existingCount} row(s). This script is not re-runnable (would double every row).`)
    console.error(`If you intend to redo the copy, first run: DELETE FROM translations;`)
    process.exit(1)
}

const oldCounts: Record<string, number> = {}
for (const lang of LANGUAGES) {
    oldCounts[lang] = (db.prepare(`SELECT COUNT(*) c FROM "${lang}"`).get() as { c: number }).c
}
const totalOld = Object.values(oldCounts).reduce((a, b) => a + b, 0)
console.log("Row counts in old tables:")
console.log(oldCounts)
console.log(`Total: ${totalOld}\n`)

const tx = db.transaction(() => {
    for (const lang of LANGUAGES) {
        db.prepare(`
            INSERT INTO translations (language, value, veryfied, message, meaningId, legacyWordId, createdAt, updatedAt)
            SELECT ?, value, veryfied, message, meaningId, wordId, createdAt, updatedAt
            FROM "${lang}"
        `).run(lang)
    }
})
tx()

console.log("Copy transaction committed. Verifying...\n")

let allMatch = true
console.log("lang | old_count | new_count | match")
for (const lang of LANGUAGES) {
    const newCount = (db.prepare(`SELECT COUNT(*) c FROM translations WHERE language = ?`).get(lang) as { c: number }).c
    const match = newCount === oldCounts[lang]
    if (!match) allMatch = false
    console.log(`${lang} | ${oldCounts[lang]} | ${newCount} | ${match ? "OK" : "MISMATCH"}`)
}

const totalNew = (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c
console.log(`\nTotal old: ${totalOld}, total new: ${totalNew}, match: ${totalOld === totalNew ? "OK" : "MISMATCH"}`)
if (totalOld !== totalNew) allMatch = false

// Spot-check: for each language, sample the 5 lowest and 5 highest ids from
// the old table and confirm the exact (value, veryfied, message, meaningId,
// wordId) tuple exists somewhere in `translations` for that language.
console.log("\nSpot-checking sampled rows per language...")
let spotCheckOk = true
for (const lang of LANGUAGES) {
    const sampleRows = db.prepare(`
        SELECT * FROM (SELECT * FROM "${lang}" ORDER BY id ASC LIMIT 5)
        UNION
        SELECT * FROM (SELECT * FROM "${lang}" ORDER BY id DESC LIMIT 5)
    `).all() as { value: string | null; veryfied: number | null; message: string | null; meaningId: number | null; wordId: number | null }[]

    for (const row of sampleRows) {
        const found = db.prepare(`
            SELECT 1 FROM translations
            WHERE language = ?
              AND value IS ? AND veryfied IS ? AND message IS ? AND meaningId IS ? AND legacyWordId IS ?
            LIMIT 1
        `).get(lang, row.value, row.veryfied, row.message, row.meaningId, row.wordId)
        if (!found) {
            spotCheckOk = false
            console.error(`  SPOT-CHECK FAILED for lang=${lang}, meaningId=${row.meaningId}, wordId=${row.wordId}`)
        }
    }
}
console.log(`Spot-check: ${spotCheckOk ? "OK" : "FAILED"}`)

if (!allMatch || !spotCheckOk) {
    console.error("\nVERIFICATION FAILED. Do not proceed with application code migration until this is resolved.")
    db.close()
    process.exit(1)
}

// Informational only — document the expected duplicate-groups shape so a
// future engineer doesn't mistake this for corruption and "fix" it by
// deleting rows.
const dupGroups = db.prepare(`
    SELECT COUNT(*) c, SUM(cnt) rows FROM (
        SELECT COUNT(*) cnt FROM translations GROUP BY language, meaningId HAVING cnt > 1
    )
`).get() as { c: number; rows: number | null }
console.log(`\nDuplicate (language, meaningId) groups: ${dupGroups.c} groups covering ${dupGroups.rows ?? 0} rows (expected — these are legitimate pre-existing duplicates, not an artifact of this copy).`)

const orphanCount = (db.prepare(`
    SELECT COUNT(*) c FROM translations t
    WHERE t.meaningId IS NOT NULL AND NOT EXISTS (SELECT 1 FROM meanings m WHERE m.id = t.meaningId)
`).get() as { c: number }).c
console.log(`Rows with a dangling meaningId (pre-existing, carried over verbatim, not created by this copy): ${orphanCount}`)

console.log("\nAll verification checks passed. Done.")
db.close()
