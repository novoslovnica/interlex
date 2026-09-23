#!/usr/bin/env bash
# Релиз на прод. Запускать из корня репозитория, под bash (не zsh: там
# USERNAME - специальная переменная, и присвоение из .env.release молча
# игнорируется).
#
#   bash release.sh                         код: git pull, npm ci, миграции, сборка
#   bash release.sh --db=corpus             плюс замена corpus.db на сервере снимком локальной
#                                           (ручные правки модераторов переносятся с прода в снимок)
#   bash release.sh --db=historical         замена historical.db (статический импорт)
#   bash release.sh --db=interlex --replace-source-of-truth
#                                           аварийная замена словаря/библиотеки целиком - см. ниже
#   bash release.sh --covers                плюс public/covers -> /var/www/interslavic-lexicon.com/covers/
#   bash release.sh --db=corpus --skip-backup   не делать бэкап заменяемой базы на сервере
#                                               (corpus - 5 ГБ, бэкап долгий и место)
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
# Требует .env.release с USERNAME / PASSWORD / HOST. Сервер делает git pull,
# поэтому сначала проверяется, что всё запушено.
set -euo pipefail
cd "$(dirname "$0")"

REMOTE_DIR=/var/www/interslavic-lexicon.com/interlex
COVERS_REMOTE=/var/www/interslavic-lexicon.com/covers/
ALLOWED_DBS="interlex corpus library historical"

DBS=()
REPLACE_SOT=0
COVERS=0
REMOTE_FLAGS=()
KEEP_SNAPSHOT=0
for arg in "$@"; do
    case "$arg" in
        --db=*)          IFS=',' read -ra part <<< "${arg#--db=}"; DBS+=("${part[@]}") ;;
        --with-data)     DBS+=(interlex) ;;
        --replace-source-of-truth) REPLACE_SOT=1 ;;
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
    if { [ "$db" = interlex ] || [ "$db" = library ]; } && [ "$REPLACE_SOT" != 1 ]; then
        echo "$db.db on production is the source of truth - change it with scripts (bash prod.sh run ...)." >&2
        echo "Replacing the file discards everything done on production since your snapshot;" >&2
        echo "if that is really intended, add --replace-source-of-truth." >&2
        exit 2
    fi
done

. scripts/ops/remote.sh
require_pushed_main

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
    if [ "$db" = corpus ]; then
        # Ручные правки с прода -> в снимок. Скрипт экспорта копируется на сервер
        # сам: серверная копия кода ещё не обновлена (git pull - в rebuild-remote.sh).
        echo "==> corpus: exporting manual edits from production"
        scp_to scripts/db/corpus-export-manual.ts "$(remote "$REMOTE_DIR/.release-corpus-export-manual.ts")"
        remote_app npx tsx .release-corpus-export-manual.ts --out=corpus-manual-export.json
        ssh_run "rm -f $REMOTE_DIR/.release-corpus-export-manual.ts"
        scp_to "$(remote "$REMOTE_DIR/corpus-manual-export.json")" corpus-manual-export.json
        echo "==> corpus: applying them to $snapshot"
        # --keep-snapshot тоже проходит здесь: импорт идемпотентен, а правки с прода могли добавиться.
        npx tsx scripts/db/corpus-import-manual.ts corpus-manual-export.json --db="$snapshot" --apply ${CORPUS_ALLOW_MISSING:+--allow-missing} || {
            echo "manual edits would be lost - fix it, or CORPUS_ALLOW_MISSING=1 bash release.sh ... to drop them knowingly" >&2
            exit 1
        }
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

for db in "${DBS[@]}"; do
    if [ "$db" = corpus ]; then
        echo
        echo "corpus.db replaced. Lexeme frequencies live in interlex.db and are now stale:"
        echo "  bash prod.sh run scripts/compute-lexicon-frequency.ts --apply"
    fi
done
