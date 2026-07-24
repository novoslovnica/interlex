import path from "path"
import Database from "better-sqlite3"

// Renames the "veryfied" typo to "verified" in two places:
//   - translations.veryfied -> translations.verified (+ its two composite
//     indexes, dropped and recreated under matching new names)
//   - meanings.meaningVeryfied -> meanings.meaningVerified
//   - meanings.examplesVeryfied -> meanings.examplesVerified
//
// Matches prisma/data.schema.prisma's Translation/Meaning models after this
// script has run — the app (updateField/service.ts, word-actions.ts,
// lib/translations.ts, ArticleForm.tsx, etc.) expects these new names.
//
// Idempotent — checks each column's current name via PRAGMA table_info
// before renaming, safe to re-run (no-ops on columns already renamed).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-24-rename-verified-columns.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

function hasColumn(table: string, column: string): boolean {
    const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
    return cols.some((c) => c.name === column)
}

const beforeCounts = {
    translations: (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c,
    meanings: (db.prepare(`SELECT COUNT(*) c FROM meanings`).get() as { c: number }).c,
}
console.log("Row counts before (must match after — this is a pure rename):", beforeCounts)

const tx = db.transaction(() => {
    if (hasColumn("translations", "veryfied")) {
        db.exec(`ALTER TABLE translations RENAME COLUMN veryfied TO verified`)
        console.log("  translations.veryfied -> verified: renamed")
    } else {
        console.log("  translations.veryfied: already renamed (or absent), skipped")
    }

    db.exec(`DROP INDEX IF EXISTS translations_meaningId_veryfied_idx`)
    db.exec(`DROP INDEX IF EXISTS translations_language_veryfied_idx`)
    db.exec(`CREATE INDEX IF NOT EXISTS translations_meaningId_verified_idx ON translations(meaningId, verified)`)
    db.exec(`CREATE INDEX IF NOT EXISTS translations_language_verified_idx ON translations(language, verified)`)
    console.log("  translations indexes: renamed/ensured (meaningId+verified, language+verified)")

    if (hasColumn("meanings", "meaningVeryfied")) {
        db.exec(`ALTER TABLE meanings RENAME COLUMN meaningVeryfied TO meaningVerified`)
        console.log("  meanings.meaningVeryfied -> meaningVerified: renamed")
    } else {
        console.log("  meanings.meaningVeryfied: already renamed (or absent), skipped")
    }

    if (hasColumn("meanings", "examplesVeryfied")) {
        db.exec(`ALTER TABLE meanings RENAME COLUMN examplesVeryfied TO examplesVerified`)
        console.log("  meanings.examplesVeryfied -> examplesVerified: renamed")
    } else {
        console.log("  meanings.examplesVeryfied: already renamed (or absent), skipped")
    }
})

tx()

const afterCounts = {
    translations: (db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c,
    meanings: (db.prepare(`SELECT COUNT(*) c FROM meanings`).get() as { c: number }).c,
}
console.log("\nRow counts after:", afterCounts)
if (afterCounts.translations !== beforeCounts.translations || afterCounts.meanings !== beforeCounts.meanings) {
    console.error("MISMATCH — row counts changed during a pure rename. Investigate before trusting this DB.")
    db.close()
    process.exit(1)
}

console.log("\nSchema after rename:")
console.log(db.prepare(`PRAGMA table_info("translations")`).all())
console.log(db.prepare(`PRAGMA table_info("meanings")`).all())

console.log("\nDone.")
db.close()
