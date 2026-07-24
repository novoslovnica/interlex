import path from "path"
import Database from "better-sqlite3"

// Drops the 18 legacy per-language translation tables (en, ru, mk, sr, uk,
// bg, pl, be, cs, sk, sl, hr, cu, de, nl, eo, hsb, dsb), fully superseded by
// the consolidated `translations` table (2026-07-23, see AGENTS.md
// "Translation consolidation").
//
// Guarded — verified before writing this script that nothing in the app
// reads/writes these tables anymore:
//   - Every raw-SQL call site (word-detail page, /api/lexicon, /api/dict,
//     /api/translation-cards/random, /api/profile/words) switched to
//     lib/translations.ts's shared functions.
//   - Every Prisma call site (updateField/service.ts, word-actions.ts,
//     admin/words/[id]/edit, admin/deduplication actions, the app/main/
//     "Word of the Day" widget missed in the first pass) switched to
//     prisma.translation / the `translations` relation on Meaning.
//   - lib/dedup/mergeLexemes.ts rewired onto `translations` via
//     rewireMeaningId(); the 18 old tables were never explicitly touched by
//     it (their rows just cascade-deleted via their own
//     ON DELETE CASCADE meaningId FK whenever a merge deletes a meaning —
//     confirmed empirically on a scratch DB copy before this script was
//     written).
//   - Final repo-wide grep for `<lang>_word`/`<lang>_mean` relation includes,
//     `prisma.<lang>.`/`db.<lang>.` model access, and raw
//     `FROM/UPDATE/INTO "<lang>"` SQL came back empty (generated Prisma
//     client files excluded — those regenerate once the schema models below
//     are removed).
//
// Idempotent — DROP TABLE IF EXISTS, safe to re-run. A full DB backup
// (interlex.db.backup-before-drop-old-translations) was taken immediately
// before this was run.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-24-drop-old-translation-tables.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const OLD_TABLES = [
    "en", "ru", "mk", "sr", "uk", "bg", "pl", "be", "cs", "sk",
    "sl", "hr", "cu", "de", "nl", "eo", "hsb", "dsb",
]

const beforeCounts: Record<string, number> = {}
for (const table of OLD_TABLES) {
    const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table)
    beforeCounts[table] = exists ? (db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }).c : -1
}
console.log("Row counts before drop (-1 = table already absent):")
console.log(beforeCounts)

// Also drop each table's FTS5 shadow table (<lang>_text, content=<lang>) —
// left behind otherwise since SQLite doesn't auto-drop external-content FTS5
// tables when the content table is dropped.
const tx = db.transaction(() => {
    for (const table of OLD_TABLES) {
        db.exec(`DROP TABLE IF EXISTS "${table}_text"`)
        db.exec(`DROP TABLE IF EXISTS "${table}"`)
        console.log(`  ${table} (+ ${table}_text): dropped (or already absent)`)
    }
})

tx()

const remaining = OLD_TABLES.filter((t) =>
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(t)
)
console.log(`\nTables remaining after drop: ${remaining.length === 0 ? "none" : remaining.join(", ")}`)

const translationsCount = (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c
console.log(`Consolidated translations table row count (unaffected by this drop): ${translationsCount}`)

console.log("Done.")
db.close()
