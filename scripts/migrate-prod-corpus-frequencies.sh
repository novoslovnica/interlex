#!/bin/bash
# Production database migration script
# Adds corpus frequency fields to lexemes table (interlex.db / app.db)
# Creates corpus_config table (corpus.db)
# Run: bash scripts/migrate-prod-corpus-frequencies.sh [path/to/interlex.db] [path/to/corpus.db]
# Default paths: interlex.db, corpus.db

set -e

DATA_DB="${1:-interlex.db}"
CORPUS_DB="${2:-corpus.db}"

echo "=== Corpus Frequency Migration ==="
echo "Data DB:   $DATA_DB"
echo "Corpus DB: $CORPUS_DB"
echo ""

# ---- Data DB: add columns to lexemes (idempotent) ----
echo "[1/2] Adding frequency columns to lexemes table (data DB)..."
if [ ! -f "$DATA_DB" ]; then
  echo "  WARNING: Data DB not found at '$DATA_DB' — skipping."
else
  for col in corpusFrequency corpusFrequencyPerMln corpusRank corpusHapax; do
    exists=$(sqlite3 "$DATA_DB" "SELECT COUNT(*) FROM pragma_table_info('lexemes') WHERE name='$col';")
    if [ "$exists" = "0" ]; then
      echo "  -> Adding column: $col"
      case "$col" in
        corpusFrequency) sqlite3 "$DATA_DB" "ALTER TABLE lexemes ADD COLUMN corpusFrequency INTEGER;" ;;
        corpusFrequencyPerMln) sqlite3 "$DATA_DB" "ALTER TABLE lexemes ADD COLUMN corpusFrequencyPerMln REAL;" ;;
        corpusRank) sqlite3 "$DATA_DB" "ALTER TABLE lexemes ADD COLUMN corpusRank INTEGER;" ;;
        corpusHapax) sqlite3 "$DATA_DB" "ALTER TABLE lexemes ADD COLUMN corpusHapax INTEGER;" ;;
      esac
    else
      echo "  -> Column '$col' already exists, skipping."
    fi
  done
  echo "  Done."
fi
echo ""

# ---- Corpus DB: create corpus_config table (idempotent) ----
echo "[2/2] Creating corpus_config table (corpus DB)..."
if [ ! -f "$CORPUS_DB" ]; then
  echo "  WARNING: Corpus DB not found at '$CORPUS_DB' — skipping."
else
  exists=$(sqlite3 "$CORPUS_DB" "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name='corpus_config';")
  if [ "$exists" = "0" ]; then
    echo "  -> Creating table corpus_config"
    sqlite3 "$CORPUS_DB" "CREATE TABLE corpus_config (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE, value TEXT NOT NULL);"
    echo "  -> Seeding default zipf_alpha"
    sqlite3 "$CORPUS_DB" "INSERT OR IGNORE INTO corpus_config (key, value) VALUES ('zipf_alpha', '');"
  else
    echo "  -> Table 'corpus_config' already exists, skipping."
  fi
  echo "  Done."
fi
echo ""

echo "=== Migration complete ==="
echo "Next step: redeploy the application with updated Prisma client."