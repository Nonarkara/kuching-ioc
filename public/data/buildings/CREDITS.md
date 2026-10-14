# Building layer credits

Heights are estimates unless a source height tag was present. This is not a survey and not a flood model.

## Footprints

| Source | Use | Licence |
|---|---|---|
| OpenStreetMap | Building footprints and tags carried in the Overture buildings release | ODbL 1.0 — https://www.openstreetmap.org/copyright |
| Overture Maps Foundation, buildings release 2026-09-23.1 | Tiled footprints used by the map | https://docs.overturemaps.org/attribution/ |
| Microsoft ML Buildings | Footprints where OSM has none, via Overture | ODbL, via Overture |
| Google Open Buildings | Footprints where OSM has none, via Overture | CC BY 4.0 / Google Open Buildings terms, via Overture — https://sites.research.google/open-buildings/ |

The public archive read for this bake is `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/2026-09-23.1/buildings.pmtiles`.

Overpass was asked for `height` and `building:levels` on 14 October 2026. The public Overpass servers did not return a city extract (HTTP 504 and timeouts), so those OSM tags are not merged into the tiles. The 9-storey tag on the Assembly was read earlier the same day from OSM way 1357531465 and is recorded on the model, not as a box.

Height rule in the tiles: tagged height, otherwise `building:levels` or `num_floors` × 3.2 m, otherwise a type default (house 6 m, shophouse 10 m, commercial 12 m, and the other types in `public/building-geometry.js`), otherwise 6 m.

## Sarawak State Assembly model

The building is the New Sarawak State Legislative Assembly Building, Petra Jaya, Kuching: OSM way [1357531465](https://www.openstreetmap.org/way/1357531465), Wikidata [Q7011422](https://www.wikidata.org/wiki/Q7011422). Mapped name: Sarawak State Assembly / Dewan Undangan Negeri Sarawak / 新砂拉越州议会大楼.

`dun-sarawak.glb` is a **hand model**, not a photogrammetry mesh and not the output of TripoSR, Hunyuan3D or TRELLIS. This build machine has no GPU. The openly licensed photographs are separate visitor views, not an overlapping survey, so COLMAP/OpenMVS would not have produced a reliable mesh. The roof is the nine-fold golden umbrella interpreted from the photographs below. The plan size follows the OSM footprint (about 108 m across). The roof height is a visual estimate anchored to the OSM tag `building:levels=9` (9 × 3.2 m = 28.8 m to the main mass; the finial is drawn higher). It is not a measured survey.

Generic boxes whose centroids fall inside that OSM footprint are omitted.

### Photographs used as the visual reference

All four are CC BY-SA 4.0 (Creative Commons Attribution-ShareAlike 4.0 International).

| File | Photographer | Page |
|---|---|---|
| Kuching Sarawak Dewan-Undangan-Negeri-Sarawak-01.jpg | CEphoto, Uwe Aranas | https://commons.wikimedia.org/wiki/File:Kuching_Sarawak_Dewan-Undangan-Negeri-Sarawak-01.jpg |
| Kuching Sarawak Dewan-Undangan-Negeri-Sarawak-02.jpg | CEphoto, Uwe Aranas | https://commons.wikimedia.org/wiki/File:Kuching_Sarawak_Dewan-Undangan-Negeri-Sarawak-02.jpg |
| Dewan Undangan Negeri Sarawak (2024).jpg | Medelam | https://commons.wikimedia.org/wiki/File:Dewan_Undangan_Negeri_Sarawak_(2024).jpg |
| Dewan Undangan Negeri Sarawak 2024.jpg | Medelam | https://commons.wikimedia.org/wiki/File:Dewan_Undangan_Negeri_Sarawak_2024.jpg |

Licence: https://creativecommons.org/licenses/by-sa/4.0/

No paid API, no Cesium ion token, and no account that requires a card was used.
