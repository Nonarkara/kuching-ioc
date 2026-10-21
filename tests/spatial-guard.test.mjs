import test from "node:test";
import assert from "node:assert/strict";
import {
  isValidCoord,
  detectInvertedCoord,
  isValidSarawakCoord,
  isValidKuchingCoord,
  sanitizeMarkerCoord,
  clampRegionBounds,
  filterViewportSamples,
  BORNEO_THEATER,
  SARAWAK_BOUNDS,
  GREATER_KUCHING_BOUNDS,
} from "../public/spatial-guard.js";

test("isValidCoord rejects Null Island, non-numbers, and out-of-domain coordinates", () => {
  assert.equal(isValidCoord(1.55, 110.35), true, "valid Kuching coordinate passes");
  assert.equal(isValidCoord(0, 0), false, "Null Island [0, 0] must be rejected");
  assert.equal(isValidCoord(0.00001, 0.00001), false, "Near-zero Null Island must be rejected");
  assert.equal(isValidCoord(null, 110.35), false, "null latitude rejected");
  assert.equal(isValidCoord(1.55, undefined), false, "undefined longitude rejected");
  assert.equal(isValidCoord(NaN, 110.35), false, "NaN latitude rejected");
  assert.equal(isValidCoord(1.55, Infinity), false, "Infinity longitude rejected");
  assert.equal(isValidCoord("1.55", "110.35"), false, "strings rejected (must be numbers)");
  assert.equal(isValidCoord(95, 110.35), false, "lat > 90 rejected");
  assert.equal(isValidCoord(-95, 110.35), false, "lat < -90 rejected");
  assert.equal(isValidCoord(1.55, 185), false, "lon > 180 rejected");
  assert.equal(isValidCoord(1.55, -185), false, "lon < -180 rejected");
});

test("detectInvertedCoord catches accidentally swapped latitude and longitude", () => {
  const normal = detectInvertedCoord(1.55, 110.35);
  assert.equal(normal.inverted, false);
  assert.equal(normal.correctedLat, 1.55);
  assert.equal(normal.correctedLon, 110.35);

  const swapped = detectInvertedCoord(110.35, 1.55);
  assert.equal(swapped.inverted, true);
  assert.equal(swapped.correctedLat, 1.55);
  assert.equal(swapped.correctedLon, 110.35);
});

test("isValidSarawakCoord enforces Sarawak state and regional Borneo theater bounds", () => {
  // Within Sarawak
  assert.equal(isValidSarawakCoord(1.55, 110.35), true, "Kuching is in Sarawak");
  assert.equal(isValidSarawakCoord(4.39, 113.99), true, "Miri is in Sarawak");
  assert.equal(isValidSarawakCoord(2.30, 111.83), true, "Sibu is in Sarawak");

  // Outside Sarawak, within Borneo
  assert.equal(isValidSarawakCoord(-0.02, 109.34), false, "Pontianak (Kalimantan) is not in Sarawak bounds");
  assert.equal(isValidSarawakCoord(-0.02, 109.34, { allowBorneo: true }), true, "Pontianak is in Borneo theater");

  // Outside Borneo completely
  assert.equal(isValidSarawakCoord(3.13, 101.68), false, "Kuala Lumpur (Peninsular) is outside Sarawak");
  assert.equal(isValidSarawakCoord(3.13, 101.68, { allowBorneo: true }), false, "Kuala Lumpur is outside Borneo theater");
  assert.equal(isValidSarawakCoord(51.50, -0.12), false, "London is completely out of bounds");
});

test("isValidKuchingCoord enforces Greater Kuching & Padawan territory", () => {
  assert.equal(isValidKuchingCoord(1.51, 110.28), true, "Batu Kawa is in Greater Kuching");
  assert.equal(isValidKuchingCoord(1.47, 110.33), true, "Kota Sentosa is in Greater Kuching");
  assert.equal(isValidKuchingCoord(1.36, 110.40), true, "Siburan is in Greater Kuching");

  // Miri is Sarawak, but NOT Greater Kuching
  assert.equal(isValidKuchingCoord(4.39, 113.99), false, "Miri is outside Greater Kuching");
});

test("sanitizeMarkerCoord corrects inversions and enforces theater contexts", () => {
  // Inverted Kuching coordinate: auto-corrected
  const fixed = sanitizeMarkerCoord(110.35, 1.55, { context: "kuching" });
  assert.equal(fixed.ok, true);
  assert.equal(fixed.lat, 1.55);
  assert.equal(fixed.lon, 110.35);
  assert.equal(fixed.wasInverted, true);

  // Null Island rejected
  const nullIsland = sanitizeMarkerCoord(0, 0);
  assert.equal(nullIsland.ok, false);

  // String coordinates parsed
  const strCoord = sanitizeMarkerCoord("1.55", "110.35", { context: "kuching" });
  assert.equal(strCoord.ok, true);
  assert.equal(strCoord.lat, 1.55);
  assert.equal(strCoord.lon, 110.35);

  // Outside theater rejected
  const outside = sanitizeMarkerCoord(51.5, -0.1, { context: "sarawak" });
  assert.equal(outside.ok, false);
});

test("clampRegionBounds prevents horizon blowout and handles degenerate envelopes", () => {
  const region = { south: 1.14, north: 1.75, west: 110.10, east: 110.60 };

  // Blown-out horizon box
  const horizon = { south: 1.20, north: 25.0, west: 100.0, east: 120.0 };
  const clamped = clampRegionBounds(horizon, region);
  assert.deepEqual(clamped, { south: 1.20, north: 1.75, west: 110.10, east: 110.60 });

  // Completely disjoint box returns null
  const disjoint = { south: 10.0, north: 20.0, west: 100.0, east: 105.0 };
  assert.equal(clampRegionBounds(disjoint, region), null);
});

test("filterViewportSamples strips off-globe and horizon ray projections", () => {
  const region = { south: 1.14, north: 1.75, west: 110.10, east: 110.60 };
  const rawSamples = [
    [110.35, 1.55], // Kuching center (valid)
    [110.32, 1.52], // Batu Kawa (valid)
    [118.50, 22.30], // Horizon ray into South China Sea / space (hallucination)
    [100.00, 1.50],  // West off-globe sample (hallucination)
  ];
  const filtered = filterViewportSamples(rawSamples, region);
  assert.equal(filtered.length, 2, "only 2 local points survive filter");
  assert.deepEqual(filtered[0], [110.35, 1.55]);
  assert.deepEqual(filtered[1], [110.32, 1.52]);
});
