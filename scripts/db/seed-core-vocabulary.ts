import dotenv from "dotenv"
import path from "path"
import { init } from "@/lib/sqlite"

dotenv.config({ path: path.resolve(process.cwd(), ".env.development") })

// Seeds `core_vocabulary_concepts` from two "borrowing-resistant basic
// vocabulary" reference lists. Idempotent — safe to re-run (upserts by
// `gloss`).
//
// 1. Swadesh-100 (Morris Swadesh, "The Origin and Diversification of
//    Language", ed. Joel Sherzer, 1971 — the 100-item list Swadesh reduced
//    down to in 1955 and finalized posthumously in the 1971 book). Verified
//    against two independent sources that agree on this exact ordered
//    100-item list: https://en.wikipedia.org/wiki/Swadesh_list ("Swadesh's
//    final (1971) list") and the numbered per-language tables at
//    https://en.wiktionary.org/wiki/Appendix:English_Swadesh_list.
//
// 2. Leipzig-Jakarta list (Uri Tadmor, 2009 — 100 items empirically selected
//    from the World Loanword Database, WOLD, a 41-language loanword-
//    borrowing survey that includes Russian, for maximum cross-linguistic
//    resistance to borrowing). Verified against
//    https://en.wikipedia.org/wiki/Leipzig%E2%80%93Jakarta_list (fetched
//    twice independently, identical result both times).
//
// Merging: ~60 concepts appear on both lists under matching or near-matching
// English glosses (pronoun-annotation differences like "you" vs "2nd-person
// singular pronoun (you)", slash-combined body parts like "leg/foot" vs
// "foot"). These are stored as ONE concept row with both ranks filled — a
// single Interslavic exponent covers both. This mapping is fully static (no
// runtime fuzzy-matching), so every merge decision is visible right here —
// two deliberate non-merges worth flagging:
//   - "fly": Swadesh's #64 is the VERB (to fly); Leipzig-Jakarta's #20 is the
//     NOUN (the insect) — kept as two separate concepts despite the shared
//     English spelling.
//   - "soil" (LJ #63) vs "earth" (Swadesh #79): plausibly the same sense
//     ("ground", not "the planet") but worded differently in each source and
//     not worth guessing — kept as two separate concepts rather than risk a
//     wrong merge.

const SWADESH_100: string[] = [
  "I", "you", "we", "this", "that", "who", "what", "not", "all", "many",
  "one", "two", "big", "long", "small", "woman", "man", "person", "fish", "bird",
  "dog", "louse", "tree", "seed", "leaf", "root", "bark", "skin", "flesh", "blood",
  "bone", "grease", "egg", "horn", "tail", "feather", "hair", "head", "ear", "eye",
  "nose", "mouth", "tooth", "tongue", "claw", "foot", "knee", "hand", "belly", "neck",
  "breast", "heart", "liver", "drink", "eat", "bite", "see", "hear", "know", "sleep",
  "die", "kill", "swim", "fly", "walk", "come", "lie", "sit", "stand", "give",
  "say", "sun", "moon", "star", "water", "rain", "stone", "sand", "earth", "cloud",
  "smoke", "fire", "ash", "burn", "path", "mountain", "red", "green", "yellow", "white",
  "black", "night", "hot", "cold", "full", "new", "good", "round", "dry", "name",
]

interface LeipzigJakartaItem {
  gloss: string
  /** If set, this LJ entry is the same concept as the Swadesh-100 entry with this exact gloss. */
  mergeIntoSwadeshGloss?: string
}

const LEIPZIG_JAKARTA_100: LeipzigJakartaItem[] = [
  { gloss: "fire", mergeIntoSwadeshGloss: "fire" },
  { gloss: "nose", mergeIntoSwadeshGloss: "nose" },
  { gloss: "go" },
  { gloss: "water", mergeIntoSwadeshGloss: "water" },
  { gloss: "mouth", mergeIntoSwadeshGloss: "mouth" },
  { gloss: "tongue", mergeIntoSwadeshGloss: "tongue" },
  { gloss: "blood", mergeIntoSwadeshGloss: "blood" },
  { gloss: "bone", mergeIntoSwadeshGloss: "bone" },
  { gloss: "you", mergeIntoSwadeshGloss: "you" }, // LJ source: "2nd-person singular pronoun (you)"
  { gloss: "root", mergeIntoSwadeshGloss: "root" },
  { gloss: "come", mergeIntoSwadeshGloss: "come" },
  { gloss: "breast", mergeIntoSwadeshGloss: "breast" },
  { gloss: "rain", mergeIntoSwadeshGloss: "rain" },
  { gloss: "I", mergeIntoSwadeshGloss: "I" }, // LJ source: "1st-person singular pronoun (I/me)"
  { gloss: "name", mergeIntoSwadeshGloss: "name" },
  { gloss: "louse", mergeIntoSwadeshGloss: "louse" },
  { gloss: "wing" },
  { gloss: "flesh", mergeIntoSwadeshGloss: "flesh" }, // LJ source: "flesh/meat"
  { gloss: "hand", mergeIntoSwadeshGloss: "hand" }, // LJ source: "arm/hand"
  { gloss: "fly (insect)" }, // deliberately not merged — see note above
  { gloss: "night", mergeIntoSwadeshGloss: "night" },
  { gloss: "ear", mergeIntoSwadeshGloss: "ear" },
  { gloss: "neck", mergeIntoSwadeshGloss: "neck" },
  { gloss: "far" },
  { gloss: "do" },
  { gloss: "house" },
  { gloss: "stone", mergeIntoSwadeshGloss: "stone" }, // LJ source: "stone/rock"
  { gloss: "bitter" },
  { gloss: "say", mergeIntoSwadeshGloss: "say" },
  { gloss: "tooth", mergeIntoSwadeshGloss: "tooth" },
  { gloss: "hair", mergeIntoSwadeshGloss: "hair" },
  { gloss: "big", mergeIntoSwadeshGloss: "big" },
  { gloss: "one", mergeIntoSwadeshGloss: "one" },
  { gloss: "who", mergeIntoSwadeshGloss: "who" },
  { gloss: "he/she/it" }, // 3rd-person singular pronoun — not in Swadesh-100
  { gloss: "hit" },
  { gloss: "foot", mergeIntoSwadeshGloss: "foot" }, // LJ source: "leg/foot"
  { gloss: "horn", mergeIntoSwadeshGloss: "horn" },
  { gloss: "this", mergeIntoSwadeshGloss: "this" },
  { gloss: "fish", mergeIntoSwadeshGloss: "fish" },
  { gloss: "yesterday" },
  { gloss: "drink", mergeIntoSwadeshGloss: "drink" },
  { gloss: "black", mergeIntoSwadeshGloss: "black" },
  { gloss: "navel" },
  { gloss: "stand", mergeIntoSwadeshGloss: "stand" },
  { gloss: "bite", mergeIntoSwadeshGloss: "bite" },
  { gloss: "back" },
  { gloss: "wind" },
  { gloss: "smoke", mergeIntoSwadeshGloss: "smoke" },
  { gloss: "what", mergeIntoSwadeshGloss: "what" },
  { gloss: "child" },
  { gloss: "egg", mergeIntoSwadeshGloss: "egg" },
  { gloss: "give", mergeIntoSwadeshGloss: "give" },
  { gloss: "new", mergeIntoSwadeshGloss: "new" },
  { gloss: "burn", mergeIntoSwadeshGloss: "burn" }, // LJ source: "to burn (intr.)"
  { gloss: "not", mergeIntoSwadeshGloss: "not" },
  { gloss: "good", mergeIntoSwadeshGloss: "good" },
  { gloss: "know", mergeIntoSwadeshGloss: "know" },
  { gloss: "knee", mergeIntoSwadeshGloss: "knee" },
  { gloss: "sand", mergeIntoSwadeshGloss: "sand" },
  { gloss: "laugh" },
  { gloss: "hear", mergeIntoSwadeshGloss: "hear" },
  { gloss: "soil" }, // deliberately not merged with Swadesh's "earth" — see note above
  { gloss: "leaf", mergeIntoSwadeshGloss: "leaf" },
  { gloss: "red", mergeIntoSwadeshGloss: "red" },
  { gloss: "liver", mergeIntoSwadeshGloss: "liver" },
  { gloss: "hide (verb)" },
  { gloss: "skin", mergeIntoSwadeshGloss: "skin" }, // LJ source: "skin/hide" (hide = pelt, noun)
  { gloss: "suck" },
  { gloss: "carry" },
  { gloss: "ant" },
  { gloss: "heavy" },
  { gloss: "take" },
  { gloss: "old" },
  { gloss: "eat", mergeIntoSwadeshGloss: "eat" },
  { gloss: "thigh" },
  { gloss: "thick" },
  { gloss: "long", mergeIntoSwadeshGloss: "long" },
  { gloss: "blow" },
  { gloss: "wood" },
  { gloss: "run" },
  { gloss: "fall" },
  { gloss: "eye", mergeIntoSwadeshGloss: "eye" },
  { gloss: "ash", mergeIntoSwadeshGloss: "ash" },
  { gloss: "tail", mergeIntoSwadeshGloss: "tail" },
  { gloss: "dog", mergeIntoSwadeshGloss: "dog" },
  { gloss: "cry" },
  { gloss: "tie" },
  { gloss: "see", mergeIntoSwadeshGloss: "see" },
  { gloss: "sweet" },
  { gloss: "rope" },
  { gloss: "shade" },
  { gloss: "bird", mergeIntoSwadeshGloss: "bird" },
  { gloss: "salt" },
  { gloss: "small", mergeIntoSwadeshGloss: "small" },
  { gloss: "wide" },
  { gloss: "star", mergeIntoSwadeshGloss: "star" },
  { gloss: "in" },
  { gloss: "hard" },
  { gloss: "crush" },
]

async function main() {
  if (SWADESH_100.length !== 100) {
    throw new Error(`Expected 100 Swadesh items, got ${SWADESH_100.length}`)
  }
  if (LEIPZIG_JAKARTA_100.length !== 100) {
    throw new Error(`Expected 100 Leipzig-Jakarta items, got ${LEIPZIG_JAKARTA_100.length}`)
  }

  const db = await init()

  const insertSwadesh = db.prepare(`
    INSERT INTO core_vocabulary_concepts (gloss, swadesh100Rank, leipzigJakartaRank)
    VALUES (?, ?, NULL)
    ON CONFLICT(gloss) DO UPDATE SET swadesh100Rank = excluded.swadesh100Rank
  `)
  const updateLjRank = db.prepare(`
    UPDATE core_vocabulary_concepts SET leipzigJakartaRank = ? WHERE gloss = ?
  `)
  const insertLjOnly = db.prepare(`
    INSERT INTO core_vocabulary_concepts (gloss, swadesh100Rank, leipzigJakartaRank)
    VALUES (?, NULL, ?)
    ON CONFLICT(gloss) DO UPDATE SET leipzigJakartaRank = excluded.leipzigJakartaRank
  `)

  let merged = 0
  let ljOnly = 0

  const seedAll = db.transaction(() => {
    SWADESH_100.forEach((gloss, i) => {
      insertSwadesh.run(gloss, i + 1)
    })
    LEIPZIG_JAKARTA_100.forEach((item, i) => {
      const rank = i + 1
      if (item.mergeIntoSwadeshGloss) {
        const result = updateLjRank.run(rank, item.mergeIntoSwadeshGloss)
        if (result.changes === 0) {
          throw new Error(
            `mergeIntoSwadeshGloss "${item.mergeIntoSwadeshGloss}" not found for LJ item "${item.gloss}" (rank ${rank})`,
          )
        }
        merged++
      } else {
        insertLjOnly.run(item.gloss, rank)
        ljOnly++
      }
    })
  })

  seedAll()

  const total = (db.prepare(`SELECT COUNT(*) c FROM core_vocabulary_concepts`).get() as { c: number }).c
  console.log(`Swadesh-100 seeded: 100 items`)
  console.log(`Leipzig-Jakarta seeded: 100 items (${merged} merged into existing Swadesh concepts, ${ljOnly} new)`)
  console.log(`core_vocabulary_concepts total rows: ${total} (expected ${100 + ljOnly})`)
}

main().catch((e) => {
  console.error("Fatal error:", e)
  process.exit(1)
})
