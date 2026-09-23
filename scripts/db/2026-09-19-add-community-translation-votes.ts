// Community direction, phase 1 (docs/community-plan-2026-09-19.md): public
// translation review cards. Raw SQL, not `prisma migrate dev` - that command
// is unsafe on the data schema (drift -> offers a reset, see CLAUDE.md).
//
// Adds:
//   translation_votes - one volunteer answer per (translation, user).
//       userId is a bare string: User lives in auth.db, no cross-DB FK
//       (same convention as content_reports.submitterUserId).
//   translations.communityStatus / communityYes / communityNo /
//       communityResolvedAt - the running tally and its outcome. Kept apart
//       from `verified` on purpose: `verified` stays the moderator's mark,
//       a volunteer consensus never writes it.
//
// Idempotent, safe to re-run. Backs the DB up once before the first change.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-09-19-add-community-translation-votes.ts
//
// After running: `npm run db:gen-data` AND restart the app process.

import Database from "better-sqlite3"
import fs from "fs"
import path from "path"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
const BACKUP_PATH = `${DB_PATH}.backup-before-community`
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const hasColumn = (table: string, column: string) =>
    (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).some((c) => c.name === column)
const hasTable = (table: string) =>
    db.prepare(`SELECT 1 FROM sqlite_master WHERE type='table' AND name=?`).get(table) !== undefined

const NEW_COLUMNS: [string, string][] = [
    ["communityStatus", "TEXT"],
    ["communityYes", "REAL NOT NULL DEFAULT 0"],
    ["communityNo", "REAL NOT NULL DEFAULT 0"],
    ["communityResolvedAt", "DATETIME"],
]

const alreadyApplied = hasTable("translation_votes") && NEW_COLUMNS.every(([name]) => hasColumn("translations", name))
if (!alreadyApplied && !fs.existsSync(BACKUP_PATH)) {
    console.log(`Backing up to ${BACKUP_PATH} ...`)
    // VACUUM INTO даёт согласованный снимок даже при открытом WAL, в отличие от cp.
    db.exec(`VACUUM INTO '${BACKUP_PATH.replace(/'/g, "''")}'`)
}

const tx = db.transaction(() => {
    console.log("--- translation_votes ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "translation_votes" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "translationId" INTEGER NOT NULL,
            "language" TEXT NOT NULL,
            "userId" TEXT NOT NULL,
            "verdict" TEXT NOT NULL,
            "suggestedValue" TEXT,
            "comment" TEXT,
            "valueSnapshot" TEXT,
            "weight" REAL NOT NULL DEFAULT 1,
            "isControl" INTEGER NOT NULL DEFAULT 0,
            "stale" INTEGER NOT NULL DEFAULT 0,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "translation_votes_translationId_fkey" FOREIGN KEY ("translationId") REFERENCES "translations" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    // Частичный: один ДЕЙСТВУЮЩИЙ ответ на пару (перевод, пользователь). Когда
    // перевод меняется, старые ответы помечаются stale=1 и остаются в истории,
    // а человек может ответить по новому значению. Prisma частичные индексы
    // не выражает - в data.schema.prisma это обычный @@index, уникальность
    // держит только этот SQL.
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "translation_votes_active_vote_key" ON "translation_votes"("translationId", "userId") WHERE "stale" = 0`)
    db.exec(`CREATE INDEX IF NOT EXISTS "translation_votes_translationId_idx" ON "translation_votes"("translationId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "translation_votes_userId_createdAt_idx" ON "translation_votes"("userId", "createdAt")`)

    console.log("--- translations.community* ---")
    for (const [name, definition] of NEW_COLUMNS) {
        if (hasColumn("translations", name)) continue
        db.exec(`ALTER TABLE "translations" ADD COLUMN "${name}" ${definition}`)
        console.log(`  + ${name}`)
    }
    db.exec(`CREATE INDEX IF NOT EXISTS "translations_language_communityStatus_idx" ON "translations"("language", "communityStatus")`)
})

tx()

console.log(`\ntranslation_votes present: ${hasTable("translation_votes")}, rows: ${(db.prepare(`SELECT COUNT(*) c FROM translation_votes`).get() as { c: number }).c}`)
console.log(`translations columns: ${NEW_COLUMNS.map(([name]) => `${name}=${hasColumn("translations", name)}`).join(", ")}`)
console.log(`translations rows: ${(db.prepare(`SELECT COUNT(*) c FROM translations`).get() as { c: number }).c}`)
console.warn("\nReminder: run `npm run db:gen-data` and RESTART the app process.")
console.log("Done.")
db.close()
