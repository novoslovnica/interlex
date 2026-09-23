// Community direction, phase 2 (docs/community-plan-2026-09-19.md): control
// cards and contributor reputation. Raw SQL for the same reason as the
// phase 1 script (`prisma migrate dev` is unsafe on the data schema).
//
// Adds:
//   translation_votes.agreed          - 1/0 once the answer has been judged
//       (against the volunteer consensus, a moderator's decision, or - for a
//       control card - the known answer); NULL while undecided. Stored on
//       the vote, not derived on read: a moderator replacing a wrong value
//       marks the votes stale, and the verdict "these people were right"
//       must survive that.
//   translation_votes.controlExpected - 'yes'/'no' for a control card.
//   contributor_stats                 - per (user, language) aggregate of
//       the two columns above plus the resulting vote weight. Always
//       rebuildable from translation_votes
//       (scripts/db/recompute-contributor-stats.ts).
//
// Purely additive and idempotent. No separate backup: nothing existing is
// rewritten, and interlex.db.backup-before-community (phase 1, same day)
// predates every community table.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-09-19-add-community-reputation.ts
//
// After running: `npm run db:gen-data` AND restart the app process.

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const hasColumn = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).some((c) => c.name === column)

const VOTE_COLUMNS: [string, string][] = [
    ["agreed", "INTEGER"],
    ["controlExpected", "TEXT"],
]

const tx = db.transaction(() => {
    console.log("--- translation_votes.agreed / controlExpected ---")
    for (const [name, definition] of VOTE_COLUMNS) {
        if (hasColumn("translation_votes", name)) continue
        db.exec(`ALTER TABLE "translation_votes" ADD COLUMN "${name}" ${definition}`)
        console.log(`  + ${name}`)
    }

    console.log("--- contributor_stats ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "contributor_stats" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "userId" TEXT NOT NULL,
            "language" TEXT NOT NULL,
            "votesTotal" INTEGER NOT NULL DEFAULT 0,
            "votesResolved" INTEGER NOT NULL DEFAULT 0,
            "votesAgreed" INTEGER NOT NULL DEFAULT 0,
            "controlTotal" INTEGER NOT NULL DEFAULT 0,
            "controlCorrect" INTEGER NOT NULL DEFAULT 0,
            "accuracy" REAL,
            "weight" REAL NOT NULL DEFAULT 1,
            "flagged" INTEGER NOT NULL DEFAULT 0,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "contributor_stats_userId_language_key" ON "contributor_stats"("userId", "language")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "contributor_stats_language_votesAgreed_idx" ON "contributor_stats"("language", "votesAgreed")`)
})

tx()

console.log(`\ntranslation_votes columns: ${VOTE_COLUMNS.map(([name]) => `${name}=${hasColumn("translation_votes", name)}`).join(", ")}`)
console.log(`contributor_stats rows: ${(db.prepare(`SELECT COUNT(*) c FROM contributor_stats`).get() as { c: number }).c}`)
console.warn("\nReminder: run `npm run db:gen-data` and RESTART the app process.")
console.log("Done.")
db.close()
