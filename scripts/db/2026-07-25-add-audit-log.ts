import path from "path"
import Database from "better-sqlite3"

// Additive/destructive-but-idempotent — applies the AuditLog migration to the
// `data` schema's database (interlex.db). Applied via raw SQL/better-sqlite3
// instead of `prisma migrate dev` because that schema's migration history has
// pre-existing drift (see ARCHITECTURE.md "Known Issues") that makes `migrate
// dev` refuse to run without offering a full reset.
//
// What it does:
//   1. Creates the `audit_logs` table (if not already present) with the same
//      shape/indexes Prisma's `AuditLog` model expects.
//   2. Drops the `actionHistory` column from all 21 tables that had it
//      (lexemes, candidates, morphemes, and all 18 language tables — the
//      language-table columns were confirmed dead, never written to anywhere
//      in the app). Column drops are guarded with a pragma_table_info check,
//      so re-running this script after it already succeeded is a no-op.
//
// Deliberately NOT touched: library.db's LibraryEntry.actionHistory — that
// table keeps the old per-row JSON-history approach for now.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-25-add-audit-log.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const TABLES_WITH_ACTION_HISTORY = [
    "lexemes", "candidates", "morphemes",
    "en", "ru", "mk", "sr", "uk", "bg", "pl", "be", "cs", "sk", "sl", "hr", "cu", "de", "nl", "eo", "hsb", "dsb",
]

function hasColumn(table: string, column: string): boolean {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    return cols.some((c) => c.name === column)
}

const tx = db.transaction(() => {
    console.log("--- Creating audit_logs table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "audit_logs" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "actionId" TEXT NOT NULL,
            "entityType" TEXT NOT NULL,
            "entityId" INTEGER NOT NULL,
            "field" TEXT NOT NULL,
            "oldValue" TEXT,
            "newValue" TEXT,
            "userId" TEXT,
            "userEmail" TEXT NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "audit_logs_entityType_entityId_createdAt_idx" ON "audit_logs"("entityType", "entityId", "createdAt")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "audit_logs_actionId_idx" ON "audit_logs"("actionId")`)

    console.log("\n--- Dropping actionHistory column from 21 tables ---")
    for (const table of TABLES_WITH_ACTION_HISTORY) {
        if (hasColumn(table, "actionHistory")) {
            db.exec(`ALTER TABLE "${table}" DROP COLUMN "actionHistory"`)
            console.log(`  ${table}: dropped`)
        } else {
            console.log(`  ${table}: already dropped, skipped`)
        }
    }
})

tx()

const finalCount = (db.prepare(`SELECT COUNT(*) c FROM audit_logs`).get() as { c: number }).c
console.log(`\naudit_logs row count: ${finalCount}`)
console.log("Done.")
db.close()
