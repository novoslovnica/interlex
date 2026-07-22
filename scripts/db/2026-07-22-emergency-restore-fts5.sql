-- EMERGENCY: restores lexemes_text / lexeme_allophones_text after a failed
-- trigram migration left them dropped (production's system `sqlite3` CLI
-- doesn't support the FTS5 trigram tokenizer, even though the Next.js app's
-- bundled better-sqlite3 does — see 2026-07-22-add-indexes-and-fts5-trigram.ts
-- for the correct way to apply the trigram upgrade).
--
-- This recreates the two tables with the ORIGINAL default (unicode61)
-- tokenizer — exactly what they were before today's migration attempt — so
-- lexicon search (app/api/lexicon/services.ts) works again immediately.
-- Safe to re-run. Uses no tokenizer beyond plain FTS5, so it works with any
-- sqlite3 build that already has FTS5 (which this database clearly does,
-- since these tables existed in this form before).
--
-- Usage: sqlite3 /path/to/interlex.db < scripts/db/2026-07-22-emergency-restore-fts5.sql

BEGIN IMMEDIATE;

DROP TRIGGER IF EXISTS lexemes_text_insert;
DROP TRIGGER IF EXISTS lexemes_text_delete;
DROP TRIGGER IF EXISTS lexemes_text_update;
DROP TABLE IF EXISTS lexemes_text;

CREATE VIRTUAL TABLE lexemes_text USING FTS5(value, content=lexemes);
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

CREATE VIRTUAL TABLE lexeme_allophones_text USING FTS5(value, content=lexeme_allophones);
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

SELECT 'lexemes' AS table_name, COUNT(*) AS row_count FROM lexemes
UNION ALL SELECT 'lexemes_text', COUNT(*) FROM lexemes_text
UNION ALL SELECT 'lexeme_allophones', COUNT(*) FROM lexeme_allophones
UNION ALL SELECT 'lexeme_allophones_text', COUNT(*) FROM lexeme_allophones_text;
