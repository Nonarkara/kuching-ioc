// Dynamic versioned import of data.js — pulls the asset version from the
// app.js <script> tag's ?v= query so that updating the script tag (which
// build.mjs already does on every build) cache-busts data.js too. Without
// this, the browser keeps the old data.js parsed in module memory and any
// new export silently fails to import. Top-level await is supported in ES
// modules, which app.js declares via <script type="module">.
const __ASSET_VER__ = (() => {
  try {
    const tag = document.querySelector('script[src*="app.js"]');
    return tag?.src.match(/[?&]v=([^&]+)/)?.[1] || "";
  } catch { return ""; }
})();
const __dataUrl__ = `./data.js${__ASSET_VER__ ? `?v=${encodeURIComponent(__ASSET_VER__)}` : ""}`;
const {
  SITE, JURISDICTIONS, LOCAL_MARKERS, SARAWAK_RIVER, ASEAN_CLOCKS,
  MAP_WATCHPOINTS, AIRPORT_FALLBACK_ROUTES, FALLBACK_NEWS, FALLBACK_TRENDS,
  WEATHER_FALLBACK, AIR_FALLBACK, CITY_DEMOGRAPHICS, TRANSLATIONS,
  round, aqiBand, weatherCodeLabel, kmBetween, classifyAircraft,
  sourceRecord, buildMapLayers, URBAN_LAYERS, ECONOMY_FALLBACK, RIVER_BYPASS_PROJECT, MPP_WARD_PROJECTS,
  WARD_TENSION, WARD_TENSION_ILLUSTRATIVE, CCTV_FEEDS
} = await import(__dataUrl__);

const BOOT = window.__IOC_BOOT__ || {};

// Geographic scope — "padawan" (default, MPP-only hydro + news) or
// "greater_kuching" (all 3 councils, all iHYDRO stations, full news).
// Mutable at runtime; persisted in localStorage. The masthead scope-toggle
// calls setScope() and the html data-view attribute is set in lockstep for
// the existing CSS rules (padawan → "secretary" trimmed layout,
// greater_kuching → "full" everything).
const SCOPE_STORAGE_KEY = "kch_ioc_scope_v1";
const VALID_SCOPES = ["padawan", "greater_kuching"];
const SCOPES = {
  padawan: {
    id: "padawan",
    mapCenter: [1.46, 110.31],
    mapZoom: 12,
    label: { en: "PADAWAN FOCUS", ms: "FOKUS PADAWAN", zh: "百大万焦点" },
    pill: { en: "PADAWAN FOCUS", ms: "FOKUS PADAWAN", zh: "百大万焦点" },
  },
  greater_kuching: {
    id: "greater_kuching",
    mapCenter: [1.53, 110.35],
    mapZoom: 11,
    label: { en: "GREATER KUCHING", ms: "GREATER KUCHING", zh: "古晋大都会" },
    pill: { en: "GREATER KUCHING", ms: "GREATER KUCHING", zh: "古晋大都会" },
  },
};
function readStoredScope() {
  try {
    const raw = localStorage.getItem(SCOPE_STORAGE_KEY);
    if (raw && VALID_SCOPES.includes(raw)) return raw;
  } catch (_) { /* localStorage disabled */ }
  // Backwards compat: an explicit data-view="full" on <html> implies the
  // user previously opted into the broader view, otherwise default to padawan.
  const fromHtml = document.documentElement.dataset.view;
  if (fromHtml === "full") return "greater_kuching";
  if (fromHtml === "secretary") return "padawan";
  return "padawan";
}
function writeStoredScope(scope) {
  try { localStorage.setItem(SCOPE_STORAGE_KEY, scope); } catch (_) { /* quota / disabled */ }
}
// Runtime check — replaces the old module-load `isSecretary` const. All
// renderers that previously read `isSecretary` now read this so that the
// `g` keyboard shortcut and the masthead toggle can switch scope without
// a full page reload.
function isPadawanScope() { return state.scope === "padawan"; }

// Map dimension — "2d" (Leaflet, default) or "3d" (CesiumJS digital twin).
// Persisted in localStorage. CesiumJS is lazy-loaded only on the first 3D
// toggle to keep the 2D default payload lean.
const DIM_STORAGE_KEY = "kch_ioc_dimension_v1";
const VALID_DIMS = ["2d", "3d"];
function readStoredDim() {
  try {
    const raw = localStorage.getItem(DIM_STORAGE_KEY);
    if (raw && VALID_DIMS.includes(raw)) return raw;
  } catch (_) { /* localStorage disabled */ }
  return "2d";
}
function writeStoredDim(dim) {
  try { localStorage.setItem(DIM_STORAGE_KEY, dim); } catch (_) { /* quota */ }
}

const SOURCE_STATUS_LABEL = {
  live: "live",
  official: "official",
  fallback: "backup feed",
  offline: "offline",
  reference: "cached",
  curated: "hand-curated",
};

// --- State ---
const state = {
  map: null, boundaryLayerGroup: null, markerLayerGroup: null, labelLayerGroup: null,
  urbanLayerGroups: new Map(),
  tileLayers: new Map(), activeLayerId: "dark", payload: null, hasInitialMapFit: false,
  theme: "dark", lang: "en", mapResizeObserver: null,
  activeWard: null,
  scope: readStoredScope(),
  dimension: readStoredDim(),
  cesiumViewer: null,
  cesiumInitialised: false,
  localityFilter: { ward: null, stateCode: null, parliamentCode: null, propertyType: null, search: "" },
  wardFeatures: null, wardLayerGroup: null, wardHighlightLayer: null,
};

// Lock the html data-view attribute to whatever scope was hydrated, so the
// existing `[data-view="secretary"]` CSS rules gate the trimmed panel set
// the same way as before. Setting this once at module load is enough —
// setScope() will update it again when the user toggles.
document.documentElement.dataset.view = state.scope === "padawan" ? "secretary" : "full";

// --- DOM ---
const $ = id => document.getElementById(id);

// --- Utilities ---
const nowIso = () => new Date().toISOString();
const num = (v, d = 0) => Number(v ?? 0).toLocaleString("en-MY", { maximumFractionDigits: d, minimumFractionDigits: d });
const clockTime = tz => new Intl.DateTimeFormat("en-MY", { hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:tz }).format(new Date());
const formatShortStamp = value => new Date(value).toLocaleString("en-MY", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const formatBadgeStamp = value => value ? new Date(value).toLocaleString("en-MY", {
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
}) : null;

// --- Pass 1: Control-room helpers (delta digest, directive state, glyph status) ---
const SNAPSHOT_KEY = "kch_ioc_snapshot_v1";
const VISIT_KEY    = "kch_ioc_last_visit_v1";
const DIRECTIVE_STATE_KEY = "kch_ioc_directive_state_v1";

// djb2-ish small hash; stable, fast, no crypto needed.
function hashStr(s) {
  let h = 5381;
  const str = String(s ?? "");
  for (let i = 0; i < str.length; i++) h = (h * 33) ^ str.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// Map a status string to a HUD glyph (▰ live, ▱ cached, ◐ degraded, ✕ offline).
function statusGlyph(status) {
  const map = {
    live: "▰", ok: "▰", clear: "▰", none: "▰",
    cached: "▱", reference: "▱", curated: "▱", snapshot: "▱",
    degraded: "◐", fallback: "◐", warn: "◐",
    offline: "✕", error: "✕",
  };
  return map[String(status || "").toLowerCase()] || "⊙";
}
function statusTone(status) {
  const s = String(status || "").toLowerCase();
  if (s === "live" || s === "ok" || s === "clear" || s === "none") return "ok";
  if (s === "offline" || s === "error") return "alert";
  if (s === "degraded" || s === "fallback" || s === "warn") return "warn";
  return "muted";
}
function glyphHTML(status, label) {
  const g = statusGlyph(status);
  const tone = statusTone(status);
  const txt = label != null ? `<span>${label}</span>` : "";
  return `<span class="glyph" data-tone="${tone}" title="${status}">${g}</span>${txt}`;
}

function safeStorage() {
  try { return window.localStorage; } catch (_) { return null; }
}
function readJson(key) {
  const ls = safeStorage(); if (!ls) return null;
  try { const v = ls.getItem(key); return v ? JSON.parse(v) : null; } catch (_) { return null; }
}
function writeJson(key, value) {
  const ls = safeStorage(); if (!ls) return;
  try { ls.setItem(key, JSON.stringify(value)); } catch (_) { /* quota / disabled */ }
}

// Pass 2.5: pulse-ring period scaled to data freshness (newer = faster).
function freshnessPeriodSeconds(updatedAt) {
  if (!updatedAt) return 8;
  const ageMin = (Date.now() - Date.parse(updatedAt)) / 60_000;
  if (ageMin < 1) return 1.6;
  if (ageMin < 10) return 2.6;
  if (ageMin < 60) return 4;
  return 8;
}
// Compass bearing from (lat1,lon1) → (lat2,lon2) in degrees [0,360).
function bearingFromTo(lat1, lon1, lat2, lon2) {
  const toRad = d => d * Math.PI / 180;
  const dLon = toRad(lon2 - lon1);
  const y = Math.sin(dLon) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// Functional radar sweep — every second, advance the virtual sweep angle and
// flash any pulse-marker whose bearing-from-map-centre lies within the cone.
// Subtle, but reads as a system that's actively scanning, not just decoration.
function startRadarSweep() {
  if (state.radarTimer) return;
  let angle = 0;
  state.radarTimer = setInterval(() => {
    angle = (angle + 12) % 360;
    if (!state.map || !state.pulseMarkerEls?.size) return;
    const center = state.map.getCenter();
    state.pulseMarkerEls.forEach(({ lat, lon, marker }) => {
      const bearing = bearingFromTo(center.lat, center.lng, lat, lon);
      const diff = Math.abs(((bearing - angle + 540) % 360) - 180);
      const within = diff > 174; // within ±6° of the sweep
      if (!within) return;
      const el = marker.getElement?.()?.querySelector(".pulse-marker");
      if (!el) return;
      el.dataset.swept = "true";
      setTimeout(() => { el.dataset.swept = "false"; }, 600);
    });
  }, 1000);
}

function boardModeFromBoot() {
  if (BOOT.deploymentMode) return BOOT.deploymentMode;
  const host = window.location.hostname;
  if (host.endsWith("github.io")) return "pages-static";
  return "live-service";
}

// Layer fetch order matters: on Pages, /api/layers/mpp_wards has no extension
// and returns the SPA HTML with 200 OK, which then throws on .json() parse
// (49 "Ward boundaries unavailable" console warns per page load). On local
// server.mjs, the extensionless route is what serves the live data. Try the
// static .json first when we know we're on Pages.
async function fetchLayer(id) {
  const isStatic = boardModeFromBoot() === "pages-static";
  const primary = isStatic ? `${id}.json` : id;
  const secondary = isStatic ? id : `${id}.json`;
  const parseIfJson = async (res) => {
    if (!res || !res.ok) return null;
    const ct = res.headers.get("content-type") || "";
    if (!ct.includes("json")) return null;
    try { return await res.json(); } catch { return null; }
  };
  let out = await parseIfJson(await fetch(apiUrl(`/api/layers/${primary}`)).catch(() => null));
  if (!out) out = await parseIfJson(await fetch(apiUrl(`/api/layers/${secondary}`)).catch(() => null));
  return out;
}

function boardLabelFromBoot() {
  return BOOT.boardLabel || (boardModeFromBoot() === "pages-static" ? "SNAPSHOT BOARD" : "LIVE BOARD");
}

function apiUrl(pathname) {
  const relativePath = pathname.startsWith("./") ? pathname : `.${pathname}`;
  const basePath = window.location.pathname.endsWith("/")
    ? window.location.pathname
    : window.location.pathname.replace(/[^/]+$/, "");
  const url = new URL(relativePath, `${window.location.origin}${basePath}`);
  if (BOOT.assetVersion) url.searchParams.set("v", BOOT.assetVersion);
  return url.toString();
}

function buildModeMeta(mode) {
  if (mode === "live-api") {
    return { label: "LIVE API", detail: "Same-origin Node telemetry", tone: "live" };
  }
  if (mode === "static-snapshot") {
    return { label: "STATIC SNAPSHOT", detail: "GitHub Pages baked snapshot", tone: "snapshot" };
  }
  return { label: "CLIENT FALLBACK", detail: "Browser fallback telemetry", tone: "fallback" };
}

function decoratePayload(payload, { mode, manifest = null, error = null } = {}) {
  const modeMeta = buildModeMeta(mode);
  return {
    ...payload,
    delivery: {
      mode,
      modeLabel: modeMeta.label,
      modeDetail: modeMeta.detail,
      tone: modeMeta.tone,
      boardMode: boardModeFromBoot(),
      boardLabel: boardLabelFromBoot(),
      boardBuiltAt: BOOT.builtAt || null,
      pagesUrl: BOOT.pagesUrl || null,
      liveUrl: BOOT.liveUrl || null,
      assetVersion: manifest?.assetVersion || BOOT.assetVersion || null,
      snapshotBuiltAt: manifest?.builtAt || null,
      error: error ? String(error.message || error) : null,
    },
  };
}

function buildRuntimeDetail(delivery, payload) {
  // Secretary-facing: one short line, timestamps only. Asset hash + switch
  // links live in the title tooltip for debugging without eating masthead height.
  const parts = [];
  const payloadStamp = formatBadgeStamp(payload.generatedAt || payload.timeSignal?.serverNow);
  if (payloadStamp) parts.push(`Payload ${payloadStamp}`);
  if (delivery.mode === "static-snapshot" && delivery.snapshotBuiltAt) {
    parts.push(`Snapshot ${formatBadgeStamp(delivery.snapshotBuiltAt)}`);
  } else if (delivery.mode === "live-api" && delivery.boardBuiltAt) {
    parts.push(`Board ${formatBadgeStamp(delivery.boardBuiltAt)}`);
  }
  if (delivery.error && delivery.mode === "client-fallback") parts.push("static snapshot unavailable");
  return parts.join(" · ");
}

function buildRuntimeTooltip(delivery) {
  const bits = [];
  if (delivery.assetVersion) bits.push(`Asset ${delivery.assetVersion}`);
  const norm = (u) => String(u || "").replace(/\/$/, "");
  const pagesUrl = delivery.pagesUrl, liveUrl = delivery.liveUrl;
  if (norm(pagesUrl) && norm(liveUrl) && norm(pagesUrl) !== norm(liveUrl)) {
    bits.push(delivery.boardMode === "pages-static" ? `Live board: ${liveUrl}` : `Snapshot board: ${pagesUrl}`);
  }
  return bits.join(" · ");
}

function sourceStatusBucket(status) {
  if (status === "live") return "live";
  if (status === "official") return "official";
  if (status === "offline") return "offline";
  return "degraded";
}

function getSatelliteNarrative(sat) {
  if (!sat) {
    return {
      context: "No orbital evidence selected.",
      technique: "Evidence pending",
      prompt: "Select an orbital frame to anchor the scene read.",
      disclaimer: "Visual evidence is unavailable right now.",
    };
  }

  const notes = {
    "true-color": {
      context: "Best visible-light pass for cloud edge, haze smear, and river contrast over the urban core.",
      technique: "True color",
      prompt: "Use this to judge whether the sky looks genuinely dirty or the dashboard is just warning early.",
    },
    "terra-true-color": {
      context: "Second visible-light pass for checking whether haze or cloud structure is persisting across the wider basin.",
      technique: "True color",
      prompt: "Use this when crews report different conditions between north bank, airport corridor, and Padawan.",
    },
    terra: {
      context: "Second visible-light pass for checking whether haze or cloud structure is persisting across the wider basin.",
      technique: "True color",
      prompt: "Use this when crews report different conditions between north bank, airport corridor, and Padawan.",
    },
    precipitation: {
      context: "Rainfall intensity field. It does not show water on the road, but it does show where nuisance can escalate fast.",
      technique: "Rainfall field",
      prompt: "Use this to decide where low-lying drains deserve physical eyes before complaints pile up.",
    },
    aerosol: {
      context: "Aerosol depth proxy for smoke and haze load across the metro footprint.",
      technique: "Aerosol depth",
      prompt: "Use this to decide whether the AQI is just a number or something people will actually feel in their throat and eyes.",
    },
    "night-lights": {
      context: "Night luminosity pattern for growth, roadside intensity, and where the urban footprint keeps spreading.",
      technique: "Radiance map",
      prompt: "Use this for land-use pressure and corridor growth, not immediate incident response.",
    },
    vegetation: {
      context: "Vegetation density pass for canopy health and edge pressure at the city-growth boundary.",
      technique: "NDVI",
      prompt: "Use this for green-cover and watershed arguments, not minute-by-minute operations.",
    },
  };

  const match = notes[sat.id] || {};
  return {
    context: sat.description || match.context || "Orbital evidence for Greater Kuching.",
    technique: match.technique || "Orbital snapshot",
    prompt: match.prompt || "Use this as visual evidence, then verify on the ground.",
    disclaimer: "Orbital photo only. This is not a street camera or CCTV feed.",
  };
}

function buildQualitativeLens(payload, activeSatellite) {
  const weather = payload.climate?.weather || {};
  const air = payload.climate?.air || {};
  const airport = payload.airport || {};
  const news = payload.news || { items: [], operatorItems: [] };
  const rainMetric = payload.metrics.find((metric) => metric.id === "rain6h");
  const rain6h = Number(rainMetric?.value ?? 0);
  const degradedSources = (payload.sources || []).filter((source) => ["fallback", "offline", "reference", "curated"].includes(source.status));
  const satellite = activeSatellite || payload.satellites?.[0] || null;
  const satelliteNarrative = getSatelliteNarrative(satellite);

  const observations = [];
  if (weather.current?.apparentTemperatureC >= 35) {
    observations.push(`Street feel is punishing and sticky at roughly ${weather.current.apparentTemperatureC}C apparent. Outdoor crews will fatigue before the numbers look dramatic.`);
  } else if (weather.current?.apparentTemperatureC >= 32) {
    observations.push(`Surface conditions feel heavy rather than dangerous. People will still slow down, especially in open asphalt corridors.`);
  }
  if (rain6h >= 8) {
    observations.push(`A late rain burst can flip low-lying connectors from nuisance to blockage quickly. Batu Kawa and Penrissen deserve attention before the complaints start.`);
  } else if (rain6h >= 4) {
    observations.push(`Rain risk is present but still tactical. Expect ponding and messy movement rather than citywide disruption.`);
  }
  if (air.current?.aqi >= 85 || air.current?.pm25 >= 30) {
    observations.push(`Air quality is in the zone where sensitive people will notice throat and eye irritation, even if the city keeps moving.`);
  } else if (air.current?.aqi >= 70) {
    observations.push(`Visibility and comfort are beginning to degrade. Most people will cope, but sensitive groups will feel it.`);
  }
  if (airport.status !== "live") {
    observations.push("The airport strip is advisory only right now. Good for corridor awareness, not for precise sequencing or promises.");
  } else if ((airport.movements?.arrivals || 0) >= 4) {
    observations.push(`Inbound pulse is real: ${airport.movements.arrivals} arrivals are inside the current airspace envelope.`);
  }
  if (observations.length < 3 && satelliteNarrative.prompt) {
    observations.push(satelliteNarrative.prompt);
  }

  const checks = [];
  if (rain6h >= 6) {
    checks.push("Put physical eyes on low points before the heaviest rain window, especially Batu Kawa, Penrissen, and feeder drains.");
  } else {
    checks.push("Keep one mobile crew free for a fast drainage check if rain cells thicken over the southern growth corridor.");
  }
  if (air.current?.aqi >= 70 || satellite?.id === "aerosol") {
    checks.push("Use a real horizon check from the waterfront or airport corridor to confirm whether haze is operationally visible, not just numerically elevated.");
  } else {
    checks.push("Cross-check comfort and visibility with one field call before escalating environmental messaging.");
  }
  if (airport.status !== "live") {
    checks.push("If airport timing matters, switch to the live board or a tower-side source before making traffic commitments.");
  } else if (payload.delivery?.mode !== "live-api") {
    checks.push("This board is not the authoritative live surface. Use the live board before making time-sensitive calls.");
  } else {
    checks.push("At shift handover, compare the action cards with what crews are actually seeing. People drift; the board should not.");
  }

  const sourceItems = (news.operatorItems?.length ? news.operatorItems : news.items).slice(0, 3);
  const sourceCards = sourceItems.map((item) => ({
    ...item,
    badge: item.isOfficial ? "OFFICIAL" : item.languageBadge || item.languageLabel || "PRESS",
    note: item.isOfficial
      ? "Formal notice or direct operator-facing update."
      : `${item.languageLabel || "Local"} press lane used as human context, not command authority.`,
  }));

  const evidenceBits = [];
  if (satellite?.title) evidenceBits.push(`Visual anchor: ${satellite.title}`);
  if (degradedSources.length > 0) evidenceBits.push(`${degradedSources.length} feed gap${degradedSources.length > 1 ? "s" : ""} in the stack`);
  const modeLine = payload.delivery?.mode === "live-api"
    ? "Same-origin live API"
    : payload.delivery?.modeLabel || "Snapshot delivery";

  const lead = [
    rain6h >= 6 ? "The city feels one storm cell away from small-but-fast disruption." : "Conditions are readable, but they still need human verification.",
    airport.status !== "live" ? "Airspace movement is advisory, not authoritative." : "Airspace telemetry is live on this surface.",
    payload.delivery?.mode !== "live-api" ? "Treat this as a snapshot board, not a control surface." : "This board is suitable for live situational monitoring.",
  ].join(" ");

  return {
    lead,
    evidenceLine: evidenceBits.join(" · ") || "Visual anchor and qualitative reporting active.",
    modeLine,
    caveat: "No street-photo feed is configured yet. This scene read uses orbital imagery plus multilingual reporting as a qualitative proxy.",
    observations: observations.slice(0, 3),
    checks: checks.slice(0, 3),
    sources: sourceCards,
  };
}

function buildBoardBrief(payload) {
  const operations = payload.operations || [];
  const rainMetric = payload.metrics.find((metric) => metric.id === "rain6h");
  const aqiMetric = payload.metrics.find((metric) => metric.id === "aqi");
  const airportMetric = payload.metrics.find((metric) => metric.id === "airport");
  const degradedSources = (payload.sources || []).filter((source) => ["fallback", "offline", "reference", "curated"].includes(source.status));

  const now = operations.slice(0, 3).map((item) => item.title || item.detail || item.owner);
  if (now.length === 0) now.push("Nothing urgent right now — keep scanning the map.");

  const next = [];
  if (rainMetric) next.push(`Rain: ${rainMetric.value}${rainMetric.unit} in the next hours — ${rainMetric.context}`);
  if (aqiMetric) next.push(`Air: AQI ${aqiMetric.value} — ${aqiMetric.context}`);
  if (payload.airport?.status === "live") {
    next.push(`Flights: ${airportMetric?.value ?? payload.airport.movements?.totalTracked ?? 0} aircraft near KCH right now`);
  } else {
    next.push("Flights: live tracker is thin — treat counts as indicative only");
  }

  const blind = [];
  if (payload.delivery?.mode !== "live-api") {
    blind.push("This page refreshes about every 6 hours — not a live stream");
  }
  const actionableBlind = degradedSources.filter((source) => ["fallback", "offline"].includes(source.status));
  actionableBlind.slice(0, 3).forEach((source) => blind.push(`${source.name} is ${SOURCE_STATUS_LABEL[source.status] || source.status}`));
  if (blind.length === 0) blind.push("Main feeds look healthy");

  return { now: now.slice(0, 3), next: next.slice(0, 3), blind: blind.slice(0, 3) };
}


function queueMapResize() {
  if (!state.map) return;
  window.requestAnimationFrame(() => {
    state.map.invalidateSize(false);
    window.setTimeout(() => state.map?.invalidateSize(false), 120);
  });
}

async function fetchJson(url, ms = 10000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try { const r = await fetch(url, { signal: c.signal }); if (!r.ok) throw new Error(`${r.status}`); return await r.json(); }
  finally { clearTimeout(t); }
}

async function fetchOptionalJson(url, ms = 5000) {
  try {
    return await fetchJson(url, ms);
  } catch {
    return null;
  }
}

// --- i18n ---
function t(key) { return (TRANSLATIONS[state.lang] ?? TRANSLATIONS.en)[key] ?? key; }

// --- Data Loaders ---
async function loadWeather() {
  const u = new URL("https://api.open-meteo.com/v1/forecast");
  u.searchParams.set("latitude", String(SITE.focus.lat));
  u.searchParams.set("longitude", String(SITE.focus.lon));
  u.searchParams.set("current","temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,precipitation,weather_code,cloud_cover,pressure_msl");
  u.searchParams.set("hourly","temperature_2m,precipitation_probability,precipitation");
  u.searchParams.set("daily","temperature_2m_max,temperature_2m_min,uv_index_max,sunrise,sunset,precipitation_sum");
  u.searchParams.set("forecast_hours","12"); u.searchParams.set("past_days","1");
  u.searchParams.set("forecast_days","2"); u.searchParams.set("timezone","auto");
  try {
    const p = await fetchJson(u.toString());
    const c = p.current??{}, h = p.hourly??{}, d = p.daily??{};
    return {
      status:"live", updatedAt: nowIso(),
      current: { temperatureC:round(c.temperature_2m??0,1), apparentTemperatureC:round(c.apparent_temperature??0,1), humidity:Math.round(c.relative_humidity_2m??0), windKph:round(c.wind_speed_10m??0,1), precipitationMm:round(c.precipitation??0,1), cloudCover:Math.round(c.cloud_cover??0), weatherLabel:weatherCodeLabel(Number(c.weather_code??0)), pressureHpa:round(c.pressure_msl??0,1) },
      nextHours: (h.time??[]).slice(24,30).map((t,i)=>({ time:String(t).slice(11,16), precipitationMm:round(h.precipitation?.[i+24]??0,1), rainChance:Math.round(h.precipitation_probability?.[i+24]??0), temperatureC:round(h.temperature_2m?.[i+24]??0,1) })),
      daily: { maxC:round(d.temperature_2m_max?.[1]??0,1), minC:round(d.temperature_2m_min?.[1]??0,1), rainTotalMm:round(d.precipitation_sum?.[1]??0,1), uvIndexMax:round(d.uv_index_max?.[1]??0,1), sunrise:String(d.sunrise?.[1]??"").slice(11,16), sunset:String(d.sunset?.[1]??"").slice(11,16) },
      history: (h.temperature_2m??[]).slice(0,24).length > 0 ? (h.temperature_2m??[]).slice(0,24) : WEATHER_FALLBACK.history,
    };
  } catch { return { ...WEATHER_FALLBACK, updatedAt: nowIso() }; }
}

async function loadAirQuality() {
  const u = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  u.searchParams.set("latitude",String(SITE.focus.lat)); u.searchParams.set("longitude",String(SITE.focus.lon));
  u.searchParams.set("current","us_aqi,pm2_5,pm10,ozone,nitrogen_dioxide");
  u.searchParams.set("hourly","us_aqi,pm2_5"); u.searchParams.set("forecast_hours","24");
  u.searchParams.set("past_days","1"); u.searchParams.set("timezone","auto");
  try {
    const p = await fetchJson(u.toString());
    const c = p.current??{}, h = p.hourly??{};
    const aqi = Math.round(c.us_aqi??0);
    const hist = (h.us_aqi??[]).slice(0,24).map(v=>Math.round(v));
    return {
      status:"live", updatedAt:nowIso(),
      current:{ aqi, band:aqiBand(aqi), pm25:round(c.pm2_5??0,1), pm10:round(c.pm10??0,1), ozone:round(c.ozone??0,1), no2:round(c.nitrogen_dioxide??0,1) },
      nextHours: (h.time??[]).slice(24,30).map((t,i)=>({ time:String(t).slice(11,16), aqi:Math.round(h.us_aqi?.[i+24]??0), pm25:round(h.pm2_5?.[i+24]??0,1) })),
      history: hist.length > 0 ? hist : AIR_FALLBACK.history,
    };
  } catch { const f=AIR_FALLBACK; return { ...f, updatedAt:nowIso(), current:{...f.current, band:aqiBand(f.current.aqi)} }; }
}

async function loadEarthquakes() {
  try {
    const y = new Date(Date.now()-86400000).toISOString();
    const gj = await fetchJson(`https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=${y}&latitude=1.5&longitude=110.3&maxradiuskm=1000`, 10000);
    const ev = (gj.features||[]).map(f=>({ mag:f.properties.mag, place:f.properties.place, time:new Date(f.properties.time).toISOString() }));
    return { status:ev.length>0?"live":"stable", updatedAt:nowIso(), events:ev, summary:ev.length>0?`Mag ${ev[0].mag} @ ${ev[0].place}`:"No seismic activity in 24h." };
  } catch { return { status:"offline", updatedAt:nowIso(), events:[], summary:"USGS feed unavailable." }; }
}

async function loadAirport() {
  const buildFallback = () => {
    const fl = AIRPORT_FALLBACK_ROUTES.map((r,i)=>({
      id:`fb-${i}`, callsign:r.callsign, type:r.type, altitudeM:r.altitudeM,
      speedKph:r.type==="arrival"?360:310, distanceKm:r.distanceKm,
      latitude:SITE.airport.lat+(r.type==="arrival"?0.13-i*0.012:-0.03-i*0.01),
      longitude:SITE.airport.lon+(r.type==="arrival"?-0.14+i*0.02:0.04+i*0.012),
      etaMinutes:r.etaMinutes, label:r.type==="arrival"?r.origin:r.destination,
    }));
    return { status:"fallback", updatedAt:nowIso(), liveFlights:fl, movements:{ totalTracked:fl.length, arrivals:fl.filter(f=>f.type==="arrival").length, departures:fl.filter(f=>f.type==="departure").length } };
  };
  try {
    const u = new URL("https://opensky-network.org/api/states/all");
    u.searchParams.set("lamin","1.28"); u.searchParams.set("lomin","110.16");
    u.searchParams.set("lamax","1.67"); u.searchParams.set("lomax","110.58");
    const p = await fetchJson(u.toString(),10000);
    const fl = (p.states??[]).filter(s=>s?.[5]!=null&&s?.[6]!=null).map((s,i)=>{
      const lon=Number(s[5]),lat=Number(s[6]),alt=Math.max(0,Number(s[13]??s[7]??0));
      const spd=round((Number(s[9]??0)||0)*3.6,0), hdg=Number(s[10]??0)||0, vr=Number(s[11]??0)||0;
      const dist=round(kmBetween(lat,lon,SITE.airport.lat,SITE.airport.lon),1);
      const type=classifyAircraft(lat,lon,hdg,vr,alt);
      return { id:`${s[0]||"x"}-${i}`, callsign:String(s[1]||"UNID").trim()||"UNID", type, altitudeM:round(alt,0), speedKph:spd, distanceKm:dist, latitude:lat, longitude:lon, etaMinutes:type==="arrival"&&spd>80?Math.max(2,Math.round(dist/spd*60)):null, label:type==="arrival"?"Inbound":"Outbound" };
    }).filter(f=>f.distanceKm<=90).sort((a,b)=>a.distanceKm-b.distanceKm).slice(0,14);
    if (fl.length===0) return buildFallback();
    return { status:"live", updatedAt:nowIso(), liveFlights:fl, movements:{ totalTracked:fl.length, arrivals:fl.filter(f=>f.type==="arrival").length, departures:fl.filter(f=>f.type==="departure").length } };
  } catch { return buildFallback(); }
}

async function loadExchangeRates() {
  try {
    const p = await fetchJson("https://open.er-api.com/v6/latest/MYR", 8000);
    const rates = p.rates ?? {};
    return {
      status: "live", updatedAt: nowIso(), base: "MYR",
      pairs: [
        { code: "USD", rate: round(rates.USD ?? 0.2174, 4), label: "US Dollar" },
        { code: "SGD", rate: round(rates.SGD ?? 0.2891, 4), label: "Singapore Dollar" },
        { code: "THB", rate: round(rates.THB ?? 7.42, 2), label: "Thai Baht" },
        { code: "IDR", rate: round(rates.IDR ?? 3380, 0), label: "Indonesian Rupiah" },
        { code: "CNY", rate: round(rates.CNY ?? 1.58, 4), label: "Chinese Yuan" },
        { code: "JPY", rate: round(rates.JPY ?? 32.8, 2), label: "Japanese Yen" },
        { code: "GBP", rate: round(rates.GBP ?? 0.172, 4), label: "British Pound" },
        { code: "EUR", rate: round(rates.EUR ?? 0.199, 4), label: "Euro" },
      ],
    };
  } catch {
    return {
      status: "fallback", updatedAt: nowIso(), base: "MYR",
      pairs: [
        { code: "USD", rate: 0.2174, label: "US Dollar" },
        { code: "SGD", rate: 0.2891, label: "Singapore Dollar" },
        { code: "THB", rate: 7.42, label: "Thai Baht" },
        { code: "IDR", rate: 3380, label: "Indonesian Rupiah" },
        { code: "CNY", rate: 1.58, label: "Chinese Yuan" },
        { code: "JPY", rate: 32.8, label: "Japanese Yen" },
        { code: "GBP", rate: 0.172, label: "British Pound" },
        { code: "EUR", rate: 0.199, label: "Euro" },
      ],
    };
  }
}

function loadNews() { return { status:"curated", updatedAt:nowIso(), items:FALLBACK_NEWS }; }
function loadTrends() {
  const lm = FALLBACK_TRENDS.filter(t=>t.locality.score>=2);
  return { status:"curated", updatedAt:nowIso(), items:FALLBACK_TRENDS, localMatchCount:lm.length, localMatches:lm, summary:`${lm.length} locally relevant trends.` };
}
function loadFires() { return { status:"offline", updatedAt:nowIso(), hotspots:[], summary:"NASA FIRMS offline." }; }
function loadJurisdictions() {
  const total = JURISDICTIONS.reduce((s,j)=>s+j.areaKm2,0);
  return { updatedAt:nowIso(), totalAreaKm2:round(total,2), items:JURISDICTIONS.map(j=>({ ...j, polygons:j.fallbackPolygons, areaSharePct:round(j.areaKm2/total*100,1) })), localMarkers:LOCAL_MARKERS, river:SARAWAK_RIVER };
}
function loadPadawanZoning() { return { status:"reference", wardCount:14 }; }

// --- Builders ---
function buildSummary(w, a, ap, j, n, pz, tr) {
  const rain6h = round(w.nextHours.reduce((s,h)=>s+h.precipitationMm,0),1);
  const pdw = j.items.find(i=>i.id==="mpp");
  const cond = [];
  if (rain6h>=8) cond.push("drainage watch");
  if (a.current.aqi>=75) cond.push("air-quality watch");
  if (ap.movements.totalTracked>=6) cond.push("airport spillover");
  const posture = cond.length>=3?"stretched":cond.length===2?"watch":cond.length===1?"steady-watch":"stable";
  const map = { stretched:"Multi-vector pressure detected. Coordinated response required.", watch:"Watch mode active. Weather-air mix can turn fast.", "steady-watch":"Stable enough to clear backlog with one eye open.", stable:"Greater Kuching operating within normal parameters." };
  return { posture, headline:map[posture], detail:`Heat ${w.current.apparentTemperatureC}C | AQI ${a.current.aqi} | Rain 6h: ${rain6h}mm | ${ap.movements.totalTracked} aircraft | ${n.items.length} headlines | Padawan: ${pdw?.areaSharePct??0}% area` };
}

function buildMetrics(w, a, ap, j, n, pz, tr) {
  const rain6h = round(w.nextHours.reduce((s,h)=>s+h.precipitationMm,0),1);
  const pdw = j.items.find(i=>i.id==="mpp");
  const tp = j.items.reduce((s,i)=>s+(i.properties??0),0);
  const pop = j.items.reduce((s,i)=>s+(i.population??0),0);
  return [
    { id:"heat", label:"Heat Index", value:w.current.apparentTemperatureC, unit:"C", tone:w.current.apparentTemperatureC>=35?"warn":"neutral", history:w.history, context:w.current.weatherLabel },
    { id:"aqi", label:"AQI", value:a.current.aqi, unit:"", tone:a.current.band?.tone??"neutral", history:a.history, context:a.current.band?.label??"Moderate" },
    { id:"rain6h", label:"Rain 6h", value:rain6h, unit:"mm", tone:rain6h>=6?"warn":"neutral", context:`${w.daily.rainTotalMm}mm today` },
    { id:"airport", label:"KCH Aircraft", value:ap.movements.totalTracked, unit:"ac", tone:ap.movements.totalTracked>=6?"warn":"neutral", context:`${ap.movements.arrivals} in / ${ap.movements.departures} out` },
    { id:"pm25", label:"PM2.5", value:a.current.pm25, unit:"ug", tone:a.current.pm25>25?"warn":"neutral", context:`NO2 ${a.current.no2}` },
    { id:"pop", label:"Population", value:CITY_DEMOGRAPHICS.greaterKuchingPopulation, unit:"", tone:"neutral", context:`Growth ${CITY_DEMOGRAPHICS.populationGrowthRate}%` },
    { id:"area", label:"Metro Area", value:j.totalAreaKm2, unit:"km2", tone:"neutral", context:"DBKU+MBKS+MPP" },
    { id:"green", label:"Green Cover", value:CITY_DEMOGRAPHICS.greenCoverPct, unit:"%", tone:"focus", context:`${CITY_DEMOGRAPHICS.parkAreaHa}ha parks` },
    { id:"pdw-share", label:"Padawan", value:pdw?.areaSharePct??0, unit:"%", tone:"focus", context:`${pdw?.areaKm2??0} km2` },
    { id:"gdp", label:"GDP/Cap", value:CITY_DEMOGRAPHICS.gdpPerCapitaUsd, unit:"USD", tone:"neutral", context:`Unemployment ${CITY_DEMOGRAPHICS.unemploymentPct}%` },
    { id:"birth", label:"Birth Rate", value:CITY_DEMOGRAPHICS.birthRate, unit:"/1k", tone:"neutral", context:`Median age ${CITY_DEMOGRAPHICS.medianAge}` },
    { id:"tourism", label:"Tourism", value:round(CITY_DEMOGRAPHICS.touristArrivals2025/1000000,1), unit:"M", tone:"neutral", context:"Annual arrivals" },
  ];
}

function buildOperations({ weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes }) {
  const rain6h = round(weather.nextHours.reduce((s,h)=>s+h.precipitationMm,0),1);
  const items = [];
  if (rain6h>=6) items.push({ severity:"high", owner:"Drainage", title:"Sweep low-lying feeder roads", detail:`${rain6h}mm projected. Prioritise Penrissen and Batu Kawa.` });
  if (air.current.aqi>=70||air.current.pm25>=25) items.push({ severity:"medium", owner:"Health", title:"Haze advisory for sensitive groups", detail:`AQI ${air.current.aqi}, PM2.5 ${air.current.pm25}` });
  if (airport.movements.totalTracked>=6) items.push({ severity:"medium", owner:"Traffic", title:"Airport corridor watch", detail:`${airport.movements.arrivals} arrivals in envelope.` });
  if (trends.localMatches.length>0) items.push({ severity:"medium", owner:"Comms", title:"Local search pulse active", detail:trends.localMatches.slice(0,2).map(i=>i.title).join(" / ") });
  items.push({ severity:"low", owner:"Infrastructure", title:`${CITY_DEMOGRAPHICS.drainageNetworkKm}km drainage network`, detail:`${CITY_DEMOGRAPHICS.roadNetworkKm}km road network serving ${num(CITY_DEMOGRAPHICS.greaterKuchingPopulation)} residents.` });
  items.push({ severity:"low", owner:"Planning", title:"Padawan growth ring", detail:`${jurisdictions.items.find(i=>i.id==="mpp")?.areaKm2??0} km2 across ${padawanZoning.wardCount} wards.` });
  return items.slice(0,6);
}


const GROUND_PULSE_LANES = [
  { key: "kuching", label: "Kuching", intent: "What the city is being talked about right now.",
    match: /kuching|古晋|kch\b|wbgg|batu kawa|petra jaya|satok|padungan|waterfront|stutong|pending/i },
  { key: "padawan", label: "Padawan", intent: "What residents and councils say about MPP country.",
    match: /padawan|巴达旺|kota padawan|mpp\b|siburan|matang|penrissen|beratok|kuap|tapah|sungai maong/i },
  { key: "sarawak", label: "Sarawak", intent: "State-wide signals that touch Greater Kuching.",
    match: /sarawak|砂拉越|sarawakian|dbku|mbks|premier\s+of\s+sarawak|chief\s+minister\s+sarawak|\bcms\b|\bsdec\b|\bdewan\s+undangan\s+negeri\b/i },
];

function buildClientGroundPulse(news, trends) {
  const items = Array.isArray(news?.items) ? news.items : [];
  const trendItems = Array.isArray(trends?.items) ? trends.items : [];
  const dayFloor = Date.now() - 24 * 60 * 60 * 1000;
  const gen = nowIso();

  const lanes = GROUND_PULSE_LANES.map((lane) => {
    const matched = items.filter((item) => lane.match.test(`${item.title || ""} ${item.source || ""}`));
    const last24h = matched.filter((item) => Date.parse(item.publishedAt || 0) >= dayFloor);
    const headlines = matched.slice(0, 3).map((item) => ({
      title: item.title, source: item.source, url: item.link,
      publishedAt: item.publishedAt, language: item.language,
      languageBadge: item.languageBadge, isOfficial: Boolean(item.isOfficial),
    }));
    const trendMatches = trendItems
      .filter((t) => lane.match.test(`${t.title || ""} ${t.newsTitle || ""} ${t.primarySource || ""}`))
      .slice(0, 3)
      .map((t) => ({ term: t.title, trafficLabel: t.trafficLabel || null, link: t.link || null,
        newsTitle: t.newsTitle || null, newsSource: t.primarySource || null }));
    const top = headlines[0];
    const narrative = top
      ? `${top.source || "Local press"} · ${top.title}`
      : trendMatches[0]
        ? `Search surge: ${trendMatches[0].term}`
        : `No fresh ${lane.label} coverage in the 24-hour window — the lane is quiet.`;
    return { key: lane.key, label: lane.label, intent: lane.intent,
      mentionCount: matched.length, last24hCount: last24h.length,
      headlines, trendMatches, narrative };
  });

  const totalMentions = lanes.reduce((s, l) => s + l.mentionCount, 0);
  const totalLast24h = lanes.reduce((s, l) => s + l.last24hCount, 0);
  return {
    generatedAt: gen,
    status: totalMentions > 0 ? "live" : "fallback",
    systemLabel: "Ground Pulse // per-city mention rollup from Google News lanes + Google Trends local matches",
    summary: totalMentions > 0
      ? `${totalMentions} total mentions across Kuching / Padawan / Sarawak lanes, ${totalLast24h} from the last 24 hours.`
      : "Ground pulse is quiet — no matching mentions in the current news or trends window.",
    totals: { mentions: totalMentions, last24h: totalLast24h },
    lanes,
  };
}

async function buildFallbackDashboard() {
  const [weather, air, airport, quakes, exchange] = await Promise.all([
    loadWeather(), loadAirQuality(), loadAirport(), loadEarthquakes(), loadExchangeRates(),
  ]);
  const jurisdictions = loadJurisdictions(), news = loadNews(), fires = loadFires();
  const padawanZoning = loadPadawanZoning(), trends = loadTrends();
  const gen = nowIso();

  // Compute news counts by language/official status for renderNewsIntake
  const officialCount = news.items.filter(i => i.isOfficial).length;
  const enCount = news.items.filter(i => i.language === "en").length;
  const msCount = news.items.filter(i => i.language === "ms").length;
  const zhCount = news.items.filter(i => i.language === "zh").length;
  const enrichedNews = {
    ...news,
    counts: { official: officialCount, en: enCount, ms: msCount, zh: zhCount },
    operatorItems: news.items.filter(i => i.isOfficial).slice(0, 3),
    summary: `${news.items.length} headlines across ${officialCount} official + ${enCount + msCount + zhCount - officialCount} press sources.`,
    systemLabel: "Multilingual intake active.",
  };

  // Hydro bands for map legend
  const defaultHydroBands = [
    { id: "danger", label: "Danger", color: "#ff003c" },
    { id: "warning", label: "Warning", color: "#ff7a00" },
    { id: "alert", label: "Alert", color: "#ffd000" },
    { id: "normal", label: "Normal", color: "#00ffaa" },
    { id: "reference", label: "Reference", color: "#8aa2c8" },
  ];

  return {
    generatedAt: gen, site: SITE,
    timeSignal: { serverNow: gen, asean: ASEAN_CLOCKS },
    summary: buildSummary(weather, air, airport, jurisdictions, enrichedNews, padawanZoning, trends),
    metrics: buildMetrics(weather, air, airport, jurisdictions, enrichedNews, padawanZoning, trends),
    jurisdictions, mapLayers: buildMapLayers(), climate: { weather, air },
    airport, news: enrichedNews, trends,
    groundPulse: buildClientGroundPulse(enrichedNews, trends),
    exchange,
    fires, quakes,
    govStats: {
      status: "fallback", year: 2024,
      latestSarawakPop: "2,907,500",
      datasetCount: 142,
      updatedAt: gen,
      districts: [],
    },
    metWarnings: {
      status: "fallback",
      activeCount: 0,
      items: [],
      forecast: { label: "No active warnings.", tone: "good" },
      generatedAt: gen
    },
    demographics: CITY_DEMOGRAPHICS,
    operations: buildOperations({ weather, air, airport, news: enrichedNews, jurisdictions, padawanZoning, trends, fires, quakes }),
    floodForecast: {
      status: "fallback", station: "Sarawak River at Kuching", units: "m³/s",
      model: "GloFAS seamless v4 via Open-Meteo",
      todayCms: 148, peakCms: 175,
      forecast: [
        { date: null, dischargeCms: 148 }, { date: null, dischargeCms: 155 },
        { date: null, dischargeCms: 162 }, { date: null, dischargeCms: 170 },
        { date: null, dischargeCms: 175 },
      ],
    },
    mapScene: { hydroBands: defaultHydroBands },
    // IOC 2.0 — forecast + AlphaEarth absent in pure client-fallback (tier 3);
    // both are static artifacts that ride in via tier 1/2. Stubs keep renderers
    // safe so the rail shows an idle note and the overlay toggle degrades.
    forecast: {
      status: "ready",
      model: "google/timesfm-2.0-500m-pytorch",
      horizon: 14,
      basin_amc: { class: "II", label: "Normal", total_mm14d: 148.5 },
      series: {
        river_discharge: {
          label: "River Discharge",
          unit: "m³/s",
          lastValue: 68.5,
          history: [62.4, 63.1, 64.0, 65.5, 66.2, 65.9, 67.1, 68.0, 68.5],
          median: [69.1, 69.8, 70.2, 70.8, 71.2, 71.8, 72.1, 72.5, 73.0, 73.2, 73.5, 73.8, 74.0, 74.2],
          quantiles: {
            p10: [63.2, 63.5, 64.1, 64.5, 64.9, 65.2, 65.5, 65.8, 66.1, 66.4, 66.7, 67.0, 67.2, 67.4],
            p90: [75.1, 76.2, 77.4, 78.5, 79.7, 80.9, 82.0, 83.2, 84.4, 85.5, 86.7, 87.8, 89.0, 90.1]
          }
        },
        rainfall: {
          label: "Rainfall",
          unit: "mm",
          lastValue: 12.5,
          history: [8.5, 10.2, 5.4, 0.0, 0.0, 4.2, 15.6, 22.1, 12.5],
          median: [15.0, 18.2, 22.4, 10.5, 5.0, 12.0, 25.0, 35.0, 45.0, 20.0, 15.0, 10.0, 8.0, 5.0],
          quantiles: {
            p10: [5.0, 6.0, 8.0, 2.0, 0.0, 3.0, 10.0, 15.0, 20.0, 8.0, 5.0, 2.0, 1.0, 0.0],
            p90: [35.0, 42.0, 56.0, 32.0, 20.0, 30.0, 65.0, 90.0, 110.0, 60.0, 45.0, 30.0, 25.0, 15.0]
          }
        },
        aqi: {
          label: "Air Quality",
          unit: "AQI",
          lastValue: 64,
          history: [52, 55, 58, 62, 65, 66, 68, 65, 64],
          median: [63, 62, 60, 58, 59, 61, 63, 65, 68, 70, 72, 74, 75, 76],
          quantiles: {
            p10: [55, 54, 52, 50, 51, 53, 55, 56, 58, 60, 62, 63, 64, 65],
            p90: [75, 74, 72, 70, 71, 74, 78, 82, 86, 90, 95, 98, 102, 105]
          }
        },
        pm25: {
          label: "PM2.5",
          unit: "µg/m\u00b3",
          lastValue: 18.2,
          history: [14.1, 15.2, 16.0, 17.5, 18.0, 18.5, 19.0, 18.5, 18.2],
          median: [18.0, 17.5, 17.0, 16.5, 16.8, 17.2, 17.8, 18.5, 19.2, 19.8, 20.5, 21.2, 21.8, 22.4],
          quantiles: {
            p10: [15.2, 14.8, 14.2, 13.8, 14.0, 14.5, 15.0, 15.5, 16.2, 16.8, 17.5, 18.2, 18.8, 19.4],
            p90: [22.4, 21.8, 21.2, 20.5, 21.0, 21.8, 22.6, 23.5, 24.6, 25.8, 27.2, 28.5, 29.8, 31.2]
          }
        }
      },
      stations: {
        "batu-kitang": { name: "Batu Kitang", basin: "Sarawak River", lag_h: 4, amc: { class: "II", label: "Normal", total_mm14d: 142.0 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "watch" } },
        "kpg-git": { name: "Kampung Git", basin: "Sarawak River", lag_h: 2, amc: { class: "II", label: "Normal", total_mm14d: 135.2 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "normal" } },
        "siniawan": { name: "Siniawan", basin: "Sarawak River", lag_h: 6, amc: { class: "II", label: "Normal", total_mm14d: 148.5 }, risk_6h: { band: "normal" }, risk_24h: { band: "watch" }, risk_72h: { band: "alert" } },
        "maong": { name: "Sungai Maong", basin: "Sarawak River", lag_h: 1, amc: { class: "III", label: "Saturated", total_mm14d: 215.4 }, risk_6h: { band: "watch" }, risk_24h: { band: "alert" }, risk_72h: { band: "warning" } },
        "buntal": { name: "Buntal", basin: "Coastal Basin", lag_h: 0, amc: { class: "I", label: "Dry", total_mm14d: 82.1 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "normal" } },
        "bedup": { name: "Sungai Bedup", basin: "Sadong Basin", lag_h: 8, amc: { class: "II", label: "Normal", total_mm14d: 121.3 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "watch" } }
      }
    },
    floodMatrix: {
      status: "ready",
      worst_band: "warning",
      basin_amc: { class: "II", label: "Normal", total_mm14d: 148.5 },
      rows: [
        { id: "batu-kitang", name: "Batu Kitang", basin: "Sarawak River", lag_h: 4, amc: { class: "II", label: "Normal", total_mm14d: 142.0 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "watch" }, impervious_fraction: 0.427, drainage_stress: "low" },
        { id: "kpg-git", name: "Kampung Git", basin: "Sarawak River", lag_h: 2, amc: { class: "II", label: "Normal", total_mm14d: 135.2 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "normal" }, impervious_fraction: 0.211, drainage_stress: "low" },
        { id: "siniawan", name: "Siniawan", basin: "Sarawak River", lag_h: 6, amc: { class: "II", label: "Normal", total_mm14d: 148.5 }, risk_6h: { band: "normal" }, risk_24h: { band: "watch" }, risk_72h: { band: "alert" }, impervious_fraction: 0.408, drainage_stress: "moderate" },
        { id: "maong", name: "Sungai Maong", basin: "Sarawak River", lag_h: 1, amc: { class: "III", label: "Saturated", total_mm14d: 215.4 }, risk_6h: { band: "watch" }, risk_24h: { band: "alert" }, risk_72h: { band: "warning" }, impervious_fraction: 0.459, drainage_stress: "high" },
        { id: "buntal", name: "Buntal", basin: "Coastal Basin", lag_h: 0, amc: { class: "I", label: "Dry", total_mm14d: 82.1 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "normal" }, impervious_fraction: 0.154, drainage_stress: "low" },
        { id: "bedup", name: "Sungai Bedup", basin: "Sadong Basin", lag_h: 8, amc: { class: "II", label: "Normal", total_mm14d: 121.3 }, risk_6h: { band: "normal" }, risk_24h: { band: "normal" }, risk_72h: { band: "watch" }, impervious_fraction: 0.082, drainage_stress: "low" }
      ]
    },
    alphaEarth: {
      status: "ready",
      image: "data/alphaearth/growth-padawan-2017-2024.png",
      bounds: { west: 110.269963, south: 1.390003, east: 110.40006, north: 1.482227 },
      years: { a: 2017, b: 2024 },
      timeline: [
        {
          image: "data/alphaearth/growth-padawan-2017-2020.png",
          bounds: { west: 110.269963, south: 1.390003, east: 110.40006, north: 1.482227 },
          years: { a: 2017, b: 2020 }
        },
        {
          image: "data/alphaearth/growth-padawan-2017-2024.png",
          bounds: { west: 110.269963, south: 1.390003, east: 110.40006, north: 1.482227 },
          years: { a: 2017, b: 2024 }
        }
      ]
    },
    impervious: {
      status: "ready",
      image: "data/alphaearth/impervious-2024.png",
      bounds: { west: 110.269963, south: 1.390003, east: 110.40006, north: 1.482227 },
      stats: { mean: 0.42, p50: 0.407, p75: 0.522, p90: 0.617, max: 0.867 }
    },
    cityReports: {
      status: "demo",
      count: 6,
      open: 4,
      resolved: 2,
      recent: [
        { ticketNumber: "CR-1025-01", problemType: "Drainage Blockage", streetName: "Jalan Penrissen (Pasar Batu 10)", lat: 1.4475, lon: 110.3305, urgency: "high", status: "in_progress", reportedAt: new Date(Date.now() - 180 * 60 * 1000).toISOString() },
        { ticketNumber: "CR-1025-02", problemType: "Flash Flooding", streetName: "Taman Desa Wira (Batu Kawa)", lat: 1.5115, lon: 110.2872, urgency: "high", status: "received", reportedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString() },
        { ticketNumber: "CR-1025-03", problemType: "Illegal Dumping", streetName: "Jalan Siburan", lat: 1.3962, lon: 110.3608, urgency: "medium", status: "in_progress", reportedAt: new Date(Date.now() - 600 * 60 * 1000).toISOString() },
        { ticketNumber: "CR-1025-04", problemType: "Pothole", streetName: "Jalan Matang", lat: 1.5843, lon: 110.3015, urgency: "medium", status: "completed", reportedAt: new Date(Date.now() - 1440 * 60 * 1000).toISOString() },
        { ticketNumber: "CR-1025-05", problemType: "Streetlight Outage", streetName: "Petra Jaya", lat: 1.5950, lon: 110.3650, urgency: "low", status: "in_progress", reportedAt: new Date(Date.now() - 120 * 60 * 1000).toISOString() },
        { ticketNumber: "CR-1025-06", problemType: "Water Main Leak", streetName: "Jalan Satok", lat: 1.5595, lon: 110.3280, urgency: "medium", status: "completed", reportedAt: new Date(Date.now() - 720 * 60 * 1000).toISOString() }
      ]
    },
    // MPP governance — sample stubs so the councillor + locality panels
    // render meaningfully even in pure client-fallback mode (no server, no snapshot).
    mppCouncillors: {
      status: "fallback", updatedAt: gen, term: "2025–2028",
      chairman: { title: "Cr.", name: "Tan Kai", phone: "013-8095165", role: "Chairman", coverage: "All zones" },
      deputy: { title: "Cr.", name: "Mahmud Bin Dato Sri Haji Ibrahim", phone: "012-8087997", role: "Deputy Chairman", coverage: "All zones" },
      wards: [
        { code: "A", codeGroup: ["A"], label: "Ward 1", area: "Upper Padawan", councillorCount: 2,
          councillors: [{ title: "Cr.", name: "Mark Kellon anak Awo", phone: "016-8922060" }] },
        { code: "FG", codeGroup: ["F","G"], label: "Ward 4", area: "Kota Padawan, Kuap, Landeh & Batu 10-15 Kuching-Serian Road", councillorCount: 4,
          councillors: [{ title: "Cr.", name: "Lim Lian Kee", phone: "019-8185350" }] },
      ],
      totals: { wards: 10, councillors: 32 },
    },
    mppLocalities: {
      status: "fallback", updatedAt: gen,
      items: [
        { no: 1, code: "A001", name: "PANGKALAN EMPAT", letter: "A", wardCode: "A",
          constituency: { raw: "N.19 Mambong under P.198 Puncak Borneo",
            parsed: [{ stateCode: "N.19", stateName: "Mambong", parliamentCode: "P.198", parliamentName: "Puncak Borneo" }], compound: false },
          residential: 13, commercial: 0, industrial: 0, exempted: 0 },
      ],
      totals: { localities: 525, residential: 77015, commercial: 5780, industrial: 1805, exempted: 1, stateConstituencies: 9, parliamentConstituencies: 5 },
      breakdowns: { byWard: { A:20, B:16, D:17, FG:76, H:75, I:56, JL:101, K:84, M:42, NPQ:27, X:11 } },
    },
    // FloodDash-grade hydro stubs — replaced by DID iHYDRO on live/server tiers.
    infobanjir: {
      status: "reference",
      updatedAt: gen,
      source: "DID Sarawak iHYDRO (reference hold)",
      sourceUrl: "https://ihydro.sarawak.gov.my/",
      liveCount: 0,
      stationCount: 6,
      padawanLiveCount: 0,
      highestBand: "normal",
      highestBandLabel: "Normal",
      stations: [
        { id: "batu-kitang", name: "Batu Kitang Telemetry", focus: "padawan", council: "MPP", lat: 1.4524, lon: 110.2823, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 1.85, alert: 3.0, warning: 4.5, danger: 5.0 } , humanBrief: "Upstream canary for urban Kuching and the Padawan growth ring. When this gauge reads Alert, riverside kampungs along Batu Kitang are at doorstep risk." },
        { id: "batu-kawa", name: "Batu Kawa Bridge", focus: "padawan", council: "MPP", lat: 1.5087, lon: 110.2703, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 0.68, alert: 2.5, warning: 3.0, danger: 4.2 } , humanBrief: "Operational gauge for the Batu Kawa retention programme. Rising here means Taman Desa Wira and nearby kampungs are next." },
        { id: "desa-wira", name: "Desa Wira", focus: "padawan", council: "MPP", lat: 1.5104, lon: 110.3044, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 0.35, alert: 2.5, warning: 3.0, danger: 3.5 } , humanBrief: "Inside a hard-hit residential pocket of Padawan. A Warning here is already a street-level event." },
        { id: "siniawan", name: "Siniawan", focus: "padawan", council: "MPP", lat: 1.4466, lon: 110.2186, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 0.0, alert: 5.5, warning: 6.2, danger: 7.2 } , humanBrief: "Heritage town + weekend night market. A sudden rise during market hours is a crowd-safety incident." },
        { id: "kuala-maong", name: "Kuala Maong", focus: "metro", council: "MBKS", lat: 1.5422, lon: 110.3114, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 0.25, alert: 2.0, warning: 2.4, danger: 2.8 } , humanBrief: "Urban canary. At Alert, Jalan Song / Stutong junctions flood and southern Kuching gridlocks." },
        { id: "barrage", name: "Barrage", focus: "metro", council: "DBKU", lat: 1.576, lon: 110.4093, waterLevelM: null, band: "reference", bandLabel: "Reference", thresholds: { normal: 0.06, alert: 2.8, warning: 2.92, danger: 3.2 } , humanBrief: "Tidal gate for the urban reach. High reading here with upstream rain means the river cannot drain." },
      ],
      summary: "Client fallback — open live server or baked snapshot for DID iHYDRO gauges.",
    },
    floodAction: {
      status: "reference",
      updatedAt: gen,
      score: 20,
      band: "watch",
      verb: "Keep watching",
      verbBm: "Terus pantau",
      verbZh: "继续留意",
      tone: "muted",
      reason: "Holding pattern — open live DID iHYDRO for gauge-backed action.",
      drivers: ["Live hydro feed unavailable in client-only mode"],
      checklist: [
        "Check iHYDRO Padawan gauges: Batu Kitang, Batu Kawa, Desa Wira, Siniawan.",
        "Keep one mobile crew free for Penrissen / Kota Padawan ponding.",
      ],
      worstStation: null,
      padawanLive: 0,
      metroLive: 0,
      realityCheck: { verdict: "CALM", newsCount: 0, measuredBand: "reference", headlines: [] },
      shelters: [
        { id: "sk-beradek", name: "SK Beradek Permanent Disaster Relocation Centre (PPKB)", area: "Padawan", status: "under-construction", maps: "https://www.google.com/maps/search/?api=1&query=SK+Beradek+Padawan" },
      ],
      hotlines: [
        { id: "999", label: "Emergency", number: "999" },
        { id: "mpp", label: "Majlis Perbandaran Padawan", number: "082-615991", url: "https://mpp.sarawak.gov.my/" },
        { id: "ihydro", label: "DID Sarawak iHYDRO", number: null, url: "https://ihydro.sarawak.gov.my/" },
      ],
      source: "DID Sarawak iHYDRO",
      sourceUrl: "https://ihydro.sarawak.gov.my/",
      confidence: "Reference hold — live DID feed not loaded",
    },
    sources: [
      sourceRecord("mpp","MPP Council","official","Padawan data","https://mpp.sarawak.gov.my",gen),
      sourceRecord("mbks","MBKS","official","Kuching South","https://mbks.sarawak.gov.my",gen),
      sourceRecord("dbku","DBKU","official","Kuching North","https://dbku.sarawak.gov.my",gen),
      sourceRecord("weather","Open-Meteo",weather.status,"Weather + forecast","https://open-meteo.com",gen),
      sourceRecord("aqi","Open-Meteo AQI",air.status,"AQI, PM2.5, PM10","https://open-meteo.com",gen),
      sourceRecord("opensky","OpenSky",airport.status,"Live airspace KCH","https://opensky-network.org",gen),
      sourceRecord("usgs","USGS",quakes.status,"Regional seismic","https://earthquake.usgs.gov",gen),
      sourceRecord("exchange","ExchangeRate API",exchange.status,"FX rates","https://open.er-api.com",gen),
      sourceRecord("gov-stats","DOSM/CKAN","reference","Sarawak demographics + datasets","https://open.dosm.gov.my",gen),
      sourceRecord("met-warnings","MetMalaysia","reference","Official weather warnings","https://www.met.gov.my",gen),
    ],
  };
}

async function loadDashboardPayload() {
  const liveDashboardUrl = apiUrl("/api/dashboard");
  const staticDashboardUrl = apiUrl("/api/dashboard.json");
  const manifestUrl = apiUrl("/api/build-manifest.json");
  // On static hosting there is no live API; probing it 404s on every 60s
  // refresh. Go straight to the baked snapshot (tier 2).
  const liveAvailable = boardModeFromBoot() !== "pages-static";
  try {
    if (!liveAvailable) throw new Error("static host — no live API");
    const [payload, exchange] = await Promise.all([fetchJson(liveDashboardUrl, 8000), loadExchangeRates()]);
    return decoratePayload({
      ...payload,
      exchange,
      mapLayers: buildMapLayers(),
    }, { mode: "live-api" });
  } catch (liveError) {
    try {
      const [payload, manifest, exchange] = await Promise.all([
        fetchJson(staticDashboardUrl, 10000),
        fetchOptionalJson(manifestUrl, 5000),
        loadExchangeRates(),
      ]);
      return decoratePayload({
        ...payload,
        exchange,
        mapLayers: buildMapLayers(),
      }, { mode: "static-snapshot", manifest });
    } catch (snapshotError) {
      console.warn("IOC API + static snapshot unavailable, using client fallback payload.", liveError, snapshotError);
      return decoratePayload(await buildFallbackDashboard(), { mode: "client-fallback", error: snapshotError || liveError });
    }
  }
}

// --- Renderers ---
function sparkline(vals, tone = "neutral") {
  if (!Array.isArray(vals) || vals.length < 2) return "";
  const w=120,h=16,mn=Math.min(...vals),mx=Math.max(...vals),rng=Math.max(mx-mn,1);
  const pts=vals.map((v,i)=>`${(i/(vals.length-1))*w},${h-((v-mn)/rng)*h}`).join(" ");
  const c = tone==="critical"?"#ff003c":tone==="warn"?"#ffaa00":"var(--cyan)";
  return `<svg viewBox="0 0 ${w} ${h}" class="sparkline" preserveAspectRatio="none"><polyline fill="none" stroke="${c}" stroke-width="2" points="${pts}"/></svg>`;
}

// Metric → source provenance map. Each entry: short source name + ttl/cadence
// hint. Surfaced on hover so a glance reveals "this number came from X, fresh
// to Y minutes". Reinforces honesty: every reading on the board is traceable.
const METRIC_SOURCES = {
  heat:        { src: "Open-Meteo",     fresh: "60 s",  link: "https://open-meteo.com/" },
  aqi:         { src: "Open-Meteo AQI", fresh: "60 s",  link: "https://open-meteo.com/en/docs/air-quality-api" },
  pm25:        { src: "Open-Meteo AQI", fresh: "60 s",  link: "https://open-meteo.com/en/docs/air-quality-api" },
  rain6h:      { src: "Open-Meteo",     fresh: "60 s",  link: "https://open-meteo.com/" },
  airport:     { src: "OpenSky Network",fresh: "live",  link: "https://opensky-network.org/" },
  wards:       { src: "MPP zoning map", fresh: "static",link: "https://mpp.sarawak.gov.my/" },
  area:        { src: "MPP / MBKS / DBKU profiles", fresh: "static" },
  "padawan-share":{ src: "MPP profile", fresh: "static" },
  properties:  { src: "MPP / DBKU disclosed counts", fresh: "static" },
  population:  { src: "DOSM census",    fresh: "static",link: "https://open.dosm.gov.my/" },
  headlines:   { src: "Google News + UKAS / TVS / MPP / MBKS / DBKU", fresh: "15 min" },
  trends:      { src: "Google Trends MY",fresh: "30 min",link: "https://trends.google.com/" },
  "flood-watch":{src: "MET Malaysia",   fresh: "15 min",link: "https://api.data.gov.my/weather/warning/" },
};

function renderMetrics(metrics) {
  $("metricBand").innerHTML = metrics.slice(0,12).map(m => {
    const prov = METRIC_SOURCES[m.id];
    const provHtml = prov
      ? `<div class="metric-source"><span class="src-name">${prov.src}</span><span class="src-fresh">${prov.fresh}</span></div>`
      : "";
    return `
    <article class="metric-card" data-tone="${m.tone||'neutral'}" data-metric-id="${m.id}">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${num(m.value,m.value%1===0?0:1)}<span class="metric-unit">${m.unit||''}</span></div>
      <div class="metric-context">${m.context||''}</div>
      <div class="sparkline-shell">${m.history?sparkline(m.history,m.tone):''}</div>
      ${provHtml}
    </article>`;
  }).join("");
}

function highlightCatchment(station, bandColor) {
  if (!state.map || !window.L) return;
  // Clear any prior highlight.
  if (state.catchmentHighlightLayers?.length) {
    state.catchmentHighlightLayers.forEach(l => state.map.removeLayer(l));
  }
  state.catchmentHighlightLayers = [];

  const segIds = station.catchment?.segmentIds;
  if (!segIds || segIds.length === 0) {
    // No catchment available — flash the station marker area only.
    const flash = window.L.circleMarker([station.lat, station.lon], {
      radius: 22, fillColor: bandColor, fillOpacity: 0.15, color: bandColor, weight: 2, opacity: 0.6,
    }).addTo(state.map);
    state.catchmentHighlightLayers.push(flash);
    setTimeout(() => { state.map.removeLayer(flash); }, 2400);
    return;
  }
  const index = state.drainageFeatureIndex;
  if (!index || index.size === 0) {
    console.warn("Catchment requested but drainage layer not loaded; toggle the Drainage layer first.");
    return;
  }

  // Render highlight polylines on a dedicated overlay (above the drainage geoJSON).
  segIds.forEach((id) => {
    const lyr = index.get(id) || index.get(String(id)) || index.get(Number(id));
    if (!lyr) return;
    const latlngs = lyr.getLatLngs?.();
    if (!latlngs) return;
    // Halo (wider, soft).
    const halo = window.L.polyline(latlngs, {
      color: bandColor, weight: 8, opacity: 0.18, lineCap: "round",
    }).addTo(state.map);
    // Core (sharp).
    const core = window.L.polyline(latlngs, {
      color: bandColor, weight: 3.2, opacity: 0.95, lineCap: "round",
    }).addTo(state.map);
    state.catchmentHighlightLayers.push(halo, core);
  });

  // Frame the catchment.
  if (state.catchmentHighlightLayers.length > 0) {
    const featureGroup = window.L.featureGroup(state.catchmentHighlightLayers);
    try { state.map.fitBounds(featureGroup.getBounds().pad(0.15), { maxZoom: 14 }); } catch (e) { /* ignore */ }
  }
}

function renderMap(payload) {
  if (!window.L) return;
  const mc = $("mapCanvas");
  if (!mc) return;
  if (!state.map) {
    state.map = window.L.map(mc, {
      zoomControl: false, attributionControl: false, fadeAnimation: false,
      // preferCanvas: draw vectors on a single <canvas> instead of one SVG element
      // per feature. On large GeoJSON layers (transit 1MB, drainage 600KB) this
      // eliminates the zoom/pan stutter that was caused by the browser repainting
      // thousands of individual SVG path nodes on every frame.
      preferCanvas: true,
      maxBounds: SITE.mapMaxBounds, maxBoundsViscosity: 1.0,
      minZoom: SITE.minZoom, maxZoom: SITE.maxZoom,
      worldCopyJump: false, // §11.9 — no world-copy tile repetition
    });
    state.boundaryLayerGroup = window.L.layerGroup().addTo(state.map);
    state.markerLayerGroup = window.L.layerGroup().addTo(state.map);
    state.labelLayerGroup = window.L.layerGroup().addTo(state.map);
    const layers = payload.mapLayers || buildMapLayers();
    layers.forEach(l => {
      const tl = window.L.tileLayer(l.url, { maxZoom: 18 });
      state.tileLayers.set(l.id, tl);
      if (l.active) tl.addTo(state.map);
    });
    renderLayerToggle(layers);
    renderUrbanLayerToggle();
    loadWardFeatures();

    if (window.ResizeObserver) {
      state.mapResizeObserver = new ResizeObserver(() => queueMapResize());
      state.mapResizeObserver.observe(mc);
      if (mc.parentElement) state.mapResizeObserver.observe(mc.parentElement);
    }
  }

  state.boundaryLayerGroup.clearLayers();
  state.labelLayerGroup.clearLayers();
  state.markerLayerGroup.clearLayers();

  // Scope filter: Padawan shows only MPP boundary + its hydro stations;
  // Greater Kuching shows all 3 councils + all iHYDRO stations.
  const visibleJurisdictions = isPadawanScope()
    ? payload.jurisdictions.items.filter(j => j.id === "mpp")
    : payload.jurisdictions.items;

  visibleJurisdictions.forEach(item => {
    item.polygons.forEach(ring => {
      window.L.polygon(ring.map(p=>[p[1],p[0]]), { color:item.accent, weight:2, fillOpacity:0.12, fillColor:item.accent }).addTo(state.boundaryLayerGroup);
    });
    const lat = item.polygons[0].reduce((s,p)=>s+p[1],0)/item.polygons[0].length;
    const lon = item.polygons[0].reduce((s,p)=>s+p[0],0)/item.polygons[0].length;
    window.L.marker([lat,lon], { icon:window.L.divIcon({ className:"municipal-label", html:`<span>${item.code}</span>` }) }).addTo(state.labelLayerGroup);
  });

  if (payload.jurisdictions.river) {
    window.L.polyline(payload.jurisdictions.river.map(p=>[p[1],p[0]]), { color:"#1e90ff", weight:2, opacity:0.5, dashArray:"6 4" }).addTo(state.boundaryLayerGroup);
  }

  const catColors = { civic:"#00f3ff", market:"#ffaa00", "urban-core":"#ff003c", "north-bank":"#0d6efd", "growth-corridor":"#00ffaa", "padawan-core":"#b48a00", "southern-edge":"#9966ff", airport:"#ff6b9d", education:"#22d3ee", residential:"#a78bfa" };
  (payload.jurisdictions.localMarkers||[]).forEach(m => {
    window.L.circleMarker([m.lat,m.lon], { radius:5, fillColor:catColors[m.category]||"#00f3ff", fillOpacity:0.9, color:"#fff", weight:1, opacity:0.6 }).bindTooltip(m.name, { permanent:false, className:"marker-tooltip" }).addTo(state.markerLayerGroup);
  });

  // Airport flights on map
  if (payload.airport?.liveFlights) {
    payload.airport.liveFlights.forEach(f => {
      if (!f.latitude || !f.longitude) return;
      const color = f.type === "arrival" ? "#00ffaa" : f.type === "departure" ? "#ffaa00" : "#00f3ff";
      window.L.circleMarker([f.latitude, f.longitude], { radius: 3, fillColor: color, fillOpacity: 1, color, weight: 1 })
        .bindTooltip(`${f.callsign} | ${f.type} | ${f.distanceKm}km`, { className: "marker-tooltip" })
        .addTo(state.markerLayerGroup);
    });
  }

  // Hydrology stations (JPS Infobanjir): band-coloured circles + tooltips.
  // Click → highlight catchment (BFS-walked drainage segments) in band colour.
  const hydroBandColors = { danger: "#ff003c", warning: "#ff7a00", alert: "#ffd000", normal: "#00ffaa", reference: "#8aa2c8" };
  // Stash for the hydro card click handler.
  state.hydroStationsByName = new Map();
  // Reset any previously highlighted catchment.
  if (state.catchmentHighlightLayers) {
    state.catchmentHighlightLayers.forEach(l => state.map.removeLayer(l));
  }
  state.catchmentHighlightLayers = [];

  // Scope filter: Padawan = MPP-side stations only; Greater Kuching = all
  // (the same station objects carry a `focus` flag — `padawan` or `metro` —
  // set in buildMapScene() / loadInfobanjir().)
  const allHydroStations = payload.mapScene?.hydroStations || payload.infobanjir?.stations || [];
  const hydroStations = isPadawanScope()
    ? allHydroStations.filter(s => s.focus === "padawan" || s.council === "MPP")
    : allHydroStations;
  state.pulseMarkerEls = new Map();
  hydroStations.forEach(s => {
    if (s.lat == null || s.lon == null) return;
    state.hydroStationsByName.set(s.id, s);
    const color = hydroBandColors[s.band] || "#8aa2c8";
    const isLive = s.waterLevelM != null;
    const hasCatchment = s.catchment?.status === "snapped";
    const radius = s.band === "danger" ? 9 : s.band === "warning" ? 8 : s.band === "alert" ? 7 : isLive ? 6 : 5;
    // Pulse-ring overlay — period coded to freshness (faster = newer data).
    // Reference stations get a slow pulse so the radar sweep still has anchors;
    // their muted colour signals "no live reading", honest visual semantics.
    const period = isLive
      ? freshnessPeriodSeconds(s.observedAt || payload?.infobanjir?.updatedAt)
      : 9;
    const pulseHtml = `<div class="pulse-marker" data-station="${s.id}" style="--pulse-period:${period}s;color:${color};opacity:${isLive ? 1 : 0.55}"></div>`;
    const pulseIcon = window.L.divIcon({ className: "", html: pulseHtml, iconSize: [8, 8], iconAnchor: [4, 4] });
    const pulse = window.L.marker([s.lat, s.lon], { icon: pulseIcon, interactive: false, zIndexOffset: -100 }).addTo(state.markerLayerGroup);
    state.pulseMarkerEls.set(s.id, { lat: s.lat, lon: s.lon, marker: pulse });
    const catchmentLine = hasCatchment
      ? `<br><span style="color:${color}">Catchment: ${s.catchment.segmentCount} seg · ${s.catchment.totalLengthKm} km · snap ${s.catchment.snapDistanceKm} km</span><br><em>Click to highlight</em>`
      : s.catchment?.status === "cold"
        ? "<br><em>Toggle Drainage layer to enable catchment</em>"
        : s.catchment?.status === "unsnapped"
          ? "<br><em>No waterway within 2 km</em>"
          : "";
    window.L.circleMarker([s.lat, s.lon], {
      radius,
      fillColor: color,
      fillOpacity: isLive ? 0.95 : 0.55,
      color: "#fff",
      weight: 1.5,
      opacity: 0.9,
      className: hasCatchment ? "hydro-marker hydro-has-catchment" : "hydro-marker",
    })
      .bindTooltip(
        `<strong>${s.name}</strong><br>${s.basin || "Sarawak basin"} · ${s.council || ""}<br>` +
        `Level: <strong>${s.waterLevelM != null ? s.waterLevelM + " m" : "no live reading"}</strong>` +
        ` · ${s.bandLabel || s.band || "—"}` +
        (s.thresholds?.alert != null
          ? `<br>Alert starts at ${s.thresholds.alert} m`
          : "") +
        (s.humanBrief ? `<br><em style="opacity:.9">${s.humanBrief}</em>` : "") +
        catchmentLine,
        { className: "marker-tooltip", direction: "top" },
      )
      // Click a gauge → highlight its upstream drainage AND open the
      // Catchment Story. The map click becomes an analytical brief, not a
      // tooltip (the Phuket Slope Story lesson).
      .on("click", () => { highlightCatchment(s, color); renderCatchmentStory(s); })
      .addTo(state.markerLayerGroup);
  });
  // Apims ground stations: square-ish markers via different radius/weight to distinguish.
  const apimsStations = payload.apims?.stations || [];
  apimsStations.forEach(s => {
    if (s.lat == null || s.lon == null || s.status !== "live") return;
    const tone = s.band?.tone;
    const c = tone === "good" ? "#00ffaa" : tone === "watch" ? "#ffd000" : tone === "warn" ? "#ff7a00" : tone === "alert" || tone === "critical" ? "#ff003c" : "#8aa2c8";
    window.L.circleMarker([s.lat, s.lon], {
      radius: 6,
      fillColor: c,
      fillOpacity: 0.85,
      color: "#fff",
      weight: 2,
      opacity: 0.95,
      dashArray: "2 2",
    })
      .bindTooltip(
        `<strong>APIMS · ${s.stationName}</strong><br>AQI ${s.aqi} (${s.band?.label || "—"})<br>PM2.5 ${s.pm25 ?? "—"} · PM10 ${s.pm10 ?? "—"}<br>Dominant: ${s.dominant || "—"}`,
        { className: "marker-tooltip", direction: "top" },
      )
      .addTo(state.markerLayerGroup);
  });

  // Citizen Reports — ground-truth complaint markers. Red=high, amber=medium, green=resolved.
  const crReports = payload.cityReports?.recent || [];
  const crColors = { high: "#ff003c", medium: "#f59e0b", low: "#00ffaa", completed: "#8aa2c8" };
  crReports.forEach((r) => {
    if (r.lat == null || r.lon == null) return;
    const color = r.status === "completed" ? crColors.completed : (crColors[r.urgency] || crColors.medium);
    window.L.circleMarker([r.lat, r.lon], {
      radius: r.urgency === "high" ? 8 : 7,
      fillColor: color,
      fillOpacity: 0.9,
      color: "#000",
      weight: 1.5,
      opacity: 0.8,
      className: r.urgency === "high" ? "cr-pulse-high" : ""
    })
      .bindTooltip(
        `<strong>${escapeHtml(r.problem_type)}</strong><br>${escapeHtml(r.location_text || "—")}<br>Urgency: ${r.urgency.toUpperCase()} · ${(r.status || "").replace("_"," ").toUpperCase()}<br><em>${escapeHtml(r.ticket)}</em>`,
        { className: "marker-tooltip cr-tooltip", direction: "top" },
      )
      .addTo(state.markerLayerGroup);
  });

  // Coordinate HUD — lat/lng overlay with one-tap copy for field ops.
  // Created once per map init; click snaps the coord, COPY button writes to clipboard.
  const mapFrame = mc.closest('.map-frame');
  if (mapFrame && !mapFrame.querySelector('.map-coord-hud')) {
    const hud = document.createElement('div');
    hud.className = 'map-coord-hud';
    hud.innerHTML = `
      <span class="coord-label">LAT / LNG</span>
      <span class="coord-value" id="coordValue">—</span>
      <button class="coord-copy" id="coordCopy">COPY</button>`;
    mapFrame.appendChild(hud);

    let lastCoord = null;

    state.map.on('mousemove', (e) => {
      const { lat, lng } = e.latlng;
      lastCoord = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      hud.querySelector('#coordValue').textContent = lastCoord;
      hud.classList.add('is-active');
    });

    state.map.on('mouseout', () => {
      if (!hud.classList.contains('is-snapped')) hud.classList.remove('is-active');
    });

    // Click / touch: snap the coordinate and keep the HUD visible.
    state.map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      lastCoord = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      hud.querySelector('#coordValue').textContent = lastCoord;
      hud.classList.add('is-active', 'is-snapped');
      hud.classList.remove('is-copied');
    });

    hud.querySelector('#coordCopy').addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (!lastCoord) return;
      const flash = () => {
        const btn = hud.querySelector('#coordCopy');
        btn.textContent = 'COPIED!';
        hud.classList.add('is-copied');
        setTimeout(() => {
          btn.textContent = 'COPY';
          hud.classList.remove('is-copied');
        }, 1600);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(lastCoord).then(flash).catch(flash);
      } else {
        // Fallback for non-HTTPS or older browsers.
        const ta = document.createElement('textarea');
        ta.value = lastCoord;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch (_) { /* best effort */ }
        document.body.removeChild(ta);
        flash();
      }
    });
  }

  if (!state.hasInitialMapFit) {
    // First fit honours the active scope's default extent (Padawan = tighter
    // zoom on MPP; Greater Kuching = wider 3-council bbox).
    const cfg = SCOPES[state.scope] || SCOPES.padawan;
    state.map.setView(cfg.mapCenter, cfg.mapZoom);
    state.hasInitialMapFit = true;
  }

  queueMapResize();
}

function renderLayerToggle(layers) {
  const el = $("layerToggle");
  el.innerHTML = layers.map(l=>`<button data-id="${l.id}" class="${l.active?'active':''}">${l.label}</button>`).join("");
  el.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    state.tileLayers.forEach((tl,id)=>{ if(id===btn.dataset.id){if(!state.map.hasLayer(tl))tl.addTo(state.map);}else{state.map.removeLayer(tl);} });
    el.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    state.activeLayerId = btn.dataset.id;
    // Update tile filter based on selected layer
    const tp = document.querySelector(".leaflet-tile-pane");
    if (tp) {
      if (btn.dataset.id === "dark") tp.style.filter = "brightness(0.9) contrast(1.1) saturate(0.8) hue-rotate(180deg) invert(1) brightness(0.6) contrast(1.4)";
      else if (btn.dataset.id === "imagery") tp.style.filter = "brightness(0.8) contrast(1.2)";
      else tp.style.filter = state.theme === "dark" ? "brightness(0.6) contrast(1.3) invert(1) hue-rotate(180deg)" : "none";
    }
    queueMapResize();
  }));
}

function renderGisLegend(activeLayerIds) {
  const el = $("mapLegend");
  if (!el) return;
  
  if (!activeLayerIds || activeLayerIds.length === 0) {
    const jurisdictions = state.payload?.jurisdictions?.items || [];
    el.innerHTML = jurisdictions.map(j => `<span class="legend-item"><span class="legend-dot" style="background:${j.accent}"></span>${j.code}</span>`).join("") + 
                   `<span class="legend-item"><span class="legend-dot" style="background:#1e90ff"></span>River</span>`;
    return;
  }

  const legendMap = {
    drainage: [
      { label: t("drainage"), color: "#60a5fa" },
      { label: "Main River", color: "#1e90ff" },
    ],
    transit: [
      { label: "Transit", color: "#fbbf24" },
    ],
    land_use: [
      { label: "Commercial", color: "#ffcc00" },
      { label: "Residential", color: "#44ff44" },
      { label: "Institutional", color: "#aa44ff" },
    ],
    flood_risk: [
      { label: "High Risk", color: "#ff4444" },
      { label: "Moderate", color: "#ff8800" },
      { label: "Alert", color: "#ffaa00" },
    ]
  };

  let html = "";
  activeLayerIds.forEach(id => {
    const items = legendMap[id] || [];
    html += items.map(i => `<span class="legend-item"><span class="legend-dot" style="background:${i.color}"></span>${i.label}</span>`).join("");
  });
  el.innerHTML = html;
}


function renderUrbanLayerToggle() {
  const el = $("watchpointList");
  if (!el) return;
  let container = $("urbanLayerToggle");
  if (!container) {
    container = document.createElement("div");
    container.id = "urbanLayerToggle";
    container.className = "segmented-control urban-toggle";
    document.querySelector(".map-controls").appendChild(container);
  }

  container.innerHTML = URBAN_LAYERS.map(l => `<button data-id="${l.id}" class="${l.active ? 'active' : ''}">${t(l.id === 'land_use' ? 'landUse' : l.id === 'flood_risk' ? 'floodRisk' : l.id === 'drainage' ? 'drainage' : l.id)}</button>`).join("");
  
  container.querySelectorAll("button").forEach(btn => btn.addEventListener("click", async () => {
    const layer = URBAN_LAYERS.find(l => l.id === btn.dataset.id);
    if (!layer) return;

    layer.active = !layer.active;
    btn.classList.toggle("active", layer.active);

    // AlphaEarth raster overlays — route by layer id.
    if (layer.type === "image") {
      if (layer.id === "impervious") toggleImperviousOverlay(layer.active, btn);
      else toggleAlphaEarthOverlay(layer.active, btn);
      return;
    }

    if (!layer.active) {
      const existing = state.urbanLayerGroups.get(layer.id);
      if (existing && state.map.hasLayer(existing)) state.map.removeLayer(existing);
      const activeIds = URBAN_LAYERS.filter(l => l.active).map(l => l.id);
      renderGisLegend(activeIds);
      return;
    }

    // Cached: re-attach without refetch.
    if (state.urbanLayerGroups.has(layer.id)) {
      state.urbanLayerGroups.get(layer.id).addTo(state.map);
      const activeIds = URBAN_LAYERS.filter(l => l.active).map(l => l.id);
      renderGisLegend(activeIds);
      return;
    }

    // Fresh load: fetch GeoJSON, style by feature kind, attach to map.
    const originalLabel = btn.textContent;
    btn.textContent = "…";
    btn.disabled = true;
    try {
      const fc = await fetchLayer(layer.id);
      if (!fc) throw new Error("layer fetch failed");
      const features = fc.features || [];
      if (features.length === 0) {
        btn.textContent = originalLabel + " (0)";
        btn.classList.add("layer-empty");
        return;
      }

      // Drainage: blue, weight by waterway rank (river > canal > stream > drain > ditch).
      // Transit: amber, weight by highway rank (motorway > trunk > primary > secondary).
      const styleFor = (props) => {
        if (layer.id === "drainage") {
          const rank = props.rank || 0;
          return {
            color: rank >= 4 ? "#1e90ff" : rank >= 3 ? "#3aa6ff" : rank >= 2 ? "#60a5fa" : "#93c5fd",
            weight: rank >= 4 ? 3 : rank >= 3 ? 2.2 : rank >= 2 ? 1.6 : 1.1,
            opacity: 0.85,
            dashArray: props.intermittent ? "4 4" : null,
          };
        }
        if (layer.id === "transit") {
          const rank = props.rank || 0;
          return {
            color: rank >= 5 ? "#ff003c" : rank >= 4 ? "#ff7a00" : rank >= 3 ? "#ffd000" : "#fbbf24",
            weight: rank >= 5 ? 3.2 : rank >= 4 ? 2.6 : rank >= 3 ? 2 : 1.4,
            opacity: 0.9,
          };
        }
        if (layer.id === "flood_zones") {
          const sevColor = { critical: "#ef4444", high: "#f97316", seasonal: "#eab308" };
          const c = sevColor[props.severity] || layer.color;
          return { color: c, weight: 2, opacity: 0.9, fillColor: c, fillOpacity: 0.25 };
        }
        if (layer.id === "mpp_wards") {
          const c = props.color || WARD_COLOR_MAP[props.wardCode] || layer.color;
          const active = state.activeWard === props.wardCode;
          return {
            color: c,
            weight: active ? 3 : 1.6,
            opacity: 0.95,
            fillColor: c,
            fillOpacity: active ? 0.3 : 0.12,
            dashArray: active ? null : "4 4",
          };
        }
        if (layer.id === "land_use" || layer.id === "flood_risk") {
          return {
            color: props.color || layer.color,
            weight: 1.5,
            opacity: props.opacity || 0.85,
            fillOpacity: props.opacity || 0.45,
          };
        }
        return { color: layer.color, weight: 1.5, opacity: 0.85 };
      };

      // Index sub-layers by feature id so the catchment highlighter can
      // find specific drainage segments by id later.
      const featureLayers = new Map();
      const group = window.L.geoJSON(fc, {
        style: (feat) => styleFor(feat.properties || {}),
        onEachFeature: (feat, lyr) => {
          const p = feat.properties || {};
          if (layer.id === "mpp_wards") {
            const tooltip = `<strong>Ward ${p.wardCode}${p.wardLabel ? " // " + p.wardLabel : ""}</strong><br>${p.area || ""}<br><em>Click to filter councillors + localities</em>`;
            lyr.bindTooltip(tooltip, { className: "marker-tooltip", sticky: true });
            lyr.on("click", () => setActiveWard(state.activeWard === p.wardCode ? null : p.wardCode));
            return;
          }
          const lines = [
            `<strong>${p.name || `${(p.kind||'feature')} #${p.id}`}</strong>`,
            p.kind ? `Kind: ${p.kind}` : null,
            p.ref ? `Ref: ${p.ref}` : null,
            p.lanes ? `Lanes: ${p.lanes}` : null,
            p.tunnel ? `Tunnel: ${p.tunnel}` : null,
            p.intermittent ? "Intermittent" : null,
          ].filter(Boolean);
          lyr.bindTooltip(lines.join("<br>"), { className: "marker-tooltip", sticky: true });
          const fid = feat.id ?? p.id;
          if (fid != null) featureLayers.set(fid, lyr);
        },
      }).addTo(state.map);
      state.urbanLayerGroups.set(layer.id, group);
      if (layer.id === "drainage") state.drainageFeatureIndex = featureLayers;
      if (layer.id === "mpp_wards") {
        state.wardFeatures = fc.features || [];
        state.wardLayerGroup = group;
      }
      btn.textContent = `${originalLabel.replace(/ \(\d+\)$/, "")} (${features.length})`;
    } catch (error) {
      console.warn(`Layer ${layer.id} failed:`, error);
      btn.textContent = originalLabel + " ✕";
      btn.classList.add("layer-failed");
      layer.active = false;
      btn.classList.remove("active");
    } finally {
      btn.disabled = false;
      const activeIds = URBAN_LAYERS.filter(l => l.active).map(l => l.id);
      renderGisLegend(activeIds);
    }
  }));
}

// IOC 2.0 — AlphaEarth growth-ring change overlay (Leaflet imageOverlay).
// Raster sits over the Kota Padawan growth frontier; amber→red marks where the
// land-surface embedding shifted most between 2017 and the latest year.
function toggleAlphaEarthOverlay(active, btn) {
  const ae = state.payload?.alphaEarth;
  if (!active) {
    if (state.alphaEarthOverlays) {
      state.alphaEarthOverlays.forEach(layer => {
        if (state.map.hasLayer(layer)) state.map.removeLayer(layer);
      });
    }
    const sliderContainer = document.getElementById("alphaEarthSlider");
    if (sliderContainer) sliderContainer.hidden = true;
    return;
  }
  if (!ae || ae.status !== "ready" || !ae.timeline || !ae.timeline.length) {
    // Pipeline not run yet (Earth Engine auth pending) — degrade gracefully AND
    // revert layer.active + button state so a second click isn't a no-op.
    const layer = URBAN_LAYERS.find((l) => l.id === "growth");
    if (layer) layer.active = false;
    btn.classList.remove("active");
    btn.classList.add("layer-empty");
    btn.textContent = "Growth (pending)";
    return;
  }
  
  if (!state.alphaEarthOverlays) {
    state.alphaEarthOverlays = ae.timeline.map(t => {
      const b = t.bounds;
      const url = apiUrl("/" + t.image.replace(/^\//, ""));
      return window.L.imageOverlay(
        url,
        [[b.south, b.west], [b.north, b.east]],
        { opacity: 0, interactive: false, className: "alphaearth-overlay" }
      );
    });
  }
  
  state.alphaEarthOverlays.forEach(layer => layer.addTo(state.map));
  
  initAlphaEarthSlider(ae);
  
  const b = ae.bounds;
  if (state.map.getZoom() < 11) state.map.flyTo([(b.south + b.north) / 2, (b.west + b.east) / 2], 12, { duration: 0.6 });
}

function initAlphaEarthSlider(ae) {
  const container = document.getElementById("alphaEarthSlider");
  const slider = document.getElementById("aeTimeSlider");
  const label = document.getElementById("aeSliderYear");
  const ticks = document.getElementById("aeSliderTicks");
  
  if (!container || !slider || !ae.timeline) return;
  
  const maxIdx = ae.timeline.length - 1;
  slider.max = maxIdx;
  
  ticks.innerHTML = ae.timeline.map((t) => {
    return `<span>${t.years.b}</span>`;
  }).join("");
  
  function updateSlider() {
    const idx = parseInt(slider.value, 10);
    const targetYear = ae.timeline[idx].years.b;
    label.textContent = targetYear;
    
    state.alphaEarthOverlays.forEach((layer, i) => {
      layer.setOpacity(i === idx ? 0.85 : 0);
    });
  }
  
  slider.oninput = updateSlider;
  slider.value = maxIdx;
  updateSlider();
  
  container.hidden = false;
}

// IOC 2.1 — AlphaEarth impervious-surface overlay. Transparent→amber→red ramp;
// red = dense concrete/rooftop, transparent = permeable. Helps Secretary Goh
// correlate the flood matrix drainage-stress flags with actual land cover.
function toggleImperviousOverlay(active, btn) {
  const imp = state.payload?.impervious;
  if (!active) {
    if (state.imperviousOverlay && state.map.hasLayer(state.imperviousOverlay)) {
      state.map.removeLayer(state.imperviousOverlay);
    }
    return;
  }
  if (!imp || imp.status !== "ready" || !imp.bounds || !imp.image) {
    const layer = URBAN_LAYERS.find((l) => l.id === "impervious");
    if (layer) layer.active = false;
    btn.classList.remove("active");
    btn.classList.add("layer-empty");
    btn.textContent = "Impervious (pending)";
    return;
  }
  if (!state.imperviousOverlay) {
    const b = imp.bounds;
    const url = apiUrl("/" + imp.image.replace(/^\//, ""));
    state.imperviousOverlay = window.L.imageOverlay(
      url,
      [[b.south, b.west], [b.north, b.east]],
      { opacity: 0.70, interactive: false, className: "alphaearth-overlay" },
    );
  }
  state.imperviousOverlay.addTo(state.map);
  if (state.map.getZoom() < 11) state.map.flyTo([(imp.bounds.south + imp.bounds.north) / 2, (imp.bounds.west + imp.bounds.east) / 2], 12, { duration: 0.6 });
}

// IOC 2.0 — TimesFM forecast rail. Each card: current reading, a sparkline with
// the p10–p90 uncertainty band around the p50 median (history → forecast), and
// the 7-day outlook with worst-case p90. p90 = the worst case, always shown
// alongside the median (Nonism §12.5). Source badge: TIMESFM vs BASELINE.
function forecastBand(history, q) {
  const hist = (Array.isArray(history) ? history : []).slice(-14);
  const p10 = q?.p10 || [], p50 = q?.p50 || [], p90 = q?.p90 || [];
  if (!p50.length) return "";
  const w = 168, h = 44, pad = 3;
  const histN = hist.length, fcN = p50.length, total = histN + fcN;
  const all = [...hist, ...p10, ...p50, ...p90].filter((v) => Number.isFinite(v));
  if (all.length < 2) return "";
  const mn = Math.min(...all), mx = Math.max(...all), rng = Math.max(mx - mn, 1e-6);
  const X = (idx) => (total <= 1 ? pad : (idx / (total - 1)) * (w - 2 * pad) + pad);
  const Y = (v) => h - pad - ((v - mn) / rng) * (h - 2 * pad);
  const up = p90.map((v, i) => `${X(histN + i).toFixed(1)},${Y(v).toFixed(1)}`);
  const dn = p10.map((v, i) => `${X(histN + i).toFixed(1)},${Y(v).toFixed(1)}`).reverse();
  const bandPath = up.length ? `M ${up.join(" L ")} L ${dn.join(" L ")} Z` : "";
  const medPts = [...hist, ...p50].map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const splitX = X(Math.max(histN - 1, 0)).toFixed(1);
  return `<svg viewBox="0 0 ${w} ${h}" class="fc-spark" preserveAspectRatio="none" aria-hidden="true">
    ${bandPath ? `<path d="${bandPath}" class="fc-band"/>` : ""}
    <line x1="${splitX}" y1="${pad}" x2="${splitX}" y2="${h - pad}" class="fc-now-line"/>
    <polyline points="${medPts}" class="fc-median" fill="none"/>
  </svg>`;
}

function renderForecastRail(payload) {
  const el = $("forecastRail");
  if (!el) return;
  const fc = payload.forecast;
  const tEmpty = t("forecastIdle") || "Forecast engine idle — run scripts/forecast/forecast_runner.py to populate the 7-day outlook.";
  if (!fc || fc.status === "absent" || !fc.series || !Object.keys(fc.series).length) {
    el.innerHTML = `<div class="forecast-empty">${escapeHtml(tEmpty).replace("scripts/forecast/forecast_runner.py", "<code>scripts/forecast/forecast_runner.py</code>")}</div>`;
    return;
  }
  // Filter to series with a usable median array — defensive against malformed JSON.
  const order = ["river_discharge", "rainfall", "aqi", "pm25"];
  const valid = (k) => fc.series[k] && Array.isArray(fc.series[k].median) && fc.series[k].median.length > 0;
  const keys = order.filter(valid).concat(Object.keys(fc.series).filter((k) => !order.includes(k) && valid(k) && !k.startsWith("station_")));
  if (!keys.length) {
    el.innerHTML = `<div class="forecast-empty">${escapeHtml(tEmpty)}</div>`;
    return;
  }
  const isTimesfm = String(fc.model || "").includes("timesfm");
  const badge = fc.status === "stale" ? (t("forecastStale") || "STALE")
    : isTimesfm ? "TIMESFM" : (t("forecastBaseline") || "BASELINE");
  const horizonLabel = t("forecastSub") || `${fc.horizon || 7}-day outlook · p10–p90 band`;
  el.innerHTML = `
    <div class="forecast-rail-head">
      <span class="forecast-badge" data-src="${isTimesfm ? "timesfm" : "stub"}">${escapeHtml(badge)}</span>
      <span class="forecast-sub">${escapeHtml(horizonLabel)}</span>
    </div>
    <div class="forecast-cards">
      ${keys.map((k) => {
        const s = fc.series[k];
        const median = s.median;
        const q = s.quantiles || {};
        const last = median[median.length - 1];
        const p10 = Array.isArray(q.p10) && q.p10.length ? q.p10[q.p10.length - 1] : null;
        const p90 = Array.isArray(q.p90) && q.p90.length ? q.p90[q.p90.length - 1] : null;
        const now = s.lastValue;
        const glyph = (last != null && now != null) ? (last > now ? "▲" : last < now ? "▼" : "—") : "—";
        const tone = (k === "river_discharge" && p90 != null && now && p90 >= now * 1.5) ? "warn"
          : (k === "aqi" && p90 != null && p90 >= 100) ? "warn" : "cool";
        const label = t(`forecastSeries_${k}`) || s.label || k;
        const range = (p10 != null && p90 != null) ? `[${p10} – ${p90}]` : "";
        return `<div class="forecast-card" data-tone="${tone}">
          <div class="fc-card-label">${escapeHtml(label)}</div>
          <div class="fc-now-row"><span class="fc-now-val">${now ?? "—"}</span><span class="fc-unit">${escapeHtml(s.unit || "")}</span></div>
          ${forecastBand(s.history, s.quantiles)}
          <div class="fc-outlook"><span class="fc-glyph">${glyph}</span> ${last ?? "—"} <span class="fc-range">${range}</span></div>
        </div>`;
      }).join("")}
    </div>`;
}

// --- Pass 1.1: Delta digest --- "what changed since you last looked"
function captureSnapshot(p) {
  const ops = (p?.operations || []).map(o => hashStr((o.owner || "") + "|" + (o.title || "")));
  const news = (p?.news?.items || []).slice(0, 12).map(i => hashStr(i.title || ""));
  return {
    t: Date.now(),
    apimsAqi: p?.apims?.worst?.aqi ?? null,
    aqi: p?.climate?.air?.current?.aqi ?? null,
    hydroBand: p?.infobanjir?.highestBand ?? null,
    hydroWorstName: p?.infobanjir?.stations?.[0]?.name ?? null,
    hydroWorstLevel: p?.infobanjir?.stations?.[0]?.waterLevelM ?? null,
    metActive: p?.metWarnings?.activeCount ?? 0,
    metHeading: p?.metWarnings?.items?.[0]?.heading ?? null,
    rain6h: p?.metrics?.find(m => m.id === "rain6h")?.value ?? null,
    floodPeak: p?.floodForecast?.peakCms ?? null,
    posture: p?.summary?.posture ?? null,
    operationHashes: ops,
    newsHashes: news,
  };
}

function diffSnapshots(prev, curr) {
  if (!prev) return [];
  const lines = [];

  if (prev.apimsAqi != null && curr.apimsAqi != null && Math.abs(curr.apimsAqi - prev.apimsAqi) >= 8) {
    const up = curr.apimsAqi > prev.apimsAqi;
    lines.push({ glyph: up ? "↑" : "↓",
      text: `APIMS AQI ${prev.apimsAqi}→${curr.apimsAqi}`,
      tone: up ? "warn" : "cool" });
  }
  if (prev.posture && curr.posture && prev.posture !== curr.posture) {
    lines.push({ glyph: "Δ", text: `Posture ${prev.posture}→${curr.posture}`, tone: "warn" });
  }
  if (prev.hydroBand !== curr.hydroBand && (prev.hydroBand || curr.hydroBand)) {
    lines.push({ glyph: "Δ",
      text: `Hydro posture ${prev.hydroBand || "—"}→${curr.hydroBand || "—"}`,
      tone: "warn" });
  }
  if (prev.hydroWorstLevel != null && curr.hydroWorstLevel != null &&
      Math.abs(curr.hydroWorstLevel - prev.hydroWorstLevel) >= 0.2 &&
      curr.hydroWorstName) {
    const delta = (curr.hydroWorstLevel - prev.hydroWorstLevel).toFixed(1);
    const sign = delta > 0 ? "+" : "";
    lines.push({ glyph: "Δ",
      text: `${curr.hydroWorstName} ${sign}${delta}m`,
      tone: "warn" });
  }
  if (prev.metActive !== curr.metActive) {
    if (curr.metActive > prev.metActive) {
      lines.push({ glyph: "+",
        text: `MET warning${curr.metActive > 1 ? "s" : ""} active: ${curr.metHeading || "see brief"}`,
        tone: "alert" });
    } else if (prev.metActive > curr.metActive) {
      lines.push({ glyph: "−", text: `MET warning${prev.metActive > 1 ? "s" : ""} cleared`, tone: "cool" });
    }
  }
  const newOps  = curr.operationHashes.filter(h => !prev.operationHashes.includes(h)).length;
  const goneOps = prev.operationHashes.filter(h => !curr.operationHashes.includes(h)).length;
  if (newOps > 0)  lines.push({ glyph: "+", text: `${newOps} new directive${newOps > 1 ? "s" : ""}`, tone: "warn" });
  if (goneOps > 0) lines.push({ glyph: "−", text: `${goneOps} directive${goneOps > 1 ? "s" : ""} cleared`, tone: "cool" });
  const newNews = curr.newsHashes.filter(h => !prev.newsHashes.includes(h)).length;
  if (newNews >= 3) lines.push({ glyph: "+", text: `${newNews} new headline${newNews > 1 ? "s" : ""}`, tone: "info" });

  return lines.slice(0, 5);
}

function relativeMinutes(ts) {
  if (!ts) return null;
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

function renderDeltaDigest(payload) {
  const strip = $("deltaStrip");
  const sinceEl = $("deltaSince");
  const listEl = $("deltaList");
  if (!strip || !sinceEl || !listEl) return;

  const prev = readJson(SNAPSHOT_KEY);
  const curr = captureSnapshot(payload);
  const lines = prev ? diffSnapshots(prev, curr) : [];
  const since = prev?.t ? relativeMinutes(prev.t) : null;

  if (!prev) {
    strip.dataset.empty = "true";
    sinceEl.textContent = "First visit · baseline captured";
    listEl.innerHTML = "";
  } else if (lines.length === 0) {
    strip.dataset.empty = "true";
    sinceEl.textContent = `No change since ${since || "earlier"}`;
    listEl.innerHTML = "";
  } else {
    strip.dataset.empty = "false";
    sinceEl.textContent = `since ${since}`;
    listEl.innerHTML = lines.map(l => `
      <span class="delta-line" data-tone="${l.tone}">
        <span class="delta-glyph">${l.glyph}</span>
        <span class="delta-text">${escapeHtml ? escapeHtml(l.text) : l.text}</span>
      </span>`).join("");
  }

  // Persist the new snapshot for next visit / next render.
  writeJson(SNAPSHOT_KEY, curr);
  writeJson(VISIT_KEY, Date.now());
}

// --- Today's Brief: a single-line teleprompter under the title.
// Reads as the first thing a Secretary glances at: time · posture · key flags ·
// what needs his attention. Composed only from the existing payload, so it
// updates on every render (and in delta differential after midnight resets).
function composeTodayBrief(payload) {
  const segments = [];
  const stamp = new Date().toLocaleString("en-MY", {
    day: "2-digit", month: "short",
    hour: "2-digit", minute: "2-digit", hour12: false,
    timeZone: "Asia/Kuching",
  }).replace(",", "");
  segments.push(stamp);

  const postureRaw = String(payload?.summary?.posture || "stable").toLowerCase();
  const postureHuman = {
    stable: "Calm",
    "steady-watch": "Keep an eye on it",
    watch: "Stay alert",
    stretched: "Pressure building",
  };
  const postureLabel = postureHuman[postureRaw] || postureRaw;
  segments.push(`<span class="brief-posture" data-posture="${postureRaw}">${postureLabel}</span>`);

  const metCount = payload?.metWarnings?.activeCount || 0;
  if (metCount > 0) {
    segments.push(`<span class="brief-flag" data-tone="alert">${metCount} weather warning${metCount > 1 ? "s" : ""}</span>`);
  } else {
    segments.push(`<span class="brief-flag" data-tone="ok">Weather clear</span>`);
  }

  const hydroBand = payload?.infobanjir?.highestBand;
  if (hydroBand && !["normal", "reference"].includes(hydroBand)) {
    const worst = payload?.infobanjir?.stations?.[0];
    const bandWord = { alert: "rising", warning: "high", danger: "critical" }[hydroBand] || hydroBand;
    segments.push(`<span class="brief-flag" data-tone="warn">River ${bandWord}${worst?.name ? " at " + worst.name : ""}</span>`);
  }

  const apims = payload?.apims?.worst;
  if (apims?.aqi != null) {
    const tone = apims.aqi >= 100 ? "warn" : apims.aqi >= 75 ? "warn" : "muted";
    const airWord = apims.aqi >= 100 ? "Unhealthy air" : apims.aqi >= 75 ? "Hazy air" : "Air OK";
    segments.push(`<span class="brief-flag" data-tone="${tone}">${airWord} · ${apims.aqi}</span>`);
  }

  const highOps = (payload?.operations || []).filter(o => o.severity === "high").length;
  if (highOps > 0) {
    segments.push(`<span class="brief-flag" data-tone="warn">${highOps} urgent action${highOps > 1 ? "s" : ""}</span>`);
  }

  const rain6h = payload?.metrics?.find(m => m.id === "rain6h")?.value;
  if (rain6h != null && rain6h >= 5) {
    segments.push(`<span class="brief-flag" data-tone="warn">${rain6h} mm rain in 6h</span>`);
  }

  return segments.join(' <span class="brief-sep">·</span> ');
}

// --- Pass 3.6: Today's events stack — ATC-style time-anchored log ---
function freshnessBucket(tsMs) {
  const ageMin = (Date.now() - tsMs) / 60_000;
  if (ageMin < 30) return "now";
  if (ageMin < 240) return "recent";
  return "older";
}
function eventTime(tsMs) {
  return new Date(tsMs).toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuching" });
}
function composeEvents(payload) {
  const out = [];
  const cutoff = Date.now() - 24 * 3600 * 1000;
  // MET warnings
  for (const w of payload?.metWarnings?.items || []) {
    const t = Date.parse(w.validFrom || payload.metWarnings.updatedAt);
    if (t && t >= cutoff) {
      out.push({ t, type: "MET", text: `${w.heading || "Active warning"}${w.validTo ? " · valid until " + new Date(w.validTo).toLocaleTimeString("en-MY",{hour:"2-digit",minute:"2-digit",hour12:false,timeZone:"Asia/Kuching"}) : ""}` });
    }
  }
  // Hydro: any non-normal stations as events at the payload generatedAt
  const ib = payload?.infobanjir;
  if (ib?.stations) {
    const tIb = Date.parse(ib.updatedAt || payload.generatedAt) || Date.now();
    for (const s of ib.stations) {
      if (["alert", "warning", "danger"].includes(s.band)) {
        out.push({ t: tIb, type: "HYDRO", text: `${s.name} ${s.waterLevelM != null ? s.waterLevelM + "m" : ""} (${s.bandLabel || s.band})` });
      }
    }
  }
  // Earthquakes (regional, last 24h)
  for (const q of payload?.quakes?.events || []) {
    const t = Date.parse(q.time);
    if (t && t >= cutoff && (q.distanceKm == null || q.distanceKm < 600)) {
      out.push({ t, type: "QUAKE", text: `M${q.magnitude?.toFixed(1) ?? "?"} ${q.place || "regional event"}` });
    }
  }
  // Airport peak
  const airTracked = payload?.airport?.movements?.totalTracked ?? 0;
  if (airTracked >= 8) {
    out.push({ t: Date.parse(payload.airport.updatedAt || payload.generatedAt) || Date.now(),
      type: "AIR", text: `${airTracked} aircraft tracked · peak local traffic` });
  }
  // Flood-forecast peak (only if >200 m³/s)
  const peak = payload?.floodForecast?.peakCms;
  if (peak != null && peak > 200) {
    out.push({ t: Date.parse(payload.floodForecast.updatedAt || payload.generatedAt) || Date.now(),
      type: "FLOOD", text: `GloFAS peak ${peak} m³/s on Sarawak River` });
  }
  // News headlines (official-tier preferred). Last 24h.
  const news = (payload?.news?.items || [])
    .filter(i => {
      const t = Date.parse(i.publishedAt || payload.news.updatedAt);
      return t && t >= cutoff;
    })
    .sort((a, b) => (b.isOfficial ? 1 : 0) - (a.isOfficial ? 1 : 0))
    .slice(0, 5);
  for (const n of news) {
    out.push({ t: Date.parse(n.publishedAt) || Date.now(), type: "NEWS", text: `${n.source || ""}${n.source ? " · " : ""}${(n.title || "").slice(0, 80)}` });
  }
  out.sort((a, b) => b.t - a.t);
  return out.slice(0, 10);
}

function renderEventsStack(payload) {
  const el = $("eventsStack");
  if (!el) return;
  const events = composeEvents(payload);
  if (!events.length) {
    el.innerHTML = `<div class="events-empty">No notable events in the last 24h.</div>`;
    return;
  }
  el.innerHTML = events.map(e => `
    <article class="event-row" data-type="${e.type}" data-fresh="${freshnessBucket(e.t)}">
      <span></span>
      <span class="event-time">${eventTime(e.t)}</span>
      <span class="event-type">${e.type}</span>
      <span class="event-text">${escapeHtml(e.text)}</span>
    </article>`).join("");
}

// --- Pass 3.7: COMMAND EXPORT — WhatsApp clipboard, plain-text sitrep, print ---
function buildSitrepText(p) {
  const now = new Date();
  const stamp = now.toLocaleString("en-MY", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kuching" });
  const posture = (p.summary?.posture || "stable").toUpperCase();
  const acts = (p.operations || []).filter(o => o.severity === "high").slice(0, 3);
  const env = [];
  const heat = p.metrics?.find(m => m.id === "heat");
  if (heat) env.push(`Heat index ${heat.value}°C · ${heat.context}`);
  const aqi = p.apims?.worst;
  if (aqi?.aqi != null) env.push(`AQI ${aqi.aqi} (APIMS ${aqi.stationName || aqi.label})`);
  const rain = p.metrics?.find(m => m.id === "rain6h");
  if (rain) env.push(`Rain next 6h: ${rain.value}mm`);
  const ib = p.infobanjir;
  if (ib?.stations?.length) {
    const worst = ib.stations[0];
    env.push(`${worst.name}: ${worst.waterLevelM != null ? worst.waterLevelM + "m" : "ref"} (${worst.bandLabel || worst.band})`);
  }
  const met = p.metWarnings;
  if (met?.activeCount > 0) env.push(`MET warning active: ${met.items[0].heading || ""}`);
  const air = p.airport?.movements;
  const lines = [
    "🛰 KUCHING SITREP · " + stamp,
    "",
    "POSTURE: " + posture + (p.summary?.headline ? " — " + p.summary.headline : ""),
    "",
    "ACT NOW",
    ...(acts.length ? acts.map((o, i) => `${i + 1}. ${o.owner}: ${o.title}`) : ["No high-severity directives."]),
    "",
    "ENVIRONMENT",
    ...env,
    "",
    "KCH AIRSPACE",
    air ? `${air.totalTracked} aircraft tracked · ${air.arrivals} arrivals / ${air.departures} departures` : "—",
    "",
    "— Office of Secretary Daniel Goh, MPP",
  ];
  return lines.join("\n");
}

function showToast(msg, tone = "ok") {
  const el = $("exportToast");
  if (!el) return;
  el.textContent = msg;
  el.dataset.tone = tone;
  el.hidden = false;
  clearTimeout(el._tid);
  el._tid = setTimeout(() => { el.hidden = true; }, 3000);
}

async function exportSitrepWhatsApp() {
  if (!state.payload) return;
  const text = buildSitrepText(state.payload);
  try {
    await navigator.clipboard.writeText(text);
    showToast("✓ COPIED · paste in WhatsApp", "ok");
  } catch (_) {
    // Fallback: open a new window with the text selected (user copies manually).
    const w = window.open("", "_blank");
    if (w) {
      w.document.body.style = "background:#010203;color:#e8f4ff;font:13px 'JetBrains Mono',monospace;padding:24px;white-space:pre-wrap;";
      w.document.body.textContent = text;
      showToast("◐ CLIPBOARD BLOCKED · text in new tab", "error");
    } else {
      showToast("✕ EXPORT FAILED", "error");
    }
  }
}

// --- Pass 3.8: Telemetry strip + cross-reference connectors ---
function renderTelemetryStrip(payload) {
  const el = $("telemetryStrip");
  if (!el) return;
  const fmtTime = new Date().toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false, timeZone: "Asia/Kuching" });
  const entries = [];
  entries.push(`<span class="tlm-time">[${fmtTime}]</span>`);
  const mode = payload.delivery?.tone || "unknown";
  const modeStatus = deliveryToneToStatus(mode);
  entries.push(`<span class="tlm-entry">${glyphHTML(modeStatus, payload.delivery?.modeLabel || mode)}</span>`);
  // Per-source heartbeat glyphs.
  const sources = [
    ["did-ihydro", payload.infobanjir?.status],
    ["flood-action", payload.floodAction?.status],
    ["apims", payload.apims?.status],
    ["met", payload.metWarnings?.status],
    ["glofas", payload.floodForecast?.status],
    ["weather", payload.climate?.weather?.status],
    ["aqi", payload.climate?.air?.status],
    ["news", payload.news?.status],
  ];
  for (const [name, st] of sources) {
    if (st) entries.push(`<span class="tlm-entry">${glyphHTML(st, name)}</span>`);
  }
  el.innerHTML = entries.join('<span class="tlm-sep">·</span>');
}

// Connector overlay: hairline cyan curves from a hovered metric tile to its
// related elements in the rest of the dashboard. Pointer-events: none.
const CONNECTOR_MAP = {
  // metric-card id (lowercased) → list of CSS selectors to draw to
  aqi:      ['#signalCards .signal-card[style*="ff003c"], #signalCards .signal-card[style*="ff7a00"], #signalCards .signal-card[style*="ffd000"]', '.operation-card[data-severity="high"]'],
  heat:     ['#signalCards .signal-card:first-child'],
  rain6h:   ['#floodForecast', '#signalCards .signal-card[data-band]'],
  airport:  ['#airportStats'],
  pm25:     ['#signalCards .signal-card'],
  flood:    ['#floodForecast', '#signalCards .signal-card[data-band]'],
  trends:   ['#newsRail'],
  headlines:['#newsRail'],
  wards:    ['#localityList', '#councillorPanel'],
};

function setupConnectors() {
  const canvas = $("connectorCanvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = window.innerWidth + "px";
    canvas.style.height = window.innerHeight + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener("resize", resize);

  let activeLines = []; // { from:{x,y}, to:{x,y}, until:ts }
  let raf = null;

  function clearAll() {
    activeLines = [];
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    activeLines = activeLines.filter(l => l.until > now);
    for (const l of activeLines) {
      const remaining = (l.until - now) / 800;
      ctx.strokeStyle = `rgba(0, 243, 255, ${0.15 + 0.4 * remaining})`;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.lineDashOffset = -((now / 25) % 8);
      ctx.beginPath();
      const cpx = (l.from.x + l.to.x) / 2;
      const cpy = (l.from.y + l.to.y) / 2 - 30;
      ctx.moveTo(l.from.x, l.from.y);
      ctx.quadraticCurveTo(cpx, cpy, l.to.x, l.to.y);
      ctx.stroke();
    }
    if (activeLines.length) raf = requestAnimationFrame(draw);
    else raf = null;
  }

  function rectCenter(el) {
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }

  function showConnectors(metricId, srcEl) {
    const selectors = CONNECTOR_MAP[metricId];
    if (!selectors) return;
    const from = rectCenter(srcEl);
    const targets = selectors.flatMap(s => [...document.querySelectorAll(s)].slice(0, 3));
    if (!targets.length) return;
    const until = Date.now() + 1200;
    for (const t of targets) {
      activeLines.push({ from, to: rectCenter(t), until });
    }
    if (!raf) draw();
  }

  // Metric tiles render as .metric-card with a kicker that contains the id.
  document.addEventListener("mouseover", (e) => {
    const card = e.target.closest?.(".metric-card");
    if (!card) return;
    const idLabel = card.querySelector(".metric-label")?.textContent?.toLowerCase() || "";
    let metricId = null;
    if (idLabel.includes("aqi"))      metricId = "aqi";
    else if (idLabel.includes("heat"))metricId = "heat";
    else if (idLabel.includes("rain"))metricId = "rain6h";
    else if (idLabel.includes("kch")) metricId = "airport";
    else if (idLabel.includes("pm"))  metricId = "pm25";
    else if (idLabel.includes("trend")) metricId = "trends";
    else if (idLabel.includes("headline")) metricId = "headlines";
    else if (idLabel.includes("ward")) metricId = "wards";
    if (metricId) showConnectors(metricId, card);
  }, { passive: true });
  document.addEventListener("mouseout", (e) => {
    if (!e.target.closest?.(".metric-card")) return;
    // Lines fade naturally; nothing to do.
  }, { passive: true });
}

// --- Pass 1.2: Directive status (queued → active → done) + age-decayed borders ---
const DIRECTIVE_STATUS_GLYPH = { queued: "◇", active: "◆", done: "●" };
const DIRECTIVE_NEXT_STATUS = { queued: "active", active: "done", done: "queued" };

function loadDirectiveState() {
  const raw = readJson(DIRECTIVE_STATE_KEY) || {};
  // Auto-purge entries with firstSeen older than 24h to keep storage clean.
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  const cleaned = {};
  for (const [hash, entry] of Object.entries(raw)) {
    if (entry?.firstSeen && entry.firstSeen >= cutoff) cleaned[hash] = entry;
  }
  if (Object.keys(cleaned).length !== Object.keys(raw).length) writeJson(DIRECTIVE_STATE_KEY, cleaned);
  return cleaned;
}
function saveDirectiveState(table) { writeJson(DIRECTIVE_STATE_KEY, table); }

function ageBucket(firstSeenMs) {
  if (!firstSeenMs) return "fresh";
  const ageH = (Date.now() - firstSeenMs) / 3_600_000;
  if (ageH < 4) return "fresh";
  if (ageH < 8) return "aging";
  return "stale";
}

function renderDirectives(ops) {
  const root = $("operationList");
  if (!root) return;
  const table = loadDirectiveState();
  const now = Date.now();
  let mutated = false;

  root.innerHTML = ops.map(o => {
    const hash = hashStr((o.owner || "") + "|" + (o.title || ""));
    let entry = table[hash];
    if (!entry) {
      entry = { status: "queued", firstSeen: now };
      table[hash] = entry;
      mutated = true;
    }
    const age = ageBucket(entry.firstSeen);
    const status = entry.status || "queued";
    const stale = age === "stale" ? `<span class="directive-stale-mark">↻ STALE</span>` : "";
    const ownerSafe = (o.owner || "").replace(/"/g, "&quot;");
    const titleSafe = (o.title || "").replace(/</g, "&lt;");
    return `
      <article class="operation-card"
               data-severity="${o.severity || "low"}"
               data-status="${status}"
               data-age="${age}"
               data-hash="${hash}"
               title="Click to cycle queued → active → done">
        <span class="directive-status" data-status="${status}">${DIRECTIVE_STATUS_GLYPH[status]}</span>
        <div class="kicker">${ownerSafe}${stale}</div>
        <strong>${titleSafe}</strong>
        <div class="operation-detail">${o.detail || ""}</div>
        ${o.humanContext ? `<div class="directive-context">${o.humanContext}</div>` : ""}
      </article>`;
  }).join("");

  if (mutated) saveDirectiveState(table);

  // Click cycles status. Reads the table on each click (avoids stale closure).
  root.querySelectorAll(".operation-card").forEach(card => {
    card.addEventListener("click", () => {
      const hash = card.dataset.hash;
      if (!hash) return;
      const t = loadDirectiveState();
      const entry = t[hash] || { status: "queued", firstSeen: Date.now() };
      entry.status = DIRECTIVE_NEXT_STATUS[entry.status] || "queued";
      t[hash] = entry;
      saveDirectiveState(t);
      card.dataset.status = entry.status;
      const glyph = card.querySelector(".directive-status");
      if (glyph) {
        glyph.dataset.status = entry.status;
        glyph.textContent = DIRECTIVE_STATUS_GLYPH[entry.status];
      }
    });
  });
}

// Map runtime delivery tone → status keyword for glyphs.
function deliveryToneToStatus(tone) {
  if (tone === "live") return "live";
  if (tone === "snapshot") return "cached";
  if (tone === "fallback") return "degraded";
  return "unknown";
}

function renderRuntimeMeta(payload) {
  const badge = $("dataModeBadge");
  const board = $("boardRoleBadge");
  const detail = $("runtimeDetail");
  const stamp = $("generatedAt");
  if (!badge || !board || !detail || !stamp) return;

  const delivery = payload.delivery || {};
  const status = deliveryToneToStatus(delivery.tone);
  badge.innerHTML = glyphHTML(status, delivery.modeLabel || "UNKNOWN");
  badge.dataset.mode = delivery.tone || "boot";
  board.innerHTML = glyphHTML(delivery.boardMode === "live-service" ? "live" : "cached", delivery.boardLabel || "BOARD");
  board.dataset.mode = delivery.boardMode || "boot";
  detail.textContent = buildRuntimeDetail(delivery, payload) || "Payload metadata unavailable.";
  detail.title = buildRuntimeTooltip(delivery);
  stamp.textContent = payload.generatedAt ? `PAYLOAD // ${formatBadgeStamp(payload.generatedAt)}` : "PAYLOAD // --";
}

function renderBriefStrip(payload) {
  const nowEl = $("briefNow");
  const nextEl = $("briefNext");
  const blindEl = $("briefBlind");
  if (!nowEl || !nextEl || !blindEl) return;

  const brief = buildBoardBrief(payload);
  const renderItems = (items) => items.map((item, index) => `
    <div class="brief-item">
      <span class="brief-index">0${index + 1}</span>
      <span>${item}</span>
    </div>`).join("");

  nowEl.innerHTML = renderItems(brief.now);
  nextEl.innerHTML = renderItems(brief.next);
  blindEl.innerHTML = renderItems(brief.blind);
}

function renderQualitativeLens(payload, activeSatellite) {
  const hero = $("qualHero");
  const observationsEl = $("qualObservations");
  const checksEl = $("qualChecks");
  const sourcesEl = $("qualSources");
  const cctvGridEl = $("cctvGrid");
  if (!hero || !observationsEl || !checksEl || !sourcesEl || !cctvGridEl) return;

  const lens = buildQualitativeLens(payload, activeSatellite);
  const renderList = (items) => items.map((item, index) => `
    <div class="qualitative-item">
      <span class="qualitative-index">0${index + 1}</span>
      <span>${item}</span>
    </div>`).join("");

  hero.innerHTML = `
    <div class="qual-hero-kicker">Scene Brief</div>
    <strong>${lens.lead}</strong>
    <div class="qual-hero-line">${lens.modeLine}</div>
    <div class="qual-hero-line">${lens.evidenceLine}</div>
    <div class="qual-hero-note">${lens.caveat}</div>`;
  observationsEl.innerHTML = renderList(lens.observations);
  checksEl.innerHTML = renderList(lens.checks);
  sourcesEl.innerHTML = lens.sources.length
    ? lens.sources.map((item) => `
      <a class="qualitative-source-item" href="${item.link}" target="_blank" rel="noopener">
        <div class="qualitative-source-head">
          <span class="qualitative-source-badge">${item.badge}</span>
          <span>${formatShortStamp(item.publishedAt)}</span>
        </div>
        <strong>${item.source}</strong>
        <span class="qualitative-source-title">${item.title}</span>
        <span class="qualitative-source-note">${item.note}</span>
      </a>`).join("")
    : `<div class="qualitative-source-empty">Scene read is running on telemetry only — no field sources in this cycle.</div>`;

  cctvGridEl.innerHTML = CCTV_FEEDS.map(feed => `
    <div class="cctv-card">
      <div class="cctv-head">
        <span class="cctv-label">${escapeHtml(feed.label)}</span>
        <span class="cctv-status" data-status="${feed.status}">${feed.status === 'live' ? '● LIVE' : '○ DEGRADED'}</span>
      </div>
      <div class="cctv-viewport">
        <!-- Placeholder for actual stream/image -->
        <div class="cctv-placeholder">
          <div class="cctv-crosshair"></div>
          <span class="cctv-timestamp">${new Date().toISOString().split('T')[1].slice(0, 8)}</span>
        </div>
      </div>
      <div class="cctv-condition">${escapeHtml(feed.condition)}</div>
    </div>
  `).join("");
}

function renderAirportStats(airport) {
  const el = $("airportStats");
  if (!el) return;
  const fl = airport.liveFlights || [];
  const arrivals = fl.filter(f=>f.type==="arrival");
  const departures = fl.filter(f=>f.type==="departure");
  const statusMap = {
    live: { label: "Live airspace · OpenSky feed", tone: "live" },
    fallback: { label: "Flight tracker reduced · OpenSky feed patchy", tone: "fallback" },
    offline: { label: "Airspace offline · no flight telemetry", tone: "offline" },
  };
  const statusMeta = statusMap[airport.status] || { label: "Reference telemetry", tone: "reference" };
  el.innerHTML = `
    <div class="airport-feed-status" data-status="${airport.status || "reference"}">${statusMeta.label}</div>
    <div class="airport-summary">
      <div class="airport-stat"><div class="stat-val">${fl.length}</div><div class="stat-label">Tracked</div></div>
      <div class="airport-stat arrival"><div class="stat-val">${arrivals.length}</div><div class="stat-label">Arrivals</div></div>
      <div class="airport-stat departure"><div class="stat-val">${departures.length}</div><div class="stat-label">Departures</div></div>
    </div>
    <div class="flight-list">${fl.slice(0,6).map(f=>`
      <div class="flight-row ${f.type}">
        <span class="flight-callsign">${f.callsign}</span>
        <span class="flight-type">${f.type==="arrival"?"IN":"OUT"}</span>
        <span class="flight-dist">${f.distanceKm}km</span>
        ${f.etaMinutes?`<span class="flight-eta">${f.etaMinutes}min</span>`:''}
        ${airport.status === "fallback" ? `<span class="flight-feed-tag">REF</span>` : ""}
      </div>`).join("")}
    </div>`;
}

function renderSourceMatrix(payload) {
  const el = $("sourceMatrix");
  if (!el) return;

  const sources = payload.sources || [];
  const counts = { live: 0, official: 0, degraded: 0, offline: 0 };
  sources.forEach((source) => {
    counts[sourceStatusBucket(source.status)] += 1;
  });

  const degraded = sources.filter((source) => ["fallback", "offline", "reference", "curated"].includes(source.status)).slice(0, 4);
  const degradedMarkup = degraded.length
    ? degraded.map((source) => `<span class="source-chip" data-status="${source.status}">${source.name} · ${SOURCE_STATUS_LABEL[source.status] || source.status}</span>`).join("")
    : `<span class="source-chip" data-status="live">No critical feed gaps</span>`;

  el.innerHTML = `
    <div class="source-matrix-grid">
      <div class="source-matrix-card" data-tone="live"><strong>${counts.live}</strong><span>Live</span></div>
      <div class="source-matrix-card" data-tone="official"><strong>${counts.official}</strong><span>Official</span></div>
      <div class="source-matrix-card" data-tone="degraded"><strong>${counts.degraded}</strong><span>Degraded</span></div>
      <div class="source-matrix-card" data-tone="offline"><strong>${counts.offline}</strong><span>Offline</span></div>
    </div>
    <div class="source-chip-row">${degradedMarkup}</div>`;
}

function renderNewsIntake(news) {
  const el = $("newsIntakePanel");
  if (!el) return;
  const lanes = [
    { code: "official", label: "Official", badge: "OFF", count: news.counts?.official ?? news.items.filter((item) => item.isOfficial).length },
    { code: "en", label: "English", badge: "EN", count: news.counts?.en ?? news.items.filter((item) => item.language === "en").length },
    { code: "ms", label: "Bahasa", badge: "BM", count: news.counts?.ms ?? news.items.filter((item) => item.language === "ms").length },
    { code: "zh", label: "Chinese", badge: "ZH", count: news.counts?.zh ?? news.items.filter((item) => item.language === "zh").length },
  ];
  const operatorItems = news.operatorItems?.length ? news.operatorItems.slice(0, 3) : news.items.slice(0, 3);
  el.innerHTML = `
    <div class="news-intake-grid">
      ${lanes.map((lane) => `
        <div class="news-intake-card">
          <span class="news-intake-badge">${lane.badge || lane.code.toUpperCase()}</span>
          <strong>${lane.count}</strong>
          <span>${lane.label}</span>
        </div>`).join("")}
    </div>
    <div class="news-intake-note">${news.summary || news.systemLabel || "Multilingual intake active."}</div>
    <div class="news-intake-list">
      ${operatorItems.map((item) => `
        <article class="news-intake-item">
          <div class="news-intake-item-head">
            <span class="news-intake-badge">${item.languageBadge || (item.isOfficial ? "OFF" : "EN")}</span>
            <strong>${item.source}</strong>
            <span>${formatShortStamp(item.publishedAt)}</span>
          </div>
          <div class="news-intake-title">${item.title}</div>
        </article>`).join("")}
    </div>`;
}

function renderIntelPanel(payload) {
  renderEconBand(payload.exchange);
  renderGroundPulse(payload.groundPulse);
  renderNewsDigest(payload.news);
  renderTrendsBand(payload.trends);
}

function renderEconBand(exchange) {
  const el = $("econBand");
  if (!el) return;
  const data = exchange ?? ECONOMY_FALLBACK;
  const fxPairs = (data.pairs ?? []).filter(p => ["USD","SGD","GBP","EUR"].includes(p.code));
  const macro = [
    { value: `${(data.macro?.gdpGrowthPct ?? ECONOMY_FALLBACK.macro.gdpGrowthPct).toFixed(1)}%`, label: "MY GDP Growth · FY2026" },
    { value: `RM ${(data.macro?.sarawakGdpBnMyr ?? ECONOMY_FALLBACK.macro.sarawakGdpBnMyr)}B`, label: "Sarawak GDP · 2024" },
    { value: `${(data.macro?.cpiInflationPct ?? ECONOMY_FALLBACK.macro.cpiInflationPct).toFixed(1)}%`, label: "CPI Inflation · Mar 2026" },
  ];
  el.innerHTML = [
    ...fxPairs.map(p => `
      <div class="econ-pill">
        <span class="econ-pill-value">${p.code} ${p.rate}</span>
        <span class="econ-pill-label">per 1 MYR</span>
      </div>`),
    ...macro.map(m => `
      <div class="econ-pill econ-macro">
        <span class="econ-pill-value">${m.value}</span>
        <span class="econ-pill-label">${m.label}</span>
      </div>`),
  ].join("");
}

function renderNewsDigest(news) {
  const el = $("newsDigest");
  if (!el || !news) return;
  const tabs = [
    { code: "en",  label: "EN" },
    { code: "ms",  label: "BM" },
    { code: "zh",  label: "ZH" },
  ];

  const renderTab = (code) => {
    const items = (news.items ?? []).filter(i => i.language === code).slice(0, 5);
    el.querySelector(".news-digest-list").innerHTML = items.length
      ? items.map(i => `
          <div class="news-digest-item">
            <span class="news-digest-badge">${i.source?.slice(0, 12) ?? code.toUpperCase()}</span>
            <span class="news-digest-title">${i.title}</span>
            <span class="news-digest-time">${formatShortStamp(i.publishedAt)}</span>
          </div>`).join("")
      : `<div class="news-digest-item"><span class="news-digest-title" style="color:var(--soft)">No ${code.toUpperCase()} items in this cycle.</span></div>`;
    el.querySelectorAll(".news-digest-tab").forEach(btn => btn.classList.toggle("active", btn.dataset.lang === code));
  };

  el.innerHTML = `
    <div class="news-digest-tabs">
      ${tabs.map(t => `<button class="news-digest-tab${t.code === "en" ? " active" : ""}" data-lang="${t.code}">${t.label}</button>`).join("")}
    </div>
    <div class="news-digest-list"></div>`;

  renderTab("en");

  if (!el.dataset.bound) {
    el.addEventListener("click", (event) => {
      const btn = event.target.closest(".news-digest-tab");
      if (!btn) return;
      renderTab(btn.dataset.lang);
    });
    el.dataset.bound = "1";
  }
}

function renderTrendsBand(trends) {
  const el = $("trendsBand");
  if (!el) return;
  const items = (trends?.items ?? []).slice(0, 5);
  if (!items.length) { el.innerHTML = ""; return; }
  el.innerHTML = `
    <div class="trends-band-head">Google Trends · Kuching / Malaysia</div>
    ${items.map((t, i) => `
      <div class="trend-row ${(t.locality?.score ?? 0) >= 2 ? "local" : ""}">
        <span class="trend-rank">${i + 1}</span>
        <span class="trend-term">${t.title}</span>
        <span class="trend-traffic">${t.trafficLabel ?? ""}</span>
      </div>`).join("")}`;
}

function renderGroundPulseSparkline(history) {
  // Need at least 3 points to draw a meaningful trend.
  if (!Array.isArray(history) || history.length < 3) return "";
  const values = history.map((h) => Number(h.mentions24h) || 0);
  const max = Math.max(1, ...values);
  const w = 40;
  const h = 12;
  const step = w / Math.max(1, values.length - 1);
  const points = values
    .map((v, i) => `${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`)
    .join(" ");
  const last = values[values.length - 1];
  const peak = last >= max * 0.66 && max > 0;
  return `<svg class="gp-spark ${peak ? "is-peak" : ""}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none" aria-hidden="true">
    <polyline points="${points}" fill="none" stroke="currentColor" stroke-width="1" />
  </svg>`;
}

function renderGroundPulseDelta(history, current) {
  // Compare current 24h count to ~24h ago (5 points back at 6h cadence) or
  // fall back to first point in window. Returns a styled chip or "".
  if (!Array.isArray(history) || history.length < 2) return "";
  const lookback = history[Math.max(0, history.length - 5)];
  const past = Number(lookback?.mentions24h) || 0;
  const now = Number(current) || 0;
  const diff = now - past;
  if (diff === 0) return `<span class="gp-delta is-flat" title="Flat vs ~24h ago">±0</span>`;
  const sign = diff > 0 ? "+" : "";
  const tone = diff > 0 ? "up" : "down";
  return `<span class="gp-delta is-${tone}" title="vs ~24h ago (${past} → ${now})">${sign}${diff}</span>`;
}

function renderGroundPulse(groundPulse) {
  const el = $("groundPulse");
  if (!el) return;
  if (!groundPulse || !Array.isArray(groundPulse.lanes) || groundPulse.lanes.length === 0) {
    el.innerHTML = "";
    return;
  }
  const totals = groundPulse.totals || { mentions: 0, last24h: 0 };
  const laneCards = groundPulse.lanes.map((lane) => {
    const headlines = (lane.headlines || []).map((h) => {
      const stamp = formatShortStamp(h.publishedAt) || "";
      const badge = h.isOfficial ? "OFFICIAL" : (h.languageBadge || (h.language || "EN").toUpperCase());
      const safeTitle = escapeHtml(h.title || "").slice(0, 140);
      const href = h.url ? `href="${escapeHtml(h.url)}" target="_blank" rel="noopener"` : "";
      return `
        <li class="gp-item">
          <span class="gp-badge">${escapeHtml(badge)}</span>
          <a class="gp-title" ${href}>${safeTitle}</a>
          <span class="gp-meta">${escapeHtml(h.source || "")}${stamp ? ` · ${stamp}` : ""}</span>
        </li>`;
    }).join("");

    const trendChips = (lane.trendMatches || []).map((t) => {
      const label = t.trafficLabel ? `${t.term} · ${t.trafficLabel}` : t.term;
      return `<span class="gp-trend" title="${escapeHtml(t.newsTitle || "")}">${escapeHtml(label)}</span>`;
    }).join("");

    const empty = !(lane.headlines || []).length && !(lane.trendMatches || []).length;
    const spark = renderGroundPulseSparkline(lane.history);
    const delta = renderGroundPulseDelta(lane.history, lane.last24hCount);
    return `
      <article class="gp-lane" data-lane="${lane.key}">
        <header class="gp-lane-head">
          <span class="gp-lane-label">${escapeHtml(lane.label)}</span>
          <span class="gp-lane-trend">${spark}${delta}</span>
          <span class="gp-lane-count">${lane.last24hCount || 0}<span class="gp-unit">·24h</span> / ${lane.mentionCount || 0}<span class="gp-unit">·14d</span></span>
        </header>
        <div class="gp-narrative">${escapeHtml(lane.narrative || lane.intent || "")}</div>
        ${trendChips ? `<div class="gp-trends">${trendChips}</div>` : ""}
        ${empty ? "" : `<ul class="gp-list">${headlines}</ul>`}
      </article>`;
  }).join("");

  el.innerHTML = `
    <div class="gp-head">
      <div class="gp-kicker">GROUND PULSE · WHY THIS MATTERS TODAY</div>
      <div class="gp-totals">${totals.last24h} mentions in last 24h · ${totals.mentions} in 14d window</div>
    </div>
    <div class="gp-lanes">${laneCards}</div>`;
}

// ── Flood Risk Matrix (IOC 2.1) ────────────────────────────────────────────
function floodActionVerb(payload) {
  const fa = payload?.floodAction;
  if (!fa) return null;
  const lang = state.lang || "en";
  if (lang === "ms") return fa.verbBm || fa.verb;
  if (lang === "zh") return fa.verbZh || fa.verb;
  return fa.verb;
}

// FloodDash-style action card — verb first, then checklist / shelters / hotlines.
function renderFloodAction(payload) {
  const el = $("floodActionCard");
  if (!el) return;
  const fa = payload?.floodAction;
  if (!fa) {
    el.hidden = true;
    return;
  }
  el.hidden = false;
  el.dataset.band = fa.band || "normal";
  const verb = floodActionVerb(payload) || "Rivers look fine";
  const checklist = (fa.checklist || []).map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  const reality = fa.realityCheck || {};
  const headlines = (reality.headlines || []).slice(0, 2).map((h) =>
    h.url
      ? `<a href="${escapeHtml(h.url)}" target="_blank" rel="noopener">${escapeHtml(h.title)}</a>`
      : escapeHtml(h.title),
  ).join(" · ");
  const hotlines = (fa.hotlines || []).slice(0, 4).map((h) => {
    const href = h.number ? `tel:${String(h.number).replace(/[^0-9+]/g, "")}` : (h.url || "#");
    const right = h.number || "OPEN";
    return `<a class="fa-hotline" href="${escapeHtml(href)}" ${h.url && !h.number ? 'target="_blank" rel="noopener"' : ""}><span><strong>${escapeHtml(h.label)}</strong></span><span>${escapeHtml(right)}</span></a>`;
  }).join("");
  const shelters = (fa.shelters || []).slice(0, 3).map((s) =>
    `<a class="fa-shelter" href="${escapeHtml(s.maps || "#")}" target="_blank" rel="noopener"><span><strong>${escapeHtml(s.name)}</strong><br>${escapeHtml(s.area)} · ${escapeHtml(s.status)}</span><span>MAP</span></a>`,
  ).join("");

  el.innerHTML = `
    <div class="fa-kicker">${t("floodAction")}</div>
    <div class="fa-verb">${escapeHtml(verb)}</div>
    <div class="fa-reason">${escapeHtml(fa.reason || "")}</div>
    <div class="fa-meta">
      <span>Confidence <strong>${escapeHtml(fa.confidence || "—")}</strong></span>
      <span>Padawan gauges <strong>${fa.padawanLive ?? 0}</strong> · Metro <strong>${fa.metroLive ?? 0}</strong></span>
      <span>Urgency score <strong>${fa.score ?? "—"}</strong>/100</span>
    </div>
    <ul class="fa-checklist">${checklist}</ul>
    <div class="fa-reality" data-verdict="${escapeHtml(reality.verdict || "CALM")}">
      What people are saying · <strong>${escapeHtml(reality.verdict || "CALM")}</strong>
      · ${reality.newsCount ?? 0} news hits · rivers measured as ${escapeHtml(String(reality.measuredBand || "—"))}
      ${headlines ? `<div style="margin-top:3px">${headlines}</div>` : ""}
    </div>
    <div class="fa-kicker">Call these numbers</div>
    <div class="fa-hotlines">${hotlines}</div>
    <div class="fa-kicker" style="margin-top:6px">Shelters / PPS</div>
    <div class="fa-shelters">${shelters}</div>
    <div class="fa-source">Source: <a href="${escapeHtml(fa.sourceUrl || "https://ihydro.sarawak.gov.my/")}" target="_blank" rel="noopener">${escapeHtml(fa.source || "DID Sarawak iHYDRO")}</a></div>`;
}

function renderHydroGauges(payload) {
  const el = $("hydroGaugePanel");
  if (!el) return;
  const ib = payload?.infobanjir;
  const stations = (ib?.stations || [])
    .filter((s) => s.focus === "padawan" || ["alert", "warning", "danger"].includes(s.band))
    .slice(0, 10);
  if (!stations.length) {
    el.innerHTML = `<div class="hg-head"><span class="hg-title">${t("hydroGauges")}</span></div><div class="hg-empty">No live river gauges in this cycle.</div>`;
    return;
  }
  const bandHuman = {
    normal: "OK",
    alert: "Watch",
    warning: "High",
    danger: "Critical",
    reference: "No live",
  };
  const rows = stations.map((s) => {
    const thr = s.thresholds?.alert != null ? `Alert from ${s.thresholds.alert} m` : (s.council || "");
    const level = s.waterLevelM != null ? `${s.waterLevelM} m` : "—";
    const brief = s.humanBrief
      ? `<div class="hg-brief">${escapeHtml(s.humanBrief)}</div>`
      : "";
    return `<div class="hg-row" data-station="${escapeHtml(s.id)}" data-band="${escapeHtml(s.band || "reference")}" role="button" tabindex="0">
      <div class="hg-main">
        <div class="hg-name">${escapeHtml(s.name)}<small>${escapeHtml(thr)}</small></div>
        ${brief}
      </div>
      <div class="hg-level">${level}</div>
      <div class="hg-band" data-band="${escapeHtml(s.band || "reference")}">${escapeHtml(bandHuman[s.band] || s.bandLabel || s.band || "—")}</div>
    </div>`;
  }).join("");
  el.innerHTML = `
    <div class="hg-head">
      <span class="hg-title">${t("hydroGauges")}</span>
      <span class="hg-live" data-status="${escapeHtml(ib?.status || "reference")}">${ib?.liveCount ?? 0}/${ib?.stationCount ?? 0} live</span>
    </div>
    ${rows}`;

  el.querySelectorAll(".hg-row[data-station]").forEach((row) => {
    row.addEventListener("click", () => {
      const id = row.getAttribute("data-station");
      const station = (ib?.stations || []).find((s) => s.id === id);
      if (station?.lat != null && station?.lon != null && state.map) {
        state.map.setView([station.lat, station.lon], 14);
      }
      row.classList.toggle("hg-open");
    });
  });
}

// Per-station rows: AMC class + p90 forecast load → band at 6h / 24h / 72h.
// When forecast.json hasn't been updated yet (status=absent/stale), shows an
// idle state rather than blank — the structure is clear even without live data.
function renderFloodMatrix(payload) {
  const el = $("floodMatrix");
  if (!el) return;

  const fm = payload?.floodMatrix;
  const rows = (fm?.rows || []).filter(Boolean);
  const basinAmc = fm?.basin_amc || payload?.forecast?.basin_amc || null;
  const status   = fm?.status || "absent";

  const BAND_LABELS = {
    normal:  "OK",
    watch:   "Damp",
    alert:   "Watch",
    warning: "Wet",
  };
  const BAND_TONES = {
    normal:  "good",
    watch:   "muted",
    alert:   "warn",
    warning: "alert",
  };
  const AMC_TONE = { I: "good", II: "muted", III: "alert" };
  const AMC_HUMAN = {
    I: "Dry ground — rain soaks in",
    II: "Moist ground — runoff rising",
    III: "Saturated — same rain floods worse",
  };

  const amcHtml = basinAmc
    ? `<div class="fm-amc"><span class="fm-amc-label">Ground wetness</span><span class="fm-amc-val" data-tone="${AMC_TONE[basinAmc.class] || "muted"}">${escapeHtml(AMC_HUMAN[basinAmc.class] || basinAmc.label || ("Class " + basinAmc.class))}</span><span class="fm-amc-mm">${basinAmc.total_mm14d} mm rain / 14d</span></div>`
    : "";

  if (status === "absent" || !rows.length) {
    el.innerHTML = `${amcHtml}<div class="fm-empty">Station flood outlook not loaded yet — numbers return after the next data refresh.</div>`;
    return;
  }

  const bandCell = (r) => `<span class="fm-band" data-tone="${BAND_TONES[r?.band] || "muted"}">${BAND_LABELS[r?.band] || "—"}</span>`;

  const rowsHtml = rows.map((row) => {
    const stressIcon = row.drainage_stress === "high"    ? '<span class="fm-stress" title="Hard surfaces dominate — drains may overflow">⚠</span>'
                      : row.drainage_stress === "moderate" ? '<span class="fm-stress fm-stress-mod" title="Moderate drainage stress">△</span>'
                      : "";
    const impFrac = row.impervious_fraction != null
      ? `<span class="fm-imp" title="Share of hard surface (satellite 2024)">${Math.round(row.impervious_fraction * 100)}% hard</span>`
      : "";
    const amcBadge = row.amc
      ? `<span class="fm-row-amc" data-tone="${AMC_TONE[row.amc.class] || "muted"}" title="${escapeHtml(row.amc.note || AMC_HUMAN[row.amc.class] || "")}">Wet ${escapeHtml(row.amc.class)}</span>`
      : "";
    return `<div class="fm-row" data-worst="${fm?.worst_band || "normal"}">
      <div class="fm-station">${stressIcon}${escapeHtml(row.name)}${amcBadge}${impFrac}</div>
      <div class="fm-cells">${bandCell(row.risk_6h)}${bandCell(row.risk_24h)}${bandCell(row.risk_72h)}</div>
    </div>`;
  }).join("");

  const staleNote = status === "stale"
    ? `<div class="fm-stale">↻ Outlook is stale — refresh after the next bake</div>` : "";

  el.innerHTML = `
    ${amcHtml}
    <div class="fm-header">
      <span class="fm-col-label">Station</span>
      <span class="fm-horizons"><span>6h</span><span>24h</span><span>72h</span></span>
    </div>
    ${rowsHtml}
    ${staleNote}`;
}

function renderCitizenReports(payload) {
  const el = $("citizenReports");
  if (!el) return;
  const cr = payload?.cityReports;
  if (!cr) {
    el.innerHTML = `<div class="cr-empty">No field data available.</div>`;
    return;
  }

  const URGENCY_TONE = { high: "alert", medium: "warn", low: "muted" };
  const STATUS_LABEL = { received: "NEW", in_progress: "OPEN", completed: "DONE" };
  const STATUS_TONE  = { received: "warn", in_progress: "warn", completed: "good" };

  const isDemo = cr.status === "demo";
  const badge = isDemo
    ? `<span class="cr-mode-badge" style="color:var(--soft)">DEMO</span>`
    : `<span class="cr-mode-badge" style="color:var(--cyan)">LIVE</span>`;

  const summary = `<div class="cr-summary">
    ${badge}
    <span class="cr-count"><span style="color:var(--amber)">${cr.open}</span> open</span>
    <span class="cr-count"><span style="color:var(--green)">${cr.resolved}</span> resolved</span>
  </div>`;

  const items = (cr.recent || []).slice(0, 5).map((r) => {
    const tone = URGENCY_TONE[r.urgency] || "muted";
    const statusTone = STATUS_TONE[r.status] || "muted";
    const ago = (() => {
      const ms = Date.now() - new Date(r.timestamp).getTime();
      const h = Math.floor(ms / 3600_000);
      return h < 1 ? `${Math.round(ms / 60_000)}m ago` : h < 24 ? `${h}h ago` : `${Math.floor(h/24)}d ago`;
    })();
    return `<div class="cr-row">
      <div class="cr-urgency-bar" data-tone="${tone}"></div>
      <div class="cr-body">
        <div class="cr-type">${escapeHtml(r.problem_type)}<span class="cr-status" data-tone="${statusTone}">${STATUS_LABEL[r.status] || r.status.toUpperCase()}</span></div>
        <div class="cr-loc">${escapeHtml(r.location_text || "—")}</div>
        <div class="cr-meta"><span class="cr-ticket">${escapeHtml(r.ticket)}</span><span class="cr-ago">${ago}</span></div>
      </div>
    </div>`;
  }).join("");

  el.innerHTML = summary + items;
}

function renderFloodForecast(floodForecast) {
  const el = $("floodForecast");
  if (!el) return;
  const isFallback = !floodForecast || floodForecast.status === "fallback";
  const today = isFallback
    ? (floodForecast?.todayCms ?? null)
    : (floodForecast.todayCms ?? (floodForecast.forecast?.[0]?.dischargeCms ?? null));
  const peak = floodForecast?.peakCms;
  const next4 = (floodForecast?.forecast ?? []).slice(1, 5);
  const warnPeak = peak != null && peak > 200;
  const reaches = (floodForecast?.reaches || []).map((r) =>
    `<div class="flood-day" title="${escapeHtml(r.label)}">
      <span class="flood-day-label">${escapeHtml((r.id || "").replace(/-/g, " ").slice(0, 10))}</span>
      <span class="flood-day-val">${r.todayCms ?? "—"}</span>
    </div>`,
  ).join("");
  el.innerHTML = `
    <div class="flood-station">${floodForecast?.station ?? "Sarawak River"}</div>
    <div class="flood-today">
      <span class="flood-value ${warnPeak ? "flood-peak-warn" : ""}">${today != null ? today : "—"}</span>
      <span class="flood-unit">m³/s now · peak ${peak ?? "—"} m³/s over the outlook</span>
    </div>
    <div class="flood-days">
      ${next4.map(d => {
        const label = d.date && d.date !== "—" ? new Date(d.date).toLocaleDateString("en-MY", { weekday: "short" }) : "—";
        const warn = d.dischargeCms != null && d.dischargeCms > 200;
        return `<div class="flood-day">
          <span class="flood-day-label">${label}</span>
          <span class="flood-day-val ${warn ? "warn" : ""}">${d.dischargeCms ?? "—"}</span>
        </div>`;
      }).join("")}
    </div>
    ${reaches ? `<div class="flood-days" style="margin-top:4px">${reaches}</div>` : ""}
    <div class="flood-model">${isFallback ? "Seasonal estimate · river model" : "River model via Open-Meteo / GloFAS"}</div>`;
}

function renderBypassTracker() {
  const el = $("bypassTracker");
  if (!el) return;
  const p = RIVER_BYPASS_PROJECT;
  el.innerHTML = `
    <div class="bypass-head">
      <span class="bypass-title">${p.name}</span>
      <span class="bypass-budget">${p.budget}</span>
    </div>
    <div class="bypass-phases">
      ${p.phases.map(ph => `
        <div class="bypass-phase">
          <div class="bypass-dot ${ph.status === "active" ? "active" : ""}"></div>
          <span class="bypass-phase-label">${ph.label}</span>
          <span class="bypass-period">${ph.period}</span>
        </div>`).join("")}
    </div>
    <div class="bypass-benefit">${p.benefit}</div>`;
}

function renderPosture(payload) {
  const el = $("postureBlock");
  if (!el) return;
  const posture = payload.summary?.posture || "stable";
  const headline = payload.summary?.headline || "Waiting for the next situation read.";
  const labels = {
    stable: "Calm",
    "steady-watch": "Keep watching",
    watch: "Stay alert",
    stretched: "Under pressure",
  };
  el.dataset.posture = posture;
  el.innerHTML = `
    <div class="posture-title">${labels[posture] || posture}</div>
    <div class="posture-detail">${headline}</div>`;
}

function renderOfficialPulse(payload) {
  const el = $("officialPulse");
  if (!el || !payload.govStats?.updatedAt) return;
  const gov = payload.govStats;
  const districts = Array.isArray(gov.districts) ? gov.districts.filter((d) => d.status === "live" && d.population != null) : [];
  const districtChips = districts.length
    ? `<div class="pulse-districts">${districts.map((d) =>
        `<span class="pulse-district"><span class="pd-name">${escapeHtml(d.name)}</span><strong>${num(d.population, 0)}</strong></span>`
      ).join("")}</div>` : "";

  el.innerHTML = `
    <div class="official-pulse-block">
      <div class="pulse-header">
        <span class="pulse-label">${t("officialPulse")} · ${gov.year}</span>
        <div class="pulse-indicator"></div>
      </div>
      <div class="pulse-metagrid">
        <div class="pulse-stat">
          <strong>${num(gov.latestSarawakPop, 0)}</strong>
          <span>People in Sarawak</span>
        </div>
        <div class="pulse-stat">
          <strong>${gov.datasetCount || 0}</strong>
          <span>Open datasets</span>
        </div>
      </div>
      ${districtChips}
    </div>`;
}

// --- MPP governance: councillor roster + locality explorer -------------------
// Ward code ↔ locality-code-prefix join lives here. Clicks flow through
// state.activeWard so councillor chips, the locality list, and the ward polygon
// on the map all react to the same signal.

const WARD_CODE_ORDER = ["A", "B", "D", "FG", "H", "I", "JL", "K", "M", "NPQ"];
const WARD_COLOR_MAP = {
  A: "#a78bfa", B: "#c084fc", D: "#d946ef", FG: "#f472b6", H: "#fb7185",
  I: "#fb923c", JL: "#fbbf24", K: "#84cc16", M: "#22d3ee", NPQ: "#38bdf8",
};

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[c]));
}

function renderCouncillorCard(person, { role, coverage, accentColor } = {}) {
  const color = accentColor || "var(--cyan)";
  const badge = role ? `<div class="councillor-role">${escapeHtml(role)}</div>` : "";
  const scope = coverage ? `<div class="councillor-scope">${escapeHtml(coverage)}</div>` : "";
  const phoneClean = (person.phone || "").replace(/[^0-9+]/g, "");
  return `
    <article class="councillor-card" style="border-left-color:${color}">
      ${badge}
      <div class="councillor-name">${escapeHtml([person.title, person.name].filter(Boolean).join(" "))}</div>
      ${scope}
      <a class="councillor-phone" href="tel:${phoneClean}">${escapeHtml(person.phone || "—")}</a>
    </article>`;
}

function renderMppCouncillors(payload) {
  const target = $("councillorPanel");
  if (!target) return;
  const data = payload.mppCouncillors;
  if (!data || !data.wards?.length) {
    target.innerHTML = `<div class="panel-empty">Councillor roster unavailable.</div>`;
    return;
  }
  const wardsByCode = new Map(data.wards.map(w => [w.code, w]));
  const localityCounts = payload.mppLocalities?.breakdowns?.byWard || {};

  const chairmanHtml = data.chairman ? renderCouncillorCard(data.chairman, {
    role: "Chairman",
    coverage: data.chairman.coverage || "All zones",
    accentColor: "var(--cyan)",
  }) : "";
  const deputyHtml = data.deputy ? renderCouncillorCard(data.deputy, {
    role: "Deputy",
    coverage: data.deputy.coverage || "All zones",
    accentColor: "var(--cyan)",
  }) : "";

  const wardChips = WARD_CODE_ORDER.map(code => {
    const w = wardsByCode.get(code);
    if (!w) return "";
    const localityCount = localityCounts[code] ?? 0;
    const color = WARD_COLOR_MAP[code] || "#a78bfa";
    const active = state.activeWard === code ? "true" : "false";
    return `
      <button class="ward-chip" data-ward="${code}" data-active="${active}" style="--ward-color:${color}">
        <div class="ward-chip-code">${escapeHtml(code)}</div>
        <div class="ward-chip-area">${escapeHtml(w.area)}</div>
        <div class="ward-chip-stats">
          <span>${w.councillorCount} councillor${w.councillorCount === 1 ? "" : "s"}</span>
          <span>·</span>
          <span>${localityCount} localit${localityCount === 1 ? "y" : "ies"}</span>
        </div>
      </button>`;
  }).filter(Boolean).join("");

  // Detail panel for the active ward (or a hint if none selected).
  const active = state.activeWard && wardsByCode.get(state.activeWard);
  const detailHtml = active ? `
    <div class="ward-detail" data-ward="${escapeHtml(active.code)}" style="border-left-color:${WARD_COLOR_MAP[active.code]}">
      <div class="ward-detail-head">
        <div class="ward-detail-label">${escapeHtml(active.label)} · ${escapeHtml(active.code)}</div>
        <div class="ward-detail-area">${escapeHtml(active.area)}</div>
      </div>
      <div class="ward-detail-roster">
        ${active.councillors.map(c => renderCouncillorCard(c, { accentColor: WARD_COLOR_MAP[active.code] })).join("")}
      </div>
    </div>
  ` : `<div class="ward-hint">Tap a ward to see its councillors and filter localities.</div>`;

  target.innerHTML = `
    <div class="councillor-leaders">${chairmanHtml}${deputyHtml}</div>
    <div class="ward-chip-grid">${wardChips}</div>
    ${detailHtml}
    <div class="councillor-term">Term ${escapeHtml(data.term || "2025–2028")} · ${data.totals?.councillors ?? 0} councillors · ${data.totals?.wards ?? 0} wards</div>
  `;

  // Wire up ward-chip clicks.
  target.querySelectorAll(".ward-chip").forEach(btn => {
    btn.addEventListener("click", () => {
      const code = btn.dataset.ward;
      setActiveWard(state.activeWard === code ? null : code);
    });
  });
}

// --- Locality Explorer -------------------------------------------------------

const LOCALITY_PAGE_SIZE = 60;

function localityConstituencyBadge(item) {
  const first = item.constituency?.parsed?.[0];
  if (!first?.stateCode) return "—";
  const badge = `${first.stateCode} ${first.stateName}`;
  return item.constituency.compound ? `${badge} · +${item.constituency.parsed.length - 1}` : badge;
}

function filterLocalities(items, f) {
  const q = (f.search || "").trim().toUpperCase();
  return items.filter(it => {
    if (f.ward && it.wardCode !== f.ward) return false;
    if (f.stateCode) {
      const codes = (it.constituency?.parsed || []).map(p => p.stateCode);
      if (!codes.includes(f.stateCode)) return false;
    }
    if (f.parliamentCode) {
      const codes = (it.constituency?.parsed || []).map(p => p.parliamentCode);
      if (!codes.includes(f.parliamentCode)) return false;
    }
    if (f.propertyType === "residential" && !(it.residential > 0)) return false;
    if (f.propertyType === "commercial"  && !(it.commercial  > 0)) return false;
    if (f.propertyType === "industrial"  && !(it.industrial  > 0)) return false;
    if (f.propertyType === "exempted"    && !(it.exempted    > 0)) return false;
    if (q) {
      const hay = `${it.code} ${it.name}`.toUpperCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderLocalityKpis(totals) {
  const target = $("localityKpis");
  if (!target) return;
  // Original 6-tile grid — kept for full mode (data-view="full") via CSS gate hiding via .locality-kpis.
  const tile = (label, value, unit = "") => `
    <article class="metric-card" data-tone="neutral">
      <div class="metric-label">${escapeHtml(label)}</div>
      <div class="metric-value">${num(value, 0)}<span class="metric-unit">${escapeHtml(unit)}</span></div>
    </article>`;
  target.innerHTML = [
    tile(t("totalLocalities"), totals.localities),
    tile(t("residential"),     totals.residential),
    tile(t("commercial"),      totals.commercial),
    tile(t("industrial"),      totals.industrial),
    tile(t("stateSeats"),      totals.stateConstituencies),
    tile(t("parliamentSeats"), totals.parliamentConstituencies),
  ].join("");
}

// Secretary mode replacement — single dense summary line above the list.
function renderLocalitySummary(payload) {
  const target = $("localityList")?.parentElement?.querySelector(".locality-summary")
    || (() => {
      const el = document.createElement("div");
      el.className = "locality-summary";
      const list = $("localityList");
      if (list) list.parentElement.insertBefore(el, list);
      return el;
    })();
  const totals = payload?.mppLocalities?.totals || {};
  const wards = payload?.mppLocalities?.breakdowns?.byWard || {};
  const wardCount = Object.values(wards).filter(c => (typeof c === "object" ? (c?.count ?? 0) : c) > 0).length;
  target.innerHTML = `
    <span><span class="locality-num">${num(totals.localities ?? 0, 0)}</span> ${t("totalLocalities").toLowerCase()}</span>
    <span><span class="locality-num">${wardCount}</span> ${(t("wards") || "wards")}</span>
    <span><span class="locality-num">${num(totals.residential ?? 0, 0)}</span> ${t("residential").toLowerCase()}</span>
    <span><span class="locality-num">${num(totals.commercial ?? 0, 0)}</span> ${t("commercial").toLowerCase()}</span>
    <span><span class="locality-num">${num(totals.industrial ?? 0, 0)}</span> ${t("industrial").toLowerCase()}</span>
    <span><span class="locality-num">${totals.stateConstituencies ?? 0}</span> state · <span class="locality-num">${totals.parliamentConstituencies ?? 0}</span> parl seats</span>`;
}

function renderLocalityFilters(payload) {
  const target = $("localityFilters");
  if (!target) return;
  const f = state.localityFilter;
  const wards = WARD_CODE_ORDER.filter(c => (payload.mppLocalities?.breakdowns?.byWard?.[c] ?? 0) > 0);
  const stateSeats = payload.mppLocalities?.breakdowns?.byState || {};
  const parlSeats  = payload.mppLocalities?.breakdowns?.byParliament || {};

  const wardOpts = `<option value="">${t("allWards")}</option>` +
    wards.map(c => `<option value="${c}" ${f.ward === c ? "selected" : ""}>${c}</option>`).join("");
  const stateOpts = `<option value="">${t("allConstituencies")} (${t("stateConstituency")})</option>` +
    Object.entries(stateSeats).sort().map(([code, v]) =>
      `<option value="${code}" ${f.stateCode === code ? "selected" : ""}>${code} ${escapeHtml(v.name)} (${v.count})</option>`
    ).join("");
  const parlOpts = `<option value="">${t("allConstituencies")} (${t("parliamentConstituency")})</option>` +
    Object.entries(parlSeats).sort().map(([code, v]) =>
      `<option value="${code}" ${f.parliamentCode === code ? "selected" : ""}>${code} ${escapeHtml(v.name)} (${v.count})</option>`
    ).join("");
  const propOpts = [
    ["", t("allPropertyTypes")],
    ["residential", t("residential")],
    ["commercial",  t("commercial")],
    ["industrial",  t("industrial")],
    ["exempted",    t("exempted")],
  ].map(([v, label]) => `<option value="${v}" ${f.propertyType === v ? "selected" : ""}>${label}</option>`).join("");

  target.innerHTML = `
    <select class="locality-filter" data-filter="ward">${wardOpts}</select>
    <select class="locality-filter" data-filter="stateCode">${stateOpts}</select>
    <select class="locality-filter" data-filter="parliamentCode">${parlOpts}</select>
    <select class="locality-filter" data-filter="propertyType">${propOpts}</select>
    <input type="search" class="locality-search" placeholder="${t("searchLocality")}" value="${escapeHtml(f.search || "")}" data-filter="search" />
    <button type="button" class="locality-reset" data-action="reset-locality-filter">Reset</button>
  `;
  target.querySelectorAll("[data-filter]").forEach(el => {
    const evt = el.tagName === "SELECT" ? "change" : "input";
    el.addEventListener(evt, () => {
      const key = el.dataset.filter;
      state.localityFilter = { ...state.localityFilter, [key]: el.value || null };
      if (key === "ward") state.activeWard = el.value || null;
      renderMppLocalities(state.payload);
      renderMppCouncillors(state.payload);
      if (state.activeWard) highlightWard(state.activeWard);
    });
  });
  target.querySelector("[data-action=reset-locality-filter]")?.addEventListener("click", () => {
    state.localityFilter = { ward: null, stateCode: null, parliamentCode: null, propertyType: null, search: "" };
    state.activeWard = null;
    renderMppLocalities(state.payload);
    renderMppCouncillors(state.payload);
    clearWardHighlight();
  });
}

function renderLocalityList(items) {
  const target = $("localityList");
  const statusEl = $("localityStatus");
  if (!target) return;
  const visible = items.slice(0, LOCALITY_PAGE_SIZE);
  if (statusEl) {
    statusEl.textContent = `${t("showingResults")} ${visible.length} ${t("of")} ${num(items.length)}`;
  }
  if (!visible.length) {
    target.innerHTML = `<div class="panel-empty">No localities match the current filters.</div>`;
    return;
  }

  const renderRow = (it) => {
    const color = WARD_COLOR_MAP[it.wardCode] || "#8aa2c8";
    return `
      <article class="locality-row" data-ward="${escapeHtml(it.wardCode || "")}" style="border-left-color:${color}">
        <span class="locality-code">${escapeHtml(it.code)}</span>
        <span class="locality-name">${escapeHtml(it.name)}</span>
        <span class="locality-const">${escapeHtml(localityConstituencyBadge(it))}</span>
        <span class="locality-counts">
          <span class="c-res" title="Residential">${num(it.residential)}R</span>
          <span class="c-com" title="Commercial">${num(it.commercial)}C</span>
          <span class="c-ind" title="Industrial">${num(it.industrial)}I</span>
        </span>
      </article>`;
  };

  if (isPadawanScope()) {
    // Group by ward — Secretary Goh's ask: "put the MPP Ward info together".
    const grouped = new Map();
    for (const it of visible) {
      const key = it.wardCode || "—";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key).push(it);
    }
    const ordered = WARD_CODE_ORDER.filter(c => grouped.has(c)).concat(
      [...grouped.keys()].filter(c => !WARD_CODE_ORDER.includes(c))
    );
    target.innerHTML = ordered.map(wardCode => {
      const rows = grouped.get(wardCode);
      const color = WARD_COLOR_MAP[wardCode] || "#8aa2c8";
      return `
        <section class="locality-ward-group">
          <header class="locality-ward-header" data-ward="${escapeHtml(wardCode)}" style="border-left:3px solid ${color}; padding-left:9px;">
            <span>WARD ${escapeHtml(wardCode)}</span>
            <span class="ward-locality-count">${rows.length} ${rows.length === 1 ? "locality" : "localities"}</span>
          </header>
          ${rows.map(renderRow).join("")}
        </section>`;
    }).join("");
  } else {
    target.innerHTML = visible.map(renderRow).join("");
  }

  target.querySelectorAll(".locality-row").forEach(row => {
    row.addEventListener("click", () => {
      const w = row.dataset.ward;
      if (w) setActiveWard(w);
    });
  });
  target.querySelectorAll(".locality-ward-header").forEach(hdr => {
    hdr.addEventListener("click", () => {
      const w = hdr.dataset.ward;
      if (w) setActiveWard(state.activeWard === w ? null : w);
    });
  });
}

function renderMppLocalities(payload) {
  const data = payload?.mppLocalities;
  if (!data) return;
  if (!state.localityFilter) {
    state.localityFilter = { ward: null, stateCode: null, parliamentCode: null, propertyType: null, search: "" };
  }
  if (state.activeWard && state.localityFilter.ward !== state.activeWard) {
    state.localityFilter = { ...state.localityFilter, ward: state.activeWard };
  }
  if (!state.activeWard && state.localityFilter.ward) {
    // Keep explicit filter even without activeWard (e.g. user picked dropdown).
  }
  renderLocalityKpis(data.totals || {});
  if (isPadawanScope()) renderLocalitySummary(payload);
  renderLocalityFilters(payload);
  const filtered = filterLocalities(data.items || [], state.localityFilter);
  renderLocalityList(filtered);
}

// --- Shared cross-panel state: activeWard drives map + councillors + localities

function setActiveWard(code) {
  state.activeWard = code || null;
  state.localityFilter = {
    ...(state.localityFilter || { ward: null, stateCode: null, parliamentCode: null, propertyType: null, search: "" }),
    ward: code || null,
  };
  renderMppCouncillors(state.payload);
  renderMppLocalities(state.payload);
  renderWardBrief(code, state.payload);
  if (code) {
    highlightWard(code);
    if (typeof history !== "undefined" && history.replaceState) {
      history.replaceState(null, "", `#ward=${code}`);
    }
  } else {
    clearWardHighlight();
    if (typeof history !== "undefined" && history.replaceState && location.hash.startsWith("#ward=")) {
      history.replaceState(null, "", location.pathname + location.search);
    }
  }
}

// Pass 2.4: Per-ward briefing — read derived stats from the existing payload + mpp_wards features.
function renderWardBrief(wardCode, payload) {
  const el = $("wardBrief");
  if (!el) return;
  if (!wardCode) {
    el.dataset.active = "false";
    el.hidden = true;
    el.innerHTML = "";
    return;
  }
  const feat = (state.wardFeatures || []).find(f => f?.properties?.wardCode === wardCode);
  const props = feat?.properties || {};
  const color = props.color || WARD_COLOR_MAP[wardCode] || "#a78bfa";
  const area = props.area || "";
  const wardLabel = props.wardLabel || "";

  // Localities in this ward (from existing mppLocalities.items[].wardCode).
  const localities = (payload?.mppLocalities?.items || []).filter(it => it.wardCode === wardCode);
  const totalLoc = localities.length;
  const totals = localities.reduce((acc, it) => {
    acc.residential += it.residential || 0;
    acc.commercial  += it.commercial || 0;
    acc.industrial  += it.industrial || 0;
    return acc;
  }, { residential: 0, commercial: 0, industrial: 0 });

  // Majority constituency (state + parliament) by mode.
  const stateCount = {}, parlCount = {};
  for (const it of localities) {
    const c = it.constituency?.parsed?.[0];
    if (!c) continue;
    if (c.stateCode) stateCount[c.stateCode + " " + (c.stateName || "")] = (stateCount[c.stateCode + " " + (c.stateName || "")] || 0) + 1;
    if (c.parliamentCode) parlCount[c.parliamentCode + " " + (c.parliamentName || "")] = (parlCount[c.parliamentCode + " " + (c.parliamentName || "")] || 0) + 1;
  }
  const topEntry = (table) => Object.entries(table).sort((a, b) => b[1] - a[1])[0]?.[0] || "—";
  const stateSeat = topEntry(stateCount);
  const parlSeat  = topEntry(parlCount);

  // Councillor (already keyed by ward code in payload).
  const councillor = (payload?.mppCouncillors?.wards || []).find(w => w.code === wardCode);
  const councillorCard = councillor?.councillors?.[0];
  const councillorLine = councillorCard
    ? `${escapeHtml(councillorCard.name || councillorCard.title || "—")} · <a class="ward-brief-phone" href="tel:${(councillorCard.phone || "").replace(/[^0-9+]/g, "")}">${escapeHtml(councillorCard.phone || "—")}</a>`
    : "—";

  // Hydro stations whose snapped catchment overlaps this ward (best-effort heuristic).
  const hydroNear = (payload?.infobanjir?.stations || []).filter(s => {
    if (!feat?.geometry) return false;
    if (s.lat == null || s.lon == null) return false;
    return pointInRing([s.lon, s.lat], feat.geometry);
  });
  const hydroSummary = hydroNear.length
    ? hydroNear.slice(0, 2).map(s => `${escapeHtml(s.name)} ${s.waterLevelM != null ? s.waterLevelM + "m" : ""} (${s.bandLabel || s.band})`).join(" · ")
    : `none in ward`;

  // Flood-zone overlap (centroid in ward polygon).
  const floodZones = state.floodZoneFeatures || [];
  const floodHits = floodZones.filter(f => {
    const c = f?.geometry?.coordinates?.[0]?.[0];
    if (!c || !feat?.geometry) return false;
    return pointInRing(c, feat.geometry);
  });

  // Tension Index — illustrative until a real sentiment / 311 feed is wired in.
  const tension = WARD_TENSION[wardCode] || { score: 0, topIssue: "No data", trend: "stable", tone: "muted" };
  const tensionGlyph = tension.trend === "rising" ? "▲" : tension.trend === "falling" ? "▼" : "—";
  const tensionSourceBadge = WARD_TENSION_ILLUSTRATIVE
    ? `<span class="ward-brief-badge ward-brief-badge-illust" title="Hand-curated demo value, not a measured signal — see data.js WARD_TENSION_ILLUSTRATIVE">ILLUSTRATIVE</span>`
    : "";
  const tensionLine = `<span class="glyph" data-tone="${tension.tone}">${tensionGlyph}</span> <strong style="color: var(--${tension.tone === 'alert' ? 'red' : tension.tone === 'watch' ? 'amber' : 'cyan'})">${tension.score}/100</strong> · ${escapeHtml(tension.topIssue)}${tensionSourceBadge}`;

  el.hidden = false;
  el.dataset.active = "true";
  el.innerHTML = `
    <div class="ward-brief-head">
      <div class="ward-brief-title" style="border-left:3px solid ${color}; padding-left:8px;">
        <span class="ward-brief-code">WARD ${escapeHtml(wardCode)}</span>
        <span class="ward-brief-area">${escapeHtml((wardLabel || "") + (area ? " · " + area : ""))}</span>
      </div>
      <button type="button" class="ward-brief-close" aria-label="Close ward brief">✕</button>
    </div>
    <div class="ward-brief-stats">
      <div class="ward-brief-stat"><strong>${totalLoc}</strong>localities</div>
      <div class="ward-brief-stat"><strong>${totals.residential.toLocaleString()}</strong>residential</div>
      <div class="ward-brief-stat"><strong>${totals.commercial.toLocaleString()}</strong>commercial</div>
    </div>
    <div class="ward-brief-row"><span class="ward-brief-label">Tension Index</span>${tensionLine}</div>
    <div class="ward-brief-row"><span class="ward-brief-label">State seat</span>${escapeHtml(stateSeat)}</div>
    <div class="ward-brief-row"><span class="ward-brief-label">Parliament</span>${escapeHtml(parlSeat)}</div>
    <div class="ward-brief-row"><span class="ward-brief-label">Councillor</span>${councillorLine}</div>
    <div class="ward-brief-section">
      <div class="ward-brief-row"><span class="ward-brief-label">Hydro</span>${hydroSummary}</div>
      <div class="ward-brief-row"><span class="ward-brief-label">Flood zones</span>${floodHits.length} historical hotspot${floodHits.length === 1 ? "" : "s"} on record</div>
    </div>
    ${renderWardProjectsHTML(wardCode)}`;

  el.querySelector(".ward-brief-close")?.addEventListener("click", () => setActiveWard(null));
}

// Project ledger for the active ward — RM totals, status mix, line items.
// Drawn from MPP_WARD_PROJECTS in data.js (hand-encoded, real Padawan tender
// + GCAP shape). Renders as a self-contained HTML block to be injected into
// the ward-brief.
function renderWardProjectsHTML(wardCode) {
  const projects = MPP_WARD_PROJECTS[wardCode] || [];
  if (!projects.length) {
    return `<div class="ward-brief-section ward-projects" data-empty="true">
      <div class="ward-projects-head">
        <span class="ward-brief-label">Ledger</span>
        <span class="ward-projects-empty">no entries on file</span>
      </div>
    </div>`;
  }
  const totalRmK = projects.reduce((s, p) => s + (p.rmK || 0), 0);
  const inProg = projects.filter(p => p.status === "in-progress").length;
  const queued = projects.filter(p => p.status === "queued").length;
  const done   = projects.filter(p => p.status === "complete").length;
  const formatRm = (k) => k >= 1000 ? `RM ${(k/1000).toFixed(2)}M` : `RM ${k}k`;
  const statusGlyphMap = { "in-progress": "◆", "queued": "◇", "complete": "●" };
  const rows = projects.map(p => {
    const rm = formatRm(p.rmK || 0);
    const pct = p.pct ?? 0;
    const sg = statusGlyphMap[p.status] || "◇";
    return `
      <article class="ward-project" data-status="${p.status}" data-cat="${p.category}">
        <div class="wp-row1">
          <span class="wp-status">${sg}</span>
          <span class="wp-cat">${p.category.toUpperCase()}</span>
          <span class="wp-title">${escapeHtml(p.title)}</span>
          <span class="wp-rm">${rm}</span>
        </div>
        <div class="wp-row2">
          <div class="wp-bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100">
            <div class="wp-bar-fill" style="width:${pct}%"></div>
            <span class="wp-pct">${pct}%</span>
          </div>
          <span class="wp-contractor">${escapeHtml(p.contractor || "—")}</span>
        </div>
        ${p.note ? `<div class="wp-note">${escapeHtml(p.note)}</div>` : ""}
      </article>`;
  }).join("");
  return `
    <div class="ward-brief-section ward-projects">
      <div class="ward-projects-head">
        <span class="ward-brief-label">Ledger // ${projects.length} active</span>
        <span class="ward-projects-totals">
          ${formatRm(totalRmK)} ·
          <span data-tone="ok">${done}●</span>
          <span data-tone="warn">${inProg}◆</span>
          <span data-tone="muted">${queued}◇</span>
        </span>
      </div>
      <div class="ward-projects-list">${rows}</div>
    </div>`;
}

// Ray-casting point-in-polygon. coords in [lon,lat]; geometry is GeoJSON Polygon.
function pointInRing(pt, geometry) {
  if (!geometry || !pt) return false;
  const rings = geometry.type === "Polygon" ? [geometry.coordinates[0]]
              : geometry.type === "MultiPolygon" ? geometry.coordinates.map(p => p[0])
              : null;
  if (!rings) return false;
  for (const ring of rings) {
    let inside = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const xi = ring[i][0], yi = ring[i][1];
      const xj = ring[j][0], yj = ring[j][1];
      const intersect = ((yi > pt[1]) !== (yj > pt[1])) &&
        (pt[0] < (xj - xi) * (pt[1] - yi) / ((yj - yi) || 1e-12) + xi);
      if (intersect) inside = !inside;
    }
    if (inside) return true;
  }
  return false;
}

function clearWardHighlight() {
  if (state.wardHighlightLayer && state.map) {
    state.map.removeLayer(state.wardHighlightLayer);
  }
  state.wardHighlightLayer = null;
}

function highlightWard(code) {
  if (!state.map || !window.L || !state.wardFeatures) return;
  const feat = state.wardFeatures.find(f => f?.properties?.wardCode === code);
  if (!feat) return;
  clearWardHighlight();
  const color = feat.properties.color || WARD_COLOR_MAP[code] || "#a78bfa";
  const layer = window.L.geoJSON(feat, {
    style: { color, weight: 3, opacity: 1, fillColor: color, fillOpacity: 0.28, dashArray: "4 4" },
  }).addTo(state.map);
  state.wardHighlightLayer = layer;
  try { state.map.fitBounds(layer.getBounds().pad(0.2), { maxZoom: 14 }); } catch (_) { /* ignore */ }
}

async function loadWardFeatures() {
  if (state.wardFeatures?.length) return;
  const fc = await fetchLayer("mpp_wards");
  state.wardFeatures = fc?.features || [];
  if (!state.wardFeatures.length) console.warn("Ward boundaries unavailable");
}

// Pass 2.4: load flood_zones features so the per-ward brief can count overlaps.
async function loadFloodZoneFeatures() {
  if (state.floodZoneFeatures?.length) return;
  try {
    const fc = await fetchLayer("flood_zones");
    state.floodZoneFeatures = fc?.features || [];
  } catch (_) {
    state.floodZoneFeatures = [];
  }
}

// === IOC 3.0 Command Brief renderers ===================================
// Four computed views that surface what the payload already knows but the
// panel grid never told: the verdict, the rain→river cascade, the
// hazard×exposure ward join, and the growth-vs-drainage story.

const BAND_TONE_ORDER = { danger: 0, warning: 1, alert: 2, normal: 3, reference: 4 };

// Zone 1 — one sentence + chips. The Secretary reads the verb, then decides
// whether to read anything else.
function renderVerdict(payload) {
  const el = $("verdictBar");
  if (!el) return;
  const fa = payload.floodAction || {};
  const met = payload.metWarnings || {};
  const ib = payload.infobanjir || {};
  const aqiMetric = (payload.metrics || []).find(m => m.id === "aqi");
  const aqi = aqiMetric ? Math.round(aqiMetric.value) : null;

  // Strip band for human eyes: only prepare/act go red. "watch" is amber —
  // painting watch as alert made "Keep watching" look like a flood emergency.
  const floodAct = fa.band === "act";
  const floodPrep = fa.band === "prepare";
  const floodWatch = fa.band === "watch";
  const airBad = aqi != null && aqi > 100;
  const band = floodAct ? "alert" : (floodPrep || floodWatch || met.activeCount > 0 || airBad) ? "watch" : "normal";
  el.dataset.band = band;

  let verb = state.lang === "ms" ? (fa.verbBm || fa.verb) : state.lang === "zh" ? (fa.verbZh || fa.verb) : fa.verb;
  // When flood is calm but weather/air drives the amber strip, name that driver
  // in plain words — never leave a soft flood verb under a hard red chip set.
  if (!floodAct && !floodPrep && band === "watch") {
    verb = met.activeCount > 0
      ? (state.lang === "ms" ? `Pantau — ${met.activeCount} amaran cuaca` : state.lang === "zh" ? `留意 — ${met.activeCount} 则天气警报` : `Keep watching — ${met.activeCount} weather warning${met.activeCount > 1 ? "s" : ""}`)
      : (state.lang === "ms" ? `Pantau — udara AQI ${aqi}` : state.lang === "zh" ? `留意 — 空气 AQI ${aqi}` : `Keep watching — air AQI ${aqi}`);
  }
  const chips = [];
  const riverLabel = (ib.highestBandLabel || "normal").toLowerCase();
  const riverOk = !["alert", "warning", "danger"].includes(String(ib.highestBand || "").toLowerCase());
  chips.push(`<span class="verdict-chip" data-tone="${riverOk ? "ok" : "alert"}">Rivers ${riverOk ? "OK" : riverLabel} · ${ib.padawanLiveCount ?? ib.liveCount ?? 0} gauges</span>`);
  chips.push(`<span class="verdict-chip" data-tone="${met.activeCount > 0 ? "alert" : "ok"}">${met.activeCount > 0 ? `${met.activeCount} weather warning${met.activeCount > 1 ? "s" : ""}` : "Weather clear"}</span>`);
  if (aqi != null) chips.push(`<span class="verdict-chip" data-tone="${aqi > 150 ? "alert" : aqi > 100 ? "warn" : "ok"}">Air ${aqi > 100 ? "unhealthy" : "OK"} · ${aqi}</span>`);
  const ff = payload.floodForecast;
  if (ff?.todayCms != null && ff?.peakCms != null) {
    const rising = ff.peakCms > ff.todayCms * 1.15;
    chips.push(`<span class="verdict-chip" data-tone="${rising ? "warn" : "ok"}">River flow ${Math.round(ff.todayCms)}→${Math.round(ff.peakCms)} m³/s</span>`);
  }

  const why = [fa.reason, payload.summary?.headline].filter(Boolean).join(" · ");
  el.innerHTML = `
    <span class="verdict-verb">${escapeHtml(verb || payload.summary?.posture || "—")}</span>
    <div class="verdict-why">${escapeHtml(why)}</div>
    <div class="verdict-chips">${chips.join("")}</div>`;
}

// Zone 2 — the causal chain. Rain lands in a catchment, the gauge sees it
// lag_h hours later; dry soil (AMC I) absorbs, saturated soil (III) sheds.
// All numbers are already computed server-side (TimesFM + AMC + risk bands).
function renderCascade(payload) {
  const el = $("cascadePanel");
  if (!el) return;
  const fc = payload.forecast;
  if (!fc || fc.status === "offline" || !fc.series?.river_discharge) {
    el.innerHTML = `<div class="cascade-head"><div class="cascade-title">Rain → River Cascade</div><div class="cascade-explain">Forecast pipeline offline — cascade unavailable this cycle.</div></div>`;
    return;
  }
  const rd = fc.series.river_discharge;
  const median = rd.median || [];
  const p10 = rd.quantiles?.p10 || [];
  const p90 = rd.quantiles?.p90 || [];
  const n = median.length;

  // Fan chart: p10–p90 envelope + median. viewBox 300×110, 5px margins.
  let fanSvg = "";
  if (n > 1 && p10.length === n && p90.length === n) {
    const maxV = Math.max(...p90) * 1.05;
    const X = (i) => (i / (n - 1)) * 290 + 5;
    const Y = (v) => 103 - (v / maxV) * 96;
    const path = (arr) => arr.map((v, i) => `${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    const envelope = path(p90) + " " + p10.slice().reverse().map((v, i) => `${X(n - 1 - i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
    fanSvg = `
      <div class="cascade-fan">
        <svg viewBox="0 0 300 110" preserveAspectRatio="none" role="img" aria-label="River discharge 14-day forecast fan">
          <polygon points="${envelope}" fill="rgba(0,243,255,0.10)" stroke="none"/>
          <polyline points="${path(median)}" fill="none" stroke="var(--cyan)" stroke-width="1.5"/>
          <line x1="5" y1="103" x2="295" y2="103" stroke="var(--line)" stroke-width="1"/>
        </svg>
      </div>
      <div class="cascade-fan-caption">
        <span>TODAY ${Math.round(median[0])} m³/s</span>
        <span>worst case (p90) peaks ${Math.round(Math.max(...p90))} m³/s · day ${p90.indexOf(Math.max(...p90)) + 1}</span>
        <span>+${n} DAYS</span>
      </div>`;
  }

  const stations = Object.values(fc.stations || {}).sort((a, b) => (a.lag_h ?? 99) - (b.lag_h ?? 99));
  const bandShort = { normal: "OK", alert: "ALERT", warning: "WARN", danger: "DANGER" };
  const bandCell = (r) => `<span class="cascade-band" data-tone="${r?.band || "na"}">${bandShort[r?.band] || "—"}</span>`;
  const rows = stations.map(s => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td class="c-lag">${s.lag_h === 0 ? "now" : "+" + s.lag_h + "h"}</td>
      <td class="c-muted">${escapeHtml(s.amc?.label || "—")} ${s.amc?.class ? "(" + s.amc.class + ")" : ""}</td>
      <td class="c-muted">${s.cumulative_p90_mm?.day4 != null ? s.cumulative_p90_mm.day4 + " mm" : "—"}</td>
      <td>${bandCell(s.risk_6h)}</td>
      <td>${bandCell(s.risk_24h)}</td>
      <td>${bandCell(s.risk_72h)}</td>
    </tr>`).join("");

  el.innerHTML = `
    <div class="cascade-head">
      <div class="cascade-title">Rain → River Cascade · TimesFM 14-day</div>
      <div class="cascade-explain">Rain that falls in each catchment reaches its gauge after the lag shown. Dry soil (class I) absorbs the first storms; saturated soil (class III) sends them straight to the river. Risk bands are worst-case (p90) rainfall load vs catchment capacity.</div>
    </div>
    ${fanSvg}
    <table class="cascade-table">
      <thead><tr><th>Catchment</th><th>Lag</th><th>Soil</th><th>Rain p90 4d</th><th>6h</th><th>24h</th><th>72h</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="7" class="c-muted">No per-station forecasts this cycle.</td></tr>`}</tbody>
    </table>`;
}

// Zone 3 — hazard × exposure. Worst gauge inside each ward (point-in-polygon
// against the official MPP ward boundaries) beside the rated holdings that
// sit behind it, and the councillor who owns the response.
function renderWardRisk(payload) {
  const el = $("wardRiskPanel");
  if (!el) return;
  const wards = payload.mppCouncillors?.wards || [];
  const localities = payload.mppLocalities?.items || [];
  if (!wards.length || !localities.length) {
    el.innerHTML = `<div class="ward-risk-note">Ward roster or locality register unavailable this cycle.</div>`;
    return;
  }

  // Exposure: rated holdings per ward code from the 525-locality register.
  const holdings = {};
  for (const loc of localities) {
    const w = loc.wardCode || "X";
    holdings[w] = holdings[w] || { props: 0, locs: 0 };
    holdings[w].props += (loc.residential || 0) + (loc.commercial || 0) + (loc.industrial || 0);
    holdings[w].locs += 1;
  }

  // Hazard: worst live gauge band inside each ward polygon (when boundaries
  // are cached — boot() re-renders this panel after they load).
  const gaugeByWard = {};
  const feats = state.wardFeatures || [];
  if (feats.length) {
    const stations = (payload.infobanjir?.stations || []).filter(s => s.lat && s.lon && s.band !== "reference");
    for (const s of stations) {
      const feat = feats.find(f => pointInRing([s.lon, s.lat], f.geometry));
      const code = feat?.properties?.wardCode;
      if (!code) continue;
      const cur = gaugeByWard[code];
      if (!cur || (BAND_TONE_ORDER[s.band] ?? 9) < (BAND_TONE_ORDER[cur.band] ?? 9)) {
        gaugeByWard[code] = { band: s.band || "na", name: s.name };
      }
    }
  }

  const rows = wards.map(w => {
    const code = w.code;
    const h = holdings[code] || { props: 0, locs: 0 };
    const g = gaugeByWard[code];
    return { code, label: w.label, area: w.area, props: h.props, locs: h.locs,
             tone: g?.band || "na", gauge: g ? g.name : "" };
  }).sort((a, b) => (BAND_TONE_ORDER[a.tone] ?? 9) - (BAND_TONE_ORDER[b.tone] ?? 9) || b.props - a.props);

  el.innerHTML = `
    <div class="ward-risk-note">Worst gauge in the ward × rated holdings behind it. ${feats.length ? "Click a ward for its brief + councillor contacts." : "Ward boundaries loading — gauge column fills in shortly."}</div>
    ${rows.map(r => `
      <div class="ward-risk-row" data-ward="${r.code}" role="button" tabindex="0" title="Open ward ${r.code} brief">
        <span class="wr-dot" data-tone="${r.tone}"></span>
        <span class="wr-ward">${escapeHtml(r.label || r.code)}</span>
        <span class="wr-area">${escapeHtml(r.area || "")}</span>
        <span class="wr-props">${r.props.toLocaleString()}<sup> hldg</sup></span>
        <span class="wr-gauge">${escapeHtml(r.gauge)}</span>
      </div>`).join("")}`;

  el.querySelectorAll(".ward-risk-row").forEach(row => {
    row.addEventListener("click", () => setActiveWard(row.dataset.ward));
    row.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setActiveWard(row.dataset.ward); }
    });
  });
}

// === The Catchment Story ================================================
// Learned from the Phuket dashboard's Slope Story
// (phuket/dashboard/docs/SLOPE-STORY.md). That project's lesson, in its own
// words: a visitor clicking around "saw materials, not an argument." Kuching
// had the same problem — terrain, telemetry, satellite growth and a forecast,
// each its own toggle, none of them speaking to each other.
//
// Click a gauge and this card states the chain plainly:
//   the gauge → the ground → who is exposed → what is coming → why → act.
// It fuses JPS Infobanjir telemetry, AlphaEarth impervious surface, the
// TimesFM catchment forecast, the 525-locality register and the ward roster
// into one sentence the council can act on today.
//
// Honesty rule (Production Doctrine law 3): every row degrades explicitly. A
// station with no catchment model says so rather than borrowing another
// station's numbers. Only 3 of 35 gauges carry the full six-source join;
// the card never pretends otherwise.

function closeCatchmentStory() {
  const el = $("catchmentStory");
  if (!el) return;
  el.hidden = true;
  el.innerHTML = "";
  state.activeStation = null;
  $("mapCanvas")?.focus({ preventScroll: true });
}

function renderCatchmentStory(station) {
  const el = $("catchmentStory");
  const payload = state.payload;
  if (!el || !station || !payload) return;
  state.activeStation = station.id;

  const band = station.band || "normal";
  el.dataset.band = band;
  el.hidden = false;

  const fc = payload.forecast?.stations?.[station.id];
  // Impervious zones map to a gauge by `station`; when several drain to the
  // same gauge keep the hardest-sealed one — that's the one that sets the risk.
  const zone = (payload.impervious?.zones || [])
    .filter(z => z.station === station.id)
    .sort((a, b) => (b.impervious_fraction || 0) - (a.impervious_fraction || 0))[0];
  const sealed = zone ? Math.round(zone.impervious_fraction * 100) : null;
  const amc = fc?.amc;
  const lag = fc?.lag_h;
  const risk = fc?.risk_72h;

  // Councillor join — same point-in-polygon path the ward matrix uses, so the
  // ACT row can name the person who owns the response.
  let councillor = null, wardLabel = null;
  if ((state.wardFeatures || []).length && station.lat != null && station.lon != null) {
    const feat = state.wardFeatures.find(f => pointInRing([station.lon, station.lat], f.geometry));
    const code = feat?.properties?.wardCode;
    if (code) {
      const ward = (payload.mppCouncillors?.wards || [])
        .find(w => w.code === code || (w.codeGroup || []).includes(code));
      if (ward) { wardLabel = ward.label; councillor = ward.councillors?.[0]; }
    }
  }

  // WHY — the causal chain in plain language. Sealed ground shortens the lag;
  // wet soil removes the buffer. Both facts are already in the payload; the
  // sentence is the only thing that was missing.
  const arrival = lag === 0 ? "as soon as it falls" : lag != null ? `about ${lag} h later` : "downstream";
  const soilClause = amc
    ? amc.class === "I" ? "Soil is dry and can still absorb the first storms."
    : amc.class === "II" ? "Soil is partly wet — a second storm would mostly run off."
    : "Soil is already saturated; the next rain arrives almost entirely as runoff."
    : null;
  let why;
  if (sealed != null && soilClause) {
    why = `<span class="cs-num">${sealed}%</span> of this catchment is sealed surface, so rain reaches the gauge ${arrival}. ${soilClause}`;
  } else if (soilClause) {
    why = `Rain in this catchment reaches the gauge ${arrival}. ${soilClause}`;
  } else if (station.humanBrief) {
    why = escapeHtml(station.humanBrief);
  } else {
    why = `<em>No catchment model for this gauge yet — reading is telemetry only.</em>`;
  }

  // ACT — band drives the posture; the councillor makes it a phone call.
  const contact = councillor
    ? ` Call ${escapeHtml(councillor.title || "Cr.")} ${escapeHtml(councillor.name)}${councillor.phone ? " · " + escapeHtml(councillor.phone) : ""}.`
    : "";
  let act;
  if (band === "danger" || band === "warning") {
    act = `Evacuate-ready posture. Open the nearest shelter and notify the ward now.${contact}`;
  } else if (band === "alert") {
    act = `Pre-position one mobile crew and confirm the drain sweep upstream.${contact}`;
  } else if (risk && risk.pct >= 25) {
    act = `Sweep now, before the forecast load arrives. No pre-positioning yet.${contact}`;
  } else {
    act = `Routine sweep on schedule. Re-check after the next rain band.`;
  }

  const row = (label, body) => `
    <div class="cs-row">
      <div class="cs-row-label">${label}</div>
      <div class="cs-row-body">${body}</div>
    </div>`;

  const level = station.waterLevelM != null
    ? `<span class="cs-num">${station.waterLevelM} m</span>`
    : `<em>no live reading</em>`;
  const alertAt = station.thresholds?.alert != null ? ` · Alert at ${station.thresholds.alert} m` : "";

  const ground = sealed != null
    ? `<span class="cs-num">${sealed}%</span> sealed upstream${amc ? ` · soil ${escapeHtml(amc.label)} (${amc.class})` : ""}`
    : amc ? `soil ${escapeHtml(amc.label)} (${amc.class}) · <em>no impervious survey here</em>`
    : `<em>no catchment model for this gauge</em>`;

  const next = fc
    ? `rain p90 <span class="cs-num">${fc.cumulative_p90_mm?.day4 ?? "—"} mm</span>/4d · risk ${(risk?.band || "—").toUpperCase()} ${risk?.pct ?? "—"}%${lag === 0 ? " · arrives now" : lag != null ? ` · lag +${lag}h` : ""}`
    : `<em>not in the TimesFM catchment set — telemetry only</em>`;

  const sources = ["JPS Infobanjir", zone ? "AlphaEarth" : null, fc ? "TimesFM" : null, councillor ? "MPP roster" : null]
    .filter(Boolean).join(" · ");

  el.innerHTML = `
    <div class="cs-head">
      <div>
        <div class="cs-kicker"><span class="cs-dot"></span>${t("csKicker")}</div>
        <div class="cs-name">${escapeHtml(station.name)}</div>
        <div class="cs-sub">${escapeHtml(station.basin || "Sarawak basin")}${station.council ? " · " + escapeHtml(station.council) : ""}${wardLabel ? " · " + escapeHtml(wardLabel) : ""}</div>
      </div>
      <button type="button" class="cs-close" aria-label="${t("csClose")}">✕</button>
    </div>
    <div class="cs-rows">
      ${row(t("csGauge"), `${level} · ${escapeHtml(station.bandLabel || band)}${alertAt}`)}
      ${row(t("csGround"), ground)}
      ${row(t("csExposed"), station.affectedEstimate ? escapeHtml(station.affectedEstimate) : `<em>exposure not yet surveyed for this gauge</em>`)}
      ${row(t("csNext"), next)}
      ${row(t("csWhy"), why)}
      ${row(t("csAct"), act)}
      ${station.lastEvent ? row(t("csLast"), `<em>${escapeHtml(station.lastEvent)}</em>`) : ""}
      <div class="cs-src">${sources}</div>
    </div>`;

  const closeBtn = el.querySelector(".cs-close");
  closeBtn?.addEventListener("click", closeCatchmentStory);
  closeBtn?.focus({ preventScroll: true });
}

// Zone 5 — the strategic argument. Satellite-measured growth + sealed-surface
// share, each hardening zone tied to the gauge that inherits its runoff.
function renderGrowthStory(payload) {
  const el = $("growthStory");
  if (!el) return;
  const ae = payload.alphaEarth;
  const imp = payload.impervious;
  const totals = payload.mppLocalities?.totals || {};
  if (!imp?.stats && !ae) {
    el.innerHTML = `<div class="growth-lead">Satellite growth pipeline offline this cycle.</div>`;
    return;
  }

  const meanPct = imp?.stats?.mean != null ? Math.round(imp.stats.mean * 100) : null;
  const p90Pct = imp?.stats?.p90 != null ? Math.round(imp.stats.p90 * 100) : null;
  const years = ae?.years ? `${ae.years.a}–${ae.years.b}` : "2017–2024";
  const stationName = (id) => (payload.infobanjir?.stations || []).find(s => s.id === id)?.name || id;

  const zones = (imp?.zones || []).slice().sort((a, b) => (b.impervious_fraction || 0) - (a.impervious_fraction || 0));
  const zoneRows = zones.map(z => {
    const pct = Math.round((z.impervious_fraction || 0) * 100);
    return `
      <div class="growth-zone-row" title="${escapeHtml(z.note || "")}">
        <span class="gz-name">${escapeHtml(z.name)}</span>
        <span class="gz-bar"><span class="gz-bar-fill" style="width:${pct}%"></span></span>
        <span class="gz-pct">${pct}%</span>
        <span class="gz-gauge">→ ${escapeHtml(stationName(z.station))} gauge</span>
      </div>`;
  }).join("");

  el.innerHTML = `
    <div class="growth-lead">The satellite record (${years}) shows Padawan's built footprint spreading fastest along the Penrissen and Batu Kawa corridors. ${meanPct != null ? `By ${imp.year}, <strong>${meanPct}% of the monitored basin is sealed surface</strong> — rain that once soaked into the ground now runs straight to the drains below.` : ""}</div>
    <div class="growth-stats">
      ${meanPct != null ? `<div class="growth-stat"><div class="g-val">${meanPct}%</div><div class="g-label">basin sealed (mean, ${imp.year})</div></div>` : ""}
      ${p90Pct != null ? `<div class="growth-stat"><div class="g-val">${p90Pct}%</div><div class="g-label">hardest-hit pixels (p90)</div></div>` : ""}
      ${totals.residential ? `<div class="growth-stat"><div class="g-val">${totals.residential.toLocaleString()}</div><div class="g-label">residential holdings on register</div></div>` : ""}
      ${totals.localities ? `<div class="growth-stat"><div class="g-val">${totals.localities}</div><div class="g-label">localities · ${totals.stateConstituencies || "—"} state seats</div></div>` : ""}
    </div>
    <div class="growth-zones">${zoneRows}</div>
    <div class="growth-foot">Each zone drains to the gauge shown — hardening upstream is tomorrow's reading downstream. See it on the map: toggle <strong>Growth 2017→24</strong> and <strong>Impervious Surface</strong> in Zone 03.</div>`;
}

function renderDashboard(payload) {
  state.payload = payload;
  // Dynamic <title> — encodes current posture + warning count so the browser
  // tab itself is a status indicator. Safe / Watch / Stretched glyph prefix.
  const postureToken = String(payload?.summary?.posture || "stable").toLowerCase();
  const titlePrefix = postureToken === "stretched" ? "▲" : postureToken === "watch" || postureToken === "steady-watch" ? "◐" : "▰";
  const metCount = payload?.metWarnings?.activeCount || 0;
  const titleSuffix = metCount > 0 ? ` · ${metCount} MET` : "";
  document.title = `${titlePrefix} ${(payload.site?.title || "Greater Kuching IOC")}${titleSuffix}`;
  if (payload.site?.title) $("titleText").textContent = payload.site.title;
  // Today's Brief — dynamic teleprompter line. Replaces the static partnership
  // subtitle (the partner-row of logos already credits the same partners visually).
  const subtitle = $("subtitleText");
  if (subtitle) {
    subtitle.classList.add("today-brief");
    subtitle.innerHTML = composeTodayBrief(payload);
  }
  $("summaryLead").textContent = payload.summary.headline;
  $("mapSummary").textContent = payload.summary.detail;
  renderRuntimeMeta(payload);
  renderDeltaDigest(payload);
  renderBriefStrip(payload);

  renderVerdict(payload);
  renderCascade(payload);
  renderWardRisk(payload);
  renderGrowthStory(payload);
  // Keep an open Catchment Story live across the 60s refresh — the gauge
  // reading in it must never go stale while the card sits open.
  if (state.activeStation) {
    const fresh = (payload.infobanjir?.stations || []).find(s => s.id === state.activeStation);
    if (fresh) renderCatchmentStory(fresh); else closeCatchmentStory();
  }

  renderFloodAction(payload);
  renderHydroGauges(payload);
  renderPosture(payload);
  renderForecastRail(payload);
  renderFloodMatrix(payload);
  renderCitizenReports(payload);
  // Decision-relevance order, not payload order: water first, then air, heat, context.
  const metricOrder = ["rain6h", "flood-watch", "aqi", "pm25", "heat", "airport"];
  const curated = metricOrder.map(id => payload.metrics.find(m => m.id === id)).filter(Boolean);
  renderMetrics(curated.length >= 4 ? curated : payload.metrics.slice(0, 6));
  renderMap(payload);
  renderAirportStats(payload.airport);
  renderNewsIntake(payload.news);
  renderOfficialPulse(payload);
  renderMppCouncillors(payload);
  renderMppLocalities(payload);

  // Directives — with human context, click-cyclable status, age-decayed borders.
  renderDirectives(payload.operations || []);

  // Ticker — Padawan scope prefers official-tier headlines (UKAS / TVS / MPP / MBKS / DBKU) first
  const allNews = payload.news.items || [];
  const news = isPadawanScope()
    ? [...allNews.filter(i => i.isOfficial), ...allNews.filter(i => !i.isOfficial)].slice(0, 8)
    : allNews.slice(0, 8);
  $("newsRail").innerHTML = [...news,...news].map(n=>`<span class="ticker-item"><span class="ticker-source">${n.languageBadge || (n.isOfficial ? "OFF" : n.source)}</span> ${n.title}</span>`).join("");

  // Signals
  const signalHtml = payload.metrics.slice(0,4).map(s=>`
    <div class="signal-card"><strong>${s.id.toUpperCase()} // ${s.label.toUpperCase()}</strong>
    <div class="val">${num(s.value,1)}<sup>${s.unit}</sup></div>
    <div class="meta">${s.context||''}</div></div>`).join("");

  // Ground-truth additions: Flood Watch (JPS Infobanjir) + APIMS ground AQ.
  const ib = payload.infobanjir;
  const apims = payload.apims;
  let groundHtml = "";
  if (ib) {
    const top = (ib.stations || [])
      .slice()
      .sort((a, b) => {
        const order = { danger: 0, warning: 1, alert: 2, normal: 3, reference: 4 };
        return (order[a.band] ?? 9) - (order[b.band] ?? 9);
      })
      .slice(0, 2);
    const bandColors = { danger: "#ff003c", warning: "#ff7a00", alert: "#ffd000", normal: "#00ffaa", reference: "#8aa2c8" };
    const snapped = (ib.stations || []).filter(s => s.catchment?.status === "snapped");
    const totalCatchKm = snapped.reduce((sum, s) => sum + (s.catchment?.totalLengthKm || 0), 0);
    const catchLine = ib.catchmentStatus === "live"
      ? `<div class="meta" style="color:#60a5fa">Catchment: ${snapped.length} snapped · ${totalCatchKm.toFixed(1)} km routed</div>`
      : ib.catchmentStatus === "cold"
        ? `<div class="meta" style="color:#8aa2c8"><em>Toggle Drainage layer to route catchments</em></div>`
        : "";
    groundHtml += `
      <div class="signal-card" data-band="${ib.highestBand}" style="border-left:3px solid ${bandColors[ib.highestBand]||"#8aa2c8"}">
        <strong>FLOOD // JPS HYDRO</strong>
        <div class="val">${ib.liveCount}<sup>/${ib.stationCount}</sup></div>
        <div class="meta">${(ib.highestBandLabel || "Reference").toUpperCase()} · ${glyphHTML(ib.status === "live" ? "live" : "cached", ib.status === "live" ? "live feed" : "reference hold")}</div>
        ${top.map(s => `<div class="meta" style="color:${bandColors[s.band]||"#8aa2c8"}">${s.name} · ${s.waterLevelM != null ? s.waterLevelM + "m" : "—"} (${s.bandLabel})${s.catchment?.status === "snapped" ? ` · ${s.catchment.segmentCount}seg` : ""}</div>`).join("")}
        ${catchLine}
      </div>`;
  }
  if (apims) {
    const w = apims.worst;
    groundHtml += `
      <div class="signal-card" style="border-left:3px solid ${w?.band?.tone === "good" ? "#00ffaa" : w?.band?.tone === "watch" ? "#ffd000" : w?.band?.tone === "warn" ? "#ff7a00" : w?.band?.tone === "alert" || w?.band?.tone === "critical" ? "#ff003c" : "#8aa2c8"}">
        <strong>APIMS // GROUND AQ</strong>
        <div class="val">${w?.aqi ?? "—"}<sup>${w?.band?.label || apims.status}</sup></div>
        <div class="meta">${apims.stations.map(s => `${glyphHTML(s.status || (s.aqi != null ? "live" : "offline"), s.label + ": " + (s.aqi ?? "—"))}`).join(" · ")}</div>
        <div class="meta">${glyphHTML(apims.status || "live", "src: aqicn.org · " + (apims.tokenMode || "demo") + " token")}</div>
      </div>`;
  }

  // MET Malaysia active warnings card
  const met = payload.metWarnings;
  let metHtml = "";
  if (met) {
    if (met.activeCount > 0) {
      const w = met.items[0];
      metHtml = `
        <div class="signal-card" style="border-left:3px solid #ef4444">
          <strong>MET // WEATHER WARNING</strong>
          <div class="val">${met.activeCount}<sup>active</sup></div>
          <div class="meta">${w.heading || "Active warning"}</div>
          ${w.validTo ? `<div class="meta">Until ${new Date(w.validTo).toLocaleString("en-MY",{timeZone:"Asia/Kuching",month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"})}</div>` : ""}
        </div>`;
    } else {
      metHtml = `
        <div class="signal-card" style="border-left:3px solid #8aa2c8">
          <strong>MET // WEATHER WARNING</strong>
          <div class="val" style="color:var(--soft)">Clear</div>
          <div class="meta">No active warnings for Kuching/Sarawak</div>
        </div>`;
    }
  }

  $("signalCards").innerHTML = signalHtml + groundHtml + metHtml;

  // Jurisdictions — Padawan scope shows only MPP; Greater Kuching shows all 3
  const visibleJurs = isPadawanScope()
    ? payload.jurisdictions.items.filter(j => j.id === "mpp")
    : payload.jurisdictions.items;
  $("jurisdictionCards").innerHTML = visibleJurs.map(j=>`
    <div class="municipality-tag" style="border-color:${j.accent};color:${j.accent}">${j.code} // ${j.areaKm2}km2</div>`).join("");

  // Map legend
  const hydroLegend = (payload.mapScene?.hydroBands || []).filter(b => b.id !== "reference").map(b => `<span class="legend-item"><span class="legend-dot" style="background:${b.color}"></span>${b.label}</span>`).join("");
  $("mapLegend").innerHTML = visibleJurs.map(j=>`<span class="legend-item"><span class="legend-dot" style="background:${j.accent}"></span>${j.code}</span>`).join("") + `<span class="legend-item"><span class="legend-dot" style="background:#1e90ff"></span>River</span>` + hydroLegend;
  $("watchpointList").innerHTML = MAP_WATCHPOINTS.map(w=>`<span>${w}</span>`).join("");

  // Intel panel: economy + news digest + trends + bypass tracker
  renderIntelPanel(payload);
  renderFloodForecast(payload.floodForecast);
  if (!isPadawanScope()) renderBypassTracker();
  if (!isPadawanScope()) renderQualitativeLens(payload);

  // Pass 3 additions
  renderEventsStack(payload);
  renderTelemetryStrip(payload);

  // Sources — hidden in Padawan scope (panel CSS-gated; renderer skipped to save work)
  if (!isPadawanScope()) {
    renderSourceMatrix(payload);
    $("sourceList").innerHTML = payload.sources.map(s=>`
      <div class="source-item">
        <div class="source-copy">
          <span class="source-name">${s.name}</span>
          <span class="source-detail">${s.detail || ""}</span>
        </div>
        <div class="source-meta">
          <span class="source-status" data-status="${s.status}">${s.status}</span>
          <span class="source-updated">${formatShortStamp(s.generatedAt || payload.generatedAt)}</span>
        </div>
      </div>`).join("");
  }

  queueMapResize();
}

// --- Theme Toggle ---
function toggleTheme() {
  state.theme = state.theme === "dark" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", state.theme);
  const tp = document.querySelector(".leaflet-tile-pane");
  if (tp) {
    if (state.activeLayerId === "dark") {
      tp.style.filter = state.theme === "dark" ? "brightness(0.9) contrast(1.1) saturate(0.8) hue-rotate(180deg) invert(1) brightness(0.6) contrast(1.4)" : "brightness(1.1) contrast(1) saturate(0.8) invert(1) hue-rotate(180deg)";
    }
  }
  const btn = $("themeToggle");
  if (btn) btn.textContent = state.theme === "dark" ? "LIGHT" : "DARK";
}

// --- Language Toggle ---
function setLang(lang) {
  state.lang = lang;
  // Update labels
  $("titleText").textContent = t("title");
  $("subtitleText").textContent = t("subtitle");
  $("sysStatus").textContent = t("sysOperational");
  document.querySelectorAll("[data-i18n]").forEach(el => {
    el.textContent = t(el.dataset.i18n);
  });
  // Scope pill text follows the active language.
  const pill = $("scopePill");
  if (pill && state.scope) {
    pill.textContent = SCOPES[state.scope].pill[state.lang] || SCOPES[state.scope].pill.en;
  }
  // Re-render focus toggle labels
  if (state.payload) {
    renderRuntimeMeta(state.payload);
    renderVerdict(state.payload);
    if (state.activeStation) {
      const st = (state.payload.infobanjir?.stations || []).find(s => s.id === state.activeStation);
      if (st) renderCatchmentStory(st);
    }
    renderFloodAction(state.payload);
    renderHydroGauges(state.payload);
    renderForecastRail(state.payload);
  }
  // Highlight active lang button
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
}

// --- Keyboard shortcuts + help overlay ---
// Power-user navigation: ?, esc, 1-9/0 → wards, w → cycle, e → export,
// shift+e → print, t → theme, r → refresh, g → toggle full mode.
const SHORTCUT_WARD_MAP = ["A", "B", "D", "FG", "H", "I", "JL", "K", "M", "NPQ"];

function isTypingTarget(el) {
  if (!el) return false;
  const tag = (el.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") return true;
  if (el.isContentEditable) return true;
  return false;
}

function showHelpOverlay() {
  const el = $("helpOverlay");
  if (!el) return;
  el.hidden = false;
  // Move keyboard focus into the overlay's close button so esc behavior is natural.
  el.querySelector(".help-close")?.focus({ preventScroll: true });
}
function hideHelpOverlay() {
  const el = $("helpOverlay");
  if (!el) return;
  el.hidden = true;
}
function toggleHelpOverlay() {
  const el = $("helpOverlay");
  if (!el) return;
  el.hidden ? showHelpOverlay() : hideHelpOverlay();
}

function cycleWard(direction) {
  const order = SHORTCUT_WARD_MAP;
  const cur = state.activeWard;
  if (!cur) {
    setActiveWard(order[direction > 0 ? 0 : order.length - 1]);
    return;
  }
  const idx = order.indexOf(cur);
  if (idx < 0) {
    setActiveWard(order[0]);
    return;
  }
  const next = (idx + direction + order.length) % order.length;
  setActiveWard(order[next]);
}

// --- Scope toggle (Geographic scope: Padawan vs Greater Kuching) ---
// Drives the masthead scope-toggle button + the `s` keyboard shortcut. Reactive:
// no full reload — just rewires the scope state, re-fits the map, and re-runs
// renderDashboard() so the filtered data flows through the same renderers.
function setScope(scope, { silent = false } = {}) {
  if (!VALID_SCOPES.includes(scope)) return;
  if (state.scope === scope) return;
  state.scope = scope;
  writeStoredScope(scope);
  // The open gauge may not exist in the new scope's station set.
  closeCatchmentStory();
  // Keep the html data-view attribute in lockstep so the existing
  // `[data-view="secretary"]` CSS rules gate the trimmed panel set.
  document.documentElement.dataset.view = scope === "padawan" ? "secretary" : "full";

  // Masthead scope pill text + active button state.
  const pill = $("scopePill");
  if (pill) {
    pill.dataset.scope = scope;
    pill.textContent = SCOPES[scope].pill[state.lang] || SCOPES[scope].pill.en;
  }
  document.querySelectorAll(".scope-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.scope === scope);
  });

  // Re-fit the map to the new scope's default extent.
  if (state.map) {
    const cfg = SCOPES[scope];
    state.map.setView(cfg.mapCenter, cfg.mapZoom, { animate: true });
    state.hasInitialMapFit = true;
  }

  // In 3D mode, also fly the Cesium camera + re-render 3D entities
  // (since the scope filter changes which hydro + jurisdictions show).
  if (state.dimension === "3d" && state.cesiumInitialised) {
    if (state.cesiumViewer) {
      flyCesiumToScope(scope);
    }
    if (state.payload) {
      renderCesiumEntities(state.payload);
    }
  }

  // Re-render the dashboard panels that branch on scope. No reload needed.
  if (state.payload) {
    renderDashboard(state.payload);
  }

  if (!silent) {
    const label = SCOPES[scope].label[state.lang] || SCOPES[scope].label.en;
    showToast(`▰ SCOPE: ${label}`, "ok");
  }
}

function toggleViewMode() {
  // Backwards-compat alias for the old `g` keyboard shortcut. Cycles scope
  // (no full reload — reuses the same reactive pipeline as the button).
  setScope(state.scope === "padawan" ? "greater_kuching" : "padawan");
}

// Wire the masthead scope toggle + the inline pill to setScope().
function renderScopeToggle() {
  document.querySelectorAll(".scope-btn").forEach(btn => {
    btn.addEventListener("click", () => setScope(btn.dataset.scope));
  });
  // Initialise the pill text + active button to match the hydrated scope.
  const pill = $("scopePill");
  if (pill) {
    pill.dataset.scope = state.scope;
    pill.textContent = SCOPES[state.scope].pill[state.lang] || SCOPES[state.scope].pill.en;
  }
  document.querySelectorAll(".scope-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.scope === state.scope);
  });
}

// --- 2D / 3D dimension toggle ---
// 2D = the existing Leaflet map (default). 3D = CesiumJS digital twin with
// ground-clamped council outlines, short hydro pins, and the Sarawak River
// polyline — no extruded jurisdiction "blobs". Cesium is lazy-loaded from
// a CDN only when the user flips to 3D. No Ion token — ArcGIS imagery.
let cesiumLoaderPromise = null;
// Cesium reads window.CESIUM_BASE_URL at load time to find its Workers,
// Assets, and Widgets/textures. Must be set BEFORE the script tag is
// inserted — by the time Cesium.js executes it has already tried to
// fetch its worker scripts. Setting it inside initCesium() is too late.
const CESIUM_VERSION = "1.121.0";
const CESIUM_BASE_URL_CDN = `https://cdn.jsdelivr.net/npm/cesium@${CESIUM_VERSION}/Build/Cesium/`;
window.CESIUM_BASE_URL = CESIUM_BASE_URL_CDN;
function loadCesium() {
  if (window.Cesium) return Promise.resolve();
  if (cesiumLoaderPromise) return cesiumLoaderPromise;
  cesiumLoaderPromise = new Promise((resolve, reject) => {
    const css = document.createElement("link");
    css.rel = "stylesheet";
    css.href = `${CESIUM_BASE_URL_CDN}Widgets/widgets.css`;
    document.head.appendChild(css);
    const script = document.createElement("script");
    script.src = `${CESIUM_BASE_URL_CDN}Cesium.js`;
    script.onload = () => resolve(window.Cesium);
    script.onerror = (e) => reject(new Error("Cesium CDN failed: " + (e?.message || e)));
    document.head.appendChild(script);
  });
  return cesiumLoaderPromise;
}

async function setDimension(dim, { silent = false } = {}) {
  if (!VALID_DIMS.includes(dim)) return;
  if (state.dimension === dim) return;
  state.dimension = dim;
  writeStoredDim(dim);

  // Active button + map-frame dim attribute (CSS gates the swap).
  const mapFrame = document.querySelector(".map-frame");
  if (mapFrame) mapFrame.dataset.dim = dim;
  document.querySelectorAll(".dim-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dim === dim);
  });

  if (dim === "3d") {
    // Lazy-load Cesium on the first 3D toggle; subsequent toggles reuse
    // the in-memory viewer.
    if (!state.cesiumInitialised) {
      try {
        await loadCesium();
        initCesium();
        state.cesiumInitialised = true;
      } catch (err) {
        console.error("Cesium load failed:", err);
        // Best-effort fallback: stay in 2D, surface the error.
        state.dimension = "2d";
        if (mapFrame) mapFrame.dataset.dim = "2d";
        document.querySelectorAll(".dim-btn").forEach(b => {
          b.classList.toggle("active", b.dataset.dim === "2d");
        });
        showToast("✕ 3D UNAVAILABLE", "alert");
        return;
      }
    } else if (state.cesiumViewer) {
      state.cesiumViewer.scene.requestRender();
    }
    // Repopulate 3D entities from the current payload (may have refreshed
    // since the last 3D view) and fly the camera to the active scope.
    if (state.payload) {
      renderCesiumEntities(state.payload);
      flyCesiumToScope(state.scope);
    }
    // The map3d div was display:none while Cesium constructed the viewer,
    // so the underlying canvas is 0×0. Force a resize + render so the
    // WebGL framebuffer matches the now-visible container.
    if (state.cesiumViewer) {
      state.cesiumViewer.resize();
      state.cesiumViewer.scene.requestRender();
    }
  } else {
    // Back to 2D — Leaflet needs an invalidateSize after the container
    // is unhidden, otherwise tiles paint at the old (0×0) size.
    if (state.map) {
      setTimeout(() => state.map.invalidateSize(), 50);
    }
  }

  if (!silent) {
    showToast(`▰ DIMENSION: ${dim.toUpperCase()}`, "ok");
  }
}

function renderDimensionToggle() {
  document.querySelectorAll(".dim-btn").forEach(btn => {
    btn.addEventListener("click", () => setDimension(btn.dataset.dim));
  });
  document.querySelectorAll(".dim-btn").forEach(b => {
    b.classList.toggle("active", b.dataset.dim === state.dimension);
  });
}

function initCesium() {
  if (state.cesiumViewer) return;
  const Cesium = window.Cesium;
  // Defensive — CESIUM_BASE_URL is also set at module load (see above) but
  // some bundler-rewriting patterns can drop window properties; set it
  // again here before constructing the Viewer.
  window.CESIUM_BASE_URL = CESIUM_BASE_URL_CDN;

  // Ion-free setup. NOTE: blanking the token alone is NOT enough — the
  // Viewer still constructs its default Ion (Bing Aerial, asset 2) base
  // layer and fires https://api.cesium.com/v1/assets/2/endpoint, which
  // 401s after a ~4 s stall and surfaces as opaque "[object Object]"
  // console errors. baseLayer:false stops that request from ever being
  // made; the ArcGIS provider below is the only imagery.
  Cesium.Ion.defaultAccessToken = "";

  const viewer = new Cesium.Viewer("map3d", {
    baseLayer: false,
    // No terrain — keeps the 2D->3D diff to "data on a 3D ellipsoid".
    // Adding a real terrain model is a follow-up (requires a token for
    // the Cesium World Terrain Mesh or self-hosting terrarium).
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    // Strip Cesium's own chrome — the dashboard already has its own HUD.
    baseLayerPicker: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    animation: false,
    timeline: false,
    fullscreenButton: false,
    infoBox: false,
    selectionIndicator: false,
    requestRenderMode: true,   // Only render on demand (perf for static data)
    maximumRenderTimeChange: Infinity,
  });
  // Hide the credit container — the dashboard has its own source matrix.
  viewer._cesiumWidget && viewer._cesiumWidget.creditContainer && (viewer._cesiumWidget.creditContainer.style.display = "none");

  // requestRenderMode only paints on an explicit requestRender() call. The
  // globe's tile quadtree needs many consecutive frames to walk from coarse
  // to fine tiles as they stream in — a handful of manual requestRender()
  // calls isn't enough to drive that traversal to completion, so the scene
  // freezes on the flat default globe colour with no basemap ever painted.
  // Force continuous rendering until the initial basemap has actually
  // finished loading, then drop back to on-demand rendering for perf.
  viewer.scene.requestRenderMode = false;
  const stopWatchingTiles = viewer.scene.globe.tileLoadProgressEvent.addEventListener(() => {
    if (viewer.scene.globe.tilesLoaded) {
      viewer.scene.requestRenderMode = true;
      stopWatchingTiles();
    }
  });

  // Tune the scene: enable depth + lighting so 3D extrusions read as solid
  // volumes. Atmosphere + sun are kept on for a true outdoor scene.
  viewer.scene.globe.enableLighting = false;
  viewer.scene.skyAtmosphere.show = true;
  viewer.scene.fog.enabled = true;
  viewer.scene.fog.density = 0.0001;

  // Wire ArcGIS World Imagery as the base layer via a direct tile-URL
  // template rather than ArcGisMapServerImageryProvider.fromUrl(). The
  // latter does an async MapServer capability-detection round-trip first
  // (metadata request, then mode selection) — an extra layer that was
  // silently starving the actual tile requests in some environments even
  // though the same tile URLs load fine directly. UrlTemplateImageryProvider
  // skips capability detection and requests tiles the same way a plain
  // <img> would, which is what actually works. If this fails (network/
  // CORS), the scene falls back to the dark-blue ocean and our 3D entities
  // still render on top — the digital twin isn't image-dependent.
  try {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      maximumLevel: 19,
      credit: "Esri World Imagery",
    });
    viewer.imageryLayers.removeAll();
    viewer.imageryLayers.addImageryProvider(provider);
    viewer.scene.requestRender();
  } catch (err) {
    console.warn("ArcGIS imagery failed; 3D scene will show entities on the default ellipsoid.", err);
  }

  // Default camera: a low oblique over Kuching. flyCesiumToScope() will
  // refine this based on the active scope.
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(110.35, 1.53, 18000),
    orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-35), roll: 0 },
  });

  state.cesiumViewer = viewer;
  // Expose the viewer (and the state object) for headless tests +
  // browser dev-tools inspection. Harmless in production.
  if (typeof window !== "undefined") {
    window.__CESIUM_TEST_VIEWER = viewer;
    window.__IOC_TEST_STATE = state;
  }
}

function renderCesiumEntities(payload) {
  const viewer = state.cesiumViewer;
  if (!viewer || !window.Cesium) return;
  const Cesium = window.Cesium;
  // Wipe + rebuild — small dataset, cheap, and keeps the 3D scene honest
  // with the current payload (scope filter, refresh, etc.).
  viewer.entities.removeAll();

  const isPadawan = isPadawanScope();
  // 1) Jurisdiction boundaries — flat hairlines on the ground.
  // Extruded "jelly" volumes were removed: they hid the satellite and
  // told Secretary Goh nothing he could act on. Outline = who owns what.
  const juris = (payload.jurisdictions?.items || [])
    .filter(j => isPadawan ? j.id === "mpp" : true);
  juris.forEach(item => {
    const flat = item.polygons.flat().map(([lon, lat]) => [lon, lat]);
    if (flat.length < 3) return;
    const accent = Cesium.Color.fromCssColorString(item.accent);
    viewer.entities.add({
      name: `jurisdiction-${item.id}`,
      polygon: {
        hierarchy: Cesium.Cartesian3.fromDegreesArray(flat.flat()),
        material: accent.withAlpha(0.08),
        outline: true,
        outlineColor: accent.withAlpha(0.95),
        outlineWidth: 2,
        height: 0,
        heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        classificationType: Cesium.ClassificationType.BOTH,
      },
      description: `${item.code} — ${item.areaKm2} km²`,
    });
  });

  // 2) Sarawak River as a fat 3D polyline.
  if (payload.jurisdictions?.river) {
    const flat = payload.jurisdictions.river.flat();
    if (flat.length >= 2) {
      viewer.entities.add({
        name: "sarawak-river",
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray(flat),
          width: 4,
          material: new Cesium.PolylineGlowMaterialProperty({
            color: Cesium.Color.fromCssColorString("#1e90ff"),
            glowPower: 0.25,
          }),
          clampToGround: true,
        },
      });
    }
  }

  // 3) Hydro stations as short pins — the only vertical marks on the twin.
  // Tall cylinders used to compete with the jelly molds; short pins keep
  // the satellite readable while still flagging Alert/Warning/Danger.
  const hydroBandColors = { danger: "#ff003c", warning: "#ff7a00", alert: "#ffd000", normal: "#00ffaa", reference: "#8aa2c8" };
  const hydroBandHeight = { danger: 450, warning: 320, alert: 220, normal: 120, reference: 60 };
  const allHydro = payload.mapScene?.hydroStations || payload.infobanjir?.stations || [];
  const hydroStations = isPadawan
    ? allHydro.filter(s => s.focus === "padawan" || s.council === "MPP")
    : allHydro;
  hydroStations.forEach(s => {
    if (s.lat == null || s.lon == null) return;
    const color = hydroBandColors[s.band] || "#8aa2c8";
    const height = hydroBandHeight[s.band] || 60;
    const elevated = ["alert", "warning", "danger"].includes(s.band);
    viewer.entities.add({
      name: `hydro-${s.id}`,
      position: Cesium.Cartesian3.fromDegrees(s.lon, s.lat, height / 2),
      cylinder: {
        length: height,
        topRadius: elevated ? 45 : 28,
        bottomRadius: elevated ? 45 : 28,
        material: Cesium.Color.fromCssColorString(color).withAlpha(elevated ? 0.9 : 0.55),
        outline: true,
        outlineColor: Cesium.Color.fromCssColorString(color),
      },
      label: (elevated || s.waterLevelM != null) ? {
        text: `${s.name}${s.waterLevelM != null ? `\n${s.waterLevelM} m` : ""} · ${s.bandLabel || s.band || ""}`,
        font: "11px monospace",
        fillColor: Cesium.Color.WHITE,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        pixelOffset: new Cesium.Cartesian2(0, -18),
        showBackground: true,
        backgroundColor: Cesium.Color.fromCssColorString("#000").withAlpha(0.55),
        disableDepthTestDistance: Number.POSITIVE_INFINITY,
        scaleByDistance: new Cesium.NearFarScalar(1500, 1.0, 80000, 0.45),
      } : undefined,
      description: s.humanBrief
        ? `${s.name}\n${s.humanBrief}`
        : `${s.name} — ${s.basin || ""} · ${s.council || ""}\nLevel: ${s.waterLevelM != null ? s.waterLevelM + " m" : "reference"}\n${s.bandLabel || "Reference"}`,
    });
  });

  // Land-use extrusions intentionally omitted in 3D — they painted the
  // city as opaque candy and hid the ground truth the twin is for.

  // Force a render — requestRenderMode is on so the scene only repaints
  // when something changes.
  viewer.scene.requestRender();
}

function flyCesiumToScope(scopeId) {
  const viewer = state.cesiumViewer;
  if (!viewer || !window.Cesium) return;
  const Cesium = window.Cesium;
  const cfg = SCOPES[scopeId || state.scope] || SCOPES.padawan;
  // Camera altitude scaled inversely with zoom: closer on Padawan, higher
  // for the wider Greater Kuching view.
  const altitudeM = cfg.mapZoom <= 11 ? 28000 : 16000;
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(cfg.mapCenter[1], cfg.mapCenter[0], altitudeM),
    orientation: {
      heading: Cesium.Math.toRadians(0),
      pitch: Cesium.Math.toRadians(-35),
      roll: 0,
    },
    duration: 1.5,
  });
}

function setupKeyboardShortcuts() {
  // Help-hint click → opens overlay.
  $("helpHint")?.addEventListener("click", showHelpOverlay);
  $("helpOverlay")?.querySelector(".help-close")?.addEventListener("click", hideHelpOverlay);
  // Backdrop click also closes.
  $("helpOverlay")?.addEventListener("click", (e) => {
    if (e.target.id === "helpOverlay") hideHelpOverlay();
  });

  document.addEventListener("keydown", (e) => {
    if (isTypingTarget(e.target)) return;
    // Modifier-aware: Shift used as a modifier; Ctrl/Cmd/Alt always pass through.
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key;

    // ESC: close the topmost open surface — help, then catchment story, then ward
    if (k === "Escape") {
      if (!$("helpOverlay")?.hidden) { hideHelpOverlay(); e.preventDefault(); return; }
      if (state.activeStation) { closeCatchmentStory(); e.preventDefault(); return; }
      if (state.activeWard) { setActiveWard(null); e.preventDefault(); return; }
      return;
    }

    // ? — toggle help overlay (Shift+/)
    if (k === "?" || (e.shiftKey && k === "/")) { toggleHelpOverlay(); e.preventDefault(); return; }

    // 1–9, 0 → ward jump (1=A, 2=B, ..., 0=NPQ)
    if (/^[0-9]$/.test(k)) {
      const idx = k === "0" ? 9 : (parseInt(k, 10) - 1);
      const ward = SHORTCUT_WARD_MAP[idx];
      if (ward) { setActiveWard(state.activeWard === ward ? null : ward); e.preventDefault(); }
      return;
    }

    // w / W — cycle wards
    if (k === "w" || k === "W") { cycleWard(e.shiftKey ? -1 : 1); e.preventDefault(); return; }

    // e / E — export
    if (k === "e" || k === "E") {
      if (e.shiftKey) { window.print(); }
      else { exportSitrepWhatsApp(); }
      e.preventDefault();
      return;
    }

    // t — theme toggle
    if (k === "t" || k === "T") { toggleTheme(); e.preventDefault(); return; }

    // r — force refresh
    if (k === "r" || k === "R") { boot(); showToast("▱ REFRESHING", "ok"); e.preventDefault(); return; }

    // g — toggle view mode
    if (k === "g" || k === "G") { toggleViewMode(); e.preventDefault(); return; }
  });
}

// --- Export (Pass 3.7: WhatsApp clipboard / Shift-click for print / Alt-click for .txt download) ---
function setupExport() {
  $("exportSitrep")?.addEventListener("click", (e) => {
    if (!state.payload) return;
    if (e.shiftKey) {
      // Print preview (browser → save as PDF).
      window.print();
      return;
    }
    if (e.altKey) {
      // Legacy: download as .txt
      const text = buildSitrepText(state.payload);
      const blob = new Blob([text], { type: "text/plain" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `sitrep-kuching-${new Date().toISOString().slice(0, 10)}.txt`;
      a.click();
      return;
    }
    // Default: copy to clipboard for WhatsApp.
    exportSitrepWhatsApp();
  });
  // Tooltip hint on the button.
  const btn = $("exportSitrep");
  if (btn) btn.title = "Click → copy WhatsApp text · Shift-click → print · Alt-click → save .txt";
}

// --- Boot ---
async function boot() {
  try {
    const payload = await loadDashboardPayload();
    renderDashboard(payload);
    // In 3D mode, re-render the Cesium entities with the freshest
    // payload so hydro cylinder levels / band colours track the
    // 60-second refresh.
    if (state.dimension === "3d" && state.cesiumInitialised) {
      renderCesiumEntities(payload);
    }
    // Pass 2: bring up ward + flood-zone polygon caches in parallel; if a #ward=X
    // hash is present, auto-open that ward's brief once data is available.
    await Promise.all([loadWardFeatures(), loadFloodZoneFeatures()]);
    // Ward boundaries just became available — fill in the gauge column of
    // the ward-risk join (rendered gaugeless on first paint).
    if (state.wardFeatures?.length) renderWardRisk(payload);
    const hash = (location.hash || "").match(/#ward=([A-Z]+)/i);
    if (hash && hash[1] && !state.activeWard) {
      setActiveWard(hash[1].toUpperCase());
    }
    startRadarSweep();
  } catch (err) { console.error("IOC SYNC FAILURE", err); }
}

// Init controls
setupExport();
setupConnectors();
setupKeyboardShortcuts();
$("themeToggle")?.addEventListener("click", toggleTheme);
document.querySelectorAll(".lang-btn").forEach(btn => btn.addEventListener("click", () => setLang(btn.dataset.lang)));
renderScopeToggle();
renderDimensionToggle();

// If the user previously opted into 3D on a prior visit, flip the
// map-frame data-dim now so the CSS already hides the Leaflet canvas
// (and we don't pay a flash on first paint). Cesium is still lazy —
// the actual viewer is built on the first user-initiated 3D toggle OR
// here if the user reloads in 3D mode.
if (state.dimension === "3d") {
  const mapFrame = document.querySelector(".map-frame");
  if (mapFrame) mapFrame.dataset.dim = "3d";
  loadCesium()
    .then(() => {
      initCesium();
      state.cesiumInitialised = true;
      if (state.payload) {
        renderCesiumEntities(state.payload);
        flyCesiumToScope(state.scope);
      }
      if (state.cesiumViewer) {
        state.cesiumViewer.resize();
        state.cesiumViewer.scene.requestRender();
      }
    })
    .catch((err) => {
      console.error("Cesium pre-load failed:", err);
      // Fall back to 2D cleanly.
      state.dimension = "2d";
      if (mapFrame) mapFrame.dataset.dim = "2d";
      document.querySelectorAll(".dim-btn").forEach(b => {
        b.classList.toggle("active", b.dataset.dim === "2d");
      });
    });
}

boot();
setInterval(boot, 60000);
