const version=new URL(import.meta.url).searchParams.get('v')||'';
const {tilesForBounds,TileCache,validateRegionManifest}=await import(`./building-tiles.js?v=${encodeURIComponent(version)}`);
const {validateBuildingAsset}=await import(`./building-geometry.js?v=${encodeURIComponent(version)}`);
const COPY={
  en:{tools:'Tools',layers:'Map layers',open:'3D city',back:'Return to 2D',assembly:'Sarawak Assembly',
    idle:'Explore places in 3D, or open Map layers for rivers, drainage and sources.',busy:'Preparing mapped buildings…',
    zoom:'Zoom closer to see buildings. The city layer loads one neighbourhood at a time.',empty:'No mapped footprints in this view. This does not prove there are no buildings.',
    error:'Some building data is unavailable. Retry 3D or use 2D; the other map layers still work.',
    count:'mapped pieces',date:'Data',estimate:'Heights estimated where missing.',
    selected:'Building',height:'Height',estimated:'estimated',attribute:'source attribute, not surveyed',source:'Original source',
    dun:'Assembly · schematic roofs, not surveyed.',manifest:'Coverage & methods',about:'About this city model',
    evidence:'Dated Overture/OSM building footprints provide geographic context. Most heights use a 6 m estimate; floor counts use 3 m per floor. Tagged pyramidal roofs are schematic. Missing buildings and errors are possible. Buildings are not occupancy, exposed population or measured flood depth. Pan and zoom to explore; select a building for its original source. The existing river and drainage layers provide separate evidence.'},
  ms:{tools:'Alat',layers:'Lapisan peta',open:'Bandar 3D',back:'Kembali ke 2D',assembly:'DUN Sarawak',
    idle:'Terokai tempat dalam 3D, atau buka Lapisan peta untuk sungai, saliran dan sumber.',busy:'Menyediakan bangunan dipetakan…',
    zoom:'Zum lebih dekat untuk melihat bangunan. Lapisan bandar dimuatkan mengikut kawasan kejiranan.',empty:'Tiada tapak dipetakan dalam paparan ini. Ini tidak membuktikan tiada bangunan.',
    error:'Sebahagian data bangunan tidak tersedia. Cuba 3D semula atau gunakan 2D; lapisan peta lain masih berfungsi.',
    count:'bahagian dipetakan',date:'Data',estimate:'Ketinggian dianggarkan jika tiada.',
    selected:'Bangunan',height:'Ketinggian',estimated:'anggaran',attribute:'atribut sumber, bukan tinjauan',source:'Sumber asal',
    dun:'DUN · bumbung skematik, bukan ukur.',manifest:'Liputan dan kaedah',about:'Tentang model bandar ini',
    evidence:'Tapak bangunan Overture/OSM bertarikh memberi konteks geografi. Kebanyakan ketinggian menggunakan anggaran 6 m; bilangan tingkat dianggarkan 3 m setiap tingkat. Bumbung piramid bertag dipaparkan secara skematik. Bangunan mungkin tiada atau mengandungi ralat. Model tidak menunjukkan penghunian, penduduk terdedah atau kedalaman banjir yang diukur. Gerakkan dan zum peta; pilih bangunan untuk sumber asal. Lapisan sungai dan saliran sedia ada ialah bukti berasingan.'},
  zh:{tools:'工具',layers:'地图图层',open:'探索3D城市',back:'返回2D',assembly:'砂拉越州议会',
    idle:'以3D探索地点，或打开地图图层查看河流、排水和来源。',busy:'正在准备已绘制建筑…',
    zoom:'请放大查看建筑。城市图层按街区加载。',empty:'当前视野没有已绘制轮廓。这不代表没有建筑。',
    error:'部分建筑数据暂不可用。请重试3D或使用2D；其他地图图层仍可使用。',
    count:'个已绘制分片',date:'数据',estimate:'缺失高度采用估算。',
    selected:'建筑',height:'高度',estimated:'估算',attribute:'来源属性，非实地测量',source:'原始来源',
    dun:'州议会：简化屋顶，非测绘复原。',manifest:'覆盖与方法',about:'关于此城市模型',
    evidence:'有日期的Overture/OSM建筑轮廓提供地理背景。多数高度采用6米估算；楼层数按每层3米估算。有金字塔形属性的屋顶为简化示意。可能有遗漏或错误。建筑模型不代表入住情况、受灾人口或实测洪水深度。移动及放大地图探索，选择建筑查看原始来源。现有河流及排水图层提供独立证据。'}
};
export { COPY as REGIONAL_COPY };

// A separate collection shares Cesium's depth buffer; never touches viewer.entities.
export function setupRegionalBuildings({getViewer,getDimension,setDimension,getLang}) {
  const $=id=>document.getElementById(id),button=$('regionalBuildings'),assembly=$('assemblyFocus');
  if(!button||!assembly)return null;
  const cache=new TileCache(),primitives=new Map(),metaById=new Map();
  let enabled=false,manifest=null,active=null,generation=0,state='idle',count=0,destination=false,handler=null,busy=false;
  const c=()=>COPY[getLang()]||COPY.en;
  const base='./data/buildings/greater-kuching/';
  // AbortSignal.any landed in Node 20 and modern browsers; fall back to a
  // manual combination so an older runtime still gets a per-fetch cancel path.
  const anySignal=(...signals)=>AbortSignal.any?AbortSignal.any(signals):(()=>{const c=new AbortController();signals.forEach(s=>{if(s?.aborted)c.abort(s.reason);else s?.addEventListener?.('abort',()=>c.abort(s.reason));});return c.signal;})();
  // Backoff for transient tile-fetch failures (network blips, first-load CDN
  // warm-up). Two retries with 400ms then 1200ms keeps total wait under 2s.
  const sleep=ms=>new Promise(r=>setTimeout(r,ms));
  const fetchTile=async(meta,signal)=>{let attempt=0,lastErr;const backoff=[400,1200];
    while(attempt<=backoff.length){try{
      const response=await fetch(base+meta.key+'.json?v='+version,{signal:anySignal(signal,AbortSignal.timeout(20000))});
      if(!response.ok)throw Error('Tile HTTP '+response.status);
      const raw=await response.text();
      if(raw.length>4*1024*1024||new TextEncoder().encode(raw).length!==meta.bytes)throw Error('Tile size mismatch');
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==meta.sha256)throw Error('Tile hash mismatch');
      const fc=JSON.parse(raw);
      if(meta.featureCount===0){if(fc.type!=='FeatureCollection'||fc.features?.length!==0)throw Error('Invalid empty tile');}
      else validateBuildingAsset(fc,{...meta,crs:'EPSG:4326'});
      return fc;
    }catch(e){if(signal?.aborted)throw e;lastErr=e;if(attempt<backoff.length)await sleep(backoff[attempt++]);else break;}}
    throw lastErr;};
  function render(){const text=c(),visible=enabled&&getDimension()==='3d';
    button.textContent=visible?text.back:text.open;
    // Lock the button while a fetch is in flight so rapid clicks don't
    // trigger N parallel activations (each one cancels its predecessor and
    // burns an Overture round-trip). The visual hint is the busy state below.
    button.disabled=busy;assembly.disabled=busy;
    button.setAttribute('aria-pressed',String(visible));
    $('viewToolsLabel').textContent=text.tools;$('mapOptionsLabel').textContent=text.layers;assembly.textContent=text.assembly;
    $('regionalEvidenceTitle').textContent=text.about;$('regionalEvidenceText').textContent=text.evidence;
    $('regionalManifest').textContent=text.manifest;
    const status=$('regionalStatus');
    // Error state is sticky until the next activation rewrites it. Otherwise
    // a stranded user in 2D sees the idle hint and never learns the city model
    // failed. Order matters: error first, then 2D-idle, then 3D-busy/zoom/empty/ready.
    status.textContent=state==='error'?text.error
      :!visible?text.idle
      :state==='busy'?text.busy
      :state==='zoom'?text.zoom
      :state==='empty'?text.empty
      :`${count.toLocaleString()} ${text.count} · ${text.date} ${manifest?.release||'—'}. ${text.estimate}`;
    if(destination&&visible)status.textContent+=' '+text.dun;
    $('regionalAttribution').hidden=!visible;
  }
  function clear(){for(const p of primitives.values())getViewer()?.scene.primitives.remove(p);primitives.clear();metaById.clear();count=0;$('regionalSelection').hidden=true;}
  function cancel(){generation++;active?.abort();active=null;}
  async function getManifest(){if(manifest)return manifest;
    // Manifest is small and rarely changes; retry it the same way we retry tiles
    // so a 502 from the CDN doesn't force a manual button click.
    let attempt=0,lastErr,backoff=[400,1200];
    while(attempt<=backoff.length){try{
      const r=await fetch(base+'manifest.json?v='+version,{signal:AbortSignal.timeout(15000)});
      if(!r.ok)throw Error('Region manifest HTTP '+r.status);
      manifest=validateRegionManifest(JSON.parse(await r.text()));
      $('regionalAttribution').textContent=manifest.attribution;
      return manifest;
    }catch(e){lastErr=e;if(attempt<backoff.length)await sleep(backoff[attempt++]);else break;}}
    throw lastErr;}
  function addTile(key,fc){const C=window.Cesium,instances=[];
    for(const f of fc.features){const p=f.properties,id='regional:'+f.id;
      const hierarchy=r=>new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(r[0].slice(0,-1).flat()),r.slice(1).map(h=>new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(h.slice(0,-1).flat()))));
      const roof=p.roofShape==='pyramidal'&&p.roofHeight&&f.geometry.coordinates.length===1;
      instances.push(new C.GeometryInstance({id,geometry:new C.PolygonGeometry({polygonHierarchy:hierarchy(f.geometry.coordinates),height:p.minHeight,extrudedHeight:roof?p.height-p.roofHeight:p.height,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),
        attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#d5d2ca'))}}));metaById.set(id,p);
      if(roof){const ring=f.geometry.coordinates[0].slice(0,-1),center=ring.reduce((a,q)=>[a[0]+q[0]/ring.length,a[1]+q[1]/ring.length],[0,0]);
        for(let i=0;i<ring.length;i++){const a=ring[i],b=ring[(i+1)%ring.length];
          const positions=C.Cartesian3.fromDegreesArrayHeights([a[0],a[1],p.height-p.roofHeight,b[0],b[1],p.height-p.roofHeight,center[0],center[1],p.height]);
          instances.push(new C.GeometryInstance({id,geometry:new C.PolygonGeometry({polygonHierarchy:new C.PolygonHierarchy(positions),perPositionHeight:true,vertexFormat:C.PerInstanceColorAppearance.VERTEX_FORMAT}),attributes:{color:C.ColorGeometryInstanceAttribute.fromColor(C.Color.fromCssColorString('#b58c45'))}}));
        }
      }
    }
    if(instances.length){const primitive=getViewer().scene.primitives.add(new C.Primitive({geometryInstances:instances,appearance:new C.PerInstanceColorAppearance({closed:true,translucent:false}),asynchronous:true}));primitives.set(key,primitive);}
  }
  async function refresh(){if(!enabled||getDimension()!=='3d')return;
    cancel();const ticket=generation,controller=new AbortController();active=controller;busy=true;
    try{
      render();
      await getManifest();if(ticket!==generation)return;
      const C=window.Cesium,v=getViewer(),canvas=v.scene.canvas,points=[];
      // computeViewRectangle may include the ellipsoid horizon far outside the
      // visible neighbourhood. Intersect the actual canvas corners instead.
      // Some corners are off-globe (pan the camera over the sea) — fall back
      // to whatever corners did intersect rather than dropping the whole load.
      for(const x of [0,canvas.clientWidth/2,canvas.clientWidth])for(const y of [0,canvas.clientHeight/2,canvas.clientHeight]){
        const p=v.camera.pickEllipsoid(new C.Cartesian2(x,y),v.scene.globe.ellipsoid);
        if(p){const ll=C.Cartographic.fromCartesian(p);points.push([C.Math.toDegrees(ll.longitude),C.Math.toDegrees(ll.latitude)]);}
      }
      // Four visible corners (centre + 2 edges) is enough to bracket the view.
      const bounds=points.length>=2?{south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1])),west:Math.min(...points.map(p=>p[0])),east:Math.max(...points.map(p=>p[0]))}:null;
      const keys=tilesForBounds(bounds,14,25);
      clear();
      if(!bounds||keys===null){state='zoom';render();v.scene.requestRender();return;}
      const wanted=new Map(manifest.tiles.map(t=>[t.key,t]));
      const pending=(keys||[]).filter(k=>wanted.has(k));
      if(pending.reduce((n,k)=>n+wanted.get(k).bytes,0)>16*1024*1024){state='zoom';render();v.scene.requestRender();return;}
      state='busy';render();const results=[];
      await Promise.all(Array.from({length:4},async()=>{while(pending.length){const key=pending.shift(),meta=wanted.get(key);let item=cache.get(key);
        if(!item){const fc=await fetchTile(meta,controller.signal);cache.put(key,fc,meta.bytes);item={data:fc};}
        // Decode complete tiles for cache reuse, draw only geometry intersecting
        // this viewport. Dense neighbours must not inflate the visible budget.
        const features=item.data.features.filter(f=>{
          const ring=f.geometry.coordinates[0],xs=ring.map(p=>p[0]),ys=ring.map(p=>p[1]);
          return Math.max(...xs)>=bounds.west&&Math.min(...xs)<=bounds.east&&Math.max(...ys)>=bounds.south&&Math.min(...ys)<=bounds.north;
        });
        results.push([key,{type:'FeatureCollection',features}]);
      }}));
      if(ticket!==generation||!enabled||getDimension()!=='3d')return;
      if(results.reduce((n,[,fc])=>n+fc.features.length,0)>12000){state='zoom';render();v.scene.requestRender();return;}
      for(const [key,fc] of results){addTile(key,fc);count+=fc.features.length;}
      state=count?'ready':'empty';render();v.scene.requestRender();
    }catch(e){if(ticket!==generation)return;controller.abort();clear();state='error';render();console.warn('Regional buildings unavailable:',e.message);getViewer()?.scene.requestRender();}
    finally{busy=false;if(ticket===generation)render();}
  }
  function inspect(event){if(!enabled)return;const hit=getViewer().scene.pick(event.position),p=metaById.get(hit?.id),node=$('regionalSelection');node.replaceChildren();node.hidden=!p;if(!p)return;
    const text=c(),description=document.createElement('span'),link=document.createElement('a');
    const name=p.buildingId==='2325b16f-1f4f-4564-8825-6496ad586310'?text.assembly:(p.name||text.selected);
    description.textContent=`${name} · ${text.height}: ${p.height} m (${p.heightSource.endsWith('estimate')?text.estimated:text.attribute}). `;
    link.textContent=text.source;link.href=p.sourceUrl;link.target='_blank';link.rel='noopener';node.append(description,link);
  }
  async function activate(isAssembly=false){
    // Guard rapid double-clicks that would each cancel the previous one
    // and waste the Overture round-trip.
    if(busy)return;
    if(enabled&&getDimension()==='3d'&&!isAssembly){enabled=false;cancel();clear();await setDimension('2d');render();return;}
    busy=true;render();
    try{await setDimension('3d');const v=getViewer(),C=window.Cesium;if(!v||getDimension()!=='3d')throw Error('3D unavailable');
      await getManifest();enabled=true;state='busy';destination=isAssembly;document.dispatchEvent(new Event('regional-buildings-active'));
      if(!handler){handler=new C.ScreenSpaceEventHandler(v.scene.canvas);handler.setInputAction(inspect,C.ScreenSpaceEventType.LEFT_CLICK);v.camera.moveStart.addEventListener(cancel);v.camera.moveEnd.addEventListener(refresh);}
      // A local-scale camera gives useful neighbourhood detail immediately.
      const lon=isAssembly?110.34786:110.3258,lat=isAssembly?1.56173:1.4277;
      v.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon,lat),100),{offset:new C.HeadingPitchRange(C.Math.toRadians(15),C.Math.toRadians(-58),isAssembly?850:1400),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:.7,complete:refresh});
      document.querySelector('.map-panel')?.scrollIntoView({block:'start',behavior:'instant'});render();
    }catch(e){state='error';enabled=false;await setDimension('2d');$('regionalStatus').textContent=c().error;console.warn('Regional activation failed:',e.message);}
    finally{busy=false;render();}
  }
  button.addEventListener('click',()=>activate());assembly.addEventListener('click',()=>activate(true));
  document.addEventListener('operator-language',()=>{render();$('regionalSelection').hidden=true;});
  document.addEventListener('pilot-buildings-active',()=>{enabled=false;cancel();clear();render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const tools=$('viewTools');if(tools.open){tools.open=false;tools.querySelector('summary').focus();}}});
  let resizeTimer;
  window.addEventListener?.('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refresh,150);});
  render();
  return {dimensionChanged(){if(getDimension()!=='3d'){cancel();clear();}else if(enabled)refresh();render();}};
}
