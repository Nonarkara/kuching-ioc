# Greater Kuching Intelligent Operation Center (IOC)

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

## Renderers in `public/app.js` (~4830 lines, ~60 render/build fns)

| Renderer | Target | Reads from payload |
|---|---|---|
| `renderVerdict` / `renderCascade` / `renderWardRisk` / `renderGrowthStory` | Zone 1/2/3/5 heads | multiple |
| `renderMap` / `renderLayerToggle` / `renderUrbanLayerToggle` | `#mapCanvas` | `layers`, `infobanjir`, `airport`, `urbanGrowth` |
| `renderCatchmentStory` | `#catchmentStory` | `infobanjir.stations[].affectedEstimate,lastEvent` |
| `renderCesiumEntities` | `#map3d` | `jurisdictions`, `airport`, `infobanjir` |
| `renderForecastRail` / `renderFloodForecast` | `#forecastRail` / `#floodForecast` | `forecast` |
| `renderFloodAction` / `renderHydroGauges` / `renderFloodMatrix` | rail | `infobanjir` |
| `renderBriefStrip` / `renderOperations` / `renderPosture` | directive strip | derived |
| `renderCitizenReports` / `renderOfficialPulse` / `renderMppCouncillors` | rail | `cityReports`, `govStats`, `councillors` |
| `renderLocalityKpis` / `renderLocalitySummary` / `renderLocalityList` | locality panel | `localities` |
| `renderIntelPanel` / `renderGroundPulse` / `renderNewsIntake` / `renderNewsDigest` / `renderEconBand` / `renderTrendsBand` | intel panel | `news`, `exchange`, `trends` |
| `renderAirportStats` / `renderEventsStack` / `renderTelemetryStrip` | rail + footer | `airport`, `events` |
| `renderBypassTracker` | intel | `bypass` |
| `renderSourceMatrix` / `renderSourceList` | source panel | `sources[]` |
| `renderWardBrief` / `renderWardProjectsHTML` | rail | `wards`, `MPP_WARD_PROJECTS` |
| `renderRuntimeMeta` / `renderScopeToggle` / `renderDimensionToggle` / `renderTextScaleToggle` | masthead | boot + state |

Helpers: `dataHealth()` in `public/data-health.js` (UI coverage check — not a flood model or agency freshness standard). Operator guide: `public/operator-guide.js` + `public/operator-guide.css` (native `<dialog>` with EN/BM/ZH instructions, opens via `?` keyboard shortcut).

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

---

## Design system

| Token | Value |
|---|---|
| Background (dark) | `#010203` |
| Background (light) | `#f5f7fa` |
| Cyan (dark) | `#00f3ff` |
| Cyan (light) | `#005f94` — passes 4.5:1 AA on `#f5f7fa` |
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

Optional env (unset → documented fallback, never a crash): `AQICN_TOKEN`, `CITY_REPORTER_SUPABASE_URL`, `CITY_REPORTER_SUPABASE_KEY`, `GOOGLE_SHEETS_ID`, `GOOGLE_SERVICE_ACCOUNT_JSON`, `PAGES_PUBLIC_URL`, `LIVE_IOC_URL`. Secrets live in GitHub repo settings, never in source.

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
