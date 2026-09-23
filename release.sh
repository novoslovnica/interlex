#!/usr/bin/env bash
# Релиз на прод. Запускать из корня репозитория, под bash (не zsh: там
# USERNAME - специальная переменная, и присвоение из .env.release молча
# игнорируется).
#
#   bash release.sh                         код: git pull, npm ci, миграции, сборка
#   bash release.sh --db=corpus             плюс замена corpus.db на сервере снимком локальной
#   bash release.sh --db=interlex,library   несколько баз через запятую (или флаг несколько раз)
#   bash release.sh --with-data             то же, что --db=interlex (разовая замена словаря)
#   bash release.sh --covers                плюс public/covers -> /var/www/interslavic-lexicon.com/covers/
#   bash release.sh --db=corpus --skip-backup   не делать бэкап заменяемой базы на сервере
#                                               (corpus - 5 ГБ, бэкап долгий и место)
#   bash release.sh --db=corpus --keep-snapshot  не пересоздавать corpus-release.db, взять существующий
#
# Базы: interlex, corpus, library, historical. auth - НИКОГДА (там реальные
# пользователи прода; её мигрирует rebuild-remote.sh на месте).
#
# Снимок <name>-release.db делается здесь через VACUUM INTO (cp при открытой
# базе не годится, WAL), заливается под временным именем, а подмена
# происходит на сервере при остановленной службе (rebuild-remote.sh).
#
# Требует .env.release с USERNAME / PASSWORD / HOST. Сервер делает git pull,
# поэтому сначала проверяется, что всё запушено.
set -euo pipefail
cd "$(dirname "$0")"

REMOTE_DIR=/var/www/interslavic-lexicon.com/interlex
COVERS_REMOTE=/var/www/interslavic-lexicon.com/covers/
ALLOWED_DBS="interlex corpus library historical"

DBS=()
COVERS=0
REMOTE_FLAGS=()
KEEP_SNAPSHOT=0
for arg in "$@"; do
    case "$arg" in
        --db=*)          IFS=',' read -ra part <<< "${arg#--db=}"; DBS+=("${part[@]}") ;;
        --with-data)     DBS+=(interlex) ;;
        --covers)        COVERS=1 ;;
        --skip-backup)   REMOTE_FLAGS+=(--skip-backup) ;;
        --keep-snapshot) KEEP_SNAPSHOT=1 ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done
for db in "${DBS[@]}"; do
    case " $ALLOWED_DBS " in
        *" $db "*) ;;
        *) echo "unknown database '$db' (allowed: $ALLOWED_DBS; auth.db is never uploaded)" >&2; exit 2 ;;
    esac
    [ -f "$db.db" ] || { echo "$db.db not found locally" >&2; exit 2; }
done

SSH_USER=$(grep '^USERNAME=' .env.release | cut -d= -f2-)
SSH_PASS=$(grep '^PASSWORD=' .env.release | cut -d= -f2-)
SSH_HOST=$(grep '^HOST=' .env.release | cut -d= -f2-)
[ -n "$SSH_USER" ] && [ -n "$SSH_PASS" ] && [ -n "$SSH_HOST" ] || { echo ".env.release must set USERNAME, PASSWORD, HOST" >&2; exit 2; }

ssh_run() { sshpass -f <(printf '%s\n' "$SSH_PASS") ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" "$@"; }
scp_to()  { sshpass -f <(printf '%s\n' "$SSH_PASS") scp "$@" ; }
remote()  { echo "$SSH_USER@$SSH_HOST:$1"; }

# Сервер тянет origin/main - всё, что не запушено, на прод не попадёт.
git fetch -q origin main
AHEAD=$(git rev-list --count origin/main..HEAD)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
if [ "$BRANCH" != "main" ] || [ "$AHEAD" != "0" ]; then
    echo "branch=$BRANCH, commits ahead of origin/main: $AHEAD - push first (git push origin main)" >&2
    exit 2
fi
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    echo "uncommitted changes in tracked files - commit or stash first" >&2
    exit 2
fi

echo "==> env files"
scp_to .env "$(remote "$REMOTE_DIR/.env")"
scp_to .env.production "$(remote "$REMOTE_DIR/.env.production")"

for db in "${DBS[@]}"; do
    snapshot="$db-release.db"
    if [ "$KEEP_SNAPSHOT" = 1 ] && [ -f "$snapshot" ]; then
        echo "==> reusing $snapshot ($(du -h "$snapshot" | cut -f1), $(date -r "$snapshot" '+%F %H:%M'))"
    else
        echo "==> snapshot $db.db -> $snapshot (VACUUM INTO)"
        rm -f "$snapshot"
        sqlite3 "$db.db" "VACUUM INTO '$snapshot'"
    fi
    echo "==> uploading $snapshot ($(du -h "$snapshot" | cut -f1)) - the swap happens on the server with the service stopped"
    scp_to "$snapshot" "$(remote "$REMOTE_DIR/$snapshot")"
    REMOTE_FLAGS+=("--db=$db")
done

if [ "$COVERS" = 1 ]; then
    echo "==> uploading public/covers"
    scp_to -r public/covers/. "$(remote "$COVERS_REMOTE")"
fi

echo "==> rebuild on the server"
ssh_run "bash -s -- ${REMOTE_FLAGS[*]:-}" < rebuild-remote.sh
