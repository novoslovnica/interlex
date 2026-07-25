import path from "path"
import Database from "better-sqlite3"

// Drops the legacy Lexeme.governsCase / Candidate.governsCase columns, now
// fully superseded by ValencyFrame/ValencyArgument (see AGENTS.md
// "Мультивалентные слова"). Data was already migrated by
// scripts/db/2026-07-26-migrate-governs-case-to-valency.ts and confirmed
// stable in production before this was run — matches the project's
// established migrate-then-drop-later lifecycle (same pattern as the old
// 11 relation tables and actionHistory).
//
// Idempotent (checks column existence via PRAGMA table_info before dropping,
// same pattern as scripts/db/2026-07-25-add-audit-log.ts's actionHistory
// drop). Requires SQLite 3.35+ for ALTER TABLE ... DROP COLUMN (bundled
// better-sqlite3 here is 3.53.2, confirmed fine).
//
// After running this, `governsCase` no longer exists in `lexemes`/
// `candidates` — scripts/db/2026-07-26-migrate-governs-case-to-valency.ts
// (kept as a historical record, not edited retroactively per CLAUDE.md) will
// fail if ever re-run against a DB that already had this applied; that's
// expected, same as any other one-time migration whose precondition no
// longer holds.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-27-drop-governs-case.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

function hasColumn(table: string, column: string): boolean {
  const cols = db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]
  return cols.some((c) => c.name === column)
}

const tx = db.transaction(() => {
  for (const table of ["lexemes", "candidates"]) {
    if (hasColumn(table, "governsCase")) {
      db.exec(`ALTER TABLE "${table}" DROP COLUMN "governsCase"`)
      console.log(`${table}: dropped governsCase`)
    } else {
      console.log(`${table}: already dropped, skipped`)
    }
  }
})

tx()

console.log("\nDone.")
db.close()
