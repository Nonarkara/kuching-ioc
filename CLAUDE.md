# Greater Kuching Intelligent Operation Center (IOC)

This is Daniel Goh's municipal intelligence dashboard for Greater Kuching, Sarawak. It is a demo-grade civic tech product, not a template. Every panel must show real data or a well-sourced fallback — never placeholders. The person evaluating this is the Secretary of Padawan Municipal Council; substance over flash.

---

## What This Project Is

A **map-dominant operational dashboard** showing Secretary Goh what is happening across Greater Kuching right now — weather, air quality, flights, flooding, news, satellite imagery, and directives that tell him what to do about it. It runs as:

1. **Live API** on Fly.io (`node server.mjs`) — fresh data on every request
2. **Static snapshot** on GitHub Pages — baked JSON refreshed every 6 hours by CI
3. **Client fallback** — browser-only mode using `data.js` constants when both above fail

The deployed demo URL: `https://nonarkara.github.io/kuching-ioc/`

---

## Architecture at a Glance

```
server.mjs          → Node HTTP server (3000+ lines), 15+ live API integrations
build.mjs           → Boots server on port 9876, fetches payload + GIS layers, writes to public/api/
public/
  index.html        → HTML shell — map-dominant 2-column layout
  app.js            → Client-side renderer (~1400 lines), 3-tier data loader
  data.js           → Constants, fallbacks, helpers, i18n translations
  styles.css        → Dark/light theme, HUD aesthetic, ~1000 lines
  assets/           → Partner logos (PMUA, depa, Axiom, ReTL, Smart City Thailand, ASCN)
  api/
    dashboard.json  → Pre-baked server payload (committed as baseline)
    layers/         → GeoJSON: drainage, transit, land_use, flood_risk
.github/workflows/
  deploy.yml        → GitHub Pages deploy: build → verify → upload (every 6h + on push)
fly.toml            → Fly.io config (Singapore region, 256MB, auto-scale to 0)
Dockerfile          → node:20-alpine, serves on port 3000
```

---

## The 3-Tier Data Loader (Critical Pattern)

`app.js → loadDashboardPayload()` tries sources in order:

1. `fetch("/api/dashboard")` — same-origin live server (Fly.io)
2. `fetch("./api/dashboard.json")` — pre-baked static snapshot (GitHub Pages)
3. `buildFallbackDashboard()` — client-only using data.js constants + live CORS APIs

**If you add a new field to the server payload**, you must also add it to `buildFallbackDashboard()` in app.js with a reasonable fallback value. Otherwise the field will be `undefined` on GitHub Pages when the static snapshot is stale or missing, and any renderer that depends on it will silently skip.

---

## Data Sources

### Live APIs (fetched by server.mjs, CORS-friendly ones also in client fallback)

| Source | What | CORS? | Cache TTL |
|--------|------|-------|-----------|
| Open-Meteo | Weather + forecast | Yes | Live |
| Open-Meteo AQI | AQI, PM2.5, PM10 | Yes | Live |
| OpenSky Network | Live aircraft ADS-B | Yes (rate-limited) | Live |
| USGS Earthquakes | Regional seismic | Yes | 1h |
| NASA GIBS WMS | Satellite imagery (6 layers) | Yes (image URLs) | Daily |
| ExchangeRate API | MYR vs 8 currencies | Yes | Live |
| NASA FIRMS | Fire hotspots (Malaysia) | No | 30min |
| Google News RSS | Local press aggregation | No | 15min |
| Google Trends RSS | Malaysia trending | No | 30min |
| MBKS/MPP/DBKU | Municipal website scraping | No | 15min |
| JPS Infobanjir | Flood/hydro stations | No | 15min |
| AQICN (APIMS) | Ground air quality | No (needs token) | 15min |
| OpenDOSM | Census demographics | No | 6h |
| Sarawak CKAN | Open data catalog | No | 6h |
| OSM Overpass | Drainage/transit/land use GeoJSON | No | 6h |

"No CORS" sources only work via server.mjs. On GitHub Pages, they come from the baked `dashboard.json` or from `buildFallbackDashboard()` stubs.

---

## The Map

- **Library**: Leaflet 1.9.4 (loaded from CDN)
- **Default view**: `[1.53, 110.35]` zoom 12 (Greater Kuching)
- **Bounds locked**: `[[1.15, 109.9], [1.85, 110.7]]` — cannot scroll to Jakarta
- **Zoom range**: 10–18
- **Base tiles**: CartoDB Dark (default), CartoDB Light, OSM Street, Esri Satellite
- **Tile filter**: Dark tiles get `brightness(0.85) contrast(1.2) saturate(0.6)` for the HUD look; light/satellite tiles get lighter or no filter
- **Overlays**: Jurisdiction boundaries (3 polygons), Sarawak River polyline, 10 local markers, airport flight markers, hydro station markers
- **Urban layers** (toggleable): Land Use, Flood Risk, Drainage, Transit Network — loaded from `public/api/layers/*.json`
- **Catchment routing**: When drainage layer is active, clicking a flood station highlights its upstream drainage segments

---

## HTML Layout (Map-Dominant 2-Column)

```
┌─────────────────────────────────────────────────────────┐
│ MASTHEAD: Title / Controls / Runtime badges / Logos      │
├─────────────────────────────────────────────────────────┤
│ TICKER BAR: Intel rail + scrolling news headlines        │
├─────────────────────────────────────────────────────────┤
│ METRIC BAND: 6-column KPI strip with sparklines          │
├─────────────────────────────────────────────────────────┤
│ BRIEF STRIP: ACT NOW | NEXT 6H | BLIND SPOTS            │
├──────────────────────────────┬──────────────────────────┤
│                              │ SITUATION RAIL            │
│         MAP PANEL            │ • Posture block           │
│      (2.4fr width)           │ • Directives              │
│   Leaflet + overlays         │ • Environment signals     │
│   Layer/focus toggles        │ • Official pulse          │
│   Legend + watchpoints        │ • KCH airspace            │
│                              │ • News digest             │
├──────────────────────────────┴──────────────────────────┤
│ LOWER GRID: Satellite deck | Qualitative intel | Sources │
├─────────────────────────────────────────────────────────┤
│ BOTTOM BAR: Version + COMMAND EXPORT                     │
└─────────────────────────────────────────────────────────┘
```

The left rail was intentionally killed. The ASEAN clocks, FX rates, and trend list are rendered into hidden `display:none` containers (still in DOM for data, just not shown in the 2-column layout).

---

## Key Renderers in app.js

| Function | Target Element | What It Renders |
|----------|---------------|-----------------|
| `renderMetrics()` | `#metricBand` | 6–12 KPI cards with sparklines |
| `renderMap()` | `#mapCanvas` | Leaflet map with all overlays |
| `renderBriefStrip()` | `#briefNow`, `#briefNext`, `#briefBlind` | 3-card directive summary |
| `renderPostureBlock()` | `#postureBlock` | Operational posture (Stable/Watch/Stretched) |
| `renderOperations()` | `#operationList` | Tactical directives |
| `renderNewsIntake()` | `#sentimentPanel` | 4-column news count grid (OFF/EN/BM/ZH) + items |
| `renderOfficialPulse()` | `#officialPulse` | Census sync block (needs `payload.openDosmStats`) |
| `renderAirportStats()` | `#airportStats` | Flight tracker with arrival/departure breakdown |
| `renderSatelliteDeck()` | `#satelliteGrid`, `#satelliteMeta` | 6-card NASA GIBS grid + metadata panel |
| `renderQualitativeIntel()` | `#qualHero`, `#qualObservations`, etc. | Human observations + field checks |
| `renderSourceMatrix()` | `#sourceMatrix`, `#sourceList` | Data provenance + status badges |

---

## Deployment

### GitHub Pages (static demo)
```bash
node build.mjs          # Boots server, fetches data, writes public/api/
# Then push — GitHub Actions deploys public/ to Pages
git add -A && git commit -m "..." && git push
```

The CI workflow (`deploy.yml`) also runs `node build.mjs` before uploading to Pages, and refreshes every 6 hours via cron. The `AQICN_TOKEN` secret is needed for APIMS ground AQI data.

### Fly.io (live)
```bash
fly deploy              # Builds Docker image, deploys to Singapore
```

### Local dev
```bash
node server.mjs         # Live server on http://127.0.0.1:3000
# Or for static preview:
node build.mjs && npx serve public
```

---

## Design Rules for This Dashboard

### Visual Identity: "Liquid Glass" HUD
- **Dark mode default**: `#010203` background, cyan (`#00f3ff`) accent, grid texture overlay
- **Light mode**: `#f5f7fa` background, blue (`#0077b6`) accent — same layout, no grid texture
- **Typography**: JetBrains Mono for data/labels, Manrope for headings
- **No rounded corners**: Everything sharp — this is a control room, not a SaaS app
- **Glow on data**: Key values get `text-shadow: 0 0 5px var(--cyan-glow)`
- **Severity colors**: Red = danger/critical, Amber = warning/watch, Green = normal/good, Cyan = data/reference
- **Grid texture**: `40px` repeat, `opacity: 0.15` on dark, `0.06` on light

### Content Rules
- **Every number must be sourced** — no made-up statistics
- **Fallback data must be realistic** — based on actual Kuching conditions
- **News items must be real** — real headlines from real publications
- **Directives must be actionable** — "Sweep Penrissen drains" not "Consider drainage"
- **Three languages**: English, Bahasa Malaysia, Mandarin Chinese
- **Partner logos always visible**: PMUA, depa, Axiom, ReTL, Smart City Thailand, ASCN

### What to Never Do
- Don't add a left sidebar (it was killed intentionally for map dominance)
- Don't use placeholder text anywhere — every label must mean something
- Don't use the default Tailwind blue (`#3B82F6`) — the palette is cyan/amber/red/green
- Don't add rounded corners to panels or cards
- Don't make the map smaller — it should dominate the center
- Don't break the 3-tier data loader pattern — always add fallbacks
- Don't gitignore `public/api/` — the pre-built data is the baseline for Pages

---

## Key Files Quick Reference

| When you need to... | Edit this file |
|---------------------|----------------|
| Add a new data source | `server.mjs` (loader + buildDashboard) + `app.js` (buildFallbackDashboard) |
| Add a new map layer | `server.mjs` (Overpass query) + `data.js` (URBAN_LAYERS) + `app.js` (renderUrbanLayerToggle) + `build.mjs` (layer fetch) |
| Add a new KPI metric | `server.mjs` (buildMetricCards) + `app.js` (buildMetrics in fallback) |
| Add a new directive rule | `server.mjs` (buildOperations) + `app.js` (buildOperations in fallback) |
| Change the layout | `public/index.html` (structure) + `public/styles.css` (grid) |
| Add a new satellite layer | `data.js` (buildSatelliteCards — add GIBS layer ID) |
| Add a new language | `data.js` (TRANSLATIONS object — add new locale key) |
| Add a new partner logo | `public/assets/` (image) + `index.html` (img tag in partner-row) + `data.js` (SITE.partners) |
| Fix empty panels on Pages | `app.js` (buildFallbackDashboard — add the missing field) |

---

## People

- **Daniel Goh** — Secretary of Padawan Municipal Council. The primary user. This dashboard is built for him to present to stakeholders.
- **Dr Non (Arkaraprasertkul)** — Creator. Anthropologist-architect at Thailand's depa. Designs the system, drives all Claude Code sessions.
- **Partners**: depa (Thailand), PMUA, Axiom, ReTL, Thailand Smart City Office, ASEAN Smart Cities Network

---

## Geographic Context

- **Greater Kuching**: 3 municipal councils — DBKU (Kuching North, 369 km²), MBKS (Kuching South, 62 km²), MPP (Padawan, 984 km²)
- **Total area**: ~1,415 km² — Padawan alone is 69.5% of this
- **Population**: ~800,000 across the metro area
- **Airport**: Kuching International (KCH/WBGG), coordinates [1.4847, 110.347]
- **Key areas**: Waterfront, Satok, Padungan, Petra Jaya, Batu Kawa, Kota Padawan, Siburan
- **River**: Sarawak River divides North (DBKU) from South (MBKS)
- **Focus point**: Padawan (MPP) — the growth ring, where the metro story changes
