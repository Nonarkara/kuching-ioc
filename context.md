# Greater Kuching IOC — Secretary Goh's Super Dashboard

## Live URLs
- Static snapshot: https://kuching.nonarkara.org (Cloudflare Pages, refreshed every 6h + on push)
- Live API server: https://nonarkara-kuching-ioc-live.fly.dev/ (Fly.io Singapore, auto-scale to 0)
- Local dev: http://localhost:3000

## Repo
GitHub: Nonarkara/kuching-ioc

## Stack
Node.js 20+ (server.mjs — 3000+ line HTTP server, 15+ external APIs)
Pure HTML/CSS/JS frontend — no framework, no bundler
Leaflet 1.9.4 (map), JetBrains Mono + Manrope (Google Fonts)
No build step for frontend — `build.mjs` only builds static JSON snapshots

## Dev (live API mode)
```bash
node server.mjs      # Starts on port 3000
# open http://localhost:3000
```

## Static Build (for Cloudflare Pages)
```bash
npm run build:static  # node build.mjs → public/api/*.json
# Boots ephemeral server on :9876, fetches all data, writes JSON to public/api/
```

## Deploy — Cloudflare Pages (static snapshot, primary)
Automated via GitHub Actions on push to main.
```bash
gh workflow run "Deploy to Cloudflare Pages" -R Nonarkara/kuching-ioc
gh run list -R Nonarkara/kuching-ioc --limit 3
```
CI: `npm ci → node build.mjs → wrangler pages deploy public --project-name=kuching-ioc`

## Deploy — Fly.io (live Node server, Singapore)
```bash
fly deploy           # Region: sin, 256MB RAM, auto-scale to 0
```

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
