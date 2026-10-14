# Padawan pilot reproduction

Two deliverables, not interchangeable:

- Browser model: EPSG:4326 OSM/Overture footprints, flat ground, explicitly estimated 6 m heights.
- Minecraft model: real pinned Arnis output with its own terrain/projection metadata, structurally checked, not play-tested.

## Rebuild geographic assets without refetching

Run from the repository root:

```sh
npm ci --prefix scripts/arnis --ignore-scripts
node scripts/arnis/bake-buildings.mjs scripts/arnis/inputs/source-overpass.json
node scripts/arnis/supplement-overture.mjs scripts/arnis/inputs/overture 2026-09-23.1
node --test tests/*.test.mjs
```

The source archive deliberately includes the dated Overture vector tiles fetched by Arnis. These permit reproduction even after the upstream release is retired. Manifest SHA-256 values trace the input and derived assets. Both sources are public mapping data; unneeded OSM contact tags are not displayed by the layer.

## Regenerate the actual world locally

Download the official macOS universal v3.3.0 archive from the URL in pilot.mjs, extract it into a task-specific directory and retain the archive. The runner checks both archive and binary digests before execution:

```sh
node scripts/arnis/generate-padawan.mjs /absolute/path/arnis-mac-universal /absolute/path/arnis-mac-universal.tar.gz
```

No model generation runs in CI. The runner writes its private working world beneath scripts/arnis/.local, then packages a verified ZIP under the 24 MiB static-file budget. Use --package-only to repackage an existing generated world without adding another Arnis area. Do not blindly rerun One World over an existing area.

The supplied ZIP is the real 4,900-chunk pilot, not a manifest placeholder. The saved world metadata defines Web Mercator coordinates and block scale; no approximate GPS-to-teleport formula is presented as exact.

## City footprints

`bake-city-buildings.mjs` reads the public Overture buildings PMTiles (OSM, Microsoft ML Buildings, Google Open Buildings), clips them to the dashboard jurisdiction sketches, and writes gzip tiles plus `public/data/buildings/city-index.json`. Heights use a tagged value, otherwise storeys × 3.2 m, otherwise a type default. The Sarawak State Assembly complex is left out of the boxes. `build-assembly-model.mjs` writes the hand-modelled GLB. Neither script runs in CI. Overpass height tags are merged only when a public Overpass server answers.

```sh
node scripts/arnis/bake-city-buildings.mjs
node scripts/arnis/build-assembly-model.mjs
```

## Data limits

The mapped MPP townhall landmark is OSM way 958011498, not a surveyed control point. The pilot rectangle is about 1.2 km² and is not the municipal boundary.

OSM input has 53 accepted footprints; the browser supplements these with 556 filtered Overture features from release 2026-09-23.1. All 609 lack height attributes and are explicitly rendered as default 6 m estimates. Overture detector footprints can contain false positives or outdated buildings. No invented extra buildings are added.

Arnis reported 583 added Overture buildings in its generation path, which includes its own padded generation bounds and filtering. Browser and Minecraft counts need not agree; they are different representations and are not labelled as the same mesh.

Keep provider attribution visible. Licence/source details: https://docs.overturemaps.org/attribution/ and https://www.openstreetmap.org/copyright .
