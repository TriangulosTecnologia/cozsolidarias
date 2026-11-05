#!/usr/bin/env bash
# Regenerates the filter entry of endpointsDocumentation.json from the
# filterable bases and the field allowlist. Compiles the TypeScript sources with the local tsc
# into a temporary CommonJS build, then runs it. Run from the repository root.
set -euo pipefail

OUT="$(mktemp -d)"

node_modules/.bin/tsc \
  --ignoreConfig \
  --module commonjs \
  --target es2022 \
  --moduleResolution bundler \
  --skipLibCheck \
  --types node \
  --outDir "$OUT" \
  scripts/sync-endpoints-doc.ts

node "$OUT/scripts/sync-endpoints-doc.js"
