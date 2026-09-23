#!/usr/bin/env bash
# Выполняется НА СЕРВЕРЕ через `ssh ... 'bash -s -- [--with-data]' < rebuild-remote.sh`
# из release.sh. Порядок важен:
#   бэкапы -> git pull -> npm ci -> стоп службы -> (замена interlex.db) ->
#   миграции -> сборка -> старт службы -> проверка.
# Служба останавливается до `rm -rf .next` и до подмены файла базы: сборка
# под работающим next start роняет сайт всё равно, а подменять SQLite под
# открытым соединением нельзя (WAL).
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

WITH_DATA=0
for arg in "$@"; do [ "$arg" = "--with-data" ] && WITH_DATA=1; done

SERVICE=interslavic-lexicon.service
cd /var/www/interslavic-lexicon.com/interlex
STAMP=$(date +%F-%H%M)

echo "==> backups (.backup works with WAL; kept next to the databases)"
sqlite3 interlex.db ".backup 'interlex.db.backup-before-release-$STAMP'"
sqlite3 auth.db ".backup 'auth.db.backup-before-release-$STAMP'"

echo "==> code"
# Старый скрипт удалял package-lock.json и делал npm i - lock мог остаться
# изменённым и мешать pull. Восстанавливаем tracked-файлы перед pull.
git checkout -- package-lock.json 2>/dev/null || true
git checkout main
git pull --ff-only
npm ci

echo "==> stopping $SERVICE"
sudo systemctl stop "$SERVICE"

if [ "$WITH_DATA" = 1 ]; then
    [ -f interlex-release.db ] || { echo "interlex-release.db missing on the server" >&2; sudo systemctl start "$SERVICE"; exit 1; }
    echo "==> swapping interlex.db for the uploaded snapshot"
    # Владелец и права старого файла сохраняются: служба может работать не от SSH-пользователя.
    OWNER=$(stat -c '%U:%G' interlex.db); MODE=$(stat -c '%a' interlex.db)
    rm -f interlex.db-wal interlex.db-shm
    mv interlex-release.db interlex.db
    sudo chown "$OWNER" interlex.db; chmod "$MODE" interlex.db
    sqlite3 interlex.db "PRAGMA quick_check;" | head -1
fi

echo "==> migrations (idempotent; auth.db is migrated in place - it is never replaced)"
AUTH_SQLITE_DB="$PWD/auth.db" npx tsx scripts/db/2026-09-19-add-community-auth-tables.ts
# interlex.db: при --with-data уже содержит всё; без него скрипты тоже
# безопасны (каждый проверяет, применён ли).
SQLITE_DB="$PWD/interlex.db" npx tsx scripts/db/2026-09-19-add-community-translation-votes.ts
SQLITE_DB="$PWD/interlex.db" npx tsx scripts/db/2026-09-19-add-community-reputation.ts
SQLITE_DB="$PWD/interlex.db" npx tsx scripts/db/2026-09-23-add-word-comments.ts

echo "==> build"
rm -rf .next
npm run build

echo "==> starting $SERVICE"
sudo systemctl start "$SERVICE"
sleep 5
if sudo systemctl is-active --quiet "$SERVICE"; then
    echo "OK: $SERVICE is active"
else
    echo "FAILED: $SERVICE is not active" >&2
    sudo journalctl -u "$SERVICE" -n 30 --no-pager >&2
    exit 1
fi
