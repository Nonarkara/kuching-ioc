# Greater Kuching Intelligent Operation Center (IOC)

> **Code playbook:** `BEST-PRACTICES.md` in this directory — 16 cross-project code rules every codebase follows. Read on first open.

Daniel Goh's municipal intelligence dashboard for Greater Kuching, Sarawak. Demo-grade civic software for one named secretary — every panel shows a live reading, a baked snapshot, or a sourced fallback. No placeholders, no theatre.

**Live:** https://kuching.nonarkara.org · **Repo:** Nonarkara/kuching-ioc · **Stack:** Node 20+ static + Leaflet 1.9.4 (2D) + CesiumJS 1.121 (3D, ArcGIS imagery, no Ion token).

---

## Modes of operation

| Mode | URL | Source |
|---|---|---|
| Static snapshot (production) | `kuching.nonarkara.org` | `public/` deployed to Cloudflare Pages |
| Live API (local) | `http://localhost:3000` | `node server.mjs` |
| Static preview | `http://localhost:9876` | `node build.mjs` then `npx serve public` |

Three-tier loader in `public/app.js → loadDashboardPayload()`:
1. `fetch /api/dashboard` — same-origin live server
2. `fetch ./api/dashboard.json` — baked snapshot (what Pages serves)
3. `buildFallbackDashboard()` — `public/data.js` constants + CORS APIs

**Add a field on the server → add it to `buildFallbackDashboard()` too**, or the panel silently skips on Pages when the snapshot is stale.

---

## Layout (one-screen command board, 28 Sep 2026)

Desktop (>1040px) fills exactly one viewport. The page never scrolls; each column scrolls inside itself.

```
MASTHEAD  · title + status line · scope · 2D/3D · text · theme · lang · runtime · logos   (~70px)
TICKER    · headlines                                                                     (26px)
VERDICT   · verb · why · chips                                                            (~40px)
┌ .col-now ─────────┬ .col-map ─────────────────────────┬ .situation-rail ┐
│ brief (3 blocks)  │ metric strip (6 KPIs)              │ flood action     │
│ insights          │ MAP (takes the remaining height)   │ gauges · wards   │
│ news rail         │ .deep-tray tabs: Outlook · Growth · │ directives …     │
│                   │   Localities · Economy · Sources    │                  │
└───────────────────┴────────────────────────────────────┴──────────────────┘
FOOTER    · operator shortcuts + disclaimer · telemetry heartbeat · KEYS · SHARE BRIEF    (~30px)
```

- Phones/tablets (<=1040px): `.col-now` and `.col-map` are `display: contents`; grid areas restore the stacking order brief → insights → metrics → map → rail → news → tray. Keep `grid-template-columns: minmax(0,1fr)` there or a 1240px rule squeezes everything into a 260px column.
- The tray replaced the old below-the-fold `details.deeper-brief`. Open a pane from code with `el.dispatchEvent(new Event("tray:show", {bubbles:true}))` (`setupDeepTray()` in app.js).
- All one-screen rules live in one block at the end of `styles.css` ("ONE-SCREEN COMMAND BOARD"). Type there: 20 display / 13 body / 11 micro.

**Catchment Story** is the keystone computed view — click any gauge and one card states the chain: gauge → ground → exposed → next 72h → why → act → last time. Sits as a corner overlay inside the map, never a full-width bar.

---

## Renderers in `public/app.js` (~4980 lines, ~60 render/build fns)

| Renderer | Target | Reads from payload |
|---|---|---|
| `renderVerdict` / `renderInsights` | `#verdictStrip` / `.insights-bar` | `summary`, derived cross-domain insights |
| `renderMap` / `renderLayerToggle` / `renderUrbanLayerToggle` | `#mapCanvas` | `layers`, `infobanjir`, `airport`, `urbanGrowth` |
| `renderCatchmentStory` | `#catchmentStory` | `infobanjir.stations[].affectedEstimate,lastEvent` |
| `renderCesiumEntities` | `#map3d` | `jurisdictions`, `airport`, `infobanjir` |
| `renderForecastRail` / `renderFloodForecast` | `#forecastRail` / `#floodForecast` (tray: outlook) | `forecast` |
| `renderGrowthStory` | `#growthStory` (tray: growth) | `urbanGrowth`, `alphaEarth` |
| `renderLocalityKpis` / `renderLocalitySummary` / `renderLocalityList` | `#localityExplorer` (tray: localities) | `localities` |
| `renderIntelPanel` / `renderGroundPulse` / `renderNewsIntake` / `renderNewsDigest` / `renderEconBand` / `renderTrendsBand` | tray: economy | `news`, `exchange`, `trends` |
| `renderSourceMatrix` / `renderSourceList` | `#sourceMatrix` / `#sourceList` (tray: sources) | `sources[]` |
| `renderFloodAction` / `renderHydroGauges` / `renderFloodMatrix` | `.situation-rail` | `infobanjir` |
| `renderBriefStrip` / `renderOperations` / `renderPosture` | `.col-now` brief + rail | derived |
| `renderCitizenReports` / `renderOfficialPulse` / `renderMppCouncillors` | `.situation-rail` | `cityReports`, `govStats`, `councillors` |
| `renderAirportStats` / `renderEventsStack` / `renderTelemetryStrip` | rail + footer | `airport`, `events` |
| `renderBypassTracker` | intel | `bypass` |
| `renderWardBrief` / `renderWardProjectsHTML` | rail | `wards`, `MPP_WARD_PROJECTS` |
| `renderRuntimeMeta` / `renderScopeToggle` / `renderDimensionToggle` / `renderTextScaleToggle` | masthead | boot + state |

Helpers: `dataHealth()` in `public/data-health.js` (UI coverage check — not a flood model or agency freshness standard). Operator guide: `public/operator-guide.js` + `public/operator-guide.css` (native `<dialog>` with EN/BM/ZH instructions, opens via the "How to use" manual button; `?` opens the `#helpOverlay` keyboard shortcuts modal).

---

## Data sources (server.mjs ≈ 4250 lines, ~31 sources)

| Source | Role | CORS | TTL |
|---|---|---|---|
| Open-Meteo (forecast + air quality) | weather, AQI, PM | yes | live |
| OpenSky | KCH-area ADS-B | yes (rate-limited) | live |
| USGS | regional quakes | yes | 1h |
| NASA GIBS | satellite tiles | yes (image URLs) | daily |
| ExchangeRate API | MYR FX | yes | live |
| DID Sarawak iHYDRO | river gauges (15 MPP focus) | no | 15min |
| NASA FIRMS | fire hotspots | no | 30min |
| Google News / Trends RSS | press, trends | no | 15-30min |
| MBKS / MPP / DBKU sites | municipal scrape | no | 15min |
| MetMalaysia | warnings | no | 15min |
| DOSM + Sarawak CKAN | census / open stats | no | 6h |
| OSM Overpass | drainage/transit/land use | no | 6h |
| AQICN (APIMS) | ground AQI (token improves) | no | 15min |
| City Reporter Supabase | citizen reports (optional) | no | live |
| TimesFM | 14-day p10/p50/p90 forecast | local-only pipeline | nightly |
| AlphaEarth | satellite Δ 2017→latest | local-only pipeline | annual |

No-CORS sources exist on Pages only as baked JSON or `buildFallbackDashboard()` stubs. `public/api/` is committed and **must not** be gitignored.

Local-only pipelines (`scripts/forecast/.venv`, `scripts/alphaearth/.venv`, `scripts/alphaearth/raw/`) are gitignored — CI never runs them, only bakes their committed outputs.

---

## Map

- **Library**: Leaflet 1.9.4 (CDN), bounds locked `[[1.15, 109.9], [1.85, 110.7]]`, zoom 10–18
- **Default view**: `[1.53, 110.35]` zoom 12
- **Base tiles**: CartoDB Dark (default), CartoDB Light, OSM Street, Esri Satellite
- **Overlays**: 3 jurisdiction polygons, Sarawak River polyline, 10 local markers, hydro + airport + citizen-report markers
- **Urban layers** (toggleable): Land Use, Flood Risk, Drainage, Transit (GeoJSON in `public/api/layers/`)
- **3D**: CesiumJS 1.121, ArcGIS imagery — **no Cesium Ion token** required
- **Coordinate HUD**: hover shows lat/lng 6 d.p. bottom-left, click snaps (amber), COPY writes `"lat, lng"` to clipboard (green) — for field ops sharing via WhatsApp/Telegram
- **Catchment routing**: drainage layer active + gauge click → highlights upstream segments

### 3D buildings (Kota Padawan pilot)

- **Loader**: `public/buildings-3d.js` is loaded as an ES module after Cesium is ready; it adds a CustomDataSource to the existing viewer so operational markers stay intact on refresh.
- **Pilot data**: `public/data/buildings/padawan-pilot.geojson` + `manifest.json` + `world-manifest.json`. The pilot is a 1.2 km² rectangle around the MPP office (`bounds: south 1.4225 / west 110.3205 / north 1.4325 / east 110.3305`).
- **Source**: OpenStreetMap (way ids validated) + Overture Maps 2026-09-23.1 release, 4 vector tiles at z=14, supplemented via `scripts/arnis/supplement-overture.mjs`. Heights are Overture `height` when present, otherwise `min_height + 3m × levels`, otherwise a 6 m default — the source is recorded on every feature.
- **Minecraft world**: the Arnis v3.3.0 generator output is bundled as `data/buildings/kota-padawan-arnis.zip` and downloadable from the bottom bar. The world file is structurally checked (header, level.dat, region layout) but **not** game-play tested; the dashboard model is independent of the Minecraft blocks.
- **Limit**: the pilot covers 609 footprints. The secretary asked for the full Greater Kuching extent. The path to that is documented in §"3D coverage roadmap" below.

### 3D coverage roadmap (full Greater Kuching)

**15 October implementation:** the historical proposal below is superseded by
the regional extract and bounded loader described here. Do not build the proposed
984 km² single GeoJSON or treat cache age as source freshness.

- `scripts/arnis/bake-area.mjs` extracts the pinned Overture 2026-09-23.1 release
  through PMTiles range reads. Local dependencies are pinned in scripts/arnis;
  `npm ci --prefix scripts/arnis --ignore-scripts` then `node scripts/arnis/bake-area.mjs`.
- `public/data/buildings/greater-kuching/manifest.json` inventories 696 same-origin
  tiles over south1.14/west110.10/north1.75/east110.60, the union of the existing
  Padawan and Greater Kuching scope rectangles, **not an official council boundary**.
  307,684 distinct source building IDs; 310,878 polygon/part fragments. Most
  heights remain 6m estimates. All tiles have source hashes, bounds and dates.
- `public/regional-buildings.js` uses native Cesium primitives sharing its depth
  buffer. It never clears operational entities. 4 concurrent requests, 25 visible
  tiles, 16MiB per-view input budget, 12,000 visible fragments, 12MiB/48-entry LRU.
  Pan end and viewport resize refresh geometry; stale results cannot render.
  Region/pilot toggles are mutually exclusive. 2D remains available on failure.
- DUN destination is based on the mapped Assembly footprint at110.34786/1.56173,
  OSM way1357531465. Its13 mapped parts replace the coarse parent; pyramidal roofs
  are drawn only with a valid tagged roof height. Roofs are schematic, heights
  source attributes or explicit estimates, not a surveyed architectural twin.
- The entire extract is ~181MB **on storage**, never one upfront download.
  Missing tiles and rejected geometry are recorded; this release has neither.
- `reading.css` owns final layout: Tools holds scope/language/manual/install;
  Map layers holds overlays and evidence; phone map comes before briefs/metrics.
  Do not infer final sizes from earlier styles.css rules or regex tests alone.

**Historical proposal, retained for rationale:**

Greater Kuching bounds: south 1.30 / west 110.10 / north 1.75 / east 110.60 — about 2,750 km² of bounding rectangle (~1,415 km² of council area). One pre-baked GeoJSON of every building in that rectangle is too large to ship: Overture z=14 alone would be ~570 tiles, ~50-200 MB. The on-demand loader is the right architecture.

**Planned architecture (next pass):**

1. `public/buildings-3d.js` keeps the Cesium CustomDataSource pattern but **loads tiles by visible camera rectangle** instead of a single GeoJSON. Watch `viewer.camera.changed`, compute the visible bbox at the current zoom, and fetch only the Overture vector tiles that intersect it.
2. Tiles are cached in a `Map<zxy, { features, fetchedAt }>`. The 3D `World` primitive reuses cached features; a 24 h `freshness` is shown in the bottom-bar buildings status line.
3. A pre-baked `padawan-mpp.geojson` covers the secretary's jurisdiction (984 km²) at z=13 so the most-asked-for extent is in the first request, no network wait.
4. `scripts/arnis/supplement-overture.mjs` is generalised to `scripts/arnis/bake-area.mjs` taking a bbox + zoom; the manifest records total area, feature count by source, and the release hash.
5. Tests: `tests/buildings-3d.test.mjs` (already present) grows to cover the on-demand loader — bbox → tile math, cache eviction, freshness, and the failure path when the Overture CDN is offline.

**Do not** ship a single 50 MB buildings file as the answer; that re-introduces the "deploy on every urban change" cost that the Overture pipeline was designed to avoid.

---

## Design system

| Token | Value |
|---|---|
| Background (light default) | `#f6f5f2` warm paper |
| Background (dark muted) | `#0e1319` deep slate |
| Accent (light default) | `#1f4e79` civic navy — passes 4.5:1 AA |
| Accent (dark) | `#00f3ff` cyan / steel blue |
| Severity | red `#d00036` · amber `#e67700` · green `#00875a` · cyan `#00f3ff` |
| `--font-sans` / `--font-mono` | `"Helvetica Neue", Helvetica, Arial, "Noto Sans SC", "PingFang SC", "Microsoft YaHei"` |
| `--font-display` | `Georgia, "Times New Roman", "Noto Serif SC", "Songti SC", serif` |
| Min text size | 8px (was 7px — fails AA on light cards) |
| Min tap target (≤720px) | 44px |
| Corners | 0 — control room, not SaaS |
| Glow | key values get `text-shadow: 0 0 5px var(--cyan-glow)` |

The Lopburi pass (Sep 2026) replaced JetBrains Mono + Manrope with Helvetica + Georgia. The map and clear action text lead; chrome is quiet.

### Content rules

- Every number has a source — no made-up statistics
- Fallbacks realistic Kuching conditions, not invented drama
- News is real headlines from real publications
- Directives are verbs — "Sweep Penrissen drains" not "consider drainage"
- Three languages: EN / Bahasa Malaysia / Mandarin (`lang` attr on `<html>`, content lives in `data.js → TRANSLATIONS`)
- Partner logos always visible: PMUA, depa, Axiom, ReTL, Smart City Thailand, ASCN

### Hard rules — never do

- Add a left sidebar (killed for map dominance)
- Use placeholder text
- Use Tailwind default blue `#3B82F6`
- Round corners on panels or cards
- Make the map smaller
- Break the 3-tier loader
- Gitignore `public/api/`
- Ship the word "Loading" — use skeleton shimmer instead
- Render an illustrative constant as if it were a measured signal — add `*_ILLUSTRATIVE` flag and badge

---

## Where to edit

| You need to… | Edit |
|---|---|
| Add a data source | `server.mjs` (loader + `buildDashboard`) **and** `app.js` (`buildFallbackDashboard`) |
| Add a map layer | `server.mjs` Overpass query + `data.js` URBAN_LAYERS + `app.js` `renderUrbanLayerToggle` + `build.mjs` layer fetch |
| Add a KPI / directive | `server.mjs` `buildMetricCards` / `buildOperations` + `app.js` fallback builders |
| Change layout | `public/index.template.html` **never** `index.html` (it's generated) + `public/styles.css` |
| Add a locale string | `data.js` `TRANSLATIONS` (en/ms/zh keys must match) |
| Add a partner logo | `public/assets/` + `index.template.html` `partner-row` + `data.js` `SITE.partners` |
| Fix an empty panel on Pages | `app.js` `buildFallbackDashboard` — add the missing field |

---

## Deploy — cpdt

```bash
node build.mjs              # boots :9876, writes public/api/{dashboard,layers/*}.json
git add public/
git commit -m "..."
git push                     # .github/workflows/cloudflare-pages.yml → wrangler
```

Optional env (unset → documented fallback, never a crash): `AQICN_TOKEN`, `FIRMS_MAP_KEY`, `CITY_REPORTER_SUPABASE_URL`, `CITY_REPORTER_SUPABASE_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `GCP_PROJECT_ID`, `PADAWAN_ZONING_KML_URL`, `PAGES_PUBLIC_URL`, `LIVE_IOC_URL`. Secrets live in GitHub repo settings, never in source. Do not bake `FIRMS_MAP_KEY` into `public/api/`.

Local nightly refresh (TimesFM, AlphaEarth) is on the M5 Max only — never CI. Runbook in `tasks/todo.md`.

---

## People & place

- **Daniel Goh** — Secretary of Padawan Municipal Council. The primary user.
- **Dr Non (Arkaraprasertkul)** — Creator. Anthropologist-architect at Thailand's depa.
- **Greater Kuching**: DBKU (369 km²) + MBKS (62 km²) + MPP (984 km²) = ~1,415 km², ~800k pop
- **Airport**: KCH / WBGG at `[1.4847, 110.347]`
- **River**: Sarawak divides North (DBKU) from South (MBKS); MPP wraps south and west
- **Focus**: MPP — the growth ring where the metro story changes

---

## See also

- `README.md` — public landing, ethical-use paragraph, fork guidance
- `context.md` — deployment cheat-sheet (URL, dev/build commands, env table)
- `tasks/lessons.md` — corrections log, read first each session
- `tasks/todo.md` — current work + shipped milestones (rolling)
- `ADMIN-AUDIT.md` — 25 Sep 2026 operator audit, scope + residual limits
