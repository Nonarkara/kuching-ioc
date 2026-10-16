import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {setupRegionalBuildings} from '../public/regional-buildings.js';

const root=new URL('../public/data/buildings/greater-kuching/',import.meta.url);
const manifestRaw=await readFile(new URL('manifest.json',root),'utf8');
const tileRaw=await readFile(new URL('14/13214/8120.json',root),'utf8');
const ok=raw=>({ok:true,status:200,text:async()=>raw});
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
async function until(check,message){
  const end=Date.now()+3000;
  while(!check()&&Date.now()<end)await new Promise(r=>setTimeout(r,5));
  assert.ok(check(),message);
}
function harness(t,fetcher,{pick}={}){
  const names=['document','window','fetch','matchMedia'];
  const old=Object.fromEntries(names.map(k=>[k,globalThis[k]]));
  t.after(()=>Object.assign(globalThis,old));
  const nodes=new Map(),events={},requests=[],primitives=[];
  const node=()=>({textContent:'',hidden:false,disabled:false,events:{},children:[],
    setAttribute(k,v){this[k]=v;},addEventListener(k,v){this.events[k]=v;},
    replaceChildren(){this.children=[];},append(...children){this.children.push(...children);}});
  for(const id of ['regionalBuildings','assemblyFocus','regionalStatus','viewToolsLabel','mapOptionsLabel','regionalAttribution','regionalSelection','regionalEvidenceTitle','regionalEvidenceText','regionalManifest'])nodes.set(id,node());
  globalThis.document={getElementById:k=>nodes.get(k),createElement:node,
    addEventListener:(k,f)=>events[k]=f,dispatchEvent(){},querySelector:()=>null};
  globalThis.matchMedia=()=>({matches:true});
  globalThis.fetch=(url,options)=>{requests.push({url,signal:options?.signal});return fetcher(url,options,requests);};
  const event=()=>({addEventListener(fn){this.fn=fn;}});
  let api;
  let flights=0,dim='2d',operationalClears=0;
  const camera={moveStart:event(),moveEnd:event(),flyToBoundingSphere(){flights++;},
    pickEllipsoid:pick|| (p=>({longitude:110.347+p.x*.000001,latitude:1.561+p.y*.000001}))};
  const viewer={camera,entities:{removeAll(){operationalClears++;}},scene:{
    canvas:{clientWidth:100,clientHeight:100},globe:{ellipsoid:{}},requestRender(){},
    primitives:{add(p){primitives.push(p);return p;},remove(p){const i=primitives.indexOf(p);if(i>=0)primitives.splice(i,1);}}}};
  const C={Math:{toDegrees:n=>n,toRadians:n=>n},Cartesian2:class{constructor(x,y){this.x=x;this.y=y;}},
    Cartographic:{fromCartesian:x=>x},Cartesian3:{fromDegrees:()=>({}),fromDegreesArray:x=>x,fromDegreesArrayHeights:x=>x},
    BoundingSphere:class{},HeadingPitchRange:class{},ScreenSpaceEventHandler:class{setInputAction(){}},ScreenSpaceEventType:{LEFT_CLICK:1},
    PolygonHierarchy:class{},GeometryInstance:class{constructor(o){Object.assign(this,o);}},PolygonGeometry:class{},Primitive:class{},
    PerInstanceColorAppearance:class{static VERTEX_FORMAT={};},ColorGeometryInstanceAttribute:{fromColor:x=>x},Color:{fromCssColorString:x=>x}};
  globalThis.window={Cesium:C,addEventListener(){}};
  const switchDimension=async d=>{dim=d;api?.dimensionChanged();};
  api=setupRegionalBuildings({getViewer:()=>viewer,getDimension:()=>dim,setDimension:switchDimension,getLang:()=> 'en'});
  return{nodes,requests,primitives,camera,events,switchDimension,
    click:()=>nodes.get('regionalBuildings').events.click(),
    assembly:()=>nodes.get('assemblyFocus').events.click(),
    status:()=>nodes.get('regionalStatus').textContent,
    get flights(){return flights;},get dimension(){return dim;},get operationalClears(){return operationalClears;}};
}
async function activated(h){h.click();await until(()=>h.flights===1,'activation reaches real 3D flight');}

test('real activation deduplicates rapid clicks and makes one manifest request',async t=>{
  const gate=deferred(),h=harness(t,()=>gate.promise);
  h.click();await until(()=>h.requests.length===1,'manifest started');h.click();h.assembly();
  assert.equal(h.requests.length,1);assert.equal(h.nodes.get('regionalBuildings').disabled,true);
  gate.resolve(ok(manifestRaw));await until(()=>h.flights===1,'one flight after manifest');
  assert.equal(h.dimension,'3d');assert.equal(h.nodes.get('assemblyFocus').disabled,false);
});

test('2D cancels pending manifest and late response cannot resurrect activation',async t=>{
  const gate=deferred(),h=harness(t,()=>gate.promise);
  h.click();await until(()=>h.requests.length===1,'manifest started');
  await h.switchDimension('2d');
  assert.equal(h.requests[0].signal.aborted,true,'2D aborts manifest fetch');
  gate.resolve(ok(manifestRaw));await new Promise(r=>setTimeout(r,20));
  assert.equal(h.flights,0);assert.equal(h.dimension,'2d');
  assert.equal(h.nodes.get('regionalBuildings').disabled,false);
});

test('pending tiles never disable Return to 2D or publish canceled geometry',async t=>{
  const gate=deferred(),h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):gate.promise);
  await activated(h);const pending=h.camera.moveEnd.fn();
  await until(()=>h.requests.length===2,'tile started');
  assert.equal(h.nodes.get('regionalBuildings').disabled,false,'2D escape remains available');
  h.click();await until(()=>h.dimension==='2d','2D button works while tile pending');
  assert.equal(h.requests[1].signal.aborted,true);
  gate.resolve(ok(tileRaw));await pending;
  assert.equal(h.primitives.length,0);assert.equal(h.operationalClears,0);
});

test('a late canceled response is not reused as cached success in the next view',async t=>{
  const gate=deferred();let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(++tileCalls===1?gate.promise:ok(tileRaw)));
  await activated(h);const first=h.camera.moveEnd.fn();await until(()=>tileCalls===1,'first tile started');
  h.camera.moveStart.fn();gate.resolve(ok(tileRaw));await first;
  await h.camera.moveEnd.fn();assert.equal(tileCalls,2,'canceled tile cannot populate cache');
  assert.match(h.status(),/mapped pieces/);assert.ok(h.primitives.length);
});

test('transient tile 503 retries actual tile, then displays validated geometry',async t=>{
  let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(++tileCalls===1?{ok:false,status:503}:ok(tileRaw)));
  await activated(h);await h.camera.moveEnd.fn();
  assert.equal(tileCalls,2);assert.match(h.status(),/mapped pieces/);assert.ok(h.primitives.length);
});

test('permanent manifest parse failure fails once and preserves visible error in 2D',async t=>{
  const h=harness(t,()=>ok('{broken'));
  h.click();await until(()=>/unavailable/.test(h.status()),'error surfaced');
  assert.equal(h.requests.length,1,'invalid JSON is not transient');assert.equal(h.dimension,'2d');
  h.events['operator-language']();assert.match(h.status(),/unavailable/);
});

test('permanent tile hash failure is not retried or rendered',async t=>{
  let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(tileCalls++,ok(tileRaw.replace('FeatureCollection','FeatureCollectioX'))));
  await activated(h);await h.camera.moveEnd.fn();
  assert.equal(tileCalls,1);assert.match(h.status(),/unavailable/);assert.equal(h.primitives.length,0);
});

test('cancellation during retry backoff prevents another request',async t=>{
  let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(tileCalls++,{ok:false,status:503}));
  await activated(h);const pending=h.camera.moveEnd.fn();await until(()=>tileCalls===1,'503 received');
  await h.switchDimension('2d');await pending;
  assert.equal(tileCalls,1);assert.equal(h.nodes.get('regionalBuildings').disabled,false);
});

test('actual loader renders with partial globe intersections and never invents sea footprints',async t=>{
  const pick=p=>(p.x===0&&p.y===0)||(p.x===100&&p.y===100)
    ?{longitude:110.347+p.x*.000001,latitude:1.561+p.y*.000001}:null;
  const h=harness(t,url=>ok(url.includes('manifest')?manifestRaw:tileRaw),{pick});
  await activated(h);await h.camera.moveEnd.fn();
  assert.match(h.status(),/mapped pieces/);assert.ok(h.primitives.length);
  h.camera.pickEllipsoid=()=>null;await h.camera.moveEnd.fn();
  assert.match(h.status(),/Zoom closer/);assert.equal(h.primitives.length,0);
});

test('pilot activation cancels regional manifest and late response cannot fly or render',async t=>{
  const gate=deferred(),h=harness(t,()=>gate.promise);
  h.click();await until(()=>h.requests.length===1,'manifest started');
  h.events['pilot-buildings-active']();assert.equal(h.requests[0].signal.aborted,true);
  gate.resolve(ok(manifestRaw));await new Promise(r=>setTimeout(r,20));
  assert.equal(h.flights,0);assert.equal(h.primitives.length,0);
  assert.equal(h.nodes.get('assemblyFocus').disabled,false);
});

test('old refresh cannot change controls or publish geometry over its pending successor',async t=>{
  const a=deferred(),b=deferred();let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(++tileCalls===1?a.promise:b.promise));
  await activated(h);const first=h.camera.moveEnd.fn();await until(()=>tileCalls===1,'first view pending');
  h.camera.moveStart.fn();const second=h.camera.moveEnd.fn();await until(()=>tileCalls===2,'second view pending');
  a.resolve(ok(tileRaw));await first;h.events['operator-language']();
  assert.equal(h.primitives.length,0);assert.match(h.status(),/Preparing/);
  assert.equal(h.nodes.get('regionalBuildings').disabled,false,'return to 2D remains available');
  b.resolve(ok(tileRaw));await second;assert.match(h.status(),/mapped pieces/);
});

test('HTTP404 is permanent, without hiding the other usable map layers',async t=>{
  let tileCalls=0;
  const h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):(tileCalls++,{ok:false,status:404}));
  await activated(h);await h.camera.moveEnd.fn();assert.equal(tileCalls,1);
  assert.match(h.status(),/other map layers still work/);h.click();assert.equal(h.dimension,'2d');
});

test('loader cancellation works without AbortSignal.any or AbortSignal.timeout',async t=>{
  const any=Object.getOwnPropertyDescriptor(AbortSignal,'any'),timeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
  Object.defineProperty(AbortSignal,'any',{configurable:true,value:undefined});
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined});
  t.after(()=>{Object.defineProperty(AbortSignal,'any',any);Object.defineProperty(AbortSignal,'timeout',timeout);});
  const gate=deferred(),h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):gate.promise);
  await activated(h);const pending=h.camera.moveEnd.fn();await until(()=>h.requests.length===2,'tile pending');
  await h.switchDimension('2d');assert.equal(h.requests[1].signal.aborted,true);
  gate.resolve(ok(tileRaw));await pending;assert.equal(h.primitives.length,0);
});

test("activation with reduced motion uses the target-bounds override, not canvas corners", async t => {
  // Reproduce the "space exploration" bug: duration:0 fires the fly's
  // complete callback synchronously, before Cesium's render loop has
  // actually moved the camera. Canvas corners then sample the default
  // home view and produce a city-wide rectangle that trips the 25-tile
  // budget. The fix is to seed refresh() with a small boundsOverride
  // derived from the activation target.
  const old = { document: globalThis.document, window: globalThis.window, fetch: globalThis.fetch, matchMedia: globalThis.matchMedia };
  t.after(() => Object.assign(globalThis, old));
  const nodes = new Map(), events = {};
  const node = () => ({ textContent: "", hidden: false, disabled: false, events: {}, children: [],
    setAttribute(k, v) { this[k] = v; }, addEventListener(k, v) { this.events[k] = v; },
    replaceChildren() { this.children = []; }, append(...c) { this.children.push(...c); } });
  for (const id of ["regionalBuildings", "assemblyFocus", "regionalStatus", "viewToolsLabel", "mapOptionsLabel", "regionalAttribution", "regionalSelection", "regionalEvidenceTitle", "regionalEvidenceText", "regionalManifest"]) nodes.set(id, node());
  globalThis.document = { getElementById: k => nodes.get(k), createElement: node,
    addEventListener: (k, f) => events[k] = f, dispatchEvent() {}, querySelector: () => null };
  // Reduced motion is on: matchMedia.matches=true so duration=0.
  globalThis.matchMedia = () => ({ matches: true });
  globalThis.fetch = async url => {
    if (url.includes("manifest")) return { ok: true, text: async () => manifestRaw };
    // Read whatever tile the URL asks for from disk so the loader's hash
    // validation passes. Without this, returning a single tile for every
    // URL triggers a hash mismatch for the other tiles in the bounds.
    try {
      const m = url.match(/greater-kuching\/(.+?)\.json/);
      if (m) {
        const raw = await readFile(new URL(m[1] + ".json", root), "utf8");
        return { ok: true, text: async () => raw };
      }
    } catch { /* fall through to 404 */ }
    return { ok: false, status: 404 };
  };
  const event = () => ({ addEventListener(fn) { this.fn = fn; } });
  let completeCb = null;
  const camera = {
    moveStart: event(), moveEnd: event(),
    // The bug: complete fires synchronously while the camera is still at
    // the default home. We simulate "deep space" with pickEllipsoid
    // returning widely separated points — the original failing case.
    flyToBoundingSphere(_, opts) {
      if (opts && typeof opts.complete === "function") {
        completeCb = opts.complete;
        // Fire synchronously, like a duration:0 fly actually does.
        Promise.resolve().then(() => { try { completeCb(); } catch { /* harness will re-check */ } });
      }
    },
    pickEllipsoid: (p) => {
      // Default Cesium home view, ~10,000 km off the ground. Corners span
      // hundreds of degrees of longitude, which is the buggy scenario.
      const scale = 200;
      return { longitude: 100 + p.x / scale, latitude: 1.5 + p.y / scale };
    },
  };
  const viewer = { camera, entities: { removeAll() {} }, scene: {
    canvas: { clientWidth: 1000, clientHeight: 1000 }, globe: { ellipsoid: {} }, requestRender() {},
    primitives: { add(p) { return p; }, remove(p) {} },
  } };
  const C = { Math: { toDegrees: n => n, toRadians: n => n }, Cartesian2: class { constructor(x, y) { this.x = x; this.y = y; } },
    Cartographic: { fromCartesian: x => x },
    Cartesian3: { fromDegrees: () => ({}), fromDegreesArray: x => x, fromDegreesArrayHeights: x => x },
    BoundingSphere: class {}, HeadingPitchRange: class {},
    ScreenSpaceEventHandler: class { setInputAction() {} }, ScreenSpaceEventType: { LEFT_CLICK: 1 },
    PolygonHierarchy: class {}, GeometryInstance: class { constructor(o) { Object.assign(this, o); } },
    PolygonGeometry: class {}, Primitive: class {},
    PerInstanceColorAppearance: class { static VERTEX_FORMAT = {}; },
    ColorGeometryInstanceAttribute: { fromColor: x => x }, Color: { fromCssColorString: x => x } };
  globalThis.window = { Cesium: C, addEventListener() {} };
  let dim = "2d";
  const api = setupRegionalBuildings({ getViewer: () => viewer, getDimension: () => dim, setDimension: async d => { dim = d; api?.dimensionChanged(); }, getLang: () => "en" });
  nodes.get("regionalBuildings").events.click();
  // Wait for the post-fly refresh to settle. With the override, the bounds
  // is a small box around (110.3258, 1.4277), well under the 25-tile budget.
  // The status must show real mapped pieces (or empty), not "Zoom closer".
  const start = Date.now();
  while (!/mapped pieces|No mapped footprints/.test(nodes.get("regionalStatus").textContent) && Date.now() - start < 5000) {
    await new Promise(r => setTimeout(r, 20));
  }
  assert.match(nodes.get("regionalStatus").textContent, /mapped pieces|No mapped footprints/,
    "activation must show the real city model, not 'Zoom closer'");
  assert.doesNotMatch(nodes.get("regionalStatus").textContent, /Zoom closer/,
    "canvas-corner sampling must not be used while the camera is still mid-flight");
  assert.equal(dim, "3d");
});

test("loader cancellation works without AbortSignal.any or AbortSignal.timeout",async t=>{  const any=Object.getOwnPropertyDescriptor(AbortSignal,'any'),timeout=Object.getOwnPropertyDescriptor(AbortSignal,'timeout');
  Object.defineProperty(AbortSignal,'any',{configurable:true,value:undefined});
  Object.defineProperty(AbortSignal,'timeout',{configurable:true,value:undefined});
  t.after(()=>{Object.defineProperty(AbortSignal,'any',any);Object.defineProperty(AbortSignal,'timeout',timeout);});
  const gate=deferred(),h=harness(t,url=>url.includes('manifest')?ok(manifestRaw):gate.promise);
  await activated(h);const pending=h.camera.moveEnd.fn();await until(()=>h.requests.length===2,'tile pending');
  await h.switchDimension('2d');assert.equal(h.requests[1].signal.aborted,true);
  gate.resolve(ok(tileRaw));await pending;assert.equal(h.primitives.length,0);
});
