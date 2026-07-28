import path from "path"
import Database from "better-sqlite3"

// Adds ValencyArgument.prepositionLexemeId — links the free-text
// `preposition` field to a real ADP (preposition) Lexeme instead of only
// storing typed text. `preposition` itself is NOT dropped: it stays as a
// display-text cache kept in sync at write time whenever a link is chosen
// (lib/valency.ts), and remains the fallback for older rows that only ever
// had free text. onDelete SET NULL — deleting the preposition lexeme itself
// should not cascade-delete the valency argument, just drop the link.
//
// `prisma migrate dev` is not used — CLAUDE.md notes it's currently unsafe
// against this DB (drift on morpheme_allophones/proto_slavic_words), same
// reasoning as the original valency-tables migration
// (2026-07-26-add-valency-tables.ts).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-29-add-valency-preposition-lexeme-fk.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Adding valency_arguments.prepositionLexemeId (if missing) ---")
  const columns = db.prepare(`PRAGMA table_info("valency_arguments")`).all() as Array<{ name: string }>
  const hasColumn = columns.some((c) => c.name === "prepositionLexemeId")
  if (!hasColumn) {
    db.exec(`ALTER TABLE "valency_arguments" ADD COLUMN "prepositionLexemeId" INTEGER REFERENCES "lexemes" ("id") ON DELETE SET NULL`)
  } else {
    console.log("(already present, skipping)")
  }
  db.exec(`CREATE INDEX IF NOT EXISTS "valency_arguments_prepositionLexemeId_idx" ON "valency_arguments"("prepositionLexemeId")`)
})

tx()

const columnsAfter = db.prepare(`PRAGMA table_info("valency_arguments")`).all() as Array<{ name: string }>
console.log(`\nprepositionLexemeId present: ${columnsAfter.some((c) => c.name === "prepositionLexemeId")}`)
console.log("Done.")
db.close()
