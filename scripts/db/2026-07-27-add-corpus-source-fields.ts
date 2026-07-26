// corpus.db lacks a _prisma_migrations tracking table, so `prisma migrate dev`
// risks treating it as unmanaged and prompting a reset — same class of issue
// as documented in CLAUDE.md. Applying this schema-only column addition as
// raw SQL instead, following the pattern in
// scripts/db/2026-07-24-add-corpus-token-wordindex-index.ts.
import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")

console.log(`Applying source-tracking columns to ${DB_PATH}...`)
const db = new Database(DB_PATH)

const columns = db.prepare(`PRAGMA table_info("CorpusDocument")`).all() as { name: string }[]
const existing = new Set(columns.map((c) => c.name))

if (!existing.has("sourceUrl")) {
    db.exec(`ALTER TABLE "CorpusDocument" ADD COLUMN "sourceUrl" TEXT;`)
    console.log('✓ Added column "sourceUrl"')
} else {
    console.log('- Column "sourceUrl" already exists, skipping')
}

if (!existing.has("externalId")) {
    db.exec(`ALTER TABLE "CorpusDocument" ADD COLUMN "externalId" TEXT;`)
    console.log('✓ Added column "externalId"')
} else {
    console.log('- Column "externalId" already exists, skipping')
}

if (!existing.has("sourceRevisionId")) {
    db.exec(`ALTER TABLE "CorpusDocument" ADD COLUMN "sourceRevisionId" INTEGER;`)
    console.log('✓ Added column "sourceRevisionId"')
} else {
    console.log('- Column "sourceRevisionId" already exists, skipping')
}

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CorpusDocument_externalId_key" ON "CorpusDocument" ("externalId");`)
console.log("✓ Unique index on externalId ensured")

db.close()
console.log("Done.")
