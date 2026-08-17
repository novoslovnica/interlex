import fs from "fs"
import path from "path"
import Database from "better-sqlite3"

// Adds the schema support for the root-morpheme cleanup / Proto-Slavic
// linking / new-root-discovery pipeline (scripts/roots-discovery/*):
//   - Morpheme gets quality-flag fields (rerunnable audit of broken/
//     mislabeled root nests) and protoSuggestion* fields (cached best-guess
//     Proto-Slavic match for the /admin/roots review queue). protoSlavicWordId
//     itself is untouched and stays the sole source of truth for a CONFIRMED
//     link.
//   - New root_discovery_proposals table stages brand-new root nests
//     proposed by clustering currently-unlinked lexemes (see
//     scripts/roots-discovery/discover-new-roots.ts), modeled on
//     CorpusCandidateProposal's reimport-safety shape: regeneration may
//     refresh member/occurrence/suggestion fields but must never touch
//     `status` once a moderator has decided.
//
// Raw SQL rather than `prisma migrate dev`, per CLAUDE.md: that command
// detects drift on this schema (morpheme_allophones/proto_slavic_words) and
// offers to reset the DB. Idempotent — safe to re-run.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-08-16-add-root-discovery-tables.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)

const BACKUP_PATH = path.resolve(path.dirname(DB_PATH), "interlex.db.backup-before-root-discovery")
if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH)
    console.log(`Backed up DB to ${BACKUP_PATH}`)
} else {
    console.log(`Backup already exists at ${BACKUP_PATH} — skipping backup step`)
}

const db = new Database(DB_PATH)

const MORPHEME_COLUMNS: Array<[name: string, ddl: string]> = [
    ["qualityFlag", "TEXT"],
    ["qualityFlagSuggestedValue", "TEXT"],
    ["qualityFlagDetails", "TEXT"],
    ["qualityFlagStatus", "TEXT"],
    ["qualityFlaggedAt", "DATETIME"],
    ["qualityFlagReviewedByUserId", "TEXT"],
    ["qualityFlagReviewedAt", "DATETIME"],
    ["protoSuggestionId", "INTEGER REFERENCES proto_slavic_words(id)"],
    ["protoSuggestionScore", "REAL"],
    ["protoSuggestionStatus", "TEXT"],
    ["protoSuggestionReviewedByUserId", "TEXT"],
    ["protoSuggestionReviewedAt", "DATETIME"],
]

const tx = db.transaction(() => {
    console.log("--- Adding Morpheme quality-flag / proto-suggestion columns (if missing) ---")
    const existingColumns = new Set(
        (db.prepare(`PRAGMA table_info("morphemes")`).all() as Array<{ name: string }>).map((c) => c.name)
    )
    for (const [name, ddl] of MORPHEME_COLUMNS) {
        if (existingColumns.has(name)) {
            console.log(`(morphemes.${name} already present, skipping)`)
            continue
        }
        db.exec(`ALTER TABLE morphemes ADD COLUMN "${name}" ${ddl}`)
        console.log(`Added morphemes.${name}`)
    }

    db.exec(`CREATE INDEX IF NOT EXISTS morphemes_qualityFlagStatus_idx ON morphemes(qualityFlagStatus)`)
    db.exec(`CREATE INDEX IF NOT EXISTS morphemes_protoSuggestionStatus_idx ON morphemes(protoSuggestionStatus)`)
    db.exec(`CREATE INDEX IF NOT EXISTS morphemes_protoSuggestionId_idx ON morphemes(protoSuggestionId)`)

    console.log("\n--- Creating root_discovery_proposals table (if missing) ---")
    db.exec(`
        CREATE TABLE IF NOT EXISTS root_discovery_proposals (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            clusterKey TEXT NOT NULL,
            proposedValue TEXT NOT NULL,
            method TEXT NOT NULL,
            strippedPrefix TEXT,
            strippedSuffix TEXT,
            memberLexemeIds TEXT NOT NULL,
            occurrenceCount INTEGER NOT NULL DEFAULT 0,
            exampleLexemeIds TEXT NOT NULL,
            protoSuggestionId INTEGER REFERENCES proto_slavic_words(id),
            protoSuggestionScore REAL,
            status TEXT NOT NULL DEFAULT 'pending',
            createdMorphemeId INTEGER,
            resolutionNote TEXT,
            reviewedByUserId TEXT,
            reviewedAt DATETIME,
            firstSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            lastSeenAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
    `)
    db.exec(
        `CREATE UNIQUE INDEX IF NOT EXISTS root_discovery_proposals_clusterKey_method_idx ON root_discovery_proposals(clusterKey, method)`
    )
    db.exec(
        `CREATE INDEX IF NOT EXISTS root_discovery_proposals_status_occurrenceCount_idx ON root_discovery_proposals(status, occurrenceCount)`
    )
})

tx()

console.log("\n--- Verification ---")
const columnsAfter = new Set(
    (db.prepare(`PRAGMA table_info("morphemes")`).all() as Array<{ name: string }>).map((c) => c.name)
)
console.log(`All morpheme columns present: ${MORPHEME_COLUMNS.every(([name]) => columnsAfter.has(name))}`)
const tableExists = db
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='root_discovery_proposals'`)
    .get()
console.log(`root_discovery_proposals table exists: ${!!tableExists}`)
console.log("Done.")
db.close()
