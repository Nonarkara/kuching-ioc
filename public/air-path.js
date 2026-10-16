// Where did today's air come from? A simple kinematic back-trajectory, run in
// the browser: 1° grid of 925 hPa winds over Borneo (Open-Meteo, CORS-open),
// nearest-cell wind, 1 h steps back 48 h from Kuching. This is an estimate for
// orientation, NOT HYSPLIT/FLEXPART: no vertical motion, coarse winds.
// 2° spacing: 5 × 7 = 35 points. Open-Meteo bills each location as a call, so
// the earlier 1° grid (130 points) hit HTTP 429 after a few page loads.
export const AIR_PATH_GRID = { lat0: -4, lat1: 4, lon0: 104, lon1: 116, step: 2 };
export const KUCHING = { lat: 1.55, lon: 110.35 };

export function gridUrl() {
  const lats = [], lons = [];
  const st = AIR_PATH_GRID.step;
  for (let la = AIR_PATH_GRID.lat0; la <= AIR_PATH_GRID.lat1; la += st)
    for (let lo = AIR_PATH_GRID.lon0; lo <= AIR_PATH_GRID.lon1; lo += st) { lats.push(la); lons.push(lo); }
  return `https://api.open-meteo.com/v1/forecast?latitude=${lats.join(",")}&longitude=${lons.join(",")}&hourly=wind_speed_925hPa,wind_direction_925hPa&wind_speed_unit=ms&past_days=2&forecast_days=1&timezone=GMT`;
}

// json: Open-Meteo multi-location array (same order as gridUrl). Returns path
// points newest -> oldest, each {lat, lon, hoursAgo}.
export function backTrajectory(json, nowMs = Date.now(), hours = 48) {
  if (!Array.isArray(json) || !json.length) return [];
  const st = AIR_PATH_GRID.step || 1;
  const snap = (x, o) => Math.round((x - o) / st) * st + o; // nearest grid node
  const byKey = new Map(json.map((loc) => [`${snap(loc.latitude, AIR_PATH_GRID.lat0)},${snap(loc.longitude, AIR_PATH_GRID.lon0)}`, loc.hourly]));
  const times = json[0].hourly?.time || [];
  let t = times.findIndex((x) => Date.parse(`${x}:00Z`) > nowMs) - 1;
  if (t < 0) t = times.length - 1;
  let { lat, lon } = KUCHING;
  const path = [{ lat, lon, hoursAgo: 0 }];
  for (let h = 1; h <= hours && t - h >= 0; h += 1) {
    const hr = byKey.get(`${snap(lat, AIR_PATH_GRID.lat0)},${snap(lon, AIR_PATH_GRID.lon0)}`);
    const sp = hr?.wind_speed_925hPa?.[t - h], dir = hr?.wind_direction_925hPa?.[t - h];
    if (sp == null || dir == null) break;
    const r = dir * Math.PI / 180;                 // direction the wind blows FROM
    const u = -sp * Math.sin(r), v = -sp * Math.cos(r); // motion vector (m/s)
    lat -= (v * 3600) / 111000;
    lon -= (u * 3600) / (111000 * Math.cos(lat * Math.PI / 180));
    if (lat < AIR_PATH_GRID.lat0 || lat > AIR_PATH_GRID.lat1 || lon < AIR_PATH_GRID.lon0 || lon > AIR_PATH_GRID.lon1) break;
    path.push({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, hoursAgo: h });
  }
  return path;
}

// Fire detections in 0.5° cells touched by the path (each cell counted once).
export function firesAlongPath(path, cells = {}) {
  const seen = new Set();
  let n = 0;
  for (const p of path) {
    for (const dl of [-0.5, 0, 0.5]) for (const dn of [-0.5, 0, 0.5]) {
      const key = `${Math.floor((p.lat + dl) * 2) / 2},${Math.floor((p.lon + dn) * 2) / 2}`;
      if (seen.has(key)) continue;
      seen.add(key);
      n += cells[key] || 0;
    }
  }
  return n;
}

// Compass sector the air arrived from (origin of the path's oldest point).
export function originSector(path) {
  const o = path.at(-1);
  if (!o || path.length < 4) return null;
  const ang = (Math.atan2(o.lon - KUCHING.lon, o.lat - KUCHING.lat) * 180 / Math.PI + 360) % 360;
  return ["N", "NE", "E", "SE", "S", "SW", "W", "NW"][Math.round(ang / 45) % 8];
}
