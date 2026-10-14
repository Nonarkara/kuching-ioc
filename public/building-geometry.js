// Geographic building context, not a surveyed inventory.
export function metres(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|metres?|meters?|ft|feet)?$/i);
  if (!m) return null;
  const n = Number(m[1]) * (/ft|feet/i.test(m[2] || "") ? 0.3048 : 1);
  return Number.isFinite(n) ? n : null;
}
export const LEVEL_METRES = 3.2;
export const HEIGHT_SOURCES = ["osm-height", "overture-height", "levels-estimate", "type-estimate", "default-estimate"];
// Type defaults are labelled estimates, not surveys. `yes` stays a 6 m default.
const TYPE_METRES = {
  house: 6, detached: 6, semidetached_house: 6, terrace: 6, bungalow: 5, hut: 3, cabin: 4,
  stilt_house: 6, residential: 6, farm_auxiliary: 5,
  shophouse: 10, shop: 10, retail: 10, supermarket: 10, kiosk: 4,
  commercial: 12, office: 16, apartments: 18, hotel: 18, dormitory: 15,
  industrial: 8, warehouse: 8, factory: 10,
  school: 10, university: 12, college: 12, kindergarten: 6, hospital: 15, clinic: 8,
  civic: 12, public: 12, government: 14, townhall: 12,
  church: 12, mosque: 12, temple: 10, religious: 10,
  garage: 3, shed: 3, roof: 4, service: 4, toilets: 3, parking: 4,
  entertainment: 12, stadium: 16, grandstand: 8, train_station: 12, transportation: 10,
};
export function buildingHeight(tags = {}) {
  const explicit = metres(tags.height);
  const levels = metres(tags["building:levels"] ?? tags.num_floors);
  const minLevel = metres(tags["building:min_level"]);
  const base = metres(tags.min_height) ?? (minLevel !== null ? minLevel * LEVEL_METRES : 0);
  const roundM = (n) => Math.round(n * 100) / 100;
  const ok = (h) => h > base && h <= 300 && base >= 0 && base <= 300;
  if (explicit !== null && ok(explicit)) {
    return { height: roundM(explicit), minHeight: roundM(base), heightSource: "osm-height" };
  }
  if (levels !== null && levels > 0 && ok(levels * LEVEL_METRES)) {
    return { height: roundM(levels * LEVEL_METRES), minHeight: roundM(base), heightSource: "levels-estimate" };
  }
  const kind = String(tags.building || tags.class || tags.subtype || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (kind && Object.prototype.hasOwnProperty.call(TYPE_METRES, kind) && (base === 0 || ok(TYPE_METRES[kind]))) {
    return { height: TYPE_METRES[kind], minHeight: 0, heightSource: "type-estimate" };
  }
  return { height: 6, minHeight: 0, heightSource: "default-estimate" };
}
export function closedRing(points) {
  if (!Array.isArray(points) || points.length < 4) return null;
  const ring = points.map(p => Array.isArray(p) ? p : [p.lon, p.lat]);
  if (ring.some(p => p.length < 2 || !Number.isFinite(p[0]) || !Number.isFinite(p[1])
    || Math.abs(p[0]) > 180 || Math.abs(p[1]) > 90)) return null;
  if (ring[0][0] !== ring.at(-1)[0] || ring[0][1] !== ring.at(-1)[1]) return null;
  const clean = ring.map(p => p.map(n => Math.round(n * 1e6) / 1e6));
  const area = clean.slice(1).reduce((sum,p,i) => sum + clean[i][0]*p[1] - p[0]*clean[i][1],0);
  return Math.abs(area) > 1e-12 ? clean : null;
}
export function inside(point, ring) {
  let result = false;
  for (let i=0,j=ring.length-1;i<ring.length;j=i++) {
    const a=ring[i], b=ring[j];
    if ((a[1]>point[1]) !== (b[1]>point[1]) && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) result=!result;
  }
  return result;
}
function joinRings(members) {
  const segments = members.map(m => m.geometry?.map(p=>[p.lon,p.lat])).filter(p=>p?.length>=2);
  const rings = [], equal = (a,b) => a[0]===b[0] && a[1]===b[1];
  while (segments.length) {
    let ring = segments.shift();
    while (!equal(ring[0],ring.at(-1))) {
      const i=segments.findIndex(s=>equal(ring.at(-1),s[0])||equal(ring.at(-1),s.at(-1)));
      if (i<0) break;
      let next=segments.splice(i,1)[0];
      if (!equal(ring.at(-1),next[0])) next=next.reverse();
      ring.push(...next.slice(1));
    }
    const closed=closedRing(ring); if (closed) rings.push(closed);
  }
  return rings;
}
function ringKey(ring) {
  const p=ring.slice(0,-1), variants=[];
  for (const order of [p,p.slice().reverse()]) {
    const min=order.reduce((best,v,i)=>v.join(",")<order[best].join(",")?i:best,0);
    variants.push(JSON.stringify([...order.slice(min),...order.slice(0,min)]));
  }
  return variants.sort()[0];
}
export function bakeBuildings(elements, bounds) {
  if (!Array.isArray(elements)) throw new Error("Missing OSM elements");
  const features=[], keys=new Set(), excluded=new Set();
  for (const r of elements.filter(e=>e.type==="relation" && e.tags?.building && e.tags.type==="multipolygon"))
    for (const m of r.members || []) if (m.type==="way") excluded.add(m.ref);
  const parts = elements.filter(e=>e.tags?.["building:part"] && e.tags["building:part"]!=="no");
  for (const e of elements) {
    const tags=e.tags || {};
    if ((!tags.building && !tags["building:part"]) || tags.building==="no" || excluded.has(e.id)) continue;
    let polygons=[];
    if (e.type==="way") { const ring=closedRing(e.geometry); if (ring) polygons=[[ring]]; }
    if (e.type==="relation" && tags.type==="multipolygon") {
      const outers=joinRings((e.members||[]).filter(m=>m.role!=="inner"));
      const holes=joinRings((e.members||[]).filter(m=>m.role==="inner"));
      polygons=outers.map(r=>[r,...holes.filter(h=>inside(h[0],r))]);
    }
    for (const [index, polygon] of polygons.entries()) {
      const ring=polygon[0], p=ring.slice(0,-1);
      const center=p.reduce((a,x)=>[a[0]+x[0]/p.length,a[1]+x[1]/p.length],[0,0]);
      if (center[0]<bounds.west || center[0]>bounds.east || center[1]<bounds.south || center[1]>bounds.north) continue;
      // Detailed building parts replace their coarse parent solid.
      if (!tags["building:part"] && parts.some(part=>part.geometry?.length && inside([part.geometry[0].lon,part.geometry[0].lat],ring))) continue;
      const key=ringKey(ring); if (keys.has(key)) continue; keys.add(key);
      features.push({type:"Feature",id:e.type+"/"+e.id+"/"+index,geometry:{type:"Polygon",coordinates:polygon},
        properties:{name:tags.name || tags["name:en"] || null,kind:tags.building || tags["building:part"],
          osmType:e.type,osmId:e.id,sourceUrl:"https://www.openstreetmap.org/"+e.type+"/"+e.id,
          ...buildingHeight(tags)}});
    }
  }
  return {type:"FeatureCollection",features};
}

export function validateBuildingAsset(fc, manifest) {
  if (fc?.type!=="FeatureCollection" || !Array.isArray(fc.features) || !fc.features.length
    || fc.features.length>15000 || fc.features.length!==manifest?.featureCount
    || manifest.crs!=="EPSG:4326") throw new Error("Invalid building asset contract");
  const bounds=manifest.bounds, ids=new Set();
  if (!bounds || ![bounds.south,bounds.west,bounds.north,bounds.east].every(Number.isFinite)
    || bounds.south>=bounds.north || bounds.west>=bounds.east) throw new Error("Invalid pilot bounds");
  for (const f of fc.features) {
    const p=f.properties, rings=f.geometry?.coordinates;
    if (!f.id || ids.has(f.id) || f.geometry?.type!=="Polygon" || !Array.isArray(rings)
      || !rings.length || rings.some(r=>!closedRing(r))) throw new Error("Invalid building rings or duplicate id");
    ids.add(f.id);
    if (!p || !Number.isFinite(p.height) || !Number.isFinite(p.minHeight) || p.minHeight<0
      || p.height<=p.minHeight || p.height>300
      || !HEIGHT_SOURCES.includes(p.heightSource)
      || !/^https:\/\/(www\.openstreetmap\.org\/(way|relation)\/\d+|explore\.overturemaps\.org\/)$/i.test(p.sourceUrl || ""))
      throw new Error("Invalid building height or provenance");
    const points=rings[0].slice(0,-1), c=points.reduce((a,x)=>[a[0]+x[0]/points.length,a[1]+x[1]/points.length],[0,0]);
    if (c[0]<bounds.west || c[0]>bounds.east || c[1]<bounds.south || c[1]>bounds.north) throw new Error("Building outside pilot");
  }
  return true;
}

// Sarawak State Assembly / Dewan Undangan Negeri, Petra Jaya.
// OSM way 1357531465, retrieved 2026-10-14. The ring is the mapped complex.
export const ASSEMBLY = {
  name: "Dewan Undangan Negeri Sarawak",
  osmType: "way",
  osmId: 1357531465,
  lat: 1.5618153,
  lon: 110.3479024,
  levels: 9,
  wikidata: "Q7011422",
  sourceUrl: "https://www.openstreetmap.org/way/1357531465",
  ring: [
    [110.348284, 1.561712], [110.348360, 1.561545], [110.348168, 1.561458],
    [110.348127, 1.561300], [110.347941, 1.561349], [110.347797, 1.561259],
    [110.347737, 1.561355], [110.347435, 1.561373], [110.347488, 1.561666],
    [110.347405, 1.561749], [110.347538, 1.561882], [110.347522, 1.562066],
    [110.347697, 1.562082], [110.347816, 1.562241], [110.347978, 1.562121],
    [110.348161, 1.562161], [110.348166, 1.562135], [110.348201, 1.561977],
    [110.348341, 1.561910], [110.348371, 1.561896], [110.348284, 1.561712],
  ],
};
export function inAssembly(lon, lat) {
  return inside([lon, lat], ASSEMBLY.ring);
}
export function tileXY(lon, lat, z = 14) {
  const n = 2 ** z;
  const x = Math.floor((lon + 180) / 360 * n);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.asinh(Math.tan(latRad)) / Math.PI) / 2 * n);
  return { z, x, y };
}
export function tileBounds(z, x, y) {
  const n = 2 ** z;
  const lonOf = (t) => t / n * 360 - 180;
  const latOf = (t) => Math.atan(Math.sinh(Math.PI * (1 - 2 * t / n))) * 180 / Math.PI;
  return { west: lonOf(x), east: lonOf(x + 1), north: latOf(y), south: latOf(y + 1) };
}
function distToSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const len = dx * dx + dy * dy;
  const t = len === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len));
  const qx = ax + t * dx, qy = ay + t * dy;
  return Math.hypot(px - qx, py - qy);
}
function ringDistance(lon, lat, ring) {
  let best = Infinity;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    best = Math.min(best, distToSeg(lon, lat, a[0], a[1], b[0], b[1]));
  }
  return best;
}
// Dashboard jurisdiction sketches are coarse. A point within ~0.006° (~650 m)
// of the drawn edge stays with the nearest council so Petra Jaya is not dropped.
export function councilAt(lon, lat, jurisdictions, fringe = 0.006) {
  const ranked = [...jurisdictions].filter(j => j.fallbackPolygons?.[0]).sort((a, b) => a.areaKm2 - b.areaKm2);
  for (const j of ranked) if (inside([lon, lat], j.fallbackPolygons[0])) return j.id;
  let best = null, bestD = fringe;
  for (const j of ranked) {
    const d = ringDistance(lon, lat, j.fallbackPolygons[0]);
    if (d < bestD) { bestD = d; best = j.id; }
  }
  return best;
}
function douglas(points, epsilon) {
  if (points.length < 3) return points.slice();
  const a = points[0], b = points[points.length - 1];
  let max = 0, idx = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const d = distToSeg(points[i][0], points[i][1], a[0], a[1], b[0], b[1]);
    if (d > max) { max = d; idx = i; }
  }
  if (max <= epsilon) return [a, b];
  const left = douglas(points.slice(0, idx + 1), epsilon);
  const right = douglas(points.slice(idx), epsilon);
  return left.slice(0, -1).concat(right);
}
export function simplifyRing(ring, epsilon = 0.000018) {
  if (!ring?.length) return null;
  const open = ring[0][0] === ring.at(-1)[0] && ring[0][1] === ring.at(-1)[1] ? ring.slice(0, -1) : ring.slice();
  if (open.length <= 8) {
    const closed = [...open, open[0]];
    return closedRing(closed);
  }
  let kept = douglas(open, epsilon);
  let eps = epsilon;
  while (kept.length > 12 && eps < 0.00025) {
    eps *= 1.7;
    kept = douglas(open, eps);
  }
  if (kept.length < 4) kept = open.length > 4 ? [open[0], open[Math.floor(open.length / 3)], open[Math.floor(2 * open.length / 3)], open[open.length - 1]] : open;
  const closed = [...kept, kept[0]];
  return closedRing(closed);
}
