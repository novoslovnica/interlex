// corpus.db lacks a _prisma_migrations tracking table (confirmed via
// `prisma migrate status`), so `prisma migrate dev` risks treating it as
// unmanaged and prompting a reset — same class of issue as the interlex.db
// drift documented in CLAUDE.md. Applying this schema-only index change as
// raw SQL instead, following the pattern in
// scripts/db/2026-07-22-add-indexes-and-fts5-trigram.ts.
import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")

console.log(`Applying index to ${DB_PATH}...`)
const db = new Database(DB_PATH)

db.exec(`CREATE INDEX IF NOT EXISTS "CorpusToken_documentSlug_wordIndex_idx" ON "CorpusToken" ("documentSlug", "wordIndex");`)

console.log("✓ Index applied successfully.")
db.close()
