#!/usr/bin/env bash
# Stable npm start entry point; systemd's existing --prefix /.../interlex stays valid.
set -euo pipefail
INTERLEX_ROOT=${INTERLEX_ROOT:-$(cd "$(dirname "$0")/../.." && pwd -P)}
if [ -L "$INTERLEX_ROOT/current" ]; then
    ACTIVE=$(readlink -f "$INTERLEX_ROOT/current")
    . "$ACTIVE/scripts/ops/release-env.sh"
    export RELEASE_COMMIT=$(git -C "$ACTIVE" rev-parse HEAD)
else
    ACTIVE=$INTERLEX_ROOT
fi
cd "$ACTIVE"
exec node node_modules/next/dist/bin/next start "$@"
