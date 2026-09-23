#!/usr/bin/env bash
# Свежая копия продовых баз локально. Прод - главный источник данных,
# локальная база - одноразовая копия: перед тем как писать скрипт правки
# данных (или пересобирать корпус), стяните прод этим скриптом.
#
#   bash scripts/local/pull-prod.sh                    interlex
#   bash scripts/local/pull-prod.sh --db=interlex,library,corpus
#
# На сервере снимок делается через sqlite3 .backup (живая база в WAL - просто
# скопировать файл нельзя), затем scp. Прежний локальный файл уходит в
# <db>.db.backup-local-before-pull-<stamp>, хранятся два последних.
# auth.db не тянется: там персональные данные пользователей.
set -euo pipefail
cd "$(dirname "$0")/../.."
. scripts/ops/remote.sh

DBS=()
for arg in "$@"; do
    case "$arg" in
        --db=*) IFS=',' read -ra part <<< "${arg#--db=}"; DBS+=("${part[@]}") ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done
[ ${#DBS[@]} -gt 0 ] || DBS=(interlex)
for db in "${DBS[@]}"; do
    case "$db" in
        interlex|library|corpus|historical) ;;
        auth) echo "auth.db is not pulled: it holds users' personal data" >&2; exit 2 ;;
        *) echo "unknown database '$db'" >&2; exit 2 ;;
    esac
    if command -v lsof >/dev/null && lsof "$db.db" >/dev/null 2>&1; then
        echo "$db.db is open locally (dev server? a script?) - stop it first" >&2
        exit 2
    fi
done

STAMP=$(date +%Y%m%d-%H%M%S)
for db in "${DBS[@]}"; do
    echo "==> $db.db: snapshot on the server"
    ssh_run "cd $REMOTE_DIR && rm -f $db-pull.db && sqlite3 $db.db \".backup '$db-pull.db'\" && du -h $db-pull.db | cut -f1"
    echo "==> downloading"
    scp_to "$(remote "$REMOTE_DIR/$db-pull.db")" "$db-pull.db"
    ssh_run "rm -f $REMOTE_DIR/$db-pull.db"
    echo "    quick_check: $(sqlite3 "$db-pull.db" 'PRAGMA quick_check;' | head -1)"
    if [ -f "$db.db" ]; then
        mv "$db.db" "$db.db.backup-local-before-pull-$STAMP"
        echo "    previous local copy -> $db.db.backup-local-before-pull-$STAMP"
    fi
    rm -f "$db.db-wal" "$db.db-shm"
    mv "$db-pull.db" "$db.db"
    # Два последних локальных бэкапа, остальные - в корзину истории.
    ls -1 "$db.db.backup-local-before-pull-"* 2>/dev/null | sort -r | tail -n +3 | while read -r old; do rm -f "$old"; echo "    removed $old"; done || true
done
echo "done. If the schema changed on production since your last pull: npm run db:gen-data (and the others)."
