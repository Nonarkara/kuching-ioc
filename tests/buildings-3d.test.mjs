import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { metres, buildingHeight, closedRing, bakeBuildings, validateBuildingAsset } from '../public/building-geometry.js';
import { setupBuildings3D } from '../public/buildings-3d.js';
const ring=[[110.325,1.425],[110.326,1.425],[110.326,1.426],[110.325,1.426],[110.325,1.425]];
const bounds={south:1.42,west:110.32,north:1.43,east:110.33};
const way=(id=1,geometry=ring)=>({type:'way',id,tags:{building:'yes'},geometry:geometry.map(([lon,lat])=>({lon,lat}))});
test('metres and height provenance distinguish tagged heights from estimates',()=>{
  assert.equal(metres('30 ft'),9.144); assert.equal(metres('unknown'),null);
  assert.equal(buildingHeight({height:'12 m'}).heightSource,'osm-height');
  assert.equal(buildingHeight({'building:levels':'3'}).height,9);
  assert.equal(buildingHeight({}).heightSource,'default-estimate');
  assert.equal(buildingHeight({height:'4',min_height:'8'}).minHeight,0);
  assert.equal(buildingHeight({height:'5000'}).height,6);
});
test('rings require lon/lat, closure and non-degenerate geometry',()=>{
  assert.ok(closedRing(ring)); assert.equal(closedRing(ring.slice(0,-1)),null);
  assert.equal(closedRing([[1,1],[1,1],[1,1],[1,1]]),null);
  assert.equal(closedRing([[190,1],[190,2],[191,2],[190,1]]),null);
});
test('duplicate footprints and coarse parents do not stack over building parts',()=>{
  assert.equal(bakeBuildings([way(1),way(2,ring.slice().reverse())],bounds).features.length,1);
  const part=way(3,[[110.3252,1.4252],[110.3254,1.4252],[110.3254,1.4254],[110.3252,1.4254],[110.3252,1.4252]]);
  part.tags={'building:part':'yes',height:'9'};
  const fc=bakeBuildings([way(),part],bounds);
  assert.equal(fc.features.length,1); assert.equal(fc.features[0].properties.osmId,3);
  assert.equal(bakeBuildings([way()],{...bounds,west:111,east:112}).features.length,0);
});
test('multipolygon holes survive and constituent ways are not duplicated',()=>{
  const hole=[[110.3252,1.4252],[110.3254,1.4252],[110.3254,1.4254],[110.3252,1.4254],[110.3252,1.4252]];
  const rel={type:'relation',id:2,tags:{type:'multipolygon',building:'yes'},members:[
    {type:'way',ref:1,role:'outer',geometry:way().geometry},
    {type:'way',ref:3,role:'inner',geometry:way(3,hole).geometry}]};
  const fc=bakeBuildings([way(),rel],bounds);
  assert.equal(fc.features.length,1); assert.equal(fc.features[0].geometry.coordinates.length,2);
});
test('committed pilot reconciles counts, provenance, hashes and verified world structure',async()=>{
  const body=await readFile(new URL('../public/data/buildings/padawan-pilot.geojson',import.meta.url));
  const fc=JSON.parse(body), m=JSON.parse(await readFile(new URL('../public/data/buildings/manifest.json',import.meta.url)));
  assert.equal(validateBuildingAsset(fc,m),true);
  assert.equal(createHash('sha256').update(body).digest('hex'),m.sha256);
  assert.equal(fc.features.length,Object.values(m.heightCounts).reduce((a,b)=>a+b,0));
  assert.ok(fc.features.some(f=>f.properties.osmId===958011498),'Mapped MPP office must be in pilot');
  const world=JSON.parse(await readFile(new URL('../public/data/buildings/world-manifest.json',import.meta.url)));
  const zip=await readFile(new URL('../public/data/buildings/kota-padawan-arnis.zip',import.meta.url));
  assert.equal(world.verification.structurallyVerified,true); assert.equal(world.verification.minecraftPlayTest,false);
  assert.ok(world.verification.populatedChunks>100); assert.equal(zip.length,world.bytes);
  assert.equal(createHash('sha256').update(zip).digest('hex'),world.sha256);
});
test('invalid geometry, hidden estimates and unsafe source links fail the browser contract',()=>{
  const fc=bakeBuildings([way()],bounds), m={bounds,featureCount:1,crs:'EPSG:4326'};
  assert.equal(validateBuildingAsset(fc,m),true);
  for (const mutate of [f=>f.properties.heightSource=null,f=>f.properties.sourceUrl='javascript:alert(1)',
    f=>f.properties.height=-1,f=>f.geometry.coordinates[0].pop()]) {
    const bad=structuredClone(fc); mutate(bad.features[0]); assert.throws(()=>validateBuildingAsset(bad,m));
  }
});

function fakeDOM() {
  const nodes=new Map();
  const make=()=>({textContent:'',hidden:false,disabled:false,dataset:{},children:[],events:{},
    setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},
    replaceChildren(){this.children=[];},append(...v){this.children.push(...v);}});
  for (const id of ['buildingsToggle','buildingsFocus','buildingsStatus','buildingsAttribution',
    'buildingSelection','arnisDownload','arnisWorldNote','buildingsDataDates','buildingsDetails']) nodes.set(id,make());
  return {nodes,getElementById:id=>nodes.get(id),createElement:make,addEventListener(){}};
}
function fakeCesium() {
  class Source {constructor(){this.entities={items:[],add:e=>{this.entities.items.push(e);return e;}};this.show=true;}}
  return {CustomDataSource:Source,PolygonHierarchy:class {constructor(outer,holes=[]){this.positions=outer;this.holes=holes;}},
    Cartesian3:{fromDegreesArray:a=>a},Color:{fromCssColorString:x=>x},
    BoundingSphere:{fromRectangle3D:r=>r},Rectangle:{fromDegrees:(...v)=>v},
    HeadingPitchRange:class {},Math:{toRadians:x=>x*Math.PI/180},
    ScreenSpaceEventHandler:class {setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1}};
}
test('building toggle uses a separate source, survives refreshes and preserves 2D fallback',async t=>{
  const prior={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch};
  t.after(()=>Object.assign(globalThis,prior));
  const dom=fakeDOM(); globalThis.document=dom; globalThis.window={Cesium:fakeCesium()};
  const fc=bakeBuildings([way()],bounds), meta={bounds,featureCount:1,crs:'EPSG:4326'};
  const calls=[], dataSources=[];
  let dimension='2d', requests=0, operationalClears=0, frames=0;
  const viewer={entities:{removeAll:()=>operationalClears++},dataSources:{add:async s=>dataSources.push(s)},
    camera:{flyToBoundingSphere:()=>frames++},scene:{canvas:{},requestRender(){}}};
  globalThis.fetch=async url=>{requests++;return {ok:true,json:async()=>url.includes('world-manifest')?
    {generator:'Arnis',bytes:10,verification:{structurallyVerified:true}}:url.includes('manifest')?meta:fc};};
  const api=setupBuildings3D({getViewer:()=>viewer,getDimension:()=>dimension,
    setDimension:async d=>{dimension=d;calls.push(d);},getLang:()=> 'en',version:'fixture'});
  await dom.nodes.get('buildingsToggle').events.click();
  assert.equal(dimension,'3d'); assert.equal(dataSources.length,1); assert.equal(operationalClears,0);
  assert.equal(dataSources[0].entities.items.length,2); assert.ok(frames>0);
  api.dimensionChanged('2d'); assert.equal(dataSources[0].show,false);
  api.dimensionChanged('3d'); assert.equal(dataSources[0].show,true);
  dimension='2d'; api.dimensionChanged('2d');
  assert.equal(dom.nodes.get('buildingsToggle')['aria-pressed'],'false');
  await dom.nodes.get('buildingsToggle').events.click(); assert.equal(dimension,'3d');
  await dom.nodes.get('buildingsToggle').events.click(); await dom.nodes.get('buildingsToggle').events.click();
  assert.equal(dataSources.length,1); assert.equal(requests,3);
  // A failing initial load restores the previous 2D dimension.
  globalThis.document=fakeDOM(); dimension='2d';
  globalThis.fetch=async()=>({ok:false,status:503});
  setupBuildings3D({getViewer:()=>viewer,getDimension:()=>dimension,setDimension:async d=>{dimension=d;},
    getLang:()=> 'en',version:'fixture'});
  await globalThis.document.nodes.get('buildingsToggle').events.click();
  assert.equal(dimension,'2d'); assert.equal(globalThis.document.nodes.get('buildingsDetails').dataset.layerState,'error');
});
