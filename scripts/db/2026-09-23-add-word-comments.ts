// Community direction, phase 5 (docs/community-plan-2026-09-19.md): a
// discussion thread on the word page. Raw SQL, same reason as the other
// community migrations. userId is a bare string (User lives in auth.db).
// status: 'visible' | 'hidden' (moderator) | 'deleted' (author); hidden and
// deleted rows are kept - replies may hang off them and reports point at them.
//
// Idempotent. Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-09-23-add-word-comments.ts
// After running: `npm run db:gen-data` AND restart the app process.

import Database from "better-sqlite3"
import path from "path"

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

db.transaction(() => {
    db.exec(`
        CREATE TABLE IF NOT EXISTS "word_comments" (
            "id" INTEGER PRIMARY KEY AUTOINCREMENT,
            "lexemeId" INTEGER NOT NULL,
            "parentId" INTEGER,
            "userId" TEXT NOT NULL,
            "body" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'visible',
            "hiddenByUserId" TEXT,
            "moderatorNote" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "editedAt" DATETIME,
            CONSTRAINT "word_comments_lexemeId_fkey" FOREIGN KEY ("lexemeId") REFERENCES "lexemes" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
            CONSTRAINT "word_comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "word_comments" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS "word_comments_lexemeId_createdAt_idx" ON "word_comments"("lexemeId", "createdAt")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "word_comments_userId_createdAt_idx" ON "word_comments"("userId", "createdAt")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "word_comments_status_createdAt_idx" ON "word_comments"("status", "createdAt")`)
})()

console.log(`word_comments rows: ${(db.prepare(`SELECT COUNT(*) c FROM word_comments`).get() as { c: number }).c}`)
console.warn("\nReminder: run `npm run db:gen-data` and RESTART the app process.")
db.close()
