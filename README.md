# Secretary Goh's Super Dashboard // V3.0 Lean Command

A mission-critical, high-fidelity Operational OS for the Padawan Municipal Council. **V3.0 "Lean Command"** executes a first-principles optimization: deleting redundant pipelines, consolidating disparate loaders into unified streams, and removing fake features to ensure every pixel serves a tactical purpose.

## Local Run

```bash
node server.mjs
```

Open [http://localhost:3000](http://localhost:3000).

## Delivery Modes

- `LIVE API`: Same-origin Node runtime serving `/api/dashboard`, `/api/health`, and `/api/layers/:id`.
- `STATIC SNAPSHOT`: GitHub Pages board using baked `public/api/*.json` built by `node build.mjs`.
- `CLIENT FALLBACK`: Last-resort browser-side constants when both live API and static snapshot are unavailable.

The masthead now shows which mode is active, when the payload was generated, when the snapshot was built, and which board URL is the alternate surface.

## Static Pages Build

```bash
npm run build:static
```

That command must produce these Pages artifacts under `public/`:

- `api/dashboard.json`
- `api/build-manifest.json`
- `api/layers/drainage.json`
- `api/layers/transit.json`
- `api/layers/land_use.json`
- `api/layers/flood_risk.json`
- `index.html`

`build.mjs` now renders `public/index.html` from `public/index.template.html`, stamps the asset version from commit SHA or build timestamp, and fails if the Pages artifact contract is incomplete.

## Deployment Surfaces

- Snapshot board: `https://nonarkara.github.io/kuching-ioc/`
- Live board target: `https://nonarkara-kuching-ioc-live.fly.dev/`

GitHub Pages stays the public kiosk. Fly.io runs the real live IOC with same-origin API routes.

## Fly.io Deploy

Files added for the live runtime:

- [`fly.toml`](/Users/non/Projects/Padawan Municipality Kuching Dashboard/fly.toml)
- [`Dockerfile`](/Users/non/Projects/Padawan Municipality Kuching Dashboard/Dockerfile)
- [`.dockerignore`](/Users/non/Projects/Padawan Municipality Kuching Dashboard/.dockerignore)

Deploy flow:

```bash
fly auth login
fly secrets set AQICN_TOKEN=your_token_here
fly deploy
```

The Fly app serves the same frontend as the local Node server. The HTML is rendered with `LIVE BOARD` metadata and live `/api/*` endpoints on the same origin.

## V3.0 "Lean Command" Stack

- **Musk-Style Optimization**: question every requirement, delete any part or process you can, simplify only after deletion.
- **Zero-dependency Core**: Node 20 server providing cached, highly-available JSON telemetry. 
- **High-Fidelity UI**: Dark themed "Liquid Glass" HUD using Manrope/JetBrains Mono typography and glassmorphism.
- **Asset Optimized**: Core logos compressed by 95% (7.7MB → 216K) for sub-second load times.

## Intelligence Pipeline

- **Gov Stats**: Unified census and open-data pipeline merging DOSM and CKAN streams.
- **Met Warnings**: Consolidated weather warning engine combining MetMalaysia alerts and urban risk forecasts.
- **NASA FIRMS**: Live satellite monitoring of thermal hotspots and fire anomalies.
- **USGS Seismic**: Regional earthquake tracking and magnitude monitoring.
- **OpenSky Network**: Live airspace tracking for KCH, classifying arrivals and departures.
- **Open-Meteo**: Deep weather and air quality telemetry with 24h trend analysis.
- **NASA GIBS**: Orbital context via high-resolution satellite imagery layers.
- **Google News RSS**: Curated, deduped local news rail covering Kuching and Padawan sectors.

## Operational Features

- **Sitrep Export**: Instant generation of mission-readiness reports for executive sharing.
- **Resilient Fallback**: Designed to maintain operational continuity even during API rate-limits or outage scenarios.
- **Atomic Clocks**: Synchronized ASEAN time array for multi-regional coordination.
