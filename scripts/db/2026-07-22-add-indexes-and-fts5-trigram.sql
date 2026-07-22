-- Additive, idempotent — safe to run multiple times against the live interlex.db.
--
-- Applies the Phase 2 lexicon audit work (2026-07-22):
--   1) missing indexes on Lexeme.value, Meaning.lexemeId, all 11 relation
--      tables (sourceId/targetId), and all 18 language tables (wordId/meaningId)
--   2) rebuilds lexemes_text / lexeme_allophones_text as FTS5 tables using the
--      trigram tokenizer (was the default unicode61 tokenizer, queried with a
--      LIKE '%term%' scan that couldn't use the FTS5 index at all — see
--      ARCHITECTURE.md "Known Issues & Technical Debt")
--
-- Usage:
--   sqlite3 /path/to/interlex.db < scripts/db/2026-07-22-add-indexes-and-fts5-trigram.sql
--
-- Why this is safe to re-run:
--   - All CREATE INDEX statements use IF NOT EXISTS.
--   - The FTS5 rebuild drops and recreates only the two *_text search-index
--     tables (external-content FTS5 tables — they don't hold the real data,
--     just a search index over it) and repopulates them from the untouched
--     `lexemes` / `lexeme_allophones` base tables, inside the same
--     transaction as everything else. No row in `lexemes` or
--     `lexeme_allophones` is read, written, or deleted by this script.
--   - The whole script runs in one transaction: if any statement fails,
--     nothing is committed.
--
-- Before running against production, take a filesystem backup first anyway
-- (e.g. `cp interlex.db interlex.db.backup-$(date +%Y%m%d)`) — cheap insurance.

BEGIN IMMEDIATE;

-- ---------------------------------------------------------------------
-- 1. Indexes
-- ---------------------------------------------------------------------

CREATE INDEX IF NOT EXISTS "lexemes_value_idx" ON "lexemes"("value");
CREATE INDEX IF NOT EXISTS "meanings_lexemeId_idx" ON "meanings"("lexemeId");

CREATE INDEX IF NOT EXISTS "synonyms_sourceId_idx" ON "synonyms"("sourceId");
CREATE INDEX IF NOT EXISTS "synonyms_targetId_idx" ON "synonyms"("targetId");
CREATE INDEX IF NOT EXISTS "antonyms_sourceId_idx" ON "antonyms"("sourceId");
CREATE INDEX IF NOT EXISTS "antonyms_targetId_idx" ON "antonyms"("targetId");
CREATE INDEX IF NOT EXISTS "hypernyms_sourceId_idx" ON "hypernyms"("sourceId");
CREATE INDEX IF NOT EXISTS "hypernyms_targetId_idx" ON "hypernyms"("targetId");
CREATE INDEX IF NOT EXISTS "hyponyms_sourceId_idx" ON "hyponyms"("sourceId");
CREATE INDEX IF NOT EXISTS "hyponyms_targetId_idx" ON "hyponyms"("targetId");
CREATE INDEX IF NOT EXISTS "meronyms_sourceId_idx" ON "meronyms"("sourceId");
CREATE INDEX IF NOT EXISTS "meronyms_targetId_idx" ON "meronyms"("targetId");
CREATE INDEX IF NOT EXISTS "holonyms_sourceId_idx" ON "holonyms"("sourceId");
CREATE INDEX IF NOT EXISTS "holonyms_targetId_idx" ON "holonyms"("targetId");
CREATE INDEX IF NOT EXISTS "related_words_sourceId_idx" ON "related_words"("sourceId");
CREATE INDEX IF NOT EXISTS "related_words_targetId_idx" ON "related_words"("targetId");
CREATE INDEX IF NOT EXISTS "causes_sourceId_idx" ON "causes"("sourceId");
CREATE INDEX IF NOT EXISTS "causes_targetId_idx" ON "causes"("targetId");
CREATE INDEX IF NOT EXISTS "effects_sourceId_idx" ON "effects"("sourceId");
CREATE INDEX IF NOT EXISTS "effects_targetId_idx" ON "effects"("targetId");
CREATE INDEX IF NOT EXISTS "premises_sourceId_idx" ON "premises"("sourceId");
CREATE INDEX IF NOT EXISTS "premises_targetId_idx" ON "premises"("targetId");
CREATE INDEX IF NOT EXISTS "conclusions_sourceId_idx" ON "conclusions"("sourceId");
CREATE INDEX IF NOT EXISTS "conclusions_targetId_idx" ON "conclusions"("targetId");

CREATE INDEX IF NOT EXISTS "en_wordId_idx" ON "en"("wordId");
CREATE INDEX IF NOT EXISTS "en_meaningId_idx" ON "en"("meaningId");
CREATE INDEX IF NOT EXISTS "ru_wordId_idx" ON "ru"("wordId");
CREATE INDEX IF NOT EXISTS "ru_meaningId_idx" ON "ru"("meaningId");
CREATE INDEX IF NOT EXISTS "mk_wordId_idx" ON "mk"("wordId");
CREATE INDEX IF NOT EXISTS "mk_meaningId_idx" ON "mk"("meaningId");
CREATE INDEX IF NOT EXISTS "sr_wordId_idx" ON "sr"("wordId");
CREATE INDEX IF NOT EXISTS "sr_meaningId_idx" ON "sr"("meaningId");
CREATE INDEX IF NOT EXISTS "uk_wordId_idx" ON "uk"("wordId");
CREATE INDEX IF NOT EXISTS "uk_meaningId_idx" ON "uk"("meaningId");
CREATE INDEX IF NOT EXISTS "bg_wordId_idx" ON "bg"("wordId");
CREATE INDEX IF NOT EXISTS "bg_meaningId_idx" ON "bg"("meaningId");
CREATE INDEX IF NOT EXISTS "pl_wordId_idx" ON "pl"("wordId");
CREATE INDEX IF NOT EXISTS "pl_meaningId_idx" ON "pl"("meaningId");
CREATE INDEX IF NOT EXISTS "be_wordId_idx" ON "be"("wordId");
CREATE INDEX IF NOT EXISTS "be_meaningId_idx" ON "be"("meaningId");
CREATE INDEX IF NOT EXISTS "cs_wordId_idx" ON "cs"("wordId");
CREATE INDEX IF NOT EXISTS "cs_meaningId_idx" ON "cs"("meaningId");
CREATE INDEX IF NOT EXISTS "sk_wordId_idx" ON "sk"("wordId");
CREATE INDEX IF NOT EXISTS "sk_meaningId_idx" ON "sk"("meaningId");
CREATE INDEX IF NOT EXISTS "sl_wordId_idx" ON "sl"("wordId");
CREATE INDEX IF NOT EXISTS "sl_meaningId_idx" ON "sl"("meaningId");
CREATE INDEX IF NOT EXISTS "hr_wordId_idx" ON "hr"("wordId");
CREATE INDEX IF NOT EXISTS "hr_meaningId_idx" ON "hr"("meaningId");
CREATE INDEX IF NOT EXISTS "cu_wordId_idx" ON "cu"("wordId");
CREATE INDEX IF NOT EXISTS "cu_meaningId_idx" ON "cu"("meaningId");
CREATE INDEX IF NOT EXISTS "de_wordId_idx" ON "de"("wordId");
CREATE INDEX IF NOT EXISTS "de_meaningId_idx" ON "de"("meaningId");
CREATE INDEX IF NOT EXISTS "nl_wordId_idx" ON "nl"("wordId");
CREATE INDEX IF NOT EXISTS "nl_meaningId_idx" ON "nl"("meaningId");
CREATE INDEX IF NOT EXISTS "eo_wordId_idx" ON "eo"("wordId");
CREATE INDEX IF NOT EXISTS "eo_meaningId_idx" ON "eo"("meaningId");
CREATE INDEX IF NOT EXISTS "hsb_wordId_idx" ON "hsb"("wordId");
CREATE INDEX IF NOT EXISTS "hsb_meaningId_idx" ON "hsb"("meaningId");
CREATE INDEX IF NOT EXISTS "dsb_wordId_idx" ON "dsb"("wordId");
CREATE INDEX IF NOT EXISTS "dsb_meaningId_idx" ON "dsb"("meaningId");

-- ---------------------------------------------------------------------
-- 2. FTS5 trigram rebuild (search index only — base tables untouched)
-- ---------------------------------------------------------------------

DROP TRIGGER IF EXISTS lexemes_text_insert;
DROP TRIGGER IF EXISTS lexemes_text_delete;
DROP TRIGGER IF EXISTS lexemes_text_update;
DROP TABLE IF EXISTS lexemes_text;

CREATE VIRTUAL TABLE lexemes_text USING FTS5(value, content=lexemes, tokenize='trigram');
INSERT INTO lexemes_text(lexemes_text) VALUES ('rebuild');

CREATE TRIGGER lexemes_text_insert AFTER INSERT ON lexemes
BEGIN
  INSERT INTO lexemes_text (rowid, value) VALUES (new.rowid, new.value);
END;
CREATE TRIGGER lexemes_text_delete AFTER DELETE ON lexemes
BEGIN
  INSERT INTO lexemes_text (lexemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;
CREATE TRIGGER lexemes_text_update AFTER UPDATE ON lexemes
BEGIN
  INSERT INTO lexemes_text (lexemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
  INSERT INTO lexemes_text (rowid, value) VALUES (new.rowid, new.value);
END;

DROP TRIGGER IF EXISTS lexeme_allophones_text_insert;
DROP TRIGGER IF EXISTS lexeme_allophones_text_delete;
DROP TRIGGER IF EXISTS lexeme_allophones_text_update;
DROP TABLE IF EXISTS lexeme_allophones_text;

CREATE VIRTUAL TABLE lexeme_allophones_text USING FTS5(value, content=lexeme_allophones, tokenize='trigram');
INSERT INTO lexeme_allophones_text(lexeme_allophones_text) VALUES ('rebuild');

CREATE TRIGGER lexeme_allophones_text_insert AFTER INSERT ON lexeme_allophones
BEGIN
  INSERT INTO lexeme_allophones_text (rowid, value) VALUES (new.rowid, new.value);
END;
CREATE TRIGGER lexeme_allophones_text_delete AFTER DELETE ON lexeme_allophones
BEGIN
  INSERT INTO lexeme_allophones_text (lexeme_allophones_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;
CREATE TRIGGER lexeme_allophones_text_update AFTER UPDATE ON lexeme_allophones
BEGIN
  INSERT INTO lexeme_allophones_text (lexeme_allophones_text, rowid, value) VALUES ('delete', old.rowid, old.value);
  INSERT INTO lexeme_allophones_text (rowid, value) VALUES (new.rowid, new.value);
END;

COMMIT;

-- ---------------------------------------------------------------------
-- 3. Verification — row counts of each *_text table must equal their
--    base table. Eyeball this after running.
-- ---------------------------------------------------------------------

SELECT 'lexemes' AS table_name, COUNT(*) AS row_count FROM lexemes
UNION ALL SELECT 'lexemes_text', COUNT(*) FROM lexemes_text
UNION ALL SELECT 'lexeme_allophones', COUNT(*) FROM lexeme_allophones
UNION ALL SELECT 'lexeme_allophones_text', COUNT(*) FROM lexeme_allophones_text
UNION ALL SELECT 'total_indexes', COUNT(*) FROM sqlite_master WHERE type = 'index';
