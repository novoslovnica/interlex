#!/usr/bin/env bash
# Релиз на прод. Запускать из корня репозитория, под bash (не zsh: там
# USERNAME - специальная переменная, и присвоение из .env.release молча
# игнорируется).
#
#   bash release.sh              - только код (git pull, npm ci, миграции, сборка)
#   bash release.sh --with-data  - плюс замена interlex.db снимком interlex-release.db
#
# Снимок делается заранее и ТОЛЬКО так (cp при открытой базе не годится, WAL):
#   sqlite3 interlex.db "VACUUM INTO 'interlex-release.db'"
# auth.db никогда не копируется: там реальные пользователи прода, её
# мигрирует rebuild-remote.sh на месте. corpus.db и library.db не входят.
#
# Требует .env.release с USERNAME / PASSWORD / HOST и незапушенных коммитов не
# оставляет: сервер делает git pull, поэтому сначала проверяется, что локальная
# ветка не впереди origin.
set -euo pipefail
cd "$(dirname "$0")"

WITH_DATA=0
for arg in "$@"; do
    case "$arg" in
        --with-data) WITH_DATA=1 ;;
        *) echo "unknown argument: $arg" >&2; exit 2 ;;
    esac
done

SSH_USER=$(grep '^USERNAME=' .env.release | cut -d= -f2-)
SSH_PASS=$(grep '^PASSWORD=' .env.release | cut -d= -f2-)
SSH_HOST=$(grep '^HOST=' .env.release | cut -d= -f2-)
[ -n "$SSH_USER" ] && [ -n "$SSH_PASS" ] && [ -n "$SSH_HOST" ] || { echo ".env.release must set USERNAME, PASSWORD, HOST" >&2; exit 2; }
REMOTE_DIR=/var/www/interslavic-lexicon.com/interlex

ssh_run() { sshpass -f <(printf '%s\n' "$SSH_PASS") ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" "$@"; }
scp_to()  { sshpass -f <(printf '%s\n' "$SSH_PASS") scp "$1" "$SSH_USER@$SSH_HOST:$2"; }

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
scp_to .env "$REMOTE_DIR/.env"
scp_to .env.production "$REMOTE_DIR/.env.production"

if [ "$WITH_DATA" = 1 ]; then
    [ -f interlex-release.db ] || { echo "interlex-release.db not found - make it: sqlite3 interlex.db \"VACUUM INTO 'interlex-release.db'\"" >&2; exit 2; }
    echo "==> uploading interlex-release.db ($(du -h interlex-release.db | cut -f1)) - the swap happens on the server with the service stopped"
    scp_to interlex-release.db "$REMOTE_DIR/interlex-release.db"
fi

echo "==> rebuild on the server"
ssh_run "bash -s -- $([ "$WITH_DATA" = 1 ] && echo --with-data)" < rebuild-remote.sh
