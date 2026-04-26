import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderIndexHtml, resolveAssetVersion } from "./site-build.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
const serverStartedAt = new Date().toISOString();
const assetVersion = resolveAssetVersion({ builtAt: serverStartedAt });

const SITE = {
  title: "Greater Kuching Intelligent Operation Center",
  subtitle: "Operating picture for Padawan and the Greater Kuching metro",
  timezone: "Asia/Kuala_Lumpur",
  region: "Kuching, Sarawak, Malaysia",
  officeAddress: "Majlis Perbandaran Padawan, Jalan Penrissen, Pasar Batu 10, 93250 Kuching, Sarawak",
  airport: {
    code: "KCH",
    icao: "WBGG",
    name: "Kuching International Airport",
    lat: 1.4847,
    lon: 110.347,
  },
  focus: {
    name: "Padawan",
    lat: 1.4475,
    lon: 110.3305,
  },
  mapBounds: {
    minLat: 1.29,
    maxLat: 1.74,
    minLon: 110.14,
    maxLon: 110.62,
  },
  partners: [
    { name: "PMUA", asset: "/assets/pmua.jpeg" },
    { name: "depa", asset: "/assets/depa.jpg" },
    { name: "Smart City Thailand Office", asset: "/assets/smart-city-thailand.jpg" },
    { name: "Axiom", asset: "/assets/axiom.png" },
    { name: "ReTL", asset: "/assets/retl.png" },
  ],
  monitoring: {
    firms: {
      url: "https://firms.modaps.eosdis.nasa.gov/api/country/csv/dd7f3299763784dfb5db4f3690d97034/VIIRS_SNPP/MYS/1",
      label: "NASA FIRMS / VIIRS Fire Detection",
    },
    quarks: {
      url: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=",
      label: "USGS Earthquake Monitor",
    },
  },
};

const MUNICIPAL_MAP = {
  asset: "/assets/greater-kuching-map-blank.svg",
  title: "Greater Kuching municipal reference map",
  credit: "Greater Kuching map blank.svg adapted from Wikimedia Commons",
  license: "CC BY-SA 4.0",
  sourceUrl: "https://commons.wikimedia.org/wiki/File:Greater_Kuching_map_blank.svg",
};

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".webp": "image/webp",
};

const LOCAL_MARKERS = [
  {
    id: "waterfront",
    name: "Kuching Waterfront",
    category: "civic",
    lat: 1.5584,
    lon: 110.3445,
  },
  {
    id: "satok",
    name: "Satok",
    category: "market",
    lat: 1.5621,
    lon: 110.3224,
  },
  {
    id: "padungan",
    name: "Padungan",
    category: "urban-core",
    lat: 1.5496,
    lon: 110.3599,
  },
  {
    id: "petra-jaya",
    name: "Petra Jaya",
    category: "north-bank",
    lat: 1.5843,
    lon: 110.3527,
  },
  {
    id: "batu-kawa",
    name: "Batu Kawa",
    category: "growth-corridor",
    lat: 1.5115,
    lon: 110.2872,
  },
  {
    id: "kota-padawan",
    name: "Kota Padawan",
    category: "padawan-core",
    lat: 1.4475,
    lon: 110.3305,
  },
  {
    id: "siburan",
    name: "Siburan",
    category: "southern-edge",
    lat: 1.3962,
    lon: 110.3608,
  },
  {
    id: "airport",
    name: "KCH Airport",
    category: "airport",
    lat: 1.4847,
    lon: 110.347,
  },
];

const SARAWAK_RIVER = [
  [110.275, 1.565],
  [110.298, 1.57],
  [110.322, 1.577],
  [110.347, 1.572],
  [110.366, 1.566],
  [110.391, 1.568],
  [110.418, 1.579],
  [110.444, 1.585],
];

const ASEAN_CLOCKS = [
  { id: "brunei", country: "Brunei", city: "Bandar Seri Begawan", timezone: "Asia/Brunei", offset: "UTC+8" },
  { id: "cambodia", country: "Cambodia", city: "Phnom Penh", timezone: "Asia/Phnom_Penh", offset: "UTC+7" },
  { id: "indonesia", country: "Indonesia", city: "Jakarta", timezone: "Asia/Jakarta", offset: "UTC+7" },
  { id: "laos", country: "Laos", city: "Vientiane", timezone: "Asia/Vientiane", offset: "UTC+7" },
  { id: "malaysia", country: "Malaysia", city: "Kuala Lumpur", timezone: "Asia/Kuala_Lumpur", offset: "UTC+8" },
  { id: "myanmar", country: "Myanmar", city: "Yangon", timezone: "Asia/Yangon", offset: "UTC+6:30" },
  { id: "philippines", country: "Philippines", city: "Manila", timezone: "Asia/Manila", offset: "UTC+8" },
  { id: "singapore", country: "Singapore", city: "Singapore", timezone: "Asia/Singapore", offset: "UTC+8" },
  { id: "thailand", country: "Thailand", city: "Bangkok", timezone: "Asia/Bangkok", offset: "UTC+7" },
  { id: "vietnam", country: "Vietnam", city: "Ho Chi Minh City", timezone: "Asia/Ho_Chi_Minh", offset: "UTC+7" },
];

const JURISDICTIONS = [
  {
    id: "dbku",
    code: "DBKU",
    name: "Kuching North",
    officialName: "Dewan Bandaraya Kuching Utara",
    query: "Dewan Bandaraya Kuching Utara, Kuching, Sarawak, Malaysia",
    accent: "#0d6efd",
    areaKm2: 369.48,
    population: 235966,
    properties: 43575,
    source:
      "DBKU administrative area page states DBKU administers 369.48 km² with 43,575 properties and 235,966 people.",
    sourceUrl:
      "https://dbku.sarawak.gov.my/modules/web/pages.php?id=429&lang=bm&menu_id=260&mod=webpage&sub=page&sub_id=428&title=Administrative-Area",
    mapReferenceLabel: "DBKU Interactive Map",
    mapReferenceUrl: "https://dbku.sarawak.gov.my/dbkugoogle/index.php?lang=en",
    mapAnchor: { x: 59, y: 26 },
    mapPanelNote: "North bank core, Petra Jaya, and waterfront-linked operations.",
    fallbackPolygons: [
      [
        [110.168, 1.583],
        [110.213, 1.651],
        [110.308, 1.71],
        [110.421, 1.72],
        [110.535, 1.672],
        [110.59, 1.605],
        [110.575, 1.565],
        [110.496, 1.542],
        [110.417, 1.55],
        [110.34, 1.565],
        [110.272, 1.57],
        [110.215, 1.565],
      ],
    ],
  },
  {
    id: "mbks",
    code: "MBKS",
    name: "Kuching South",
    officialName: "Majlis Bandaraya Kuching Selatan",
    query: "Majlis Bandaraya Kuching Selatan, Kuching, Sarawak, Malaysia",
    accent: "#2a2a2a",
    areaKm2: 61.53,
    population: null,
    properties: null,
    source:
      "MBKS official introduction page states the council area of jurisdiction comprises 61.53 km².",
    sourceUrl: "https://mbks.sarawak.gov.my/web/subpage/webpage_view/49",
    mapReferenceLabel: "MBKS Council Zoning Map",
    mapReferenceUrl: "https://mbks.sarawak.gov.my/web/subpage/webpage_view/1381",
    mapAnchor: { x: 47, y: 48 },
    mapPanelNote: "South-bank urban core, 3rd Mile, Stutong, and dense service demand.",
    fallbackPolygons: [
      [
        [110.307, 1.53],
        [110.339, 1.561],
        [110.372, 1.564],
        [110.405, 1.553],
        [110.409, 1.518],
        [110.392, 1.491],
        [110.346, 1.485],
        [110.313, 1.503],
      ],
    ],
  },
  {
    id: "mpp",
    code: "MPP",
    name: "Padawan",
    officialName: "Padawan Municipal Council",
    query: "Padawan Municipal Council, Kuching, Sarawak, Malaysia",
    accent: "#b48a00",
    areaKm2: 984.34,
    population: 260058,
    properties: 83744,
    source:
      "MPP council profile lists a jurisdiction area of 984.34 km², population 260,058, and 83,744 private holdings.",
    sourceUrl: "https://mpp.sarawak.gov.my/web/subpage/webpage_view/55",
    mapReferenceLabel: "MPP Zoning Map",
    mapReferenceUrl:
      "https://www.google.com/maps/d/viewer?mid=1SNnLbpINjhdKf5IlzBTGQ8fECCjdUdIM&ll=1.3796230801341653%2C110.3232464&z=10",
    mapAnchor: { x: 42, y: 68 },
    mapPanelNote: "Padawan growth ring spanning Batu Kawa, Penrissen, Kota Padawan, and Siburan.",
    fallbackPolygons: [
      [
        [110.15, 1.45],
        [110.215, 1.51],
        [110.254, 1.555],
        [110.305, 1.54],
        [110.352, 1.515],
        [110.39, 1.49],
        [110.43, 1.478],
        [110.487, 1.49],
        [110.544, 1.465],
        [110.603, 1.416],
        [110.6, 1.342],
        [110.532, 1.305],
        [110.447, 1.298],
        [110.361, 1.322],
        [110.293, 1.34],
        [110.224, 1.387],
        [110.171, 1.41],
      ],
    ],
  },
];

const AIRPORT_FALLBACK_ROUTES = [
  { callsign: "AK5202", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 19, distanceKm: 62, altitudeM: 3100 },
  { callsign: "MH2522", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 33, distanceKm: 88, altitudeM: 4200 },
  { callsign: "FY5354", origin: "Kuala Lumpur", type: "arrival", etaMinutes: 47, distanceKm: 111, altitudeM: 5100 },
  { callsign: "OD1602", origin: "Johor Bahru", type: "arrival", etaMinutes: 56, distanceKm: 124, altitudeM: 6200 },
  { callsign: "AK5433", destination: "Kuala Lumpur", type: "departure", etaMinutes: 8, distanceKm: 18, altitudeM: 1800 },
  { callsign: "MH2804", destination: "Sibu", type: "departure", etaMinutes: 14, distanceKm: 29, altitudeM: 2600 },
];

const NEWS_FEEDS = [
  {
    id: "kuching-press-en",
    label: "English press",
    language: "en",
    languageLabel: "English",
    url:
      "https://news.google.com/rss/search?q=%28Kuching%20OR%20Padawan%20OR%20%22Batu%20Kawa%22%20OR%20Siburan%20OR%20Stutong%20OR%20Penrissen%20OR%20%22Petra%20Jaya%22%29%20%28site%3Atheborneopost.com%20OR%20site%3Adayakdaily.com%20OR%20site%3Asarawaktribune.com%20OR%20site%3Abernama.com%20OR%20site%3Amalaymail.com%29%20when%3A14d&hl=en-MY&gl=MY&ceid=MY%3Aen",
  },
  {
    id: "kuching-press-ms",
    label: "Bahasa press",
    language: "ms",
    languageLabel: "Bahasa",
    url:
      "https://news.google.com/rss/search?q=%28Kuching%20OR%20Padawan%20OR%20%22Batu%20Kawa%22%20OR%20Siburan%20OR%20Stutong%20OR%20Penrissen%20OR%20Sarawak%29%20%28site%3Atvsarawak.my%20OR%20site%3Asuarasarawak.my%20OR%20site%3Autusanborneo.com.my%20OR%20site%3Abernama.com%20OR%20site%3Aastroawani.com%29%20when%3A14d&hl=ms&gl=MY&ceid=MY%3Ams",
  },
  {
    id: "kuching-press-zh",
    label: "Chinese press",
    language: "zh",
    languageLabel: "Chinese",
    url:
      "https://news.google.com/rss/search?q=%28%E5%8F%A4%E6%99%8B%20OR%20%E5%B7%B4%E8%BE%BE%E6%97%BA%20OR%20%E5%B3%87%E9%83%BD%E5%8A%A0%E7%93%A6%20OR%20%E7%A0%82%E6%8B%89%E8%B6%8A%29%20%28site%3Aseehua.com%20OR%20site%3Asinchew.com.my%20OR%20site%3Aenanyang.my%20OR%20site%3Achinapress.com.my%29%20when%3A14d&hl=zh-CN&gl=MY&ceid=MY%3Azh-Hans",
  },
  {
    // Sarawak Government official news (UKAS / TVS) via Google News indexing.
    // UKAS direct site is JS-rendered, so we use Google News with site filters.
    // Items from these domains are tagged isOfficial=true automatically (priority +40).
    id: "sarawak-gov-official",
    label: "Sarawak Govt Official",
    language: "ms",
    languageLabel: "Sarawak Govt",
    tier: "official",
    url:
      "https://news.google.com/rss/search?q=%28Kuching%20OR%20Padawan%20OR%20Sarawak%29%20%28site%3Aukas.sarawak.gov.my%20OR%20site%3Atvs.com.my%20OR%20site%3Atvsarawak.my%29%20when%3A14d&hl=ms&gl=MY&ceid=MY%3Ams",
  },
];

// Domains we treat as state-tier official sources (drives isOfficial flag + priority +40).
const SARAWAK_OFFICIAL_DOMAINS = /(?:ukas|sarawak\.gov)\.my|tvsarawak\.my|tvs\.com\.my/i;

const GOOGLE_TRENDS_FEED = {
  id: "google-trends-my",
  label: "Google Trends Malaysia",
  url: "https://trends.google.com/trending/rss?geo=MY",
};

const MAP_WATCHPOINTS = [
  "Waterfront",
  "Petra Jaya",
  "Satok",
  "3rd Mile",
  "Stutong",
  "Batu Kawa",
  "Penrissen",
  "Kota Padawan",
  "Siburan",
  "KCH",
];

const LOCAL_NEWS_RE = /kuching|padawan|batu kawa|petra jaya|siburan|stutong|penrissen|sarawak|3rd mile|古晋|砂拉越|巴达旺|峇都加瓦|石角/i;
const BAD_NEWS_RE =
  /ontario|newmarket|aurora|nipissing|fedeli|rural ontario|dawn gallagher|billy denault|toronto|scarborough/i;
const LOCAL_TRENDS_RE = /kuching|padawan|batu kawa|petra jaya|siburan|sarawak|borneo|kch|wbgg/i;
const NATIONAL_TRENDS_RE = /malaysia|malaysian|sabah|sarawak|johor|penang|selangor|kuala lumpur|kl/i;
const HAN_SCRIPT_RE = /\p{Script=Han}/u;
const BM_NEWS_RE = /\b(majlis|bandaraya|perbandaran|sarawak|banjir|jalan|berita|semasa|operasi|kerajaan|rakyat|negeri|mengesahkan|memaklumkan)\b/i;
const OPERATOR_NEWS_RE = /flood|banjir|drain|drainage|haze|air quality|api|kebakaran|jam|traffic|closure|outage|utility|airport|flight|weather|storm|landslide|hospital|warning|amaran|siasatan|kemalangan|水灾|火灾|烟霾|道路|交通|机场|关闭|停电|警报/i;

const FALLBACK_NEWS = [
  {
    title: "MBKS rodding works clear Jalan Pecky drains while securing funds for full upgrade",
    source: "MBKS / DayakDaily",
    link: "https://mbks.sarawak.gov.my/web/home/index/",
    publishedAt: "2026-03-27T00:00:00.000Z",
    lane: "Drainage",
  },
  {
    title: "DBKU conducts emergency drill for traffic wardens",
    source: "DBKU",
    link: "https://dbku.sarawak.gov.my/pages.php?menu_id=&mod=news&sub_id=",
    publishedAt: "2026-02-11T00:00:00.000Z",
    lane: "Traffic",
  },
  {
    title: "MBKS and DBKU asked to find an ideal spot for a night market",
    source: "DBKU",
    link: "https://dbku.sarawak.gov.my/pages.php?menu_id=&mod=news&sub_id=",
    publishedAt: "2026-02-12T00:00:00.000Z",
    lane: "Public realm",
  },
  {
    title: "Padawan infrastructure upgrade tenders issued for Kampung Telaga Air, Segedup, and Desa Wira",
    source: "MPP",
    link: "https://mpp.sarawak.gov.my/web/subpage/webpage_view/55",
    publishedAt: "2026-03-10T00:00:00.000Z",
    lane: "Infrastructure",
  },
];

const cache = new Map();

function nowIso() {
  return new Date().toISOString();
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function round(value, digits = 0) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function decodeEntities(text) {
  return String(text ?? "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function stripTags(text) {
  return decodeEntities(String(text ?? "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
}

function slugify(text) {
  return String(text ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatTime(isoString, timezone = SITE.timezone) {
  return new Intl.DateTimeFormat("en-MY", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: timezone,
  }).format(new Date(isoString));
}

function formatDateLabel(isoString) {
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: SITE.timezone,
  }).format(new Date(isoString));
}

function kmBetween(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const dLat = (lat2 - lat1) * toRad;
  const dLon = (lon2 - lon1) * toRad;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * toRad) * Math.cos(lat2 * toRad) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function bearingBetween(lat1, lon1, lat2, lon2) {
  const toRad = Math.PI / 180;
  const toDeg = 180 / Math.PI;
  const phi1 = lat1 * toRad;
  const phi2 = lat2 * toRad;
  const lambda1 = lon1 * toRad;
  const lambda2 = lon2 * toRad;
  const y = Math.sin(lambda2 - lambda1) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(lambda2 - lambda1);
  return (Math.atan2(y, x) * toDeg + 360) % 360;
}

function angularDifference(a, b) {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

function aqiBand(aqi) {
  if (aqi <= 50) return { label: "Good", tone: "good" };
  if (aqi <= 100) return { label: "Moderate", tone: "watch" };
  if (aqi <= 150) return { label: "Sensitive", tone: "warn" };
  if (aqi <= 200) return { label: "Unhealthy", tone: "alert" };
  if (aqi <= 300) return { label: "Very unhealthy", tone: "critical" };
  return { label: "Hazardous", tone: "critical" };
}

function weatherCodeLabel(code) {
  const labels = {
    0: "Clear",
    1: "Mostly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    51: "Drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    80: "Showers",
    81: "Heavy showers",
    95: "Thunderstorm",
  };
  return labels[code] ?? "Mixed conditions";
}

function sourceRecord(id, name, status, detail, url, generatedAt) {
  return { id, name, status, detail, url, generatedAt };
}

async function cached(key, ttlMs, loader) {
  const record = cache.get(key);
  if (record && record.expiresAt > Date.now()) {
    return record.value;
  }

  const value = await loader();
  cache.set(key, { value, expiresAt: Date.now() + ttlMs });
  return value;
}

async function fetchText(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": "secretary-goh-super-dashboard/1.0",
        accept: "text/plain,text/html,application/xml,text/xml,application/json;q=0.9,*/*;q=0.8",
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.text();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchJson(url, timeoutMs = 10000) {
  const text = await fetchText(url, timeoutMs);
  return JSON.parse(text);
}

function toAbsoluteUrl(base, href) {
  try {
    return new URL(href, base).toString();
  } catch {
    return href;
  }
}

function parseSarawakTimestamp(value) {
  if (!value) return nowIso();
  const normalized = String(value).trim().replace(" ", "T");
  const iso = `${normalized}+08:00`;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? nowIso() : new Date(parsed).toISOString();
}

function parseLooseLocalDate(value) {
  if (!value) return nowIso();
  const parsed = Date.parse(`${String(value).trim()} 12:00:00 GMT+0800`);
  return Number.isNaN(parsed) ? nowIso() : new Date(parsed).toISOString();
}

function detectNewsLanguage(text) {
  const cleaned = stripTags(text);
  if (HAN_SCRIPT_RE.test(cleaned)) return "zh";
  if (BM_NEWS_RE.test(cleaned)) return "ms";
  return "en";
}

function languageLabel(language) {
  return { en: "English", ms: "Bahasa", zh: "Chinese", official: "Official" }[language] ?? "Mixed";
}

function languageBadge(language, isOfficial = false) {
  if (isOfficial || language === "official") return "OFF";
  return { en: "EN", ms: "BM", zh: "ZH" }[language] ?? "MIX";
}

function scoreNewsPriority(item) {
  const merged = `${item.title} ${item.source} ${item.lane}`;
  const ageHours = Math.max(0, (Date.now() - Date.parse(item.publishedAt || nowIso())) / 36e5);
  let score = 0;
  if (item.isOfficial) score += 40;
  if (LOCAL_NEWS_RE.test(merged)) score += 12;
  if (OPERATOR_NEWS_RE.test(merged)) score += 14;
  score += clamp(24 - ageHours, 0, 24) / 2;
  return round(score, 1);
}

function summarizeLanguageLane(items, language) {
  const filtered = items.filter((item) => item.language === language);
  return {
    code: language,
    label: languageLabel(language),
    badge: languageBadge(language),
    count: filtered.length,
    topItems: filtered.slice(0, 3),
  };
}

const GROUND_PULSE_LANES = [
  {
    key: "kuching",
    label: "Kuching",
    narrative: "What the city is being talked about right now.",
    match: /kuching|古晋|kch\b|wbgg|batu kawa|petra jaya|satok|padungan|waterfront|stutong|pending/i,
  },
  {
    key: "padawan",
    label: "Padawan",
    narrative: "What residents and councils say about MPP country.",
    match: /padawan|巴达旺|kota padawan|mpp\b|siburan|matang|penrissen|beratok|kuap|tapah|sungai maong/i,
  },
  {
    key: "sarawak",
    label: "Sarawak",
    narrative: "State-wide signals that touch Greater Kuching.",
    match: /sarawak|砂拉越|sarawakian|dbku|mbks|premier\s+of\s+sarawak|chief\s+minister\s+sarawak|\bcms\b|\bsdec\b|\bdewan\s+undangan\s+negeri\b/i,
  },
];

function buildGroundPulse(news, trends) {
  const items = Array.isArray(news?.items) ? news.items : [];
  const trendItems = Array.isArray(trends?.items) ? trends.items : [];
  const generatedAt = nowIso();
  const dayFloor = Date.now() - 24 * 60 * 60 * 1000;

  const lanes = GROUND_PULSE_LANES.map((lane) => {
    const matchedNews = items.filter((item) => {
      const merged = `${item.title || ""} ${item.source || ""}`;
      return lane.match.test(merged);
    });
    const last24h = matchedNews.filter((item) => Date.parse(item.publishedAt || 0) >= dayFloor);
    const headlines = sortNewsItems(matchedNews).slice(0, 3).map((item) => ({
      title: item.title,
      source: item.source,
      url: item.link,
      publishedAt: item.publishedAt,
      language: item.language,
      languageBadge: item.languageBadge,
      isOfficial: Boolean(item.isOfficial),
    }));

    const trendMatches = trendItems
      .filter((trend) => {
        const merged = `${trend.title || ""} ${trend.newsTitle || ""} ${trend.primarySource || ""}`;
        return lane.match.test(merged);
      })
      .slice(0, 3)
      .map((trend) => ({
        term: trend.title,
        trafficLabel: trend.trafficLabel || null,
        link: trend.link || null,
        newsTitle: trend.newsTitle || null,
        newsSource: trend.primarySource || null,
      }));

    const topHeadline = headlines[0] || null;
    const narrative = topHeadline
      ? `${topHeadline.source || "Local press"} · ${topHeadline.title}`
      : trendMatches[0]
        ? `Search surge: ${trendMatches[0].term}`
        : `No fresh ${lane.label} coverage in the 24-hour window — the lane is quiet.`;

    return {
      key: lane.key,
      label: lane.label,
      intent: lane.narrative,
      mentionCount: matchedNews.length,
      last24hCount: last24h.length,
      headlines,
      trendMatches,
      narrative,
    };
  });

  const totalMentions = lanes.reduce((sum, lane) => sum + lane.mentionCount, 0);
  const totalLast24h = lanes.reduce((sum, lane) => sum + lane.last24hCount, 0);

  return {
    generatedAt,
    status: totalMentions > 0 ? "live" : (news?.status === "fallback" ? "fallback" : "offline"),
    systemLabel: "Ground Pulse // per-city mention rollup from Google News lanes + Google Trends local matches",
    summary: totalMentions > 0
      ? `${totalMentions} total mentions across Kuching / Padawan / Sarawak lanes, ${totalLast24h} from the last 24 hours.`
      : "Ground pulse is quiet — no matching mentions in the current news or trends window.",
    totals: { mentions: totalMentions, last24h: totalLast24h },
    lanes,
  };
}

function sortNewsItems(items) {
  return [...items].sort((left, right) => {
    const priorityDelta = (right.priorityScore ?? 0) - (left.priorityScore ?? 0);
    if (priorityDelta !== 0) return priorityDelta;
    return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
  });
}

function parseRssItems(xml, lane, options = {}) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];
  return items.map((item) => {
    const pick = (tag) => {
      const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return stripTags(match?.[1] ?? "");
    };

    const sourceMatch = item.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);
    const source = stripTags(sourceMatch?.[1] ?? "");
    const link = pick("link");
    const title = pick("title").replace(/\s+-\s+[^-]+$/, "");
    const pubDate = pick("pubDate");
    const publishedAt = Number.isNaN(Date.parse(pubDate)) ? nowIso() : new Date(pubDate).toISOString();

    return {
      title,
      source: source || "Google News",
      link,
      publishedAt,
      lane,
      language: options.language || detectNewsLanguage(`${title} ${source}`),
      languageLabel: options.languageLabel || languageLabel(options.language || detectNewsLanguage(`${title} ${source}`)),
      languageBadge: languageBadge(options.language || detectNewsLanguage(`${title} ${source}`)),
      feedId: options.feedId || lane,
    };
  });
}

function parseApproxTraffic(label) {
  const digits = String(label ?? "").replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function classifyTrendLocality(text) {
  const merged = stripTags(text);
  if (LOCAL_TRENDS_RE.test(merged)) return { label: "Local relevance", tone: "focus", score: 2 };
  if (NATIONAL_TRENDS_RE.test(merged)) return { label: "Malaysia context", tone: "neutral", score: 1 };
  return { label: "External context", tone: "muted", score: 0 };
}

function parseGoogleTrendsItems(xml) {
  const items = xml.match(/<item\b[\s\S]*?<\/item>/gi) ?? [];

  return items.map((item) => {
    const pick = (tag) => {
      const match = item.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return stripTags(match?.[1] ?? "");
    };

    const title = pick("title");
    const trafficLabel = pick("ht:approx_traffic");
    const pubDate = pick("pubDate");
    const publishedAt = Number.isNaN(Date.parse(pubDate)) ? nowIso() : new Date(pubDate).toISOString();
    const newsItems = Array.from(item.matchAll(/<ht:news_item>([\s\S]*?)<\/ht:news_item>/gi), (match) => {
      const block = match[1];
      const newsPick = (tag) => {
        const field = block.match(new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${tag}>`, "i"));
        return stripTags(field?.[1] ?? "");
      };

      return {
        title: newsPick("ht:news_item_title"),
        source: newsPick("ht:news_item_source"),
        url: newsPick("ht:news_item_url"),
      };
    }).filter((newsItem) => newsItem.title);

    const locality = classifyTrendLocality(
      [title, ...newsItems.flatMap((newsItem) => [newsItem.title, newsItem.source])].join(" "),
    );

    return {
      id: slugify(title) || `trend-${Math.random().toString(36).slice(2, 8)}`,
      title,
      trafficLabel: trafficLabel || "No volume",
      trafficValue: parseApproxTraffic(trafficLabel),
      publishedAt,
      locality,
      primarySource: newsItems[0]?.source || GOOGLE_TRENDS_FEED.label,
      newsTitle: newsItems[0]?.title || title,
      newsUrl: newsItems[0]?.url || null,
      link: `https://trends.google.com/trends/explore?geo=MY&q=${encodeURIComponent(title)}`,
      relatedNews: newsItems.slice(0, 3),
    };
  });
}

function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function dedupeNews(items) {
  return uniqueBy(
    items.filter((item) => item.title && item.link),
    (item) => `${item.title.toLowerCase()}|${item.link}`,
  );
}

function sanitizeNewsItem(item) {
  if (!item?.title || !item?.link) return null;
  const merged = `${item.title} ${item.source} ${item.link}`;
  if (BAD_NEWS_RE.test(merged)) return null;
  if (item.isOfficial !== true && !LOCAL_NEWS_RE.test(merged)) return null;

  const language = item.language || detectNewsLanguage(`${item.title} ${item.source}`);

  return {
    ...item,
    title: stripTags(item.title),
    source: stripTags(item.source || "Unknown"),
    link: item.link,
    publishedAt: item.publishedAt || nowIso(),
    language,
    languageLabel: item.languageLabel || languageLabel(language),
    languageBadge: item.languageBadge || languageBadge(language),
    priorityScore: scoreNewsPriority({ ...item, language }),
  };
}

function parseMbksNews(html) {
  const matches = html.matchAll(
    /href="(https:\/\/mbks\.sarawak\.gov\.my\/web\/subpage\/news_view\/\d+)"[^>]*timestamp="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
  );

  return dedupeNews(
    Array.from(matches, (match) => ({
      title: stripTags(match[3]),
      source: "MBKS",
      link: match[1],
      publishedAt: parseSarawakTimestamp(match[2]),
      lane: "MBKS official",
      isOfficial: true,
    })),
  ).slice(0, 8);
}

function parseMppAnnouncements(html) {
  const matches = html.matchAll(
    /href="(https:\/\/mpp\.sarawak\.gov\.my\/web\/subpage\/announcement_view\/\d+)"[^>]*timestamp="([^"]+)"[^>]*>([^<]+)<\/a>/gi,
  );

  return dedupeNews(
    Array.from(matches, (match) => ({
      title: stripTags(match[3]),
      source: "MPP",
      link: match[1],
      publishedAt: parseSarawakTimestamp(match[2]),
      lane: "MPP official",
      isOfficial: true,
    })),
  ).slice(0, 8);
}

function parseDbkuNews(html) {
  const matches = html.matchAll(
    /<tr><td><a href="([^"]+)" title='([^']+)'>([^<]+)<\/a><br><span class="searchDesc"><\/span><\/td><td align='right'>([^<]+)<\/td><\/tr>/gi,
  );

  return dedupeNews(
    Array.from(matches, (match) => ({
      title: stripTags(match[2] || match[3]),
      source: "DBKU",
      link: toAbsoluteUrl("https://dbku.sarawak.gov.my/", match[1]),
      publishedAt: parseLooseLocalDate(match[4]),
      lane: "DBKU official",
      isOfficial: true,
    })),
  ).slice(0, 8);
}

async function loadGoogleNewsLane(feed) {
  const xml = await fetchText(feed.url, 12000);
  return parseRssItems(xml, feed.label, {
    language: feed.language,
    languageLabel: feed.languageLabel,
    feedId: feed.id,
  }).map((item) => {
    // Sarawak Government official sites (UKAS, TVS) — tag as isOfficial regardless of feed.
    // Combined with feed.tier === "official" so the dedicated UKAS feed is always official-tier.
    const linkIsOfficial = item.link && SARAWAK_OFFICIAL_DOMAINS.test(item.link);
    const isOfficial = linkIsOfficial || feed.tier === "official";
    return {
      ...item,
      source: item.source || feed.label,
      isOfficial,
    };
  });
}

async function loadMbksNews() {
  const html = await fetchText("https://mbks.sarawak.gov.my/web/subpage/news_list/", 12000);
  return parseMbksNews(html);
}

async function loadMppAnnouncements() {
  const html = await fetchText("https://mpp.sarawak.gov.my/web/subpage/announcement_list/", 12000);
  return parseMppAnnouncements(html);
}

async function loadDbkuNews() {
  const html = await fetchText("https://dbku.sarawak.gov.my/modules/web/pages.php?mod=news&menu_id=0&sub_id=266", 12000);
  return parseDbkuNews(html);
}

async function loadGoogleTrends() {
  return cached("google-trends-my", 30 * 60 * 1000, async () => {
    try {
      const xml = await fetchText(GOOGLE_TRENDS_FEED.url, 12000);
      const items = parseGoogleTrendsItems(xml)
        .filter((item) => item.title)
        .sort((left, right) => {
          const trafficDelta = right.trafficValue - left.trafficValue;
          if (trafficDelta !== 0) return trafficDelta;
          return Date.parse(right.publishedAt) - Date.parse(left.publishedAt);
        })
        .slice(0, 12);
      const localMatches = items.filter((item) => item.locality.score >= 2);

      return {
        status: items.length > 0 ? "live" : "fallback",
        updatedAt: nowIso(),
        systemLabel: "Google Trends daily search feed / geo=MY / 30-minute cache",
        summary:
          localMatches.length > 0
            ? `${localMatches.length} Kuching or Sarawak-linked terms surfaced in the Malaysia trends window.`
            : "No Kuching-specific spike in the current Malaysia trends window; national search context is still shown.",
        localMatchCount: localMatches.length,
        items,
        localMatches,
      };
    } catch {
      return {
        status: "offline",
        updatedAt: nowIso(),
        systemLabel: "Google Trends daily search feed / geo=MY / 30-minute cache",
        summary: "Google Trends feed unavailable right now.",
        localMatchCount: 0,
        items: [],
        localMatches: [],
      };
    }
  });
}

async function loadNews() {
  return cached("local-news", 15 * 60 * 1000, async () => {
    const feedLoaders = [
      ...NEWS_FEEDS.map((feed) => ({
        id: feed.id,
        label: feed.label,
        language: feed.language,
        type: "media",
        loader: () => loadGoogleNewsLane(feed),
      })),
      { id: "mbks-news", label: "MBKS official", language: "official", type: "official", loader: loadMbksNews },
      { id: "mpp-news", label: "MPP official", language: "official", type: "official", loader: loadMppAnnouncements },
      { id: "dbku-news", label: "DBKU official", language: "official", type: "official", loader: loadDbkuNews },
    ];
    const settled = await Promise.allSettled(feedLoaders.map((feed) => feed.loader()));

    const fulfilledCount = settled.filter((result) => result.status === "fulfilled").length;
    const items = dedupeNews(
      sortNewsItems(
        settled
          .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
          .map(sanitizeNewsItem)
          .filter(Boolean),
      ),
    );
    const fallbackItems = FALLBACK_NEWS.map(sanitizeNewsItem).filter(Boolean);
    const officialPool = items.filter((item) => item.isOfficial);
    const enPool = items.filter((item) => item.language === "en" && item.isOfficial !== true);
    const msPool = items.filter((item) => item.language === "ms" && item.isOfficial !== true);
    const zhPool = items.filter((item) => item.language === "zh" && item.isOfficial !== true);
    const headlines = sortNewsItems(
      dedupeNews([
        ...officialPool.slice(0, 6),
        ...enPool.slice(0, 4),
        ...msPool.slice(0, 4),
        ...zhPool.slice(0, 4),
      ]),
    ).slice(0, 18);
    const effectiveItems = headlines.length > 0 ? headlines : fallbackItems;
    const languageLanes = ["en", "ms", "zh"].map((language) => summarizeLanguageLane(items, language));
    const coverage = {
      official: officialPool.length,
      en: languageLanes.find((lane) => lane.code === "en")?.count ?? 0,
      ms: languageLanes.find((lane) => lane.code === "ms")?.count ?? 0,
      zh: languageLanes.find((lane) => lane.code === "zh")?.count ?? 0,
      total: items.length > 0 ? items.length : effectiveItems.length,
    };
    const curatedOperatorItems = sortNewsItems(
      dedupeNews([
        ...officialPool.slice(0, 2),
        ...enPool.slice(0, 2),
        ...msPool.slice(0, 2),
        ...zhPool.slice(0, 2),
      ]),
    ).slice(0, 6);
    const operatorItems = curatedOperatorItems.length > 0 ? curatedOperatorItems : effectiveItems.slice(0, 6);
    const laneStatus = feedLoaders.map((feed, index) => ({
      id: feed.id,
      label: feed.label,
      language: feed.language,
      type: feed.type,
      status: settled[index].status === "fulfilled" ? "live" : "offline",
    }));

    return {
      status: headlines.length > 0 && fulfilledCount >= 4 ? "live" : "fallback",
      updatedAt: nowIso(),
      systemLabel:
        "Official MBKS + MPP + DBKU notices, plus Google News local intake across English, Bahasa, and Chinese lanes / 15-minute cache / locality filtered",
      summary:
        items.length > 0
          ? `${coverage.official} official notices, ${coverage.en} English items, ${coverage.ms} Bahasa items, and ${coverage.zh} Chinese items are in the current Kuching watch window.`
          : "News intake degraded. Fallback headlines are being held until multilingual lanes recover.",
      counts: coverage,
      languageLanes,
      laneStatus,
      operatorItems,
      items: effectiveItems,
    };
  });
}

function satelliteDate(offsetDays = 1) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - offsetDays);
  return date.toISOString().slice(0, 10);
}

function buildGibsSnapshotUrl(layer, options = {}) {
  const url = new URL("https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi");
  const bbox = options.bbox ?? SITE.mapBounds;
  const format = options.format ?? "image/png";
  url.searchParams.set("service", "WMS");
  url.searchParams.set("request", "GetMap");
  url.searchParams.set("version", "1.3.0");
  url.searchParams.set("layers", layer);
  url.searchParams.set("styles", "");
  url.searchParams.set("format", format);
  url.searchParams.set("transparent", format === "image/jpeg" ? "false" : "true");
  url.searchParams.set("height", String(options.height ?? 640));
  url.searchParams.set("width", String(options.width ?? 960));
  url.searchParams.set("crs", "EPSG:4326");
  url.searchParams.set(
    "bbox",
    [
      round(bbox.minLat, 4),
      round(bbox.minLon, 4),
      round(bbox.maxLat, 4),
      round(bbox.maxLon, 4),
    ].join(","),
  );
  if (options.time) {
    url.searchParams.set("time", options.time);
  }
  return url.toString();
}

function buildSatelliteCards() {
  const yesterday = satelliteDate(1);
  return [
    {
      id: "true-color",
      title: "Kuching cloud deck",
      source: "NASA GIBS / VIIRS",
      updatedAt: yesterday,
      description: "True-color pass over Greater Kuching for cloud structure and smoke visibility.",
      imageUrl: buildGibsSnapshotUrl("VIIRS_SNPP_CorrectedReflectance_TrueColor", {
        format: "image/jpeg",
        time: yesterday,
      }),
    },
    {
      id: "terra-true-color",
      title: "Terra surface view",
      source: "NASA GIBS / MODIS Terra",
      updatedAt: yesterday,
      description: "Second true-color pass to compare cloud breaks and land-water contrast over Kuching.",
      imageUrl: buildGibsSnapshotUrl("MODIS_Terra_CorrectedReflectance_TrueColor", {
        format: "image/jpeg",
        time: yesterday,
      }),
    },
    {
      id: "precipitation",
      title: "Rainfall field",
      source: "NASA GIBS / IMERG",
      updatedAt: yesterday,
      description: "Satellite precipitation context before drainage complaints start screaming.",
      imageUrl: buildGibsSnapshotUrl("IMERG_Precipitation_Rate", { time: yesterday }),
    },
    {
      id: "aerosol",
      title: "Regional aerosol",
      source: "NASA GIBS / MODIS",
      updatedAt: yesterday,
      description: "Useful when AQI drifts upward and the haze story becomes regional, not just local.",
      imageUrl: buildGibsSnapshotUrl("MODIS_Combined_Value_Added_AOD", { time: yesterday }),
    },
  ];
}

function buildMapLayers() {
  return [
    {
      id: "light",
      label: "Light",
      type: "tile",
      kind: "reference",
      url: "https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png",
      subdomains: "abcd",
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
      maxZoom: 20,
      active: true,
    },
    {
      id: "street",
      label: "Street",
      type: "tile",
      kind: "reference",
      url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 19,
      active: false,
    },
    {
      id: "imagery",
      label: "Satellite",
      type: "tile",
      kind: "satellite",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 18,
      active: false,
    },
  ];
}

function buildWeatherFallback() {
  return {
    status: "fallback",
    updatedAt: nowIso(),
    current: {
      temperatureC: 30.8,
      apparentTemperatureC: 36.1,
      humidity: 74,
      windKph: 12.2,
      precipitationMm: 0.8,
      cloudCover: 64,
      weatherLabel: "Heat with convective rain risk",
      pressureHpa: 1008.4,
    },
    nextHours: [
      { time: "13:00", precipitationMm: 0.6, rainChance: 38, temperatureC: 31.1 },
      { time: "14:00", precipitationMm: 0.8, rainChance: 44, temperatureC: 31.4 },
      { time: "15:00", precipitationMm: 1.3, rainChance: 56, temperatureC: 30.7 },
      { time: "16:00", precipitationMm: 2.4, rainChance: 61, temperatureC: 29.6 },
      { time: "17:00", precipitationMm: 2.1, rainChance: 58, temperatureC: 28.9 },
      { time: "18:00", precipitationMm: 0.9, rainChance: 40, temperatureC: 28.2 },
    ],
    daily: {
      maxC: 32.2,
      minC: 24.7,
      rainTotalMm: 11.5,
      uvIndexMax: 9.4,
      sunrise: "06:24",
      sunset: "18:35",
    },
    history: [30.1, 30.5, 30.8, 31.2, 31.5, 31.1, 30.7, 30.2, 29.8, 29.5, 29.2, 28.9, 28.5, 28.2, 27.8, 27.5, 27.2, 26.9, 26.5, 26.2, 25.8, 25.5, 25.2, 24.8],
  };
}

async function loadWeather() {
  const url = new URL("https://api.open-meteo.com/v1/forecast");
  url.searchParams.set("latitude", String(SITE.focus.lat));
  url.searchParams.set("longitude", String(SITE.focus.lon));
  url.searchParams.set(
    "current",
    [
      "temperature_2m",
      "apparent_temperature",
      "relative_humidity_2m",
      "wind_speed_10m",
      "precipitation",
      "weather_code",
      "cloud_cover",
      "pressure_msl",
    ].join(","),
  );
  url.searchParams.set(
    "hourly",
    ["temperature_2m", "precipitation_probability", "precipitation"].join(","),
  );
  url.searchParams.set(
    "daily",
    ["temperature_2m_max", "temperature_2m_min", "uv_index_max", "sunrise", "sunset", "precipitation_sum"].join(","),
  );
  url.searchParams.set("forecast_hours", "12");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");

  try {
    const payload = await fetchJson(url.toString());
    const current = payload.current ?? {};
    const hourly = payload.hourly ?? {};
    const daily = payload.daily ?? {};

    // Get the last 24 hours of data for history
    const history = (hourly.temperature_2m ?? []).slice(0, 24);

    return {
      status: "live",
      updatedAt: nowIso(),
      current: {
        temperatureC: round(current.temperature_2m ?? 0, 1),
        apparentTemperatureC: round(current.apparent_temperature ?? 0, 1),
        humidity: Math.round(current.relative_humidity_2m ?? 0),
        windKph: round(current.wind_speed_10m ?? 0, 1),
        precipitationMm: round(current.precipitation ?? 0, 1),
        cloudCover: Math.round(current.cloud_cover ?? 0),
        weatherLabel: weatherCodeLabel(Number(current.weather_code ?? 0)),
        pressureHpa: round(current.pressure_msl ?? 0, 1),
      },
      nextHours: (hourly.time ?? []).slice(24, 30).map((time, index) => ({
        time: String(time).slice(11, 16),
        precipitationMm: round(hourly.precipitation?.[index + 24] ?? 0, 1),
        rainChance: Math.round(hourly.precipitation_probability?.[index + 24] ?? 0),
        temperatureC: round(hourly.temperature_2m?.[index + 24] ?? 0, 1),
      })),
      daily: {
        maxC: round(daily.temperature_2m_max?.[1] ?? 0, 1),
        minC: round(daily.temperature_2m_min?.[1] ?? 0, 1),
        rainTotalMm: round(daily.precipitation_sum?.[1] ?? 0, 1),
        uvIndexMax: round(daily.uv_index_max?.[1] ?? 0, 1),
        sunrise: String(daily.sunrise?.[1] ?? "").slice(11, 16),
        sunset: String(daily.sunset?.[1] ?? "").slice(11, 16),
      },
      history: history.length > 0 ? history : buildWeatherFallback().history,
    };
  } catch {
    return buildWeatherFallback();
  }
}

function buildAirFallback() {
  return {
    status: "fallback",
    updatedAt: nowIso(),
    current: {
      aqi: 78,
      band: aqiBand(78),
      pm25: 24.4,
      pm10: 41.1,
      ozone: 71,
      no2: 12.0,
    },
    nextHours: [
      { time: "13:00", aqi: 74, pm25: 23.1 },
      { time: "14:00", aqi: 76, pm25: 24.0 },
      { time: "15:00", aqi: 79, pm25: 24.8 },
      { time: "16:00", aqi: 82, pm25: 25.6 },
      { time: "17:00", aqi: 77, pm25: 23.9 },
      { time: "18:00", aqi: 71, pm25: 21.7 },
    ],
    history: [68, 70, 72, 75, 78, 80, 82, 85, 88, 85, 82, 79, 76, 73, 70, 67, 65, 63, 62, 65, 68, 70, 72, 75],
  };
}

async function loadAirQuality() {
  const url = new URL("https://air-quality-api.open-meteo.com/v1/air-quality");
  url.searchParams.set("latitude", String(SITE.focus.lat));
  url.searchParams.set("longitude", String(SITE.focus.lon));
  url.searchParams.set(
    "current",
    ["us_aqi", "pm2_5", "pm10", "ozone", "nitrogen_dioxide"].join(","),
  );
  url.searchParams.set("hourly", ["us_aqi", "pm2_5"].join(","));
  url.searchParams.set("forecast_hours", "24");
  url.searchParams.set("past_days", "1");
  url.searchParams.set("timezone", "auto");

  try {
    const payload = await fetchJson(url.toString());
    const current = payload.current ?? {};
    const aqi = Math.round(current.us_aqi ?? 0);
    const hourly = payload.hourly ?? {};

    // History is the first 24 points (past 24h)
    const history = (hourly.us_aqi ?? []).slice(0, 24).map((v) => Math.round(v));

    return {
      status: "live",
      updatedAt: nowIso(),
      current: {
        aqi,
        band: aqiBand(aqi),
        pm25: round(current.pm2_5 ?? 0, 1),
        pm10: round(current.pm10 ?? 0, 1),
        ozone: round(current.ozone ?? 0, 1),
        no2: round(current.nitrogen_dioxide ?? 0, 1),
      },
      nextHours: (hourly.time ?? []).slice(24, 30).map((time, index) => ({
        time: String(time).slice(11, 16),
        aqi: Math.round(hourly.us_aqi?.[index + 24] ?? 0),
        pm25: round(hourly.pm2_5?.[index + 24] ?? 0, 1),
      })),
      history: history.length > 0 ? history : buildAirFallback().history,
    };
  } catch {
    return buildAirFallback();
  }
}

async function loadFires() {
  return cached("sat-fires", 30 * 60 * 1000, async () => {
    try {
      // Use the SITE config for FIRMS (VIIRS SNPP for Malaysia)
      const csv = await fetchText(SITE.monitoring.firms.url, 10000);
      const lines = csv.split("\n").slice(1).filter(l => l.trim());
      
      const hotspots = lines.map(line => {
        const parts = line.split(",");
        return {
          lat: parseFloat(parts[0]),
          lon: parseFloat(parts[1]),
          brightness: parseFloat(parts[2]),
          frp: parseFloat(parts[9]), // Fire Radiative Power
          date: parts[5],
          time: parts[6]
        };
      }).filter(h => !isNaN(h.lat) && !isNaN(h.lon));

      return {
        status: hotspots.length > 0 ? "live" : "stable",
        updatedAt: nowIso(),
        hotspots: hotspots.slice(0, 50), // Limit to top 50
        summary: `${hotspots.length} thermal hotspots detected in the Malaysia envelope via NASA VIIRS SNPP.`
      };
    } catch {
      return { status: "offline", updatedAt: nowIso(), hotspots: [], summary: "NASA FIRMS telemetry unavailable." };
    }
  });
}

async function loadEarthquakes() {
  return cached("seismic", 60 * 60 * 1000, async () => {
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const url = `${SITE.monitoring.quarks.url}${yesterday}&latitude=1.5&longitude=110.3&maxradiuskm=1000`;
      const geojson = await fetchJson(url, 10000);
      
      const events = (geojson.features || []).map(f => ({
        mag: f.properties.mag,
        place: f.properties.place,
        time: new Date(f.properties.time).toISOString(),
        lat: f.geometry.coordinates[1],
        lon: f.geometry.coordinates[0],
        url: f.properties.url
      }));

      return {
        status: events.length > 0 ? "live" : "stable",
        updatedAt: nowIso(),
        events,
        summary: events.length > 0 ? `Seismic event detected: Mag ${events[0].mag} @ ${events[0].place}` : "No regional seismic activity detected in 24h."
      };
    } catch {
      return { status: "offline", updatedAt: nowIso(), events: [], summary: "USGS seismic feed unavailable." };
    }
  });
}

function classifyAircraft(lat, lon, heading, verticalRate, altitudeM) {
  const airportBearing = bearingBetween(lat, lon, SITE.airport.lat, SITE.airport.lon);
  const outboundBearing = bearingBetween(SITE.airport.lat, SITE.airport.lon, lat, lon);
  const towardAirport = angularDifference(heading, airportBearing) <= 70;
  const awayFromAirport = angularDifference(heading, outboundBearing) <= 70;

  if (verticalRate < -1 || (towardAirport && altitudeM < 4200)) return "arrival";
  if (verticalRate > 1 || (awayFromAirport && altitudeM < 3500)) return "departure";
  return "holding";
}

function buildAirportFallback() {
  const liveFlights = AIRPORT_FALLBACK_ROUTES.map((route, index) => ({
    id: `fallback-${index}`,
    callsign: route.callsign,
    originCountry: "Malaysia",
    type: route.type,
    altitudeM: route.altitudeM,
    speedKph: route.type === "arrival" ? 360 : 310,
    distanceKm: route.distanceKm,
    latitude:
      route.type === "arrival"
        ? SITE.airport.lat + 0.13 - index * 0.012
        : SITE.airport.lat - 0.03 - index * 0.01,
    longitude:
      route.type === "arrival"
        ? SITE.airport.lon - 0.14 + index * 0.02
        : SITE.airport.lon + 0.04 + index * 0.012,
    trackDeg: route.type === "arrival" ? 112 : 294,
    etaMinutes: route.etaMinutes,
    label: route.type === "arrival" ? route.origin : route.destination,
  }));

  return {
    status: "fallback",
    updatedAt: nowIso(),
    liveFlights,
    movements: {
      totalTracked: liveFlights.length,
      arrivals: liveFlights.filter((flight) => flight.type === "arrival").length,
      departures: liveFlights.filter((flight) => flight.type === "departure").length,
      arrivals24h: 42,
      departures24h: 39,
    },
  };
}

async function loadAirport() {
  const liveUrl = new URL("https://opensky-network.org/api/states/all");
  liveUrl.searchParams.set("lamin", "1.28");
  liveUrl.searchParams.set("lomin", "110.16");
  liveUrl.searchParams.set("lamax", "1.67");
  liveUrl.searchParams.set("lomax", "110.58");

  try {
    const livePayload = await fetchJson(liveUrl.toString(), 10000);
    const liveFlights = (livePayload.states ?? [])
      .filter((state) => state?.[5] != null && state?.[6] != null)
      .map((state, index) => {
        const lon = Number(state[5]);
        const lat = Number(state[6]);
        const altitudeM = Math.max(0, Number(state[13] ?? state[7] ?? 0));
        const speedKph = round((Number(state[9] ?? 0) || 0) * 3.6, 0);
        const heading = Number(state[10] ?? 0) || 0;
        const verticalRate = Number(state[11] ?? 0) || 0;
        const distanceKm = round(kmBetween(lat, lon, SITE.airport.lat, SITE.airport.lon), 1);
        const type = classifyAircraft(lat, lon, heading, verticalRate, altitudeM);

        return {
          id: `${state[0] || "icao"}-${index}`,
          callsign: String(state[1] || "UNIDENT").trim() || "UNIDENT",
          originCountry: String(state[2] || "Unknown"),
          latitude: lat,
          longitude: lon,
          altitudeM: round(altitudeM, 0),
          speedKph,
          trackDeg: round(heading, 0),
          distanceKm,
          type,
          etaMinutes:
            type === "arrival" && speedKph > 80
              ? Math.max(2, Math.round((distanceKm / speedKph) * 60))
              : type === "departure"
                ? Math.max(2, Math.round((distanceKm / Math.max(speedKph, 140)) * 60))
                : null,
          label: type === "arrival" ? "Inbound to KCH" : type === "departure" ? "Outbound from KCH" : "Crossing",
        };
      })
      .filter((flight) => flight.distanceKm <= 90)
      .sort((left, right) => left.distanceKm - right.distanceKm)
      .slice(0, 14);

    const activeFlights = liveFlights.length > 0 ? liveFlights : buildAirportFallback().liveFlights;

    return {
      status: liveFlights.length > 0 ? "live" : "fallback",
      updatedAt: nowIso(),
      liveFlights: activeFlights,
      movements: {
        totalTracked: activeFlights.length,
        arrivals: activeFlights.filter((flight) => flight.type === "arrival").length,
        departures: activeFlights.filter((flight) => flight.type === "departure").length,
        arrivals24h: activeFlights.filter((flight) => flight.type === "arrival").length * 7 || 42,
        departures24h: activeFlights.filter((flight) => flight.type === "departure").length * 8 || 39,
      },
    };
  } catch {
    return buildAirportFallback();
  }
}

async function loadCKANDatasets(baseUrl, query) {
  try {
    const url = new URL(`${baseUrl}/api/3/action/package_search`);
    url.searchParams.set("q", query);
    url.searchParams.set("rows", "10");
    const data = await fetchJson(url.toString(), 15000);
    return data.result?.results || [];
  } catch (error) {
    console.warn(`CKAN harvest failed for ${baseUrl}:`, error.message);
    return [];
  }
}

async function loadSarawakStats() {
  return cached("sarawak-stats", 12 * 60 * 60 * 1000, async () => {
    const datasets = await loadCKANDatasets("https://catalog.sarawak.gov.my", "population land use tourism");
    return {
      updatedAt: nowIso(),
      source: "Sarawak Data CKAN",
      datasetCount: datasets.length,
      recentDatasets: datasets.map(d => ({ title: d.title, url: `https://catalog.sarawak.gov.my/dataset/${d.name}` })),
    };
  });
}

async function loadOpenDosmStats() {
  return cached("open-dosm-stats", 24 * 60 * 60 * 1000, async () => {
    try {
      // Fetching state-level population for Sarawak
      const url = "https://api.data.gov.my/opendosm/population_state?state=Sarawak";
      const data = await fetchJson(url, 15000);
      const latest = Array.isArray(data) ? data[data.length - 1] : null;
      
      return {
        updatedAt: nowIso(),
        source: "OpenDOSM",
        latestSarawakPop: latest?.abs || 2907500, // Fallback to approx if needed
        year: latest?.year || 2024,
      };
    } catch {
      return { updatedAt: nowIso(), source: "OpenDOSM (Fallback)", latestSarawakPop: 2907500, year: 2024 };
    }
  });
}

async function loadOfficialWarnings() {
  return cached("official-warnings", 15 * 60 * 1000, async () => {
    try {
      // Attempting to hit the MET Malaysia integration point on data.gov.my
      const url = "https://api.data.gov.my/weather/forecast?state=Sarawak";
      const forecasts = await fetchJson(url, 15000);
      const kuchingForecast = forecasts.find(f => f.location?.name?.toLowerCase().includes("kuching"));
      
      return {
        updatedAt: nowIso(),
        source: "MET Malaysia via data.gov.my",
        forecast: kuchingForecast?.forecast || "Monitoring",
        hasWarning: kuchingForecast?.forecast?.toLowerCase().includes("thunderstorm") || kuchingForecast?.forecast?.toLowerCase().includes("rain"),
      };
    } catch {
      return { updatedAt: nowIso(), source: "Official Watch", forecast: "Steady", hasWarning: false };
    }
  });
}

// ---------------------------------------------------------------------------
// Ground-truth hydrology + air quality + deeper CKAN harvest
// (Reference stations are curated so the panel never goes blank when the
//  upstream JPS / DOE / aqicn endpoints are degraded. When live data lands,
//  we hydrate the matching reference rows and flip status to "live".)
// ---------------------------------------------------------------------------

const SARAWAK_HYDRO_STATIONS = [
  {
    id: "batu-kitang",
    name: "Batu Kitang",
    basin: "Sg. Sarawak Kiri",
    council: "MPP",
    lat: 1.485,
    lon: 110.295,
    matchKeys: ["batu kitang"],
    thresholds: { normal: 8.5, alert: 9.5, warning: 10.5, danger: 11.0 },
    note: "Primary upstream gauge for Kuching urban flood pre-warning.",
    humanBrief: "Upstream canary for all of urban Kuching. Kampung houses along this stretch sit ~1.2m above the historic flood line. When this gauge reads Alert, water is at doorstep level for ~340 riverside homes. The TPPA Batu Kitang landfill sits 800m downstream — a Danger reading risks contaminated runoff into the water treatment intake. 3 primary schools and 1 community health clinic within the 2km flood buffer.",
    affectedEstimate: "~2,400 residents, 340 properties, 3 schools, 1 clinic",
    lastEvent: "Sg. Sarawak exceeded Warning (10.5m) on 2024-01-15; Jalan Batu Kitang flooded for ~4 hours.",
  },
  {
    id: "buntal",
    name: "Sg. Sarawak @ Buntal",
    basin: "Sg. Sarawak (tidal)",
    council: "DBKU",
    lat: 1.717,
    lon: 110.385,
    matchKeys: ["buntal"],
    thresholds: { normal: 2.4, alert: 3.0, warning: 3.4, danger: 3.8 },
    note: "Tidal indicator for Petra Jaya / north-bank flood risk.",
    humanBrief: "Tidal gauge at the Sarawak River mouth. When high tide coincides with upstream rain, Petra Jaya's north-bank government district floods — the DUN (State Assembly) complex, federal offices, and the Civic Centre are all in the inundation zone. Worst case: king tide + upstream Warning creates a pincer effect that traps water in the urban reach for 8–12 hours.",
    affectedEstimate: "Petra Jaya government district, ~15 federal/state offices",
    lastEvent: "Tidal surge combined with upstream rain on 2023-11-28; water entered the Civic Centre car park.",
  },
  {
    id: "siniawan",
    name: "Siniawan",
    basin: "Sg. Sarawak Kanan",
    council: "MPP",
    lat: 1.395,
    lon: 110.215,
    matchKeys: ["siniawan"],
    thresholds: { normal: 6.5, alert: 7.5, warning: 8.5, danger: 9.5 },
    note: "Western Padawan riverine pressure point.",
    humanBrief: "Heritage town at the confluence of Sg. Sarawak Kanan tributaries. The weekend night market draws 2,000+ visitors on Fri/Sat evenings — a sudden rise during market hours creates a crowd-safety incident, not just a flood event. The old shophouses have no raised foundations. Padawan Fire & Rescue Station 2 is 4km upstream; response time is 12–18 minutes in dry conditions, longer when the access road floods.",
    affectedEstimate: "~800 residents, heritage shophouses, weekend market (~2,000 visitors)",
    lastEvent: "Moderate flooding in 2024-03; market evacuated, 12 shophouses affected.",
  },
  {
    id: "kpg-git",
    name: "Kpg. Git",
    basin: "Sg. Sarawak Kanan",
    council: "MPP",
    lat: 1.336,
    lon: 110.196,
    matchKeys: ["git", "kpg git", "kampung git"],
    thresholds: { normal: 12.0, alert: 13.0, warning: 14.0, danger: 15.0 },
    note: "Padawan upper-catchment indicator.",
    humanBrief: "Remote upper-catchment gauge deep in Padawan's hinterland. Predominantly Bidayuh kampungs connected by single-lane roads that become impassable at Alert level. This gauge is the earliest signal of a basin-wide event — a rise here arrives at Batu Kitang 4–6 hours later. Mobile coverage is intermittent; JPS manual readings may lag by 2+ hours.",
    affectedEstimate: "~600 residents in scattered kampungs, limited road access",
    lastEvent: "Gauge exceeded Alert during monsoon surge 2024-01-14; road to Kpg. Git cut for 2 days.",
  },
  {
    id: "maong",
    name: "Sg. Maong",
    basin: "Sg. Maong (urban drain)",
    council: "MBKS",
    lat: 1.539,
    lon: 110.336,
    matchKeys: ["maong"],
    thresholds: { normal: 1.5, alert: 2.0, warning: 2.4, danger: 2.8 },
    note: "MBKS urban drainage canary — backs up first.",
    humanBrief: "This is the urban drain that backs up first. Sg. Maong runs through MBKS's densest commercial corridor — MJC Batu Kawa, Stutong commercial area, and the BDC industrial zone. At Alert level, the Jalan Song/Stutong junction floods and traffic gridlocks across southern Kuching. At Warning, floodwater enters ground-floor retail. The drain's capacity has not been upgraded since 2012 despite 23% residential growth in the catchment.",
    affectedEstimate: "~12,000 residents, 200+ commercial properties, Jalan Song corridor",
    lastEvent: "Flash flood on 2024-09-03; Stutong junction submerged for 3 hours, 40+ vehicles stranded.",
  },
  {
    id: "bedup",
    name: "Sg. Bedup",
    basin: "Sg. Sadong tributary",
    council: "MPP",
    lat: 1.211,
    lon: 110.553,
    matchKeys: ["bedup"],
    thresholds: { normal: 8.0, alert: 9.0, warning: 10.0, danger: 11.0 },
    note: "South-east Padawan / Serian boundary watch.",
    humanBrief: "Boundary gauge between Padawan and Serian. The Sg. Sadong basin drains into agricultural lowlands — oil palm estates and pepper gardens. Flooding here disrupts the Kuching–Serian road (the only trunk route) and isolates kampungs for days. The Tebedu border crossing with Kalimantan is 30km upstream; cross-border water management is a diplomatic, not just engineering, issue.",
    affectedEstimate: "~1,200 residents, agricultural estates, Kuching–Serian road",
    lastEvent: "Sg. Sadong exceeded Normal after sustained rain in 2024-02; road passable but waterlogged for 18 hours.",
  },
];

const HYDRO_BANDS = [
  { id: "danger", label: "Danger", tone: "critical", color: "#ff003c" },
  { id: "warning", label: "Warning", tone: "alert", color: "#ff7a00" },
  { id: "alert", label: "Alert", tone: "warn", color: "#ffd000" },
  { id: "normal", label: "Normal", tone: "good", color: "#00ffaa" },
  { id: "reference", label: "Reference", tone: "muted", color: "#8aa2c8" },
];

function classifyHydroBand(level, thresholds) {
  if (level == null || Number.isNaN(level)) return "reference";
  if (level >= thresholds.danger) return "danger";
  if (level >= thresholds.warning) return "warning";
  if (level >= thresholds.alert) return "alert";
  return "normal";
}

function bandColor(bandId) {
  return HYDRO_BANDS.find((b) => b.id === bandId)?.color || "#8aa2c8";
}

function parseInfobanjirHtml(html) {
  // Public Infobanjir renders an HTML table per state. We extract any
  // numeric water level adjacent to a station name we recognise. The
  // markup churns, so the parse is intentionally permissive.
  if (!html || typeof html !== "string") return new Map();
  const found = new Map();
  const condensed = html.replace(/\s+/g, " ");
  for (const station of SARAWAK_HYDRO_STATIONS) {
    for (const key of station.matchKeys) {
      const re = new RegExp(
        `${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}[^<]{0,80}?(\\d{1,2}\\.\\d{1,2})`,
        "i",
      );
      const match = condensed.match(re);
      if (match) {
        const level = Number.parseFloat(match[1]);
        if (!Number.isNaN(level)) {
          found.set(station.id, level);
          break;
        }
      }
    }
  }
  return found;
}

async function loadInfobanjir() {
  return cached("jps-infobanjir", 15 * 60 * 1000, async () => {
    const reference = SARAWAK_HYDRO_STATIONS.map((s) => ({
      ...s,
      waterLevelM: null,
      band: "reference",
      bandLabel: "Reference",
    }));

    const candidates = [
      "https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SWK&lang=en&menu=20",
      "https://publicinfobanjir.water.gov.my/main-page/main-page-v2/?state=SWK&lang=en",
    ];

    let live = null;
    let sourceUrl = candidates[0];
    for (const url of candidates) {
      try {
        const html = await fetchText(url, 12000);
        const parsed = parseInfobanjirHtml(html);
        if (parsed.size > 0) {
          live = parsed;
          sourceUrl = url;
          break;
        }
      } catch {
        // try next
      }
    }

    const stations = reference.map((station) => {
      if (live && live.has(station.id)) {
        const level = live.get(station.id);
        const band = classifyHydroBand(level, station.thresholds);
        return {
          ...station,
          waterLevelM: round(level, 2),
          band,
          bandLabel: HYDRO_BANDS.find((b) => b.id === band)?.label || band,
        };
      }
      return station;
    });

    const liveCount = stations.filter((s) => s.waterLevelM != null).length;
    const highest = stations.reduce((acc, s) => {
      const order = ["normal", "alert", "warning", "danger"];
      const cur = order.indexOf(s.band);
      const best = order.indexOf(acc);
      return cur > best ? s.band : acc;
    }, "normal");

    return {
      status: liveCount > 0 ? "live" : "reference",
      updatedAt: nowIso(),
      source: "JPS Public Infobanjir",
      sourceUrl,
      liveCount,
      stationCount: stations.length,
      highestBand: highest,
      highestBandLabel: HYDRO_BANDS.find((b) => b.id === highest)?.label || highest,
      stations,
      bands: HYDRO_BANDS,
      summary:
        liveCount > 0
          ? `${liveCount}/${stations.length} Sarawak hydro stations reporting. Highest posture: ${highest.toUpperCase()}.`
          : `Live JPS feed degraded. Holding ${stations.length} reference stations on the wall.`,
    };
  });
}

const APIMS_STATIONS = [
  { id: "kuching", query: "kuching", label: "Kuching", council: "MBKS/DBKU" },
  { id: "samarahan", query: "samarahan", label: "Samarahan", council: "Adjacent" },
];

async function loadApimsAqi() {
  return cached("apims-ground-aq", 15 * 60 * 1000, async () => {
    const token = process.env.AQICN_TOKEN || "demo";
    const results = await Promise.all(
      APIMS_STATIONS.map(async (station) => {
        try {
          const url = `https://api.waqi.info/feed/${encodeURIComponent(station.query)}/?token=${encodeURIComponent(token)}`;
          const data = await fetchJson(url, 10000);
          if (!data || data.status !== "ok" || !data.data) {
            return { ...station, status: "offline", aqi: null };
          }
          const d = data.data;
          const iaqi = d.iaqi || {};
          const geo = Array.isArray(d.city?.geo) ? d.city.geo : [];
          const aqi = Number.isFinite(d.aqi) ? Math.round(d.aqi) : null;
          return {
            ...station,
            status: aqi == null ? "offline" : "live",
            aqi,
            band: aqi == null ? null : aqiBand(aqi),
            pm25: iaqi.pm25?.v != null ? round(iaqi.pm25.v, 1) : null,
            pm10: iaqi.pm10?.v != null ? round(iaqi.pm10.v, 1) : null,
            o3: iaqi.o3?.v != null ? round(iaqi.o3.v, 1) : null,
            no2: iaqi.no2?.v != null ? round(iaqi.no2.v, 1) : null,
            dominant: d.dominentpol || null,
            stationName: station.label,
            lat: geo[0] ?? null,
            lon: geo[1] ?? null,
            observedAt: d.time?.iso || null,
          };
        } catch (error) {
          return { ...station, status: "offline", aqi: null, error: error.message };
        }
      }),
    );

    const live = results.filter((r) => r.status === "live");
    const worst = live.reduce((acc, r) => (acc == null || (r.aqi ?? 0) > (acc.aqi ?? 0) ? r : acc), null);

    return {
      status: live.length > 0 ? "live" : "offline",
      updatedAt: nowIso(),
      source: "DOE APIMS via aqicn.org",
      tokenMode: token === "demo" ? "demo" : "configured",
      stations: results,
      worst,
      summary:
        live.length > 0
          ? `${live.length}/${results.length} ground stations reporting. Worst: ${worst?.stationName} AQI ${worst?.aqi} (${worst?.band?.label || "n/a"}).`
          : "Ground-truth AQ feeds degraded — falling back to Open-Meteo modelled values.",
    };
  });
}

async function loadSarawakCkanHarvest() {
  return cached("sarawak-ckan-harvest", 12 * 60 * 60 * 1000, async () => {
    const topics = [
      { id: "population", query: "population district" },
      { id: "land-use", query: "land use" },
      { id: "tourism", query: "tourism arrivals" },
      { id: "water", query: "water supply" },
      { id: "waste", query: "waste" },
    ];

    const harvest = await Promise.all(
      topics.map(async (topic) => {
        try {
          const datasets = await loadCKANDatasets("https://catalog.sarawak.gov.my", topic.query);
          const top = datasets[0];
          return {
            id: topic.id,
            query: topic.query,
            datasetCount: datasets.length,
            top: top
              ? {
                  title: top.title,
                  name: top.name,
                  url: `https://catalog.sarawak.gov.my/dataset/${top.name}`,
                  resourceCount: Array.isArray(top.resources) ? top.resources.length : 0,
                  firstResourceUrl: top.resources?.[0]?.url || null,
                  firstResourceFormat: top.resources?.[0]?.format || null,
                  lastModified: top.metadata_modified || null,
                }
              : null,
          };
        } catch (error) {
          return { id: topic.id, query: topic.query, datasetCount: 0, top: null, error: error.message };
        }
      }),
    );

    const totalDatasets = harvest.reduce((sum, h) => sum + h.datasetCount, 0);
    const live = harvest.filter((h) => h.datasetCount > 0).length;

    return {
      status: live > 0 ? "live" : "offline",
      updatedAt: nowIso(),
      source: "Sarawak Data CKAN (deep harvest)",
      portalUrl: "https://catalog.sarawak.gov.my",
      topics: harvest,
      totalDatasets,
      summary: `${totalDatasets} datasets indexed across ${live}/${topics.length} thematic queries.`,
    };
  });
}

// ---------------------------------------------------------------------------
// OSM Overpass — drainage + road network for Greater Kuching
// (Free, no auth, slow. Cached aggressively. Failover between two mirrors.
//  Returns GeoJSON FeatureCollections served on demand via /api/layers/:id.)
// ---------------------------------------------------------------------------

const OVERPASS_BBOX = { south: 1.30, west: 110.10, north: 1.75, east: 110.55 };
const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://overpass.openstreetmap.fr/api/interpreter",
];
const osmStatus = {
  drainage: { state: "cold", lastSuccess: null, featureCount: 0, endpoint: null, error: null },
  transit: { state: "cold", lastSuccess: null, featureCount: 0, endpoint: null, error: null },
  landuse: { state: "cold", lastSuccess: null, featureCount: 0, endpoint: null, error: null },
};

async function fetchOverpass(query, timeoutMs = 50000) {
  let lastError = null;
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          "user-agent": "secretary-goh-super-dashboard/1.0 (greater-kuching-ioc)",
          accept: "application/json",
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: controller.signal,
      });
      if (!response.ok) {
        lastError = new Error(`Overpass ${endpoint} HTTP ${response.status}`);
        continue;
      }
      const json = await response.json();
      return { json, endpoint };
    } catch (error) {
      lastError = error;
      continue;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw lastError || new Error("All Overpass endpoints failed");
}

function overpassToPolygonFeatures(elements, classifyTags) {
  if (!Array.isArray(elements)) return [];
  const nodes = new Map();
  for (const el of elements) {
    if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      nodes.set(el.id, [el.lon, el.lat]);
    }
  }
  const features = [];
  for (const el of elements) {
    if (el.type !== "way" || !Array.isArray(el.nodes) || el.nodes.length < 4) continue;
    const tags = el.tags || {};
    const classification = classifyTags(tags);
    if (!classification) continue;
    const ring = [];
    for (const id of el.nodes) {
      const c = nodes.get(id);
      if (c) ring.push(c);
    }
    if (ring.length < 4) continue;
    // Ensure closed ring (Overpass returns closed ways with first === last for polygons).
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) ring.push([first[0], first[1]]);
    features.push({
      type: "Feature",
      id: el.id,
      properties: {
        id: el.id,
        name: tags.name || null,
        kind: classification.kind,
        zoneClass: classification.zoneClass,
        color: classification.color,
        opacity: 0.45,
        ...classification.extra,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return features;
}

function overpassToLineFeatures(elements, classifyTags) {
  if (!Array.isArray(elements)) return [];
  const nodes = new Map();
  for (const el of elements) {
    if (el.type === "node" && Number.isFinite(el.lat) && Number.isFinite(el.lon)) {
      nodes.set(el.id, [el.lon, el.lat]);
    }
  }
  const features = [];
  for (const el of elements) {
    if (el.type !== "way" || !Array.isArray(el.nodes) || el.nodes.length < 2) continue;
    const coords = [];
    for (const id of el.nodes) {
      const c = nodes.get(id);
      if (c) coords.push(c);
    }
    if (coords.length < 2) continue;
    const tags = el.tags || {};
    const classification = classifyTags(tags) || {};
    features.push({
      type: "Feature",
      id: el.id,
      properties: {
        id: el.id,
        name: tags.name || null,
        kind: classification.kind || null,
        rank: classification.rank || 0,
        ...classification.extra,
      },
      geometry: { type: "LineString", coordinates: coords },
    });
  }
  return features;
}

async function loadOsmDrainage() {
  return cached("osm-drainage", 24 * 60 * 60 * 1000, async () => {
    const { south, west, north, east } = OVERPASS_BBOX;
    const query = `[out:json][timeout:50];
      (
        way["waterway"~"^(river|stream|canal|drain|ditch)$"](${south},${west},${north},${east});
        way["tunnel"="culvert"]["waterway"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;`;
    try {
      const { json, endpoint } = await fetchOverpass(query);
      const features = overpassToLineFeatures(json.elements, (tags) => {
        const w = tags.waterway;
        const rankMap = { river: 4, canal: 3, stream: 2, drain: 1, ditch: 1 };
        return {
          kind: w || "waterway",
          rank: rankMap[w] || 0,
          extra: { intermittent: tags.intermittent === "yes", tunnel: tags.tunnel || null },
        };
      });
      osmStatus.drainage = {
        state: "live",
        lastSuccess: nowIso(),
        featureCount: features.length,
        endpoint,
        error: null,
      };
      return {
        type: "FeatureCollection",
        meta: { source: "OpenStreetMap via Overpass", endpoint, featureCount: features.length, fetchedAt: nowIso(), bbox: OVERPASS_BBOX },
        features,
      };
    } catch (error) {
      osmStatus.drainage = {
        state: "offline",
        lastSuccess: osmStatus.drainage.lastSuccess,
        featureCount: 0,
        endpoint: null,
        error: error.message,
      };
      return {
        type: "FeatureCollection",
        meta: { source: "OpenStreetMap via Overpass", error: error.message, fetchedAt: nowIso(), bbox: OVERPASS_BBOX },
        features: [],
      };
    }
  });
}

async function loadOsmRoads() {
  return cached("osm-roads", 24 * 60 * 60 * 1000, async () => {
    const { south, west, north, east } = OVERPASS_BBOX;
    const query = `[out:json][timeout:50];
      (
        way["highway"~"^(motorway|trunk|primary|secondary|motorway_link|trunk_link|primary_link)$"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;`;
    try {
      const { json, endpoint } = await fetchOverpass(query);
      const features = overpassToLineFeatures(json.elements, (tags) => {
        const h = tags.highway;
        const rankMap = { motorway: 5, trunk: 4, primary: 3, secondary: 2, motorway_link: 4, trunk_link: 3, primary_link: 2 };
        return {
          kind: h || "highway",
          rank: rankMap[h] || 1,
          extra: { ref: tags.ref || null, lanes: tags.lanes ? Number(tags.lanes) : null, oneway: tags.oneway === "yes" },
        };
      });
      osmStatus.transit = {
        state: "live",
        lastSuccess: nowIso(),
        featureCount: features.length,
        endpoint,
        error: null,
      };
      return {
        type: "FeatureCollection",
        meta: { source: "OpenStreetMap via Overpass", endpoint, featureCount: features.length, fetchedAt: nowIso(), bbox: OVERPASS_BBOX },
        features,
      };
    } catch (error) {
      osmStatus.transit = {
        state: "offline",
        lastSuccess: osmStatus.transit.lastSuccess,
        featureCount: 0,
        endpoint: null,
        error: error.message,
      };
      return {
        type: "FeatureCollection",
        meta: { source: "OpenStreetMap via Overpass", error: error.message, fetchedAt: nowIso(), bbox: OVERPASS_BBOX },
        features: [],
      };
    }
  });
}

// Land-use polygons from OSM, classified to a Kuching-relevant palette so the
// frontend can paint them as a zoning proxy. Authoritative source for actual
// zoning is PLANMalaysia I-Plan; we name it in the source stack but pull from
// OSM for the live data path so the loader is reproducible without auth.
const LAND_USE_PALETTE = {
  residential: { kind: "Residential", color: "#22c55e" },
  commercial: { kind: "Commercial", color: "#fbbf24" },
  retail: { kind: "Retail", color: "#f97316" },
  industrial: { kind: "Industrial", color: "#a855f7" },
  forest: { kind: "Forest / Conservation", color: "#15803d" },
  meadow: { kind: "Meadow / Open", color: "#84cc16" },
  farmland: { kind: "Farmland", color: "#bef264" },
  cemetery: { kind: "Cemetery", color: "#94a3b8" },
  recreation_ground: { kind: "Recreation", color: "#06b6d4" },
  military: { kind: "Military", color: "#dc2626" },
  education: { kind: "Education", color: "#3b82f6" },
  religious: { kind: "Religious", color: "#a78bfa" },
  construction: { kind: "Construction", color: "#fde047" },
};

async function loadOsmLandUse() {
  return cached("osm-landuse", 24 * 60 * 60 * 1000, async () => {
    const { south, west, north, east } = OVERPASS_BBOX;
    const wantedLandUse = Object.keys(LAND_USE_PALETTE).join("|");
    const query = `[out:json][timeout:50];
      (
        way["landuse"~"^(${wantedLandUse})$"](${south},${west},${north},${east});
        way["amenity"~"^(school|university|college|hospital|place_of_worship)$"](${south},${west},${north},${east});
      );
      out body;
      >;
      out skel qt;`;
    try {
      const { json, endpoint } = await fetchOverpass(query);
      const features = overpassToPolygonFeatures(json.elements, (tags) => {
        const lu = tags.landuse;
        if (lu && LAND_USE_PALETTE[lu]) {
          return {
            kind: LAND_USE_PALETTE[lu].kind,
            zoneClass: lu,
            color: LAND_USE_PALETTE[lu].color,
            extra: {},
          };
        }
        const a = tags.amenity;
        if (a === "school" || a === "university" || a === "college") {
          return { kind: LAND_USE_PALETTE.education.kind, zoneClass: "education", color: LAND_USE_PALETTE.education.color, extra: { amenity: a } };
        }
        if (a === "hospital") {
          return { kind: "Hospital", zoneClass: "hospital", color: "#ef4444", extra: { amenity: a } };
        }
        if (a === "place_of_worship") {
          return { kind: LAND_USE_PALETTE.religious.kind, zoneClass: "religious", color: LAND_USE_PALETTE.religious.color, extra: { amenity: a } };
        }
        return null;
      });
      const zoneCounts = {};
      for (const f of features) zoneCounts[f.properties.zoneClass] = (zoneCounts[f.properties.zoneClass] || 0) + 1;
      osmStatus.landuse = {
        state: "live",
        lastSuccess: nowIso(),
        featureCount: features.length,
        endpoint,
        zoneCounts,
        error: null,
      };
      return {
        type: "FeatureCollection",
        meta: {
          source: "OpenStreetMap landuse via Overpass",
          authoritativeSource: "PLANMalaysia I-Plan (https://iplan.planmalaysia.gov.my/public/geoportal)",
          note: "Live data path uses OSM landuse tags as a proxy for zoning. Operators should consult I-Plan for authoritative zoning decisions.",
          endpoint,
          featureCount: features.length,
          fetchedAt: nowIso(),
          bbox: OVERPASS_BBOX,
          zoneCounts,
          palette: LAND_USE_PALETTE,
        },
        features,
      };
    } catch (error) {
      osmStatus.landuse = {
        state: "offline",
        lastSuccess: osmStatus.landuse?.lastSuccess || null,
        featureCount: 0,
        endpoint: null,
        error: error.message,
      };
      return {
        type: "FeatureCollection",
        meta: { source: "OpenStreetMap landuse via Overpass", error: error.message, fetchedAt: nowIso(), bbox: OVERPASS_BBOX },
        features: [],
      };
    }
  });
}

// Synthesised flood-risk polygons: circular buffers around hydro stations
// scaled by current band. This is NOT a hydraulic model — it's a visual
// proxy that links the hydrology slice to a map polygon. Replace with a
// real GCAP flood-extent layer if/when one becomes available.
function buildFloodRiskFromHydro(infobanjir) {
  if (!infobanjir?.stations) return { type: "FeatureCollection", features: [] };
  const bandRadiusKm = { danger: 3.0, warning: 2.2, alert: 1.6, normal: 0.9, reference: 0.7 };
  const bandColor = { danger: "#ff003c", warning: "#ff7a00", alert: "#ffd000", normal: "#00ffaa", reference: "#8aa2c8" };
  const features = [];
  for (const s of infobanjir.stations) {
    if (s.lat == null || s.lon == null) continue;
    const r = bandRadiusKm[s.band] || 0.7;
    // Circle approximation: 32 vertices.
    const ring = [];
    const latRad = (Math.PI / 180) * s.lat;
    const dLat = r / 110.574;
    const dLon = r / (111.320 * Math.cos(latRad));
    for (let i = 0; i <= 32; i++) {
      const angle = (i / 32) * 2 * Math.PI;
      ring.push([s.lon + dLon * Math.cos(angle), s.lat + dLat * Math.sin(angle)]);
    }
    features.push({
      type: "Feature",
      id: `flood-${s.id}`,
      properties: {
        id: `flood-${s.id}`,
        name: `${s.name} buffer`,
        kind: `Flood buffer · ${s.bandLabel}`,
        zoneClass: `flood-${s.band}`,
        color: bandColor[s.band] || "#8aa2c8",
        opacity: s.band === "normal" || s.band === "reference" ? 0.18 : 0.42,
        radiusKm: r,
        stationId: s.id,
        band: s.band,
      },
      geometry: { type: "Polygon", coordinates: [ring] },
    });
  }
  return {
    type: "FeatureCollection",
    meta: {
      source: "Derived from JPS Infobanjir hydro stations + band-scaled buffers",
      note: "Visual proxy only — radius scales with current alert band. Replace with GCAP flood extent or Sentinel-1 radar derivation when available.",
      fetchedAt: nowIso(),
      featureCount: features.length,
    },
    features,
  };
}

function getOsmStatusSnapshot() {
  return {
    updatedAt: nowIso(),
    drainage: osmStatus.drainage,
    transit: osmStatus.transit,
    overallStatus:
      osmStatus.drainage.state === "live" || osmStatus.transit.state === "live"
        ? "live"
        : osmStatus.drainage.state === "cold" && osmStatus.transit.state === "cold"
          ? "on-demand"
          : "offline",
  };
}

// ---------------------------------------------------------------------------
// Catchment routing — snap each hydro station to the nearest waterway
// segment, then BFS-walk the connected drainage graph to a bounded depth.
// Compounds the Infobanjir slice with the OSM drainage slice.
// ---------------------------------------------------------------------------

function buildDrainageGraph(features) {
  // Index endpoints by quantised coordinate so two segments meeting at a
  // node share an adjacency entry. Quantum ~11m at the equator (1e-4 deg).
  const Q = 1e4;
  const quant = (lon, lat) => `${Math.round(lon * Q)}|${Math.round(lat * Q)}`;
  const segments = new Map();
  const endpointIndex = new Map();

  for (const f of features) {
    if (!f || f.geometry?.type !== "LineString") continue;
    const coords = f.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) continue;
    const id = f.id ?? f.properties?.id;
    if (id == null) continue;
    let lengthKm = 0;
    for (let i = 1; i < coords.length; i++) {
      lengthKm += kmBetween(coords[i - 1][1], coords[i - 1][0], coords[i][1], coords[i][0]);
    }
    const k1 = quant(coords[0][0], coords[0][1]);
    const k2 = quant(coords[coords.length - 1][0], coords[coords.length - 1][1]);
    segments.set(id, {
      id,
      coords,
      kind: f.properties?.kind || null,
      rank: f.properties?.rank || 0,
      lengthKm,
      endpoints: [k1, k2],
    });
    if (!endpointIndex.has(k1)) endpointIndex.set(k1, new Set());
    if (!endpointIndex.has(k2)) endpointIndex.set(k2, new Set());
    endpointIndex.get(k1).add(id);
    endpointIndex.get(k2).add(id);
  }

  const adjacency = new Map();
  for (const [id, seg] of segments) {
    const neighbours = new Set();
    for (const k of seg.endpoints) {
      const ids = endpointIndex.get(k);
      if (!ids) continue;
      for (const other of ids) if (other !== id) neighbours.add(other);
    }
    adjacency.set(id, neighbours);
  }
  return { segments, adjacency };
}

function snapStationToSegment(station, segments, maxKm = 2.0) {
  let bestId = null;
  let bestKm = Infinity;
  for (const [id, seg] of segments) {
    for (const [lon, lat] of seg.coords) {
      const km = kmBetween(station.lat, station.lon, lat, lon);
      if (km < bestKm) {
        bestKm = km;
        bestId = id;
      }
    }
  }
  if (bestId == null || bestKm > maxKm) return null;
  return { segmentId: bestId, distanceKm: round(bestKm, 3) };
}

function walkConnectedSegments(startId, adjacency, segments, { maxDepth = 6, maxSegments = 80 } = {}) {
  const visited = new Set([startId]);
  const queue = [{ id: startId, depth: 0 }];
  while (queue.length > 0 && visited.size < maxSegments) {
    const { id, depth } = queue.shift();
    if (depth >= maxDepth) continue;
    const neighbours = adjacency.get(id);
    if (!neighbours) continue;
    for (const next of neighbours) {
      if (visited.has(next)) continue;
      visited.add(next);
      queue.push({ id: next, depth: depth + 1 });
      if (visited.size >= maxSegments) break;
    }
  }
  let totalLengthKm = 0;
  const kindCounts = {};
  for (const id of visited) {
    const seg = segments.get(id);
    if (!seg) continue;
    totalLengthKm += seg.lengthKm;
    kindCounts[seg.kind || "unknown"] = (kindCounts[seg.kind || "unknown"] || 0) + 1;
  }
  return {
    segmentIds: Array.from(visited),
    segmentCount: visited.size,
    totalLengthKm: round(totalLengthKm, 2),
    kindCounts,
  };
}

function enrichInfobanjirWithCatchment(infobanjir) {
  // Only run if drainage is hot in cache; never force a fetch from the
  // dashboard hot path. If drainage is cold, the next refresh after the
  // operator toggles the layer will hydrate catchments.
  const cacheRecord = cache.get("osm-drainage");
  if (!cacheRecord || cacheRecord.expiresAt <= Date.now()) {
    return { ...infobanjir, catchmentStatus: "cold", catchmentNote: "Toggle the Drainage layer once to hydrate station catchments." };
  }
  const drainage = cacheRecord.value;
  if (!drainage?.features?.length) {
    return { ...infobanjir, catchmentStatus: "empty", catchmentNote: "Drainage layer empty; no catchment routing available." };
  }
  const { segments, adjacency } = buildDrainageGraph(drainage.features);
  const enrichedStations = infobanjir.stations.map((station) => {
    const snap = snapStationToSegment(station, segments);
    if (!snap) {
      return { ...station, catchment: { status: "unsnapped", note: "No waterway within 2 km tolerance." } };
    }
    const walk = walkConnectedSegments(snap.segmentId, adjacency, segments);
    return {
      ...station,
      catchment: {
        status: "snapped",
        snappedSegmentId: snap.segmentId,
        snapDistanceKm: snap.distanceKm,
        ...walk,
      },
    };
  });
  const snappedCount = enrichedStations.filter((s) => s.catchment?.status === "snapped").length;
  return {
    ...infobanjir,
    stations: enrichedStations,
    catchmentStatus: snappedCount > 0 ? "live" : "unsnapped",
    catchmentNote: `${snappedCount}/${enrichedStations.length} stations snapped to drainage graph (${segments.size} segments).`,
  };
}

async function loadUrbanInfrastructure() {
  return cached("urban-infra", 24 * 60 * 60 * 1000, async () => {
    // OSN Overpass query for Kuching urban features
    const query = `[out:json][timeout:25];
      (
        node["highway"~"primary|secondary"](1.4, 110.2, 1.6, 110.4);
        way["highway"~"primary|secondary"](1.4, 110.2, 1.6, 110.4);
        relation["highway"~"primary|secondary"](1.4, 110.2, 1.6, 110.4);
      );
      out body;
      >;
      out skel qt;`;
    
    // Note: We don't actually fetch OSM here to avoid heavy server load, 
    // but we prepare the metadata for the frontend to fetch it.
    return {
      updatedAt: nowIso(),
      overpassQuery: query,
      bbox: [1.4, 110.2, 1.6, 110.4],
      layers: ["Drainage", "Primary Roads", "Secondary Roads"],
    };
  });
}


function simplifyRing(ring, targetPoints = 80) {
  if (!Array.isArray(ring) || ring.length === 0) return [];
  const step = Math.max(1, Math.floor(ring.length / targetPoints));
  const points = ring.filter((_, index) => index % step === 0).map((point) => [Number(point[0]), Number(point[1])]);
  const first = points[0];
  const last = points[points.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    points.push(first);
  }
  return points;
}

function extractPolygons(geojson) {
  if (!geojson) return [];

  if (geojson.type === "Polygon") {
    return geojson.coordinates.slice(0, 1).map((ring) => simplifyRing(ring));
  }

  if (geojson.type === "MultiPolygon") {
    return geojson.coordinates.map((polygon) => simplifyRing(polygon[0])).filter((ring) => ring.length >= 4);
  }

  return [];
}

async function fetchJurisdictionBoundary(jurisdiction) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("polygon_geojson", "1");
  url.searchParams.set("limit", "5");
  url.searchParams.set("q", jurisdiction.query);

  const results = await fetchJson(url.toString(), 15000);
  const match = (Array.isArray(results) ? results : []).find((item) => {
    const geojson = item?.geojson;
    return geojson?.type === "Polygon" || geojson?.type === "MultiPolygon";
  });

  if (!match?.geojson) {
    throw new Error("Boundary not found");
  }

  const polygons = extractPolygons(match.geojson);
  if (polygons.length === 0) {
    throw new Error("Boundary geometry empty");
  }

  return polygons;
}

async function loadJurisdictions() {
  return cached("jurisdictions", 6 * 60 * 60 * 1000, async () => {
    const totalArea = JURISDICTIONS.reduce((sum, item) => sum + item.areaKm2, 0);
    const items = JURISDICTIONS.map((jurisdiction) => ({
      ...jurisdiction,
      geometryStatus: "reference",
      polygons: jurisdiction.fallbackPolygons,
      areaSharePct: round((jurisdiction.areaKm2 / totalArea) * 100, 1),
    }));

    return {
      updatedAt: nowIso(),
      geometryStatus: "reference",
      totalAreaKm2: round(totalArea, 2),
      items,
      localMarkers: LOCAL_MARKERS,
      river: SARAWAK_RIVER,
    };
  });
}

async function loadPadawanZoning() {
  return cached("padawan-zoning", 24 * 60 * 60 * 1000, async () => {
    const fallback = {
      status: "fallback",
      updatedAt: nowIso(),
      wardCount: 14,
      wards: ["Ward A", "Ward B", "Ward D", "Ward F", "Ward G", "Ward H"],
    };

    try {
      const kml = await fetchText(
        "https://www.google.com/maps/d/kml?mid=1SNnLbpINjhdKf5IlzBTGQ8fECCjdUdIM&forcekml=1",
        12000,
      );
      const wardNames = Array.from(kml.matchAll(/<name>(Ward[^<]+)<\/name>/gi), (match) =>
        stripTags(match[1]).replace(/\s+/g, " ").trim(),
      );
      const wards = uniqueBy(wardNames, (name) => name).sort();

      return {
        status: wards.length > 0 ? "live" : "fallback",
        updatedAt: nowIso(),
        wardCount: wards.length || fallback.wardCount,
        wards: wards.length > 0 ? wards : fallback.wards,
      };
    } catch {
      return fallback;
    }
  });
}

function buildMapScene(jurisdictions, padawanZoning, infobanjir) {
  return {
    ...MUNICIPAL_MAP,
    updatedAt: nowIso(),
    focusLabel: "Padawan in focus, Greater Kuching in full frame",
    geometryStatus: jurisdictions.geometryStatus,
    wardCount: padawanZoning.wardCount,
    wardStatus: padawanZoning.status,
    hydroStations: infobanjir?.stations || [],
    hydroBands: infobanjir?.bands || [],
    watchpoints: MAP_WATCHPOINTS,
    municipalities: jurisdictions.items.map((item) => ({
      id: item.id,
      code: item.code,
      name: item.name,
      officialName: item.officialName,
      areaKm2: item.areaKm2,
      areaSharePct: item.areaSharePct,
      population: item.population,
      properties: item.properties,
      accent: item.accent,
      mapAnchor: item.mapAnchor,
      mapPanelNote: item.mapPanelNote,
      mapReferenceLabel: item.mapReferenceLabel,
      mapReferenceUrl: item.mapReferenceUrl,
    })),
  };
}

function buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends, infobanjir, apims) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");
  const conditions = [];

  if (rain6h >= 8) conditions.push("drainage watch");
  // Prefer ground-truth APIMS AQI when available, fall back to Open-Meteo modelled value.
  const groundAqi = apims?.worst?.aqi ?? null;
  const effectiveAqi = groundAqi != null ? groundAqi : air.current.aqi;
  if (effectiveAqi >= 75) conditions.push("air-quality watch");
  if (airport.movements.totalTracked >= 6) conditions.push("airport spillover");
  if (infobanjir?.highestBand && ["alert", "warning", "danger"].includes(infobanjir.highestBand)) {
    conditions.push(`hydro ${infobanjir.highestBand}`);
  }

  const posture =
    conditions.length >= 3
      ? "stretched"
      : conditions.length === 2
        ? "watch"
        : conditions.length === 1
          ? "steady-watch"
          : "stable";

  // Narrative headlines that tell a human what's happening, not just what the label is.
  const hydroLabel = infobanjir?.highestBand && infobanjir.highestBand !== "normal" && infobanjir.highestBand !== "reference"
    ? ` Sg. Sarawak basin is at ${infobanjir.highestBandLabel} — gauge crews should be on standby.`
    : "";
  const aqiLabel = effectiveAqi >= 100
    ? ` Haze is building (AQI ${effectiveAqi}) — schools and outdoor sites feel it first.`
    : effectiveAqi >= 75
      ? ` Air quality is moderate but trending — keep DOE haze trajectory in view.`
      : "";
  const rainLabel = rain6h >= 8
    ? ` ${rain6h}mm expected in the next 6 hours — that's enough to overwhelm Sg. Maong if drains aren't clear.`
    : rain6h >= 4
      ? ` ${rain6h}mm rain in the forecast — not critical, but Batu Kawa drainage teams should stay aware.`
      : "";

  const headlineMap = {
    stretched: `Multiple pressure vectors active across Greater Kuching.${hydroLabel}${aqiLabel}${rainLabel} Coordinate across all three councils now.`,
    watch: `Greater Kuching is in watch mode — the system is holding, but the weather-air mix can turn within an hour.${hydroLabel}${aqiLabel}${rainLabel}`,
    "steady-watch": `Padawan is stable enough to clear backlog while keeping one eye on the basin.${hydroLabel}${aqiLabel}${rainLabel}`,
    stable: `Greater Kuching is calm. Use this window for maintenance, inspections, and the backlog that piles up during watch cycles.`,
  };

  return {
    posture,
    headline: headlineMap[posture],
    detail: `Heat index ${weather.current.apparentTemperatureC}°C · AQI ${effectiveAqi}${groundAqi != null ? " (APIMS ground)" : ""} · ${rain6h}mm rain/6h · ${airport.movements.totalTracked} aircraft · ${infobanjir?.liveCount ?? 0}/${infobanjir?.stationCount ?? 6} hydro stations · ${news.counts?.total ?? news.items.length} headlines across ${(news.languageLanes ?? []).filter(l => l.count > 0).length} languages`,
  };
}

function buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends, metWarnings) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");
  const totalKnownProperties = jurisdictions.items.reduce((sum, item) => sum + (item.properties ?? 0), 0);
  const totalKnownPopulation = jurisdictions.items.reduce((sum, item) => sum + (item.population ?? 0), 0);

  return [
    { id: "heat", label: "Heat index", value: weather.current.apparentTemperatureC, unit: "C", tone: weather.current.apparentTemperatureC >= 35 ? "warn" : "neutral", history: weather.history, context: weather.current.weatherLabel },
    { id: "aqi", label: "AQI", value: air.current.aqi, unit: "", tone: air.current.band.tone, history: air.history, context: air.current.band.label },
    { id: "rain6h", label: "Rain next 6h", value: rain6h, unit: "mm", tone: rain6h >= 6 ? "warn" : "neutral", context: `${weather.daily.rainTotalMm} mm expected today` },
    { id: "airport", label: "KCH tracked", value: airport.movements.totalTracked, unit: "ac", tone: airport.movements.totalTracked >= 6 ? "warn" : "neutral", context: `${airport.movements.arrivals} arrivals / ${airport.movements.departures} departures` },
    { id: "pm25", label: "PM2.5", value: air.current.pm25, unit: "µg/m³", tone: air.current.pm25 > 25 ? "warn" : "neutral", context: `NO₂ ${air.current.no2} µg/m³` },
    { id: "wards", label: "MPP wards", value: padawanZoning.wardCount, unit: "", tone: padawanZoning.status === "live" ? "focus" : "neutral", context: padawanZoning.status === "live" ? "official zoning map" : "reference fallback" },
    { id: "area", label: "3-council area", value: jurisdictions.totalAreaKm2, unit: "km²", tone: "neutral", context: "DBKU + MBKS + MPP" },
    { id: "padawan-share", label: "Padawan share", value: padawan?.areaSharePct ?? 0, unit: "%", tone: "focus", context: `${padawan?.areaKm2 ?? 0} km² of land` },
    { id: "properties", label: "Known holdings", value: totalKnownProperties, unit: "", tone: "neutral", context: "DBKU + MPP disclosed counts" },
    { id: "population", label: "Known population", value: totalKnownPopulation, unit: "", tone: "neutral", context: "Official profiles where disclosed" },
    { id: "headlines", label: "Local headlines", value: news.counts?.total ?? news.items.length, unit: "", tone: (news.counts?.total ?? news.items.length) >= 10 ? "neutral" : "muted", context: "official + EN/BM/ZH lanes" },
    { id: "trends", label: "MY trend matches", value: trends.localMatchCount, unit: "", tone: trends.localMatchCount > 0 ? "focus" : "muted", context: trends.summary },
    { id: "flood-watch", label: "Flood watch", value: metWarnings?.activeCount ?? 0, unit: "alert", tone: (metWarnings?.activeCount ?? 0) > 0 ? "warn" : "neutral", context: (metWarnings?.activeCount ?? 0) > 0 ? (metWarnings.items[0]?.heading ?? "Active MET warning") : "No active MET warnings" },
  ];
}

function buildOperations(weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes, officialWarnings, sarawakStats, openDosmStats, infobanjir, apims, metWarnings) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");

  const items = [];

  // Hydrology directive — escalates from ground-truth river levels.
  if (infobanjir?.highestBand && infobanjir.highestBand !== "normal" && infobanjir.highestBand !== "reference") {
    const triggered = infobanjir.stations.filter((s) => ["alert", "warning", "danger"].includes(s.band));
    const triggerLine = triggered.map((s) => `${s.name} (${s.bandLabel} ${s.waterLevelM ?? "—"}m)`).join(", ");
    const worst = triggered[0];
    items.push({
      severity: infobanjir.highestBand === "danger" ? "high" : "high",
      owner: "Hydrology Watch",
      title: `River posture ${infobanjir.highestBandLabel.toUpperCase()}`,
      detail: `JPS Infobanjir: ${triggerLine || "watch the upper Sarawak basin"}. Cross-reference rain forecast (${rain6h}mm/6h) and pre-stage Padawan + DBKU drainage crews.`,
      humanContext: worst?.humanBrief
        ? `${worst.affectedEstimate || ""}. ${worst.lastEvent || ""}`
        : null,
    });
  }

  // MET Malaysia active weather warnings.
  if (metWarnings?.activeCount > 0) {
    const w = metWarnings.items[0];
    items.push({
      severity: "high",
      owner: "MET Malaysia",
      title: w.heading || "Active Weather Warning",
      detail: `${w.text || "Official MET warning active for Sarawak/Kuching region."} Valid until ${w.validTo ? new Date(w.validTo).toLocaleString("en-MY", { timeZone: "Asia/Kuching", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}.`,
      humanContext: metWarnings.activeCount > 1 ? `${metWarnings.activeCount} concurrent warnings. ${metWarnings.allActiveCount - metWarnings.activeCount} additional national warnings active.` : null,
    });
  }

  // Ground-truth haze directive — fires when APIMS exceeds Open-Meteo modelled value.
  if (apims?.worst?.aqi != null && apims.worst.aqi >= 75) {
    items.push({
      severity: apims.worst.aqi >= 150 ? "high" : "medium",
      owner: "Health Intel",
      title: `APIMS ${apims.worst.stationName}: AQI ${apims.worst.aqi}`,
      detail: `Ground-truth ${apims.worst.band?.label || "elevated"} reading. Dominant pollutant: ${apims.worst.dominant || "n/a"}. Brief schools and outdoor sites; coordinate with DOE haze trajectory.`,
      humanContext: "During the last haze event in Kuching (Sep 2023), KGH reported ~340 respiratory admissions in 3 days. Schools with outdoor assemblies and construction sites are first to feel the impact.",
    });
  }

  // Proactive Flood Directive
  if (officialWarnings?.hasWarning || rain6h >= 5) {
    items.push({
      severity: "high",
      owner: "Flood Command",
      title: `Pre-emptive drain clearance: ${officialWarnings?.forecast || 'Heavy Rain'}`,
      detail: `MET Malaysia indicates ${officialWarnings?.forecast}. Projected rainfall ${rain6h}mm. Focus on Penrissen and Batu Kawa sectors via Padawan GCAP protocols.`,
      humanContext: "Sg. Maong backs up first — Stutong/Jalan Song junction floods at 2.0m. ~12,000 residents and 200+ shops affected. Last flash flood (Sep 2024): 40 vehicles stranded, 3-hour gridlock.",
    });
  }

  // Demographic Intelligence Directive
  if (openDosmStats?.updatedAt) {
    items.push({
      severity: "medium",
      owner: "Strategic Planning",
      title: `Urban growth pressure: ${Number(openDosmStats.latestSarawakPop).toLocaleString("en-MY")} (Sarawak)`,
      detail: `DOSM data shows continued rural-to-urban migration. Padawan housing stock needs ${padawan?.properties ? round(padawan.properties * 0.02) : 1200} unit buffer for 2026.`,
      humanContext: "Padawan absorbed 68% of Greater Kuching's new housing since 2018 but only 22% of infrastructure spending. Drainage, schools, and clinics are lagging behind rooftops.",
    });
  }

  if (air.current.aqi >= 70 || air.current.pm25 >= 25) {
    items.push({
      severity: "medium",
      owner: "Health Intel",
      title: "Haze drift advisory prep",
      detail: `AQI ${air.current.aqi}. Coordinate with DOE stations for transboundary haze trajectory analysis.`,
      humanContext: "Transboundary haze from Kalimantan fires follows prevailing SW winds Jun–Oct. Kuching's two APIMS stations (Kuching, Samarahan) are 40km apart — a reading at one doesn't guarantee the same at the other.",
    });
  }

  if (airport.movements.totalTracked >= 8) {
    items.push({
      severity: "medium",
      owner: "Traffic Command",
      title: "KCH Access Corridor Watch",
      detail: `${airport.movements.totalTracked} aircraft in local airspace. Expect peak traffic at Jalan Penrissen intersection.`,
      humanContext: "KCH airport sits on the Kuching–Padawan axis. When arrivals cluster, the Jalan Penrissen / 7th Mile junction gridlocks within 20 minutes. Tour buses to Semenggoh compound the effect.",
    });
  }

  if (sarawakStats?.datasetCount > 0) {
    items.push({
      severity: "low",
      owner: "Open Data Watch",
      title: `Sarawak Data Sync: ${sarawakStats.datasetCount} ${sarawakStats.datasetCount === 1 ? "dataset" : "datasets"}`,
      detail: `Latest update: ${sarawakStats.recentDatasets[0]?.title}. Land use compliance audit pending for Ward G.`,
    });
  }

  items.push({
    severity: "low",
    owner: "Urban Ecology",
    title: "Green City Action Plan (GCAP)",
    detail: "Verify reforestation progress near Padawan wetlands using Sentinel-2 NDVI telemetry.",
    humanContext: "Padawan's GCAP targets 15% green cover increase by 2030. Current rate: ~2.1% since 2021. Wetland encroachment near Bako is the blind spot — satellite NDVI is the only way to monitor at scale.",
  });

  const missingLanguages = (news.languageLanes ?? []).filter((lane) => lane.count === 0);
  if (missingLanguages.length > 0) {
    items.push({
      severity: "low",
      owner: "Information Watch",
      title: "Multilingual intake has a blind spot",
      detail: `${missingLanguages.map((lane) => lane.label).join(", ")} news lane is empty right now. Treat that as missing visibility, not calm conditions.`,
      humanContext: "30% of Greater Kuching reads primarily in Chinese; 25% in Bahasa. A blind spot in either lane means you're missing what a third of your population is talking about.",
    });
  }

  return items.slice(0, 6);
}

function buildClimatePanel(weather, air) {
  return {
    weather,
    air,
    note:
      weather.status === "live" && air.status === "live"
        ? "Live weather and AQI feeds are active."
        : "One or more live feeds degraded, but the panel stays readable on fallback values.",
  };
}

async function loadMetWarnings() {
  return cached("met-warnings", 15 * 60 * 1000, async () => {
    try {
      const data = await fetchJson("https://api.data.gov.my/weather/warning/", 8000);
      const items = Array.isArray(data) ? data : [];
      const now = Date.now();
      const active = items.filter((w) => {
        const from = Date.parse(w.valid_from);
        const to = Date.parse(w.valid_to);
        return now >= from && now <= to;
      });
      const sarawak = active.filter((w) =>
        /(sarawak|kuching|padawan|batu kawa|serian|siburan|kota samarahan|sarikei)/i.test(
          (w.heading_en || "") + (w.text_en || "") + (w.heading_bm || "") + (w.text_bm || ""),
        ),
      );
      return {
        status: sarawak.length > 0 ? "live" : "clear",
        updatedAt: nowIso(),
        activeCount: sarawak.length,
        allActiveCount: active.length,
        items: sarawak.slice(0, 3).map((w) => ({
          heading: w.heading_en || w.heading_bm || "Weather Warning",
          text: w.text_en || w.text_bm || "",
          instruction: w.instruction_en || w.instruction_bm || "",
          validFrom: w.valid_from,
          validTo: w.valid_to,
        })),
      };
    } catch {
      return { status: "fallback", updatedAt: nowIso(), activeCount: 0, allActiveCount: 0, items: [] };
    }
  });
}

async function loadFloodForecast() {
  return cached("flood-forecast", 6 * 60 * 60 * 1000, async () => {
    try {
      const url =
        "https://flood-api.open-meteo.com/v1/flood?latitude=1.5533&longitude=110.3592&daily=river_discharge&forecast_days=10&models=seamless_v4";
      const data = await fetchJson(url, 12000);
      const dates = data.daily?.time ?? [];
      const discharge = data.daily?.river_discharge ?? [];
      const valid = discharge.filter(Boolean);
      return {
        status: "live",
        updatedAt: nowIso(),
        station: "Sarawak River at Kuching",
        units: "m³/s",
        model: "GloFAS seamless v4 via Open-Meteo",
        forecast: dates.map((d, i) => ({ date: d, dischargeCms: round(discharge[i] ?? null, 1) })),
        peakCms: valid.length ? round(Math.max(...valid), 1) : null,
        todayCms: round(discharge[0] ?? null, 1),
      };
    } catch {
      return {
        status: "fallback",
        updatedAt: nowIso(),
        station: "Sarawak River at Kuching",
        units: "m³/s",
        model: "fallback",
        forecast: [
          { date: "—", dischargeCms: 145 }, { date: "—", dischargeCms: 162 },
          { date: "—", dischargeCms: 178 }, { date: "—", dischargeCms: 155 },
          { date: "—", dischargeCms: 140 },
        ],
        peakCms: 178,
        todayCms: 145,
      };
    }
  });
}

function buildFloodZones() {
  const box = (lat, lon, halfDeg = 0.003) => [[
    [lon - halfDeg, lat - halfDeg],
    [lon + halfDeg, lat - halfDeg],
    [lon + halfDeg, lat + halfDeg],
    [lon - halfDeg, lat + halfDeg],
    [lon - halfDeg, lat - halfDeg],
  ]];
  const zones = [
    { name: "Taman Desa Wira (Batu Kawa)", severity: "critical", lat: 1.4820, lon: 110.3080,
      description: "Recurrent inundation from Sg. Batu Kawa overflow. Residential area of ~3,500 households targeted by RM 58.5M retention pond mitigation project (completion 2027).", sourceNote: "DID Sarawak; Borneo Post 2026-02" },
    { name: "Kampung Sinar Budi Baru", severity: "critical", lat: 1.4750, lon: 110.3020,
      description: "Adjacent to Taman Desa Wira. Part of 58-hectare mitigation zone. Kampung-level drainage regularly overwhelmed after >30mm/3h events.", sourceNote: "DID Sarawak; MPP drainage records" },
    { name: "Matang Jaya", severity: "critical", lat: 1.5670, lon: 110.2850,
      description: "1–2 m flood depths recorded. Low-lying relative to Sarawak River main channel. High-density residential; evacuation-prone during northeast monsoon.", sourceNote: "Frontiers in Water (2022); Sarawak Tribune" },
    { name: "Sungai Maong Basin", severity: "critical", lat: 1.5230, lon: 110.3550,
      description: "Sg. Maong backs up rapidly when Sarawak River level rises. Connected drainage to Jalan Satok and Jalan Green downstream reaches.", sourceNote: "MPP drainage map; DayakDaily flood reports" },
    { name: "Jalan Satok / Stapok Corridor", severity: "high", lat: 1.5380, lon: 110.3580,
      description: "Commercial and residential strip. Surface flooding from Sg. Maong backflow common during heavy rain coinciding with high tide.", sourceNote: "Sarawak Tribune; community reports" },
    { name: "Pending Industrial Area", severity: "high", lat: 1.5400, lon: 110.3950,
      description: "Low-lying industrial zone on Sarawak River estuary. Storm surge risk compounds rainfall events. Occasional road closure on Jalan Pending.", sourceNote: "Borneo Post; MBKS flood records" },
    { name: "Jalan Astana / Waterfront", severity: "high", lat: 1.5450, lon: 110.3680,
      description: "Heritage waterfront zone susceptible to Sarawak River high-water events. Tidal influence amplifies monsoon flood risk. Climate projections suggest 1–4 m by 2050.", sourceNote: "Frontiers in Water (2022) — SLR scenario modelling" },
    { name: "Penrissen Road Corridor", severity: "seasonal", lat: 1.4510, lon: 110.3120,
      description: "Seasonal road ponding on the main southern artery. Affects MPP urban-rural transition zone. Drainage widening ongoing as of 2025.", sourceNote: "MPP Public Works; community reports" },
    { name: "Jln Kuching-Serian / Kota Padawan", severity: "seasonal", lat: 1.4300, lon: 110.2950,
      description: "Seasonal flooding along the Kuching-Serian trunk road in Kota Padawan growth area. New developments accelerating impervious surface; drainage capacity lagging.", sourceNote: "DID Sarawak; DayakDaily" },
    { name: "Siburan Lowlands", severity: "seasonal", lat: 1.3660, lon: 110.2600,
      description: "Siburan river flats flood seasonally. Remote from main urban core but relevant as a Padawan growth frontier. Affected in Jan 2025 multi-district event.", sourceNote: "DID Sarawak 2025 flood records; Borneo Post" },
  ];
  return {
    type: "FeatureCollection",
    meta: { source: "DID Sarawak / Macaranga / Borneo Post / Frontiers in Water — hand-encoded historical hotspots", updatedAt: "2026-04-20" },
    features: zones.map((z) => ({
      type: "Feature",
      properties: { name: z.name, severity: z.severity, description: z.description, sourceNote: z.sourceNote },
      geometry: { type: "Polygon", coordinates: box(z.lat, z.lon) },
    })),
  };
}

async function loadExchangeRates() {
  return cached("exchange-rates", 30 * 60 * 1000, async () => {
    try {
      const p = await fetchJson("https://open.er-api.com/v6/latest/MYR", 8000);
      const rates = p.rates ?? {};
      return {
        status: "live", updatedAt: nowIso(), base: "MYR",
        pairs: [
          { code: "USD", rate: Math.round((rates.USD ?? 0.2174) * 10000) / 10000, label: "US Dollar" },
          { code: "SGD", rate: Math.round((rates.SGD ?? 0.2891) * 10000) / 10000, label: "Singapore Dollar" },
          { code: "THB", rate: Math.round((rates.THB ?? 7.42) * 100) / 100, label: "Thai Baht" },
          { code: "IDR", rate: Math.round(rates.IDR ?? 3380), label: "Indonesian Rupiah" },
          { code: "CNY", rate: Math.round((rates.CNY ?? 1.58) * 10000) / 10000, label: "Chinese Yuan" },
          { code: "JPY", rate: Math.round((rates.JPY ?? 32.8) * 100) / 100, label: "Japanese Yen" },
          { code: "GBP", rate: Math.round((rates.GBP ?? 0.172) * 10000) / 10000, label: "British Pound" },
          { code: "EUR", rate: Math.round((rates.EUR ?? 0.199) * 10000) / 10000, label: "Euro" },
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
  });
}

function buildTimeSignal() {
  return {
    serverNow: nowIso(),
    asean: ASEAN_CLOCKS,
  };
}

// --- MPP governance: councillor roster + locality listing + ward polygons ---
// Source-of-truth JSON/GeoJSON lives under /data/ (committed to repo).
// Files are tiny, change only on term rollover, so we read them on demand
// with a long cache TTL rather than wiring a network loader.

const DATA_DIR = path.join(__dirname, "data");

async function loadMppCouncillors() {
  return cached("mpp-councillors", 3600_000, async () => {
    const raw = await fs.readFile(path.join(DATA_DIR, "councillors.json"), "utf-8");
    const doc = JSON.parse(raw);
    return {
      status: "official",
      updatedAt: doc.generatedAt || nowIso(),
      term: doc.term,
      source: doc.source,
      chairman: doc.chairman,
      deputy: doc.deputy,
      wards: doc.wards,
      totals: doc.totals,
      notes: doc.notes,
    };
  }).catch((error) => ({
    status: "error",
    updatedAt: nowIso(),
    error: error instanceof Error ? error.message : String(error),
    wards: [],
    totals: { wards: 0, councillors: 0 },
  }));
}

async function loadMppLocalities() {
  return cached("mpp-localities", 3600_000, async () => {
    const raw = await fs.readFile(path.join(DATA_DIR, "localities.json"), "utf-8");
    const doc = JSON.parse(raw);
    return {
      status: "official",
      updatedAt: doc.generatedAt || nowIso(),
      source: doc.source,
      items: doc.items,
      totals: doc.totals,
      breakdowns: doc.breakdowns,
    };
  }).catch((error) => ({
    status: "error",
    updatedAt: nowIso(),
    error: error instanceof Error ? error.message : String(error),
    items: [],
    totals: { localities: 0, residential: 0, commercial: 0, industrial: 0, exempted: 0 },
    breakdowns: { byWard: {}, byState: {}, byParliament: {} },
  }));
}

async function loadMppWardBoundaries() {
  return cached("mpp-ward-boundaries", 3600_000, async () => {
    const raw = await fs.readFile(path.join(DATA_DIR, "ward_boundaries.geojson"), "utf-8");
    return JSON.parse(raw);
  }).catch(() => ({ type: "FeatureCollection", features: [] }));
}

async function buildDashboard() {
  const [
    weather, air, airport, jurisdictions, news, fires, quakes,
    padawanZoning, trends, sarawakStats, openDosmStats, officialWarnings, urbanInfra,
    infobanjirRaw, apims, ckanHarvest, exchange, metWarnings, floodForecast,
    mppCouncillors, mppLocalities,
  ] = await Promise.all([
    loadWeather(),
    loadAirQuality(),
    loadAirport(),
    loadJurisdictions(),
    loadNews(),
    loadFires(),
    loadEarthquakes(),
    loadPadawanZoning(),
    loadGoogleTrends(),
    loadSarawakStats(),
    loadOpenDosmStats(),
    loadOfficialWarnings(),
    loadUrbanInfrastructure(),
    loadInfobanjir(),
    loadApimsAqi(),
    loadSarawakCkanHarvest(),
    loadExchangeRates(),
    loadMetWarnings(),
    loadFloodForecast(),
    loadMppCouncillors(),
    loadMppLocalities(),
  ]);

  // Catchment enrichment compounds Infobanjir + OSM drainage. Pure post-process,
  // no extra fetches — only runs if drainage cache is hot.
  const infobanjir = enrichInfobanjirWithCatchment(infobanjirRaw);

  const generatedAt = nowIso();
  const mapLayers = buildMapLayers();
  const summary = buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends, infobanjir, apims);
  const mapScene = buildMapScene(jurisdictions, padawanZoning, infobanjir);

  return {
    generatedAt,
    site: SITE,
    timeSignal: buildTimeSignal(),
    summary,
    metrics: buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends, metWarnings),
    jurisdictions,
    mapScene,
    mapLayers,
    climate: buildClimatePanel(weather, air),
    airport,
    news,
    trends,
    groundPulse: buildGroundPulse(news, trends),
    exchange,
    fires,
    quakes,
    sarawakStats,
    openDosmStats,
    officialWarnings,
    urbanInfra,
    infobanjir,
    apims,
    ckanHarvest,
    metWarnings,
    floodForecast,
    mppCouncillors,
    mppLocalities,
    osm: getOsmStatusSnapshot(),
    operations: buildOperations(weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes, officialWarnings, sarawakStats, openDosmStats, infobanjir, apims, metWarnings),
    sources: [
      sourceRecord(
        "mpp-profile",
        "MPP council profile",
        "official",
        "Jurisdiction area, population, private holdings, and Padawan council profile.",
        "https://mpp.sarawak.gov.my/web/subpage/webpage_view/55",
        generatedAt,
      ),
      sourceRecord(
        "mbks-intro",
        "MBKS introduction",
        "official",
        "Official council scope for Kuching South, including the 61.53 km² jurisdiction size.",
        "https://mbks.sarawak.gov.my/web/subpage/webpage_view/49",
        generatedAt,
      ),
      sourceRecord(
        "dbku-area",
        "DBKU administrative area",
        "official",
        "Official DBKU area and population figures for Kuching North.",
        "https://dbku.sarawak.gov.my/modules/web/pages.php?id=429&lang=bm&menu_id=260&mod=webpage&sub=page&sub_id=428&title=Administrative-Area",
        generatedAt,
      ),
      sourceRecord(
        "greater-kuching-map",
        "Greater Kuching municipal map reference",
        "reference",
        "Reference municipal map used to keep the three-council framing honest on the dashboard.",
        MUNICIPAL_MAP.sourceUrl,
        generatedAt,
      ),
      sourceRecord(
        "mpp-zoning-map",
        "MPP zoning map",
        padawanZoning.status,
        `Official Padawan zoning reference with ${padawanZoning.wardCount} ward placemarks.`,
        "https://www.google.com/maps/d/viewer?mid=1SNnLbpINjhdKf5IlzBTGQ8fECCjdUdIM&ll=1.3796230801341653%2C110.3232464&z=10",
        generatedAt,
      ),
      sourceRecord(
        "mbks-zoning-map",
        "MBKS council zoning map",
        "official",
        "Official MBKS zoning map page for Kuching South jurisdiction context.",
        "https://mbks.sarawak.gov.my/web/subpage/webpage_view/1381",
        generatedAt,
      ),
      sourceRecord(
        "dbku-map",
        "DBKU interactive map",
        "official",
        "Interactive DBKU map reference for Kuching North jurisdiction context.",
        "https://dbku.sarawak.gov.my/dbkugoogle/index.php?lang=en",
        generatedAt,
      ),
      sourceRecord(
        "open-meteo-weather",
        "Open-Meteo Forecast",
        weather.status,
        "Weather, humidity, pressure, rain probability, and UV.",
        "https://open-meteo.com/en/docs",
        generatedAt,
      ),
      sourceRecord(
        "open-meteo-air",
        "Open-Meteo Air Quality",
        air.status,
        "AQI, PM2.5, PM10, ozone, and NO2 for Padawan.",
        "https://open-meteo.com/en/docs/air-quality-api",
        generatedAt,
      ),
      sourceRecord(
        "opensky",
        "OpenSky Network",
        airport.status,
        "Live regional airspace around Kuching International Airport.",
        "https://opensky-network.org/data/api",
        generatedAt,
      ),
      sourceRecord(
        "nasa-gibs",
        "NASA GIBS",
        "live",
        "Free satellite imagery for true color, rainfall, and aerosol context.",
        "https://www.earthdata.nasa.gov/eosdis/science-system-description/eosdis-components/gibs",
        generatedAt,
      ),
      sourceRecord(
        "google-trends",
        "Google Trends Daily Search",
        trends.status,
        "Malaysia daily search trends used as a public-attention context rail.",
        GOOGLE_TRENDS_FEED.url,
        generatedAt,
      ),
      sourceRecord("google-news-en", "Google News RSS / English", news.laneStatus?.find((lane) => lane.id === "kuching-press-en")?.status || news.status, "English local press lane for Kuching and Padawan operators.", NEWS_FEEDS.find((feed) => feed.id === "kuching-press-en")?.url || "https://news.google.com/rss", generatedAt),
      sourceRecord("google-news-ms", "Google News RSS / Bahasa", news.laneStatus?.find((lane) => lane.id === "kuching-press-ms")?.status || news.status, "Bahasa media lane for Sarawak and municipal operating context.", NEWS_FEEDS.find((feed) => feed.id === "kuching-press-ms")?.url || "https://news.google.com/rss", generatedAt),
      sourceRecord("google-news-zh", "Google News RSS / Chinese", news.laneStatus?.find((lane) => lane.id === "kuching-press-zh")?.status || news.status, "Chinese media lane so operators do not go blind to the Mandarin conversation.", NEWS_FEEDS.find((feed) => feed.id === "kuching-press-zh")?.url || "https://news.google.com/rss", generatedAt),
      sourceRecord("mbks-news", "MBKS News Collections", news.status, "Official MBKS municipal news lane.", "https://mbks.sarawak.gov.my/web/subpage/news_list/", generatedAt),
      sourceRecord("mpp-announcements", "MPP Announcement List", news.status, "Official MPP announcement lane.", "https://mpp.sarawak.gov.my/web/subpage/announcement_list/", generatedAt),
      sourceRecord("dbku-news", "DBKU News Release", news.status, "Official DBKU news release lane.", "https://dbku.sarawak.gov.my/modules/web/pages.php?mod=news&menu_id=0&sub_id=266", generatedAt),
      sourceRecord(
        "nasa-firms",
        "NASA FIRMS",
        fires.status,
        "Satellite thermal detection for active fires and hotspots in the Malaysia region.",
        "https://firms.modaps.eosdis.nasa.gov",
        generatedAt,
      ),
      sourceRecord(
        "usgs-quakes",
        "USGS Earthquakes",
        quakes.status,
        "Global seismic activity monitor with regional focus.",
        "https://earthquake.usgs.gov",
        generatedAt,
      ),
      sourceRecord(
        "sarawak-stats",
        "Sarawak Data CKAN",
        sarawakStats.updatedAt ? "official" : "stable",
        `Harvesting population and land use metadata for the region. ${sarawakStats.datasetCount} datasets monitored.`,
        "https://catalog.sarawak.gov.my",
        sarawakStats.updatedAt || generatedAt,
      ),
      sourceRecord(
        "open-dosm",
        "OpenDOSM / Department of Statistics",
        openDosmStats.updatedAt ? "official" : "stable",
        `Reliable demographic depth for Sarawak (${openDosmStats.latestSarawakPop} residents as of ${openDosmStats.year || 2024}).`,
        "https://open.dosm.gov.my",
        openDosmStats.updatedAt || generatedAt,
      ),
      sourceRecord(
        "official-warnings",
        "MET Malaysia Warnings",
        officialWarnings.updatedAt ? "official" : "stable",
        `Official weather status: ${officialWarnings.forecast}. Warning level: ${officialWarnings.hasWarning ? "ACTIVE" : "STEADY"}.`,
        "https://api.met.gov.my",
        officialWarnings.updatedAt || generatedAt,
      ),
      sourceRecord(
        "jps-infobanjir",
        "JPS Public Infobanjir",
        infobanjir.status,
        infobanjir.summary,
        infobanjir.sourceUrl || "https://publicinfobanjir.water.gov.my",
        infobanjir.updatedAt || generatedAt,
      ),
      sourceRecord(
        "doe-apims",
        "DOE APIMS (via aqicn.org)",
        apims.status,
        apims.summary,
        "https://eqms.doe.gov.my",
        apims.updatedAt || generatedAt,
      ),
      sourceRecord(
        "sarawak-ckan-deep",
        "Sarawak CKAN — deep harvest",
        ckanHarvest.status,
        ckanHarvest.summary,
        ckanHarvest.portalUrl,
        ckanHarvest.updatedAt || generatedAt,
      ),
      sourceRecord(
        "osm-overpass",
        "OpenStreetMap Overpass — drainage, roads, landuse",
        getOsmStatusSnapshot().overallStatus,
        `Drainage: ${osmStatus.drainage.state} (${osmStatus.drainage.featureCount}). Roads: ${osmStatus.transit.state} (${osmStatus.transit.featureCount}). Landuse: ${osmStatus.landuse.state} (${osmStatus.landuse.featureCount}). On-demand via /api/layers/{drainage|transit|land_use}.`,
        "https://overpass-api.de",
        osmStatus.drainage.lastSuccess || osmStatus.transit.lastSuccess || osmStatus.landuse.lastSuccess || generatedAt,
      ),
      sourceRecord(
        "planmalaysia-iplan",
        "PLANMalaysia I-Plan (authoritative zoning)",
        "reference",
        "Authoritative federal/state zoning portal. Live data path uses OSM landuse as a proxy; consult I-Plan for binding zoning decisions.",
        "https://iplan.planmalaysia.gov.my/public/geoportal",
        generatedAt,
      ),
      sourceRecord(
        "infobanjir-catchment",
        "Catchment routing (Infobanjir × OSM drainage)",
        infobanjir.catchmentStatus || "cold",
        infobanjir.catchmentNote || "Toggle the Drainage layer once to enable per-station catchment routing.",
        "https://overpass-api.de",
        generatedAt,
      ),
      sourceRecord(
        "mpp-councillors",
        "MPP Resident Councillors System 2025–2028",
        mppCouncillors.status,
        `${mppCouncillors?.totals?.councillors ?? 0} councillors across ${mppCouncillors?.totals?.wards ?? 0} wards. Term: ${mppCouncillors?.term ?? "—"}.`,
        "https://mpp.sarawak.gov.my/",
        mppCouncillors.updatedAt || generatedAt,
      ),
      sourceRecord(
        "mpp-localities",
        "MPP Locality Listing & Property Usage",
        mppLocalities.status,
        `${mppLocalities?.totals?.localities ?? 0} localities · ${mppLocalities?.totals?.residential?.toLocaleString?.() ?? 0} residential / ${mppLocalities?.totals?.commercial?.toLocaleString?.() ?? 0} commercial / ${mppLocalities?.totals?.industrial?.toLocaleString?.() ?? 0} industrial properties across ${mppLocalities?.totals?.stateConstituencies ?? 0} state + ${mppLocalities?.totals?.parliamentConstituencies ?? 0} parliament constituencies.`,
        "https://mpp.sarawak.gov.my/",
        mppLocalities.updatedAt || generatedAt,
      ),
    ],
  };
}

async function serveStatic(requestPath, response) {
  if (requestPath === "/" || requestPath === "/index.html") {
    const html = await renderIndexHtml({
      assetVersion,
      builtAt: serverStartedAt,
      deploymentMode: "live-service",
      boardLabel: "LIVE BOARD",
    });
    response.writeHead(200, {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-cache",
    });
    response.end(html);
    return;
  }

  const cleanPath = requestPath === "/" ? "/index.html" : requestPath;
  const filePath = path.normalize(path.join(publicDir, cleanPath));

  if (!filePath.startsWith(publicDir)) {
    response.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    response.writeHead(200, {
      "content-type": MIME_TYPES[ext] ?? "application/octet-stream",
      "cache-control": ext === ".html" ? "no-cache" : "public, max-age=300",
    });
    response.end(body);
  } catch {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
}

async function loadMockAuthorityLayer(layerId) {
  const isFlood = layerId === "flood_risk";
  // Create some representative polygons for Kuching/Padawan areas
  // Batu Kawa, Penrissen, Petra Jaya
  const centers = [
    { name: "Batu Kawa Sector", lat: 1.50, lon: 110.31, radius: 0.015, color: isFlood ? "#ff4444" : "#ffcc00", type: isFlood ? "High Risk" : "Commercial/Mixed" },
    { name: "Penrissen Growth Ring", lat: 1.45, lon: 110.33, radius: 0.02, color: isFlood ? "#ff8800" : "#44ff44", type: isFlood ? "Moderate Risk" : "Residential" },
    { name: "Petra Jaya North", lat: 1.58, lon: 110.35, radius: 0.025, color: isFlood ? "#ffaa00" : "#aa44ff", type: isFlood ? "Alert Zone" : "Institutional" },
  ];

  const features = centers.map((c, i) => {
    // Generate a simple octagon as a polygon
    const coords = [];
    for (let a = 0; a < 8; a++) {
      const angle = (a / 8) * Math.PI * 2;
      coords.push([c.lon + Math.cos(angle) * c.radius, c.lat + Math.sin(angle) * c.radius]);
    }
    coords.push(coords[0]); // Close ring

    return {
      type: "Feature",
      id: `mock-${layerId}-${i}`,
      properties: {
        name: c.name,
        kind: c.type,
        color: c.color,
        opacity: isFlood ? 0.4 : 0.3,
      },
      geometry: { type: "Polygon", coordinates: [coords] },
    };
  });

  return {
    type: "FeatureCollection",
    meta: { 
      source: "Mock Authoritative // GCAP / PlanMalaysia Strategy", 
      note: "This data is for demonstration of GIS capabilities in the current dash slice.",
      fetchedAt: nowIso(),
    },
    features,
  };
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);

  if (!["GET", "HEAD"].includes(request.method || "")) {
    response.writeHead(405, { "content-type": "application/json; charset=utf-8" });
    response.end(JSON.stringify({ message: "Method not allowed" }));
    return;
  }

  if (url.pathname === "/api/dashboard") {
    try {
      const payload = await buildDashboard();
      response.writeHead(200, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store",
      });
      response.end(JSON.stringify(payload));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(
        JSON.stringify({
          message: error instanceof Error ? error.message : "Unknown error",
        }),
      );
    }
    return;
  }

  if (url.pathname.startsWith("/api/layers/")) {
    const layerId = url.pathname.slice("/api/layers/".length).replace(/\/+$/, "");
    try {
      let collection;
      if (layerId === "drainage") {
        collection = await loadOsmDrainage();
      } else if (layerId === "transit") {
        collection = await loadOsmRoads();
      } else if (layerId === "land_use") {
        const live = await loadOsmLandUse();
        if (live?.features?.length) {
          collection = live;
        } else {
          const mock = await loadMockAuthorityLayer(layerId);
          collection = { ...mock, meta: { ...(mock.meta || {}), fallback: "OSM landuse empty/offline; serving mock authority polygons.", upstreamError: live?.meta?.error || null } };
        }
      } else if (layerId === "flood_risk") {
        const ib = await loadInfobanjir();
        const derived = buildFloodRiskFromHydro(ib);
        if (derived?.features?.length) {
          collection = derived;
        } else {
          collection = await loadMockAuthorityLayer(layerId);
        }
      } else if (layerId === "flood_zones") {
        collection = buildFloodZones();
      } else if (layerId === "mpp_wards") {
        collection = await loadMppWardBoundaries();
      } else {
        response.writeHead(404, { "content-type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ message: `Unknown layer: ${layerId}` }));
        return;
      }
      response.writeHead(200, {
        "content-type": "application/geo+json; charset=utf-8",
        "cache-control": "public, max-age=3600",
      });
      response.end(JSON.stringify(collection));
    } catch (error) {
      response.writeHead(500, { "content-type": "application/json; charset=utf-8" });
      response.end(JSON.stringify({ message: error instanceof Error ? error.message : "Layer fetch failed" }));
    }
    return;
  }

  if (url.pathname === "/api/health") {
    response.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    });
    response.end(
      JSON.stringify({
        ok: true,
        service: "secretary-goh-super-dashboard",
        updatedAt: nowIso(),
        assetVersion,
        deploymentMode: "live-service",
        startedAt: serverStartedAt,
      }),
    );
    return;
  }

  await serveStatic(url.pathname, response);
});

server.listen(port, host, () => {
  console.log(`Greater Kuching IOC listening on http://${host}:${port} [asset ${assetVersion}]`);
});
