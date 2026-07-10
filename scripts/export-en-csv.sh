#!/bin/bash
DB_PATH="$(dirname "$0")/../interlex.db"
OUTPUT="$(dirname "$0")/../en_translations.csv"

sqlite3 -header -csv "$DB_PATH" \
  "SELECT wordId AS lexemeId, meaningId, value FROM en WHERE value IS NOT NULL ORDER BY wordId, meaningId;" \
  > "$OUTPUT"

echo "Exported $OUTPUT"