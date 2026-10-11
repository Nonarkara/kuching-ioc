# Arnis Padawan pilot — 11 October 2026

Approved scope: an Arnis walkthrough world and optional native Cesium buildings, not a map-engine replacement or a flood simulator.

## Built and checked before release

- Pilot around mapped MPP office way 958011498 in Kota Padawan, approximately 1.2 km². The landmark check corrected the proposed generic focus before generation.
- Official Arnis v3.3.0 archive and universal binary match pinned SHA-256 digests.
- Actual Java world generated: 16 region files, 4,900 populated chunks, 120 sampled block types. ZIP 8,311,613 bytes; README/source notes included. Structural verifier checks ZIP, NBT and region sectors. Minecraft is not installed here; in-game loading remains unverified.
- Browser model: 609 EPSG:4326 footprints, 53 OSM plus 556 filtered Overture additions from release 2026-09-23.1. All heights are explicitly default 6 m estimates. GeoJSON 297,804 bytes, requested on demand.
- Source inputs are archived under scripts/arnis/inputs. Rebuild from those inputs reproduces the geographic asset hash without refetching.
- Separate Cesium data source preserves operational markers and survives refreshes. Canvas-scoped selection uses safe text and provenance links.
- EN/BM/ZH controls, evidence and manual explanation; estimated heights, pilot extent and flat-ground model limits visible. Credits stay visible.
- 39 Node tests pass. Syntax and whitespace checks pass. Static build completed in 81.7 seconds.
- Browser preview: model rendered over imagery, feature selection showed estimate/source, 2D/3D round trip and hide/show succeeded. 1280, 768 and 375px had no document horizontal overflow. Bahasa and Chinese controls worked; Enter opened provenance.
- Deliberately missing pilot manifest showed an unavailable message and restored 2D. Manifest restored and suite rerun.

## Limits

This is not complete municipality coverage, surveyed building heights, realistic verified façades, or a flood-depth model. Overture detector footprints may be wrong or outdated. Browser and Arnis generation have different clipping/filtering and do not claim identical building counts. Physical phone performance, native-speaker review, Minecraft play and municipal landmark acceptance remain unverified.

Deploy/live acceptance is recorded in the final handoff, not implied by the local checks above.
