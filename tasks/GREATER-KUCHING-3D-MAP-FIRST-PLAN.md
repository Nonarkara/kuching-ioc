# Greater Kuching buildings and map-first interface

Status: approved by “This is good: Further upgrade the system…” · 15 October 2026
Baseline: clean main at ea95dae; origin/main matches. No implementation edits made.

Execution note: regional bounds extend south to 1.14 to include the existing
Padawan scope as well as the Greater Kuching rectangle. This is a data extract
envelope, not an official administrative boundary. The install-help observer in
public/web-app.js also needs a one-line nested-toolbar adjustment to preserve it.

## Review required

- Preserve Leaflet and Cesium, all operational overlays, gauges, charts, tickers,
  trilingual manual, partner attribution and existing Arnis download.
- Assume “parliament” means the new Sarawak State Legislative Assembly (DUN).
  Do not buy or redistribute a paid model without separate permission.
- Building coverage means available mapped footprints throughout the configured
  Greater Kuching extent, not a claim that every physical building is mapped.
- Keep readable type and 44px phone targets. Condense the controls, not their hit areas.

## Findings and conservation law

Live browser measurements on 15 October, fresh page:
- 390×844: masthead 411.44px; map canvas starts at y=2912.96px.
- 1440×900: masthead 142.59px; map canvas starts at y=787.08px.
- Later reading.css and brand.css rules override the compact styles.css rules.
  operator-guide.css also inserts a full shortcut block before the map on phones.
- Existing building layer loads only the validated 609-footprint pilot.

Invariant: buildings remain a separately owned native Cesium layer; operational
refreshes cannot erase them, and failed building data cannot disable the 2D map.

Design read: a municipal map workbench, with the city visible before the controls;
reference Vignelli's transit-map hierarchy. The map is the dominant element.

## Proposed surgical changes

1. Interface: public/index.template.html, public/reading.css, public/brand.css,
   public/operator-guide.js and .css, public/app.js, public/data.js.
   Put a short title, scope and a single tools disclosure in one compact header.
   On phones, use one 44–48px row, with full-size controls inside the disclosure.
   Put the map before briefing, metrics, news and shortcuts on the phone.
   Move secondary map/layer controls and building evidence into disclosures.
   Keep manual, install help, theme, reading-size and EN/BM/ZH reachable.
   Desktop header target <=40px at normal text size; phone map visible within
   the first 180px. Large-text mode may grow rather than clip controls.
  Execution accessibility adjustment: final desktop header46px retains a44px
  Tools target; phone header48px. Do not return to22px buttons to meet the old target.

2. Regional data: new scripts/arnis/bake-area.mjs; scripts/arnis/package.json
   and lock if needed; new public/data/buildings/greater-kuching/ tile assets
   and manifest. Read a pinned Overture release through PMTiles range requests,
   reuse validated footprint/height parsing, archive hashes and source credits.
   Publish bounded local tiles instead of making dashboard users depend on the
   upstream inspection service. Manifest lists bounds, release date, tile sizes,
   counts, missing tiles and height provenance. No monolithic MPP GeoJSON.

3. Runtime: new public/building-tiles.js, targeted public/buildings-3d.js and
   public/building-geometry.js edits. Fetch only detailed visible tiles; cap
   concurrent requests, cache bytes and rendered geometry; unload offscreen
   geometry; deduplicate borders/IDs and reject invalid geometry. Debounce camera
   movement and discard stale responses. At broad zoom show coverage/zoom-in
   guidance, not all metropolitan buildings at once. Preserve the pilot and
   2D fallback. Show source release age separately from fetch/cache age.

4. DUN: inspect actual OSM building parts/heights/roof data and reusable licensed
   landmark assets. Add a named camera destination and sourced native geometry
   or a verified reusable model. Do not invent an accurate roof or surveyed
   height. If only an approximation is feasible, identify it explicitly and
   report the limit rather than presenting a generic extrusion as a detailed twin.

5. Evidence: tests/buildings-3d.test.mjs, new tests/building-tiles.test.mjs,
   tests/typography.test.mjs; update CLAUDE.md and result notes after verification.
   Generated index/API artifacts change only through the existing build.

## Verification

- Automated tile intersection/bounds, seams/duplicates, holes, height estimates,
  cache limits/eviction, cancellation, source failure and operational refresh tests.
- Browser at 360/390/768/1440px; measure header and map start, no document overflow;
  keyboard tools/manual flows and EN/BM/ZH. Exercise pan beyond the pilot,
  DUN destination, building inspection, 2D round-trip and unavailable tiles.
- Count downloaded/rendered buildings only after actual data checks; do not infer
  completeness from a green test or a tile rectangle.
- Run full tests/build, inspect screenshots, commit/push/deploy and verify actual
  asset bodies on canonical then custom domain, followed by live browser flows.
- Physical phone and licensed detailed model availability remain separate checks.

## Prior art

- Existing Cesium CustomDataSource pilot and Arnis tile decoder in this repository.
- https://docs.overturemaps.org/examples/overture-tiles/ (range-addressable tiles;
  upstream tiles are inspection data, not a production basemap).
- https://github.com/protomaps/PMTiles (archive/range access).
- https://github.com/reearth/reearth-buildings (Overture to native Cesium 3D Tiles;
  prior art only, not permission to add a new cloud service).

No file collapse >30%, engine replacement, paid purchase, or extra cloud service
is proposed. Implementation starts after approval under planning-discipline.
