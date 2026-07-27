// interlex.db lacks a _prisma_migrations tracking table (same class of issue
// as corpus.db, see CLAUDE.md / scripts/db/2026-07-27-add-corpus-source-fields.ts)
// — applying this schema-only column addition as raw SQL instead of
// `prisma migrate dev`.
import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.DATA_SQLITE_DB || path.resolve(process.cwd(), "interlex.db")

console.log(`Applying isCollocation column to ${DB_PATH}...`)
const db = new Database(DB_PATH)

const columns = db.prepare(`PRAGMA table_info("lexemes")`).all() as { name: string }[]
const existing = new Set(columns.map((c) => c.name))

if (!existing.has("isCollocation")) {
    db.exec(`ALTER TABLE "lexemes" ADD COLUMN "isCollocation" INTEGER NOT NULL DEFAULT 0;`)
    console.log('✓ Added column "isCollocation"')
} else {
    console.log('- Column "isCollocation" already exists, skipping')
}

db.close()
console.log("Done.")
