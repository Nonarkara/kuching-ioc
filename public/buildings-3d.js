import { HEIGHT_SOURCES, tileBounds } from "./building-geometry.js";

const COPY = {
  en: {
    off: "3D buildings", on: "Hide 3D buildings", focus: "Assembly", padawan: "Padawan",
    idle: "Extruded footprints for Padawan and Greater Kuching. Height is the tagged value, storeys × 3.2 m, or a type default.",
    busy: "Loading building tiles…",
    error: "Building layer unavailable. The 2D map still works.",
    inView: "in view", mapped: "mapped", height: "Height",
    sources: {
      "osm-height": "OSM height tag",
      "overture-height": "Overture height",
      "levels-estimate": "storeys × 3.2 m",
      "type-estimate": "type default",
      "default-estimate": "default 6 m",
    },
    flat: "Flat ground. Not a flood model.",
    source: "Source", download: "Download Arnis world",
    world: "Arnis Java world · file structure checked; not play-tested.",
    dates: "Data dates", unknown: "Unnamed building",
    floatTitle: "Buildings",
    assemblyShort: "Assembly: hand model · CC BY-SA photos · OSM way 1357531465",
    assembly: "Dewan Undangan Negeri: hand model of the golden umbrella roof, from CC BY-SA photos and the OSM footprint. Not a survey.",
    zoom: "Pan to load every mapped building in view.",
    truncated: "Showing the largest footprints in this view.",
  },
  th: {
    off: "อาคาร 3 มิติ", on: "ซ่อนอาคาร 3 มิติ", focus: "อาคารสภา", padawan: "ปาดาวัน",
    idle: "อาคารนูนของปาดาวันและกูชิง ความสูงมาจากข้อมูล ถ้าไม่มีใช้จำนวนชั้น × 3.2 ม. หรือค่าตามประเภท",
    busy: "กำลังโหลดแผ่นอาคาร…",
    error: "ชั้นอาคารใช้ไม่ได้ แผนที่ 2 มิติยังทำงาน",
    inView: "ในมุมมอง", mapped: "ที่ทำแผนที่", height: "ความสูง",
    sources: {
      "osm-height": "ความสูงจาก OSM",
      "overture-height": "ความสูงจาก Overture",
      "levels-estimate": "จำนวนชั้น × 3.2 ม.",
      "type-estimate": "ค่าตามประเภท",
      "default-estimate": "ค่าเริ่มต้น 6 ม.",
    },
    flat: "พื้นราบ ไม่ใช่แบบจำลองน้ำท่วม",
    source: "แหล่งข้อมูล", download: "ดาวน์โหลดโลก Arnis",
    world: "โลก Arnis ตรวจโครงสร้างไฟล์แล้ว ยังไม่ได้ทดลองในเกม",
    dates: "วันที่ข้อมูล", unknown: "อาคารไม่มีชื่อ",
    floatTitle: "อาคาร",
    assemblyShort: "อาคารสภา: แบบจำลองมือ · ภาพ CC BY-SA · OSM 1357531465",
    assembly: "อาคารสภานิติบัญญัติซาราวัก: แบบจำลองหลังคาฉัตรสีทอง สร้างด้วยมือจากภาพ CC BY-SA และผัง OSM ไม่ใช่การรังวัด",
    zoom: "เลื่อนแผนที่เพื่อโหลดอาคารทุกหลังในมุมมอง",
    truncated: "แสดงอาคารที่มีพื้นที่ใหญ่ที่สุดในมุมมองนี้",
  },
  zh: {
    off: "3D建筑", on: "隐藏3D建筑", focus: "议会大厦", padawan: "巴达旺",
    idle: "巴达旺与大古晋的拉伸建筑。高度优先用标注值，否则层数 × 3.2 米，或按类型的默认值。",
    busy: "正在加载建筑分块…",
    error: "建筑图层不可用。2D 地图仍可使用。",
    inView: "在视野内", mapped: "已制图", height: "高度",
    sources: {
      "osm-height": "OSM 高度标注",
      "overture-height": "Overture 高度",
      "levels-estimate": "层数 × 3.2 米",
      "type-estimate": "按类型的默认值",
      "default-estimate": "默认 6 米",
    },
    flat: "平地模型，不是洪水模型。",
    source: "来源", download: "下载 Arnis 世界",
    world: "Arnis Java 世界 · 已检查文件结构，未在游戏中测试。",
    dates: "数据日期", unknown: "未命名建筑",
    floatTitle: "建筑",
    assemblyShort: "议会大厦：手工模型 · CC BY-SA 照片 · OSM 1357531465",
    assembly: "砂拉越州立法议会：根据 CC BY-SA 照片和 OSM 轮廓手建的金色伞顶，不是测绘模型。",
    zoom: "平移地图可加载视野内每一栋已制图建筑。",
    truncated: "本视野只显示占地较大的建筑。",
  },
  ms: {
    off: "Bangunan 3D", on: "Sembunyikan bangunan 3D", focus: "Dewan Undangan", padawan: "Padawan",
    idle: "Tapak tersemperit untuk Padawan dan Greater Kuching. Tinggi ialah nilai bertanda, tingkat × 3.2 m, atau lalai jenis.",
    busy: "Memuatkan jubin bangunan…",
    error: "Lapisan bangunan tidak tersedia. Peta 2D masih berfungsi.",
    inView: "dalam pandangan", mapped: "dipetakan", height: "Ketinggian",
    sources: {
      "osm-height": "tag tinggi OSM",
      "overture-height": "tinggi Overture",
      "levels-estimate": "tingkat × 3.2 m",
      "type-estimate": "lalai jenis",
      "default-estimate": "lalai 6 m",
    },
    flat: "Tanah rata. Bukan model banjir.",
    source: "Sumber", download: "Muat turun dunia Arnis",
    world: "Dunia Java Arnis · struktur fail diperiksa; belum diuji dalam permainan.",
    dates: "Tarikh data", unknown: "Bangunan tanpa nama",
    floatTitle: "Bangunan",
    assemblyShort: "Dewan Undangan: model tangan · foto CC BY-SA · OSM 1357531465",
    assembly: "Dewan Undangan Negeri: model tangan bumbung payung emas, daripada foto CC BY-SA dan tapak OSM. Bukan ukur.",
    zoom: "Gerakkan peta untuk memuatkan setiap bangunan dipetakan dalam pandangan.",
    truncated: "Menunjukkan tapak terbesar dalam pandangan ini.",
  },
};

const COLORS = ["#d7e4ea", "#f0d7a8", "#e7d3b0", "#efe8dc", "#f7f4ee"];
const PLACES = {
  padawan: { west: 110.318, south: 1.421, east: 110.336, north: 1.436 },
  assembly: { west: 110.341, south: 1.555, east: 110.355, north: 1.569 },
};
const MAX_TILES = 3;
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_ENTITIES = 8000;

export function selectTiles(tiles, bounds, center, limits = {}) {
  const maxTiles = limits.maxTiles ?? MAX_TILES;
  const maxBytes = limits.maxBytes ?? MAX_BYTES;
  const hits = (tiles || []).filter((t) => {
    const b = tileBounds(t.z || 14, t.x, t.y);
    return b.east >= bounds.west && b.west <= bounds.east && b.north >= bounds.south && b.south <= bounds.north;
  });
  const cx = center?.lon ?? (bounds.west + bounds.east) / 2;
  const cy = center?.lat ?? (bounds.south + bounds.north) / 2;
  hits.sort((a, b) => {
    const ac = tileBounds(a.z || 14, a.x, a.y);
    const bc = tileBounds(b.z || 14, b.x, b.y);
    const da = ((ac.west + ac.east) / 2 - cx) ** 2 + ((ac.south + ac.north) / 2 - cy) ** 2;
    const db = ((bc.west + bc.east) / 2 - cx) ** 2 + ((bc.south + bc.north) / 2 - cy) ** 2;
    return da - db;
  });
  const picked = [];
  let bytes = 0;
  for (const t of hits) {
    if (picked.length >= maxTiles) break;
    if (picked.length && bytes + (t.bytes || 0) > maxBytes) break;
    picked.push(t);
    bytes += t.bytes || 0;
  }
  return { tiles: picked, bytes };
}

function ringArea(ring) {
  let area = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    area += ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
  }
  return Math.abs(area);
}

async function readGzJson(url) {
  const response = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!response.ok) throw new Error("Building tile HTTP " + response.status);
  const buf = await response.arrayBuffer();
  const bytes = new Uint8Array(buf);
  let text;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream("gzip"));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(bytes);
  }
  return JSON.parse(text);
}

export function setupBuildings3D({ getViewer, getDimension, setDimension, getLang, getScope, setScope, onLang, version }) {
  const button = document.getElementById("buildingsToggle");
  const focusButton = document.getElementById("buildingsFocus");
  const padawanButton = document.getElementById("buildingsPadawan");
  const status = document.getElementById("buildingsStatus");
  const attribution = document.getElementById("buildingsAttribution");
  const picked = document.getElementById("buildingSelection");
  const download = document.getElementById("arnisDownload");
  if (!button || !status || !focusButton || !picked || !download || !attribution) return null;

  let enabled = false, busy = false, error = false, layer = null, manifest = null;
  let selection = null, world = null, handler = null, truncated = false, inView = 0;
  let currentPlace = PLACES.padawan;
  const cache = new Map();
  const features = new Map();
  let lastRows = [];
  const copy = () => COPY[getLang()] || COPY.en;

  function scopeAllows(council) {
    return getScope?.() === "padawan" ? council === "mpp" : true;
  }
  function setMapFirst(on) {
    document.querySelector?.(".dashboard-shell")?.classList.toggle("bldg-map", on);
    document.documentElement?.classList?.toggle?.("bldg-map", on);
    const float = document.getElementById("bldgFloat");
    if (float) float.hidden = !on;
    const viewer = getViewer();
    viewer?.resize?.();
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(() => viewer?.resize?.());
  }
  function fillFloat(summary) {
    const el = document.getElementById("bldgFloat");
    if (!el) return;
    const c = copy();
    el.replaceChildren();
    const title = document.createElement("strong");
    title.textContent = c.floatTitle;
    const line = document.createElement("p");
    line.textContent = manifest && enabled
      ? `${inView} ${c.inView}${truncated ? " · " + c.truncated : ""}`
      : summary;
    const credit = document.createElement("p");
    credit.textContent = c.assemblyShort;
    el.append(title, line, credit);
    if (selection) {
      const detail = document.createElement("p");
      const sourceName = HEIGHT_SOURCES[selection.s] || "default-estimate";
      detail.textContent = `${selection.n || c.unknown} · ${c.height}: ${selection.h} m · ${c.sources[sourceName] || sourceName}`;
      el.append(detail);
    }
  }
  function render() {
    const c = copy();
    const visible = enabled && getDimension() === "3d";
    button.textContent = visible ? c.on : c.off;
    button.setAttribute("aria-pressed", String(visible));
    button.disabled = busy;
    focusButton.textContent = c.focus;
    focusButton.disabled = !enabled || busy;
    if (padawanButton) {
      padawanButton.textContent = c.padawan;
      padawanButton.disabled = !enabled || busy;
    }
    download.textContent = c.download;
    const mix = manifest ? HEIGHT_SOURCES.map((name) => manifest.heightCounts?.[name] ? `${manifest.heightCounts[name]} ${c.sources[name]}` : null).filter(Boolean).join(" · ") : "";
    const summary = busy ? c.busy : error ? c.error : enabled && manifest
      ? `${inView} ${c.inView} / ${manifest.featureCount} ${c.mapped} · ${c.flat}${truncated ? " · " + c.truncated : ""}${mix ? " · " + mix : ""}`
      : c.idle;
    status.textContent = summary;
    const worldNote = document.getElementById("arnisWorldNote");
    if (worldNote) worldNote.textContent = c.world;
    const dates = document.getElementById("buildingsDataDates");
    if (dates) dates.textContent = manifest ? `${c.dates}: Overture ${manifest.overtureRelease || "—"} · ${manifest.bakedAt?.slice(0, 10) || "—"}${world?.generatedAt ? " · Arnis " + world.generatedAt.slice(0, 10) : ""}` : "";
    attribution.textContent = `${manifest?.attribution || "© OpenStreetMap contributors, Overture Maps Foundation"}\n${c.assemblyShort}`;
    attribution.href = "./data/buildings/CREDITS.md";
    picked.replaceChildren();
    if (selection) {
      const sourceName = HEIGHT_SOURCES[selection.s] || "default-estimate";
      const title = document.createElement("strong");
      const detail = document.createElement("span");
      const link = document.createElement("a");
      title.textContent = selection.n || c.unknown;
      detail.textContent = `${c.height}: ${selection.h} m · ${c.sources[sourceName] || sourceName}`;
      link.textContent = c.source;
      link.href = selection.o ? `https://www.openstreetmap.org/way/${selection.o}` : "https://docs.overturemaps.org/attribution/";
      link.target = "_blank";
      link.rel = "noopener";
      picked.append(title, detail, link);
    }
    picked.hidden = !selection || !visible;
    const details = document.getElementById("buildingsDetails");
    if (details) details.dataset.layerState = error ? "error" : busy ? "busy" : enabled ? "on" : "off";
    fillFloat(summary);
    document.querySelectorAll?.(".bldg-lang").forEach((node) => {
      node.setAttribute("aria-pressed", String(node.dataset.lang === getLang()));
    });
  }
  function paintContinuously(on) {
    const viewer = getViewer();
    if (!viewer?.scene) return;
    viewer.scene.requestRenderMode = on ? false : !!viewer.scene.globe?.tilesLoaded;
    viewer.scene.requestRender();
  }
  function focus(bounds) {
    const viewer = getViewer(), C = window.Cesium;
    if (!viewer || !C || !bounds) return;
    currentPlace = bounds;
    const lon = (bounds.west + bounds.east) / 2;
    const lat = (bounds.south + bounds.north) / 2;
    // Frame the centre from a few hundred metres out. Fitting the whole
    // district sphere left 6 m houses a couple of pixels tall.
    const sphere = new C.BoundingSphere(C.Cartesian3.fromDegrees(lon, lat, 0), 40);
    paintContinuously(true);
    viewer.camera.flyToBoundingSphere(sphere, {
      offset: new C.HeadingPitchRange(C.Math.toRadians(28), C.Math.toRadians(-45), 420),
      duration: 1.1,
    });
    viewer.scene.requestRender();
  }
  function entityList(source) {
    if (!source?.entities) return [];
    if (source.entities.values) return [...source.entities.values];
    return source.entities.items || [];
  }
  function removeEntity(source, entity) {
    if (source.entities.remove) source.entities.remove(entity);
    else if (source.entities.items) {
      const index = source.entities.items.indexOf(entity);
      if (index >= 0) source.entities.items.splice(index, 1);
    }
  }
  function addAssembly() {
    const C = window.Cesium;
    const assembly = manifest.assembly;
    if (!assembly || entityList(layer).some((entity) => entity.id === "assembly-model")) return;
    layer.entities.add({
      id: "assembly-model",
      name: assembly.name,
      position: C.Cartesian3.fromDegrees(assembly.lon, assembly.lat, 0),
      model: { uri: `./data/buildings/${assembly.model || "dun-sarawak.glb"}?v=${encodeURIComponent(version)}`, scale: 1 },
    });
  }
  function rebuild(rows) {
    lastRows = rows;
    const C = window.Cesium;
    for (const entity of entityList(layer)) {
      if (String(entity.id).startsWith("bldg:")) removeEntity(layer, entity);
    }
    features.clear();
    const allowed = rows.filter((row) => scopeAllows(row.c) && Number.isFinite(row.h) && row.h > 0 && row.h <= 300 && row.g?.length >= 4);
    truncated = allowed.length > MAX_ENTITIES;
    const draw = truncated ? allowed.slice().sort((a, b) => ringArea(b.g) - ringArea(a.g)).slice(0, MAX_ENTITIES) : allowed;
    inView = draw.length;
    draw.forEach((row, index) => {
      const id = `bldg:${index}:${row.o || row.c}`;
      const ring = row.g[0][0] === row.g.at(-1)[0] && row.g[0][1] === row.g.at(-1)[1] ? row.g : [...row.g, row.g[0]];
      layer.entities.add({
        id,
        name: row.n || row.k || "Building",
        polygon: {
          hierarchy: new C.PolygonHierarchy(C.Cartesian3.fromDegreesArray(ring.slice(0, -1).flat())),
          height: row.b || 0,
          extrudedHeight: row.h,
          material: C.Color.fromCssColorString(COLORS[row.s] || COLORS[4]),
          outline: false,
        },
      });
      features.set(id, row);
    });
    addAssembly();
    getViewer()?.scene.requestRender();
  }
  async function refresh(bounds, center) {
    if (!layer || !manifest || !bounds) return;
    const chosen = selectTiles(manifest.tiles, bounds, center);
    const rows = [];
    for (const tile of chosen.tiles) {
      const key = `${tile.z}/${tile.x}/${tile.y}`;
      if (!cache.has(key)) {
        const url = `./data/buildings/tiles/${tile.z}/${tile.x}/${tile.y}.json.gz?v=${encodeURIComponent(version)}`;
        const json = await readGzJson(url);
        cache.set(key, json.features || []);
      }
      rows.push(...cache.get(key));
    }
    rebuild(rows);
    render();
  }
  async function load() {
    if (layer) return;
    const suffix = "?v=" + encodeURIComponent(version);
    const indexResponse = await fetch("./data/buildings/city-index.json" + suffix, { signal: AbortSignal.timeout(15000) });
    if (!indexResponse.ok) throw new Error("Building index HTTP " + indexResponse.status);
    manifest = await indexResponse.json();
    if (!manifest?.tiles?.length || !manifest.assembly?.osmId) throw new Error("Invalid city building index");
    try {
      const worldResponse = await fetch("./data/buildings/world-manifest.json" + suffix, { signal: AbortSignal.timeout(15000) });
      world = worldResponse.ok ? await worldResponse.json() : null;
    } catch { world = null; }
    const viewer = getViewer(), C = window.Cesium;
    if (!viewer || !C) throw new Error("3D viewer unavailable");
    const source = new C.CustomDataSource("kuching-buildings");
    await viewer.dataSources.add(source);
    layer = source;
    addAssembly();
    if (!handler) {
      handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
      handler.setInputAction((event) => {
        if (!enabled) return;
        const hit = viewer.scene.pick(event.position);
        selection = features.get(hit?.id?.id) || null;
        render();
      }, C.ScreenSpaceEventType.LEFT_CLICK);
      viewer.camera.moveEnd?.addEventListener?.(() => {
        if (!enabled || getDimension() !== "3d") return;
        const rect = viewer.camera.computeViewRectangle?.();
        if (!rect || !C.Math?.toDegrees) return;
        const bounds = {
          west: C.Math.toDegrees(rect.west), south: C.Math.toDegrees(rect.south),
          east: C.Math.toDegrees(rect.east), north: C.Math.toDegrees(rect.north),
        };
        const carto = viewer.camera.positionCartographic;
        const center = carto ? { lon: C.Math.toDegrees(carto.longitude), lat: C.Math.toDegrees(carto.latitude) } : null;
        refresh(bounds, center).catch((err) => console.warn("Building tiles", err.message));
      });
    }
  }
  async function show(place) {
    const previous = getDimension();
    busy = true; error = false; render();
    try {
      currentPlace = place;
      await setDimension("3d");
      await load();
      enabled = true;
      layer.show = getDimension() === "3d";
      setMapFirst(true);
      focus(place);
      const center = { lon: (place.west + place.east) / 2, lat: (place.south + place.north) / 2 };
      await refresh(place, center);
    } catch (err) {
      error = true; enabled = false;
      if (layer) layer.show = false;
      setMapFirst(false);
      console.warn("Buildings unavailable", err.message);
      if (previous === "2d") await setDimension("2d");
    } finally {
      busy = false;
      render();
      getViewer()?.scene.requestRender();
    }
  }
  button.addEventListener("click", async () => {
    if (busy) return;
    if (enabled && getDimension() === "3d") {
      enabled = false;
      if (layer) layer.show = false;
      selection = null;
      setMapFirst(false);
      paintContinuously(false);
      render();
      getViewer()?.scene.requestRender();
      return;
    }
    const place = getScope?.() === "greater_kuching" ? PLACES.assembly : PLACES.padawan;
    await show(place);
  });
  focusButton.addEventListener("click", async () => {
    if (busy) return;
    await setScope?.("greater_kuching", { silent: true, skipFly: true });
    await show(PLACES.assembly);
  });
  padawanButton?.addEventListener("click", async () => {
    if (busy) return;
    await setScope?.("padawan", { silent: true, skipFly: true });
    await show(PLACES.padawan);
  });
  document.querySelectorAll?.(".bldg-lang").forEach((node) => {
    node.addEventListener("click", () => onLang?.(node.dataset.lang));
  });
  document.addEventListener("operator-language", render);
  render();
  return {
    dimensionChanged(dim) {
      if (layer) layer.show = enabled && dim === "3d";
      setMapFirst(enabled && dim === "3d");
      if (dim === "3d" && enabled) focus(currentPlace);
      render();
    },
    scopeChanged() {
      if (enabled && layer) rebuild(lastRows);
      render();
    },
  };
}
