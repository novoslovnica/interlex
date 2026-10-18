#!/usr/bin/env bash
# Релиз на прод. Запускать из корня репозитория, под bash (не zsh: там
# USERNAME - специальная переменная, и присвоение из .env.release молча
# игнорируется).
#
#   bash release.sh                         изолированная сборка, миграции, переключение
#   bash release.sh --rollback               вернуть предыдущий релиз (данные сохраняются)
#   bash release.sh --db=corpus             плюс замена corpus.db на сервере снимком локальной
#                                           (ручные правки модераторов переносятся с прода в снимок)
#   bash release.sh --db=historical         замена historical.db (статический импорт)
#   bash release.sh --db=interlex --replace-source-of-truth
#                                           аварийная замена словаря/библиотеки целиком - см. ниже
#   bash release.sh --covers                плюс public/covers -> /var/www/interslavic-lexicon.com/covers/
#   bash release.sh --db=corpus --keep-snapshot  не пересоздавать corpus-release.db, взять существующий
#
# Базы: interlex, corpus, library, historical. auth - НИКОГДА (там реальные
# пользователи прода; её мигрирует rebuild-remote.sh на месте).
#
# Прод - главный источник данных (AGENTS.md, "Production data changes"):
# interlex.db и library.db правят модераторы и участники прямо на проде,
# поэтому их меняют скриптами (bash prod.sh run ...), а не заменой файла.
# Замена целиком затирает всё, что сделано на проде после снимка, и требует
# --replace-source-of-truth. corpus.db пересобирается локально: перед
# выкладкой с прода выгружаются ручные правки (scripts/db/corpus-export-manual.ts)
# и кладутся в снимок (corpus-import-manual.ts); при остановленной службе
# rebuild-remote.sh сверяет их число ещё раз.
#
# Снимок <name>-release.db делается здесь через VACUUM INTO (cp при открытой
# базе не годится, WAL), заливается под временным именем, а подмена
# происходит на сервере при остановленной службе (rebuild-remote.sh).
#
# Требует .env.release с USERNAME / PASSWORD / HOST. Сервер собирает заданный SHA,
# поэтому сначала проверяется, что всё запушено.
set -euo pipefail
cd "$(dirname "$0")"

REMOTE_DIR=${REMOTE_DIR:-/var/www/interslavic-lexicon.com/interlex}
COVERS_REMOTE=/var/www/interslavic-lexicon.com/covers/
ALLOWED_DBS="interlex corpus library historical"

DBS=()
REPLACE_SOT=0
COVERS=0
REMOTE_FLAGS=()
KEEP_SNAPSHOT=0
ROLLBACK=0
for arg in "$@"; do
    case "$arg" in
        --rollback) ROLLBACK=1 ;;
        --db=*)          IFS=',' read -ra part <<< "${arg#--db=}"; DBS+=("${part[@]}") ;;
        --with-data)     DBS+=(interlex) ;;
        --replace-source-of-truth) REPLACE_SOT=1 ;;
        --covers)        COVERS=1 ;;
        --skip-backup) echo "--skip-backup is incompatible with automatic rollback" >&2; exit 2 ;;
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
    if { [ "$db" = interlex ] || [ "$db" = library ]; } && [ "$REPLACE_SOT" != 1 ]; then
        echo "$db.db on production is the source of truth - change it with scripts (bash prod.sh run ...)." >&2
        echo "Replacing the file discards everything done on production since your snapshot;" >&2
        echo "if that is really intended, add --replace-source-of-truth." >&2
        exit 2
    fi
done

. scripts/ops/remote.sh
if [ "$ROLLBACK" = 1 ]; then
    [ ${#DBS[@]} = 0 ] && [ "$COVERS" = 0 ] && [ "$KEEP_SNAPSHOT" = 0 ] || { echo '--rollback accepts no data/media options' >&2; exit 2; }
    REMOTE_FLAGS+=(--rollback)
else
    require_pushed_main
fi

# Local VACUUM/import/export files also need protection from a second invocation.
mkdir -p .deploy
LOCAL_RELEASE_LOCK=.deploy/local-release.lock
mkdir "$LOCAL_RELEASE_LOCK" 2>/dev/null || { echo "local release lock exists: $LOCAL_RELEASE_LOCK (inspect its PID before removing)" >&2; exit 2; }
printf '%s\n' "$$" > "$LOCAL_RELEASE_LOCK/pid"
trap 'rm -f "$LOCAL_RELEASE_LOCK/pid"; rmdir "$LOCAL_RELEASE_LOCK"' EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# Every upload belongs to one deployment; concurrent preparations cannot overwrite
# each other's snapshots/export. Environment files remain on the server.
COMMIT=$(git rev-parse HEAD)
RELEASE_ID="$(date -u +%Y%m%dT%H%M%S)-${COMMIT:0:12}-$$"
STAGE="$REMOTE_DIR/.deploy/$RELEASE_ID"
ssh_run "umask 077; mkdir -p '$STAGE' '$REMOTE_DIR/logs/releases'"

for db in "${DBS[@]}"; do
    snapshot="$db-release.db"
    if [ "$KEEP_SNAPSHOT" = 1 ] && [ -f "$snapshot" ]; then
        echo "==> reusing $snapshot ($(du -h "$snapshot" | cut -f1), $(date -r "$snapshot" '+%F %H:%M'))"
    else
        echo "==> snapshot $db.db -> $snapshot (VACUUM INTO)"
        rm -f "$snapshot"
        sqlite3 "$db.db" "VACUUM INTO '$snapshot'"
    fi
    if [ "$db" = corpus ]; then
        # Ручные правки с прода -> в снимок. Скрипт экспорта копируется на сервер
        # сам: серверная копия кода ещё не обновлена.
        echo "==> corpus: exporting manual edits from production"
        scp_to scripts/db/corpus-export-manual.ts "$(remote "$STAGE/corpus-export-manual.ts")"
        ssh_run "active='$REMOTE_DIR'; [ ! -L '$REMOTE_DIR/current' ] || active=\$(readlink -f '$REMOTE_DIR/current'); ln -s \"\$active/node_modules\" '$STAGE/node_modules'"
        remote_app npx tsx "$STAGE/corpus-export-manual.ts" "--out=$STAGE/corpus-manual-export.json"
        ssh_run "rm -f $STAGE/corpus-export-manual.ts"
        scp_to "$(remote "$STAGE/corpus-manual-export.json")" corpus-manual-export.json
        echo "==> corpus: applying them to $snapshot"
        # --keep-snapshot тоже проходит здесь: импорт идемпотентен, а правки с прода могли добавиться.
        npx tsx scripts/db/corpus-import-manual.ts corpus-manual-export.json --db="$snapshot" --apply ${CORPUS_ALLOW_MISSING:+--allow-missing} || {
            echo "manual edits would be lost - fix it, or CORPUS_ALLOW_MISSING=1 bash release.sh ... to drop them knowingly" >&2
            exit 1
        }
    fi
    echo "==> uploading $snapshot ($(du -h "$snapshot" | cut -f1)) - the swap happens on the server with the service stopped"
    scp_to "$snapshot" "$(remote "$STAGE/$snapshot")"
    REMOTE_FLAGS+=("--db=$db")
done

if [ "$COVERS" = 1 ]; then
    echo "==> uploading public/covers"
    scp_to -r public/covers/. "$(remote "$COVERS_REMOTE")"
fi

echo "==> detached deployment $RELEASE_ID"
scp_to rebuild-remote.sh scripts/ops/run-release.sh "$(remote "$STAGE/")"
REMOTE_FLAGS+=("--commit=$COMMIT" "--stage=$STAGE")
remote_args=$(printf '%q ' "${REMOTE_FLAGS[@]}")
# A dropped SSH connection must not kill a build or leave the service stopped.
ssh_run "nohup env INTERLEX_ROOT='$REMOTE_DIR' bash '$STAGE/run-release.sh' '$STAGE' $remote_args > '$REMOTE_DIR/logs/releases/$RELEASE_ID.log' 2>&1 < /dev/null &"
echo "Log: $REMOTE_DIR/logs/releases/$RELEASE_ID.log"
echo "If SSH disconnects, inspect that log and $STAGE/result (0 = success)."
while true; do
    state=$(ssh_run "if [ -f '$STAGE/result' ]; then cat '$STAGE/result'; else echo running; fi") || {
        echo 'SSH disconnected; deployment continues on the server. Check the log/result before retrying.' >&2
        exit 1
    }
    if [ "$state" != running ]; then
        ssh_run "tail -n 40 '$REMOTE_DIR/logs/releases/$RELEASE_ID.log'"
        [ "$state" = 0 ] || { echo "deployment failed (exit $state); see recovery in log" >&2; exit 1; }
        break
    fi
    echo 'Deployment is running; previous release serves requests during the build.'
    sleep 10
done

for db in "${DBS[@]}"; do
    if [ "$db" = corpus ]; then
        echo
        echo "corpus.db replaced. Lexeme frequencies live in interlex.db and are now stale:"
        echo "  bash prod.sh run scripts/compute-lexicon-frequency.ts --apply"
    fi
done
