import path from "path"
import Database from "better-sqlite3"

// Adds MediaLibraryEntry - the community media catalog table backing
// roadmap item 82 ("Медиатека сообщества"), see AGENTS.md for the design
// writeup. Deliberately a separate table from library_entries: this one
// models an external channel/show link, not a text with a body.
//
// `prisma migrate dev` is not used here either, for consistency with every
// other schema change in this project (raw SQL, idempotent).
//
// Usage:
//   SQLITE_DB=/path/to/library.db npx tsx scripts/db/2026-08-13-add-media-library.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "library.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Creating MediaLibraryEntry (if missing) ---")
  db.exec(`
    CREATE TABLE IF NOT EXISTS "MediaLibraryEntry" (
      "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
      "slug" TEXT NOT NULL UNIQUE,
      "title" TEXT NOT NULL,
      "mediaType" TEXT NOT NULL,
      "url" TEXT NOT NULL,
      "platform" TEXT,
      "description" TEXT,
      "thumbnailUrl" TEXT,
      "language" TEXT,
      "addedById" TEXT,
      "addedBy" TEXT,
      "verified" BOOLEAN NOT NULL DEFAULT 0,
      "verifiedBy" TEXT,
      "isPublic" BOOLEAN NOT NULL DEFAULT 1,
      "views" INTEGER NOT NULL DEFAULT 0,
      "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `)
  db.exec(`CREATE INDEX IF NOT EXISTS "MediaLibraryEntry_mediaType_idx" ON "MediaLibraryEntry"("mediaType")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "MediaLibraryEntry_isPublic_idx" ON "MediaLibraryEntry"("isPublic")`)
})

tx()

const tables = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = 'MediaLibraryEntry'`).all() as Array<{ name: string }>
console.log(`\nTable present: ${tables.length > 0}`)
console.log("Done.")
db.close()
