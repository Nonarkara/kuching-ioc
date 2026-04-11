import {
  SITE, JURISDICTIONS, LOCAL_MARKERS, SARAWAK_RIVER, ASEAN_CLOCKS,
  MAP_WATCHPOINTS, AIRPORT_FALLBACK_ROUTES, FALLBACK_NEWS, FALLBACK_TRENDS,
  WEATHER_FALLBACK, AIR_FALLBACK, CITY_DEMOGRAPHICS, TRANSLATIONS,
  round, aqiBand, weatherCodeLabel, kmBetween, classifyAircraft,
  sourceRecord, buildSatelliteCards, buildMapLayers,
} from "./data.js";

// --- State ---
const state = {
  map: null, boundaryLayerGroup: null, markerLayerGroup: null, labelLayerGroup: null,
  tileLayers: new Map(), activeLayerId: "dark", payload: null, hasInitialMapFit: false,
  theme: "dark", lang: "en",
};

// --- DOM ---
const $ = id => document.getElementById(id);

// --- Utilities ---
const nowIso = () => new Date().toISOString();
const num = (v, d = 0) => Number(v ?? 0).toLocaleString("en-MY", { maximumFractionDigits: d, minimumFractionDigits: d });
const clockTime = tz => new Intl.DateTimeFormat("en-MY", { hour:"2-digit",minute:"2-digit",second:"2-digit",hour12:false,timeZone:tz }).format(new Date());

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

async function buildDashboard() {
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

  if (!state.hasInitialMapFit) {
    state.map.setView(SITE.mapCenter, SITE.mapZoom);
    state.hasInitialMapFit = true;
  }
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
  }));
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

function renderSentiment(sentiment, news) {
  const el = $("sentimentPanel");
  if (!el) return;
  const total = news.length || 1;
  el.innerHTML = `
    <div class="sentiment-bar">
      <div class="sent-pos" style="width:${sentiment.positive}%"></div>
      <div class="sent-neu" style="width:${sentiment.neutral}%"></div>
      <div class="sent-neg" style="width:${sentiment.negative}%"></div>
    </div>
    <div class="sentiment-labels">
      <span class="sent-label pos">${sentiment.positive}% positive</span>
      <span class="sent-label">${sentiment.label}</span>
      <span class="sent-label neg">${sentiment.negative}% negative</span>
    </div>`;
}

function renderDashboard(payload) {
  state.payload = payload;
  $("summaryLead").textContent = payload.summary.headline;
  $("generatedAt").textContent = `T/${new Date(payload.generatedAt).toLocaleTimeString()} // SYNC`;
  $("mapSummary").textContent = payload.summary.detail;

  renderClocks(payload.timeSignal.asean);
  renderMetrics(payload.metrics);
  renderMap(payload);
  renderExchange(payload.exchange);
  renderAirportStats(payload.airport);
  renderSentiment(payload.sentiment, payload.news.items);

  // Directives
  $("operationList").innerHTML = payload.operations.map(o=>`
    <article class="operation-card" data-severity="${o.severity}">
      <div class="kicker">${o.owner}</div><strong>${o.title}</strong>
      <div class="operation-detail">${o.detail}</div>
    </article>`).join("");

  // Ticker
  const news = payload.news.items.slice(0,8);
  $("newsRail").innerHTML = [...news,...news].map(n=>`<span class="ticker-item"><span class="ticker-source">${n.source}</span> ${n.title}</span>`).join("");

  // Signals
  $("signalCards").innerHTML = payload.metrics.slice(0,4).map(s=>`
    <div class="signal-card"><strong>${s.id.toUpperCase()} // ${s.label.toUpperCase()}</strong>
    <div class="val">${num(s.value,1)}<sup>${s.unit}</sup></div>
    <div class="meta">${s.context||''}</div></div>`).join("");

  // Trends
  $("trendList").innerHTML = payload.trends.items.slice(0,6).map(t=>`
    <div class="trend-item"><strong>${t.title}</strong>
    <div class="meta">> ${t.trafficLabel} // ${t.locality.label}</div></div>`).join("");

  // Jurisdictions
  $("jurisdictionCards").innerHTML = payload.jurisdictions.items.map(j=>`
    <div class="municipality-tag" style="border-color:${j.accent};color:${j.accent}">${j.code} // ${j.areaKm2}km2</div>`).join("");

  // Map legend
  $("mapLegend").innerHTML = payload.jurisdictions.items.map(j=>`<span class="legend-item"><span class="legend-dot" style="background:${j.accent}"></span>${j.code}</span>`).join("") + `<span class="legend-item"><span class="legend-dot" style="background:#1e90ff"></span>River</span>`;
  $("watchpointList").innerHTML = MAP_WATCHPOINTS.map(w=>`<span>${w}</span>`).join("");

  // Satellites
  const sats = payload.satellites;
  if (sats?.length) {
    $("satelliteImage").src = sats[0].imageUrl;
    $("satelliteThumbs").innerHTML = sats.map((s,i)=>`<img src="${s.imageUrl}" alt="${s.title}" data-idx="${i}" class="${i===0?'active':''}" />`).join("");
    $("satelliteThumbs").querySelectorAll("img").forEach(img=>img.addEventListener("click",()=>{
      $("satelliteImage").src = sats[Number(img.dataset.idx)].imageUrl;
      $("satelliteThumbs").querySelectorAll("img").forEach(t=>t.classList.remove("active"));
      img.classList.add("active");
    }));
    $("satelliteToggle").innerHTML = sats.map((s,i)=>`<button data-idx="${i}" class="${i===0?'active':''}">${s.title}</button>`).join("");
    $("satelliteToggle").querySelectorAll("button").forEach(btn=>btn.addEventListener("click",()=>{
      $("satelliteImage").src = sats[Number(btn.dataset.idx)].imageUrl;
      $("satelliteToggle").querySelectorAll("button").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
    }));
  }

  // Sources
  $("sourceList").innerHTML = payload.sources.map(s=>`<div class="source-item"><span class="source-name">${s.name}</span><span class="source-status" data-status="${s.status}">${s.status}</span></div>`).join("");
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
    const payload = await buildDashboard();
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
