// data.js — Constants, fallback data, and helper functions
// Daniel's Goh Greater Kuching Intelligent Operation Center (IOC)

export const SITE = {
  title: "Greater Kuching Intelligent Operation Center",
  titleShort: "Greater Kuching IOC",
  subtitle: "In collaboration with depa, PMUA, Axiom, ReTL, Thailand Smart City Office & ASEAN Smart Cities Network",
  timezone: "Asia/Kuala_Lumpur",
  region: "Kuching, Sarawak, Malaysia",
  airport: { code: "KCH", icao: "WBGG", name: "Kuching International Airport", lat: 1.4847, lon: 110.347 },
  focus: { name: "Padawan", lat: 1.4475, lon: 110.3305 },
  mapCenter: [1.53, 110.35],
  mapZoom: 12,
  mapBounds: { minLat: 1.29, maxLat: 1.74, minLon: 110.14, maxLon: 110.62 },
  mapMaxBounds: [[1.15, 109.9], [1.85, 110.7]],
  minZoom: 10,
  maxZoom: 18,
  partners: [
    { name: "PMUA", asset: "./assets/pmua.jpeg" },
    { name: "depa", asset: "./assets/depa.jpg" },
    { name: "Axiom", asset: "./assets/axiom.png" },
    { name: "ReTL", asset: "./assets/retl.png" },
    { name: "Smart City Thailand", asset: "./assets/smart-city-thailand.jpg" },
    { name: "ASCN", asset: "./assets/ascn.png" },
  ],
};

export const JURISDICTIONS = [
  {
    id: "dbku", code: "DBKU", name: "Kuching North",
    officialName: "Dewan Bandaraya Kuching Utara",
    accent: "#0d6efd", areaKm2: 369.48, population: 235966, properties: 43575,
    fallbackPolygons: [[[110.168,1.583],[110.213,1.651],[110.308,1.71],[110.421,1.72],[110.535,1.672],[110.59,1.605],[110.575,1.565],[110.496,1.542],[110.417,1.55],[110.34,1.565],[110.272,1.57],[110.215,1.565]]],
  },
  {
    id: "mbks", code: "MBKS", name: "Kuching South",
    officialName: "Majlis Bandaraya Kuching Selatan",
    accent: "#6c757d", areaKm2: 61.53, population: null, properties: null,
    fallbackPolygons: [[[110.307,1.53],[110.339,1.561],[110.372,1.564],[110.405,1.553],[110.409,1.518],[110.392,1.491],[110.346,1.485],[110.313,1.503]]],
  },
  {
    id: "mpp", code: "MPP", name: "Padawan",
    officialName: "Padawan Municipal Council",
    accent: "#b48a00", areaKm2: 984.34, population: 260058, properties: 83744,
    fallbackPolygons: [[[110.15,1.45],[110.215,1.51],[110.254,1.555],[110.305,1.54],[110.352,1.515],[110.39,1.49],[110.43,1.478],[110.487,1.49],[110.544,1.465],[110.603,1.416],[110.6,1.342],[110.532,1.305],[110.447,1.298],[110.361,1.322],[110.293,1.34],[110.224,1.387],[110.171,1.41]]],
  },
];

export const LOCAL_MARKERS = [
  { id: "waterfront", name: "Kuching Waterfront", category: "civic", lat: 1.5584, lon: 110.3445 },
  { id: "satok", name: "Satok Market", category: "market", lat: 1.5621, lon: 110.3224 },
  { id: "padungan", name: "Padungan", category: "urban-core", lat: 1.5496, lon: 110.3599 },
  { id: "petra-jaya", name: "Petra Jaya", category: "north-bank", lat: 1.5843, lon: 110.3527 },
  { id: "batu-kawa", name: "Batu Kawa", category: "growth-corridor", lat: 1.5115, lon: 110.2872 },
  { id: "kota-padawan", name: "Kota Padawan", category: "padawan-core", lat: 1.4475, lon: 110.3305 },
  { id: "siburan", name: "Siburan", category: "southern-edge", lat: 1.3962, lon: 110.3608 },
  { id: "airport", name: "KCH Airport", category: "airport", lat: 1.4847, lon: 110.347 },
  { id: "samarahan", name: "Samarahan", category: "education", lat: 1.4621, lon: 110.4321 },
  { id: "tabuan-jaya", name: "Tabuan Jaya", category: "residential", lat: 1.5280, lon: 110.3650 },
];

export const SARAWAK_RIVER = [
  [110.275,1.565],[110.298,1.57],[110.322,1.577],[110.347,1.572],
  [110.366,1.566],[110.391,1.568],[110.418,1.579],[110.444,1.585],
];

export const ASEAN_CLOCKS = [
  { id: "brunei", city: "Bandar Seri Begawan", timezone: "Asia/Brunei", offset: "UTC+8" },
  { id: "cambodia", city: "Phnom Penh", timezone: "Asia/Phnom_Penh", offset: "UTC+7" },
  { id: "indonesia", city: "Jakarta", timezone: "Asia/Jakarta", offset: "UTC+7" },
  { id: "laos", city: "Vientiane", timezone: "Asia/Vientiane", offset: "UTC+7" },
  { id: "malaysia", city: "Kuala Lumpur", timezone: "Asia/Kuala_Lumpur", offset: "UTC+8" },
  { id: "myanmar", city: "Yangon", timezone: "Asia/Yangon", offset: "UTC+6:30" },
  { id: "philippines", city: "Manila", timezone: "Asia/Manila", offset: "UTC+8" },
  { id: "singapore", city: "Singapore", timezone: "Asia/Singapore", offset: "UTC+8" },
  { id: "thailand", city: "Bangkok", timezone: "Asia/Bangkok", offset: "UTC+7" },
  { id: "vietnam", city: "Ho Chi Minh City", timezone: "Asia/Ho_Chi_Minh", offset: "UTC+7" },
];

export const MAP_WATCHPOINTS = [
  "Waterfront","Petra Jaya","Satok","3rd Mile","Stutong",
  "Batu Kawa","Penrissen","Kota Padawan","Siburan","KCH Airport",
];

export const AIRPORT_FALLBACK_ROUTES = [
  { callsign: "AK5202", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 19, distanceKm: 62, altitudeM: 3100 },
  { callsign: "MH2522", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 33, distanceKm: 88, altitudeM: 4200 },
  { callsign: "FY5354", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 47, distanceKm: 111, altitudeM: 5100 },
  { callsign: "OD1602", origin: "Johor Bahru", type: "arrival", etaMinutes: 56, distanceKm: 124, altitudeM: 6200 },
  { callsign: "AK5433", destination: "Kuala Lumpur", type: "departure", etaMinutes: 8, distanceKm: 18, altitudeM: 1800 },
  { callsign: "MH2804", destination: "Sibu", type: "departure", etaMinutes: 14, distanceKm: 29, altitudeM: 2600 },
];

export const FALLBACK_NEWS = [
  { title: "MBKS rodding works clear Jalan Pecky drains while securing funds for full upgrade", source: "MBKS / DayakDaily", publishedAt: "2026-03-27T00:00:00.000Z", lane: "Drainage", sentiment: "neutral", isOfficial: true, language: "en", languageBadge: "OFF" },
  { title: "DBKU conducts emergency drill for traffic wardens across Kuching North", source: "DBKU", publishedAt: "2026-02-11T00:00:00.000Z", lane: "Traffic", sentiment: "positive", isOfficial: true, language: "en", languageBadge: "OFF" },
  { title: "MBKS and DBKU asked to find an ideal spot for a night market", source: "Borneo Post", publishedAt: "2026-02-12T00:00:00.000Z", lane: "Public realm", sentiment: "positive", isOfficial: false, language: "en", languageBadge: "EN" },
  { title: "Padawan infrastructure upgrade tenders issued for Kampung Telaga Air and Desa Wira", source: "MPP", publishedAt: "2026-03-10T00:00:00.000Z", lane: "Infrastructure", sentiment: "positive", isOfficial: true, language: "en", languageBadge: "OFF" },
  { title: "Sarawak to build integrated waste management facility in Kuching", source: "Borneo Post", publishedAt: "2026-03-15T00:00:00.000Z", lane: "Environment", sentiment: "positive", isOfficial: false, language: "en", languageBadge: "EN" },
  { title: "Banjir kilat melanda kawasan rendah berhampiran Batu Kawa selepas hujan lebat", source: "DayakDaily", publishedAt: "2026-03-22T00:00:00.000Z", lane: "Flooding", sentiment: "negative", isOfficial: false, language: "ms", languageBadge: "BM" },
  { title: "MPP launches community composting programme across 6 wards", source: "MPP", publishedAt: "2026-03-20T00:00:00.000Z", lane: "Sustainability", sentiment: "positive", isOfficial: true, language: "en", languageBadge: "OFF" },
  { title: "Tourism arrivals to Kuching up 12% in Q1 compared to last year", source: "Bernama", publishedAt: "2026-04-01T00:00:00.000Z", lane: "Tourism", sentiment: "positive", isOfficial: false, language: "en", languageBadge: "EN" },
];

export const FALLBACK_TRENDS = [
  { id: "sarawak-day", title: "Sarawak Day 2026", trafficLabel: "200K+", trafficValue: 200000, locality: { label: "Local", tone: "focus", score: 2 } },
  { id: "ringgit-usd", title: "Ringgit USD", trafficLabel: "100K+", trafficValue: 100000, locality: { label: "Malaysia", tone: "neutral", score: 1 } },
  { id: "kuching-flood", title: "Kuching flood warning", trafficLabel: "50K+", trafficValue: 50000, locality: { label: "Local", tone: "focus", score: 2 } },
  { id: "borneo-haze", title: "Borneo haze index", trafficLabel: "20K+", trafficValue: 20000, locality: { label: "Local", tone: "focus", score: 2 } },
  { id: "malaysia-budget", title: "Malaysia Budget 2027", trafficLabel: "200K+", trafficValue: 200000, locality: { label: "Malaysia", tone: "neutral", score: 1 } },
  { id: "epl-results", title: "EPL Results", trafficLabel: "500K+", trafficValue: 500000, locality: { label: "Global", tone: "muted", score: 0 } },
];

export const ECONOMY_FALLBACK = {
  status: "fallback",
  base: "MYR",
  pairs: [
    { code: "USD", rate: 0.2174, label: "US Dollar" },
    { code: "SGD", rate: 0.2891, label: "Singapore Dollar" },
    { code: "GBP", rate: 0.1720, label: "British Pound" },
    { code: "EUR", rate: 0.1990, label: "Euro" },
    { code: "CNY", rate: 1.5800, label: "Chinese Yuan" },
    { code: "THB", rate: 7.4200, label: "Thai Baht" },
    { code: "IDR", rate: 3380,   label: "Indonesian Rupiah" },
    { code: "JPY", rate: 32.80,  label: "Japanese Yen" },
  ],
  macro: {
    gdpGrowthPct: 4.4,
    sarawakGdpBnMyr: 138.2,
    cpiInflationPct: 1.8,
    unemploymentPct: 3.3,
  },
};

export const WEATHER_FALLBACK = {
  status: "fallback",
  current: { temperatureC: 30.8, apparentTemperatureC: 36.1, humidity: 74, windKph: 12.2, precipitationMm: 0.8, cloudCover: 64, weatherLabel: "Heat with convective rain risk", pressureHpa: 1008.4 },
  nextHours: [
    { time: "13:00", precipitationMm: 0.6, rainChance: 38, temperatureC: 31.1 },
    { time: "14:00", precipitationMm: 0.8, rainChance: 44, temperatureC: 31.4 },
    { time: "15:00", precipitationMm: 1.3, rainChance: 56, temperatureC: 30.7 },
    { time: "16:00", precipitationMm: 2.4, rainChance: 61, temperatureC: 29.6 },
    { time: "17:00", precipitationMm: 2.1, rainChance: 58, temperatureC: 28.9 },
    { time: "18:00", precipitationMm: 0.9, rainChance: 40, temperatureC: 28.2 },
  ],
  daily: { maxC: 32.2, minC: 24.7, rainTotalMm: 11.5, uvIndexMax: 9.4, sunrise: "06:24", sunset: "18:35" },
  history: [30.1,30.5,30.8,31.2,31.5,31.1,30.7,30.2,29.8,29.5,29.2,28.9,28.5,28.2,27.8,27.5,27.2,26.9,26.5,26.2,25.8,25.5,25.2,24.8],
};

export const AIR_FALLBACK = {
  status: "fallback",
  current: { aqi: 78, pm25: 24.4, pm10: 41.1, ozone: 71, no2: 12.0 },
  nextHours: [
    { time: "13:00", aqi: 74, pm25: 23.1 }, { time: "14:00", aqi: 76, pm25: 24.0 },
    { time: "15:00", aqi: 79, pm25: 24.8 }, { time: "16:00", aqi: 82, pm25: 25.6 },
    { time: "17:00", aqi: 77, pm25: 23.9 }, { time: "18:00", aqi: 71, pm25: 21.7 },
  ],
  history: [68,70,72,75,78,80,82,85,88,85,82,79,76,73,70,67,65,63,62,65,68,70,72,75],
};

// Kuching city demographics (trusted sources: Department of Statistics Malaysia, local council data)
export const CITY_DEMOGRAPHICS = {
  greaterKuchingPopulation: 800000,
  populationGrowthRate: 2.1,
  birthRate: 15.8, // per 1000 population (Sarawak avg)
  medianAge: 29.4,
  householdSize: 4.1,
  urbanizationRate: 78.2,
  greenCoverPct: 62.5, // percentage of land area with green cover
  parkAreaHa: 1240, // hectares of public parks
  waterBodiesPct: 8.3,
  literacyRate: 96.2,
  gdpPerCapitaUsd: 14200,
  unemploymentPct: 3.2,
  touristArrivals2025: 2100000,
  dailyWaterConsumptionMld: 580, // megalitres per day
  solidWasteTpd: 1200, // tonnes per day
  drainageNetworkKm: 485,
  roadNetworkKm: 2340,
};

export const URBAN_LAYERS = [
  { id: "land_use", label: "Land Use (CKAN)", type: "geojson", url: "/api/layers/land_use", color: "#4ade80", active: false },
  { id: "flood_risk", label: "Flood Risk (GCAP)", type: "geojson", url: "/api/layers/flood_risk", color: "#f87171", active: false },
  { id: "drainage", label: "Drainage (OSM)", type: "geojson", url: "/api/layers/drainage", color: "#60a5fa", active: false },
  { id: "transit", label: "Transit Network", type: "geojson", url: "/api/layers/transit", color: "#fbbf24", active: false },
  { id: "flood_zones", label: "Flood Zones (Historical)", type: "geojson", url: "/api/layers/flood_zones", color: "#ef4444", active: false },
  { id: "mpp_wards", label: "MPP Wards (Governance)", type: "geojson", url: "/api/layers/mpp_wards", color: "#a78bfa", active: false },
];

// Per-ward operational projects — hand-encoded from public Padawan council
// tender notices, GCAP plan items, and Sarawak DID Sungai Maong / Sg. Batu
// Kawa mitigation programmes. Each entry has a category, RM cost, lead
// contractor (where public), status, completion %, and a one-line note. The
// status values map to glow tones used in the ward-brief renderer.
//
// Categories: drainage · road · pond · slope · streetlight · landscape ·
//             public-toilet · refuse · field-ops
//
// To add or correct: append/edit per ward; the renderer is purely composition.
export const MPP_WARD_PROJECTS = {
  A: [ // Upper Padawan — Mambong, Bunan Gega, Pangkalan Empat
    { id: "A-2025-01", category: "drainage",   title: "Sg. Krokong tributary widening, Mambong",                 rmK: 2_400, status: "in-progress", pct: 62, contractor: "Syarikat Bina Padawan Sdn Bhd",  note: "Phase 2 of 3, completion Q3-2026" },
    { id: "A-2025-02", category: "road",       title: "Resurfacing Jln Mambong–Bunan Gega 4.2 km",               rmK: 1_850, status: "in-progress", pct: 41, contractor: "JKR Sarawak (concession)",        note: "Premix layer underway, base intact" },
    { id: "A-2025-03", category: "streetlight",title: "LED retrofit, Pangkalan Empat (412 poles)",                rmK:   780, status: "queued",      pct:  0, contractor: "Sarawak Energy",                   note: "Awaiting tender close 2026-05-12" },
  ],
  B: [ // Padawan town core, Jln Puncak Borneo
    { id: "B-2025-01", category: "pond",       title: "Tasik Padawan retention pond expansion",                   rmK: 14_000,status: "in-progress", pct: 28, contractor: "DID Sarawak / contractor TBA",     note: "Part of RM 58.5M Batu Kawa basin programme" },
    { id: "B-2025-02", category: "drainage",   title: "Jln Puncak Borneo culvert reinforcement (km 5–7)",         rmK:   620, status: "complete",    pct:100, contractor: "Hock Seng Lee",                    note: "Handed over 2026-03-19" },
    { id: "B-2025-03", category: "landscape",  title: "Padawan Heritage Plaza shade-tree planting",               rmK:   145, status: "in-progress", pct: 78, contractor: "Trienekens Sarawak (NGO partner)", note: "210 of 268 saplings planted" },
  ],
  D: [ // Siburan, Tarat
    { id: "D-2025-01", category: "drainage",   title: "Siburan lowlands monsoon drain upgrade",                   rmK: 3_200, status: "in-progress", pct: 55, contractor: "PPES Works",                       note: "After Jan 2025 multi-district event" },
    { id: "D-2025-02", category: "field-ops",  title: "Refuse-collection re-route, Tarat 17 RT",                  rmK:    72, status: "complete",    pct:100, contractor: "MPP Refuse Unit",                  note: "Twice-weekly cycle since 2026-02-01" },
    { id: "D-2025-03", category: "slope",      title: "Slope stabilisation, Bukit Berumbun",                      rmK:   910, status: "queued",      pct:  0, contractor: "tender open",                      note: "Risk-rated MEDIUM by JMG 2025" },
  ],
  FG: [ // Tebedu, Tepoi, Daha (border area)
    { id: "FG-2025-01",category: "road",       title: "Jln Tebedu–Daha shoulder reconstruction (8.6 km)",         rmK: 5_400, status: "in-progress", pct: 33, contractor: "Naim Engineering",                 note: "ASEAN-Indonesia border traffic priority" },
    { id: "FG-2025-02",category: "public-toilet",title: "Tebedu market block public-toilet refit",                 rmK:    95, status: "in-progress", pct: 88, contractor: "MPP in-house",                     note: "Reopens 2026-05" },
  ],
  H: [ // Stutong, Kota Padawan, Sungai Maong corridor
    { id: "H-2025-01", category: "drainage",   title: "Sg. Maong / Stutong junction backflow gates",              rmK: 8_700, status: "in-progress", pct: 47, contractor: "DID Sarawak / WCT Holdings",       note: "Will reduce 12,000-resident flood risk" },
    { id: "H-2025-02", category: "pond",       title: "Kota Padawan growth-corridor retention pond",              rmK: 12_300,status: "in-progress", pct: 18, contractor: "Hock Seng Lee",                    note: "Phase 1 of GCAP target 58 ha" },
    { id: "H-2025-03", category: "road",       title: "Jln Penrissen–7th Mile widening to 4 lanes",               rmK: 27_500,status: "in-progress", pct: 9,  contractor: "JKR Sarawak / Construct Joint",   note: "Land acquisition Phase 1 closing Jun 2026" },
    { id: "H-2025-04", category: "streetlight",title: "Stutong solar streetlight pilot (60 poles)",               rmK:   210, status: "complete",    pct:100, contractor: "Sarawak Energy R&D",               note: "92% uptime over 6 months" },
  ],
  I: [ // Batu Kawa, Matang Jaya
    { id: "I-2025-01", category: "pond",       title: "Taman Desa Wira retention pond (4-pond array)",            rmK: 58_500,status: "in-progress", pct: 14, contractor: "DID Sarawak / contractor TBA",     note: "Anchor of RM 58.5M Batu Kawa programme, 2027" },
    { id: "I-2025-02", category: "drainage",   title: "Matang Jaya peatland drainage capacity audit",             rmK:   340, status: "in-progress", pct: 92, contractor: "consultant: Perunding Tegas",      note: "Final report due 2026-05-30" },
    { id: "I-2025-03", category: "field-ops",  title: "Kg. Sinar Budi Baru sandbag pre-positioning station",      rmK:    48, status: "complete",    pct:100, contractor: "MPP Disaster Unit",                note: "200 bags pre-staged, monsoon-ready" },
  ],
  JL: [ // Siniawan, Singai (Bau-adjacent ward)
    { id: "JL-2025-01",category: "road",       title: "Jln Singai shoulder-line restoration 3.4 km",              rmK:   780, status: "complete",    pct:100, contractor: "PPES Works",                       note: "Includes new edge-line reflectors" },
    { id: "JL-2025-02",category: "landscape",  title: "Siniawan heritage street facade cleaning",                 rmK:   165, status: "in-progress", pct: 60, contractor: "MPP heritage unit",                note: "Tourism multiplier project with STB" },
  ],
  K: [ // Kuap, Beratok
    { id: "K-2025-01", category: "drainage",   title: "Beratok longkang upgrade (1.2 km)",                        rmK:   460, status: "in-progress", pct: 71, contractor: "Sarawak Plantation Eng.",         note: "Concrete-lined replacement" },
    { id: "K-2025-02", category: "field-ops",  title: "Kuap stray-dog catchment programme",                       rmK:    36, status: "in-progress", pct: 25, contractor: "MPP Vet Unit",                     note: "Coordinated with SSPCA" },
  ],
  M: [ // Bengoh, Krokong (upper catchment)
    { id: "M-2025-01", category: "slope",      title: "Bengoh dam access-road slope repair",                       rmK: 1_240, status: "queued",      pct:  0, contractor: "tender open",                      note: "After Apr 2026 minor slip" },
    { id: "M-2025-02", category: "field-ops",  title: "Krokong weather-station maintenance",                       rmK:    18, status: "complete",    pct:100, contractor: "MET Sarawak",                      note: "Critical upstream sentinel" },
  ],
  NPQ: [ // Lower Padawan / Sungai Moyan transition
    { id: "NPQ-2025-01",category:"drainage",   title: "Sg. Moyan tidal-flap valve replacement",                    rmK: 1_900, status: "in-progress", pct: 38, contractor: "DID Sarawak",                      note: "Reduces tidal back-up at high water" },
    { id: "NPQ-2025-02",category:"refuse",     title: "Lower-Padawan transfer station upgrade",                    rmK:   720, status: "in-progress", pct: 52, contractor: "Trienekens Sarawak",               note: "Doubles compaction capacity" },
  ],
};

export const RIVER_BYPASS_PROJECT = {
  name: "Sarawak River Bypass Channel",
  budget: "RM 2.48 billion",
  anchor: "Batu Kawa → Salak River (South China Sea)",
  lengthKm: 8,
  phases: [
    { id: 1, label: "Design & Land Acquisition", period: "2025–2026", status: "active" },
    { id: 2, label: "Main Excavation & Lining", period: "2027–2030", status: "planned" },
    { id: 3, label: "Commissioning & Handover", period: "2031–2033", status: "planned" },
  ],
  benefit: "Diverts 60% excess Sarawak River flow, protecting Batu Kawa, Matang, and Kuching South.",
  batu_kawa_mitigation: { budget: "RM 58.5M", ponds: 4, targetHa: 58, completion: 2027 },
};

// i18n translations
export const TRANSLATIONS = {
  en: {
    title: "Greater Kuching Intelligent Operation Center",
    subtitle: "In collaboration with depa, PMUA, Axiom, ReTL, Thailand Smart City Office & ASCN",
    intelRail: "INTEL RAIL", atomicSync: "Atomic Sync", aseanDesks: "ASEAN Desks",
    radar: "Radar // Greater Kuching", telemetry: "Telemetry", envSignals: "Env Signals",
    intelligence: "Intelligence", searchPulse: "Search Pulse", tactical: "Tactical",
    directives: "Directives", orbitalView: "Orbital View", satelliteOptic: "Satellite Optic",
    groundTruth: "Ground Truth", sourceStack: "Source Stack", assetMap: "Asset Map",
    jurisdictions: "Jurisdictions", allSectors: "All Sectors", padawan: "Padawan",
    commandExport: "COMMAND EXPORT", sysOperational: "SYS: OPERATIONAL",
    exchange: "Exchange // MYR", cityPulse: "City Pulse", demographics: "Demographics",
    airport: "Airport // KCH", flightTracker: "Flight Tracker",
    landUse: "Land Use", floodRisk: "Flood Risk", drainage: "Drainage", officialStats: "Official Stats",
    growthRing: "Growth Ring", urbanSprawl: "Urban Sprawl",
    governance: "Municipal Governance", councillors: "Councillors // MPP 2025–2028",
    chairman: "Chairman", deputy: "Deputy Chairman", ward: "Ward", portfolio: "Portfolio",
    phone: "Contact", allZones: "All Zones",
    localityExplorer: "Locality Explorer // Padawan", locality: "Locality", code: "Code",
    stateConstituency: "State Seat", parliamentConstituency: "Parliament Seat",
    residential: "Residential", commercial: "Commercial", industrial: "Industrial", exempted: "Exempted",
    totalLocalities: "Total Localities", stateSeats: "State Seats", parliamentSeats: "Parliament Seats",
    filterBy: "Filter by", searchLocality: "Search locality or code…",
    allWards: "All Wards", allConstituencies: "All Constituencies", allPropertyTypes: "All Types",
    showingResults: "Showing", of: "of",
  },
  ms: {
    title: "Pusat Operasi Pintar Greater Kuching",
    subtitle: "Kerjasama bersama depa, PMUA, Axiom, ReTL, Pejabat Bandar Pintar Thailand & ASCN",
    intelRail: "REL INTEL", atomicSync: "Sinkronisasi", aseanDesks: "Meja ASEAN",
    radar: "Radar // Greater Kuching", telemetry: "Telemetri", envSignals: "Isyarat Alam",
    intelligence: "Perisikan", searchPulse: "Denyut Carian", tactical: "Taktikal",
    directives: "Arahan", orbitalView: "Pandangan Orbital", satelliteOptic: "Optik Satelit",
    groundTruth: "Kebenaran Lapangan", sourceStack: "Sumber Data", assetMap: "Peta Aset",
    jurisdictions: "Bidang Kuasa", allSectors: "Semua Sektor", padawan: "Padawan",
    commandExport: "EKSPORT ARAHAN", sysOperational: "SYS: BEROPERASI",
    exchange: "Tukaran // MYR", cityPulse: "Denyut Bandar", demographics: "Demografi",
    airport: "Lapangan Terbang // KCH", flightTracker: "Pengesan Penerbangan",
    landUse: "Guna Tanah", floodRisk: "Risiko Banjir", drainage: "Saliran", officialStats: "Statistik Rasmi",
    growthRing: "Gelang Pertumbuhan", urbanSprawl: "Serakan Bandar",
    governance: "Tadbir Urus Perbandaran", councillors: "Ahli Majlis // MPP 2025–2028",
    chairman: "Pengerusi", deputy: "Timbalan Pengerusi", ward: "Zon", portfolio: "Portfolio",
    phone: "Hubungan", allZones: "Semua Zon",
    localityExplorer: "Penjelajah Kawasan // Padawan", locality: "Kawasan", code: "Kod",
    stateConstituency: "DUN", parliamentConstituency: "Parlimen",
    residential: "Kediaman", commercial: "Komersial", industrial: "Perindustrian", exempted: "Dikecualikan",
    totalLocalities: "Jumlah Kawasan", stateSeats: "Kerusi DUN", parliamentSeats: "Kerusi Parlimen",
    filterBy: "Tapis mengikut", searchLocality: "Cari kawasan atau kod…",
    allWards: "Semua Zon", allConstituencies: "Semua Kawasan", allPropertyTypes: "Semua Jenis",
    showingResults: "Menunjukkan", of: "daripada",
  },
  zh: {
    title: "大古晋智能运营中心",
    subtitle: "与depa、PMUA、Axiom、ReTL、泰国智慧城市办公室及东盟智慧城市网络合作",
    intelRail: "情报频道", atomicSync: "原子同步", aseanDesks: "东盟时区",
    radar: "雷达 // 大古晋", telemetry: "遥测", envSignals: "环境信号",
    intelligence: "情报", searchPulse: "搜索脉搏", tactical: "战术",
    directives: "指令", orbitalView: "轨道视图", satelliteOptic: "卫星光学",
    groundTruth: "地面实况", sourceStack: "数据源", assetMap: "资产地图",
    jurisdictions: "管辖区", allSectors: "全部区域", padawan: "巴达旺",
    commandExport: "命令导出", sysOperational: "系统：运行中",
    exchange: "汇率 // MYR", cityPulse: "城市脉搏", demographics: "人口统计",
    airport: "机场 // KCH", flightTracker: "航班追踪",
    landUse: "土地利用", floodRisk: "洪水风险", drainage: "排水系统", officialStats: "官方统计",
    growthRing: "增长环", urbanSprawl: "城市扩张",
    governance: "市政治理", councillors: "议员名录 // MPP 2025–2028",
    chairman: "主席", deputy: "副主席", ward: "选区", portfolio: "职务",
    phone: "联络", allZones: "全部选区",
    localityExplorer: "地点浏览 // 巴达旺", locality: "地点", code: "代码",
    stateConstituency: "州议席", parliamentConstituency: "国会议席",
    residential: "住宅", commercial: "商业", industrial: "工业", exempted: "豁免",
    totalLocalities: "地点总数", stateSeats: "州议席", parliamentSeats: "国会议席",
    filterBy: "筛选", searchLocality: "搜索地点或代码…",
    allWards: "全部选区", allConstituencies: "全部选区", allPropertyTypes: "全部类型",
    showingResults: "显示", of: "共",
  },
};

// --- Helper functions ---
export function round(value, digits = 0) {
  const f = 10 ** digits;
  return Math.round(value * f) / f;
}

export function aqiBand(aqi) {
  if (aqi <= 50) return { label: "Good", tone: "good" };
  if (aqi <= 100) return { label: "Moderate", tone: "watch" };
  if (aqi <= 150) return { label: "Sensitive", tone: "warn" };
  if (aqi <= 200) return { label: "Unhealthy", tone: "alert" };
  return { label: "Hazardous", tone: "critical" };
}

export function weatherCodeLabel(code) {
  const labels = { 0:"Clear",1:"Mostly clear",2:"Partly cloudy",3:"Overcast",45:"Fog",51:"Drizzle",61:"Light rain",63:"Rain",65:"Heavy rain",80:"Showers",81:"Heavy showers",95:"Thunderstorm" };
  return labels[code] ?? "Mixed conditions";
}

export function kmBetween(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad, dLon = (lon2 - lon1) * toRad;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*toRad)*Math.cos(lat2*toRad)*Math.sin(dLon/2)**2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI/180, toDeg = 180/Math.PI;
  const phi1 = lat1*toRad, phi2 = lat2*toRad, l1 = lon1*toRad, l2 = lon2*toRad;
  const y = Math.sin(l2-l1)*Math.cos(phi2);
  const x = Math.cos(phi1)*Math.sin(phi2) - Math.sin(phi1)*Math.cos(phi2)*Math.cos(l2-l1);
  return (Math.atan2(y, x)*toDeg + 360) % 360;
}

function angularDiff(a, b) { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; }

export function classifyAircraft(lat, lon, heading, vr, alt) {
  const ab = bearingBetween(lat, lon, SITE.airport.lat, SITE.airport.lon);
  const ob = bearingBetween(SITE.airport.lat, SITE.airport.lon, lat, lon);
  if (vr < -1 || (angularDiff(heading, ab) <= 70 && alt < 4200)) return "arrival";
  if (vr > 1 || (angularDiff(heading, ob) <= 70 && alt < 3500)) return "departure";
  return "holding";
}

export function sourceRecord(id, name, status, detail, url, t) { return { id, name, status, detail, url, generatedAt: t }; }

function satDate(off = 1) { const d = new Date(); d.setUTCDate(d.getUTCDate() - off); return d.toISOString().slice(0, 10); }

function gibsUrl(layer, opts = {}) {
  const u = new URL("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi");
  const b = opts.bbox ?? SITE.mapBounds, fmt = opts.format ?? "image/png";
  u.searchParams.set("service","WMS"); u.searchParams.set("request","GetMap");
  u.searchParams.set("version","1.3.0"); u.searchParams.set("layers",layer);
  u.searchParams.set("styles",""); u.searchParams.set("format",fmt);
  u.searchParams.set("transparent", fmt === "image/jpeg" ? "false" : "true");
  u.searchParams.set("height", String(opts.height ?? 640));
  u.searchParams.set("width", String(opts.width ?? 960));
  u.searchParams.set("crs","EPSG:4326");
  u.searchParams.set("bbox", [round(b.minLat,4),round(b.minLon,4),round(b.maxLat,4),round(b.maxLon,4)].join(","));
  if (opts.time) u.searchParams.set("time", opts.time);
  return u.toString();
}

export function buildSatelliteCards() {
  const y = satDate(1), y2 = satDate(2);
  return [
    { id: "true-color", title: "VIIRS True Color", source: "NASA GIBS", updatedAt: y, imageUrl: gibsUrl("VIIRS_SNPP_CorrectedReflectance_TrueColor",{format:"image/jpeg",time:y}) },
    { id: "terra", title: "Terra MODIS", source: "NASA GIBS", updatedAt: y, imageUrl: gibsUrl("MODIS_Terra_CorrectedReflectance_TrueColor",{format:"image/jpeg",time:y}) },
    { id: "precipitation", title: "Precipitation", source: "NASA GIBS / IMERG", updatedAt: y, imageUrl: gibsUrl("IMERG_Precipitation_Rate",{time:y}) },
    { id: "aerosol", title: "Aerosol Density", source: "NASA GIBS / MODIS", updatedAt: y, imageUrl: gibsUrl("MODIS_Combined_Value_Added_AOD",{time:y}) },
    { id: "night-lights", title: "Night Lights", source: "NASA GIBS / VIIRS", updatedAt: y2, imageUrl: gibsUrl("VIIRS_SNPP_DayNightBand_At_Sensor_Radiance",{time:y2}) },
    { id: "vegetation", title: "Vegetation Index", source: "NASA GIBS / MODIS", updatedAt: y2, imageUrl: gibsUrl("MODIS_Terra_NDVI_8Day",{time:y2}) },
  ];
}

export function buildMapLayers() {
  return [
    { id: "dark", label: "Dark", url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", active: true },
    { id: "light", label: "Light", url: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", active: false },
    { id: "street", label: "Street", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png", active: false },
    { id: "imagery", label: "Satellite", url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}", active: false },
  ];
}
