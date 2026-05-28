# TODO — Greater Kuching IOC 2.0

Predictive command surface: TimesFM forecasting + AlphaEarth growth-ring change detection + deeper Malaysian open data. Plan: `~/.claude/plans/check-the-site-many-glistening-badger.md`.

## Pipelines (foundation models)
- [x] Create `scripts/forecast/` venv (py3.11) + install `timesfm[torch]`
- [x] Create `scripts/alphaearth/` venv (py3.11) + install earthengine-api/rasterio/pillow
- [x] Write `forecast_runner.py` — TimesFM on river discharge, rainfall, AQI, PM2.5 (Open-Meteo history, p10/p50/p90, 7-day)
- [x] Generate `public/api/forecast.json` (river_discharge, aqi, pm25 ✓; rainfall via archive API — verifying)
- [x] Write `alphaearth/fetch_embeddings.py` (Kota Padawan growth-ring AOI) + `compute_change.py`
- [ ] **BLOCKED on Dr Non:** `earthengine authenticate` + EE_PROJECT → run fetch+change → `public/data/alphaearth/growth-padawan-2017-2024.png` + sidecar

## Server (server.mjs)
- [ ] `loadForecast()` — read static `public/api/forecast.json`, expose as `payload.forecast`
- [ ] `loadAlphaEarth()` — read sidecar JSON if present, expose `payload.alphaEarth` (graceful when absent)
- [ ] `loadInfobanjirRainfall()` — JPS rainfall stations (state=SRK) alongside water level
- [ ] Extend `loadGovStats()` — DOSM district-level (Kuching/Padawan/Samarahan)
- [ ] Add `forecast`, `alphaEarth` keys to `buildDashboard()` payload

## Client (app.js / index.template.html / styles.css / data.js)
- [ ] `buildFallbackDashboard()` — add `forecast`/`alphaEarth` stubs (3-tier safety)
- [ ] `renderForecastRail()` — forecast cards: p50 line + p10–p90 band sparkline, TIMESFM/BASELINE badge
- [ ] AlphaEarth Leaflet `imageOverlay` + new urban-layer toggle ("Growth 2017→2024")
- [ ] Forecast-driven directives in `buildOperations` (p90 crosses band → auto-directive)
- [ ] Forecast-aware NEXT-6H brief card
- [ ] New section in `index.template.html`, sparkline/band CSS in `styles.css`

## Build / deploy / verify
- [ ] `build.mjs` — preserve `forecast.json` + `alphaearth/` artifacts; extend contract
- [ ] `.github/workflows/deploy.yml` — add artifacts to contract; do NOT regenerate forecast/alphaearth in CI
- [ ] `node build.mjs` clean; preview verify (forecast rail, overlay toggle, no console errors, mobile §11.8)
- [ ] Anti-regression scan (§11); 3-tier degradation check
- [ ] Commit + push; document nightly runbook in context.md

## Notes / lessons this session
- Open-Meteo `/v1/forecast past_days=92` returned only 20 daily points for precip → use `archive-api/v1/archive` with explicit dates for rainfall history.
- Open-Meteo 429s on bursts → backoff + stagger added to forecast_runner.
- TimesFM-2.0-500m loads on py3.11 PyTorch/CPU on the M5 Max; model cached after first ~2GB pull.
