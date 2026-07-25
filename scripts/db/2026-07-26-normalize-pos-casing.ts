import path from "path"
import Database from "better-sqlite3"

// Fixes a data-quality bug found while investigating the valency-frame
// feature (see AGENTS.md "Мультивалентные слова"): `Lexeme.pos` mixes UD-tag
// casing ("NOUN"/"VERB") with a lowercase legacy batch ("noun"/"verb").
// `app/words/[id]/Word.tsx` does an exact `pos === PosType.VERB` (i.e.
// === "VERB") comparison to decide whether to render declension/conjugation
// tables — so every lowercase-tagged lexeme silently renders NO grammar
// tables on its public page. This uppercases the two known-affected values;
// idempotent (WHERE clause naturally becomes a no-op once fixed).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-26-normalize-pos-casing.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const before = db.prepare(`SELECT pos, COUNT(*) c FROM lexemes WHERE pos IN ('noun', 'verb') GROUP BY pos`).all() as { pos: string; c: number }[]
console.log("Before:", before)

const result = db.prepare(`UPDATE lexemes SET pos = UPPER(pos) WHERE pos IN ('noun', 'verb')`).run()
console.log(`\nRows updated: ${result.changes}`)

const after = db.prepare(`SELECT pos, COUNT(*) c FROM lexemes WHERE pos IN ('noun', 'verb') GROUP BY pos`).all()
console.log("Remaining lowercase rows (should be empty):", after)
console.log("Done.")
db.close()
