# Secretary Goh's Super Dashboard // V3.0 Lean Command

A mission-critical, high-fidelity Operational OS for the Padawan Municipal Council. **V3.0 "Lean Command"** executes a first-principles optimization: deleting redundant pipelines, consolidating disparate loaders into unified streams, and removing fake features to ensure every pixel serves a tactical purpose.

## Local Run

```bash
node server.mjs
```

Open [http://localhost:3000](http://localhost:3000).

## Delivery Modes

- `STATIC SNAPSHOT` (production): Cloudflare Pages at `https://kuching.nonarkara.org` using baked `public/api/*.json` from `node build.mjs` (CI every push + schedule).
- `LIVE API` (local / CI bake only): Same-origin Node runtime (`node server.mjs`) serving `/api/dashboard`, `/api/health`, and `/api/layers/:id`.
- `CLIENT FALLBACK`: Last-resort browser-side constants when the static snapshot is unavailable.

## Deployment

- **Production:** `https://kuching.nonarkara.org` (Cloudflare Pages project `kuching-ioc`)
- Mirror: `https://kuching-ioc.pages.dev`

```bash
npm run build:static
# CI on push to main also runs build.mjs then:
# wrangler pages deploy public --project-name=kuching-ioc --branch=main
```

Fly.io hosting was removed — Cloudflare is the only production surface.

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
