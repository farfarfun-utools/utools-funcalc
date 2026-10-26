#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
pnpm install --frozen-lockfile
check_failed=0
pnpm lint || check_failed=1
pnpm typecheck || check_failed=1
pnpm test || check_failed=1
test "$check_failed" = 0
node --check utools/preload.js
node -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json")); const plugin = JSON.parse(fs.readFileSync("utools/plugin.json")); if (pkg.version !== plugin.version) throw new Error("版本号不一致")'
pnpm build
test -f utools/dist/index.html
test -f utools/logo.png
