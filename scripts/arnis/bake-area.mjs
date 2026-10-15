// Reproducible regional extract. Local-only; CI serves the committed outputs.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {PMTiles} from 'pmtiles';
import {VectorTile} from '@mapbox/vector-tile';
import {PbfReader} from 'pbf';
import clipping from 'polygon-clipping';
import {closedRing,buildingHeight} from '../../public/building-geometry.js';
import {REGION,TILE_ZOOM,tilesForBounds,tileBounds} from '../../public/building-tiles.js';
const release='2026-09-23.1';
const url=`https://overturemaps-extras-us-west-2.s3.us-west-2.amazonaws.com/tiles/${release}/buildings.pmtiles`;
const archive=new PMTiles(url), sha=b=>createHash('sha256').update(b).digest('hex');
const out=new URL('../../public/data/buildings/greater-kuching/',import.meta.url);
const cache=new URL('./.local/regional-inputs/',import.meta.url);
await mkdir(cache,{recursive:true});
const tiles=[],datasets=new Set(),ids=new Set(),heights={},rejectedGeometry=[];
const queue=tilesForBounds(REGION);
let completed=0;
async function processTile(key) {
  const [z,x,y]=key.split('/').map(Number), bounds=tileBounds(x,y,z);
  const rawPath=new URL(`${x}-${y}.mvt`,cache);
  let raw;
  try {raw=await readFile(rawPath);} catch(e){if(e.code!=='ENOENT')throw e;const r=await archive.getZxy(z,x,y);raw=r?Buffer.from(r.data):Buffer.alloc(0);await writeFile(rawPath,raw);}
  const features=[],local=new Set();
  const layers=raw.length?new VectorTile(new PbfReader(raw)).layers:{};
  const parts=Array.from({length:layers.building_part?.length||0},(_,i)=>layers.building_part.feature(i));
  const parentsWithParts=new Set(parts.map(f=>f.properties.building_id));
  const layer=[...Array.from({length:layers.building?.length||0},(_,i)=>layers.building.feature(i)),...parts];
  const parentNames=new Map(layer.filter(f=>!f.properties.building_id).map(f=>[f.properties.id,f.properties['@name']||f.properties.name]));
  const w=Math.max(bounds.west,REGION.west),e=Math.min(bounds.east,REGION.east),s=Math.max(bounds.south,REGION.south),n=Math.min(bounds.north,REGION.north);
  const box=[[[w,s],[e,s],[e,n],[w,n],[w,s]]];
  for(const f of layer){
    const p=f.properties;
    if(!p.building_id&&p.has_parts&&parentsWithParts.has(p.id))continue;
    if(!p.id||f.type!==3||local.has(p.id)||p.is_underground===true||p.is_underground===1)continue;
    local.add(p.id);
    let source=[];try{source=JSON.parse(p.sources||'[]');}catch{throw Error('Invalid source metadata');}
    const names=source.map(v=>v.dataset).filter(Boolean);names.forEach(v=>datasets.add(v));
    const geo=f.toGeoJSON(x,y,z).geometry;
    const polygons=geo.type==='Polygon'?[geo.coordinates]:geo.type==='MultiPolygon'?geo.coordinates:[];
    // Clip buffered MVT geometry to exact tile edges: neighbouring tiles cannot
    // render duplicate faces. Multiple fragments keep the same source ID.
    let clipped;
    try {clipped=clipping.intersection(polygons,box);} catch {
      // Quantise source coordinates before retrying numerical edge degeneracies.
      try {clipped=clipping.intersection(polygons.map(poly=>poly.map(r=>r.map(p=>p.map(v=>Math.round(v*1e6)/1e6)))),box);}
      catch {rejectedGeometry.push({tile:key,id:p.id});continue;}
    }
    const height=buildingHeight({height:p.height,min_height:p.min_height,'building:min_level':p.min_floor,'building:levels':p.num_floors});
    if(height.heightSource==='osm-height')height.heightSource='overture-height';
    for(const [part,rings] of clipped.entries()){
      const clean=rings.map(closedRing);if(!clean.length||clean.some(r=>!r))continue;
      const osm=source.find(s=>s.dataset==='OpenStreetMap'&&/^[wr]\d+@\d+$/.test(s.record_id||''));
      const sourceUrl=osm?`https://www.openstreetmap.org/${osm.record_id[0]==='w'?'way':'relation'}/${osm.record_id.slice(1).split('@')[0]}`:'https://explore.overturemaps.org/';
      features.push({type:'Feature',id:`${p.id}/${x}/${y}/${part}`,geometry:{type:'Polygon',coordinates:clean},properties:{
        overtureId:p.id,buildingId:p.building_id||p.id,kind:p.building_id?'building-part':'building',name:p['@name']||p.name||parentNames.get(p.building_id)||null,
        roofShape:p.roof_shape||null,roofHeight:Number.isFinite(p.roof_height)&&p.roof_height>0&&p.roof_height<height.height-height.minHeight?p.roof_height:null,
        sourceUrl,sourceDatasets:names,...height}});
      heights[height.heightSource]=(heights[height.heightSource]||0)+1;ids.add(p.building_id||p.id);
    }
  }
  const body=JSON.stringify({type:'FeatureCollection',features})+'\n';
  if(Buffer.byteLength(body)>4*1024*1024||features.length>15000)throw Error('Tile exceeds browser budget '+key);
  await mkdir(new URL(`${z}/${x}/`,out),{recursive:true});
  await writeFile(new URL(`${key}.json`,out),body);
  tiles.push({key,bounds,featureCount:features.length,bytes:Buffer.byteLength(body),sha256:sha(body),inputSha256:sha(raw)});
  if(++completed%40===0)console.log(`${completed} regional tiles baked`);
}
await Promise.all(Array.from({length:4},async()=>{while(queue.length)await processTile(queue.shift());}));
tiles.sort((a,b)=>a.key.localeCompare(b.key));
const manifest={schema:1,crs:'EPSG:4326',zoom:TILE_ZOOM,bounds:REGION,release,archiveUrl:url,bakedAt:new Date().toISOString(),
  precision:6,simplification:'Source MVT geometry; exact tile-edge clipping, no further simplification',
  source:'Overture Maps Foundation',attribution:'© OpenStreetMap contributors, Overture Maps Foundation; '+[...datasets].sort().join(', '),
  licenceUrl:'https://docs.overturemaps.org/attribution/',uniqueBuildings:ids.size,fragmentCount:tiles.reduce((s,t)=>s+t.featureCount,0),heightCounts:heights,
  missingTiles:[],rejectedGeometry,tiles};
await writeFile(new URL('manifest.json',out),JSON.stringify(manifest,null,2)+'\n');
console.log({tiles:tiles.length,uniqueBuildings:ids.size,bytes:tiles.reduce((s,t)=>s+t.bytes,0),heights});
