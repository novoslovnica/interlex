// interlex.db lacks a _prisma_migrations tracking table (см. CLAUDE.md) —
// применяем как raw SQL, а не через `prisma migrate dev`.
import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.DATA_SQLITE_DB || path.resolve(process.cwd(), "interlex.db")

console.log(`Applying verified column to lexeme_allophones in ${DB_PATH}...`)
const db = new Database(DB_PATH)

const columns = db.prepare(`PRAGMA table_info("lexeme_allophones")`).all() as { name: string }[]
const existing = new Set(columns.map((c) => c.name))

if (!existing.has("verified")) {
    db.exec(`ALTER TABLE "lexeme_allophones" ADD COLUMN "verified" INTEGER;`)
    console.log('✓ Added column "verified"')
} else {
    console.log('- Column "verified" already exists, skipping')
}

db.close()
console.log("Done.")
