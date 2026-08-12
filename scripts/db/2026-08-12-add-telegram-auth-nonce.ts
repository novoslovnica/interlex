// No _prisma_migrations tracking table on auth.db either (same class of
// issue documented for interlex.db/corpus.db in CLAUDE.md/AGENTS.md) -
// applying as raw SQL following the established pattern (see e.g.
// scripts/db/2026-07-28-add-corpus-token-candidates.ts).
//
// Adds replay protection for Telegram Credentials login: the HMAC hash
// Telegram sends is unique per login event, so it doubles as the nonce -
// auth.config.ts's authorize() claims it via an insert (unique constraint
// violation = replay). See prisma/auth.schema.prisma's TelegramAuthNonce
// model comment for the full rationale.
//
// Usage:
//   AUTH_SQLITE_DB=/path/to/auth.db npx tsx scripts/db/2026-08-12-add-telegram-auth-nonce.ts

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.AUTH_SQLITE_DB || path.resolve(process.cwd(), "auth.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Creating telegram_auth_nonces table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "telegram_auth_nonces" (
            "hash" TEXT PRIMARY KEY,
            "authDate" INTEGER NOT NULL,
            "usedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "telegram_auth_nonces_authDate_idx" ON "telegram_auth_nonces"("authDate")`)
})

tx()

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='telegram_auth_nonces'`).all()
console.log(`\ntelegram_auth_nonces table present: ${tables.length > 0}`)
const rowCount = (db.prepare(`SELECT COUNT(*) c FROM telegram_auth_nonces`).get() as { c: number }).c
console.log(`telegram_auth_nonces row count: ${rowCount}`)
console.log("Done.")
db.close()
