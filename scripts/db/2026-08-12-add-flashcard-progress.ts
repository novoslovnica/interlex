// No _prisma_migrations tracking table on auth.db (same class of issue
// documented for interlex.db/corpus.db in CLAUDE.md/AGENTS.md) - applying
// as raw SQL following the established pattern.
//
// Adds per-user spaced-repetition state for the flashcard learning feature
// (P3 roadmap item, lib/srs/sm2.ts - classic SM-2). wordId is a plain
// INTEGER, not a real FK - same cross-database-reference convention already
// used by user_word_collection.wordId (Lexeme lives in interlex.db, never
// joined with auth.db in one query/transaction).
//
// Usage:
//   AUTH_SQLITE_DB=/path/to/auth.db npx tsx scripts/db/2026-08-12-add-flashcard-progress.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.AUTH_SQLITE_DB || path.resolve(process.cwd(), "auth.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Creating flashcard_progress table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "flashcard_progress" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "wordId" INTEGER NOT NULL,
            "easeFactor" REAL NOT NULL DEFAULT 2.5,
            "intervalDays" INTEGER NOT NULL DEFAULT 0,
            "repetitions" INTEGER NOT NULL DEFAULT 0,
            "nextReviewAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "lastReviewedAt" DATETIME,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "flashcard_progress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "flashcard_progress_userId_wordId_key" ON "flashcard_progress"("userId", "wordId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "flashcard_progress_userId_nextReviewAt_idx" ON "flashcard_progress"("userId", "nextReviewAt")`)
})

tx()

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='flashcard_progress'`).all()
console.log(`\nflashcard_progress table present: ${tables.length > 0}`)
const rowCount = (db.prepare(`SELECT COUNT(*) c FROM flashcard_progress`).get() as { c: number }).c
console.log(`flashcard_progress row count: ${rowCount}`)
console.log("Done.")
db.close()
