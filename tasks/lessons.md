# Lessons · Greater Kuching IOC (kuching.nonarkara.org)

Corrections log. Updated after every mistake. **Read at the start of every session.**
Per §13: the same mistake never happens twice.

---

## 2026-05-26 · Bootstrap: §13 adopted

- **What went wrong:** n/a — first entry
- **Correct behaviour:** Log every correction here. Read before each session.
- **How to recognise:** Any time you repeat a fix you've already made.

---

## 2026-05-26 · Never break the 3-tier data loader

- **What went wrong:** n/a — reminder
- **Correct behaviour:** Data always flows: (1) fetch("/api/dashboard") → live server; (2) fetch("./api/dashboard.json") → static snapshot; (3) buildFallbackDashboard() → data.js constants. All three tiers must remain functional. Breaking tier 1 is OK if tier 2 works. Breaking all three = dashboard dark.
- **How to recognise:** Dashboard shows "Loading..." indefinitely = tier 3 (data.js) is broken.

---

## 2026-05-26 · public/api/ must NOT be in .gitignore

- **What went wrong:** n/a — reminder
- **Correct behaviour:** `public/api/*.json` are the baked static snapshot files. They MUST be committed. If they're in .gitignore, the Cloudflare Pages static deploy serves empty data.
- **How to recognise:** kuching.nonarkara.org shows stale/empty data after deploy = check .gitignore.

---

## 2026-05-26 · Static build command is npm run build:static, not npm run build

- **What went wrong:** n/a — reminder
- **Correct behaviour:** `npm run build:static` runs `node build.mjs` which boots an ephemeral server on :9876, fetches all API data, and writes JSON to `public/api/`. Use this for Cloudflare Pages. `npm run build` may not exist.
- **How to recognise:** `public/api/*.json` empty after running `npm run build`.

---

<!-- FORMAT for future entries:
## YYYY-MM-DD · [short title of the mistake]
- **What went wrong:** ...
- **Correct behaviour:** ...
- **How to recognise this pattern:** ...
-->

## 2026-05-28 · build.mjs regenerates index.html from index.template.html

- **What went wrong:** Edited `public/index.html` directly (added #cctvGrid / #forecastRail); `node build.mjs` overwrote it from `public/index.template.html`, silently reverting the edits.
- **Correct behaviour:** `public/index.html` is GENERATED. Always edit `public/index.template.html`. The build (`site-build.mjs renderIndexHtml`) reads the template, stamps the asset version, writes index.html.
- **How to recognise:** An HTML element you added is missing after running build, or grep finds it in index.html but it vanishes post-build.

## 2026-05-28 · Open-Meteo 429s + past_days precip truncation (TimesFM ingestion)

- **What went wrong:** Forecast runner hit `429 Too Many Requests` on burst calls; `/v1/forecast?past_days=92&daily=precipitation_sum` returned only 20 daily points.
- **Correct behaviour:** Backoff + stagger between Open-Meteo calls. For long daily history use `archive-api.open-meteo.com/v1/archive` with explicit start/end dates (lags ~5d) instead of the forecast endpoint's `past_days`.
- **How to recognise:** "skip <metric>: only N points (<24)" or 429 in forecast_runner output.

## 2026-05-28 · "Thai FM" = TimesFM; foundation-model jobs are local-only, never CI

- **What went wrong:** n/a — clarification. Dr Non's "Thai FM" meant Google **TimesFM**.
- **Correct behaviour:** TimesFM (2GB model, CPU/GPU) and AlphaEarth (Earth Engine auth) run LOCALLY on the M5 Max and commit static artifacts (`public/api/forecast.json`, `public/data/alphaearth/*`). GitHub CI only bakes the committed artifacts into dashboard.json — it must never try to regenerate them. Keep `scripts/*/.venv` gitignored.
- **How to recognise:** CI failing on a missing python/timesfm/earthengine dependency = something tried to run a model in CI.

## 2026-06-02 · Earth Engine project registration blocks GCS access — bypass via parquet index

- **What went wrong:** EE project `ee-nonsmartcity` exists and EE API is enabled, but registration (accept ToS in web console) was needed. Can't register programmatically.
- **Correct behaviour:** Use the AlphaEarth public GCS bucket `gs://alphaearth_foundations` directly. Download `aef_index.parquet` (66MB), find the UTM tile via bbox intersection, range-read with rasterio /vsigs/ + ADC + requester-pays billing on a billing-linked project. No EE needed.
- **How to recognise:** `EEException: Project X is not registered to use Earth Engine` during `ee.Initialize()`. Fall back to GCS immediately.

## 2026-06-02 · AlphaEarth COG — 64-band full read times out; chunk by 8 bands; rasterio UTM bounds need reprojection

- **What went wrong:** `src.read(window=win)` on the full 64-band COG fails with RasterioIOError (HTTP timeout). Also `rasterio.windows.from_bounds` raises WindowError with inverted-Y transform. Also sidecar bounds were in UTM not WGS84 — Leaflet imageOverlay would have placed raster at wrong position.
- **Correct behaviour:** Read in chunks of 8 bands (`range(1, 65, 8)`), concatenate with numpy. Compute pixel window via inverse affine instead of `from_bounds`. Reproject bounds via `rasterio.warp.transform_bounds(src.crs, "EPSG:4326", ...)` before writing sidecar JSON.
- **How to recognise:** `RasterioIOError: Read failed` on a COG = try band chunking. WindowError on `from_bounds` = affine direction mismatch, use `~src.transform` directly.

## 2026-06-14 · Other agent's Codex Incident — detect by line-count collapse

- **What went wrong:** A Gemini agent attempted a modular refactor of server.mjs, gutting it from 3430 → 462 lines. The orphaned files (geo.mjs, api-client.mjs, constants.mjs) were left untracked but NOT imported.
- **Correct behaviour:** Before any session touching server.mjs, run `wc -l server.mjs`. Expect ~3400+ lines. A >30% line-count drop is the Codex Incident — restore immediately via `git checkout HEAD -- server.mjs`.
- **How to recognise:** `git diff HEAD --stat` shows "-3000 lines" on server.mjs, or the server starts with 462 lines. Also: untracked orphan files with names that look like modular extracts (geo.mjs, api-client.mjs, constants.mjs) that don't appear in import statements.

## 2026-06-14 · Other agent early-return bug froze aircraft markers

- **What went wrong:** Agent added `if (state.hasInitialMapFit) { queueMapResize(); return; }` before `clearLayers()` in app.js, causing aircraft marker positions to freeze after first render (the early return skipped the full re-render on every 60s refresh).
- **Correct behaviour:** Never add early returns before clearLayers/re-render paths in the map update loop. `preferCanvas: true` is a legitimate performance optimization; the 120ms double `invalidateSize` call is intentional Leaflet pattern — keep both.
- **How to recognise:** Aircraft markers are static even when new ADS-B data arrives. Live server shows different aircraft count than the frozen display.

## 2026-06-14 · board-grid collapses to 0–136px on <1440×1080 viewports

- **What went wrong:** `.board-grid { flex: 1 1 auto; min-height: 0 }` allowed the board-grid to collapse entirely. The locality-panel (150px, flex-shrink:0) + lower-grid (260px, flex-shrink:0) + fixed strips (44px) = 454px of non-shrinkable content competed with the map for 100svh space.
- **Correct behaviour:** `.board-grid { flex: 1 0 480px; min-height: 480px }`. With flex-shrink:0 and a 480px basis, the board-grid can never shrink. Lower sections overflow the shell (clipped by overflow:hidden, scrollable via page scroll). Map always gets at least 480px.
- **How to recognise:** `boardGrid.getBoundingClientRect().height < 200` on desktop. Map canvas is a sliver. Situation rail panel-inner.clientHeight is 0 or near-0.

## 2026-06-14 · Tropical AMC thresholds differ from US CN-method

- **What went wrong:** Standard US CN-method AMC thresholds (36mm/14d for Class I, 53mm/14d for Class II) are calibrated for temperate climates. Kuching averages 77mm/week (300+mm/month). At US thresholds, Kuching would always be in Class III (saturated) even in dry spells.
- **Correct behaviour:** Tropical Kuching AMC thresholds: Class I <100mm/14d (dry), Class II 100–200mm (normal), Class III >200mm (saturated). These are roughly 2.7× the US values and match local hydrology.
- **How to recognise:** Every station shows Class III in the flood matrix even in sunny weather = thresholds too low for tropics.

## 2026-06-14 · uv venvs have no pip binary — use `uv pip install --python path/to/python`

- **What went wrong:** `uv venv` creates venvs without a `pip` script. Running `<venv>/bin/pip install pyproj` fails with "no such file".
- **Correct behaviour:** `uv pip install <pkg> --python <venv>/bin/python` — use uv's own pip subcommand with explicit python path.
- **How to recognise:** `FileNotFoundError: <venv>/bin/pip` when trying to install a package into a uv-created venv.
