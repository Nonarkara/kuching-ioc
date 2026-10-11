// Reuse the dated vector tiles already fetched by the pinned Arnis generator.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { gunzipSync } from "node:zlib";
import { createHash } from "node:crypto";
import { VectorTile } from "@mapbox/vector-tile";
import { PbfReader } from "pbf";
import { PILOT } from "./pilot.mjs";
import { closedRing, inside, buildingHeight } from "../../public/building-geometry.js";
const cache=process.argv[2], release=process.argv[3];
if (!cache || !/^\d{4}-\d{2}-\d{2}\.\d+$/.test(release || "")) throw new Error("Supply Arnis Overture cache root and dated release");
const dir=new URL("../../public/data/buildings/",import.meta.url);
const fc=JSON.parse(await readFile(new URL("padawan-pilot.geojson",dir),"utf8"));
// Re-baking is idempotent; OSM wins over overlapping detected footprints.
fc.features=fc.features.filter(f=>f.properties.osmId != null);
const manifest=JSON.parse(await readFile(new URL("manifest.json",dir),"utf8"));
const b=PILOT.bounds, z=14, n=2**z;
const X=lon=>Math.floor((lon+180)/360*n);
const Y=lat=>Math.floor((1-Math.asinh(Math.tan(lat*Math.PI/180))/Math.PI)/2*n);
const ids=new Set(), tiles=[], sources=new Set();
const sha=x=>createHash("sha256").update(x).digest("hex");
let added=0;
for (let x=X(b.west);x<=X(b.east);x++) for (let y=Y(b.north);y<=Y(b.south);y++) {
  const raw=await readFile(cache+"/"+release+"/tiles/buildings/t/"+z+"/"+x+"/"+y+".bin");
  const archived=new URL("./inputs/overture/"+release+"/tiles/buildings/t/"+z+"/"+x+"/",import.meta.url);
  await mkdir(archived,{recursive:true}); await writeFile(new URL(y+".bin",archived),raw);
  tiles.push({z,x,y,sha256:sha(raw)});
  const tile=new VectorTile(new PbfReader(raw[0]===31 && raw[1]===139 ? gunzipSync(raw) : raw));
  const layer=tile.layers.building; if (!layer) throw new Error("Missing Overture building layer");
  for (let i=0;i<layer.length;i++) {
    const feature=layer.feature(i), p=feature.properties;
    if (!p.id || ids.has(p.id) || feature.type!==3 || p.is_underground===true || p.is_underground===1) continue;
    ids.add(p.id);
    let provenance=[]; try { provenance=JSON.parse(p.sources || "[]"); } catch {}
    if (provenance.some(s=>s.dataset?.toLowerCase()==="openstreetmap")) continue;
    const geo=feature.toGeoJSON(x,y,z);
    const polygons=geo.geometry.type==="Polygon" ? [geo.geometry.coordinates] : geo.geometry.type==="MultiPolygon" ? geo.geometry.coordinates : [];
    for (const [index, poly] of polygons.entries()) {
      const rings=poly.map(closedRing);
      if (!rings[0] || rings.some(r=>!r)) continue;
      const ps=rings[0].slice(0,-1), center=ps.reduce((a,p)=>[a[0]+p[0]/ps.length,a[1]+p[1]/ps.length],[0,0]);
      if (center[0]<b.west || center[0]>b.east || center[1]<b.south || center[1]>b.north) continue;
      if (fc.features.some(f=>inside(center,f.geometry.coordinates[0]) || inside(f.geometry.coordinates[0][0],rings[0]))) continue;
      const height=buildingHeight({height:p.height,min_height:p.min_height,"building:levels":p.num_floors});
      if (height.heightSource==="osm-height") height.heightSource="overture-height";
      const datasets=provenance.map(s=>s.dataset).filter(Boolean); datasets.forEach(s=>sources.add(s));
      fc.features.push({type:"Feature",id:"overture/"+p.id+"/"+index,
        geometry:{type:"Polygon",coordinates:rings},
        properties:{name:null,kind:"building",overtureId:p.id,sourceDatasets:datasets,
          sourceUrl:"https://explore.overturemaps.org/",...height}});
      added++;
    }
  }
}
const body=JSON.stringify(fc)+"\n", heightCounts={};
for (const f of fc.features) heightCounts[f.properties.heightSource]=(heightCounts[f.properties.heightSource]||0)+1;
await writeFile(new URL("padawan-pilot.geojson",dir),body);
await writeFile(new URL("manifest.json",dir),JSON.stringify({...manifest,
  source:"OpenStreetMap + Overture Maps",featureCount:fc.features.length,heightCounts,
  bytes:Buffer.byteLength(body),sha256:sha(body),overture:{release,added,tiles,datasets:[...sources],
    archiveUrl:"https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/"+release+"/buildings.pmtiles",
    source:"Cached official release tiles fetched by Arnis; vector geometry, not Minecraft blocks"},
  attribution:"© OpenStreetMap contributors, Overture Maps Foundation; "+[...sources].join(", "),
  licenceUrl:"https://docs.overturemaps.org/attribution/",bakedAt:new Date().toISOString(),
},null,2)+"\n");
console.log({features:fc.features.length,overtureAdded:added,heightCounts,bytes:Buffer.byteLength(body),sourceDatasets:[...sources]});
