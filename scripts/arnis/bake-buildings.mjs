import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PILOT } from "./pilot.mjs";
import { bakeBuildings } from "../../public/building-geometry.js";
const root = fileURLToPath(new URL("../../",import.meta.url));
const b=PILOT.bounds, bbox=[b.south,b.west,b.north,b.east].join(",");
const query='[out:json][timeout:45];(way["building"]('+bbox+');way["building:part"]('+bbox+');relation["building"]('+bbox+'););out geom;';
let input, endpoint, raw;
if (process.argv[2]) {
  raw=await readFile(process.argv[2],"utf8"); input=JSON.parse(raw); endpoint="archived input";
} else {
  for (const url of ["https://overpass-api.de/api/interpreter","https://overpass.kumi.systems/api/interpreter"]) {
    try {
      const r=await fetch(url,{method:"POST",headers:{"content-type":"application/x-www-form-urlencoded",
        accept:"application/json","user-agent":"Padawan-IOC/0.2 geographic building pilot"},
        body:"data="+encodeURIComponent(query),signal:AbortSignal.timeout(60000)});
      if (!r.ok) throw new Error("HTTP "+r.status);
      raw=await r.text(); input=JSON.parse(raw);
      if (input.remark || !Array.isArray(input.elements)) throw new Error(input.remark || "Invalid OSM response");
      endpoint=url; break;
    } catch (e) { console.warn(url,e.message); }
  }
}
if (!input) throw new Error("No verified building input; existing snapshot not replaced");
const local=path.join(root,"scripts/arnis/.local");
await mkdir(local,{recursive:true}); await writeFile(path.join(local,"source-overpass.json"),raw);
const archiveDir=path.join(root,"scripts/arnis/inputs");
await mkdir(archiveDir,{recursive:true});
await writeFile(path.join(archiveDir,"source-overpass.json"),raw);
const fc=bakeBuildings(input.elements,b);
if (!fc.features.length || fc.features.length>15000) throw new Error("Pilot outside building-count budget");
const dir=path.join(root,"public/data/buildings"); await mkdir(dir,{recursive:true});
const body=JSON.stringify(fc), sha=x=>createHash("sha256").update(x).digest("hex");
await writeFile(path.join(dir,"padawan-pilot.geojson"),body+"\n");
const heightCounts={}; for (const f of fc.features) heightCounts[f.properties.heightSource]=(heightCounts[f.properties.heightSource]||0)+1;
await writeFile(path.join(dir,"manifest.json"),JSON.stringify({...PILOT,source:"OpenStreetMap",
  endpoint,query,inputSha256:sha(raw),osmBaseTime:input.osm3s?.timestamp_osm_base || null,
  fetchedAt:process.argv[2] ? null : new Date().toISOString(),bakedAt:new Date().toISOString(),
  inputArchive:"scripts/arnis/inputs/source-overpass.json",crs:"EPSG:4326",precision:6,simplification:"none; closed ring validation and duplicate/parent-solid filtering",
  precisionNote:"Public mapped footprints retain six decimals to preserve narrow rings; this is not surveyed positional accuracy.",
  featureCount:fc.features.length,heightCounts,bytes:Buffer.byteLength(body)+1,sha256:sha(body+"\n"),
  attribution:"© OpenStreetMap contributors · ODbL",licenceUrl:"https://www.openstreetmap.org/copyright",
  caveat:"Pilot only, not complete Padawan coverage. Default height 6 m; levels × 3 m are estimates. Independent geographic dataset, not extracted Minecraft blocks."
},null,2)+"\n");
console.log("Building pilot:",fc.features.length,"features",heightCounts,Buffer.byteLength(body),"bytes");
