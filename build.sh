#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"

command -v node >/dev/null || { echo "error: Node.js is required" >&2; exit 1; }
command -v pnpm >/dev/null || { echo "error: pnpm is required (corepack enable)" >&2; exit 1; }

node -e '
const want = (require("./package.json").engines || {}).node || "";
const match = /^>=\s*(\d+)\.(\d+)\.(\d+)$/.exec(want.trim());
if (!match) {
  console.error(`error: package.json#engines.node must match >=x.y.z, got "${want}"`);
  process.exit(2);
}
const need = match.slice(1).map(Number);
const have = process.versions.node.split(".").map(Number);
const diff = need.map((n, i) => have[i] - n).find((d) => d !== 0) || 0;
if (diff < 0) {
  console.error(`error: Node ${want} is required, found ${process.versions.node}`);
  process.exit(1);
}
'

pnpm install --frozen-lockfile
if [ "${SKIP_CHECKS:-0}" = "1" ]; then
  echo "SKIP_CHECKS=1: skipping lint / typecheck / test"
else
  check_failed=0
  pnpm lint || check_failed=1
  pnpm typecheck || check_failed=1
  pnpm test || check_failed=1
  test "$check_failed" = 0
fi
node --check utools/preload.js
node -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json")); const plugin = JSON.parse(fs.readFileSync("utools/plugin.json")); if (pkg.version !== plugin.version) throw new Error("版本号不一致")'
pnpm build
test -f utools/dist/index.html
test -f utools/logo.png
test ! -e utools/.git || { echo "error: utools/ 内不应存在 .git" >&2; exit 1; }
if [ "${RUN_E2E:-0}" = 1 ]; then
  pnpm test:e2e
fi
