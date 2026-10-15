# Map-first geographic city model · 15 October 2026

Implemented locally, preview and tests verified. Public release is held for the
native-language review requested in chat; do not call this live until CPDT runs.

## Verified data

Pinned Overture 2026-09-23.1 PMTiles, using the existing open-data decoder.
307,684 distinct source building IDs in696 local tiles;310,878 rendered fragments
after clipping and mapped building-part expansion. Storage180,960,701 bytes.
No missing tiles or rejected geometry. Inputs are cached in ignored .local;
the public manifest records per-input and output SHA256, CRS, precision and bounds.
Region envelope includes both existing scope rectangles, not a municipal polygon.

Height provenance:310,518 default6m fragments;287 levels-derived estimates;
73 explicit source-height fragments. These are **not** exposed population,
occupancy, engineering survey heights or flood depths.

The Assembly has13 mapped parts (parent OSM way1357531465); only valid tagged
pyramidal roofs receive schematic roof geometry. No paid model purchased.
No fabricated decorative buildings or vegetation. Existing Arnis pilot retained.

## Browser and tests

Measured phone masthead48px; map start~133–152px at390px instead of2913px.
Measured desktop masthead46px after retaining44px keyboard/pointer targets.
At320/360px the map starts at150px; at768px it starts at131px. No document
overflow at320/360/390/768/1280/1440px. Actual 3D Assembly view showed501
mapped pieces over satellite imagery, no console errors. Tools/manual keyboard
flow, EN/BM/ZH controls, install-help presence and 2D return exercised.
See final chat for additional width/failure checks and saved screenshots.

Seven new tests verify language parity; every tile hash, bounds and counts; seam clipping; height
provenance; Assembly parts; LRU; stale work cancellation; unavailable manifest
and 2D fallback. All59 tests pass. Static build contract passed8 artifacts.
The browser missing-manifest404 test also restored2D; manifest was then restored.
The build-tool dependency audit found0 vulnerabilities. The59-test run includes
the existing confidentiality checks; this is not a full security certification.

## Limits and release gate

Not every physical building is mapped. Source geometry is dated, simplified MVT.
Flat ellipsoid ground, not terrain-aligned flood modelling. Roof facets are
schematic, not a laser scan. No municipal coordinate/control-point acceptance,
real-phone hardware test, Minecraft play test or native-speaker approval yet.
`npx axiom-audit . --strict` could not run: package registry returns404; no passing
design-audit claim. Browser inspection and executable layout/data checks used.

## Reproduce

`npm ci --prefix scripts/arnis --ignore-scripts`

`node scripts/arnis/bake-area.mjs`

`node --test tests/*.test.mjs`

`node build.mjs`

On approved release: push main, wait for the documented GitHub Actions Pages
workflow; canonical then custom-domain content-hash probes; live browser flows.
