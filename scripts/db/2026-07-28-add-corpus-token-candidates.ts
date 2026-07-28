// corpus.db lacks a _prisma_migrations tracking table, so `prisma migrate dev`
// risks treating it as unmanaged and prompting a reset — same class of issue
// as the interlex.db drift documented in CLAUDE.md. Applying this as raw SQL
// instead, following the pattern in
// scripts/db/2026-07-27-add-corpus-syntax-tables.ts.
//
// Homonym disambiguation plan, Phase 1 (see AGENTS.md-adjacent discussion):
// DbAnalyzer used to discard every candidate but the arbitrary DB-order
// winner, keeping only CorpusToken.matchCount as a bare int — there was
// nothing left to disambiguate against later. This migration adds a table
// to hold the full candidate set per token, plus a source guard on
// CorpusToken itself so a future re-tokenize/reanalyze pass can skip tokens
// a moderator has already resolved by hand — the same 'auto'/'manual'
// pattern already used by CorpusDependency.source.
//
// "id" on CorpusTokenCandidate is "INTEGER PRIMARY KEY AUTOINCREMENT" (a
// real SQLite rowid alias) rather than mirroring CorpusToken's own
// BigInt-not-autoincrement id, since candidate rows are inserted directly
// via raw application code that doesn't need to pre-compute ids the way
// CorpusToken's own writers do (see CorpusDependency for the same choice
// and the empirical note on why "INTEGER" specifically, not "BIGINT").
//
// Existing tokens are NOT backfilled with candidates here — the original
// candidate set was never persisted, so there is nothing to reconstruct
// short of re-running DbAnalyzer. The next "Пересчитать POS-tagging"
// (reanalyze) pass on each document populates this table going forward.
//
// Usage:
//   CORPUS_SQLITE_DB=/path/to/corpus.db npx tsx scripts/db/2026-07-28-add-corpus-token-candidates.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.CORPUS_SQLITE_DB || path.resolve(process.cwd(), "corpus.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Adding CorpusToken.resolutionSource (if missing) ---")
    const tokenColumns = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as Array<{ name: string }>
    const hasResolutionSource = tokenColumns.some((c) => c.name === "resolutionSource")
    if (!hasResolutionSource) {
        db.exec(`ALTER TABLE "CorpusToken" ADD COLUMN "resolutionSource" TEXT NOT NULL DEFAULT 'auto'`)
    } else {
        console.log("(already present, skipping)")
    }

    console.log("--- Creating CorpusTokenCandidate table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "CorpusTokenCandidate" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "tokenId" BIGINT NOT NULL,
            "wordSlug" TEXT NOT NULL,
            "lemma" TEXT NOT NULL,
            "pos" TEXT NOT NULL,
            "feats" JSONB,
            "flavor" TEXT,
            "score" REAL NOT NULL DEFAULT 0,
            "source" TEXT NOT NULL DEFAULT 'form_freq',
            "rank" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "CorpusTokenCandidate_tokenId_fkey" FOREIGN KEY ("tokenId") REFERENCES "CorpusToken" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "CorpusTokenCandidate_tokenId_idx" ON "CorpusTokenCandidate"("tokenId")`)
})

tx()

const tokenColumnsAfter = db.prepare(`PRAGMA table_info("CorpusToken")`).all() as Array<{ name: string }>
console.log(`\nCorpusToken.resolutionSource present: ${tokenColumnsAfter.some((c) => c.name === "resolutionSource")}`)
const candidateCount = (db.prepare(`SELECT COUNT(*) c FROM CorpusTokenCandidate`).get() as { c: number }).c
console.log(`CorpusTokenCandidate row count: ${candidateCount}`)
console.log("Done.")
db.close()
