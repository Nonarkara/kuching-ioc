#!/usr/bin/env bash
# Run the spatial gate on a FROZEN snapshot. The live bake changes headline
# lengths and KPI strings every run, so geometry measured on it is a property of
# the news, not of the layout. This copies public/ aside and swaps in the
# committed fixture (snapshot + manifest, so the pinned clock is fixed too).
# Refresh the fixture on purpose: cp public/api/{dashboard,build-manifest}.json design/measure-fixture/
set -euo pipefail
cd "$(dirname "$0")/../.."
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
cp -R public "$TMP/site"
cp design/measure-fixture/dashboard.json design/measure-fixture/build-manifest.json "$TMP/site/api/"
node scripts/spatial/spatial-check.mjs --dir "$TMP/site" --baseline design/spatial-baseline.json \
  --widths 390,479,480,481,719,720,721,722,959,960,961,1024,1039,1040,1041,1042,1239,1240,1241,1399,1400,1401,1440,1499,1500,1501 "$@"
