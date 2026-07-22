import Database from "better-sqlite3"
import path from "path"

// Runs against the SAME SQLite build the Next.js app actually uses at
// runtime (via the `better-sqlite3` npm dependency), instead of the host's
// system `sqlite3` CLI binary. This matters: on at least one production
// server the system CLI's SQLite build does not have the FTS5 trigram
// tokenizer, even though better-sqlite3's bundled SQLite does — running the
// .sql version of this migration through `sqlite3 db < file.sql` failed
// there with "no such tokenizer: trigram" partway through, after the DROP
// TABLE for lexemes_text/lexeme_allophones_text had already committed,
// leaving those tables missing until scripts/db/2026-07-22-emergency-restore-fts5.sql
// was run. This script avoids that failure mode entirely by probing for
// trigram support up front, before touching any existing table.

const DB_PATH = process.env.SQLITE_DB || path.resolve(process.cwd(), "interlex.db")
console.log(`Target DB: ${DB_PATH}`)
const db = new Database(DB_PATH)

// ---------------------------------------------------------------------
// 1. Indexes — always safe, always idempotent (IF NOT EXISTS)
// ---------------------------------------------------------------------

const indexes = [
    `CREATE INDEX IF NOT EXISTS "lexemes_value_idx" ON "lexemes"("value")`,
    `CREATE INDEX IF NOT EXISTS "meanings_lexemeId_idx" ON "meanings"("lexemeId")`,

    `CREATE INDEX IF NOT EXISTS "synonyms_sourceId_idx" ON "synonyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "synonyms_targetId_idx" ON "synonyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "antonyms_sourceId_idx" ON "antonyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "antonyms_targetId_idx" ON "antonyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "hypernyms_sourceId_idx" ON "hypernyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "hypernyms_targetId_idx" ON "hypernyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "hyponyms_sourceId_idx" ON "hyponyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "hyponyms_targetId_idx" ON "hyponyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "meronyms_sourceId_idx" ON "meronyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "meronyms_targetId_idx" ON "meronyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "holonyms_sourceId_idx" ON "holonyms"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "holonyms_targetId_idx" ON "holonyms"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "related_words_sourceId_idx" ON "related_words"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "related_words_targetId_idx" ON "related_words"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "causes_sourceId_idx" ON "causes"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "causes_targetId_idx" ON "causes"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "effects_sourceId_idx" ON "effects"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "effects_targetId_idx" ON "effects"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "premises_sourceId_idx" ON "premises"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "premises_targetId_idx" ON "premises"("targetId")`,
    `CREATE INDEX IF NOT EXISTS "conclusions_sourceId_idx" ON "conclusions"("sourceId")`,
    `CREATE INDEX IF NOT EXISTS "conclusions_targetId_idx" ON "conclusions"("targetId")`,

    `CREATE INDEX IF NOT EXISTS "en_wordId_idx" ON "en"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "en_meaningId_idx" ON "en"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "ru_wordId_idx" ON "ru"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "ru_meaningId_idx" ON "ru"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "mk_wordId_idx" ON "mk"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "mk_meaningId_idx" ON "mk"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "sr_wordId_idx" ON "sr"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "sr_meaningId_idx" ON "sr"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "uk_wordId_idx" ON "uk"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "uk_meaningId_idx" ON "uk"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "bg_wordId_idx" ON "bg"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "bg_meaningId_idx" ON "bg"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "pl_wordId_idx" ON "pl"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "pl_meaningId_idx" ON "pl"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "be_wordId_idx" ON "be"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "be_meaningId_idx" ON "be"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "cs_wordId_idx" ON "cs"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "cs_meaningId_idx" ON "cs"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "sk_wordId_idx" ON "sk"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "sk_meaningId_idx" ON "sk"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "sl_wordId_idx" ON "sl"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "sl_meaningId_idx" ON "sl"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "hr_wordId_idx" ON "hr"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "hr_meaningId_idx" ON "hr"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "cu_wordId_idx" ON "cu"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "cu_meaningId_idx" ON "cu"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "de_wordId_idx" ON "de"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "de_meaningId_idx" ON "de"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "nl_wordId_idx" ON "nl"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "nl_meaningId_idx" ON "nl"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "eo_wordId_idx" ON "eo"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "eo_meaningId_idx" ON "eo"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "hsb_wordId_idx" ON "hsb"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "hsb_meaningId_idx" ON "hsb"("meaningId")`,
    `CREATE INDEX IF NOT EXISTS "dsb_wordId_idx" ON "dsb"("wordId")`,
    `CREATE INDEX IF NOT EXISTS "dsb_meaningId_idx" ON "dsb"("meaningId")`,
]

const indexTx = db.transaction(() => {
    for (const sql of indexes) db.exec(sql)
})
indexTx()
console.log(`✓ ${indexes.length} indexes applied (already-existing ones were no-ops).`)

// ---------------------------------------------------------------------
// 2. FTS5 trigram rebuild — only if this SQLite build actually supports it.
//    Probing BEFORE touching lexemes_text/lexeme_allophones_text means a
//    missing tokenizer just skips this step, it never leaves the tables
//    half-dropped the way the raw-SQL/system-CLI version could.
// ---------------------------------------------------------------------

function supportsTrigramTokenizer(): boolean {
    try {
        db.exec(`CREATE VIRTUAL TABLE temp.__trigram_probe USING fts5(x, tokenize='trigram')`)
        db.exec(`DROP TABLE temp.__trigram_probe`)
        return true
    } catch {
        return false
    }
}

if (!supportsTrigramTokenizer()) {
    console.warn(
        "⚠ This SQLite build does not support the FTS5 trigram tokenizer. " +
        "Skipping the lexemes_text/lexeme_allophones_text upgrade — they are left untouched. " +
        "Indexes above were still applied. This should not happen when run via " +
        "`npx tsx` using the project's own better-sqlite3 dependency; if it does, " +
        "upgrade the better-sqlite3 package."
    )
} else {
    function rebuildFts5Trigram(contentTable: string, ftsTable: string) {
        console.log(`Rebuilding ${ftsTable} (content=${contentTable}) with trigram tokenizer...`)

        db.exec(`DROP TRIGGER IF EXISTS ${ftsTable}_insert`)
        db.exec(`DROP TRIGGER IF EXISTS ${ftsTable}_delete`)
        db.exec(`DROP TRIGGER IF EXISTS ${ftsTable}_update`)
        db.exec(`DROP TABLE IF EXISTS ${ftsTable}`)

        db.exec(`CREATE VIRTUAL TABLE ${ftsTable} USING FTS5(value, content=${contentTable}, tokenize='trigram')`)
        db.exec(`INSERT INTO ${ftsTable}(${ftsTable}) VALUES ('rebuild')`)

        db.exec(`
      CREATE TRIGGER ${ftsTable}_insert AFTER INSERT ON ${contentTable}
      BEGIN
        INSERT INTO ${ftsTable} (rowid, value) VALUES (new.rowid, new.value);
      END
    `)
        db.exec(`
      CREATE TRIGGER ${ftsTable}_delete AFTER DELETE ON ${contentTable}
      BEGIN
        INSERT INTO ${ftsTable} (${ftsTable}, rowid, value) VALUES ('delete', old.rowid, old.value);
      END
    `)
        db.exec(`
      CREATE TRIGGER ${ftsTable}_update AFTER UPDATE ON ${contentTable}
      BEGIN
        INSERT INTO ${ftsTable} (${ftsTable}, rowid, value) VALUES ('delete', old.rowid, old.value);
        INSERT INTO ${ftsTable} (rowid, value) VALUES (new.rowid, new.value);
      END
    `)

        const contentCount = (db.prepare(`SELECT COUNT(*) c FROM ${contentTable}`).get() as { c: number }).c
        const ftsCount = (db.prepare(`SELECT COUNT(*) c FROM ${ftsTable}`).get() as { c: number }).c
        console.log(`  ${contentTable}: ${contentCount} rows, ${ftsTable}: ${ftsCount} rows`)
        if (contentCount !== ftsCount) {
            throw new Error(`Row count mismatch after rebuild for ${ftsTable}! Transaction will be rolled back.`)
        }
    }

    const ftsTx = db.transaction(() => {
        rebuildFts5Trigram("lexemes", "lexemes_text")
        rebuildFts5Trigram("lexeme_allophones", "lexeme_allophones_text")
    })
    ftsTx()
    console.log("✓ lexemes_text / lexeme_allophones_text rebuilt with trigram tokenizer.")
}

db.close()
console.log("Done.")
