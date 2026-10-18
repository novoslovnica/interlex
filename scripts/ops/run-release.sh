#!/usr/bin/env bash
# Outer supervisor records failures even before the deploy's recovery trap exists
# (invalid arguments, missing tool, busy deployment lock, broken nvm setup).
set -uo pipefail
stage=$1
shift
bash "$stage/rebuild-remote.sh" "$@" --stage="$stage" &
deploy_pid=$!
interrupted=0
trap 'interrupted=1; kill -TERM "$deploy_pid" 2>/dev/null || true' INT TERM
wait "$deploy_pid"
result=$?
if [ "$interrupted" = 1 ]; then
    # wait was interrupted; let the deploy finish its recovery before publishing.
    wait "$deploy_pid"
    result=$?
fi
printf '%s\n' "$result" > "$stage/result.tmp"
mv "$stage/result.tmp" "$stage/result"
exit "$result"
