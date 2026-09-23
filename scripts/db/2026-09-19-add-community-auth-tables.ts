// Community direction, phase 0 (docs/community-plan-2026-09-19.md).
// auth.db's _prisma_migrations table is stale (2 rows from July, everything
// since was applied as raw SQL) - same raw-SQL pattern as
// 2026-08-14-add-api-keys.ts.
//
// Adds three tables:
//   user_languages - languages a user can judge translations in (several
//                    per user; UserSettings.language is a display
//                    preference and may hold "isv", so it can't serve)
//   user_profiles  - opt-in public handle; no row = the user is anonymous
//                    everywhere outside the admin area
//   role_audit     - who changed whose role/permissions (AuditLog lives in
//                    interlex.db and keys entities by Int, user ids are cuid)
//
// Idempotent, safe to re-run.
//
// Usage:
//   AUTH_SQLITE_DB=/path/to/auth.db npx tsx scripts/db/2026-09-19-add-community-auth-tables.ts
//
// After running: `npm run db:gen-auth` AND restart the app process (a
// long-lived next process keeps the pre-migration Prisma client in memory).

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.AUTH_SQLITE_DB || path.resolve(process.cwd(), "auth.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- user_languages ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "user_languages" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "language" TEXT NOT NULL,
            "level" TEXT NOT NULL DEFAULT 'native',
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "user_languages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "user_languages_userId_language_key" ON "user_languages"("userId", "language")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "user_languages_language_idx" ON "user_languages"("language")`)

    console.log("--- user_profiles ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "user_profiles" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "handle" TEXT NOT NULL,
            "bio" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_userId_key" ON "user_profiles"("userId")`)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "user_profiles_handle_key" ON "user_profiles"("handle")`)

    console.log("--- role_audit ---")
    // Без FK: запись должна пережить удаление и актора, и цели.
    db.exec(`
        CREATE TABLE IF NOT EXISTS "role_audit" (
            "id" TEXT PRIMARY KEY,
            "actorUserId" TEXT NOT NULL,
            "targetUserId" TEXT NOT NULL,
            "action" TEXT NOT NULL,
            "oldValue" TEXT,
            "newValue" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "role_audit_targetUserId_createdAt_idx" ON "role_audit"("targetUserId", "createdAt")`)
})

tx()

for (const table of ["user_languages", "user_profiles", "role_audit"]) {
    const present = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).all(table).length > 0
    const rowCount = present ? (db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }).c : 0
    console.log(`${table}: present=${present}, rows=${rowCount}`)
}
console.warn("\nReminder: run `npm run db:gen-auth` and RESTART the app process.")
console.log("Done.")
db.close()
