import path from "path"
import Database from "better-sqlite3"

// Creates the consolidated `translations` table that replaces the 18
// per-language tables (en, ru, mk, sr, uk, bg, pl, be, cs, sk, sl, hr, cu, de,
// nl, eo, hsb, dsb) for new data — see AGENTS.md "Translation consolidation".
// Deliberately does NOT touch the 18 old tables (dropped separately, later,
// only after every call site is confirmed migrated — see the drop script).
//
// No `@@unique` constraint: verified live data has ~46,952 rows across
// ~22,875 legitimate (meaningId, language) duplicate groups (e.g. `en` alone:
// 19,053 duplicate-meaningId groups / 38,971 rows) — a unique constraint
// would reject real rows on data copy.
//
// `legacyWordId` is archival only (no FK, no index) — the old per-language
// tables' `wordId` column was supposed to point at Meaning but in practice
// held the owning Lexeme's id, and was already wrong for 93% of hsb/dsb rows
// (and hundreds of en/ru/mk/sr/bg rows) on the live DB. "All translations for
// lexeme X" is derived via meaningId -> Meaning.lexemeId instead.
//
// Idempotent — CREATE TABLE/INDEX IF NOT EXISTS, safe to re-run.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-23-add-translation-table.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "translations" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL,
            "language" TEXT NOT NULL,
            "value" TEXT,
            "veryfied" INTEGER,
            "message" TEXT,
            "meaningId" INTEGER,
            "legacyWordId" INTEGER,
            CONSTRAINT "translations_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "translations_meaningId_idx" ON "translations"("meaningId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "translations_meaningId_veryfied_idx" ON "translations"("meaningId", "veryfied")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "translations_language_meaningId_idx" ON "translations"("language", "meaningId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "translations_language_veryfied_idx" ON "translations"("language", "veryfied")`)
})

tx()

const count = (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c
console.log(`translations table ready. Row count: ${count}`)
console.log("Done.")
db.close()
