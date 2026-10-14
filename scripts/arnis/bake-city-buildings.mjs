// City building tiles for Padawan + Greater Kuching.
// Footprints: Overture Maps buildings (OSM + Microsoft ML + Google Open Buildings).
// Heights: OSM height / building:levels via Overpass when the mirror answers,
// else levels × 3.2 m, else a type default, else 6 m.
// The Sarawak State Assembly complex is omitted here and drawn as a GLB.
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { gzipSync, gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PMTiles } from "pmtiles";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { JURISDICTIONS } from "../../public/data.js";
import {
  HEIGHT_SOURCES, ASSEMBLY, buildingHeight, councilAt, inAssembly,
  simplifyRing, tileBounds, tileXY, inside,
} from "../../public/building-geometry.js";

const RELEASE = "2026-09-23.1";
const PMTILES = `https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${RELEASE}/buildings.pmtiles`;
const root = fileURLToPath(new URL("../../", import.meta.url));
const outDir = path.join(root, "public/data/buildings/tiles");
const z = 14;

function datasetOf(props) {
  const src = `${props["@geometry_source"] || ""} ${props.sources || ""}`;
  if (/google/i.test(src)) return "google";
  if (/microsoft/i.test(src)) return "microsoft";
  if (/openstreetmap|^osm\b/i.test(src)) return "osm";
  return "other";
}
function featureName(props) {
  if (props["@name"]) return String(props["@name"]).slice(0, 80);
  try {
    const names = JSON.parse(props.names || "null");
    if (names?.primary) return String(names.primary).slice(0, 80);
  } catch { /* unnamed */ }
  return null;
}
function kindOf(props) {
  const kind = String(props.class || props.subtype || "").trim().toLowerCase();
  return kind && kind !== "yes" && kind !== "building" ? kind : null;
}
function centroid(ring) {
  const p = ring.slice(0, -1);
  return p.reduce((a, x) => [a[0] + x[0] / p.length, a[1] + x[1] / p.length], [0, 0]);
}
function rectHits(rect, ring) {
  for (const [lon, lat] of ring) {
    if (lon >= rect.west && lon <= rect.east && lat <= rect.north && lat >= rect.south) return true;
  }
  const corners = [[rect.west, rect.south], [rect.east, rect.south], [rect.east, rect.north], [rect.west, rect.north]];
  return corners.some(([lon, lat]) => councilAt(lon, lat, JURISDICTIONS) !== null || inAssembly(lon, lat));
}
function tileList() {
  let west = 180, east = -180, south = 90, north = -90;
  for (const j of JURISDICTIONS) for (const [lon, lat] of j.fallbackPolygons[0]) {
    west = Math.min(west, lon); east = Math.max(east, lon);
    south = Math.min(south, lat); north = Math.max(north, lat);
  }
  west -= 0.01; east += 0.01; south -= 0.01; north += 0.01;
  const a = tileXY(west, north, z), b = tileXY(east, south, z);
  const tiles = [];
  for (let x = a.x; x <= b.x; x++) for (let y = a.y; y <= b.y; y++) {
    const rect = tileBounds(z, x, y);
    const hit = JURISDICTIONS.some(j => rectHits(rect, j.fallbackPolygons[0])) || rectHits(rect, ASSEMBLY.ring);
    if (hit) tiles.push({ z, x, y });
  }
  return tiles;
}
function packGeometry(geo, x, y) {
  const polygons = geo.type === "Polygon" ? [geo.coordinates] : geo.type === "MultiPolygon" ? geo.coordinates : [];
  const packed = [];
  for (const poly of polygons) {
    const outer = simplifyRing(poly[0]);
    if (!outer) continue;
    const [lon, lat] = centroid(outer);
    if (tileXY(lon, lat, z).x !== x || tileXY(lon, lat, z).y !== y) continue;
    if (inAssembly(lon, lat)) continue;
    const council = councilAt(lon, lat, JURISDICTIONS);
    if (!council) continue;
    packed.push({ outer, council, lon, lat });
  }
  return packed;
}

async function fetchOsm(signal) {
  const quads = [
    [1.29, 110.14, 1.52, 110.38],
    [1.29, 110.38, 1.52, 110.62],
    [1.52, 110.14, 1.74, 110.38],
    [1.52, 110.38, 1.74, 110.62],
  ];
  const endpoints = ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter"];
  const points = [];
  for (const [s, w, n, e] of quads) {
    if (signal.aborted) break;
    const query = `[out:json][timeout:40];(way["building"]["height"](${s},${w},${n},${e});way["building"]["building:levels"](${s},${w},${n},${e}););out tags center;`;
    let body = null;
    for (const url of endpoints) {
      try {
        const r = await fetch(url, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded", accept: "application/json", "user-agent": "KuchingIOC/buildings (civic dashboard)" },
          body: "data=" + encodeURIComponent(query),
          signal,
        });
        const text = await r.text();
        if (!r.ok || text.startsWith("<")) throw new Error("HTTP " + r.status);
        body = JSON.parse(text);
        break;
      } catch (err) {
        console.warn("overpass", url, err.message);
      }
    }
    for (const el of body?.elements || []) {
      if (!el.center || el.id === ASSEMBLY.osmId) continue;
      points.push({
        id: el.id, lon: el.center.lon, lat: el.center.lat,
        height: el.tags?.height, levels: el.tags?.["building:levels"],
        kind: el.tags?.building, name: el.tags?.name || el.tags?.["name:en"] || null,
      });
    }
    console.log("osm tagged buildings so far", points.length);
  }
  return points;
}

const ac = new AbortController();
const osmTimer = setTimeout(() => ac.abort(), 75000);
const osmPromise = fetchOsm(ac.signal).catch((err) => {
  console.warn("osm enrichment skipped", err.message);
  return [];
});

const archive = new PMTiles(PMTILES);
const tiles = tileList();
console.log("candidate tiles", tiles.length);
await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });

const written = [];
const datasetCounts = {};
const councilCounts = {};
let assemblySkipped = 0;
let cursor = 0;
async function worker() {
  while (cursor < tiles.length) {
    const tile = tiles[cursor++];
    const raw = await archive.getZxy(tile.z, tile.x, tile.y);
    const size = raw?.data?.byteLength ?? raw?.data?.length ?? 0;
    if (!size) continue;
    let layer;
    try {
      layer = new VectorTile(new PbfReader(raw.data)).layers.building;
    } catch (err) {
      console.warn("tile decode", tile.x, tile.y, err.message);
      continue;
    }
    if (!layer) continue;
    const features = [];
    const seen = new Set();
    for (let i = 0; i < layer.length; i++) {
      const feature = layer.feature(i);
      const props = feature.properties || {};
      if (props.is_underground === true || props.is_underground === 1) continue;
      if (!props.id || seen.has(props.id)) continue;
      if (feature.type !== 3) continue;
      seen.add(props.id);
      let geo;
      try { geo = feature.toGeoJSON(tile.x, tile.y, tile.z); } catch { continue; }
      const tags = {
        height: props.height,
        "building:levels": props.num_floors,
        min_height: props.min_height,
        building: props.class || props.subtype || "yes",
      };
      const height = buildingHeight(tags);
      if (height.heightSource === "osm-height") height.heightSource = "overture-height";
      const dataset = datasetOf(props);
      const name = featureName(props);
      const kind = kindOf(props);
      for (const part of packGeometry(geo.geometry, tile.x, tile.y)) {
        const row = {
          g: part.outer.slice(0, -1).map(([lon, lat]) => [Math.round(lon * 1e6) / 1e6, Math.round(lat * 1e6) / 1e6]),
          h: height.height, s: HEIGHT_SOURCES.indexOf(height.heightSource), c: part.council, d: dataset,
        };
        if (height.minHeight > 0) row.b = height.minHeight;
        if (name) row.n = name;
        if (kind) row.k = kind;
        features.push(row);
        datasetCounts[dataset] = (datasetCounts[dataset] || 0) + 1;
        councilCounts[part.council] = (councilCounts[part.council] || 0) + 1;
      }
    }
    if (!features.length) continue;
    const body = JSON.stringify({ z: tile.z, x: tile.x, y: tile.y, features });
    const gz = gzipSync(Buffer.from(body), { level: 9 });
    const file = path.join(outDir, String(tile.z), String(tile.x), `${tile.y}.json.gz`);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, gz);
    const councils = [...new Set(features.map(f => f.c))];
    written.push({ z: tile.z, x: tile.x, y: tile.y, count: features.length, bytes: gz.length, councils });
    if (written.length % 15 === 0) console.log("wrote", written.length, "tiles", features.length, "in", tile.x, tile.y, gz.length, "bytes");
  }
}
await Promise.all(Array.from({ length: 6 }, worker));
console.log("tiles written", written.length, "assembly footprints removed during clip", assemblySkipped);

const osm = await osmPromise;
clearTimeout(osmTimer);
console.log("osm height points", osm.length);
const byTile = new Map();
for (const p of osm) {
  const id = tileXY(p.lon, p.lat, z);
  const key = `${id.z}/${id.x}/${id.y}`;
  if (!byTile.has(key)) byTile.set(key, []);
  byTile.get(key).push(p);
}
function better(next, prev) {
  if (next === "osm-height") return prev !== "osm-height";
  if (next === "levels-estimate") return prev === "type-estimate" || prev === "default-estimate";
  return false;
}
let enriched = 0;
for (const tile of written) {
  const points = byTile.get(`${tile.z}/${tile.x}/${tile.y}`);
  if (!points?.length) continue;
  const file = path.join(outDir, String(tile.z), String(tile.x), `${tile.y}.json.gz`);
  const json = JSON.parse(gunzipSync(await readFile(file)).toString("utf8"));
  let changed = false;
  for (const f of json.features) {
    const ring = [...f.g, f.g[0]];
    for (const p of points) {
      if (!inside([p.lon, p.lat], ring)) continue;
      const h = buildingHeight({ height: p.height, "building:levels": p.levels, building: p.kind || f.k || "yes" });
      const prev = HEIGHT_SOURCES[f.s];
      if (!better(h.heightSource, prev)) break;
      f.h = h.height;
      if (h.minHeight > 0) f.b = h.minHeight;
      f.s = HEIGHT_SOURCES.indexOf(h.heightSource);
      if (p.name && !f.n) f.n = String(p.name).slice(0, 80);
      if (p.kind && !f.k) f.k = p.kind;
      f.o = p.id;
      enriched++;
      changed = true;
      break;
    }
  }
  if (!changed) continue;
  const gz = gzipSync(Buffer.from(JSON.stringify(json)), { level: 9 });
  await writeFile(file, gz);
  tile.bytes = gz.length;
  tile.count = json.features.length;
}
console.log("osm heights applied", enriched);

const heightCounts = {};
let featureCount = 0;
for (const tile of written) {
  const file = path.join(outDir, String(tile.z), String(tile.x), `${tile.y}.json.gz`);
  const json = JSON.parse(gunzipSync(await readFile(file)).toString("utf8"));
  tile.count = json.features.length;
  featureCount += json.features.length;
  for (const f of json.features) {
    const name = HEIGHT_SOURCES[f.s] || "default-estimate";
    heightCounts[name] = (heightCounts[name] || 0) + 1;
  }
}
written.sort((a, b) => a.x - b.x || a.y - b.y);
const bytes = written.reduce((sum, t) => sum + t.bytes, 0);
const index = {
  id: "greater-kuching-buildings",
  name: "Padawan and Greater Kuching building footprints",
  z,
  bakedAt: new Date().toISOString(),
  overtureRelease: RELEASE,
  overtureUrl: PMTILES,
  featureCount,
  heightCounts,
  councilCounts,
  datasetCounts,
  tileCount: written.length,
  bytes,
  tiles: written,
  assembly: {
    ...ASSEMBLY,
    model: "dun-sarawak.glb",
    modelMethod: "hand-modelled",
    heightEstimateM: Math.round(ASSEMBLY.levels * 3.2 * 10) / 10,
    note: "Generic boxes inside this footprint are omitted. The GLB is a hand model of the golden umbrella roof, not a survey and not a photogrammetry mesh.",
  },
  osmEnrichment: osm.length ? "overpass-height-and-levels" : "unavailable",
  osmTagged: osm.length,
  osmHeightsApplied: enriched,
  heightRule: "OSM or Overture height when present; otherwise building:levels or num_floors × 3.2 m; otherwise a type default (house 6 m, shophouse 10 m, commercial 12 m); otherwise 6 m.",
  loadPolicy: "The browser fetches only the tiles in view, nearest first, and stops near 8 MB so the first view stays under 10 MB.",
  attribution: "© OpenStreetMap contributors (ODbL); Overture Maps Foundation; Microsoft ML Buildings; Google Open Buildings",
  licenceUrl: "https://www.openstreetmap.org/copyright",
  credits: "CREDITS.md",
  caveat: "Mapped footprints, not a surveyed building inventory and not a flood model. Overture detector footprints can be missing, duplicated or out of date. Heights without a height tag are estimates. The jurisdiction sketch includes a short fringe so buildings on the drawn boundary are kept.",
};
const indexPath = path.join(root, "public/data/buildings/city-index.json");
const indexBody = JSON.stringify(index, null, 2) + "\n";
await writeFile(indexPath, indexBody);
console.log(JSON.stringify({
  featureCount, tileCount: written.length, bytes, heightCounts, councilCounts, datasetCounts,
  indexBytes: Buffer.byteLength(indexBody), sha256: createHash("sha256").update(indexBody).digest("hex").slice(0, 16),
}, null, 2));
