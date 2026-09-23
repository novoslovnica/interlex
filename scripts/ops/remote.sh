# shellcheck shell=bash
# Общее для скриптов, которые ходят на прод (release.sh, prod.sh,
# scripts/local/pull-prod.sh). Подключается через `. scripts/ops/remote.sh`
# из корня репозитория, под bash (не zsh: там USERNAME - специальная
# переменная, и присвоение из .env.release молча игнорируется).
# Требует .env.release с USERNAME / PASSWORD / HOST.

REMOTE_DIR=${REMOTE_DIR:-/var/www/interslavic-lexicon.com/interlex}

[ -f .env.release ] || { echo ".env.release not found (run from the repository root)" >&2; exit 2; }
SSH_USER=$(grep '^USERNAME=' .env.release | cut -d= -f2-)
SSH_PASS=$(grep '^PASSWORD=' .env.release | cut -d= -f2-)
SSH_HOST=$(grep '^HOST=' .env.release | cut -d= -f2-)
[ -n "$SSH_USER" ] && [ -n "$SSH_PASS" ] && [ -n "$SSH_HOST" ] || { echo ".env.release must set USERNAME, PASSWORD, HOST" >&2; exit 2; }

ssh_run() { sshpass -f <(printf '%s\n' "$SSH_PASS") ssh -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" "$@"; }
scp_to()  { sshpass -f <(printf '%s\n' "$SSH_PASS") scp "$@" ; }
remote()  { echo "$SSH_USER@$SSH_HOST:$1"; }

# Команда в каталоге приложения на сервере, с node из nvm (как в rebuild-remote.sh).
# Аргументы экранируются: remote_app npx tsx scripts/db/run.ts run "$path" --apply
remote_app() {
    local cmd
    cmd=$(printf '%q ' "$@")
    ssh_run "export NVM_DIR=\"\$HOME/.nvm\"; [ -s \"\$NVM_DIR/nvm.sh\" ] && . \"\$NVM_DIR/nvm.sh\"; cd $REMOTE_DIR && $cmd"
}

# Сервер делает git pull с origin/main: незапушенное на прод не попадёт.
require_pushed_main() {
    git fetch -q origin main
    local ahead branch
    ahead=$(git rev-list --count origin/main..HEAD)
    branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$branch" != "main" ] || [ "$ahead" != "0" ]; then
        echo "branch=$branch, commits ahead of origin/main: $ahead - push first (git push origin main)" >&2
        exit 2
    fi
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        echo "uncommitted changes in tracked files - commit or stash first" >&2
        exit 2
    fi
}
