import fs from "fs"
import path from "path"
import Database from "better-sqlite3"

// Additive/idempotent — adds the columns for the four features added to
// `prisma/data.schema.prisma` on 2026-07-26:
//   1. Lexeme.isPublic       — hide a lexeme from public search/listings
//      without deleting it (direct-link access to /words/[id] is unaffected).
//   2. Morpheme.meaning      — semantics of a prefix/suffix/root.
//   3. Morpheme.protoSlavicWordId — FK link from a morpheme to its
//      Proto-Slavic form, independent of Lexeme's free-text `proto` field.
// (The "кодифицированность" badge feature needs no schema change — it reads
// the pre-existing Lexeme.external_id.)
//
// SQLite has no `ADD COLUMN IF NOT EXISTS`, so idempotency is done by
// checking `PRAGMA table_info` before each ALTER TABLE — safe to re-run.
//
// Usage:
//   SQLITE_DB=/path/to/interlex.db npx tsx scripts/db/2026-07-26-add-ispublic-and-morpheme-fields.ts

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}\n`)

const BACKUP_PATH = path.resolve(path.dirname(DB_PATH), "interlex.db.backup-before-ispublic-morpheme-fields")
if (!fs.existsSync(BACKUP_PATH)) {
    fs.copyFileSync(DB_PATH, BACKUP_PATH)
    console.log(`Backed up DB to ${BACKUP_PATH}`)
} else {
    console.log(`Backup already exists at ${BACKUP_PATH} — skipping backup step`)
}

const db = new Database(DB_PATH)

function hasColumn(table: string, column: string): boolean {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    return cols.some((c) => c.name === column)
}

const tx = db.transaction(() => {
    if (!hasColumn("lexemes", "isPublic")) {
        console.log("--- Adding lexemes.isPublic ---")
        db.exec(`ALTER TABLE lexemes ADD COLUMN isPublic INTEGER NOT NULL DEFAULT 1`)
    } else {
        console.log("lexemes.isPublic already exists — skipping")
    }

    if (!hasColumn("morphemes", "meaning")) {
        console.log("--- Adding morphemes.meaning ---")
        db.exec(`ALTER TABLE morphemes ADD COLUMN meaning TEXT`)
    } else {
        console.log("morphemes.meaning already exists — skipping")
    }

    if (!hasColumn("morphemes", "protoSlavicWordId")) {
        console.log("--- Adding morphemes.protoSlavicWordId ---")
        db.exec(`ALTER TABLE morphemes ADD COLUMN protoSlavicWordId INTEGER`)
    } else {
        console.log("morphemes.protoSlavicWordId already exists — skipping")
    }

    console.log("--- Creating indexes (if missing) ---")
    db.exec(`CREATE INDEX IF NOT EXISTS "lexemes_isPublic_idx" ON "lexemes"("isPublic")`)
    db.exec(`CREATE INDEX IF NOT EXISTS "morphemes_protoSlavicWordId_idx" ON "morphemes"("protoSlavicWordId")`)
})

tx()

const publicCount = (db.prepare(`SELECT COUNT(*) c FROM lexemes WHERE isPublic = 1`).get() as { c: number }).c
const totalCount = (db.prepare(`SELECT COUNT(*) c FROM lexemes`).get() as { c: number }).c
console.log(`\nlexemes: ${publicCount}/${totalCount} isPublic=1`)
console.log("Done.")
db.close()
