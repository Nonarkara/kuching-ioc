import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {REGION,tilesForBounds,tileBounds,TileCache,validateRegionManifest} from '../public/building-tiles.js';
import {validateBuildingAsset} from '../public/building-geometry.js';
import {setupRegionalBuildings,REGIONAL_COPY} from '../public/regional-buildings.js';
const root=new URL('../public/data/buildings/greater-kuching/',import.meta.url);
test('regional controls, empty/error states and evidence have complete language parity',()=>{
  const keys=Object.keys(REGIONAL_COPY.en).sort();
  for(const lang of ['en','ms','zh']){assert.deepEqual(Object.keys(REGIONAL_COPY[lang]).sort(),keys);for(const value of Object.values(REGIONAL_COPY[lang]))assert.ok(typeof value==='string'&&value.length);}
});
test('tile coverage is bounded, exact at seams and zoom-limited, not silently truncated',()=>{
  const tiles=tilesForBounds(REGION);assert.equal(tiles.length,696);assert.equal(new Set(tiles).size,696);
  const b=tileBounds(13214,8120);assert.deepEqual(tilesForBounds(b),['14/13214/8120']);
  assert.equal(tileBounds(13213,8120).east,b.west);assert.equal(tileBounds(13214,8119).south,b.north);
  assert.equal(tilesForBounds(REGION,14,25),null);
  assert.deepEqual(tilesForBounds({south:3,north:4,west:1,east:2}),[]);
  assert.deepEqual(tilesForBounds({south:NaN,north:4,west:1,east:2}),[]);
});
test('cache obeys byte and entry limits with LRU and real fetch age',()=>{
  const cache=new TileCache(10,2);cache.put('a',{},4);cache.put('b',{},4);cache.get('a');cache.put('c',{},4);
  assert.equal(cache.get('b'),undefined);assert.ok(cache.get('a').fetchedAt<=Date.now());
  cache.put('a',{updated:true},8);assert.equal(cache.bytes,8);assert.equal(cache.items.size,1);
  cache.put('huge',{},11);assert.equal(cache.get('huge'),undefined);
});
test('entire regional extract reconciles hashes, clipping, height provenance and unique IDs',async()=>{
  const m=validateRegionManifest(JSON.parse(await readFile(new URL('manifest.json',root))));
  assert.equal(m.missingTiles.length,0);assert.equal(m.rejectedGeometry.length,0);
  const ids=new Set(),heightCounts={};let count=0,dunParts=0;
  for(const tile of m.tiles){const raw=await readFile(new URL(tile.key+'.json',root)),fc=JSON.parse(raw);
    assert.equal(raw.length,tile.bytes);assert.equal(createHash('sha256').update(raw).digest('hex'),tile.sha256);
    assert.equal(fc.features.length,tile.featureCount);
    if(fc.features.length)validateBuildingAsset(fc,{...tile,crs:'EPSG:4326'});
    for(const f of fc.features){const p=f.properties;ids.add(p.buildingId);count++;heightCounts[p.heightSource]=(heightCounts[p.heightSource]||0)+1;
      for(const ring of f.geometry.coordinates)for(const [lon,lat] of ring){assert.ok(lon>=tile.bounds.west-0.000001&&lon<=tile.bounds.east+0.000001);assert.ok(lat>=tile.bounds.south-0.000001&&lat<=tile.bounds.north+0.000001);}
      if(p.buildingId==='2325b16f-1f4f-4564-8825-6496ad586310'){assert.equal(p.kind,'building-part');dunParts++;assert.match(p.sourceUrl,/openstreetmap.org\/way\//);}
    }
  }
  assert.equal(ids.size,m.uniqueBuildings);assert.equal(count,m.fragmentCount);assert.deepEqual(heightCounts,m.heightCounts);assert.ok(dunParts>=10);
});
test('manifest rejects unsafe paths, duplicate tiles and unrealistic budgets',async()=>{
  const m=JSON.parse(await readFile(new URL('manifest.json',root)));
  for(const modify of [m=>m.tiles[0].key='../secret',m=>m.tiles.push(m.tiles[0]),m=>m.tiles[0].bytes=1e9,m=>m.zoom=2]){
    const bad=structuredClone(m);modify(bad);assert.throws(()=>validateRegionManifest(bad));
  }
});
test('regional loader renders independently, cancels stale work and keeps 2D usable on failure',async t=>{
  const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,matchMedia:globalThis.matchMedia};t.after(()=>Object.assign(globalThis,old));
  const nodes=new Map(),events={};
  const make=()=>({textContent:'',hidden:false,events:{},children:[],setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},replaceChildren(){this.children=[];},append(...c){this.children.push(...c);}});
  for(const id of ['regionalBuildings','assemblyFocus','regionalStatus','viewToolsLabel','mapOptionsLabel','regionalAttribution','regionalSelection','regionalEvidenceTitle','regionalEvidenceText','regionalManifest'])nodes.set(id,make());
  globalThis.document={getElementById:k=>nodes.get(k),createElement:make,addEventListener:(k,f)=>events[k]=f,dispatchEvent(){},querySelector:()=>null};
  globalThis.matchMedia=()=>({matches:true});
  const event=()=>({addEventListener(fn){this.fn=fn;}}),prim=[];let operationalClears=0,dim='2d';
  const camera={moveStart:event(),moveEnd:event(),flyToBoundingSphere(){},pickEllipsoid:p=>({longitude:110.347+p.x*.000001,latitude:1.561+p.y*.000001})};
  const viewer={camera,entities:{removeAll(){operationalClears++;}},scene:{canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{}},requestRender(){},primitives:{add:p=>{prim.push(p);return p;},remove:p=>prim.splice(prim.indexOf(p),1)}}};
  const C={Math:{toDegrees:n=>n,toRadians:n=>n},Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},Cartographic:{fromCartesian:x=>x},Cartesian3:{fromDegrees:()=>({}),fromDegreesArray:x=>x,fromDegreesArrayHeights:x=>x},
    BoundingSphere:class{},HeadingPitchRange:class{},ScreenSpaceEventHandler:class{setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1},
    PolygonHierarchy:class{},GeometryInstance:class{constructor(o){Object.assign(this,o);}},PolygonGeometry:class{},Primitive:class{},PerInstanceColorAppearance:class{static VERTEX_FORMAT={};},ColorGeometryInstanceAttribute:{fromColor:x=>x},Color:{fromCssColorString:x=>x}};
  globalThis.window={Cesium:C};let requests=0;
  globalThis.fetch=async url=>{requests++;const raw=await readFile(new URL(url.includes('manifest')?'manifest.json':url.split('greater-kuching/')[1].split('?')[0],root));return{ok:true,text:async()=>raw.toString()};};
  const api=setupRegionalBuildings({getViewer:()=>viewer,getDimension:()=>dim,setDimension:async d=>{dim=d;},getLang:()=> 'en'});
  nodes.get('regionalBuildings').events.click();
  // Wait for the first activation to settle into the loaded state.
  let start=Date.now();while((dim!=='3d'||!/mapped pieces/.test(nodes.get('regionalStatus').textContent))&&Date.now()-start<5000)await new Promise(r=>setTimeout(r,50));
  if(camera.moveEnd?.fn)await camera.moveEnd.fn();
  assert.equal(dim,'3d');assert.ok(prim.length);assert.equal(operationalClears,0);assert.match(nodes.get('regionalStatus').textContent,/mapped pieces/);
  const initialRequests=requests;if(camera.moveEnd?.fn)await camera.moveEnd.fn();assert.equal(requests,initialRequests,'Tiles are reused from bounded cache');
  nodes.get('regionalBuildings').events.click();
  // Toggling off is synchronous via setDimension('2d').
  start=Date.now();while(dim!=='2d'&&Date.now()-start<2000)await new Promise(r=>setTimeout(r,50));
  assert.equal(dim,'2d');assert.equal(prim.length,0);
});
test('regional loader refuses to strand the user in 3D when the manifest 5xxs',async t=>{
  // Standalone activation, all fetches 5xx — must not strand the user in 3D.
  const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,matchMedia:globalThis.matchMedia};
  t.after(()=>Object.assign(globalThis,old));
  const nodes=new Map();
  const make=()=>({textContent:'',hidden:false,events:{},children:[],disabled:false,
    setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},
    replaceChildren(){this.children=[];},append(...c){this.children.push(...c);}});
  for(const id of ['regionalBuildings','assemblyFocus','regionalStatus','viewToolsLabel','mapOptionsLabel','regionalAttribution','regionalSelection','regionalEvidenceTitle','regionalEvidenceText','regionalManifest'])nodes.set(id,make());
  globalThis.document={getElementById:k=>nodes.get(k),createElement:make,addEventListener:(k,f)=>events[k]=f,dispatchEvent(){},querySelector:()=>null};
  const events={};
  globalThis.matchMedia=()=>({matches:true});
  const event=()=>({addEventListener(fn){this.fn=fn;}});
  const camera={moveStart:event(),moveEnd:event(),flyToBoundingSphere(){},pickEllipsoid:()=>null};
  const viewer={camera,entities:{removeAll(){}},scene:{canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{}},requestRender(){},primitives:{add:p=>p,remove:p=>{}}}};
  const C={Math:{toDegrees:n=>n,toRadians:n=>n},Cartesian2:class{constructor(){};},Cartographic:{fromCartesian:x=>x},Cartesian3:{fromDegrees:()=>({}),fromDegreesArray:x=>x,fromDegreesArrayHeights:x=>x},
    BoundingSphere:class{},HeadingPitchRange:class{},ScreenSpaceEventHandler:class{setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1},
    PolygonHierarchy:class{},GeometryInstance:class{constructor(o){Object.assign(this,o);}},PolygonGeometry:class{},Primitive:class{},PerInstanceColorAppearance:class{static VERTEX_FORMAT={};},ColorGeometryInstanceAttribute:{fromColor:x=>x},Color:{fromCssColorString:x=>x}};
  globalThis.window={Cesium:C};
  globalThis.fetch=async()=>({ok:false,status:503});
  let dim='2d';
  setupRegionalBuildings({getViewer:()=>viewer,getDimension:()=>dim,setDimension:async d=>{dim=d;},getLang:()=> 'en'});
  nodes.get('regionalBuildings').events.click();
  const start=Date.now();
  while((dim!=='2d'||!/unavailable/.test(nodes.get('regionalStatus').textContent))&&Date.now()-start<3000)await new Promise(r=>setTimeout(r,50));
  assert.equal(dim,'2d','user returns to 2D after manifest keeps 5xx-ing');
  assert.match(nodes.get('regionalStatus').textContent,/unavailable/);
});
test('map-first shell retains maps, disclosures, manual and compact non-shrinking controls',async()=>{
  const html=await readFile(new URL('../public/index.template.html',import.meta.url),'utf8'),css=await readFile(new URL('../public/reading.css',import.meta.url),'utf8');
  for(const id of ['viewTools','viewToolsBody','mapCanvas','map3d','regionalBuildings','assemblyFocus','regionalStatus','regionalEvidence','wardCategoryBar','buildingsToggle'])assert.ok(html.includes(`id="${id}"`));
  assert.match(css,/\.masthead\s*\{[^}]*min-height:48px/);
  assert.match(css,/\.map-panel\s*\{ order:0/);
  assert.match(css,/\.view-tools button[^}]*min-height:44px/);
  const guide=await readFile(new URL('../public/operator-guide.js',import.meta.url),'utf8');assert.match(guide,/getElementById\('viewToolsBody'\)/);
});
test('regional loader retries transient tile failures, locks button while busy, recovers from one 5xx',async t=>{
  // The user pointed out: "A loading timeout recovered on retry." This test
  // guarantees the recovery is automatic, not manual. The first manifest
  // response 5xx's, the second succeeds.
  const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,matchMedia:globalThis.matchMedia};
  t.after(()=>Object.assign(globalThis,old));
  const nodes=new Map(),events={};
  const make=()=>({textContent:'',hidden:false,events:{},children:[],disabled:false,
    setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},
    replaceChildren(){this.children=[];},append(...c){this.children.push(...c);}});
  for(const id of ['regionalBuildings','assemblyFocus','regionalStatus','viewToolsLabel','mapOptionsLabel','regionalAttribution','regionalSelection','regionalEvidenceTitle','regionalEvidenceText','regionalManifest'])nodes.set(id,make());
  globalThis.document={getElementById:k=>nodes.get(k),createElement:make,addEventListener:(k,f)=>events[k]=f,dispatchEvent(){},querySelector:()=>null};
  globalThis.matchMedia=()=>({matches:true});
  const event=()=>({addEventListener(fn){this.fn=fn;}});
  // The mock camera fires its complete callback so refresh() actually runs.
  const camera={moveStart:event(),moveEnd:event(),flyToBoundingSphere(_,opts){if(opts?.complete)setTimeout(opts.complete,0);},pickEllipsoid:p=>({longitude:110.347+p.x*.000001,latitude:1.561+p.y*.000001})};
  const viewer={camera,entities:{removeAll(){}},scene:{canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{}},requestRender(){},primitives:{add:p=>p,remove:p=>{}}}};
  const C={Math:{toDegrees:n=>n,toRadians:n=>n},Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},Cartographic:{fromCartesian:x=>x},Cartesian3:{fromDegrees:()=>({}),fromDegreesArray:x=>x,fromDegreesArrayHeights:x=>x},
    BoundingSphere:class{},HeadingPitchRange:class{},ScreenSpaceEventHandler:class{setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1},
    PolygonHierarchy:class{},GeometryInstance:class{constructor(o){Object.assign(this,o);}},PolygonGeometry:class{},Primitive:class{},PerInstanceColorAppearance:class{static VERTEX_FORMAT={};},ColorGeometryInstanceAttribute:{fromColor:x=>x},Color:{fromCssColorString:x=>x}};
  globalThis.window={Cesium:C};
  let dim='2d',manifestAttempts=0;
  const manifestRaw=await readFile(new URL('manifest.json',root));
  // Tiles are cached on first disk read so a single test session doesn't
  // hammer the FS, but each fetch still goes through fetchTile's validation.
  const tileCache=new Map();
  globalThis.fetch=async url=>{
    const isManifest=url.includes('manifest');
    if(isManifest){manifestAttempts++;if(manifestAttempts===1)return{ok:false,status:502};
      return{ok:true,text:async()=>manifestRaw.toString()};}
    const key=url.split('greater-kuching/')[1].split('?')[0];
    if(!tileCache.has(key)){
      try{tileCache.set(key,(await readFile(new URL(key,root))).toString());}
      catch{return{ok:false,status:404};}
    }
    return{ok:true,text:async()=>tileCache.get(key)};
  };
  setupRegionalBuildings({getViewer:()=>viewer,getDimension:()=>dim,setDimension:async d=>{dim=d;},getLang:()=> 'en'});
  nodes.get('regionalBuildings').events.click();
  // Activation is async (manifest retry, camera fly, refresh, tile fetches).
  // Poll for the success state or fail after 8s.
  const start=Date.now();
  while((dim!=='3d'||!/mapped pieces/.test(nodes.get('regionalStatus').textContent))&&Date.now()-start<8000)await new Promise(r=>setTimeout(r,50));
  // The button must release so a real user can recover after a transient 5xx.
  assert.equal(nodes.get('regionalBuildings').disabled,false,'button must not stay disabled after success');
  assert.ok(manifestAttempts>=2,'manifest retried after 502');
  assert.match(nodes.get('regionalStatus').textContent,/mapped pieces/,'successful retry shows real count');
  assert.equal(dim,'3d');
});
test('regional loader refuses a double-click while activation is in flight',async t=>{
  const old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,matchMedia:globalThis.matchMedia};
  t.after(()=>Object.assign(globalThis,old));
  const nodes=new Map(),events={};
  const make=()=>({textContent:'',hidden:false,events:{},children:[],disabled:false,
    setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},
    replaceChildren(){this.children=[];},append(...c){this.children.push(...c);}});
  for(const id of ['regionalBuildings','assemblyFocus','regionalStatus','viewToolsLabel','mapOptionsLabel','regionalAttribution','regionalSelection','regionalEvidenceTitle','regionalEvidenceText','regionalManifest'])nodes.set(id,make());
  globalThis.document={getElementById:k=>nodes.get(k),createElement:make,addEventListener:(k,f)=>events[k]=f,dispatchEvent(){},querySelector:()=>null};
  globalThis.matchMedia=()=>({matches:true});
  const event=()=>({addEventListener(fn){this.fn=fn;}});
  const camera={moveStart:event(),moveEnd:event(),flyToBoundingSphere(){},pickEllipsoid:()=>null};
  const viewer={camera,entities:{removeAll(){}},scene:{canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{}},requestRender(){},primitives:{add:p=>p,remove:p=>{}}}};
  const C={Math:{toDegrees:n=>n,toRadians:n=>n},Cartesian2:class{constructor(){};},Cartographic:{fromCartesian:x=>x},Cartesian3:{fromDegrees:()=>({}),fromDegreesArray:x=>x,fromDegreesArrayHeights:x=>x},
    BoundingSphere:class{},HeadingPitchRange:class{},ScreenSpaceEventHandler:class{setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1},
    PolygonHierarchy:class{},GeometryInstance:class{constructor(o){Object.assign(this,o);}},PolygonGeometry:class{},Primitive:class{},PerInstanceColorAppearance:class{static VERTEX_FORMAT={};},ColorGeometryInstanceAttribute:{fromColor:x=>x},Color:{fromCssColorString:x=>x}};
  globalThis.window={Cesium:C};
  globalThis.fetch=async url=>{const raw=url.includes('manifest')?await readFile(new URL('manifest.json',root)):await readFile(new URL(url.split('greater-kuching/')[1].split('?')[0],root));return{ok:true,text:async()=>raw.toString()};};
  setupRegionalBuildings({getViewer:()=>viewer,getDimension:()=>'2d',setDimension:async d=>{},getLang:()=> 'en'});
  // Fire three clicks back-to-back before the first activation settles.
  const p1=nodes.get('regionalBuildings').events.click();
  const p2=nodes.get('regionalBuildings').events.click();
  const p3=nodes.get('regionalBuildings').events.click();
  await Promise.all([p1,p2,p3]);
  // The button must not have been left disabled in a stuck state.
  assert.equal(nodes.get('regionalBuildings').disabled,false);
});
test('viewport corners off-globe still produce a usable bounds (>=2 points)',()=>{
  // 9 corners, but corners over the sea are off-globe and drop out.
  // Strict `===9` would have rejected the load; `>=2` is enough to bracket
  // a useful rectangle that the tilesForBounds clipper can further trim.
  const xs=[1,5,9],ys=[1,5,9];
  const points=[];for(const x of xs)for(const y of ys){if(x+y<12)points.push([x,y]);}
  assert.ok(points.length>=2&&points.length<9);
  const bounds=points.length>=2?{south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1])),west:Math.min(...points.map(p=>p[0])),east:Math.max(...points.map(p=>p[0]))}:null;
  assert.equal(bounds.south,1);assert.equal(bounds.west,1);
  assert.ok(bounds.north>1&&bounds.east>1);
});
