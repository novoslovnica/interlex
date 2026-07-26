import fs from "fs"
import path from "path"
import Database from "better-sqlite3"

// Canonicalizes Lexeme.gender and Lexeme.animacy to the UD (Universal Dependencies)
// feature values already used everywhere else grammemes are built/matched
// (lib/grammar/grammemes.ts's UD_GENDER/UD_ANIMACY, and the grammeme strings actually
// stored in ending_allophones, e.g. 'Case=Acc|Number=Sing|Gender=Masc|Animacy=Anim').
//
// Why this matters beyond formatting: getEnding()/buildGrammeme() build a grammeme
// string from the raw gender/animacy values and look it up by exact string match
// against ending_allophones. Lexeme.animacy is currently stored as 'ANIM' (uppercase)
// while the DB-stored override key uses 'Animacy=Anim' — the casing mismatch makes
// every animate-masculine noun's accusative singular silently fall back to the
// inanimate default ('vlk' instead of 'vlka'), on both the real word page
// (declineNoun.ts) and the corpus tokenizer path. Canonicalizing the stored value
// to 'Anim' fixes this for both, no code change required beyond this migration.
//
// Mappings:
//   Lexeme.gender (NOUN only):
//     'MASC'/'masculine'      -> 'Masc'
//     'FEM'/'feminine'        -> 'Fem'
//     'NEUT'/'neuter'         -> 'Neut'
//   Lexeme.gender (VERB, value 'verb', 804 rows as of 2026-07-26):
//     -> NULL (not a valid UD Gender value, not read by any code path — grep-confirmed
//        zero real usage; verbs have no inherent lexical gender under UD)
//   Lexeme.animacy:
//     'ANIM' -> 'Anim'
//
// Idempotent — matches on the OLD values only, so re-running after the DB is already
// canonical is a no-op (WHERE clauses on already-canonical values simply match 0 rows).
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-26-canonicalize-gender-animacy.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)

const BACKUP_PATH = path.resolve(path.dirname(DB_PATH), "interlex.db.backup-before-gender-animacy-canonicalization")
if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH)
    console.log(`Backed up DB to ${BACKUP_PATH}`)
} else {
    console.log(`Backup already exists at ${BACKUP_PATH} — skipping backup step`)
}

const db = new Database(DB_PATH)

console.log("\n--- Before ---")
console.log(db.prepare(`SELECT gender, COUNT(*) c FROM lexemes GROUP BY gender ORDER BY c DESC`).all())
console.log(db.prepare(`SELECT animacy, COUNT(*) c FROM lexemes GROUP BY animacy ORDER BY c DESC`).all())

const tx = db.transaction(() => {
    console.log("\n--- Canonicalizing NOUN gender ---")
    const genderMap: Record<string, string> = {
        MASC: "Masc",
        masculine: "Masc",
        FEM: "Fem",
        feminine: "Fem",
        NEUT: "Neut",
        neuter: "Neut",
    }
    const updateGender = db.prepare(`UPDATE lexemes SET gender = ? WHERE gender = ?`)
    for (const [oldValue, newValue] of Object.entries(genderMap)) {
        const result = updateGender.run(newValue, oldValue)
        if (result.changes > 0) {
            console.log(`  gender '${oldValue}' -> '${newValue}': ${result.changes} rows`)
        }
    }

    console.log("\n--- Nulling out non-UD gender='verb' on VERB lexemes ---")
    const nullVerbGender = db.prepare(`UPDATE lexemes SET gender = NULL WHERE gender = 'verb'`).run()
    console.log(`  gender 'verb' -> NULL: ${nullVerbGender.changes} rows`)

    console.log("\n--- Canonicalizing animacy ---")
    const animacyMap: Record<string, string> = {
        ANIM: "Anim",
        animate: "Anim",
        INAN: "Inan",
        inanimate: "Inan",
    }
    const updateAnimacy = db.prepare(`UPDATE lexemes SET animacy = ? WHERE animacy = ?`)
    for (const [oldValue, newValue] of Object.entries(animacyMap)) {
        const result = updateAnimacy.run(newValue, oldValue)
        if (result.changes > 0) {
            console.log(`  animacy '${oldValue}' -> '${newValue}': ${result.changes} rows`)
        }
    }
})

tx()

console.log("\n--- After ---")
console.log(db.prepare(`SELECT gender, COUNT(*) c FROM lexemes GROUP BY gender ORDER BY c DESC`).all())
console.log(db.prepare(`SELECT animacy, COUNT(*) c FROM lexemes GROUP BY animacy ORDER BY c DESC`).all())

console.log("\nDone.")
db.close()
