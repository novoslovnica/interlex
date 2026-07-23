import path from "path"
import Database from "better-sqlite3"

// Drops the 11 legacy relation tables (synonyms, antonyms, hypernyms,
// hyponyms, meronyms, holonyms, related_words, causes, effects, premises,
// conclusions), fully superseded by `semantic_relations` (2026-07-23, see
// AGENTS.md "Semantic Network"). Guarded — verified before writing this
// script that nothing in the app reads/writes these tables anymore:
//   - admin relations UI, synonyms/antonyms admin pages, word-edit page's
//     relations tab, /api/word-relations/save, word-detail page's
//     synonym/antonym query, and the second-level synonym API all migrated
//     to semantic_relations.
//   - app/admin/deduplication/actions.ts's lexeme-merge logic rewired onto
//     semantic_relations (previously updated these 2 of the 11 tables using
//     the wrong ID space — a pre-existing bug, fixed as part of this pass).
//   - The old fetchSymmetricRelations/saveSymmetricRelation helpers and the
//     old upload-synsets.ts/upload-synonyms-antonyms.ts/
//     upload-synset-relations.ts scripts (their only remaining callers) were
//     deleted.
//   - The 11 Prisma models were removed from data.schema.prisma; `npx prisma
//     generate` + `next build` both come back clean.
//
// Idempotent — DROP TABLE IF EXISTS, safe to re-run.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-23-drop-old-relation-tables.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)
const db = new Database(DB_PATH)

const OLD_TABLES = [
    "synonyms", "antonyms",
    "hypernyms", "hyponyms",
    "meronyms", "holonyms",
    "related_words",
    "causes", "effects",
    "premises", "conclusions",
]

const beforeCounts: Record<string, number> = {}
for (const table of OLD_TABLES) {
    const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(table)
    beforeCounts[table] = exists ? (db.prepare(`SELECT COUNT(*) c FROM "${table}"`).get() as { c: number }).c : -1
}
console.log("Row counts before drop (-1 = table already absent):")
console.log(beforeCounts)

const tx = db.transaction(() => {
    for (const table of OLD_TABLES) {
        db.exec(`DROP TABLE IF EXISTS "${table}"`)
        console.log(`  ${table}: dropped (or already absent)`)
    }
})

tx()

const remaining = OLD_TABLES.filter((t) =>
    db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name = ?`).get(t)
)
console.log(`\nTables remaining after drop: ${remaining.length === 0 ? "none" : remaining.join(", ")}`)
console.log("Done.")
db.close()
