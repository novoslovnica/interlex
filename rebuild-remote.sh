#!/usr/bin/env bash
# Run detached by release.sh. The control checkout and shared data stay at ROOT;
# each immutable worktree gets its own node_modules, generated clients and .next.
set -Eeuo pipefail
export NVM_DIR="$HOME/.nvm"
[ ! -s "$NVM_DIR/nvm.sh" ] || . "$NVM_DIR/nvm.sh"
INTERLEX_ROOT=${INTERLEX_ROOT:-/var/www/interslavic-lexicon.com/interlex}
SERVICE=${INTERLEX_SERVICE:-interslavic-lexicon.service}
HEALTH_URL=${INTERLEX_HEALTH_URL:-http://127.0.0.1:3010/api/health}
HEALTH_ATTEMPTS=${INTERLEX_HEALTH_ATTEMPTS:-30}
PUBLIC_URL=${INTERLEX_PUBLIC_URL-https://www.interslavic-lexicon.com}
COMMIT= STAGE= ROLLBACK=0
DBS=()
for arg in "$@"; do
    case "$arg" in
        --commit=*) COMMIT=${arg#--commit=} ;;
        --stage=*) STAGE=${arg#--stage=} ;;
        --db=interlex|--db=library|--db=corpus|--db=historical) DBS+=("${arg#--db=}") ;;
        --rollback) ROLLBACK=1 ;;
        *) echo "unknown/unsafe argument: $arg" >&2; exit 2 ;;
    esac
done
cd "$INTERLEX_ROOT"
mkdir -p .releases .deploy logs/releases logs/db-runs
# Kernel lock is released even after SIGKILL. One build/cutover per host.
exec 9> .deploy/release.lock
flock -n 9 || { echo 'another deployment is running' >&2; exit 2; }
PREVIOUS= TARGET= BACKUPS= STOPPED=0 SWITCHED=0 RESTORE_DB=0 DB_LOCK=0
atomic_link() {
    local target=$1 link=$2
    ln -s "$target" "$link.next-$$" &&
    mv -Tf "$link.next-$$" "$link"
}
ready() {
    local expected=$1 body attempt
    for ((attempt=1; attempt<=HEALTH_ATTEMPTS; attempt++)); do
        if sudo systemctl is-active --quiet "$SERVICE"; then
            if [ "$expected" = legacy ]; then
                curl -fsS --max-time 5 "${HEALTH_URL%/api/health}/" >/dev/null && return 0
            else
                body=$(curl -fsS --max-time 5 "$HEALTH_URL") &&
                    printf '%s' "$body" | node -e '
                        let s="";process.stdin.on("data",d=>s+=d);process.stdin.on("end",()=>{
                            try { const v=JSON.parse(s); process.exit(v.status==="ok" && v.release===process.argv[1]?0:1) }
                            catch { process.exit(1) }
                        })' "$expected" && return 0
            fi
        fi
        sleep 2
    done
    return 1
}
finish() {
    local result=$? db backup failed=0 expected
    trap - EXIT INT TERM HUP
    if [ "$result" != 0 ] && [ "$STOPPED" = 1 ]; then
        echo '==> deployment failed; recovering previous release' >&2
        if [ "$RESTORE_DB" = 0 ]; then
            echo "candidate startup attempted: shared databases are retained; code-only rollback (backups: $BACKUPS)" >&2
        fi
        # Never restore a database after the candidate could have accepted writes.
        if sudo systemctl stop "$SERVICE"; then
            if [ "$RESTORE_DB" = 1 ] && [ -n "$BACKUPS" ]; then
                for backup in "$BACKUPS"/*.db; do
                    [ -f "$backup" ] || continue
                    db=$(basename "$backup")
                    if cp -p "$backup" "$INTERLEX_ROOT/$db.restore-$$" &&
                        sudo chown --reference="$backup" "$INTERLEX_ROOT/$db.restore-$$" &&
                        rm -f "$INTERLEX_ROOT/$db-wal" "$INTERLEX_ROOT/$db-shm" &&
                        mv -f "$INTERLEX_ROOT/$db.restore-$$" "$INTERLEX_ROOT/$db"; then
                        echo "restored $db (candidate never started)"
                    else failed=1; fi
                done
            fi
            if [ "$failed" = 0 ]; then
                if [ "$SWITCHED" = 1 ]; then atomic_link "$PREVIOUS" "$INTERLEX_ROOT/current" || failed=1; fi
                expected=$(git -C "$PREVIOUS" rev-parse HEAD)
                [ ! -f "$PREVIOUS/.legacy-release" ] || expected=legacy
                if [ "$failed" = 0 ] && sudo systemctl start "$SERVICE" && ready "$expected"; then
                    echo "ROLLBACK OK: $PREVIOUS" >&2
                else failed=1; fi
            fi
        else failed=1; fi
        if [ "$failed" = 1 ]; then
            echo 'CRITICAL: automatic recovery failed; service/data require inspection' >&2
            sudo journalctl -u "$SERVICE" -n 40 --no-pager >&2 || true
        fi
    fi
    if [ "$DB_LOCK" = 1 ]; then rm -f "$INTERLEX_ROOT/.db-run.lock"; fi
    exit "$result"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
# Detached deploys survive SSH hangup; don't ignore an explicit TERM/INT.
trap '' HUP

if [ "$ROLLBACK" = 1 ]; then
    [ ${#DBS[@]} = 0 ] || { echo 'rollback does not replace databases' >&2; exit 2; }
    PREVIOUS=$(readlink -f "$INTERLEX_ROOT/current")
    TARGET=$(readlink -f "$INTERLEX_ROOT/previous")
    [ -d "$PREVIOUS" ] && [ -d "$TARGET" ] && [ -f "$TARGET/.next/BUILD_ID" ] || exit 2
    COMMIT=$(git -C "$TARGET" rev-parse HEAD)
else
    [[ "$COMMIT" =~ ^[a-f0-9]{40}$ ]] || { echo '--commit=<full sha> required' >&2; exit 2; }
    [[ "$STAGE" = "$INTERLEX_ROOT/.deploy/"* ]] && [ -d "$STAGE" ] || { echo 'invalid stage' >&2; exit 2; }
    [ -z "$(git status --porcelain --untracked-files=no)" ] || { echo 'control checkout is dirty' >&2; exit 2; }
    git fetch origin main
    git cat-file -e "$COMMIT^{commit}"
    git merge-base --is-ancestor "$COMMIT" origin/main
    git merge-base --is-ancestor HEAD "$COMMIT"
    TARGET="$INTERLEX_ROOT/.releases/$(date -u +%Y%m%dT%H%M%S)-${COMMIT:0:12}-$$"
    git worktree add --detach "$TARGET" "$COMMIT"
    # Shared paths are not copied and not uploaded from the developer's machine.
    for envfile in .env .env.local .env.production .env.production.local; do
        [ ! -f "$INTERLEX_ROOT/$envfile" ] || ln -s "$INTERLEX_ROOT/$envfile" "$TARGET/$envfile"
    done
    mkdir -p "$INTERLEX_ROOT/exports" "$INTERLEX_ROOT/public/covers" "$INTERLEX_ROOT/public/audio"
    ln -s "$INTERLEX_ROOT/logs" "$TARGET/logs"
    ln -s "$INTERLEX_ROOT/exports" "$TARGET/exports"
    for media in covers audio; do ln -s "$INTERLEX_ROOT/public/$media" "$TARGET/public/$media"; done
    . "$TARGET/scripts/ops/release-env.sh"
    cd "$TARGET"
    export RELEASE_COMMIT=$COMMIT
    free_kb=$(df -Pk "$INTERLEX_ROOT" | awk 'END {print $4}')
    [ "$free_kb" -ge 2097152 ] || { echo 'less than 2 GiB free for isolated build' >&2; exit 1; }
    echo "==> isolated build: $TARGET (service remains online)"
    npm ci
    for kind in auth data library corpus historical; do DB_TYPE=$kind npx prisma generate; done
    npm run build
    [ -s .next/BUILD_ID ]
    # Validate all uploaded SQLite snapshots before stopping the app.
    for db in "${DBS[@]}"; do
        [ -f "$STAGE/$db-release.db" ]
        [ "$(sqlite3 "$STAGE/$db-release.db" 'PRAGMA quick_check;')" = ok ]
    done
    if [ -L "$INTERLEX_ROOT/current" ]; then
        PREVIOUS=$(readlink -f "$INTERLEX_ROOT/current")
    else
        # Bootstrap without changing systemd: its npm --prefix ROOT run start
        # picks up the launcher. Preserve the original build/deps as fallback.
        PREVIOUS="$INTERLEX_ROOT/.releases/legacy-$(git -C "$INTERLEX_ROOT" rev-parse --short HEAD)-$$"
        git -C "$INTERLEX_ROOT" worktree add --detach "$PREVIOUS" HEAD
        ln -s "$INTERLEX_ROOT/node_modules" "$PREVIOUS/node_modules"
        ln -s "$INTERLEX_ROOT/.next" "$PREVIOUS/.next"
        ln -s "$INTERLEX_ROOT/prisma/generated" "$PREVIOUS/prisma/generated"
        cp "$TARGET/scripts/ops/release-env.sh" "$PREVIOUS/scripts/ops/release-env.sh"
        for shared in .env .env.local .env.production .env.production.local logs exports; do
            [ ! -e "$INTERLEX_ROOT/$shared" ] || ln -s "$INTERLEX_ROOT/$shared" "$PREVIOUS/$shared"
        done
        for media in covers audio; do ln -s "$INTERLEX_ROOT/public/$media" "$PREVIOUS/public/$media"; done
        touch "$PREVIOUS/.legacy-release"
        atomic_link "$PREVIOUS" "$INTERLEX_ROOT/current"
    fi
fi

# Refuse a running data job before stopping the service; the runner inherits this
# PID lock. External/offline writers must also be stopped for migrations/swaps.
(set -o noclobber; printf '%s\n' "$$" > "$INTERLEX_ROOT/.db-run.lock") || {
    echo '.db-run.lock exists; finish the data job (or inspect stale PID) first' >&2; exit 2;
}
DB_LOCK=1
export DB_RUN_LOCK_OWNER=$$
. "$TARGET/scripts/ops/release-env.sh"
cd "$TARGET"
if [ "$ROLLBACK" = 0 ]; then
    pending=$(npx tsx scripts/db/run.ts pending-schema)
else pending=; fi
if [ "$ROLLBACK" = 0 ]; then
    # Reserve space for a deployment snapshot and the registry runner's own backup.
    affected=$(printf '%s\n' "$pending" "${DBS[@]}" | sed '/^$/d' | sort -u)
    needed=1048576
    for db in $affected; do
        size=$(wc -c < "$INTERLEX_ROOT/$db.db")
        needed=$((needed + 2 * (size / 1024 + 1)))
    done
    free_kb=$(df -Pk "$INTERLEX_ROOT" | awk 'END {print $4}')
    [ "$free_kb" -ge "$needed" ] || { echo 'insufficient free space for rollback backups' >&2; exit 1; }
fi
# Set before stop: a failed/partial stop must also trigger recovery.
STOPPED=1
sudo systemctl stop "$SERVICE"
if [ "$ROLLBACK" = 0 ]; then
    for db in "${DBS[@]}"; do
        [ "$db" = corpus ] || continue
        exported=$(node -e 'console.log(JSON.stringify(require(process.argv[1]).counts))' "$STAGE/corpus-manual-export.json")
        current=$(npx tsx scripts/db/corpus-export-manual.ts --count)
        [ "$exported" = "$current" ] || { echo 'manual corpus edits changed since export; release refused' >&2; exit 1; }
    done
    BACKUPS="$STAGE/rollback"
    mkdir -p "$BACKUPS"
    # Deduplicate: snapshot every database we will touch while all app writes are stopped.
    for db in $affected; do
        sqlite3 "$INTERLEX_ROOT/$db.db" ".backup '$BACKUPS/$db.db'"
        chmod --reference="$INTERLEX_ROOT/$db.db" "$BACKUPS/$db.db"
        sudo chown --reference="$INTERLEX_ROOT/$db.db" "$BACKUPS/$db.db"
    done
    RESTORE_DB=1
    for db in "${DBS[@]}"; do
        chmod --reference="$INTERLEX_ROOT/$db.db" "$STAGE/$db-release.db"
        sudo chown --reference="$INTERLEX_ROOT/$db.db" "$STAGE/$db-release.db"
        rm -f "$INTERLEX_ROOT/$db.db-wal" "$INTERLEX_ROOT/$db.db-shm"
        mv "$STAGE/$db-release.db" "$INTERLEX_ROOT/$db.db"
    done
    npx tsx scripts/db/run.ts migrate
    # Updating the control checkout installs the stable npm start launcher. No
    # dependency installation or build ever takes place here again.
    git -C "$INTERLEX_ROOT" merge --ff-only "$COMMIT"
fi
SWITCHED=1
atomic_link "$TARGET" "$INTERLEX_ROOT/current"
# From this point the new app may accept writes: only roll back CODE, never DBs.
RESTORE_DB=0
sudo systemctl start "$SERVICE"
expected=$COMMIT
[ ! -f "$TARGET/.legacy-release" ] || expected=legacy
ready "$expected"
if [ -n "$PUBLIC_URL" ] && [ "$expected" != legacy ]; then
    node "$TARGET/scripts/ops/check-public-release.mjs" "$PUBLIC_URL" "$COMMIT"
fi
atomic_link "$PREVIOUS" "$INTERLEX_ROOT/previous"
echo "OK: release $COMMIT, current=$TARGET, previous=$PREVIOUS"
