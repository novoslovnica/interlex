import path from "path"
import Database from "better-sqlite3"

// Adds two new staging tables backing roadmap items 49 ("suggest a word")
// and 97 ("report an error"), see AGENTS.md for the full design writeup.
//
// `prisma migrate dev` is not used — CLAUDE.md notes it's currently unsafe
// against this DB (drift on morpheme_allophones/proto_slavic_words), same
// reasoning as every other schema-only change in this project.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-08-13-add-reports-and-suggestions.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Creating word_suggestions (if missing) ---")
  db.exec(`
    CREATE TABLE IF NOT EXISTS "word_suggestions" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "suggestedValue" TEXT,
      "meaningText" TEXT NOT NULL,
      "exampleSentence" TEXT,
      "sourceNote" TEXT,
      "submitterUserId" TEXT,
      "submitterContact" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "promotedCandidateId" INTEGER,
      "reviewedByUserId" TEXT,
      "reviewedAt" DATETIME,
      "moderatorNote" TEXT
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS "word_suggestions_status_idx" ON "word_suggestions"("status")`)

  console.log("--- Creating content_reports (if missing) ---")
  db.exec(`
    CREATE TABLE IF NOT EXISTS "content_reports" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "entityType" TEXT NOT NULL,
      "entityId" INTEGER NOT NULL,
      "lexemeId" INTEGER NOT NULL,
      "field" TEXT,
      "reportedValue" TEXT,
      "reasonCode" TEXT NOT NULL,
      "comment" TEXT,
      "submitterUserId" TEXT,
      "submitterContact" TEXT,
      "status" TEXT NOT NULL DEFAULT 'pending',
      "resolvedByUserId" TEXT,
      "resolvedAt" DATETIME,
      "moderatorNote" TEXT
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS "content_reports_status_idx" ON "content_reports"("status")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "content_reports_lexemeId_idx" ON "content_reports"("lexemeId")`)
})

tx()

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('word_suggestions','content_reports')`).all() as Array<{ name: string }>
console.log(`\nTables present: ${tables.map(t => t.name).join(", ")}`)
console.log("Done.")
db.close()
