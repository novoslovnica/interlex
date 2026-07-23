import dotenv from "dotenv"
import path from "path"
import { init } from "@/lib/sqlite"

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") })

// Seeds the 64 NSM (Natural Semantic Metalanguage) semantic primes into
// `semantic_primes`. Idempotent — safe to re-run (upserts by `code`).
//
// Source: Cliff Goddard, "NSM Semantic Primes" (chart), 4 January 2011.
// https://cdstar.eva.mpg.de/bitstreams/EAEA0-C1BF-E247-4C8F-0/Goddard2011.pdf
// This version has 64 primes, not the commonly-cited 65 — see AGENTS.md
// "Semantic Network" section for the full discussion of that discrepancy.
// Do not add/remove primes here without updating that citation.

interface PrimeSeed {
  code: string
  category: string
  englishText: string
}

const PRIMES: PrimeSeed[] = [
  // Substantives
  { code: "I", category: "Substantives", englishText: "I" },
  { code: "YOU", category: "Substantives", englishText: "YOU" },
  { code: "SOMEONE", category: "Substantives", englishText: "SOMEONE" },
  { code: "PEOPLE", category: "Substantives", englishText: "PEOPLE" },
  { code: "SOMETHING_THING", category: "Substantives", englishText: "SOMETHING~THING" },
  { code: "BODY", category: "Substantives", englishText: "BODY" },

  // Relational substantives
  { code: "KIND", category: "Relational substantives", englishText: "KIND" },
  { code: "PART", category: "Relational substantives", englishText: "PART" },

  // Determiners
  { code: "THIS_IT", category: "Determiners", englishText: "THIS~IT" },
  { code: "THE_SAME", category: "Determiners", englishText: "THE SAME" },
  { code: "OTHER_ELSE", category: "Determiners", englishText: "OTHER~ELSE" },

  // Quantifiers
  { code: "ONE", category: "Quantifiers", englishText: "ONE" },
  { code: "TWO", category: "Quantifiers", englishText: "TWO" },
  { code: "SOME", category: "Quantifiers", englishText: "SOME" },
  { code: "ALL", category: "Quantifiers", englishText: "ALL" },
  { code: "MUCH_MANY", category: "Quantifiers", englishText: "MUCH~MANY" },
  { code: "LITTLE_FEW", category: "Quantifiers", englishText: "LITTLE~FEW" },

  // Evaluators
  { code: "GOOD", category: "Evaluators", englishText: "GOOD" },
  { code: "BAD", category: "Evaluators", englishText: "BAD" },

  // Descriptors
  { code: "BIG", category: "Descriptors", englishText: "BIG" },
  { code: "SMALL", category: "Descriptors", englishText: "SMALL" },

  // Mental predicates
  { code: "THINK", category: "Mental predicates", englishText: "THINK" },
  { code: "KNOW", category: "Mental predicates", englishText: "KNOW" },
  { code: "WANT", category: "Mental predicates", englishText: "WANT" },
  { code: "FEEL", category: "Mental predicates", englishText: "FEEL" },
  { code: "SEE", category: "Mental predicates", englishText: "SEE" },
  { code: "HEAR", category: "Mental predicates", englishText: "HEAR" },

  // Speech
  { code: "SAY", category: "Speech", englishText: "SAY" },
  { code: "WORDS", category: "Speech", englishText: "WORDS" },
  { code: "TRUE", category: "Speech", englishText: "TRUE" },

  // Actions, events, movement, contact
  { code: "DO", category: "Actions, events, movement, contact", englishText: "DO" },
  { code: "HAPPEN", category: "Actions, events, movement, contact", englishText: "HAPPEN" },
  { code: "MOVE", category: "Actions, events, movement, contact", englishText: "MOVE" },
  { code: "TOUCH", category: "Actions, events, movement, contact", englishText: "TOUCH" },

  // Location, existence, possession, specification
  { code: "BE_LOCATIONAL", category: "Location, existence, possession, specification", englishText: "BE (locational)" },
  { code: "THERE_IS", category: "Location, existence, possession, specification", englishText: "THERE IS" },
  { code: "HAVE", category: "Location, existence, possession, specification", englishText: "HAVE" },
  { code: "BE_SPECIFICATIONAL", category: "Location, existence, possession, specification", englishText: "BE (specificational)" },

  // Life and death
  { code: "LIVE", category: "Life and death", englishText: "LIVE" },
  { code: "DIE", category: "Life and death", englishText: "DIE" },

  // Time
  { code: "TIME_WHEN", category: "Time", englishText: "TIME~WHEN" },
  { code: "NOW", category: "Time", englishText: "NOW" },
  { code: "BEFORE", category: "Time", englishText: "BEFORE" },
  { code: "AFTER", category: "Time", englishText: "AFTER" },
  { code: "A_LONG_TIME", category: "Time", englishText: "A LONG TIME" },
  { code: "A_SHORT_TIME", category: "Time", englishText: "A SHORT TIME" },
  { code: "FOR_SOME_TIME", category: "Time", englishText: "FOR SOME TIME" },
  { code: "MOMENT", category: "Time", englishText: "MOMENT" },

  // Space
  { code: "PLACE_WHERE", category: "Space", englishText: "PLACE~WHERE" },
  { code: "HERE", category: "Space", englishText: "HERE" },
  { code: "ABOVE", category: "Space", englishText: "ABOVE" },
  { code: "BELOW", category: "Space", englishText: "BELOW" },
  { code: "FAR", category: "Space", englishText: "FAR" },
  { code: "NEAR", category: "Space", englishText: "NEAR" },
  { code: "INSIDE", category: "Space", englishText: "INSIDE" },
  { code: "ON_ONE_SIDE", category: "Space", englishText: "ON ONE SIDE" },

  // Logical concepts
  { code: "NOT_DONT", category: "Logical concepts", englishText: "NOT~DON'T" },
  { code: "MAYBE", category: "Logical concepts", englishText: "MAYBE" },
  { code: "CAN", category: "Logical concepts", englishText: "CAN" },
  { code: "BECAUSE", category: "Logical concepts", englishText: "BECAUSE" },
  { code: "IF", category: "Logical concepts", englishText: "IF" },

  // Intensifier, augmentor
  { code: "VERY", category: "Intensifier, augmentor", englishText: "VERY" },
  { code: "MORE_ANYMORE", category: "Intensifier, augmentor", englishText: "MORE~ANYMORE" },

  // Similarity
  { code: "LIKE_WAY", category: "Similarity", englishText: "LIKE~WAY" },
]

async function main() {
  const db = await init()

  const insertPrime = db.prepare(`
    INSERT INTO semantic_primes (code, category, english_text, sort_order)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(code) DO UPDATE SET
      category = excluded.category,
      english_text = excluded.english_text,
      sort_order = excluded.sort_order
  `)

  const seedAll = db.transaction(() => {
    PRIMES.forEach((prime, index) => {
      insertPrime.run(prime.code, prime.category, prime.englishText, index + 1)
    })
  })

  seedAll()

  const count = (db.prepare(`SELECT COUNT(*) c FROM semantic_primes`).get() as { c: number }).c
  console.log(`semantic_primes seeded: ${PRIMES.length} rows in seed, ${count} rows in table.`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
