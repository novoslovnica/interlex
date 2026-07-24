import path from "path"
import Database from "better-sqlite3"

// Additive/idempotent — creates the tables for the core-vocabulary reference
// (CoreVocabularyConcept/CoreVocabularyExponent) added to
// prisma/data.schema.prisma on 2026-07-25. See AGENTS.md for design
// rationale (mirrors the SemanticPrime/PrimeExponent pattern from
// 2026-07-23-add-semantic-relation-and-primes.ts).
//
// `prisma migrate dev` is not used here — see CLAUDE.md's note that it's
// currently unsafe against this DB (drift on morpheme_allophones/
// proto_slavic_words), same reasoning as the earlier semantic-network and
// index migrations.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-25-add-core-vocabulary.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
  console.log("--- Creating core_vocabulary_concepts table (if missing) ---")
  db.exec(`
        CREATE TABLE IF NOT EXISTS "core_vocabulary_concepts" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "gloss" TEXT NOT NULL,
            "swadesh100Rank" INTEGER,
            "leipzigJakartaRank" INTEGER
        )
    `)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "core_vocabulary_concepts_gloss_key" ON "core_vocabulary_concepts"("gloss")`)

  console.log("--- Creating core_vocabulary_exponents table (if missing) ---")
  db.exec(`
        CREATE TABLE IF NOT EXISTS "core_vocabulary_exponents" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "conceptId" INTEGER NOT NULL,
            "meaningId" INTEGER NOT NULL,
            "isCanonical" BOOLEAN NOT NULL DEFAULT true,
            "note" TEXT,
            CONSTRAINT "core_vocabulary_exponents_conceptId_fkey" FOREIGN KEY ("conceptId") REFERENCES "core_vocabulary_concepts" ("id") ON DELETE CASCADE,
            CONSTRAINT "core_vocabulary_exponents_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE
        )
    `)
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "core_vocabulary_exponents_conceptId_meaningId_key" ON "core_vocabulary_exponents"("conceptId", "meaningId")`)
  db.exec(`CREATE INDEX IF NOT EXISTS "core_vocabulary_exponents_meaningId_idx" ON "core_vocabulary_exponents"("meaningId")`)
})

tx()

const conceptCount = (db.prepare(`SELECT COUNT(*) c FROM core_vocabulary_concepts`).get() as { c: number }).c
const exponentCount = (db.prepare(`SELECT COUNT(*) c FROM core_vocabulary_exponents`).get() as { c: number }).c
console.log(`\ncore_vocabulary_concepts row count: ${conceptCount}`)
console.log(`core_vocabulary_exponents row count: ${exponentCount}`)
console.log("Done.")
db.close()
