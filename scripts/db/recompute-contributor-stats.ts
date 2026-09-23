// Rebuilds contributor_stats from translation_votes. The table is only an
// aggregate (lib/community/stats.ts keeps it current vote by vote); run this
// after changing the weight formula in lib/community/reputation.ts, or if
// the two are ever suspected to have drifted. Does NOT re-judge votes -
// translation_votes.agreed is the source of truth and is left alone - and
// does not touch the weight already recorded on past votes.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/recompute-contributor-stats.ts

import Database from "better-sqlite3"
import path from "path"
import { refreshContributorStats } from "../../lib/community/stats"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const pairs = db.prepare(`SELECT DISTINCT userId, language FROM translation_votes`).all() as { userId: string; language: string }[]
db.transaction(() => {
    // Строки без единого голоса (голоса удалены каскадом вместе с переводом) - лишние.
    db.exec(`DELETE FROM contributor_stats WHERE NOT EXISTS (
        SELECT 1 FROM translation_votes v WHERE v.userId = contributor_stats.userId AND v.language = contributor_stats.language
    )`)
    for (const pair of pairs) refreshContributorStats(db, pair.userId, pair.language)
})()

const flagged = (db.prepare(`SELECT COUNT(*) c FROM contributor_stats WHERE flagged = 1`).get() as { c: number }).c
console.log(`Recomputed ${pairs.length} (user, language) pairs; flagged: ${flagged}`)
db.close()
