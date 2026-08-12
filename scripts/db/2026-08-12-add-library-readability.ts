// library.db does have a _prisma_migrations table (unlike auth.db/interlex.db/
// corpus.db) and a clean migration history under prisma/migrations/library/ -
// but every other schema change in this project has gone through a raw-SQL
// scripts/db/*.ts script regardless of which DB, to keep the workflow uniform
// and avoid `prisma migrate dev`'s drift-detection prompt anywhere near a live
// DB with real data (see CLAUDE.md/AGENTS.md). Following that convention here
// too, rather than making library.db a one-off exception.
//
// Adds a computed readability estimate to LibraryEntry (roadmap P3 item 42):
// per-word Lexeme.cefrLevel aggregated over a text's tokens, see
// lib/library/computeReadability.ts for how these columns get populated.
//
// Usage:
//   LIBRARY_SQLITE_DB=/path/to/library.db npx tsx scripts/db/2026-08-12-add-library-readability.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.LIBRARY_SQLITE_DB || path.resolve(process.cwd(), "library.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const existingColumns = new Set(
    (db.prepare(`SELECT name FROM pragma_table_info('LibraryEntry')`).all() as { name: string }[]).map(r => r.name)
)

const tx = db.transaction(() => {
    if (!existingColumns.has("readabilityScore")) {
        console.log("--- Adding LibraryEntry.readabilityScore ---")
        db.exec(`ALTER TABLE "LibraryEntry" ADD COLUMN "readabilityScore" REAL`)
    }
    if (!existingColumns.has("readabilityLevel")) {
        console.log("--- Adding LibraryEntry.readabilityLevel ---")
        db.exec(`ALTER TABLE "LibraryEntry" ADD COLUMN "readabilityLevel" TEXT`)
    }
    if (!existingColumns.has("readabilityCoverage")) {
        console.log("--- Adding LibraryEntry.readabilityCoverage ---")
        db.exec(`ALTER TABLE "LibraryEntry" ADD COLUMN "readabilityCoverage" REAL`)
    }
})

tx()

const columns = (db.prepare(`SELECT name FROM pragma_table_info('LibraryEntry')`).all() as { name: string }[]).map(r => r.name)
console.log(`\nLibraryEntry now has readabilityScore: ${columns.includes("readabilityScore")}`)
console.log(`LibraryEntry now has readabilityLevel: ${columns.includes("readabilityLevel")}`)
console.log(`LibraryEntry now has readabilityCoverage: ${columns.includes("readabilityCoverage")}`)
console.log("Done.")
db.close()
