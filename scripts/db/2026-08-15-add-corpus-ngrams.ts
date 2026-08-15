// corpus.db lacks a _prisma_migrations tracking table, so `prisma migrate dev`
// risks treating it as unmanaged and prompting a reset — same class of issue
// as the interlex.db drift documented in CLAUDE.md. Applying this as raw SQL
// instead, following the pattern in
// scripts/db/2026-07-29-add-corpus-candidate-proposals.ts.
//
// Plan: "Браузер устойчивых словосочетаний/n-грамм" (roadmap #44, план
// groovy-soaring-wall). CorpusNgram is N-generic (one table for sizes
// 2..5, not a table/columns per size) — slugs/lemmas are JSON arrays of
// length n, uniqueness is on (n, ngramKey). Recomputed fully (delete +
// reinsert) by lib/corpus/collocations/computeNgrams.ts on every run —
// no moderator-edited rows to protect here.
//
// "id" is "INTEGER PRIMARY KEY AUTOINCREMENT" (real SQLite rowid alias),
// same choice as CorpusCandidateProposal/CorpusTokenCandidate for the same
// reason (rows are inserted by application code, not pre-computed like
// CorpusToken.id).
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-08-15-add-corpus-ngrams.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Creating CorpusNgram table (if missing) ---")
  db.exec(`
    CREATE TABLE IF NOT EXISTS "CorpusNgram" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "n" INTEGER NOT NULL,
      "ngramKey" TEXT NOT NULL,
      "slugs" JSONB NOT NULL,
      "lemmas" JSONB NOT NULL,
      "posPattern" TEXT NOT NULL,
      "displayText" TEXT NOT NULL,
      "frequency" INTEGER NOT NULL,
      "score" REAL NOT NULL,
      "logLikelihood" REAL,
      "dice" REAL,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CorpusNgram_n_ngramKey_key" ON "CorpusNgram"("n", "ngramKey")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "CorpusNgram_n_frequency_idx" ON "CorpusNgram"("n", "frequency")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "CorpusNgram_n_score_idx" ON "CorpusNgram"("n", "score")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "CorpusNgram_displayText_idx" ON "CorpusNgram"("displayText")`)
})

tx()

const count = (db.prepare(`SELECT COUNT(*) c FROM CorpusNgram`).get() as { c: number }).c
console.log(`CorpusNgram row count: ${count}`)
console.log("Done.")
db.close()
