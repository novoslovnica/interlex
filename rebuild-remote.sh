#!/usr/bin/env bash
# Выполняется НА СЕРВЕРЕ через `ssh ... 'bash -s -- [--db=name ...] [--skip-backup]' < rebuild-remote.sh`
# из release.sh. Порядок важен:
#   бэкапы -> git pull -> npm ci -> стоп службы -> замена баз -> миграции ->
#   сборка -> старт службы -> проверка.
# Служба останавливается до `rm -rf .next` и до подмены файлов баз: сборка под
# работающим next start роняет сайт всё равно, а подменять SQLite под
# открытым соединением нельзя (WAL).
set -euo pipefail

export NVM_DIR="$HOME/.nvm"
# shellcheck disable=SC1091
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"

DBS=()
SKIP_BACKUP=0
for arg in "$@"; do
    case "$arg" in
        --db=*)        DBS+=("${arg#--db=}") ;;
        --skip-backup) SKIP_BACKUP=1 ;;
    esac
done
for db in "${DBS[@]}"; do
    [ "$db" != "auth" ] || { echo "auth.db is never replaced" >&2; exit 2; }
done

SERVICE=interslavic-lexicon.service
cd /var/www/interslavic-lexicon.com/interlex
STAMP=$(date +%F-%H%M)

echo "==> backups (.backup works with WAL; kept next to the databases)"
# auth.db всегда: её мигрируем на месте. Заменяемые базы - если не --skip-backup.
sqlite3 auth.db ".backup 'auth.db.backup-before-release-$STAMP'"
for db in "${DBS[@]}"; do
    if [ "$SKIP_BACKUP" = 1 ]; then echo "    $db.db: backup skipped (--skip-backup)"; continue; fi
    [ -f "$db.db" ] || { echo "    $db.db: not on the server yet, nothing to back up"; continue; }
    sqlite3 "$db.db" ".backup '$db.db.backup-before-release-$STAMP'"
    echo "    $db.db -> $db.db.backup-before-release-$STAMP"
done

echo "==> code"
# Старый скрипт удалял package-lock.json и делал npm i - lock мог остаться
# изменённым и мешать pull. Восстанавливаем tracked-файлы перед pull.
git checkout -- package-lock.json 2>/dev/null || true
git checkout main
git pull --ff-only
npm ci

echo "==> stopping $SERVICE"
sudo systemctl stop "$SERVICE"

for db in "${DBS[@]}"; do
    [ "$db" = corpus ] || continue
    # Правки модераторов выгружены release.sh, пока служба работала. Если с тех
    # пор их стало больше - снимок их не содержит, и замена бы их стёрла.
    [ -f corpus-manual-export.json ] || { echo "corpus-manual-export.json missing - run the corpus release through release.sh" >&2; sudo systemctl start "$SERVICE"; exit 1; }
    exported=$(node -e 'const c=JSON.parse(require("fs").readFileSync("corpus-manual-export.json","utf8")).counts; console.log(JSON.stringify(c))')
    current=$(npx tsx scripts/db/corpus-export-manual.ts --count)
    if [ "$exported" != "$current" ]; then
        echo "manual corpus edits changed since the export ($exported -> $current) - not replacing corpus.db." >&2
        echo "Re-run: bash release.sh --db=corpus --keep-snapshot" >&2
        sudo systemctl start "$SERVICE"
        exit 1
    fi
    echo "==> corpus manual edits unchanged since the export: $current"
done

for db in "${DBS[@]}"; do
    snapshot="$db-release.db"
    [ -f "$snapshot" ] || { echo "$snapshot missing on the server" >&2; sudo systemctl start "$SERVICE"; exit 1; }
    echo "==> swapping $db.db for the uploaded snapshot"
    # Владелец и права старого файла сохраняются: служба может работать не от SSH-пользователя.
    if [ -f "$db.db" ]; then OWNER=$(stat -c '%U:%G' "$db.db"); MODE=$(stat -c '%a' "$db.db"); else OWNER=""; MODE=""; fi
    rm -f "$db.db-wal" "$db.db-shm"
    mv "$snapshot" "$db.db"
    [ -z "$OWNER" ] || { sudo chown "$OWNER" "$db.db"; chmod "$MODE" "$db.db"; }
    echo "    quick_check: $(sqlite3 "$db.db" 'PRAGMA quick_check;' | head -1)"
done

echo "==> schema migrations (scripts/db/manifest.ts, registry _applied_scripts in each database)"
# Скрипты с данными здесь не запускаются - только руками: bash prod.sh run <script>.
npx tsx scripts/db/run.ts migrate || {
    # .next ещё старая: лучше поднять прежний код, чем оставить сайт лежать.
    echo "schema migration failed - starting the previous build; see logs/db-runs/" >&2
    sudo systemctl start "$SERVICE"
    exit 1
}

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
