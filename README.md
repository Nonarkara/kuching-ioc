# Greater Kuching Intelligent Operation Center

![Manga illustration of a civic operator at dusk overlooking Kuching — Sarawak River, Darul Hana Bridge, and the DUN golden roof. The multi-monitor HUD is artwork, not a screenshot of this software.](docs/hero-banner.png)

The workstation HUD in the banner is **illustration only**. It is not a screenshot of the live board, not a product mock, and not a claim about cameras, classified feeds, or a physical IOC. The running system is a map-dominant web dashboard: [kuching.nonarkara.org](https://kuching.nonarkara.org).

**Live:** [https://kuching.nonarkara.org](https://kuching.nonarkara.org) · **Repo:** [Nonarkara/kuching-ioc](https://github.com/Nonarkara/kuching-ioc)

Built by **Dr Non Arkaraprasertkul** ([@Nonarkara](https://github.com/Nonarkara)) for **Secretary Daniel Goh**, Padawan Municipal Council (MPP) — a working civic board for Greater Kuching, Sarawak, not a generic template.

---

## What this is

A **municipal intelligence dashboard** for Greater Kuching: weather, air quality, river and flood context, KCH airspace, satellite layers, local news, and short directives that say what to do next.

Greater Kuching is three councils on one river — **DBKU** (Kuching North), **MBKS** (Kuching South), and **MPP** (Padawan). Padawan is the growth ring (~984 km², most of the metro area). The board can sit on Padawan or widen to the whole metro.

It is demo-grade civic software that still has to tell the truth: every panel shows a live reading, a baked snapshot, or a **sourced** fallback. No dummy KPIs. No lorem ipsum. No “Ward Command” theatre.

Three delivery modes:

1. **Static snapshot** (production) — Cloudflare Pages at `kuching.nonarkara.org`, JSON baked by `build.mjs` on each push to `main`.
2. **Live API** (local / bake) — `node server.mjs` serves `/api/dashboard`, `/api/health`, and `/api/layers/:id`.
3. **Client fallback** — browser-only path using `public/data.js` plus CORS-friendly APIs when the snapshot is missing.

Languages: English, Bahasa Malaysia, Mandarin. Partner marks on the masthead (depa, PMUA, Axiom, ReTL, Thailand Smart City Office, ASCN) record **this** collaboration. They are not a licence for a fork to wear those crests.

---

## Philosophy

This board is built for one named secretary, not for a pitch deck.

1. **Question every requirement.** Who owns it? What decision does it change this afternoon?
2. **Delete until it hurts.** If you cannot put back at least 10% of what you cut, you did not cut enough. The left rail was killed so the map could dominate.
3. **Simplify only after deletion.** Do not polish a panel that should not exist.
4. **Every number has a source.** If a feed is down, say so. Fallbacks must be realistic Kuching conditions, not invented drama.
5. **Directives are verbs.** “Sweep Penrissen drains,” not “consider drainage.”
6. **The map is the room.** Leaflet 2D is the default operating picture. 3D Cesium is an optional twin (ArcGIS imagery, **no Cesium Ion token**). Bounds stay on Greater Kuching.

Substance over flash. The person reading this in a briefing is not here for glassmorphism.

---

## Ethical use

**This is not an official product of DBKU, MBKS, MPP, or the Government of Sarawak** unless a later document **in this repository** says so in plain language. Collaboration, a named user, and partner logos are not a gazette, a tender award, or an emergency-warning mandate.

- **Decision support, not authority.** MetMalaysia, DID / Infobanjir, the three councils, and police/civil-defence channels outrank this board. If they disagree, they win.
- **Not a warning issuer.** Hydro bands, AQI, fire hotspots, and “ACT NOW” cards are attention tools. They are not a flood warning, a haze declaration, or an evacuation order.
- **Not surveillance infrastructure.** The banner’s CCTV wall is fiction. This repo does not ship camera networks, facial recognition, or classified feeds.
- **Provenance over theatre.** News must be real headlines. Illustrative layers (for example ward-tension styling) must be labelled as such in the UI.
- **Open data, not scraped secrets.** Public meteorological, satellite, aviation, and statistical sources power the bake. Do not add credentials to git. Do not invent API keys in issues or README copy.
- **Forks keep the disclaimer.** If you point this code at another city, do not present it as an official Malaysian, Sarawak, or Thai government system. Do not reuse these partner logos as your endorsement.

*Bukan produk rasmi DBKU, MBKS, MPP, atau Kerajaan Sarawak melainkan dinyatakan dengan jelas di dalam repositori ini.*

---

## How it works

Zero npm runtime dependencies. Node 20+ (`server.mjs`, `build.mjs`) plus static `public/` (HTML/CSS/JS). Leaflet 1.9.4 for 2D; CesiumJS 1.121 from CDN for 3D.

```
server.mjs          live + CI bake; 15+ upstream integrations
build.mjs           boots an ephemeral server, writes public/api/
public/
  index.html        map-dominant shell (verdict → map + rail → intel)
  app.js            renderers + 3-tier loader
  data.js           constants, i18n, honest fallbacks
  api/dashboard.json    committed snapshot (baseline for Pages)
  api/layers/       drainage, transit, land use, flood risk, wards
```

### Three-tier loader

`loadDashboardPayload()` in `public/app.js` tries, in order:

1. `GET /api/dashboard` — same-origin live server (local `node server.mjs` only).
2. `GET ./api/dashboard.json` — baked snapshot (what Pages serves).
3. `buildFallbackDashboard()` — client constants + CORS-safe APIs.

If you add a field on the server, add it to the fallback too, or Pages will silently skip that panel when the snapshot is stale.

### What the bake can see

| Source | Role | Browser CORS |
|--------|------|----------------|
| Open-Meteo | Weather, forecast | Yes |
| Open-Meteo Air Quality | AQI, PM2.5, PM10 | Yes |
| OpenSky Network | KCH-area ADS-B | Yes (rate-limited) |
| USGS | Regional earthquakes | Yes |
| NASA GIBS | Daily satellite tiles | Yes (image URLs) |
| ExchangeRate API | MYR vs a small FX set | Yes |
| NASA FIRMS | Fire hotspots (Malaysia) | No — bake only |
| Google News / Trends RSS | Local press, Malaysia trends | No — bake only |
| MBKS / MPP / DBKU sites | Public municipal pages | No — bake only |
| MetMalaysia | Official weather warnings | No — bake only |
| DOSM + Sarawak CKAN | Census / open stats | No — bake only |
| OSM Overpass | Drainage, transit, land use | No — bake only |
| AQICN / WAQI | Optional ground AQI | Token optional |

No-CORS sources exist on Pages only as baked JSON (or fallback stubs). That is why `public/api/` is committed and must not be gitignored.

Optional extras already in tree: TimesFM forecast as committed `public/api/forecast.json` (not trained in CI); AlphaEarth growth-ring rasters under `public/data/alphaearth/` (runtime reads files, it does not call Earth Engine in the browser).

---

## How to run / fork

Requires **Node.js 20+**. No `npm install` is required to run the board.

### Live (local)

```bash
git clone https://github.com/Nonarkara/kuching-ioc.git
cd kuching-ioc
node server.mjs
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000). Bind/port: `HOST` (default `0.0.0.0`), `PORT` (default `3000`).

### Static snapshot

```bash
node build.mjs          # also: npm run build:static
npx serve public        # or any static file server
```

`build.mjs` starts a throwaway server on port 9876, pulls the payload and GIS layers, and writes `public/api/`.

This repository deploys that `public/` tree to Cloudflare Pages (`kuching-ioc` → `kuching.nonarkara.org`). Forks should use **their own** host. Do not copy another project’s deployment credentials into this tree.

### Optional environment variables

None of these are required to open the dashboard. Unset means a documented fallback, not a crash. **Do not invent additional secrets** and do not commit `.env` files (they are gitignored).

| Variable | Effect when set |
|----------|-----------------|
| `AQICN_TOKEN` | Ground AQI via WAQI/AQICN. Unset → the AQICN public `demo` token already in `server.mjs`. |
| `CITY_REPORTER_SUPABASE_URL` + `CITY_REPORTER_SUPABASE_KEY` | Live civic-report feed. Unset → built-in demo reports. |
| `GOOGLE_SHEETS_ID` + `GOOGLE_SERVICE_ACCOUNT_JSON` | `npm run archive:sheets` appends a bake to Sheets. Unset → script exits 0. |
| `PAGES_PUBLIC_URL` / `LIVE_IOC_URL` | Labels written into the static HTML boot payload. |

Deploy credentials for **this** GitHub Actions workflow live in that GitHub repo’s settings, not in source. Forks do not need them to run locally.

### Adapting a fork

This is a **Kuching-specific product**. A fork is a rewrite of place, not a theme switch.

- Geography and copy: `public/data.js` (`SITE`, jurisdictions, markers, i18n).
- New upstreams: `server.mjs` **and** `buildFallbackDashboard()` in `public/app.js`.
- Keep the ethical-use paragraph. Change the named secretary and councils to yours.
- Leave these partner logos behind unless those organisations actually work with you.
- Do not claim Cesium Ion, Earth Engine, or other keys that this README does not list.

---

## License

Released under the [MIT License](LICENSE). Copyright © 2026 Non Arkaraprasertkul.

MIT covers the software in this repository. It does not transfer municipal authority, partner trademarks, or third-party data licences (NASA, OSM, Open-Meteo, OpenSky, council websites, and the rest remain under their own terms).
