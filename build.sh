#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
pnpm install --frozen-lockfile
pnpm lint
pnpm typecheck
pnpm test
node --check utools/preload.js
node -e 'const fs = require("node:fs"); const pkg = JSON.parse(fs.readFileSync("package.json")); const plugin = JSON.parse(fs.readFileSync("utools/plugin.json")); if (pkg.version !== plugin.version) throw new Error("版本号不一致")'
pnpm build
test -f utools/dist/index.html
test -f utools/logo.png
