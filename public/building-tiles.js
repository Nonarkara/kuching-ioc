// Pure tile math and bounded data cache, shared by the baker and browser.
// Union of existing Padawan and Greater Kuching scope rectangles, not a council boundary.
export const REGION = {south:1.14,west:110.10,north:1.75,east:110.60};
export const TILE_ZOOM = 14;
export function tileBounds(x,y,z=TILE_ZOOM) {
  const n=2**z, lat=v=>Math.atan(Math.sinh(Math.PI*(1-2*v/n)))*180/Math.PI;
  return {west:x/n*360-180,east:(x+1)/n*360-180,north:lat(y),south:lat(y+1)};
}
export function tilesForBounds(b,z=TILE_ZOOM,limit=800) {
  if (!b || !Object.values(b).every(Number.isFinite) || b.south>=b.north || b.west>=b.east) return [];
  const n=2**z, X=v=>Math.floor((v+180)/360*n), Y=v=>Math.floor((1-Math.asinh(Math.tan(v*Math.PI/180))/Math.PI)/2*n);
  const s=Math.max(b.south,REGION.south),w=Math.max(b.west,REGION.west),
    north=Math.min(b.north,REGION.north),e=Math.min(b.east,REGION.east);
  if (s>=north || w>=e) return [];
  const x0=X(w),x1=X(e-1e-10),y0=Y(north),y1=Y(s+1e-10);
  if ((x1-x0+1)*(y1-y0+1)>limit) return null; // Zoom in, not a silent subset.
  const result=[];
  for(let x=x0;x<=x1;x++) for(let y=y0;y<=y1;y++) result.push(`${z}/${x}/${y}`);
  return result;
}
export class TileCache {
  constructor(maxBytes=12*1024*1024,maxEntries=48) {this.maxBytes=maxBytes;this.maxEntries=maxEntries;this.items=new Map();this.bytes=0;}
  get(key) {const v=this.items.get(key);if(v){this.items.delete(key);this.items.set(key,v);}return v;}
  put(key,data,bytes) {
    if(!Number.isFinite(bytes)||bytes<0||bytes>this.maxBytes) return;
    if(this.items.has(key)){this.bytes-=this.items.get(key).bytes;this.items.delete(key);}
    this.items.set(key,{data,bytes,fetchedAt:Date.now()});this.bytes+=bytes;
    while(this.bytes>this.maxBytes||this.items.size>this.maxEntries){const k=this.items.keys().next().value;this.bytes-=this.items.get(k).bytes;this.items.delete(k);}
  }
}
export function validateRegionManifest(m) {
  if(m?.schema!==1||m.crs!=='EPSG:4326'||m.zoom!==TILE_ZOOM||!/^\d{4}-\d{2}-\d{2}\.\d+$/.test(m.release)||!Array.isArray(m.tiles)||m.tiles.length>800) throw Error('Invalid regional manifest');
  const valid=new Set(tilesForBounds(REGION));
  const seen=new Set();
  for(const t of m.tiles){if(!valid.has(t.key)||seen.has(t.key)||!Number.isInteger(t.featureCount)||t.featureCount<0||t.featureCount>15000||!Number.isInteger(t.bytes)||t.bytes<0||t.bytes>4*1024*1024||!(/^[a-f0-9]{64}$/.test(t.sha256)))throw Error('Invalid tile contract');seen.add(t.key);}
  return m;
}
