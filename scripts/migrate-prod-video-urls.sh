#!/bin/bash
# Production database migration script
# Adds videoUrls column to LibraryEntry table (library.db)
# Run: bash scripts/migrate-prod-video-urls.sh

set -e

DB_PATH="${1:-library.db}"

if [ ! -f "$DB_PATH" ]; then
  echo "Error: Database not found at $DB_PATH"
  echo "Usage: $0 [path/to/library.db]"
  echo "Default: library.db"
  exit 1
fi

echo "Applying migration: add videoUrls column to LibraryEntry..."
sqlite3 "$DB_PATH" "ALTER TABLE LibraryEntry ADD COLUMN \"videoUrls\" TEXT;"
echo "Done. Column 'videoUrls' added successfully."
echo ""
echo "Next step: redeploy the application with the updated Prisma client."