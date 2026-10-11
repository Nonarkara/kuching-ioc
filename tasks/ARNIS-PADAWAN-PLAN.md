# Arnis buildings for Padawan — implementation plan

Status: approved by the user on 11 October 2026; implementation in progress.

## User review required

Two distinct deliverables: a real Arnis-generated Minecraft walkthrough and an optional geographic building layer in the existing dashboard. The dashboard layer uses geographic footprints, not Minecraft blocks, and must not be labelled an Arnis-rendered mesh.

Start with a roughly 1.2 km² pilot around the mapped MPP office in Kota Padawan. The pre-bake landmark check located OSM townhall way 958011498 at 1.4276737, 110.3257780, south of the dashboard's generic focus. Verified pilot bounds: south 1.4225, west 110.3205, north 1.4325, east 110.3305. This rectangle is not the municipal boundary. The landmark is community-mapped, not a surveyed control point. Expand through dated, adjoining chunks after pilot acceptance.

Use the official free local Arnis v3.3.0 release, not the paid online generator. Pin the release and artifact checksum. Actual Minecraft walkthrough verification requires a compatible game client; world-file generation alone is not visual acceptance.

## Sacred items and invariant

Preserve Leaflet 2D, Cesium 3D, gauges, drainage, satellite layers, charts, readable brief and EN/BM/ZH manual. Do not migrate the dashboard to another map engine or add a second 3D canvas.

Every displayed building must trace to a dated footprint. Heights carry their source: explicit height, level-derived estimate or explicitly labelled default estimate. Missing coverage is not empty land. No decorative buildings, cars or invented field conditions.

## Proposed changes

- NEW scripts/arnis/generate-padawan.mjs: invoke the pinned official Arnis binary locally; save bounds, projection, scale, inputs, options, attribution, output hashes and world metadata. Keep large world files outside the web bundle and model generation outside CI.
- NEW scripts/arnis/bake-buildings.mjs: normalize the dated OSM/Overture inputs into GeoJSON; validate rings/holes, metres, height bases and bounds; handle duplicate footprints and building parts without stacked duplicate solids.
- NEW public/data/buildings/padawan-pilot.geojson and manifest.json: compact pilot footprint asset with counts and provenance. Do not publish this as surveyed building inventory.
- NEW public/buildings-3d.js: Cesium-native geometry in its existing depth buffer, dedicated collection, safe selection text and graceful load-failure state. Preserve the existing operational entity collection on refresh.
- MODIFY public/app.js: lazy 3D Buildings toggle, pilot camera framing, on/off and scope handling. Keep 2D as the reliable fallback; show pilot extent.
- MODIFY public/index.template.html, public/data.js and public/reading.css: readable EN/BM/ZH controls and source/estimated-height/coverage explanation, without replacing current content.
- MODIFY public/operator-guide.js: distinguish geographic building context from an Arnis walkthrough and from flood modelling.
- NEW tests/buildings-3d.test.mjs: geometry, height provenance, duplicates, bounds, projection and failure-state fixtures.

## Verification and rollout

1. Confirm actual pilot footprint coverage using Arnis's tile archive/Overture path; direct Overpass probes returned HTTP 429 and 406. Do not report counts until verified.
2. Generate the Arnis pilot with repeatable manifest and no decorative props; verify world structure and landmarks. Preserve exact projection metadata rather than copying old linear teleport formulas.
3. Validate building geometry, missing-height labels and source attribution; compare selected landmarks with the basemap/field reference. Neither model is a flood-depth simulation.
4. Exercise buildings on/off, gauges, drainage, camera framing and return to 2D on desktop and phone. Test 1280/768/375px, all three languages, fallback/error states and repeated refreshes.
5. Measure payload size/render cost; load the pilot on demand only. Expand coverage after performance and geographic acceptance, not by dumping the full municipality into one file.
6. Run existing and new tests, commit, push, deploy, compare served asset hashes and verify live browser interactions. Report separately whether the Arnis world was generated and visually walked through.

## Verified references

- Official project and source: https://arnismc.com/ and https://github.com/louis-e/arnis
- Pinned release: https://github.com/louis-e/arnis/releases/tag/v3.3.0
- Actual release CLI includes Overture, saved JSON inputs, tile archive, one-world projection and preview flags: https://raw.githubusercontent.com/louis-e/arnis/v3.3.0/src/args.rs
- Existing map supports native extruded polygon geometry: https://cesium.com/learn/cesiumjs/ref-doc/PolygonGraphics.html

The 3D-city skill separates the Minecraft walkthrough from the operational map. This project keeps Cesium, rather than the skill's greenfield MapLibre recipe, to preserve its existing 3D map and one-renderer invariant.
