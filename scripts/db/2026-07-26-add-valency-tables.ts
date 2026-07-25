import path from "path"
import Database from "better-sqlite3"

// Additive/idempotent — creates the tables for the valency-frame model
// (ValencyFrame/ValencyArgument) added to prisma/data.schema.prisma on
// 2026-07-26. See AGENTS.md "Мультивалентные слова" for the design
// rationale (mirrors the SemanticPrime/PrimeExponent,
// CoreVocabularyConcept/CoreVocabularyExponent pattern).
//
// `prisma migrate dev` is not used here — CLAUDE.md notes it's currently
// unsafe against this DB (drift on morpheme_allophones/proto_slavic_words),
// same reasoning as the earlier semantic-network/core-vocabulary migrations.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-26-add-valency-tables.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Creating valency_frames table (if missing) ---")
  db.exec(`
        CREATE TABLE IF NOT EXISTS "valency_frames" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "meaningId" INTEGER NOT NULL,
            "label" TEXT,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "valency_frames_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE
        )
    `)
  db.exec(`CREATE INDEX IF NOT EXISTS "valency_frames_meaningId_idx" ON "valency_frames"("meaningId")`)

  console.log("--- Creating valency_arguments table (if missing) ---")
  db.exec(`
        CREATE TABLE IF NOT EXISTS "valency_arguments" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "frameId" INTEGER NOT NULL,
            "role" TEXT,
            "case" TEXT NOT NULL,
            "preposition" TEXT,
            "isOptional" BOOLEAN NOT NULL DEFAULT false,
            "sortOrder" INTEGER NOT NULL DEFAULT 0,
            CONSTRAINT "valency_arguments_frameId_fkey" FOREIGN KEY ("frameId") REFERENCES "valency_frames" ("id") ON DELETE CASCADE
        )
    `)
  db.exec(`CREATE INDEX IF NOT EXISTS "valency_arguments_frameId_idx" ON "valency_arguments"("frameId")`)
})

tx()

const frameCount = (db.prepare(`SELECT COUNT(*) c FROM valency_frames`).get() as { c: number }).c
const argumentCount = (db.prepare(`SELECT COUNT(*) c FROM valency_arguments`).get() as { c: number }).c
console.log(`\nvalency_frames row count: ${frameCount}`)
console.log(`valency_arguments row count: ${argumentCount}`)
console.log("Done.")
db.close()
