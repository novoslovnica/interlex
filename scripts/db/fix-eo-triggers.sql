DROP TRIGGER IF EXISTS eo_text_delete;
DROP TRIGGER IF EXISTS eo_text_update;

CREATE TRIGGER eo_text_delete AFTER DELETE ON eo
BEGIN
  INSERT INTO eo_text (eo_text, rowid, value) VALUES ('delete', old.rowid, old.value);
END;

CREATE TRIGGER eo_text_update AFTER UPDATE ON eo
BEGIN
  INSERT INTO eo_text (eo_text, rowid, value) VALUES ('delete', old.rowid, old.value);
  INSERT INTO eo_text (rowid, value) VALUES (new.rowid, new.value);
END;