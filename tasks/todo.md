# TODO — Greater Kuching IOC (updated 2026-06-14)

IOC 2.0, 2.1, and 2.2 are SHIPPED. Latest commit: a6b3136.

## ✅ COMPLETED — IOC 2.0 (2026-06-02)

### Pipelines (foundation models)
- [x] TimesFM venv + install (`scripts/forecast/.venv`, py3.11)
- [x] AlphaEarth venv + install (`scripts/alphaearth/.venv`, py3.11)
- [x] `forecast_runner.py` — 4 basin series (river discharge, rainfall, AQI, PM2.5), p10/p50/p90, 7-day
- [x] `public/api/forecast.json` generated (all 4 series live)
- [x] `fetch_embeddings_gcs.py` — GCS-native, bypasses EE registration wall entirely
- [x] `compute_change.py` — WGS84 bounds, amber→red L2 ramp
- [x] `public/data/alphaearth/growth-padawan-2017-2024.png` + sidecar generated

### Server
- [x] `loadForecast()` — reads static forecast.json, exposes payload.forecast
- [x] `loadAlphaEarth()` — reads sidecar JSON, exposes payload.alphaEarth
- [x] `loadStationRainfall()` — per-station rainfall via Open-Meteo at each hydro-station coord
- [x] Infobanjir stations enriched with rainfallPastMm/Today/Tomorrow
- [x] DOSM district granularity in `loadGovStats()` — Kuching 625k, Samarahan 135k, Serian 87k
- [x] `govStats.districts[]` in payload
- [x] Forecast-driven directives in `buildOperations`

### Client
- [x] `renderForecastRail()` — 4-card sparkline rail with p10–p90 band + TIMESFM badge
- [x] i18n: forecast labels in EN/BM/ZH, `setLang()` re-renders rail
- [x] `forecastBand()` — SVG with history → forecast transition at "now" divider
- [x] `toggleAlphaEarthOverlay()` — Leaflet imageOverlay, correct WGS84 bounds
- [x] Growth 2017→24 toggle in URBAN_LAYERS (type="image")
- [x] DOSM district chips in `renderOfficialPulse()`
- [x] `buildFallbackDashboard()` stubs for forecast/alphaEarth/districts
- [x] Audit pass: null-safety, NaN guard, stuck-toggle fix

## ✅ COMPLETED — IOC 2.1 (2026-06-14)

### TimesFM flood pipeline
- [x] `forecast_runner.py` rewritten — 14-day horizon, 6 hydro stations
      (batu-kitang, buntal, siniawan, kpg-git, maong, bedup)
- [x] Per-station Open-Meteo archive rainfall at each station's lat/lon
- [x] AMC 14-day accumulation: tropical thresholds (I <100mm, II 100–200mm, III >200mm/14d)
- [x] Flood load index: 0.60×AMC + 0.40×p90_rain → normal/watch/alert/warning
- [x] `forecast.json` now carries 10 series (4 basin + 6 station) + `stations{}` + `basin_amc{}`

### AlphaEarth impervious surface
- [x] `compute_impervious.py` — cosine-similarity to urban vs forest reference pixels
- [x] `impervious-2024.png` (RGBA, transparent→amber→red) + `impervious.json`
- [x] 4 zones: maong 45%, batu-kawa 43%, padawan-core 41%, kota-padawan 36%
- [x] Drainage stress flag: impervious_fraction >0.50 + elevated risk → "high"

### Server
- [x] `loadImperviousData()` — reads impervious.json with 1h cache
- [x] `buildFloodRiskMatrix(forecast, imperviousData)` — per-station risk rows
- [x] `loadForecast()` — passthrough for new `stations{}` + `basin_amc{}` fields
- [x] `buildDashboard()` — adds `floodMatrix` to payload
- [x] `buildOperations()` — AMC Class III directive, per-station alert/warning directives,
      AlphaEarth drainage stress directive

### Client
- [x] `renderFloodMatrix(payload)` — AMC basin badge, 6-row station table,
      6h/24h/72h band cells (NRM/WTCH/ALRT/WARN), impervious %, AMC class, stress icon
- [x] `buildFallbackDashboard()` stub for `floodMatrix` and updated `forecast`
- [x] i18n: `floodMatrix` key (EN/BM/ZH), `forecastSub` updated to "14-day"
- [x] `#floodMatrix` div in index.template.html (→ index.html via build.mjs)
- [x] Flood matrix CSS (styles.css): `.fm-amc`, `.fm-header`, `.fm-row`, `.fm-band` etc.
- [x] `board-grid min-height: 480px; flex: 1 0 480px` — map-dominance fix
      (was collapsing to 0–136px on viewports <1440×1080 due to lower sections stealing flex space)

## ✅ COMPLETED — IOC 2.2 (2026-06-14)

### City Reporter integration
- [x] `buildCityReportsDemoData()` — 6 realistic Kuching complaints (flooding, drain, road, dumping, light, pipe)
      across Jalan Penrissen, Kota Padawan, Batu Kawa, Siburan, Jalan Matang, Petra Jaya
- [x] `loadCityReports()` — queries City Reporter Supabase with lat/lon Kuching bbox filter;
      falls back to demo data when env vars absent or 0 results
- [x] `cityReports` added to `buildDashboard()` Promise.all and return object
- [x] `cityReports` stub in `buildFallbackDashboard()` (3-tier safety)
- [x] `renderCitizenReports(payload)` — DEMO/LIVE badge, open/resolved counts,
      5-row compact list with left urgency bar (red=high, amber=medium, green=resolved),
      problem type, location, ticket number, relative timestamp
- [x] `renderCitizenReports()` called in main render dispatch
- [x] Citizen report markers on Leaflet map — circleMarker colored by urgency,
      bindTooltip with problem type, urgency, status, ticket number
- [x] `#citizenReports` div + section label in index.template.html (situation rail, after DIRECTIVES)
- [x] CSS: `.citizen-reports`, `.cr-summary`, `.cr-row`, `.cr-urgency-bar`, `.cr-body`, `.cr-status`, etc.
- [x] i18n: `citizenReports` key in EN/BM/ZH
- [x] Env vars for live mode: `CITY_REPORTER_SUPABASE_URL` + `CITY_REPORTER_SUPABASE_KEY`
      (when Kuching City Reporter deployment exists, set these to go live)

## 🔲 DEFERRED (next increment)
- [ ] Add `impervious-2024.png` as second AlphaEarth Leaflet image overlay toggle
      (currently used in JSON for flood matrix only, not as map layer)
- [ ] Multi-year AlphaEarth progression (2017→2020→2024 animation / time-slider)
- [ ] JPS Infobanjir rainfall HTML scrape (replaced by Open-Meteo per-station for now)
- [ ] Replace MBKS/MPP/DBKU HTML scrapes with proper APIs when available
- [ ] Sentinel-1 SAR flood extent (when available from PLANMalaysia/LGMS)
- [ ] Redis persistent cache (survive server restarts)
- [ ] Register `ee-nonsmartcity` in EE web console for future EE-native workflows
- [ ] Delete orphaned refactor files: `geo.mjs`, `api-client.mjs`, `constants.mjs`
      (other agent's abandoned modular refactor, never imported by server.mjs)

## NIGHTLY RUNBOOK

```bash
# Refresh TimesFM forecast (nightly, local M5 Max):
cd "/Users/nonarkara/Projects/Padawan Municipality Kuching Dashboard"
scripts/forecast/.venv/bin/python scripts/forecast/forecast_runner.py
node build.mjs
git add public/api/forecast.json public/api/dashboard.json public/api/build-manifest.json
git commit -m "data: refresh forecast $(date +%Y-%m-%d)" && git push

# Refresh AlphaEarth change ring (annual):
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json
export GS_USER_PROJECT=airdnd-488809
scripts/alphaearth/.venv/bin/python scripts/alphaearth/fetch_embeddings_gcs.py \
  --aoi kuching_padawan --years 2025 --user-project airdnd-488809
scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_change.py \
  --year-a scripts/alphaearth/raw/alphaearth-kuching_padawan-2017.tif \
  --year-b scripts/alphaearth/raw/alphaearth-kuching_padawan-2025.tif \
  --out public/data/alphaearth/growth-padawan-2017-2025.png
# Also refresh impervious surface:
scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_impervious.py
node build.mjs
git add public/data/alphaearth/ public/api/ && git commit -m "data: AlphaEarth 2025 refresh" && git push
```

## ✅ COMPLETED — FloodDash-grade hydro (2026-07-21)

- [x] Replace dead JPS Infobanjir SWK scrape with DID Sarawak iHYDRO (live map markers)
- [x] Official DID thresholds (fixes false tropical alerts from old hand-coded levels)
- [x] FloodDash action card: ALL CLEAR / STAY INFORMED / PREPARE / ACT NOW
- [x] Reality check (news vs gauges), shelters/PPS, hotlines
- [x] Multi-point GloFAS (Kuching + Batu Kitang + Batu Kawa)
- [x] Padawan-focus gauge panel + map fly-to

## ✅ COMPLETED — Retire Fly.io (2026-07-21)
- [x] Cloudflare Pages sole production host (kuching.nonarkara.org)
- [x] Remove fly.toml / Dockerfile / .dockerignore
- [x] Point site-build defaults at kuching.nonarkara.org

## ✅ COMPLETED — Ward-tension honesty (2026-07-21)
- [x] WARD_TENSION marked ILLUSTRATIVE in data.js with explicit badge
  in renderWardBrief so operator never mistakes hand-curated value for
  measured signal
- [x] Removed hard-coded "Public Tension Critical: Ward I (Batu Kawa)
  · 92/100" item from buildOperations — the "92/100" came from the
  fake WARD_TENSION map; the operation claimed "public sentiment
  telemetry" that does not exist. Deletion > soft-label.

## IOC 3.0 — Command Brief redesign (2026-08-25)

Direction approved by Dr Non: keep Console register (dark HUD), restructure into a
strict decision hierarchy for urban-management users, add computed views that
tell what the data already knows.

Five zones, each headed by the question it answers:
1. DO I NEED TO ACT? — verdict strip (NEW) + delta + decision metrics + brief strip
2. WHAT'S COMING? — rain→river cascade (NEW) + 14-day rail + river flow forecast
3. WHERE, AND WHO'S EXPOSED? — map (unchanged) + rail; ward risk matrix (NEW) joins
   gauge bands × locality property counts × councillor contacts via pointInRing
4. WHAT ARE PEOPLE SAYING? — ground pulse / news lanes / citizen reports framing
5. IS THE CITY OUTRUNNING ITS DRAINS? — growth story (NEW): AlphaEarth Δ +
   impervious-by-zone (each zone maps to its gauge) + locality totals

- [x] index.template.html + index.html — zone restructure, all ids preserved
- [x] styles.css — zone heads, verdict, cascade, ward-risk, growth styles
- [x] app.js — renderVerdict / renderCascade / renderWardRisk / renderGrowthStory,
      curated metric order, re-render ward risk after wardFeatures load
- [x] i18n keys for zone heads (en/ms/zh)
- [x] Local verify → CDPT — live at d8b5c70, all 5 zones + 4 computed views verified in production
