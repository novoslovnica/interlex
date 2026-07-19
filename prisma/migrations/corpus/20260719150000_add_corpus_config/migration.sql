-- Create corpus_config table for global settings
CREATE TABLE IF NOT EXISTS corpus_config (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL
);

-- Seed default zipf_alpha
INSERT OR IGNORE INTO corpus_config (key, value) VALUES ('zipf_alpha', '');
