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
