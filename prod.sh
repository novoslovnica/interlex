#!/usr/bin/env bash
# Скрипты с базами на проде - через реестр (scripts/db/run.ts, AGENTS.md
# "Production data changes"). Прод - главный источник данных: словарь, auth и
# библиотеку там меняют только так, а не заменой файла.
#
#   bash prod.sh status                        что применено, что ждёт
#   bash prod.sh run <script>                  dry-run на проде
#   bash prod.sh run <script> --apply          применить (нужен dry-run этой версии за последние 24 ч)
#        [--again] [--detach] [-- <args скрипта>]
#   bash prod.sh mark-applied <script>         отметить применённым, не запуская
#   bash prod.sh log [-f]                      хвост последнего лога запуска
#
# Скрипт должен быть уже на сервере: сначала commit + push + bash release.sh.
# Схемные миграции применяет сам release.sh (run.ts migrate при остановленной службе).
set -euo pipefail
cd "$(dirname "$0")"
. scripts/ops/remote.sh

cmd=${1:-}
[ -n "$cmd" ] || { sed -n '2,14p' "$0"; exit 2; }
shift

server_commit_matches() {
    git fetch -q origin main
    local local_head server_head
    local_head=$(git rev-parse origin/main)
    server_head=$(ssh_run "cd $REMOTE_DIR && git rev-parse HEAD")
    if [ "$local_head" != "$server_head" ]; then
        echo "the server is at ${server_head:0:8}, origin/main is ${local_head:0:8} - run bash release.sh first," >&2
        echo "otherwise the dry run checks a different version of the script than the one you reviewed" >&2
        exit 2
    fi
}

case "$cmd" in
    status)
        remote_app npx tsx scripts/db/run.ts status
        ;;
    run|mark-applied)
        server_commit_matches
        remote_app env PROD_SH=1 npx tsx scripts/db/run.ts "$cmd" "$@"
        ;;
    log)
        follow=""
        [ "${1:-}" = "-f" ] && follow="-f"
        ssh_run "cd $REMOTE_DIR/logs/db-runs && f=\$(ls -t | head -1) && echo \"== \$f\" && tail -n 80 $follow \"\$f\""
        ;;
    *)
        echo "unknown command: $cmd (status | run | mark-applied | log)" >&2
        exit 2
        ;;
esac
