# shellcheck shell=bash
# Source after setting INTERLEX_ROOT. Never source dotenv files as shell code.
export DB_DIR="$INTERLEX_ROOT"
export SQLITE_DB="$DB_DIR/interlex.db" DATA_SQLITE_DB="$DB_DIR/interlex.db"
export AUTH_SQLITE_DB="$DB_DIR/auth.db" LIBRARY_SQLITE_DB="$DB_DIR/library.db"
export CORPUS_SQLITE_DB="$DB_DIR/corpus.db" CORPUS_DB="$DB_DIR/corpus.db"
export HISTORICAL_SQLITE_DB="$DB_DIR/historical.db"
export DATA_DATABASE_URL="file:$DB_DIR/interlex.db" AUTH_DATABASE_URL="file:$DB_DIR/auth.db"
export LIBRARY_DATABASE_URL="file:$DB_DIR/library.db" CORPUS_DATABASE_URL="file:$DB_DIR/corpus.db"
export HISTORICAL_DATABASE_URL="file:$DB_DIR/historical.db"
# Media/download defaults are shared symlinks in each release (public/*, exports).
# Do not set COVERS_DIR/AUDIO_DIR/HUNSPELL_OUT_DIR here: Next loads configured
# production values from dotenv; overriding them would hide existing uploads.
