# Secretary Goh's Super Dashboard // V2.0 Liquid Glass

A mission-critical, high-fidelity Operational OS for the Padawan Municipal Council, transforming Greater Kuching's municipal data into a Red Dot-standard situational awareness workspace.

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

## V2.0 "Liquid Glass" Stack

- **Zero-dependency Core**: Node 20 server providing cached, highly-available JSON telemetry. 
- **High-Fidelity UI**: Dark themed "Liquid Glass" interface using Manrope/Inter typography and backdrop-blur glassmorphism.
- **Data Density**: Real-time KPI strip with 24h sparklines and linear radar-sweep map.

## Intelligence Pipeline

- **NASA FIRMS**: Live satellite monitoring of thermal hotspots and fire anomalies in the Malaysia envelope.
- **USGS Seismic**: Regional earthquake tracking and magnitude monitoring.
- **OpenSky Network**: Live airspace tracking for KCH, classifying arrivals, departures, and holdings.
- **Open-Meteo**: Deep weather and air quality telemetry with 24h trend analysis.
- **NASA GIBS**: Orbital context via high-resolution satellite imagery layers.
- **Google News RSS**: Curated, deduped local news rail covering Kuching and Padawan sectors.

## Operational Features

- **Sitrep Export**: Instant generation of mission-readiness reports for executive sharing.
- **Resilient Fallback**: Designed to maintain operational continuity even during API rate-limits or outage scenarios.
- **Atomic Clocks**: Synchronized ASEAN time array for multi-regional coordination.
