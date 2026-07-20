# Greater Kuching IOC — Secretary Goh's Super Dashboard

## Live URL
- Production: https://kuching.nonarkara.org (Cloudflare Pages — sole host)
- Local dev: http://localhost:3000

## Repo
GitHub: Nonarkara/kuching-ioc

## Stack
Node.js 20+ (server.mjs — used locally + in CI `build.mjs` to bake JSON)
Pure HTML/CSS/JS frontend — no framework, no bundler
Leaflet 1.9.4 (map), JetBrains Mono + Manrope (Google Fonts)
No frontend bundler — `build.mjs` boots an ephemeral server and writes `public/api/*.json`

## Dev (live API mode — local only)
```bash
node server.mjs      # Starts on port 3000
# open http://localhost:3000
```

## Static Build (for Cloudflare Pages)
```bash
npm run build:static  # node build.mjs → public/api/*.json
# Boots ephemeral server on :9876, fetches all data, writes JSON to public/api/
```

## Deploy — Cloudflare Pages (production)
Automated via GitHub Actions on push to main.
Custom domain: `kuching.nonarkara.org` on project `kuching-ioc`.
```bash
gh workflow run "Deploy to Cloudflare Pages" -R Nonarkara/kuching-ioc
gh run list -R Nonarkara/kuching-ioc --limit 3
```
CI: `npm ci → node build.mjs → wrangler pages deploy public --project-name=kuching-ioc`

Fly.io was retired — do not redeploy there.

## Google Sheets Archive
```bash
npm run archive:sheets   # node scripts/sheets-archive.mjs
```

## Data Architecture (3-Tier Loader — never break this)
1. `fetch("/api/dashboard")` → live Node server
2. `fetch("./api/dashboard.json")` → static snapshot (public/api/)
3. `buildFallbackDashboard()` → data.js constants (last resort)

## Key Files
| File | Size | Purpose |
|------|------|---------|
| server.mjs | 134KB | HTTP server — all 15+ API integrations |
| public/index.html | — | Dashboard shell (2-col layout, map-dominant) |
| app.js | ~1400 lines | 3-tier loader, UI rendering, layer toggles |
| data.js | — | Constants, fallbacks, i18n (EN/BM/ZH) |
| styles.css | ~1000 lines | Dark/light HUD theme |
| build.mjs | — | Static build orchestrator |

## Map Config
Leaflet 1.9.4, center [1.53, 110.35], default zoom 12
Bounds locked: [[1.15, 109.9], [1.85, 110.7]], zoom 10–18
Layers: CartoDB dark/light/satellite, Esri satellite, Land Use, Flood Risk, Drainage, Transit

## Notes
- See CLAUDE.md for full data sources, design rules, DO/DON'Ts.
- 3 languages: EN / Bahasa Malaysia / Chinese.
- Partner logos must stay visible: PMUA, depa, Axiom, ReTL, Smart City Thailand, ASCN.
- KCH airport reference: [1.4847, 110.347].
- public/api/ must NOT be in .gitignore — baked JSON is part of the static deploy.

---

## IOC 2.0 — Foundation-Model Intelligence (added 2026-05-28)

The board now predicts and detects change, not just reports the present.

### TimesFM Forecast Engine (LIVE)
- **What:** Google TimesFM-2.0-500m zero-shot probabilistic forecasts (p10/p50/p90, 7-day) for river discharge, rainfall, AQI, PM2.5. p90 = worst case, always shown.
- **Pipeline:** `scripts/forecast/forecast_runner.py` (py3.11 venv at `scripts/forecast/.venv`, gitignored). Pulls ~90d history from Open-Meteo (keyless: flood/archive/air-quality APIs), runs TimesFM locally on the M5 Max (CPU, model cached ~2GB after first run), writes `public/api/forecast.json` (committed).
- **Served via:** server `loadForecast()` → `payload.forecast` → baked into `dashboard.json` by `build.mjs` → client `renderForecastRail()` (situation rail, above DIRECTIVES). Forecast also drives auto-directives in `buildOperations` (p90 river ≥1.2× now, or p90 AQI ≥100).
- **Runbook (nightly, local — NOT in CI):**
  ```bash
  scripts/forecast/.venv/bin/python scripts/forecast/forecast_runner.py
  git add public/api/forecast.json && git commit -m "data: refresh forecast" && git push
  ```
  First-time setup: `cd scripts/forecast && uv venv --python 3.11 .venv && .venv/bin/python -m pip install -r requirements.txt` (or `uv pip install`).
- **Gotchas:** Open-Meteo 429s on bursts → runner has backoff + stagger. The `/v1/forecast past_days` endpoint truncates precip history → rainfall uses `archive-api/v1/archive` (lags ~5d). CI cannot run TimesFM (no GPU/2GB model) — forecast.json is committed and CI just bakes it.

### AlphaEarth Growth-Ring Change Detection (PIPELINE READY — needs EE auth)
- **What:** Google DeepMind satellite-embedding L2 change 2017→latest over the Kota Padawan growth ring → amber overlay on the map ("Growth 2017→24" urban-layer toggle).
- **Pipeline:** `scripts/alphaearth/{fetch_embeddings.py,compute_change.py}` (py3.11 venv, gitignored). AOI `kuching_padawan` = bbox (110.27, 1.39, 110.40, 1.49), scale 30 m.
- **Served via:** server `loadAlphaEarth()` reads newest `public/data/alphaearth/growth-*.json` sidecar → `payload.alphaEarth` → client `toggleAlphaEarthOverlay()` (Leaflet imageOverlay). Degrades to "Growth (pending)" until the raster exists.
- **ONE-TIME HANDOFF (Dr Non — interactive Google login required):**
  ```bash
  cd "Padawan Municipality Kuching Dashboard"
  scripts/alphaearth/.venv/bin/python -m ee.cli.eecli authenticate   # browser OAuth
  export EE_PROJECT=<your-earth-engine-project-id>                   # an EE-enabled GCP project
  scripts/alphaearth/.venv/bin/python scripts/alphaearth/fetch_embeddings.py --aoi kuching_padawan --years 2017 2024
  scripts/alphaearth/.venv/bin/python scripts/alphaearth/compute_change.py \
    --year-a scripts/alphaearth/raw/alphaearth-kuching_padawan-2017.tif \
    --year-b scripts/alphaearth/raw/alphaearth-kuching_padawan-2024.tif \
    --out public/data/alphaearth/growth-padawan-2017-2024.png
  node build.mjs && git add public/data/alphaearth && git commit -m "data: AlphaEarth growth overlay" && git push
  ```
  (If EE rejects the download as >50MB, bump `--scale 40`.)

### Deferred (next increment)
- JPS Infobanjir **rainfall** station scrape (state=SRK) alongside water level.
- DOSM **district-level** population/income (Kuching/Padawan/Samarahan) in `loadGovStats`.
