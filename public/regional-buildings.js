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
  let enabled=false,manifest=null,active=null,generation=0,state='idle',count=0,destination=false,handler=null,activation=null;
  const c=()=>COPY[getLang()]||COPY.en;
  const base='./data/buildings/greater-kuching/';
  const checkAbort=signal=>{if(signal?.aborted)throw signal.reason||new DOMException('Canceled','AbortError');};
  const pause=(ms,signal)=>new Promise((resolve,reject)=>{
    checkAbort(signal);
    const abort=()=>{clearTimeout(timer);signal.removeEventListener('abort',abort);reject(signal.reason);};
    const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},ms);
    signal?.addEventListener('abort',abort,{once:true});
  });
  // Backoff is 1.6s total, excluding the network attempts. Every attempt and
  // wait belongs to its view; no AbortSignal.any/timeout support is required.
  async function readText(path,signal,timeoutMs){
    const backoff=[400,1200];
    for(let attempt=0;;attempt++){
      checkAbort(signal);
      const request=new AbortController(),abort=()=>request.abort(signal.reason);
      signal?.addEventListener('abort',abort,{once:true});
      const timer=setTimeout(()=>request.abort(new DOMException('Request timed out','TimeoutError')),timeoutMs);
      try{
        const response=await fetch(base+path+'?v='+version,{signal:request.signal});
        if(!response.ok){const error=Error('Building asset HTTP '+response.status);
          error.retryable=[408,429].includes(response.status)||response.status>=500&&response.status<=599;throw error;}
        const raw=await response.text();checkAbort(request.signal);checkAbort(signal);return raw;
      }catch(error){
        checkAbort(signal);
        const transient=error.retryable===true||error.name==='TimeoutError'||error instanceof TypeError;
        if(!transient||attempt===backoff.length)throw error;
      }finally{clearTimeout(timer);signal?.removeEventListener('abort',abort);}
      await pause(backoff[attempt],signal);
    }
  }
  const fetchTile=async(meta,signal)=>{
      const raw=await readText(meta.key+'.json',signal,20000);
      if(raw.length>4*1024*1024||new TextEncoder().encode(raw).length!==meta.bytes)throw Error('Tile size mismatch');
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(raw)))].map(b=>b.toString(16).padStart(2,'0')).join('');
      if(digest!==meta.sha256)throw Error('Tile hash mismatch');
      const fc=JSON.parse(raw);
      if(meta.featureCount===0){if(fc.type!=='FeatureCollection'||fc.features?.length!==0)throw Error('Invalid empty tile');}
      else validateBuildingAsset(fc,{...meta,crs:'EPSG:4326'});
      checkAbort(signal);return fc;
  };
  function render(){const text=c(),visible=enabled&&getDimension()==='3d';
    button.textContent=visible?text.back:text.open;
    // Deduplicate initial activation, not viewport fetches: Return to 2D must
    // remain available while tiles are pending. A stale refresh owns no lock.
    button.disabled=!!activation;assembly.disabled=!!activation;
    button.setAttribute('aria-pressed',String(visible));
    $('viewToolsLabel').textContent=text.tools;$('mapOptionsLabel').textContent=text.layers;assembly.textContent=text.assembly;
    $('regionalEvidenceTitle').textContent=text.about;$('regionalEvidenceText').textContent=text.evidence;
    $('regionalManifest').textContent=text.manifest;
    const status=$('regionalStatus');
    // Error state is sticky until the next activation rewrites it. Otherwise
    // a stranded user in 2D sees the idle hint and never learns the city model
    // failed. Order matters: error first, then 2D-idle, then 3D-busy/zoom/empty/ready.
    // The 2D-idle case now renders nothing: "Explore places in 3D, or open Map
    // layers…" named the 3D-city and Map-layers buttons sitting right beside it,
    // and cost a row of the map for the privilege. Every real state below it
    // still writes here.
    status.textContent=state==='error'?text.error
      :activation?text.busy
      :!visible?''
      :state==='busy'?text.busy
      :state==='zoom'?text.zoom
      :state==='empty'?text.empty
      :`${count.toLocaleString()} ${text.count} · ${text.date} ${manifest?.release||'—'}. ${text.estimate}`;
    if(destination&&visible)status.textContent+=' '+text.dun;
    status.hidden=!status.textContent;
    $('regionalAttribution').hidden=!visible;
  }
  function clear(){for(const p of primitives.values())getViewer()?.scene.primitives.remove(p);primitives.clear();metaById.clear();count=0;$('regionalSelection').hidden=true;}
  function cancel(){generation++;active?.abort();active=null;}
  function cancelActivation(){activation?.abort();activation=null;}
  async function getManifest(signal){checkAbort(signal);if(manifest)return manifest;
      const raw=await readText('manifest.json',signal,15000);
      const parsed=validateRegionManifest(JSON.parse(raw));checkAbort(signal);
      manifest=parsed;
      $('regionalAttribution').textContent=manifest.attribution;
      return manifest;
  }
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
  async function refresh(boundsOverride){if(!enabled||getDimension()!=='3d')return;
    cancel();const ticket=generation,controller=new AbortController();active=controller;
    try{
      render();
      await getManifest(controller.signal);if(ticket!==generation)return;
      const C=window.Cesium,v=getViewer();
      // Bounds source: an explicit small box around the activation target is
      // used for the initial fly. With reduced motion enabled, `flyToBounding
      // Sphere` with `duration:0` declares its `complete` callback before
      // Cesium's render loop has actually moved the camera, so canvas-corner
      // sampling would still see the default home view and produce a city-
      // wide rectangle that trips the 25-tile budget. The override is small
      // (~1 km box) so the 25-tile budget always passes. After the first
      // successful load, `moveEnd` calls refresh() with no override, so the
      // user-pan path still uses the canvas corners.
      let bounds=null;
      if(boundsOverride){bounds=boundsOverride;}
      else{const canvas=v.scene.canvas,points=[];
        // computeViewRectangle may include the ellipsoid horizon far outside
        // the visible neighbourhood. Intersect the actual canvas corners
        // instead. Off-globe means sky beyond the horizon, not sea: sea still
        // intersects the ellipsoid. Use surviving samples conservatively.
        for(const x of [0,canvas.clientWidth/2,canvas.clientWidth])for(const y of [0,canvas.clientHeight/2,canvas.clientHeight]){
          const p=v.camera.pickEllipsoid(new C.Cartesian2(x,y),v.scene.globe.ellipsoid);
          if(p){const ll=C.Cartographic.fromCartesian(p);points.push([C.Math.toDegrees(ll.longitude),C.Math.toDegrees(ll.latitude)]);}
        }
        // Two samples may bracket a useful rectangle; degenerate bounds draw none.
        if(points.length>=2)bounds={south:Math.min(...points.map(p=>p[1])),north:Math.max(...points.map(p=>p[1])),west:Math.min(...points.map(p=>p[0])),east:Math.max(...points.map(p=>p[0]))};
      }
      const keys=tilesForBounds(bounds,14,25);
      clear();
      if(!bounds||keys===null){state='zoom';render();v.scene.requestRender();return;}
      const wanted=new Map(manifest.tiles.map(t=>[t.key,t]));
      const pending=(keys||[]).filter(k=>wanted.has(k));
      if(pending.reduce((n,k)=>n+wanted.get(k).bytes,0)>16*1024*1024){state='zoom';render();v.scene.requestRender();return;}
      state='busy';render();const results=[];
      await Promise.all(Array.from({length:4},async()=>{while(pending.length){checkAbort(controller.signal);const key=pending.shift(),meta=wanted.get(key);let item=cache.get(key);
        if(!item){const fc=await fetchTile(meta,controller.signal);checkAbort(controller.signal);cache.put(key,fc,meta.bytes);item={data:fc};}
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
    finally{if(ticket===generation)active=null;}
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
    if(activation)return;
    if(enabled&&getDimension()==='3d'&&!isAssembly){enabled=false;cancel();clear();await setDimension('2d');render();return;}
    const operation=new AbortController();activation=operation;state='busy';render();
    try{await setDimension('3d');checkAbort(operation.signal);const v=getViewer(),C=window.Cesium;if(!v||getDimension()!=='3d')throw Error('3D unavailable');
      await getManifest(operation.signal);checkAbort(operation.signal);
      if(getDimension()!=='3d')return;
      enabled=true;state='busy';destination=isAssembly;document.dispatchEvent(new Event('regional-buildings-active'));
      if(!handler){handler=new C.ScreenSpaceEventHandler(v.scene.canvas);handler.setInputAction(inspect,C.ScreenSpaceEventType.LEFT_CLICK);v.camera.moveStart.addEventListener(cancel);v.camera.moveEnd.addEventListener(refresh);}
      // A local-scale camera gives useful neighbourhood detail immediately.
      const lon=isAssembly?110.34786:110.3258,lat=isAssembly?1.56173:1.4277;
      // Pre-compute a ~1 km box around the target so the post-fly refresh
      // can draw the neighbourhood even when the camera is still mid-flight
      // (reduced motion + duration:0 fires `complete` synchronously).
      const d=0.005;
      const initialBounds={south:lat-d,north:lat+d,west:lon-d,east:lon+d};
      v.camera.flyToBoundingSphere(new C.BoundingSphere(C.Cartesian3.fromDegrees(lon,lat),100),{offset:new C.HeadingPitchRange(C.Math.toRadians(15),C.Math.toRadians(-58),isAssembly?850:1400),duration:matchMedia('(prefers-reduced-motion: reduce)').matches?0:.7,complete:()=>refresh(initialBounds)});
      document.querySelector('.map-panel')?.scrollIntoView({block:'start',behavior:'instant'});render();
    }catch(e){if(!operation.signal.aborted){state='error';enabled=false;await setDimension('2d');render();console.warn('Regional activation failed:',e.message);}}
    finally{if(activation===operation){activation=null;render();}}
  }
  button.addEventListener('click',()=>activate());assembly.addEventListener('click',()=>activate(true));
  document.addEventListener('operator-language',()=>{render();$('regionalSelection').hidden=true;});
  document.addEventListener('pilot-buildings-active',()=>{enabled=false;cancelActivation();cancel();clear();render();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){const tools=$('viewTools');if(tools.open){tools.open=false;tools.querySelector('summary').focus();}}});
  let resizeTimer;
  window.addEventListener?.('resize',()=>{clearTimeout(resizeTimer);resizeTimer=setTimeout(refresh,150);});
  render();
  return {dimensionChanged(){if(getDimension()!=='3d'){cancelActivation();cancel();clear();}else if(enabled&&!activation)refresh();render();}};
}
