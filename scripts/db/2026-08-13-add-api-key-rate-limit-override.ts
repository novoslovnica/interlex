import path from "path"
import Database from "better-sqlite3"

// Adds ApiKey.rateLimitOverride - an admin-assignable per-key rate limit
// (roadmap #38, part of extending the public API to corpus/library and
// splitting the previously-flat 60/min into per-category defaults with a
// per-key escape hatch). NULL means "use the category default."
//
// `prisma migrate dev` is not used, same reasoning as every other schema
// change in this project (raw SQL, idempotent).
//
// Usage:
//   SQLITE_DB=/path/to/auth.db npx tsx scripts/db/2026-08-13-add-api-key-rate-limit-override.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "auth.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Adding api_keys.rateLimitOverride (if missing) ---")
  const columns = db.prepare(`PRAGMA table_info("api_keys")`).all() as Array<{ name: string }>
  const hasColumn = columns.some((c) => c.name === "rateLimitOverride")
  if (!hasColumn) {
    db.exec(`ALTER TABLE "api_keys" ADD COLUMN "rateLimitOverride" INTEGER`)
  } else {
    console.log("(already present, skipping)")
  }
})

tx()

const columnsAfter = db.prepare(`PRAGMA table_info("api_keys")`).all() as Array<{ name: string }>
console.log(`\nrateLimitOverride present: ${columnsAfter.some((c) => c.name === "rateLimitOverride")}`)
console.log("Done.")
db.close()
