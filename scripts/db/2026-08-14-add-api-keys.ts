// No _prisma_migrations tracking table on auth.db (same class of issue
// documented for interlex.db/corpus.db in CLAUDE.md/AGENTS.md) - applying
// as raw SQL following the established pattern (see
// 2026-08-12-add-flashcard-progress.ts).
//
// Adds self-serve API key storage for the public read-only API
// (app/api/public/v1/**, P4 roadmap item #21). keyHash is the only secret
// material stored (sha256 of the raw key) - see the ApiKey model comment in
// prisma/auth.schema.prisma for why a unique-index hash lookup is
// sufficient here instead of a constant-time comparison.
//
// Usage:
//   AUTH_SQLITE_DB=/path/to/auth.db npx tsx scripts/db/2026-08-14-add-api-keys.ts
//
// After running: `npm run db:gen-auth` to regenerate the Prisma client, AND
// restart the running app process - a long-lived `next start`/`next dev`
// keeps the pre-migration Prisma client in memory, so `prismaAuth.apiKey`
// will not exist until the process restarts, not just on redeploy.

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.AUTH_SQLITE_DB || path.resolve(process.cwd(), "auth.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Creating api_keys table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "api_keys" (
            "id" TEXT PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "name" TEXT NOT NULL,
            "keyPrefix" TEXT NOT NULL,
            "keyHash" TEXT NOT NULL,
            "lastUsedAt" DATETIME,
            "requestCount" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "revokedAt" DATETIME,
            CONSTRAINT "api_keys_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_keyHash_key" ON "api_keys"("keyHash")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "api_keys_userId_idx" ON "api_keys"("userId")`)
})

tx()

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='api_keys'`).all()
console.log(`\napi_keys table present: ${tables.length > 0}`)
const rowCount = (db.prepare(`SELECT COUNT(*) c FROM api_keys`).get() as { c: number }).c
console.log(`api_keys row count: ${rowCount}`)
console.warn("\nReminder: run `npm run db:gen-auth` and RESTART the app process before using prismaAuth.apiKey.")
console.log("Done.")
db.close()
