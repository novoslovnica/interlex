// corpus.db lacks a _prisma_migrations tracking table, so `prisma migrate dev`
// risks treating it as unmanaged and prompting a reset — same class of issue
// as the interlex.db drift documented in CLAUDE.md. Applying this as raw SQL
// instead, following the pattern in
// scripts/db/2026-07-28-add-corpus-token-candidates.ts.
//
// Plan: "auto-generate lexeme candidates from red/yellow corpus tokens"
// (discussed 2026-07-29). CorpusCandidateProposal holds one row per
// reconstruction hypothesis for a cluster of tokens sharing the same
// normalized surface form. Re-running the generation script upserts on
// (clusterKey, ruleSource, guessedStemType, guessedGrammeme) — it recomputes
// occurrenceCount/exampleTokenIds/lastSeenAt every time but the UPDATE
// clause never touches "status", so a moderator's reject/promote decision
// is never overwritten by a later regeneration — the same guarantee
// CorpusToken.resolutionSource/CorpusDependency.source already give
// elsewhere in this schema.
//
// "id" is "INTEGER PRIMARY KEY AUTOINCREMENT" (real SQLite rowid alias),
// same choice as CorpusTokenCandidate/CorpusDependency for the same reason
// (rows are inserted by application code, not pre-computed like CorpusToken.id).
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-07-29-add-corpus-candidate-proposals.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Adding CorpusToken.isPartialMatch (if missing) ---")
  const tokenColumns = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as Array<{ name: string }>
  const hasIsPartialMatch = tokenColumns.some((c) => c.name === "isPartialMatch")
  if (!hasIsPartialMatch) {
    db.exec(`ALTER TABLE "CorpusToken" ADD COLUMN "isPartialMatch" BOOLEAN NOT NULL DEFAULT 0`)
  } else {
    console.log("(already present, skipping)")
  }

  console.log("--- Creating CorpusCandidateProposal table (if missing) ---")
  db.exec(`
    CREATE TABLE IF NOT EXISTS "CorpusCandidateProposal" (
      "id" INTEGER PRIMARY KEY AUTOINCREMENT,
      "clusterKey" TEXT NOT NULL,
      "ruleSource" TEXT NOT NULL,
      "guessedPos" TEXT NOT NULL,
      "guessedStemType" TEXT NOT NULL,
      "guessedGrammeme" TEXT NOT NULL,
      "guessedStem" TEXT NOT NULL,
      "reconstructedForm" TEXT NOT NULL,
      "siblingWordSlug" TEXT,
      "possibleEndingGap" BOOLEAN NOT NULL DEFAULT 0,
      "rank" INTEGER NOT NULL DEFAULT 0,
      "occurrenceCount" INTEGER NOT NULL DEFAULT 1,
      "exampleTokenIds" JSONB NOT NULL,
      "firstSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "lastSeenAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "resolutionNote" TEXT,
      "candidateId" INTEGER,
      "reviewedByEmail" TEXT,
      "reviewedAt" DATETIME
    )
  `)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "CorpusCandidateProposal_cluster_rule_stem_grammeme_key" ON "CorpusCandidateProposal"("clusterKey", "ruleSource", "guessedStemType", "guessedGrammeme")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "CorpusCandidateProposal_clusterKey_idx" ON "CorpusCandidateProposal"("clusterKey")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "CorpusCandidateProposal_status_occurrenceCount_idx" ON "CorpusCandidateProposal"("status", "occurrenceCount")`)
})

tx()

const tokenColumnsAfter = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as Array<{ name: string }>
console.log(`\nCorpusToken.isPartialMatch present: ${tokenColumnsAfter.some((c) => c.name === "isPartialMatch")}`)
const count = (db.prepare(`SELECT COUNT(*) c FROM CorpusCandidateProposal`).get() as { c: number }).c
console.log(`CorpusCandidateProposal row count: ${count}`)
console.log("Done.")
db.close()
