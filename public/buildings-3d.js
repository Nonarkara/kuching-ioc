import { validateBuildingAsset } from "./building-geometry.js";
const COPY = {
  en: { off:"3D buildings · pilot", on:"Hide 3D buildings", focus:"Focus pilot",
    idle:"Kota Padawan pilot · heights estimated · not a flood model.",
    busy:"Preparing the building pilot…", error:"Building layer unavailable. Use the 2D map; retry the pilot button.",
    count:"mapped footprints", height:"Height", estimate:"estimated", attribute:"source attribute, not surveyed",
    flat:"Flat-ground browser model; Arnis world has separate terrain.", source:"Source", download:"Download Arnis world",
    world:"Arnis Java world · structurally checked; not play-tested.", dates:"Data dates", unknown:"Unnamed building" },
  ms: { off:"Bangunan 3D · rintis", on:"Sembunyikan bangunan 3D", focus:"Fokus rintis",
    idle:"Rintis Kota Padawan · ketinggian dianggarkan · bukan model banjir.",
    busy:"Menyediakan bangunan rintis…", error:"Lapisan bangunan tidak tersedia. Gunakan peta 2D; cuba butang rintis semula.",
    count:"tapak bangunan dipetakan", height:"Ketinggian", estimate:"anggaran", attribute:"atribut sumber, bukan tinjauan",
    flat:"Model pelayar di atas tanah rata; dunia Arnis mempunyai rupa bumi berasingan.", source:"Sumber", download:"Muat turun dunia Arnis",
    world:"Dunia Java Arnis · struktur diperiksa; belum diuji dalam permainan.", dates:"Tarikh data", unknown:"Bangunan tanpa nama" },
  zh: { off:"3D建筑 · 试点", on:"隐藏3D建筑", focus:"定位试点",
    idle:"Kota Padawan试点 · 建筑高度为估算 · 并非洪水模型。",
    busy:"正在准备建筑试点…", error:"建筑图层暂不可用。请使用2D地图，或再次点击试点按钮。",
    count:"个已绘制建筑轮廓", height:"高度", estimate:"估算", attribute:"来源属性，非实地测量",
    flat:"浏览器模型采用平地；Arnis世界另有地形。", source:"来源", download:"下载Arnis世界",
    world:"Arnis Java世界 · 已检查文件结构，未在游戏中测试。", dates:"数据日期", unknown:"未命名建筑" },
};

export function setupBuildings3D({ getViewer, getDimension, setDimension, getLang, version }) {
  const button=document.getElementById("buildingsToggle"), focusButton=document.getElementById("buildingsFocus");
  const status=document.getElementById("buildingsStatus"), attribution=document.getElementById("buildingsAttribution");
  const picked=document.getElementById("buildingSelection"), download=document.getElementById("arnisDownload");
  if (!button || !status || !focusButton || !picked || !download || !attribution) return null;
  let enabled=false, busy=false, error=false, layer=null, manifest=null, selection=null, world=null, handler=null;
  const features=new Map();
  const copy=()=>COPY[getLang()] || COPY.en;
  function render() {
    const c=copy();
    const visible=enabled && getDimension()==="3d";
    button.textContent=visible ? c.on : c.off;
    button.setAttribute("aria-pressed",String(visible)); button.disabled=busy;
    focusButton.textContent=c.focus; focusButton.disabled=!enabled || busy;
    download.textContent=c.download;
    status.textContent=busy ? c.busy : error ? c.error : enabled && manifest
      ? manifest.featureCount+" "+c.count+" · "+c.estimate+" · "+c.flat : c.idle;
    document.getElementById("arnisWorldNote").textContent=c.world;
    document.getElementById("buildingsDataDates").textContent=manifest ? c.dates+": OSM "+(manifest.osmBaseTime?.slice(0,10) || "—")+" · Overture "+(manifest.overture?.release || "—") : "";
    attribution.textContent=manifest?.attribution || "© OpenStreetMap contributors, Overture Maps Foundation";
    picked.replaceChildren();
    if (selection) {
      const p=selection.properties, title=document.createElement("strong"), detail=document.createElement("span"), link=document.createElement("a");
      title.textContent=p.name || c.unknown;
      detail.textContent=c.height+": "+p.height+" m · "+(["osm-height","overture-height"].includes(p.heightSource)?c.attribute:c.estimate);
      if (p.overtureId) detail.textContent+=" · Overture ID: "+p.overtureId;
      link.textContent=c.source; link.href=p.sourceUrl; link.target="_blank"; link.rel="noopener";
      picked.append(title,detail,link);
    }
    picked.hidden=!selection || !visible;
    document.getElementById("buildingsDetails").dataset.layerState=error?"error":busy?"busy":enabled?"on":"off";
  }
  function focus() {
    const viewer=getViewer(), C=window.Cesium;
    if (!viewer || !manifest || getDimension()!=="3d") return;
    const b=manifest.bounds;
    const sphere=C.BoundingSphere.fromRectangle3D(C.Rectangle.fromDegrees(b.west,b.south,b.east,b.north));
    viewer.camera.flyToBoundingSphere(sphere,{offset:new C.HeadingPitchRange(C.Math.toRadians(25),C.Math.toRadians(-40),1900),duration:1});
    button.closest?.(".building-tools")?.scrollIntoView({ block: "start", behavior: "instant" });
    viewer.scene.requestRender();
  }
  async function load() {
    if (layer) return;
    const base="./data/buildings/", suffix="?v="+encodeURIComponent(version);
    const read=async name=>{
      const r=await fetch(base+name+suffix,{signal:AbortSignal.timeout(15000)});
      if (!r.ok) throw new Error("Building asset HTTP "+r.status);
      return r.json();
    };
    const [fc,meta,wm]=await Promise.all([read("padawan-pilot.geojson"),read("manifest.json"),read("world-manifest.json")]);
    validateBuildingAsset(fc,meta);
    if (wm.generator!=="Arnis" || wm.verification?.structurallyVerified!==true
      || !Number.isFinite(wm.bytes) || wm.bytes<=0 || wm.bytes>24*1024*1024) throw new Error("Arnis world not verified");
    const viewer=getViewer(), C=window.Cesium;
    if (!viewer || !C) throw new Error("3D viewer unavailable");
    const source=new C.CustomDataSource("padawan-building-pilot");
    const hierarchy=rings=>new C.PolygonHierarchy(
      C.Cartesian3.fromDegreesArray(rings[0].slice(0,-1).flat()),
      rings.slice(1).map(r=>new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(r.slice(0,-1).flat()))));
    for (const f of fc.features) {
      const p=f.properties;
      if (f.geometry?.type!=="Polygon" || !Number.isFinite(p.height) || p.height<=p.minHeight) throw new Error("Invalid building geometry/height");
      const id="building:"+f.id;
      source.entities.add({id,name:p.name || p.kind || "Building",polygon:{
        hierarchy:hierarchy(f.geometry.coordinates),height:p.minHeight,extrudedHeight:p.height,
        material:C.Color.fromCssColorString(p.osmId===958011498?"#1f4e79":"#b7c5ce"),outline:false,
      }});
      features.set(id,f);
    }
    const b=meta.bounds;
    source.entities.add({id:"building-pilot-boundary",polyline:{
      positions:C.Cartesian3.fromDegreesArray([b.west,b.south,b.east,b.south,b.east,b.north,b.west,b.north,b.west,b.south]),
      width:2,material:C.Color.fromCssColorString("#b45309"),clampToGround:true}});
    // A dedicated data source survives operational marker refreshes.
    await viewer.dataSources.add(source);
    layer=source; manifest=meta; world=wm;
    handler=new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction(event=>{
      if (!enabled) return;
      const hit=viewer.scene.pick(event.position);
      selection=features.get(hit?.id?.id) || null; render();
    },C.ScreenSpaceEventType.LEFT_CLICK);
  }
  button.addEventListener("click",async()=>{
    if (busy) return;
    if (enabled && getDimension()==="3d") {enabled=false; layer.show=false; selection=null; render(); getViewer()?.scene.requestRender(); return;}
    const previousDimension=getDimension();
    busy=true; error=false; render();
    try {
      await setDimension("3d"); await load();
      enabled=true; layer.show=getDimension()==="3d";
      document.dispatchEvent?.(new Event("pilot-buildings-active"));
      focus();
    } catch (e) {
      error=true; enabled=false; if (layer) layer.show=false;
      console.warn("Building pilot unavailable",e.message);
      if (previousDimension==="2d") await setDimension("2d");
    } finally {busy=false; render(); getViewer()?.scene.requestRender();}
  });
  focusButton.addEventListener("click",async()=>{
    await setDimension("3d"); focus();
  });
  document.addEventListener("operator-language",render);
  document.addEventListener("regional-buildings-active",()=>{
    enabled=false; selection=null; if(layer) layer.show=false; render();
  });
  render();
  return { dimensionChanged(dim) {
    if (layer) layer.show=enabled && dim==="3d";
    if (dim==="3d" && enabled) focus();
    render();
  }};
}
