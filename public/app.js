import {
  SITE, JURISDICTIONS, LOCAL_MARKERS, SARAWAK_RIVER, ASEAN_CLOCKS,
  MAP_WATCHPOINTS, AIRPORT_FALLBACK_ROUTES, FALLBACK_NEWS, FALLBACK_TRENDS,
  WEATHER_FALLBACK, AIR_FALLBACK, CITY_DEMOGRAPHICS, TRANSLATIONS,
  round, aqiBand, weatherCodeLabel, kmBetween, classifyAircraft,
  sourceRecord, buildSatelliteCards, buildMapLayers, URBAN_LAYERS
} from "./data.js";

// --- State ---
const state = {
  map: null, boundaryLayerGroup: null, markerLayerGroup: null, labelLayerGroup: null,
  urbanLayerGroups: new Map(),
  tileLayers: new Map(), activeLayerId: "dark", payload: null, hasInitialMapFit: false,
  theme: "dark", lang: "en", mapResizeObserver: null,
};

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

function buildOperations(w, a, ap, n, j, pz, tr, fires, quakes) {
  const rain6h = round(w.nextHours.reduce((s,h)=>s+h.precipitationMm,0),1);
  const items = [];
  if (rain6h>=6) items.push({ severity:"high", owner:"Drainage", title:"Sweep low-lying feeder roads", detail:`${rain6h}mm projected. Prioritise Penrissen and Batu Kawa.` });
  if (a.current.aqi>=70||a.current.pm25>=25) items.push({ severity:"medium", owner:"Health", title:"Haze advisory for sensitive groups", detail:`AQI ${a.current.aqi}, PM2.5 ${a.current.pm25}` });
  if (ap.movements.totalTracked>=6) items.push({ severity:"medium", owner:"Traffic", title:"Airport corridor watch", detail:`${ap.movements.arrivals} arrivals in envelope.` });
  if (tr.localMatches.length>0) items.push({ severity:"medium", owner:"Comms", title:"Local search pulse active", detail:tr.localMatches.slice(0,2).map(i=>i.title).join(" / ") });
  items.push({ severity:"low", owner:"Infrastructure", title:`${CITY_DEMOGRAPHICS.drainageNetworkKm}km drainage network`, detail:`${CITY_DEMOGRAPHICS.roadNetworkKm}km road network serving ${num(CITY_DEMOGRAPHICS.greaterKuchingPopulation)} residents.` });
  items.push({ severity:"low", owner:"Planning", title:"Padawan growth ring", detail:`${j.items.find(i=>i.id==="mpp")?.areaKm2??0} km2 across ${pz.wardCount} wards.` });
  return items.slice(0,6);
}

function computeSentiment(news) {
  const counts = { positive: 0, neutral: 0, negative: 0 };
  news.forEach(n => counts[n.sentiment || "neutral"]++);
  const total = news.length || 1;
  return {
    positive: round(counts.positive / total * 100, 0),
    neutral: round(counts.neutral / total * 100, 0),
    negative: round(counts.negative / total * 100, 0),
    label: counts.negative > counts.positive ? "Cautious" : counts.positive > 2 ? "Optimistic" : "Balanced",
  };
}

async function buildFallbackDashboard() {
  const [weather, air, airport, quakes, exchange] = await Promise.all([
    loadWeather(), loadAirQuality(), loadAirport(), loadEarthquakes(), loadExchangeRates(),
  ]);
  const jurisdictions = loadJurisdictions(), news = loadNews(), fires = loadFires();
  const padawanZoning = loadPadawanZoning(), trends = loadTrends();
  const gen = nowIso();
  return {
    generatedAt: gen, site: SITE,
    timeSignal: { serverNow: gen, asean: ASEAN_CLOCKS },
    summary: buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends),
    metrics: buildMetrics(weather, air, airport, jurisdictions, news, padawanZoning, trends),
    jurisdictions, mapLayers: buildMapLayers(), climate: { weather, air },
    airport, news, trends, exchange,
    satellites: buildSatelliteCards(), fires, quakes,
    sentiment: computeSentiment(news.items),
    demographics: CITY_DEMOGRAPHICS,
    operations: buildOperations(weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes),
    sources: [
      sourceRecord("mpp","MPP Council","official","Padawan data","https://mpp.sarawak.gov.my",gen),
      sourceRecord("mbks","MBKS","official","Kuching South","https://mbks.sarawak.gov.my",gen),
      sourceRecord("dbku","DBKU","official","Kuching North","https://dbku.sarawak.gov.my",gen),
      sourceRecord("weather","Open-Meteo",weather.status,"Weather","https://open-meteo.com",gen),
      sourceRecord("aqi","Open-Meteo AQI",air.status,"Air quality","https://open-meteo.com",gen),
      sourceRecord("opensky","OpenSky",airport.status,"Airspace","https://opensky-network.org",gen),
      sourceRecord("usgs","USGS",quakes.status,"Seismic","https://earthquake.usgs.gov",gen),
      sourceRecord("gibs","NASA GIBS","live","Satellite","https://earthdata.nasa.gov",gen),
      sourceRecord("exchange","ExchangeRate API",exchange.status,"FX rates","https://open.er-api.com",gen),
    ],
  };
}

async function loadDashboardPayload() {
  // Three-tier fetch: live server → pre-baked static JSON → client-only fallback.
  // Live server: works in local dev with `node server.mjs`.
  // Static JSON: works on GitHub Pages (written by build.mjs at deploy time).
  // Client fallback: works anywhere, even fully offline, using data.js constants.
  async function fetchDashboardJson() {
    try {
      return await fetchJson("/api/dashboard", 8000);
    } catch {
      // Live server unavailable — try the pre-baked static snapshot.
      return await fetchJson("./api/dashboard.json", 10000);
    }
  }

  try {
    const [payload, exchange] = await Promise.all([
      fetchDashboardJson(),
      loadExchangeRates(),
    ]);
    return {
      ...payload,
      exchange,
      sentiment: computeSentiment(payload.news?.items ?? []),
      mapLayers: buildMapLayers(),
    };
  } catch (error) {
    console.warn("IOC API + static snapshot unavailable, using client fallback payload.", error);
    return buildFallbackDashboard();
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

function renderClocks(clocks) {
  $("clockGrid").innerHTML = clocks.map(c=>`<div class="clock-card"><div class="country">${c.city} [${c.offset}]</div><div class="time">${clockTime(c.timezone)}</div></div>`).join("");
}

function renderMetrics(metrics) {
  $("metricBand").innerHTML = metrics.slice(0,12).map(m=>`
    <article class="metric-card" data-tone="${m.tone||'neutral'}">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${num(m.value,m.value%1===0?0:1)}<span class="metric-unit">${m.unit||''}</span></div>
      <div class="metric-context">${m.context||''}</div>
      <div class="sparkline-shell">${m.history?sparkline(m.history,m.tone):''}</div>
    </article>`).join("");
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
      maxBounds: SITE.mapMaxBounds, maxBoundsViscosity: 1.0,
      minZoom: SITE.minZoom, maxZoom: SITE.maxZoom,
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
    renderFocusToggle();
    renderUrbanLayerToggle();

    if (window.ResizeObserver) {
      state.mapResizeObserver = new ResizeObserver(() => queueMapResize());
      state.mapResizeObserver.observe(mc);
      if (mc.parentElement) state.mapResizeObserver.observe(mc.parentElement);
    }
  }
  state.boundaryLayerGroup.clearLayers();
  state.labelLayerGroup.clearLayers();
  state.markerLayerGroup.clearLayers();

  payload.jurisdictions.items.forEach(item => {
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

  const hydroStations = payload.mapScene?.hydroStations || payload.infobanjir?.stations || [];
  hydroStations.forEach(s => {
    if (s.lat == null || s.lon == null) return;
    state.hydroStationsByName.set(s.id, s);
    const color = hydroBandColors[s.band] || "#8aa2c8";
    const isLive = s.waterLevelM != null;
    const hasCatchment = s.catchment?.status === "snapped";
    const radius = s.band === "danger" ? 9 : s.band === "warning" ? 8 : s.band === "alert" ? 7 : isLive ? 6 : 5;
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
        `<strong>${s.name}</strong><br>${s.basin} · ${s.council}<br>Level: ${s.waterLevelM != null ? s.waterLevelM + " m" : "reference"}<br>Posture: <strong>${s.bandLabel}</strong><br>Thresholds A/W/D: ${s.thresholds.alert}/${s.thresholds.warning}/${s.thresholds.danger} m${catchmentLine}`,
        { className: "marker-tooltip", direction: "top" },
      )
      .on("click", () => highlightCatchment(s, color))
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

  if (!state.hasInitialMapFit) {
    state.map.setView(SITE.mapCenter, SITE.mapZoom);
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

function renderFocusToggle() {
  const el = $("focusToggle");
  const modes = [{id:"all",label:t("allSectors")},{id:"pdw",label:t("padawan")}];
  el.innerHTML = modes.map(m=>`<button data-id="${m.id}" class="${m.id==='all'?'active':''}">${m.label}</button>`).join("");
  el.querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
    if(btn.dataset.id==="pdw") state.map.setView([1.45,110.3],13);
    else state.map.setView(SITE.mapCenter,SITE.mapZoom);
    el.querySelectorAll("button").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    queueMapResize();
  }));
}

function renderUrbanLayerToggle() {
  const el = $("watchpointList");
  if (!el) return;
  // We repurpose the watchpoint list area or add a new one in the UI later
  // For now, let's keep it in the map controls if possible, but the HTML doesn't have a dedicated slot
  // I'll add a temporary container or append to map-controls
  let container = $("urbanLayerToggle");
  if (!container) {
    container = document.createElement("div");
    container.id = "urbanLayerToggle";
    container.className = "segmented-control urban-toggle";
    document.querySelector(".map-controls").appendChild(container);
  }

  container.innerHTML = URBAN_LAYERS.map(l => `<button data-id="${l.id}" class="${l.active ? 'active' : ''}">${t(l.id === 'land_use' ? 'landUse' : l.id === 'flood_risk' ? 'floodRisk' : l.id === 'drainage' ? 'drainage' : l.label)}</button>`).join("");
  
  container.querySelectorAll("button").forEach(btn => btn.addEventListener("click", async () => {
    const layer = URBAN_LAYERS.find(l => l.id === btn.dataset.id);
    if (!layer) return;

    layer.active = !layer.active;
    btn.classList.toggle("active", layer.active);

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
      // Try live API first, then pre-baked static JSON (GitHub Pages).
      let res = await fetch(layer.url).catch(() => null);
      if (!res || !res.ok) {
        const staticUrl = `./api/layers/${layer.id}.json`;
        res = await fetch(staticUrl);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const fc = await res.json();
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

function renderExchange(exchange) {
  const el = $("exchangeList");
  if (!el) return;
  el.innerHTML = exchange.pairs.map(p=>`
    <div class="fx-row">
      <span class="fx-code">${p.code}</span>
      <span class="fx-rate">${p.rate < 1 ? p.rate.toFixed(4) : num(p.rate, p.rate > 100 ? 0 : 2)}</span>
    </div>`).join("");
}

function renderAirportStats(airport) {
  const el = $("airportStats");
  if (!el) return;
  const fl = airport.liveFlights || [];
  const arrivals = fl.filter(f=>f.type==="arrival");
  const departures = fl.filter(f=>f.type==="departure");
  el.innerHTML = `
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
      </div>`).join("")}
    </div>`;
}

function renderNewsIntake(news) {
  const el = $("sentimentPanel");
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

function renderSatelliteDeck(satellites) {
  const grid = $("satelliteGrid");
  const meta = $("satelliteMeta");
  if (!grid || !meta || !satellites?.length) return;

  const setActive = (index) => {
    const activeIndex = Math.max(0, Math.min(index, satellites.length - 1));
    state.activeSatelliteIndex = activeIndex;
    const sat = satellites[activeIndex];

    // Custom descriptions for Greater Kuching context
    let contextDesc = "Orbital telemetry for urban planning.";
    if (sat.id === "true-color") contextDesc = "Surface optic // Real-time cloud and haze verification for Padawan.";
    if (sat.id === "precipitation") contextDesc = "IMERG Rainfall Density // Critical for flood pre-emption in Batu Kawa.";
    if (sat.id === "aerosol") contextDesc = "Aerosol Depth // Transboundary haze monitoring for Greater Kuching.";
    if (sat.id === "night-lights") contextDesc = "Urban Luminosity // Tracking sprawl into Padawan and Bau sectors.";
    if (sat.id === "vegetation") contextDesc = "NDVI Greyscale // Green City Action Plan (GCAP) canopy audit.";

    meta.innerHTML = `
      <div class="satellite-copy">
        <strong>${sat.title}</strong>
        <span>${contextDesc}</span>
      </div>
      <div class="satellite-stamp">
        <strong>${sat.source || "Satellite feed"}</strong>
        <span>${formatShortStamp(sat.updatedAt || nowIso())}</span>
        <a class="satellite-open" href="${sat.imageUrl}" target="_blank" rel="noopener">OPEN FULL ◹</a>
      </div>`;
    grid.querySelectorAll(".satellite-card").forEach((node, idx) => node.classList.toggle("active", idx === activeIndex));
  };

  grid.innerHTML = satellites.map((sat, index) => `
    <button type="button" class="satellite-card ${index === 0 ? "active" : ""}" data-idx="${index}" aria-label="Activate ${sat.title}">
      <img src="${sat.imageUrl}" alt="${sat.title}" />
      <span class="satellite-card-copy">
        <strong>${sat.title}</strong>
        <span>${sat.source || "NASA GIBS"}</span>
      </span>
    </button>`).join("");

  // Event delegation: one listener on the grid survives any future re-render of children.
  if (!grid.dataset.bound) {
    grid.addEventListener("click", (event) => {
      const card = event.target.closest(".satellite-card");
      if (!card || !grid.contains(card)) return;
      const idx = Number(card.dataset.idx);
      if (Number.isFinite(idx)) setActive(idx);
    });
    grid.dataset.bound = "1";
  }

  setActive(state.activeSatelliteIndex ?? 0);
}

function renderOfficialPulse(payload) {
  const el = $("officialPulse");
  if (!el || !payload.openDosmStats?.updatedAt) return;
  const dosm = payload.openDosmStats;
  const swk = payload.sarawakStats;
  
  el.innerHTML = `
    <div class="official-pulse-block">
      <div class="pulse-header">
        <span class="pulse-label">Official Census Sync // ${dosm.year}</span>
        <div class="pulse-indicator"></div>
      </div>
      <div class="pulse-metagrid">
        <div class="pulse-stat">
          <strong>${num(dosm.latestSarawakPop, 0)}</strong>
          <span>Sarawak Pop</span>
        </div>
        <div class="pulse-stat">
          <strong>${swk.datasetCount || 0}</strong>
          <span>CKAN Datasets</span>
        </div>
      </div>
    </div>`;
}

function renderDashboard(payload) {
  state.payload = payload;
  if (payload.site?.title) document.title = payload.site.title;
  if (payload.site?.title) $("titleText").textContent = payload.site.title;
  if (payload.site?.subtitle) $("subtitleText").textContent = payload.site.subtitle;
  $("summaryLead").textContent = payload.summary.headline;
  $("generatedAt").textContent = `T/${new Date(payload.generatedAt).toLocaleTimeString()} // SYNC`;
  $("mapSummary").textContent = payload.summary.detail;

  renderClocks(payload.timeSignal.asean);
  renderMetrics(payload.metrics);
  renderMap(payload);
  renderExchange(payload.exchange);
  renderAirportStats(payload.airport);
  renderNewsIntake(payload.news);
  renderOfficialPulse(payload);

  // Directives
  $("operationList").innerHTML = payload.operations.map(o=>`
    <article class="operation-card" data-severity="${o.severity}">
      <div class="kicker">${o.owner}</div><strong>${o.title}</strong>
      <div class="operation-detail">${o.detail}</div>
    </article>`).join("");

  // Ticker
  const news = payload.news.items.slice(0,8);
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
        <div class="meta">${(ib.highestBandLabel || "Reference").toUpperCase()} · ${ib.status === "live" ? "live feed" : "reference hold"}</div>
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
        <div class="meta">${apims.stations.map(s => `${s.label}: ${s.aqi ?? "—"}`).join(" · ")}</div>
        <div class="meta">src: aqicn.org · ${apims.tokenMode} token</div>
      </div>`;
  }

  $("signalCards").innerHTML = signalHtml + groundHtml;

  // Trends
  const trendItems = payload.trends.localMatches?.length ? payload.trends.localMatches.slice(0, 6) : [];
  $("trendList").innerHTML = trendItems.length
    ? trendItems.map(t=>`
      <div class="trend-item ${t.locality?.score ? "" : "is-external"}"><strong>${t.title}</strong>
      <div class="meta">> ${t.trafficLabel} // ${t.locality?.label || "Context"}</div></div>`).join("")
    : `<div class="trend-empty"><strong>Local trend watch is quiet</strong><div class="meta">${payload.trends.summary}</div></div>`;

  // Jurisdictions
  $("jurisdictionCards").innerHTML = payload.jurisdictions.items.map(j=>`
    <div class="municipality-tag" style="border-color:${j.accent};color:${j.accent}">${j.code} // ${j.areaKm2}km2</div>`).join("");

  // Map legend
  const hydroLegend = (payload.mapScene?.hydroBands || []).filter(b => b.id !== "reference").map(b => `<span class="legend-item"><span class="legend-dot" style="background:${b.color}"></span>${b.label}</span>`).join("");
  $("mapLegend").innerHTML = payload.jurisdictions.items.map(j=>`<span class="legend-item"><span class="legend-dot" style="background:${j.accent}"></span>${j.code}</span>`).join("") + `<span class="legend-item"><span class="legend-dot" style="background:#1e90ff"></span>River</span>` + hydroLegend;
  $("watchpointList").innerHTML = MAP_WATCHPOINTS.map(w=>`<span>${w}</span>`).join("");

  // Satellites
  renderSatelliteDeck(payload.satellites);

  // Sources
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
  // Re-render focus toggle labels
  if (state.map) renderFocusToggle();
  // Highlight active lang button
  document.querySelectorAll(".lang-btn").forEach(b => b.classList.toggle("active", b.dataset.lang === lang));
}

// --- Export ---
function setupExport() {
  $("exportSitrep")?.addEventListener("click", () => {
    if (!state.payload) return;
    const p = state.payload;
    const lines = [
      `SITREP // GREATER KUCHING IOC`, `Generated: ${p.generatedAt}`, ``,
      `POSTURE: ${p.summary.posture.toUpperCase()}`, p.summary.headline, ``, `DETAIL: ${p.summary.detail}`, ``,
      `METRICS:`, ...p.metrics.map(m=>`  ${m.label}: ${m.value} ${m.unit} (${m.context})`), ``,
      `OPERATIONS:`, ...p.operations.map(o=>`  [${o.severity.toUpperCase()}] ${o.owner}: ${o.title}`), ``,
      `EXCHANGE RATES (1 MYR):`, ...p.exchange.pairs.map(r=>`  ${r.code}: ${r.rate}`),
    ];
    const blob = new Blob([lines.join("\n")], { type:"text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `sitrep-kuching-${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  });
}

// --- Boot ---
async function boot() {
  try {
    const payload = await loadDashboardPayload();
    renderDashboard(payload);
  } catch (err) { console.error("IOC SYNC FAILURE", err); }
}

// Init controls
setupExport();
$("themeToggle")?.addEventListener("click", toggleTheme);
document.querySelectorAll(".lang-btn").forEach(btn => btn.addEventListener("click", () => setLang(btn.dataset.lang)));

boot();
setInterval(boot, 60000);
setInterval(() => { if (state.payload) renderClocks(state.payload.timeSignal.asean); }, 1000);
