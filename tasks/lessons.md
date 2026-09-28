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

## 2026-07-05 · Verify a work-order's claims before relaying; never hand Dr Non a decision-menu

- **What went wrong:** Given Fable 5's `kuching-ioc.md` work order, I summarized its F1/F2/F3 claims (CI broken, Fly tier dead, dual-copy risk) back as a 3-row "needs you" table asking Dr Non to hand me a token / say "go" — before verifying them. He replied "no such things." Two were phantom-to-him (Fly app genuinely doesn't exist; dual-copy is a workspace note, not a defect); the table itself violated §0's "no technical menus — make the call, state it, execute."
- **Correct behaviour:** A work order is claims to VERIFY (§13.4), not findings to relay. Run the proving command (`gh run list`, `fly status`, `gh secret list`) first. Act on what's real, drop what isn't, never present a chore-menu. A genuinely-blocked item (CI needs a CF API token OAuth can't mint) is stated once as a standing fact, not re-asked every turn.
- **How to recognise:** You're about to write "needs you:" with >1 item, or repeating a subagent/work-order assertion without having run the command that proves it.

## 2026-07-21 · Never render hand-curated demo constants as if they were measured signals

- **What went wrong:** The `WARD_TENSION` map in `public/data.js` is hand-curated demo data (plausible municipal-ward pressure points), but the per-ward brief in `public/app.js` rendered it as a measured "Tension Index" with score+trend+glyph, no source attribution. Worse, `server.mjs → buildOperations()` had a hard-coded high-severity item `Public Tension Critical: Ward I (Batu Kawa)` with detail `"Public sentiment telemetry shows a critical spike (92/100)"` — the entire sentence fabricated a "telemetry" source that does not exist. Both violate the dashboard's own rule (CLAUDE.md): *"Every number must be sourced — no made-up statistics."*
- **Correct behaviour:** Any constant that is *not* backed by a live source must carry a provenance flag (e.g. `WARD_TENSION_ILLUSTRATIVE = true`) and the renderer must show an explicit "ILLUSTRATIVE" badge inline next to the value with a tooltip pointing back to the data file. Operations built from a non-existent feed (hard-coded `items.push` blocks that say "telemetry shows..." when no telemetry exists) must be deleted, not soft-labelled — a fake "act now" directive is worse than no directive.
- **How to recognise:** A `WARD_TENSION`, `CCTV_FEEDS`, or any constant in `data.js` that uses real-looking labels ("score", "band", "alert", "watch") without an `__source` / `*_ILLUSTRATIVE` flag. Any `items.push` in `buildOperations()` whose `detail` field claims a source the server does not actually call. `grep -n "telemetry shows\|public sentiment" server.mjs` is the canary — if it returns hits, the content rule is being violated.

## 2026-06-14 · uv venvs have no pip binary — use `uv pip install --python path/to/python`

## 2026-09-08 · Lopburi pass — chrome is not the product

- **What went wrong:** The HUD aesthetic (JetBrains Mono everywhere, glow-on-data, scan-line vignette) was loud enough to compete with the data Secretary Goh was trying to read. The masthead rendered as a paragraph; the verdict collapsed to one-word-wide fragments on phone. The banner art and the running software disagreed about what the board was.
- **Correct behaviour:** Lopburi rule: the map and the action text lead; chrome is quiet. Helvetica + Georgia replace JetBrains Mono + Manrope. Glow stays only on key values. Vignette, scan-grid, reticle all stay but lose saturation. Five-zone Command Brief replaces the masthead-led 2-column — every zone headed by the question it answers, every renderer earns its place by what it lets the operator *decide*. The banner's CCTV wall is illustration only — the README carries the disclaimer so a fork cannot accidentally claim camera coverage.
- **How to recognise:** A "glow" applied to non-key text, a JetBrains Mono token still on the page, or a panel whose header explains what the panel *is* instead of *what to do about it*. The board reads for a tired secretary at 06:00 SGT, not for a demo audience.

## 2026-09-23 · Reading scale and recorded-vs-live are different truths

- **What went wrong:** "Rivers OK · 0 gauges" when the upstream feed had no readings at all — same string as "all gauges normal". The interface said `SYS: OPERATIONAL` unconditionally. The action card accepted unescaped feed text and missed keyboard operation.
- **Correct behaviour:** `dataHealth()` in `public/data-health.js` computes coverage from actual numeric readings and explicitly flags missing / partial / offline / unclassified / old-payload as `uncertain: true`. The interface surfaces that flag — operators check source times, do not assume a "normal" reading means conditions are normal. Action cards escape feed text and become keyboard-operable (Enter/Space cycles queued → active → done in browser-localStorage only — never a shared work-order system). Every forecast rainfall in the catchment narrative is labelled forecast rainfall, not observed. The native `<dialog>` operator guide carries EN/BM/ZH instructions for shift handover.
- **How to recognise:** A "0 readings" status that still reads as green/normal. An interface string that says "operational" without naming a freshness source. A missing-warning item array that breaks the export. `grep -n "SYS: OPERATIONAL\|Rivers OK" public/app.js` is the canary — if the string exists, the audit has regressed.


## 2026-09-28 · "Loose" was a desktop reading-scale layer, and two bugs hid behind the drawer

- **What went wrong:** At 1920×1080 the page was 1,648px tall and the map started 769px down. The cause was the "meeting-safe reading scale" layer (16px base, 128px brief cards, 34px title, 16px paddings) applied to every width, plus a below-the-fold drawer for outlook, growth, localities and sources. Two bugs were also hidden: in Padawan scope the Sources renderer was skipped, so the operator guide's "Data sources" shortcut opened an empty panel; and on phones a later `max-width:1240px` rule left the board with three column tracks, so map, rail and news were 260px wide on a 375px screen.
- **Correct behaviour:** Desktop is one grid frame of 100svh, with three internally scrolling columns and a tabbed evidence tray under the map (see the CLAUDE.md Layout section). Every panel that a shortcut or tab can open must render in every scope. Phone board grids set `grid-template-columns: minmax(0,1fr)` explicitly.
- **How to recognise:** `document.documentElement.scrollHeight > innerHeight` at ≥1041px wide, `#sourceList` with zero children in Padawan scope, or `.map-panel` narrower than the viewport on a phone.

## 2026-09-29 · Ship audit: invented "council records" were the real embarrassment risk

- **What went wrong:** The board showed hand-made ward projects (real contractor names, RM costs, % complete, places outside MPP) as a council "Ledger", plus directives citing things that don't exist ("compliance audit pending for Ward G", "gridlock within 20 minutes", "Sentinel-2 NDVI telemetry"), permanent fake GDP/CPI figures, and CCTV cards marked LIVE with invented conditions. The data.js comment even claimed the projects came from tender notices.
- **Correct behaviour:** Before any demo, grep rendered text for specific numbers, company names and "telemetry/live" claims, and trace each to a fetch. Anything that can't be traced is deleted (directives) or flagged *_ILLUSTRATIVE and not rendered as a record (ledgers, feeds). A provenance comment is a claim to verify, not evidence.
- **How to recognise:** `grep -n "Hock Seng\|WCT\|gridlock\|telemetry\|● LIVE\|FY20" public/*.js server.mjs`; a `feedUrl` that no code reads; a "fallback" object that the server never overrides.
