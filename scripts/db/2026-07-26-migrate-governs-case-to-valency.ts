import path from "path"
import Database from "better-sqlite3"
import { governsCaseToGrammaticalCase } from "@/lib/grammar/common/addition-parser"

// One-time data migration: converts the legacy Lexeme.governsCase (int,
// 2-6, only ever populated for prepositions/verbs via CSV import — see
// AGENTS.md "Мультивалентные слова") into the new ValencyFrame/
// ValencyArgument tables. For each Lexeme with governsCase set, creates one
// ValencyFrame per Meaning of that lexeme (bare case, no preposition/role —
// the legacy data never captured preposition text structurally, it's
// embedded in the lexeme's citation form itself, e.g. "pristupati do").
//
// Idempotent: skips any Meaning that already has at least one ValencyFrame,
// so re-running after a moderator has started editing frames won't duplicate
// or clobber their work.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-26-migrate-governs-case-to-valency.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

interface LexemeRow {
  id: number
  value: string | null
  governsCase: number
}

const lexemes = db.prepare(`
  SELECT id, value, governsCase FROM lexemes WHERE governsCase IS NOT NULL
`).all() as LexemeRow[]

const noMeaningLexemeIds = lexemes
  .map((l) => l.id)
  .filter((id) => (db.prepare(`SELECT COUNT(*) c FROM meanings WHERE lexemeId = ?`).get(id) as { c: number }).c === 0)

if (noMeaningLexemeIds.length > 0) {
  console.warn(`Skipping ${noMeaningLexemeIds.length} lexeme(s) with no Meaning row: ${noMeaningLexemeIds.join(", ")}`)
}

const insertFrame = db.prepare(`INSERT INTO valency_frames (meaningId, label, sortOrder) VALUES (?, NULL, 0)`)
const insertArgument = db.prepare(`
  INSERT INTO valency_arguments (frameId, role, "case", preposition, isOptional, sortOrder)
  VALUES (?, NULL, ?, NULL, 0, 0)
`)
const existingFrameCount = db.prepare(`SELECT COUNT(*) c FROM valency_frames WHERE meaningId = ?`)
const meaningsForLexeme = db.prepare(`SELECT id FROM meanings WHERE lexemeId = ?`)

let framesCreated = 0
let meaningsSkippedAlreadyMigrated = 0
let lexemesWithInvalidCase = 0

const migrate = db.transaction(() => {
  for (const lex of lexemes) {
    if (noMeaningLexemeIds.includes(lex.id)) continue

    const grammaticalCase = governsCaseToGrammaticalCase(lex.governsCase)
    if (!grammaticalCase) {
      console.warn(`Lexeme ${lex.id} (${lex.value}) has unrecognized governsCase=${lex.governsCase}, skipping`)
      lexemesWithInvalidCase++
      continue
    }

    const meanings = meaningsForLexeme.all(lex.id) as { id: number }[]
    for (const meaning of meanings) {
      const alreadyMigrated = (existingFrameCount.get(meaning.id) as { c: number }).c > 0
      if (alreadyMigrated) {
        meaningsSkippedAlreadyMigrated++
        continue
      }
      const frameResult = insertFrame.run(meaning.id)
      insertArgument.run(frameResult.lastInsertRowid, grammaticalCase)
      framesCreated++
    }
  }
})

migrate()

console.log(`\nLexemes with governsCase: ${lexemes.length}`)
console.log(`Skipped (no Meaning row): ${noMeaningLexemeIds.length}`)
console.log(`Skipped (invalid governsCase value): ${lexemesWithInvalidCase}`)
console.log(`Meanings already migrated (idempotent skip): ${meaningsSkippedAlreadyMigrated}`)
console.log(`ValencyFrame rows created: ${framesCreated}`)

const totalFrames = (db.prepare(`SELECT COUNT(*) c FROM valency_frames`).get() as { c: number }).c
const totalArguments = (db.prepare(`SELECT COUNT(*) c FROM valency_arguments`).get() as { c: number }).c
console.log(`\nvalency_frames total: ${totalFrames}`)
console.log(`valency_arguments total: ${totalArguments}`)
console.log("Done.")
db.close()
