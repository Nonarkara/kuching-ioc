# TODO — Greater Kuching IOC 2.0 (updated 2026-06-02)

All four IOC 2.0 headline features are SHIPPED.

## ✅ COMPLETED

### Pipelines (foundation models)
- [x] TimesFM venv + install (`scripts/forecast/.venv`, py3.11)
- [x] AlphaEarth venv + install (`scripts/alphaearth/.venv`, py3.11)
- [x] `forecast_runner.py` — 4 series (river discharge, rainfall, AQI, PM2.5), p10/p50/p90, 7-day
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

## 🔲 DEFERRED (next increment)
- [ ] Multi-year AlphaEarth progression (2017→2020→2024 animation / time-slider)
- [ ] JPS Infobanjir rainfall HTML scrape (replaced by Open-Meteo per-station for now)
- [ ] Replace MBKS/MPP/DBKU HTML scrapes with proper APIs when available
- [ ] Sentinel-1 SAR flood extent (when available from PLANMalaysia/LGMS)
- [ ] Redis persistent cache (survive server restarts)
- [ ] Register `ee-nonsmartcity` in EE web console for future EE-native workflows

## NIGHTLY RUNBOOK

```bash
# Refresh TimesFM forecast (nightly, local M5 Max):
cd "/Users/nonarkara/Projects/Padawan Municipality Kuching Dashboard"
scripts/forecast/.venv/bin/python scripts/forecast/forecast_runner.py
git add public/api/forecast.json && git commit -m "data: refresh forecast $(date +%Y-%m-%d)" && git push

# Refresh AlphaEarth (annual, GCS-native):
export GOOGLE_APPLICATION_CREDENTIALS=~/.config/gcloud/application_default_credentials.json
export GS_USER_PROJECT=airdnd-488809
export GDAL_HTTP_MAX_RETRY=5 && export GDAL_HTTP_RETRY_DELAY=2
scripts/alphaearth/.venv/bin/python scripts/alphaearth/fetch_embeddings_gcs.py \
  --aoi kuching_padawan --years 2025 --user-project airdnd-488809
scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_change.py \
  --year-a scripts/alphaearth/raw/alphaearth-kuching_padawan-2017.tif \
  --year-b scripts/alphaearth/raw/alphaearth-kuching_padawan-2025.tif \
  --out public/data/alphaearth/growth-padawan-2017-2025.png
node build.mjs && git add public/data/alphaearth/ public/api/ && git commit -m "data: AlphaEarth 2025 growth ring" && git push
```
