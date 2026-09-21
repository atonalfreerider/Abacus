#!/usr/bin/env bash
set -euo pipefail
cd -- "$(dirname -- "$(readlink -f -- "$0")")"
if ! command -v node >/dev/null 2>&1; then
  echo 'Node.js 20 or newer is required to run Abacus.' >&2
  exit 1
fi
exec node tools/launch.mjs "$@"
