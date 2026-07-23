import path from "path"
import Database from "better-sqlite3"

// Additive/idempotent — creates the tables for the consolidated semantic
// network (`SemanticRelation`) and NSM semantic primes (`SemanticPrime`/
// `PrimeExponent`) added to `prisma/data.schema.prisma` on 2026-07-23.
// See AGENTS.md "Semantic Network" section for the full design rationale.
//
// What it does:
//   1. Creates `semantic_relations` (if not already present) with the same
//      shape/indexes Prisma's `SemanticRelation` model expects.
//   2. Creates `semantic_primes` and `prime_exponents`.
//
// Deliberately NOT done here: the 11 old relation tables (synonyms,
// antonyms, hypernyms, ...) are left untouched — dropping them is a
// separate, later migration gated on the admin UI moving over first (see
// AGENTS.md's deferred TODO).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-23-add-semantic-relation-and-primes.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const tx = db.transaction(() => {
    console.log("--- Creating semantic_relations table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "semantic_relations" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "sourceId" INTEGER NOT NULL,
            "targetId" INTEGER NOT NULL,
            "relation_type" TEXT NOT NULL,
            "proximity" REAL,
            "source" TEXT NOT NULL DEFAULT 'manual',
            "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "semantic_relations_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "meanings" ("id") ON DELETE CASCADE,
            CONSTRAINT "semantic_relations_targetId_fkey" FOREIGN KEY ("targetId") REFERENCES "meanings" ("id") ON DELETE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "semantic_relations_sourceId_targetId_relation_type_key" ON "semantic_relations"("sourceId", "targetId", "relation_type")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "semantic_relations_sourceId_relation_type_idx" ON "semantic_relations"("sourceId", "relation_type")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "semantic_relations_targetId_relation_type_idx" ON "semantic_relations"("targetId", "relation_type")`)

    console.log("--- Creating semantic_primes table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "semantic_primes" (
            "code" TEXT NOT NULL PRIMARY KEY,
            "category" TEXT,
            "english_text" TEXT NOT NULL,
            "sort_order" INTEGER NOT NULL
        )
    `)

    console.log("--- Creating prime_exponents table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS "prime_exponents" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "prime_code" TEXT NOT NULL,
            "meaningId" INTEGER NOT NULL,
            "is_canonical" BOOLEAN NOT NULL DEFAULT true,
            "note" TEXT,
            CONSTRAINT "prime_exponents_prime_code_fkey" FOREIGN KEY ("prime_code") REFERENCES "semantic_primes" ("code") ON DELETE CASCADE,
            CONSTRAINT "prime_exponents_meaningId_fkey" FOREIGN KEY ("meaningId") REFERENCES "meanings" ("id") ON DELETE CASCADE
        )
    `)
    db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS "prime_exponents_prime_code_meaningId_key" ON "prime_exponents"("prime_code", "meaningId")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "prime_exponents_meaningId_idx" ON "prime_exponents"("meaningId")`)
})

tx()

const relCount = (db.prepare(`SELECT COUNT(*) c FROM semantic_relations`).get() as { c: number }).c
const primeCount = (db.prepare(`SELECT COUNT(*) c FROM semantic_primes`).get() as { c: number }).c
console.log(`\nsemantic_relations row count: ${relCount}`)
console.log(`semantic_primes row count: ${primeCount}`)
console.log("Done.")
db.close()
