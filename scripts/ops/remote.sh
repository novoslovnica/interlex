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

# Единый набор сетевых опций для всех обращений к проду. Хост отвечает
# нестабильно на этапе установления соединения (SYN иногда просто теряется:
# "Operation timed out" при живом порту), а релиз роняет сайт на время сборки,
# если ssh-сессия отвалится посередине, — поэтому короткий ConnectTimeout с
# повторами и keepalive вместо дефолтного двухминутного зависания.
SSH_NET_OPTS=(-o ConnectTimeout=20 -o ConnectionAttempts=3 -o ServerAliveInterval=15 -o ServerAliveCountMax=8)

ssh_run() { sshpass -f <(printf '%s\n' "$SSH_PASS") ssh "${SSH_NET_OPTS[@]}" -o StrictHostKeyChecking=accept-new "$SSH_USER@$SSH_HOST" "$@"; }
scp_to()  { sshpass -f <(printf '%s\n' "$SSH_PASS") scp "${SSH_NET_OPTS[@]}" "$@" ; }
remote()  { echo "$SSH_USER@$SSH_HOST:$1"; }

# Команда в каталоге приложения на сервере, с node из nvm (как в rebuild-remote.sh).
# Аргументы экранируются: remote_app npx tsx scripts/db/run.ts run "$path" --apply
remote_app() {
    local cmd
    cmd=$(printf '%q ' "$@")
    ssh_run "export NVM_DIR=\"\$HOME/.nvm\"; [ ! -s \"\$NVM_DIR/nvm.sh\" ] || . \"\$NVM_DIR/nvm.sh\"; export INTERLEX_ROOT='$REMOTE_DIR'; active='$REMOTE_DIR'; if [ -L '$REMOTE_DIR/current' ]; then active=\$(readlink -f '$REMOTE_DIR/current'); . \"\$active/scripts/ops/release-env.sh\"; fi; cd \"\$active\" && $cmd"
}

# Релиз закреплён за HEAD, который должен совпадать с origin/main.
require_pushed_main() {
    git fetch -q origin main
    local ahead branch
    ahead=$(git rev-list --count origin/main..HEAD)
    branch=$(git rev-parse --abbrev-ref HEAD)
    if [ "$branch" != "main" ] || [ "$(git rev-parse HEAD)" != "$(git rev-parse origin/main)" ]; then
        echo "branch=$branch, commits ahead of origin/main: $ahead - sync main with origin/main first" >&2
        exit 2
    fi
    if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
        echo "uncommitted changes in tracked files - commit or stash first" >&2
        exit 2
    fi
}
