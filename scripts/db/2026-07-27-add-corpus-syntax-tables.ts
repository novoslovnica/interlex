// corpus.db lacks a _prisma_migrations tracking table, so `prisma migrate dev`
// risks treating it as unmanaged and prompting a reset — same class of issue
// as the interlex.db drift documented in CLAUDE.md. Applying these new
// tables (Syntax Parser Phase 1, see AGENTS.md) as raw SQL instead, following
// the pattern in scripts/db/2026-07-23-add-semantic-relation-and-primes.ts.
//
// "id" columns are declared as literal "INTEGER PRIMARY KEY AUTOINCREMENT"
// rather than mirroring CorpusToken's Prisma-generated "BIGINT NOT NULL
// PRIMARY KEY" — empirically confirmed (better-sqlite3, in-memory test) that
// SQLite only treats a column as a rowid alias (auto-assigns on INSERT) when
// the declared type is the exact literal "INTEGER", not "BIGINT". Prisma's
// query engine apparently computes BigInt-autoincrement ids itself when
// writing to CorpusToken; a hand-written raw-SQL insert (which is how the
// future parser script will populate CorpusDependency) needs the real
// native autoincrement instead.
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-07-27-add-corpus-syntax-tables.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Creating CorpusDependency table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "CorpusDependency" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "sentenceId" TEXT NOT NULL,
            "headTokenId" BIGINT,
            "depTokenId" BIGINT NOT NULL,
            "relation" TEXT NOT NULL,
            "confidence" TEXT NOT NULL,
            "source" TEXT NOT NULL DEFAULT 'auto',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CorpusDependency_sentenceId_fkey" FOREIGN KEY ("sentenceId") REFERENCES "CorpusSentence" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "CorpusDependency_headTokenId_fkey" FOREIGN KEY ("headTokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "CorpusDependency_depTokenId_fkey" FOREIGN KEY ("depTokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CorpusDependency_depTokenId_key" ON "CorpusDependency"("depTokenId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "CorpusDependency_sentenceId_idx" ON "CorpusDependency"("sentenceId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "CorpusDependency_headTokenId_idx" ON "CorpusDependency"("headTokenId")`)

    console.log("--- Creating VerbGovernment table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "VerbGovernment" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "verbLemma" TEXT NOT NULL,
            "reflexive" BOOLEAN NOT NULL DEFAULT false,
            "requiredCase" TEXT NOT NULL,
            "role" TEXT NOT NULL DEFAULT 'obj',
            "priority" INTEGER NOT NULL DEFAULT 0,
            "note" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "VerbGovernment_verbLemma_requiredCase_reflexive_key" ON "VerbGovernment"("verbLemma", "requiredCase", "reflexive")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "VerbGovernment_verbLemma_idx" ON "VerbGovernment"("verbLemma")`)
})

tx()

const depCount = (db.prepare(`SELECT COUNT(*) c FROM CorpusDependency`).get() as { c: number }).c
const govCount = (db.prepare(`SELECT COUNT(*) c FROM VerbGovernment`).get() as { c: number }).c
console.log(`\nCorpusDependency row count: ${depCount}`)
console.log(`VerbGovernment row count: ${govCount}`)
console.log("Done.")
db.close()
