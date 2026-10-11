// Geographic building context, not a surveyed inventory.
export function metres(value) {
  if (typeof value === "number") return Number.isFinite(value) && value >= 0 ? value : null;
  if (typeof value !== "string") return null;
  const m = value.trim().match(/^([0-9]+(?:\.[0-9]+)?)\s*(m|metres?|meters?|ft|feet)?$/i);
  if (!m) return null;
  const n = Number(m[1]) * (/ft|feet/i.test(m[2] || "") ? 0.3048 : 1);
  return Number.isFinite(n) ? n : null;
}
export function buildingHeight(tags = {}) {
  const explicit = metres(tags.height), levels = metres(tags["building:levels"]);
  const base = metres(tags.min_height) ?? (metres(tags["building:min_level"]) ?? 0) * 3;
  const candidate = explicit ?? (levels !== null && levels > 0 ? levels * 3 : 6);
  const valid = candidate > base && candidate <= 300 && base <= 300;
  return { height: valid ? Math.round(candidate * 100) / 100 : 6,
    minHeight: valid ? Math.round(base * 100) / 100 : 0,
    heightSource: !valid ? "default-estimate" : explicit !== null ? "osm-height"
      : levels !== null && levels > 0 ? "levels-estimate" : "default-estimate" };
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
      || !["osm-height","overture-height","levels-estimate","default-estimate"].includes(p.heightSource)
      || !/^https:\/\/(www\.openstreetmap\.org\/(way|relation)\/\d+|explore\.overturemaps\.org\/)$/i.test(p.sourceUrl || ""))
      throw new Error("Invalid building height or provenance");
    const points=rings[0].slice(0,-1), c=points.reduce((a,x)=>[a[0]+x[0]/points.length,a[1]+x[1]/points.length],[0,0]);
    if (c[0]<bounds.west || c[0]>bounds.east || c[1]<bounds.south || c[1]>bounds.north) throw new Error("Building outside pilot");
  }
  return true;
}
