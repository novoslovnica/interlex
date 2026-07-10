CREATE VIRTUAL TABLE IF NOT EXISTS "lexemes_text" USING FTS5(value, content=lexemes);

CREATE TRIGGER IF NOT EXISTS lexemes_text_insert AFTER INSERT ON lexemes
BEGIN
INSERT INTO lexemes_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE TRIGGER IF NOT EXISTS lexemes_text_delete AFTER DELETE ON lexemes
BEGIN
INSERT INTO lexemes_text (lexemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;

CREATE TRIGGER IF NOT EXISTS lexemes_text_update AFTER UPDATE ON lexemes
BEGIN
INSERT INTO lexemes_text (lexemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
INSERT INTO lexemes_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS "lexeme_allophones_text" USING FTS5(value, content=lexeme_allophones);

CREATE TRIGGER IF NOT EXISTS lexeme_allophones_text_insert AFTER INSERT ON lexeme_allophones
BEGIN
INSERT INTO lexeme_allophones_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE TRIGGER IF NOT EXISTS lexeme_allophones_text_delete AFTER DELETE ON lexeme_allophones
BEGIN
INSERT INTO lexeme_allophones_text (lexeme_allophones_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;

CREATE TRIGGER IF NOT EXISTS lexeme_allophones_text_update AFTER UPDATE ON lexeme_allophones
BEGIN
INSERT INTO lexeme_allophones_text (lexeme_allophones_text, rowid, value) VALUES ('delete', old.rowid, old.value);
INSERT INTO lexeme_allophones_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS "morphemes_text" USING FTS5(value, content=morphemes);

CREATE TRIGGER IF NOT EXISTS morphemes_text_insert AFTER INSERT ON morphemes
BEGIN
INSERT INTO morphemes_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE TRIGGER IF NOT EXISTS morphemes_text_delete AFTER DELETE ON morphemes
BEGIN
INSERT INTO morphemes_text (morphemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;

CREATE TRIGGER IF NOT EXISTS morphemes_text_update AFTER UPDATE ON morphemes
BEGIN
INSERT INTO morphemes_text (morphemes_text, rowid, value) VALUES ('delete', old.rowid, old.value);
INSERT INTO morphemes_text (rowid, value) VALUES (new.rowid, new.value);
END;

CREATE VIRTUAL TABLE IF NOT EXISTS "en_text" USING FTS5(value, content=en);

CREATE TRIGGER IF NOT EXISTS en_text_insert AFTER INSERT ON en BEGIN INSERT INTO en_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS en_text_delete AFTER DELETE ON en BEGIN INSERT INTO en_text (en_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS en_text_update AFTER UPDATE ON en BEGIN INSERT INTO en_text (en_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO en_text (rowid, value) VALUES (new.rowid, new.value); END;


CREATE VIRTUAL TABLE IF NOT EXISTS "ru_text" USING FTS5(value, content=ru);

CREATE TRIGGER IF NOT EXISTS ru_text_insert AFTER INSERT ON ru BEGIN INSERT INTO ru_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS ru_text_delete AFTER DELETE ON ru BEGIN INSERT INTO ru_text (ru_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS ru_text_update AFTER UPDATE ON ru BEGIN INSERT INTO ru_text (ru_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO ru_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "mk_text" USING FTS5(value, content=mk);

CREATE TRIGGER IF NOT EXISTS mk_text_insert AFTER INSERT ON mk BEGIN INSERT INTO mk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS mk_text_delete AFTER DELETE ON mk BEGIN INSERT INTO mk_text (mk_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS mk_text_update AFTER UPDATE ON mk BEGIN INSERT INTO mk_text (mk_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO mk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "sr_text" USING FTS5(value, content=sr);

CREATE TRIGGER IF NOT EXISTS sr_text_insert AFTER INSERT ON sr BEGIN INSERT INTO sr_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS sr_text_delete AFTER DELETE ON sr BEGIN INSERT INTO sr_text (sr_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS sr_text_update AFTER UPDATE ON sr BEGIN INSERT INTO sr_text (sr_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO sr_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "uk_text" USING FTS5(value, content=uk);

CREATE TRIGGER IF NOT EXISTS uk_text_insert AFTER INSERT ON uk BEGIN INSERT INTO uk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS uk_text_delete AFTER DELETE ON uk BEGIN INSERT INTO uk_text (uk_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS uk_text_update AFTER UPDATE ON uk BEGIN INSERT INTO uk_text (uk_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO uk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "bg_text" USING FTS5(value, content=bg);

CREATE TRIGGER IF NOT EXISTS bg_text_insert AFTER INSERT ON bg BEGIN INSERT INTO bg_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS bg_text_delete AFTER DELETE ON bg BEGIN INSERT INTO bg_text (bg_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS bg_text_update AFTER UPDATE ON bg BEGIN INSERT INTO bg_text (bg_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO bg_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "pl_text" USING FTS5(value, content=pl);

CREATE TRIGGER IF NOT EXISTS pl_text_insert AFTER INSERT ON pl BEGIN INSERT INTO pl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS pl_text_delete AFTER DELETE ON pl BEGIN INSERT INTO pl_text (pl_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS pl_text_update AFTER UPDATE ON pl BEGIN INSERT INTO pl_text (pl_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO pl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "be_text" USING FTS5(value, content=be);

CREATE TRIGGER IF NOT EXISTS be_text_insert AFTER INSERT ON be BEGIN INSERT INTO be_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS be_text_delete AFTER DELETE ON be BEGIN INSERT INTO be_text (be_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS be_text_update AFTER UPDATE ON be BEGIN INSERT INTO be_text (be_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO be_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "cs_text" USING FTS5(value, content=cs);

CREATE TRIGGER IF NOT EXISTS cs_text_insert AFTER INSERT ON cs BEGIN INSERT INTO cs_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS cs_text_delete AFTER DELETE ON cs BEGIN INSERT INTO cs_text (cs_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS cs_text_update AFTER UPDATE ON cs BEGIN INSERT INTO cs_text (cs_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO cs_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "sk_text" USING FTS5(value, content=sk);

CREATE TRIGGER IF NOT EXISTS sk_text_insert AFTER INSERT ON sk BEGIN INSERT INTO sk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS sk_text_delete AFTER DELETE ON sk BEGIN INSERT INTO sk_text (sk_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS sk_text_update AFTER UPDATE ON sk BEGIN INSERT INTO sk_text (sk_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO sk_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "sl_text" USING FTS5(value, content=sl);

CREATE TRIGGER IF NOT EXISTS sl_text_insert AFTER INSERT ON sl BEGIN INSERT INTO sl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS sl_text_delete AFTER DELETE ON sl BEGIN INSERT INTO sl_text (sl_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS sl_text_update AFTER UPDATE ON sl BEGIN INSERT INTO sl_text (sl_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO sl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "hr_text" USING FTS5(value, content=hr);

CREATE TRIGGER IF NOT EXISTS hr_text_insert AFTER INSERT ON hr BEGIN INSERT INTO hr_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS hr_text_delete AFTER DELETE ON hr BEGIN INSERT INTO hr_text (hr_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS hr_text_update AFTER UPDATE ON hr BEGIN INSERT INTO hr_text (hr_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO hr_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "hsb_text" USING FTS5(value, content=hsb);

CREATE TRIGGER IF NOT EXISTS hsb_text_insert AFTER INSERT ON hsb BEGIN INSERT INTO hsb_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS hsb_text_delete AFTER DELETE ON hsb BEGIN INSERT INTO hsb_text (hsb_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS hsb_text_update AFTER UPDATE ON hsb BEGIN INSERT INTO hsb_text (hsb_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO hsb_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "dsb_text" USING FTS5(value, content=dsb);

CREATE TRIGGER IF NOT EXISTS dsb_text_insert AFTER INSERT ON dsb BEGIN INSERT INTO dsb_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS dsb_text_delete AFTER DELETE ON dsb BEGIN INSERT INTO dsb_text (dsb_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS dsb_text_update AFTER UPDATE ON dsb BEGIN INSERT INTO dsb_text (dsb_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO dsb_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "cu_text" USING FTS5(value, content=cu);

CREATE TRIGGER IF NOT EXISTS cu_text_insert AFTER INSERT ON cu BEGIN INSERT INTO cu_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS cu_text_delete AFTER DELETE ON cu BEGIN INSERT INTO cu_text (cu_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS cu_text_update AFTER UPDATE ON cu BEGIN INSERT INTO cu_text (cu_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO cu_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "de_text" USING FTS5(value, content=de);

CREATE TRIGGER IF NOT EXISTS de_text_insert AFTER INSERT ON de BEGIN INSERT INTO de_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS de_text_delete AFTER DELETE ON de BEGIN INSERT INTO de_text (de_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS de_text_update AFTER UPDATE ON de BEGIN INSERT INTO de_text (de_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO de_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "nl_text" USING FTS5(value, content=nl);

CREATE TRIGGER IF NOT EXISTS nl_text_insert AFTER INSERT ON nl BEGIN INSERT INTO nl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS nl_text_delete AFTER DELETE ON nl BEGIN INSERT INTO nl_text (nl_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS nl_text_update AFTER UPDATE ON nl BEGIN INSERT INTO nl_text (nl_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO nl_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE VIRTUAL TABLE IF NOT EXISTS "eo_text" USING FTS5(value, content=eo);

CREATE TRIGGER IF NOT EXISTS eo_text_insert AFTER INSERT ON eo BEGIN INSERT INTO eo_text (rowid, value) VALUES (new.rowid, new.value); END;

CREATE TRIGGER IF NOT EXISTS eo_text_delete AFTER DELETE ON eo BEGIN INSERT INTO eo_text (de_text, rowid, value) VALUES ('delete', old.rowid, old.value); END;

CREATE TRIGGER IF NOT EXISTS eo_text_update AFTER UPDATE ON eo BEGIN INSERT INTO eo_text (de_text, rowid, value) VALUES ('delete', old.rowid, old.value); INSERT INTO eo_text (rowid, value) VALUES (new.rowid, new.value); END;
