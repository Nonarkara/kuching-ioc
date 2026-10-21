// Spatial guard against coordinate hallucinations, Null Island [0,0],
// swapped lat/lon, and horizon-grazing 3D ellipsoid projections.
// Shared across 2D Leaflet, 3D Cesium, and node loaders.

export const BORNEO_THEATER = Object.freeze({
  south: -4.5,
  north: 7.5,
  west: 108.5,
  east: 119.5,
});

export const SARAWAK_BOUNDS = Object.freeze({
  south: 0.8,
  north: 5.0,
  west: 109.5,
  east: 115.8,
});

export const GREATER_KUCHING_BOUNDS = Object.freeze({
  south: 1.0,
  north: 2.0,
  west: 109.8,
  east: 110.8,
});

/**
 * Checks if a coordinate pair contains valid finite numbers on earth,
 * rejecting Null Island [0, 0] and NaN/infinity.
 */
export function isValidCoord(lat, lon) {
  if (typeof lat !== "number" || typeof lon !== "number") return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return false;
  // Null Island rejection: [0, 0] in the Atlantic Ocean off the Gulf of Guinea
  if (Math.abs(lat) < 0.0001 && Math.abs(lon) < 0.0001) return false;
  // Valid terrestrial degree domains
  if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return false;
  return true;
}

/**
 * Identifies if latitude and longitude were accidentally swapped.
 * In Sarawak/Borneo, longitude is ~109-116 and latitude is ~1-5.
 * A coordinate with lat ~110 and lon ~1.5 is an inverted coordinate.
 */
export function detectInvertedCoord(lat, lon) {
  if (lat > 50 && lon < 10 && lon > -10) {
    return { inverted: true, correctedLat: lon, correctedLon: lat };
  }
  return { inverted: false, correctedLat: lat, correctedLon: lon };
}

/**
 * Validates that a point falls within legitimate Sarawak or Borneo bounds.
 * @param {number} lat - Latitude
 * @param {number} lon - Longitude
 * @param {{ allowBorneo?: boolean }} [options] - Allow broader Borneo island (e.g. for FIRMS regional fires)
 */
export function isValidSarawakCoord(lat, lon, options = {}) {
  if (!isValidCoord(lat, lon)) return false;
  const bounds = options.allowBorneo ? BORNEO_THEATER : SARAWAK_BOUNDS;
  return (
    lat >= bounds.south &&
    lat <= bounds.north &&
    lon >= bounds.west &&
    lon <= bounds.east
  );
}

/**
 * Validates that a point falls strictly within Greater Kuching & Padawan territory.
 */
export function isValidKuchingCoord(lat, lon) {
  if (!isValidCoord(lat, lon)) return false;
  return (
    lat >= GREATER_KUCHING_BOUNDS.south &&
    lat <= GREATER_KUCHING_BOUNDS.north &&
    lon >= GREATER_KUCHING_BOUNDS.west &&
    lon <= GREATER_KUCHING_BOUNDS.east
  );
}

/**
 * Sanitizes input coordinate, checking for inversion and enforcing theater boundaries.
 */
export function sanitizeMarkerCoord(rawLat, rawLon, options = {}) {
  const numLat = Number(rawLat);
  const numLon = Number(rawLon);
  if (!Number.isFinite(numLat) || !Number.isFinite(numLon)) {
    return { ok: false, reason: "Non-finite coordinates" };
  }
  // Check for inverted coordinates first (e.g. lat > 50 in Sarawak theater where lat should be ~1.5)
  const inversion = detectInvertedCoord(numLat, numLon);
  const lat = inversion.inverted ? inversion.correctedLat : numLat;
  const lon = inversion.inverted ? inversion.correctedLon : numLon;

  if (!isValidCoord(lat, lon)) {
    return { ok: false, reason: "Invalid or Null Island coordinates" };
  }

  const context = options.context || "sarawak";
  const valid =
    context === "kuching"
      ? isValidKuchingCoord(lat, lon)
      : context === "borneo"
        ? isValidSarawakCoord(lat, lon, { allowBorneo: true })
        : isValidSarawakCoord(lat, lon);

  if (!valid) {
    return { ok: false, reason: `Coordinates out of theater bounds for ${context}` };
  }
  return {
    ok: true,
    lat,
    lon,
    wasInverted: inversion.inverted,
  };
}

/**
 * Clamps bounding box against a target region to prevent horizon blowouts.
 */
export function clampRegionBounds(bounds, region) {
  if (!bounds || !region) return null;
  const south = Math.max(bounds.south, region.south);
  const north = Math.min(bounds.north, region.north);
  const west = Math.max(bounds.west, region.west);
  const east = Math.min(bounds.east, region.east);
  if (south >= north || west >= east) return null;
  return { south, north, west, east };
}

/**
 * Filters Cesium screen-space sampled points [lon, lat], stripping horizon rays
 * and space intersections that blow out tile budgets.
 */
export function filterViewportSamples(points, region, bufferDeg = 0.05) {
  if (!Array.isArray(points) || !points.length) return [];
  const r = region || GREATER_KUCHING_BOUNDS;
  return points.filter(([lon, lat]) =>
    Number.isFinite(lon) &&
    Number.isFinite(lat) &&
    lon >= r.west - bufferDeg &&
    lon <= r.east + bufferDeg &&
    lat >= r.south - bufferDeg &&
    lat <= r.north + bufferDeg
  );
}
