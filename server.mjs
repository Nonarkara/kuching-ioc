import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { renderIndexHtml, resolveAssetVersion } from "./site-build.mjs";
import { normalizeMetWeather } from "./public/met-weather.js";
import { classifyRainRegime, summariseOpenMeteo, RAIN_REGIME_OPEN_METEO_URL } from "./public/rain-regime.js";
import { summariseTide, TIDE_URL } from "./public/tide.js";
import { anchorHourIndex } from "./public/open-meteo-anchor.js";

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
      // Public landing page only. The MAP_KEY stays in FIRMS_MAP_KEY and is
      // never written into a payload or a baked snapshot.
      url: "https://firms.modaps.eosdis.nasa.gov/",
      label: "NASA FIRMS / VIIRS Fire Detection",
    },
    quarks: {
      url: "https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson&starttime=",
      label: "USGS Earthquake Monitor",
    },
  },
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
    mapReferenceLabel: "MPP council profile",
    mapReferenceUrl: "https://mpp.sarawak.gov.my/web/subpage/webpage_view/55",
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
  {
    // TVS (TV Sarawak) direct WordPress feed — Sarawak's own broadcaster, real
    // headlines in BM and ZH. CloudFront 403s non-browser user agents, so this
    // feed carries a browser UA. No fixed language: detectNewsLanguage classifies
    // each headline, so the intake grid stays honest about BM vs ZH counts.
    id: "tvs-sarawak",
    label: "TVS Sarawak",
    tier: "official",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    url: "https://www.tvsarawak.my/feed/",
  },
  {
    // TVS English desk — category feed, all English.
    id: "tvs-english",
    label: "TVS English",
    language: "en",
    languageLabel: "English",
    tier: "official",
    ua: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36",
    url: "https://www.tvsarawak.my/category/english/feed/",
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
  // A transient failure must not stick for the full TTL (e.g. GloFAS held a
  // fallback for 6 h). Degraded results get a short TTL so the next request
  // or build retries the source.
  const failed = value && typeof value === "object" && !Array.isArray(value)
    && ["fallback", "unavailable", "offline", "error"].includes(value.status);
  cache.set(key, { value, expiresAt: Date.now() + (failed ? Math.min(ttlMs, FAILED_TTL_MS) : ttlMs) });
  return value;
}
const FAILED_TTL_MS = 2 * 60 * 1000;

// Some government hosts (iHYDRO, JKM) reject non-browser user agents.
const BROWSER_UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36";

async function fetchText(url, timeoutMs = 10000, ua) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        "user-agent": ua || "secretary-goh-super-dashboard/1.0",
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

async function fetchJson(url, timeoutMs = 10000, ua) {
  const text = await fetchText(url, timeoutMs, ua);
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
  // CloudFront-fronted feeds (TVS Sarawak) 403 non-browser UAs. Honor any
  // browser UA the feed declares rather than always using the default.
  const xml = await fetchText(feed.url, 12000, feed.ua);
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

// MPP service ledger — the council's own published performance and service
// lists (client charter, active tenders, food grading, refuse zones, parks,
// night markets). All are plain HTML tables on mpp.sarawak.gov.my. Tender titles
// are published as images only, so we report counts and dates, never titles.
const MPP_BASE = "https://mpp.sarawak.gov.my";
const MPP_PAGES = { charter: 266, tenders: 265, food: 226, refuse: 245, parks: 251, markets: 161 };

function htmlTableRows(html) {
  return Array.from(html.matchAll(/<tr[\s\S]*?<\/tr>/gi), (row) =>
    Array.from(row[0].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi), (c) => stripTags(c[1])),
  ).filter((cells) => cells.some(Boolean));
}

const pctOf = (cell) => { const m = /(\d+(?:\.\d+)?)\s*%/.exec(cell || ""); return m ? Number(m[1]) : null; };

function parseMppCharter(html) {
  const rows = htmlTableRows(html);
  const header = rows.find((r) => r.some((c) => /Jan-Mar/i.test(c)));
  const quarterLabels = header ? header.slice(-4) : ["Q1", "Q2", "Q3", "Q4"];
  const totalRow = rows.find((r) => /Total Score/i.test(r[0]));
  const quarters = quarterLabels.map((label, i) => ({ label, score: totalRow ? pctOf(totalRow[1 + i]) : null }));
  const latestIdx = quarters.map((q) => q.score != null).lastIndexOf(true);
  const pledges = rows
    .filter((r) => /^\d+$/.test(r[0]) && r.length >= 3)
    .map((r) => ({ no: Number(r[0]), pledge: r[1], scores: r.slice(2, 6).map(pctOf) }));
  const weakest = latestIdx < 0 ? [] : pledges
    .filter((p) => p.scores[latestIdx] != null && p.scores[latestIdx] < 95)
    .sort((a, b) => a.scores[latestIdx] - b.scores[latestIdx])
    .slice(0, 3)
    .map((p) => ({ no: p.no, pledge: p.pledge, score: p.scores[latestIdx] }));
  const updated = /Updated on\s*([\d.]+)/i.exec(stripTags(html))?.[1] || null;
  return { quarters, latestQuarter: quarters[latestIdx]?.label || null, pledgeCount: pledges.length, weakest, updated };
}

function parseMppTenders(html) {
  const items = htmlTableRows(html)
    .filter((r) => /^\d+$/.test(r[0]) && /\d{2}\.\d{2}\.\d{4}/.test(r[2] || ""))
    .map((r) => ({ published: r[1], closes: r[2] }));
  const iso = (d) => d.split(".").reverse().join("-");
  const nextClosing = items.map((i) => i.closes).sort((a, b) => iso(a).localeCompare(iso(b)))[0] || null;
  return { active: items.length, nextClosing, items };
}

function parseMppFoodGrading(html) {
  const rows = htmlTableRows(html).filter((r) => /^\d+$/.test(r[0]) && r.length >= 8);
  const dates = rows.map((r) => r[7]).filter((d) => /\d{2}\/\d{2}\/\d{4}/.test(d));
  const iso = (d) => d.split("/").reverse().join("-");
  return {
    premises: rows.length,
    gradeA: rows.filter((r) => /^A$/i.test(r[5])).length,
    latestInspection: dates.sort((a, b) => iso(b).localeCompare(iso(a)))[0] || null,
  };
}

function parseMppRefuseZones(html) {
  const text = stripTags(html);
  const zones = new Set(Array.from(text.matchAll(/\bPH[HC]\s?(?:\d+[A-Z]?|RED)\b|\bPSC\s?\d+\b/g), (m) => m[0].replace(/\s/g, "")));
  const year = /Refuse Collection Schedule[^<]*?(\d{4})/i.exec(html)?.[1] || null;
  return { zones: zones.size, year };
}

function parseMppParks(html) {
  const rows = htmlTableRows(html).filter((r) => /^\d+$/.test(r[0]) && r.length >= 7);
  return { count: rows.length, areaSqm: rows.reduce((s, r) => s + (Number(r[6].replace(/[^\d.]/g, "")) || 0), 0) };
}

function parseMppNightMarkets(html) {
  return Array.from(
    html.matchAll(/class="market-title"[^>]*>([\s\S]*?)<\/div>[\s\S]*?class="market-info"[^>]*>([\s\S]*?)<\/div>/gi),
    (m) => {
      const info = stripTags(m[2]);
      return {
        name: stripTags(m[1]),
        hours: /Operating Hour(?:\/Day)?:\s*(.+?)\s*Operated by/i.exec(info)?.[1] || null,
        operator: /Operated by:\s*(.+?)\s*Contact/i.exec(info)?.[1] || null,
      };
    },
  );
}

async function loadMppServiceLedger() {
  return cached("mpp-service-ledger", 6 * 60 * 60 * 1000, async () => {
    // Charter and tender pages are re-issued yearly under new ids; find the
    // newest from the home-page menu, fall back to the 2026 ids.
    const pages = { ...MPP_PAGES };
    try {
      const home = await fetchText(`${MPP_BASE}/`, 12000);
      const newest = (re) => Array.from(home.matchAll(re), (m) => ({ id: Number(m[1]), year: Number(m[2]) }))
        .sort((a, b) => b.year - a.year)[0]?.id;
      pages.charter = newest(/webpage_view\/(\d+)"[^>]*>\s*CLIENT CHARTER ACHIEVEMENT (\d{4})/gi) || pages.charter;
      pages.tenders = newest(/webpage_view\/(\d+)"[^>]*>[\s\S]{0,200}?Tender \/ Quotation (\d{4})/gi) || pages.tenders;
    } catch { /* keep defaults */ }

    const url = (key) => `${MPP_BASE}/web/subpage/webpage_view/${pages[key]}`;
    const parsers = { charter: parseMppCharter, tenders: parseMppTenders, food: parseMppFoodGrading, refuse: parseMppRefuseZones, parks: parseMppParks, markets: parseMppNightMarkets };
    const keys = Object.keys(parsers);
    const results = await Promise.allSettled(keys.map((k) => fetchText(url(k), 15000).then(parsers[k])));
    const ledger = { status: "live", updatedAt: nowIso(), source: "mpp.sarawak.gov.my" };
    keys.forEach((k, i) => {
      const r = results[i];
      ledger[k] = r.status === "fulfilled" ? { ...(Array.isArray(r.value) ? { items: r.value } : r.value), url: url(k) } : { status: "unavailable", url: url(k) };
    });
    if (keys.every((k) => ledger[k].status === "unavailable")) ledger.status = "unavailable";
    return ledger;
  }).catch(() => ({ status: "unavailable", updatedAt: nowIso(), source: "mpp.sarawak.gov.my" }));
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
  // Esri / OSM — no API key. CartoCDN now watermarks "API KEY REQUIRED",
  // which hid the city under a wall of legal text (unusable for humans).
  return [
    {
      id: "dark",
      label: "Dark",
      type: "tile",
      kind: "reference",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 16,
      active: false,
    },
    {
      id: "light",
      label: "Light",
      type: "tile",
      kind: "reference",
      url: "https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}",
      attribution: "Tiles &copy; Esri",
      maxZoom: 16,
      active: false,
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
      active: true,
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
  // NOTE: do NOT set forecast_hours here. It truncates hourly to only the next
  // N hours and drops past_days, so the array no longer contains the current
  // hour — which both emptied nextHours (rain6h read a false 0mm) and made the
  // anchored past-24h window impossible to slice. past_days=1 + forecast_days=2
  // yields 72 hourly points spanning yesterday 00:00 → day-after 23:00, which
  // is exactly what the nowIdx-anchored windows below need.
  url.searchParams.set("past_days", "1");
  url.searchParams.set("forecast_days", "2");
  url.searchParams.set("timezone", "auto");

  try {
    const payload = await fetchJson(url.toString());
    const current = payload.current ?? {};
    const hourly = payload.hourly ?? {};
    const daily = payload.daily ?? {};

    // Audit #11: schema validation. A syntactically valid but incomplete
    // payload must not become an apparently favourable "live" snapshot. Every
    // field the return reads must be present and finite; windows are anchored
    // to current.time so "next 6h" and "past 24h" are real clock hours —
    // fixed array offsets silently went empty when upstream truncated hourly
    // to 12 points, and the board then reported 0mm as a fact.
    const missing = [];
    const need = (ok, name) => { if (!ok) missing.push(name); };
    need(Number.isFinite(current.temperature_2m), "current.temperature_2m");
    need(Number.isFinite(current.apparent_temperature), "current.apparent_temperature");
    need(Number.isFinite(current.relative_humidity_2m), "current.relative_humidity_2m");
    need(Number.isFinite(current.wind_speed_10m), "current.wind_speed_10m");
    need(Number.isFinite(current.precipitation), "current.precipitation");
    need(Number.isFinite(current.cloud_cover), "current.cloud_cover");
    need(Number.isFinite(current.weather_code), "current.weather_code");
    need(Number.isFinite(current.pressure_msl), "current.pressure_msl");
    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const nowIdx = anchorHourIndex(times, current.time);
    need(nowIdx >= 24, "hourly.time[now-24]");
    const nextWin = (a) => Array.isArray(a) && a.slice(nowIdx, nowIdx + 6).every(Number.isFinite);
    const pastWin = (a) => Array.isArray(a) && a.slice(nowIdx - 24, nowIdx).every(Number.isFinite);
    need(nowIdx + 6 <= times.length, "hourly.time[now+6]");
    need(nextWin(hourly.temperature_2m), "hourly.temperature_2m[now+6]");
    need(nextWin(hourly.precipitation), "hourly.precipitation[now+6]");
    need(nextWin(hourly.precipitation_probability), "hourly.precipitation_probability[now+6]");
    need(pastWin(hourly.temperature_2m), "hourly.temperature_2m[past24]");
    const days = Array.isArray(daily.time) ? daily.time : [];
    const dIdx = typeof current.time === "string" ? days.indexOf(current.time.slice(0, 10)) : -1;
    need(dIdx >= 0, "daily.time[today]");
    const dOk = (a) => Array.isArray(a) && Number.isFinite(a[dIdx]);
    need(dOk(daily.temperature_2m_max), "daily.temperature_2m_max[today]");
    need(dOk(daily.temperature_2m_min), "daily.temperature_2m_min[today]");
    need(dOk(daily.precipitation_sum), "daily.precipitation_sum[today]");
    need(dOk(daily.uv_index_max), "daily.uv_index_max[today]");
    need(Array.isArray(daily.sunrise) && typeof daily.sunrise[dIdx] === "string", "daily.sunrise[today]");
    need(Array.isArray(daily.sunset) && typeof daily.sunset[dIdx] === "string", "daily.sunset[today]");
    if (missing.length > 0) {
      const fb = buildWeatherFallback();
      return { ...fb, status: "degraded", degradedFields: missing };
    }

    // True trailing 24 hours of observed hourly temperatures (for the sparkline).
    const history = hourly.temperature_2m.slice(nowIdx - 24, nowIdx);
    const nextHours = times.slice(nowIdx, nowIdx + 6).map((time, i) => ({
      time: String(time).slice(11, 16),
      precipitationMm: round(hourly.precipitation[nowIdx + i], 1),
      rainChance: Math.round(hourly.precipitation_probability[nowIdx + i]),
      temperatureC: round(hourly.temperature_2m[nowIdx + i], 1),
    }));

    return {
      status: "live",
      updatedAt: nowIso(),
      current: {
        temperatureC: round(current.temperature_2m, 1),
        apparentTemperatureC: round(current.apparent_temperature, 1),
        humidity: Math.round(current.relative_humidity_2m),
        windKph: round(current.wind_speed_10m, 1),
        precipitationMm: round(current.precipitation, 1),
        cloudCover: Math.round(current.cloud_cover),
        weatherLabel: weatherCodeLabel(Number(current.weather_code)),
        pressureHpa: round(current.pressure_msl, 1),
      },
      nextHours,
      daily: {
        maxC: round(daily.temperature_2m_max[dIdx], 1),
        minC: round(daily.temperature_2m_min[dIdx], 1),
        rainTotalMm: round(daily.precipitation_sum[dIdx], 1),
        uvIndexMax: round(daily.uv_index_max[dIdx], 1),
        sunrise: String(daily.sunrise[dIdx]).slice(11, 16),
        sunset: String(daily.sunset[dIdx]).slice(11, 16),
      },
      history,
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
  // NOTE: do NOT set forecast_hours — it drops past_days, emptying the
  // anchored past-24h window (and previously left nextHours permanently []).
  url.searchParams.set("past_days", "1");
  url.searchParams.set("timezone", "auto");

  try {
    const payload = await fetchJson(url.toString());
    const current = payload.current ?? {};
    const hourly = payload.hourly ?? {};

    // Audit #11: schema validation. Refuse to label the snapshot "live" if
    // any required reading is missing or non-finite — fall back to the
    // labelled stub with the failing field list so the operator sees that
    // a quiet AQI is not a real measurement. Every field the return reads
    // is checked; optional-looking pollutants were requested in the URL, so
    // a missing one means the upstream response is incomplete, not "clean".
    // Windows are anchored to current.time, mirroring loadWeather.
    const missing = [];
    const need = (ok, name) => { if (!ok) missing.push(name); };
    need(Number.isFinite(current.us_aqi), "current.us_aqi");
    need(Number.isFinite(current.pm2_5), "current.pm2_5");
    need(Number.isFinite(current.pm10), "current.pm10");
    need(Number.isFinite(current.ozone), "current.ozone");
    need(Number.isFinite(current.nitrogen_dioxide), "current.nitrogen_dioxide");
    const times = Array.isArray(hourly.time) ? hourly.time : [];
    const nowIdx = anchorHourIndex(times, current.time);
    need(nowIdx >= 24, "hourly.time[now-24]");
    need(nowIdx + 6 <= times.length, "hourly.time[now+6]");
    const nextWin = (a) => Array.isArray(a) && a.slice(nowIdx, nowIdx + 6).every(Number.isFinite);
    const pastWin = (a) => Array.isArray(a) && a.slice(nowIdx - 24, nowIdx).every(Number.isFinite);
    need(nextWin(hourly.us_aqi), "hourly.us_aqi[now+6]");
    need(nextWin(hourly.pm2_5), "hourly.pm2_5[now+6]");
    need(pastWin(hourly.us_aqi), "hourly.us_aqi[past24]");
    if (missing.length > 0) {
      const fb = buildAirFallback();
      return { ...fb, status: "degraded", degradedFields: missing };
    }

    const aqi = Math.round(current.us_aqi);
    const history = hourly.us_aqi.slice(nowIdx - 24, nowIdx).map((v) => Math.round(v));
    const nextHours = times.slice(nowIdx, nowIdx + 6).map((time, i) => ({
      time: String(time).slice(11, 16),
      aqi: Math.round(hourly.us_aqi[nowIdx + i]),
      pm25: round(hourly.pm2_5[nowIdx + i], 1),
    }));

    return {
      status: "live",
      updatedAt: nowIso(),
      current: {
        aqi,
        band: aqiBand(aqi),
        pm25: round(current.pm2_5, 1),
        pm10: round(current.pm10, 1),
        ozone: round(current.ozone, 1),
        no2: round(current.nitrogen_dioxide, 1),
      },
      nextHours,
      history,
    };
  } catch {
    return buildAirFallback();
  }
}

function firmsRequestUrl() {
  const key = String(process.env.FIRMS_MAP_KEY || "").trim();
  if (!/^[A-Za-z0-9_-]{10,128}$/.test(key)) return null;
  return `https://firms.modaps.eosdis.nasa.gov/api/country/csv/${encodeURIComponent(key)}/VIIRS_SNPP/MYS/1`;
}

function redactPerson(person) {
  if (!person || typeof person !== "object") return person;
  return { ...person, phone: null };
}

function redactLocality(item) {
  if (!item || typeof item !== "object") return item;
  return { ...item, residential: null, commercial: null, industrial: null, exempted: null };
}

async function loadFires() {
  return cached("sat-fires", 30 * 60 * 1000, async () => {
    const url = firmsRequestUrl();
    if (!url) {
      return {
        status: "offline",
        updatedAt: nowIso(),
        hotspots: [],
        summary: "NASA FIRMS map key is not configured.",
      };
    }
    try {
      const csv = await fetchText(url, 10000);
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

async function loadGovStats() {
  return cached("gov-stats", 12 * 60 * 60 * 1000, async () => {
    const [ckanData, dosmStateData] = await Promise.allSettled([
      loadCKANDatasets("https://catalog.sarawak.gov.my", "population land use tourism"),
      // data.gov.my moved the catalogue to /data-catalogue/ and renamed the
      // aggregate values to overall_age / overall_sex / overall_ethnicity (checked 29 Sep 2026).
      fetchJson("https://api.data.gov.my/data-catalogue/?id=population_state&filter=Sarawak@state,overall_age@age,overall_sex@sex,overall_ethnicity@ethnicity&sort=-date&limit=1", 15000),
    ]);

    const datasets = ckanData.status === "fulfilled" ? ckanData.value : [];
    const dosm = dosmStateData.status === "fulfilled" ? dosmStateData.value : null;
    const latest = Array.isArray(dosm) ? dosm[0] : null; // sorted newest first
    // Portal size, not the three-topic search hit count the label used to show.
    const portalCount = await fetchJson("https://catalog.sarawak.gov.my/api/3/action/package_search?rows=0", 12000)
      .then((r) => r?.result?.count ?? null).catch(() => null);

    // District population moved to loadDistrictPopulation() (DOSM CSV, 13 Oct 2026).
    return {
      updatedAt: nowIso(),
      sarawak: {
        source: "Sarawak Data CKAN",
        datasetCount: portalCount ?? datasets.length,
        recentDatasets: datasets.map(d => ({ title: d.title, url: `https://catalog.sarawak.gov.my/dataset/${d.name}` })),
      },
      dosm: {
        source: "OpenDOSM",
        // OpenDOSM reports thousands. No hard-coded fallback: an unreachable
        // source shows as unavailable, never as a plausible-looking number.
        status: latest?.population != null ? "live" : "unavailable",
        latestSarawakPop: latest?.population != null ? Math.round(Number(latest.population) * 1000) : null,
        year: latest?.date ? latest.date.slice(0, 4) : null,
      }
    };
  });
}

// ---------------------------------------------------------------------------
// Ground-truth hydrology + air quality + deeper CKAN harvest
// Primary live feed: DID Sarawak iHYDRO (ihydro.sarawak.gov.my) — real gauges
// with official Normal/Alert/Warning/Danger thresholds. JPS Infobanjir is kept
// as a secondary scrape (often empty for Sarawak). Curated briefs attach to
// Padawan-priority stations so the wall never goes mute when telemetry drops.
// ---------------------------------------------------------------------------

const IHYDRO_MAP_URL = "https://ihydro.sarawak.gov.my/iHydro/en/map/maps.jsp";
const IHYDRO_WL_URL = "https://ihydro.sarawak.gov.my/iHydro/en/datatable/waterlevel/latest-waterlevel.jsp";
const IHYDRO_RAIN_URL = "https://ihydro.sarawak.gov.my/iHydro/en/datatable/rainfall/latest-rainfall.jsp";

// Greater Kuching bounding box — water ignores council lines; we still keep
// the metro envelope so Mukah/Bintulu gauges never swamp Padawan's picture.
const GK_HYDRO_BOUNDS = { minLat: 1.15, maxLat: 1.85, minLon: 109.9, maxLon: 110.7 };

// Padawan-first focus set. Match keys hydrate curated briefs onto live iHYDRO rows.
const SARAWAK_HYDRO_STATIONS = [
  {
    id: "batu-kitang",
    name: "Batu Kitang Telemetry",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.4524,
    lon: 110.2823,
    matchKeys: ["batu kitang"],
    thresholds: { normal: 1.85, alert: 3.0, warning: 4.5, danger: 5.0 },
    note: "Primary upstream gauge for Kuching urban flood pre-warning.",
    humanBrief: "Upstream canary for urban Kuching and the Padawan growth ring. When this gauge reads Alert, riverside kampungs along Batu Kitang are at doorstep risk and the TPPA landfill sits 800m downstream of contaminated-runoff concern.",
    affectedEstimate: "~2,400 residents, 340 properties, 3 schools, 1 clinic",
    lastEvent: "Sg. Sarawak exceeded Warning historically; Jalan Batu Kitang flooded for ~4 hours in prior monsoon events.",
  },
  {
    id: "batu-kawa",
    name: "Batu Kawa Bridge",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.5087,
    lon: 110.2703,
    matchKeys: ["batu kawa"],
    thresholds: { normal: 0.68, alert: 2.5, warning: 3.0, danger: 4.2 },
    note: "Bridge gauge for the Batu Kawa / Desa Wira flood corridor.",
    humanBrief: "The operational gauge for the RM 58.5M Batu Kawa retention programme. Rising here means Taman Desa Wira and Kampung Sinar Budi Baru are next — ~3,500 households in the inundation zone.",
    affectedEstimate: "~3,500 households along Batu Kawa corridor",
    lastEvent: "Recurrent inundation; DID Sarawak retention ponds targeted for 2027 completion.",
  },
  {
    id: "desa-wira",
    name: "Desa Wira",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.5104,
    lon: 110.3044,
    matchKeys: ["desa wira"],
    thresholds: { normal: 0.35, alert: 2.5, warning: 3.0, danger: 3.5 },
    note: "Neighbourhood gauge inside the Padawan flood hotspot.",
    humanBrief: "Sits inside the worst-hit residential pocket of Padawan. A Warning reading here is a street-level event — not a forecast.",
    affectedEstimate: "Taman Desa Wira + adjacent kampungs",
    lastEvent: "Repeated flash floods 2024–2025; PPS activations documented in local press.",
  },
  {
    id: "siniawan",
    name: "Siniawan",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.4466,
    lon: 110.2186,
    matchKeys: ["siniawan"],
    thresholds: { normal: 0.0, alert: 5.5, warning: 6.2, danger: 7.2 },
    note: "Western Padawan riverine pressure point.",
    humanBrief: "Heritage town + weekend night market (~2,000 visitors). A sudden rise during market hours is a crowd-safety incident, not just a flood event.",
    affectedEstimate: "~800 residents, heritage shophouses, weekend market",
    lastEvent: "Moderate flooding 2024-03; market evacuated, 12 shophouses affected.",
  },
  {
    id: "kpg-git",
    name: "Kampung Git",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.3555,
    lon: 110.2667,
    matchKeys: ["kampung git", "kpg git", "git"],
    thresholds: { normal: 5.0, alert: 12.29, warning: 12.79, danger: 13.29 },
    note: "Padawan upper-catchment indicator.",
    humanBrief: "Earliest basin signal — a rise here arrives at Batu Kitang 4–6 hours later. Single-lane access roads cut first.",
    affectedEstimate: "~600 residents in scattered kampungs",
    lastEvent: "Road to Kpg. Git cut for 2 days during 2024-01 monsoon surge.",
  },
  {
    id: "eighth-mile",
    name: "8th Mile",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.4452,
    lon: 110.3281,
    matchKeys: ["8th mile", "eighth mile", "batu 8"],
    thresholds: { normal: 5.2, alert: 7.04, warning: 8.64, danger: 9.45 },
    note: "Kota Padawan / Penrissen corridor gauge.",
    humanBrief: "Sits on the urban-rural transition where new housing is outrunning drain capacity. Watch this with Penrissen Road ponding reports.",
    affectedEstimate: "Kota Padawan growth corridor",
    lastEvent: "Seasonal trunk-road flooding along Kuching–Serian / Penrissen.",
  },
  {
    id: "kuala-maong",
    name: "Kuala Maong",
    basin: "Sg. Maong",
    council: "MBKS",
    focus: "metro",
    lat: 1.5422,
    lon: 110.3114,
    matchKeys: ["kuala maong", "maong"],
    thresholds: { normal: 0.25, alert: 2.0, warning: 2.4, danger: 2.8 },
    note: "Urban drain mouth — backs up first when Sg. Sarawak is high.",
    humanBrief: "The urban canary. At Alert, Jalan Song / Stutong junctions flood and southern Kuching gridlocks — water does not stop at the MBKS/MPP line.",
    affectedEstimate: "~12,000 residents, 200+ commercial properties",
    lastEvent: "Flash flood 2024-09-03; Stutong junction submerged ~3 hours.",
  },
  {
    id: "maong-tengah",
    name: "Maong Tengah Kiri",
    basin: "Sg. Maong",
    council: "MBKS",
    focus: "metro",
    lat: 1.5329,
    lon: 110.3245,
    matchKeys: ["maong tengah"],
    thresholds: { normal: 0.2, alert: 3.0, warning: 4.0, danger: 4.4 },
    note: "Mid-Maong urban drain gauge.",
    humanBrief: "Tracks the Maong backflow into Stutong / BDC before it reaches the Satok commercial strip.",
    affectedEstimate: "Stutong–BDC commercial corridor",
    lastEvent: "Paired with Kuala Maong during 2024–2025 flash events.",
  },
  {
    id: "central-park",
    name: "Central Park",
    basin: "Sg. Maong / urban",
    council: "MBKS",
    focus: "metro",
    lat: 1.5239,
    lon: 110.3396,
    matchKeys: ["central park"],
    thresholds: { normal: 0.2, alert: 2.5, warning: 3.0, danger: 3.5 },
    note: "Dense residential / commercial midtown gauge.",
    humanBrief: "When Central Park rises with Maong, the flood is already inside the city grid — not an upstream story.",
    affectedEstimate: "Central Park / Tabuan residential pocket",
    lastEvent: "Surface flooding common when Maong backs up at high tide.",
  },
  {
    id: "satok",
    name: "Satok B",
    basin: "Sg. Sarawak",
    council: "MBKS",
    focus: "metro",
    lat: 1.5591,
    lon: 110.3281,
    matchKeys: ["satok"],
    thresholds: { normal: -0.3, alert: 2.4, warning: 2.52, danger: 2.8 },
    note: "Satok commercial corridor tidal/river gauge.",
    humanBrief: "Heritage + market corridor. High tide + upstream rain is the classic pincer for Satok road closures.",
    affectedEstimate: "Satok market and Jalan Satok commercial strip",
    lastEvent: "Repeated tidal-amplified inundation events.",
  },
  {
    id: "padungan",
    name: "Padungan",
    basin: "Sg. Sarawak",
    council: "MBKS",
    focus: "metro",
    lat: 1.5545,
    lon: 110.3695,
    matchKeys: ["padungan"],
    thresholds: { normal: 0.5, alert: 2.6, warning: 2.81, danger: 3.3 },
    note: "Padungan / city-centre river gauge.",
    humanBrief: "City-centre indicator for Main Bazaar / Padungan shop houses — tourism and commerce impact, not just housing.",
    affectedEstimate: "Padungan heritage commercial strip",
    lastEvent: "High-water events along the urban waterfront.",
  },
  {
    id: "barrage",
    name: "Barrage",
    basin: "Sg. Sarawak",
    council: "DBKU",
    focus: "metro",
    lat: 1.576,
    lon: 110.4093,
    matchKeys: ["barrage"],
    thresholds: { normal: 0.06, alert: 2.8, warning: 2.92, danger: 3.2 },
    note: "Sarawak River Barrage — estuary control structure.",
    humanBrief: "Controls the tidal gate for the urban reach. A high reading here with upstream rain means the river cannot drain — Petra Jaya and the north bank feel it next.",
    affectedEstimate: "Estuarine Kuching / Petra Jaya approaches",
    lastEvent: "Tidal + upstream pincer events documented at Civic Centre car park (2023).",
  },
  {
    id: "bau-bridge",
    name: "Bau Bridge",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.4239,
    lon: 110.15,
    matchKeys: ["bau bridge"],
    thresholds: { normal: 5.1, alert: 12.46, warning: 12.58, danger: 12.86 },
    note: "Western Padawan / Bau district bridge gauge.",
    humanBrief: "Western flank of Padawan. Bau PPS activations in Jan 2025 multi-district floods started from this catchment.",
    affectedEstimate: "Bau town + western Padawan kampungs",
    lastEvent: "Jan 2025 — Kuching PPS opened for Bau evacuees.",
  },
  {
    id: "buso",
    name: "Buso",
    basin: "Sg. Sarawak",
    council: "MPP",
    focus: "padawan",
    lat: 1.452,
    lon: 110.1835,
    matchKeys: ["buso"],
    thresholds: { normal: 1.0, alert: 8.0, warning: 10.2, danger: 10.7 },
    note: "Mid-western Padawan tributary gauge.",
    humanBrief: "Fills the gap between Bau Bridge and Siniawan — useful for timing crew deployment along the western roads.",
    affectedEstimate: "Buso / western tributary kampungs",
    lastEvent: "Paired with Siniawan during western-catchment rises.",
  },
  {
    id: "malihah",
    name: "Malihah",
    basin: "Sg. Sarawak tributary",
    council: "DBKU",
    focus: "metro",
    lat: 1.5514,
    lon: 110.2426,
    matchKeys: ["malihah"],
    thresholds: { normal: 2.8, alert: 6.8, warning: 7.1, danger: 7.4 },
    note: "North-west metro gauge.",
    humanBrief: "Watches the Matang / north-west approach — peatland drainage stress zone.",
    affectedEstimate: "Matang Jaya / north-west residential belt",
    lastEvent: "1–2 m flood depths historically recorded in Matang Jaya lowlands.",
  },
];

const HYDRO_BANDS = [
  { id: "danger", label: "Danger", tone: "critical", color: "#ff003c" },
  { id: "warning", label: "Warning", tone: "alert", color: "#ff7a00" },
  { id: "alert", label: "Alert", tone: "warn", color: "#ffd000" },
  { id: "normal", label: "Normal", tone: "good", color: "#00ffaa" },
  { id: "reference", label: "Reference", tone: "muted", color: "#8aa2c8" },
];

const FLOOD_ACTION_BANDS = {
  // Plain speech for a Secretary, not radio codes for an operator.
  normal:  { verb: "Rivers look fine", verbBm: "Sungai tenang",     verbZh: "河况平稳", scoreMin: 0,  tone: "good" },
  watch:   { verb: "Keep watching",    verbBm: "Terus pantau",      verbZh: "继续留意", scoreMin: 20, tone: "muted" },
  prepare: { verb: "Get ready",        verbBm: "Bersedia",          verbZh: "做好准备", scoreMin: 45, tone: "warn" },
  act:     { verb: "Act now",          verbBm: "Bertindak sekarang", verbZh: "立即行动", scoreMin: 70, tone: "alert" },
};

// Documented / recently activated PPS and permanent centres for Greater Kuching.
// Coords approximate from public reporting; capacity notes from press + state statements.
const FLOOD_SHELTERS = [
  { id: "sk-beradek", name: "SK Beradek Permanent Disaster Relocation Centre (PPKB)", area: "Padawan", council: "MPP", lat: 1.42, lon: 110.30, status: "under-construction", note: "RM8.5M permanent centre; targeted completion Mar 2026 (Borneo Post 2025-12).", maps: "https://www.google.com/maps/search/?api=1&query=SK+Beradek+Padawan" },
  { id: "pps-kuching-1", name: "Kuching temporary PPS (school / community hall — activate on order)", area: "Kuching", council: "MBKS/DBKU", lat: 1.55, lon: 110.35, status: "standby", note: "Jan 2025: 2 PPS opened in Kuching for 162 evacuees incl. Bau households (Borneo Post).", maps: "https://www.google.com/maps/search/?api=1&query=Kuching+flood+relief+centre" },
  { id: "pps-bau", name: "Bau district PPS (activate on JPAM / district order)", area: "Bau / West Padawan", council: "MPP", lat: 1.42, lon: 110.15, status: "standby", note: "Used in Jan 2025 multi-district event; confirm open status via JPAM before directing public.", maps: "https://www.google.com/maps/search/?api=1&query=Bau+Sarawak+flood+relief" },
];

const FLOOD_HOTLINES = [
  { id: "999", label: "Emergency (Police / Fire / Ambulance)", number: "999" },
  { id: "jpam", label: "Civil Defence (JPAM Sarawak)", number: "082-441144", note: "Confirm via directory if engaged" },
  { id: "did", label: "DID Sarawak (iHYDRO operations)", number: "082-440666", url: "https://ihydro.sarawak.gov.my/" },
  { id: "mpp", label: "Majlis Perbandaran Padawan", number: "082-615566", url: "https://mpp.sarawak.gov.my/" },
  { id: "infobanjir", label: "JPS Public Infobanjir", number: null, url: "https://publicinfobanjir.water.gov.my/?lang=en" },
];

function classifyHydroBand(level, thresholds) {
  if (level == null || Number.isNaN(level) || !thresholds) return "reference";
  if (thresholds.danger != null && level >= thresholds.danger) return "danger";
  if (thresholds.warning != null && level >= thresholds.warning) return "warning";
  if (thresholds.alert != null && level >= thresholds.alert) return "alert";
  return "normal";
}

function bandColor(bandId) {
  return HYDRO_BANDS.find((b) => b.id === bandId)?.color || "#8aa2c8";
}

function slugHydroName(name) {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function findCuratedHydro(name) {
  const lower = String(name || "").toLowerCase();
  return SARAWAK_HYDRO_STATIONS.find((s) =>
    s.matchKeys.some((k) => lower.includes(k)) || lower.includes(s.name.toLowerCase()),
  ) || null;
}

function parseIhydroMapMarkers(html) {
  if (!html || typeof html !== "string") return [];
  const pat = /\[\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*,\s*([-\d.]+)\s*,\s*([-\d.]+)\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*,\s*'((?:\\'|[^'])*)'\s*\]/g;
  const out = [];
  let m;
  while ((m = pat.exec(html)) !== null) {
    const rawName = m[2].replace(/\\'/g, "'");
    const typ = m[3];
    const lat = Number.parseFloat(m[4]);
    const lon = Number.parseFloat(m[5]);
    const rfStatus = m[6];
    const wlStatus = m[7];
    const info = m[8].replace(/\\'/g, "'");
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (lat < GK_HYDRO_BOUNDS.minLat || lat > GK_HYDRO_BOUNDS.maxLat) continue;
    if (lon < GK_HYDRO_BOUNDS.minLon || lon > GK_HYDRO_BOUNDS.maxLon) continue;
    // Prefer water / combine stations; skip pure rainfall pins for the WL list.
    if (/rainfall/i.test(typ) && !/combine|water/i.test(typ)) continue;
    const grab = (label) => {
      const mm = info.match(new RegExp(`${label}\\s*:\\s*([-\\d.]+)\\s*m`, "i"));
      return mm ? Number.parseFloat(mm[1]) : null;
    };
    const dailyRf = (() => {
      const mm = info.match(/Daily RF\s*:\s*([-\\d.]+)\s*mm/i);
      return mm ? Number.parseFloat(mm[1]) : null;
    })();
    const name = rawName.replace(/-(Combine|Rainfall|Water)$/i, "").trim();
    const thresholds = {
      normal: grab("Normal Level"),
      alert: grab("Alert Level"),
      warning: grab("Warning Level"),
      danger: grab("Danger Level"),
    };
    // Need at least an alert threshold to classify flood posture.
    if (thresholds.alert == null && thresholds.danger == null) continue;
    const level = grab("Latest WL");
    out.push({
      name,
      type: typ,
      lat,
      lon,
      waterLevelM: Number.isFinite(level) ? level : null,
      thresholds,
      rainfallTodayMm: Number.isFinite(dailyRf) ? dailyRf : null,
      wlStatusRaw: wlStatus,
      rfStatusRaw: rfStatus,
      observedAt: (() => {
        const tm = info.match(/Time Taken\s*:\s*([0-9]{2}-[0-9]{2}-[0-9]{4}\s+[0-9]{2}:[0-9]{2})/i);
        return tm ? tm[1] : null;
      })(),
    });
  }
  return out;
}

function parseIhydroWlTable(html) {
  if (!html || typeof html !== "string") return [];
  const rows = html.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
  const out = [];
  for (const row of rows) {
    const cells = [...row.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").replace(/•/g, "").trim(),
    );
    if (cells.length < 10) continue;
    if (/station name/i.test(cells[1] || "")) continue;
    const name = cells[1];
    const level = Number.parseFloat(cells[5]);
    const normal = Number.parseFloat(cells[6]);
    const alert = Number.parseFloat(cells[7]);
    const warning = Number.parseFloat(cells[8]);
    const danger = Number.parseFloat(cells[9]);
    if (!name || !Number.isFinite(alert)) continue;
    out.push({
      name,
      waterLevelM: Number.isFinite(level) ? level : null,
      thresholds: {
        normal: Number.isFinite(normal) ? normal : null,
        alert,
        warning: Number.isFinite(warning) ? warning : null,
        danger: Number.isFinite(danger) ? danger : null,
      },
      observedAt: cells[4] || null,
      division: cells[2] || null,
      basin: cells[3] || null,
    });
  }
  return out;
}

function hydrateHydroStation(live, curated) {
  const thresholds = {
    normal: live.thresholds?.normal ?? curated?.thresholds?.normal ?? null,
    alert: live.thresholds?.alert ?? curated?.thresholds?.alert ?? null,
    warning: live.thresholds?.warning ?? curated?.thresholds?.warning ?? null,
    danger: live.thresholds?.danger ?? curated?.thresholds?.danger ?? null,
  };
  const band = classifyHydroBand(live.waterLevelM, thresholds);
  const id = curated?.id || slugHydroName(live.name);
  return {
    id,
    name: curated?.name || live.name,
    basin: curated?.basin || live.basin || "Sg. Sarawak basin",
    council: curated?.council || "Greater Kuching",
    focus: curated?.focus || "metro",
    lat: live.lat ?? curated?.lat ?? null,
    lon: live.lon ?? curated?.lon ?? null,
    matchKeys: curated?.matchKeys || [live.name.toLowerCase()],
    thresholds,
    note: curated?.note || "DID Sarawak iHYDRO gauge",
    humanBrief: curated?.humanBrief || null,
    affectedEstimate: curated?.affectedEstimate || null,
    lastEvent: curated?.lastEvent || null,
    waterLevelM: live.waterLevelM != null ? round(live.waterLevelM, 2) : null,
    band,
    bandLabel: HYDRO_BANDS.find((b) => b.id === band)?.label || band,
    rainfallTodayMm: live.rainfallTodayMm != null ? round(live.rainfallTodayMm, 1) : null,
    observedAt: live.observedAt || null,
    source: "DID Sarawak iHYDRO",
  };
}

async function loadStationRainfall() {
  return cached("station-rainfall", 15 * 60 * 1000, async () => {
    const results = await Promise.all(
      SARAWAK_HYDRO_STATIONS.map(async (s) => {
        try {
          const url = `https://api.open-meteo.com/v1/forecast?latitude=${s.lat}&longitude=${s.lon}&daily=precipitation_sum&past_days=1&forecast_days=2&timezone=Asia%2FKuching`;
          const j = await fetchJson(url, 9000);
          const vals = (j?.daily?.precipitation_sum) || [];
          return [s.id, {
            pastMm: round(vals[0] ?? 0, 1),
            todayMm: round(vals[1] ?? 0, 1),
            tomorrowMm: round(vals[2] ?? 0, 1),
          }];
        } catch {
          return [s.id, null];
        }
      }),
    );
    return new Map(results.filter(([, v]) => v));
  }).catch(() => new Map());
}

async function loadIhydroLive() {
  return cached("ihydro-sarawak", 10 * 60 * 1000, async () => {
    const mapHtml = await fetchText(IHYDRO_MAP_URL, 20000);
    let markers = parseIhydroMapMarkers(mapHtml);
    if (!markers.length) {
      const tableHtml = await fetchText(IHYDRO_WL_URL, 15000);
      markers = parseIhydroWlTable(tableHtml).map((row) => {
        const curated = findCuratedHydro(row.name);
        return {
          ...row,
          lat: curated?.lat ?? null,
          lon: curated?.lon ?? null,
        };
      });
    }
    return {
      markers,
      sourceUrl: IHYDRO_MAP_URL,
      fetchedAt: nowIso(),
    };
  });
}

function parseInfobanjirHtml(html) {
  // Legacy permissive scrape — Infobanjir SWK table is often empty ("No Data").
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
  return cached("jps-infobanjir", 10 * 60 * 1000, async () => {
    const rainByStation = await loadStationRainfall();
    let liveStations = [];
    let source = "DID Sarawak iHYDRO";
    let sourceUrl = IHYDRO_MAP_URL;
    let feedStatus = "reference";

    try {
      const ihydro = await loadIhydroLive();
      const byId = new Map();
      for (const marker of ihydro.markers) {
        const curated = findCuratedHydro(marker.name);
        const station = hydrateHydroStation(marker, curated);
        // Prefer curated Padawan-focus rows; keep other live GK gauges too.
        if (!byId.has(station.id) || curated) byId.set(station.id, station);
      }
      // Ensure every curated Padawan station appears even if iHYDRO name drifted.
      for (const curated of SARAWAK_HYDRO_STATIONS) {
        if (!byId.has(curated.id)) {
          byId.set(curated.id, {
            ...curated,
            waterLevelM: null,
            band: "reference",
            bandLabel: "Reference",
            rainfallTodayMm: null,
            observedAt: null,
            source: "reference",
          });
        }
      }
      liveStations = [...byId.values()];
      sourceUrl = ihydro.sourceUrl;
      const liveCount = liveStations.filter((s) => s.waterLevelM != null).length;
      feedStatus = liveCount > 0 ? "live" : "reference";
    } catch {
      liveStations = SARAWAK_HYDRO_STATIONS.map((s) => ({
        ...s,
        waterLevelM: null,
        band: "reference",
        bandLabel: "Reference",
      }));
    }

    // Secondary: try Infobanjir aras-air-data (usually empty for Sarawak).
    if (feedStatus !== "live") {
      const candidates = [
        "https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/aras-air-data/?state=SRK&lang=en",
        "https://publicinfobanjir.water.gov.my/aras-air/data-paras-air/?state=SWK&lang=en&menu=20",
      ];
      for (const url of candidates) {
        try {
          const html = await fetchText(url, 12000);
          const parsed = parseInfobanjirHtml(html);
          if (parsed.size > 0) {
            liveStations = liveStations.map((station) => {
              if (!parsed.has(station.id)) return station;
              const level = parsed.get(station.id);
              const band = classifyHydroBand(level, station.thresholds);
              return {
                ...station,
                waterLevelM: round(level, 2),
                band,
                bandLabel: HYDRO_BANDS.find((b) => b.id === band)?.label || band,
                source: "JPS Public Infobanjir",
              };
            });
            source = "JPS Public Infobanjir";
            sourceUrl = url;
            feedStatus = "live";
            break;
          }
        } catch {
          // try next
        }
      }
    }

    const stations = liveStations.map((station) => {
      const rain = rainByStation.get(station.id);
      if (!rain) return station;
      return {
        ...station,
        rainfallPastMm: rain.pastMm,
        rainfallTodayMm: station.rainfallTodayMm ?? rain.todayMm,
        rainfallTomorrowMm: rain.tomorrowMm,
      };
    });

    // Sort: Padawan focus first, then by severity, then name.
    const bandOrder = { danger: 0, warning: 1, alert: 2, normal: 3, reference: 4 };
    stations.sort((a, b) => {
      const focusRank = (s) => (s.focus === "padawan" ? 0 : 1);
      const dFocus = focusRank(a) - focusRank(b);
      if (dFocus) return dFocus;
      const dBand = (bandOrder[a.band] ?? 9) - (bandOrder[b.band] ?? 9);
      if (dBand) return dBand;
      return String(a.name).localeCompare(String(b.name));
    });

    const liveCount = stations.filter((s) => s.waterLevelM != null).length;
    const padawanLive = stations.filter((s) => s.focus === "padawan" && s.waterLevelM != null).length;
    const highest = stations.reduce((acc, s) => {
      const order = ["normal", "alert", "warning", "danger"];
      const cur = order.indexOf(s.band);
      const best = order.indexOf(acc);
      return cur > best ? s.band : acc;
    }, "normal");

    return {
      status: feedStatus,
      updatedAt: nowIso(),
      source,
      sourceUrl,
      liveCount,
      stationCount: stations.length,
      padawanLiveCount: padawanLive,
      highestBand: highest,
      highestBandLabel: HYDRO_BANDS.find((b) => b.id === highest)?.label || highest,
      stations,
      bands: HYDRO_BANDS,
      shelters: FLOOD_SHELTERS,
      hotlines: FLOOD_HOTLINES,
      summary:
        liveCount > 0
          ? `${liveCount}/${stations.length} Greater Kuching gauges live via ${source} (${padawanLive} Padawan-focus). Highest posture: ${highest.toUpperCase()}.`
          : `Live hydro feed degraded. Holding ${stations.length} reference stations on the wall.`,
    };
  });
}

function floodActionBand(score) {
  if (score >= FLOOD_ACTION_BANDS.act.scoreMin) return "act";
  if (score >= FLOOD_ACTION_BANDS.prepare.scoreMin) return "prepare";
  if (score >= FLOOD_ACTION_BANDS.watch.scoreMin) return "watch";
  return "normal";
}

function buildFloodAction({ infobanjir, weather, floodForecast, metWarnings, news }) {
  const stations = infobanjir?.stations || [];
  const padawan = stations.filter((s) => s.focus === "padawan");
  const scoredStations = (padawan.length ? padawan : stations).filter((s) => s.waterLevelM != null);
  const bandScore = { normal: 0, alert: 40, warning: 70, danger: 95, reference: 0 };
  let score = 0;
  const drivers = [];

  const worst = scoredStations.reduce((acc, s) => {
    const order = ["normal", "alert", "warning", "danger"];
    if (!acc) return s;
    return order.indexOf(s.band) > order.indexOf(acc.band) ? s : acc;
  }, null);

  if (worst) {
    score = Math.max(score, bandScore[worst.band] || 0);
    if (worst.band !== "normal") {
      drivers.push(`${worst.name} at ${worst.bandLabel} (${worst.waterLevelM} m)`);
    }
  }

  const rain6h = Array.isArray(weather?.nextHours)
    ? round(weather.nextHours.reduce((sum, hour) => sum + (hour.precipitationMm || 0), 0), 1)
    : null;
  const rainToday = weather?.daily?.rainTotalMm
    ?? scoredStations.reduce((m, s) => Math.max(m, s.rainfallTodayMm || 0), 0);
  if (rainToday >= 50) { score = Math.max(score, 55); drivers.push(`Basin rain ${round(rainToday, 0)} mm today`); }
  else if (rainToday >= 25) { score = Math.max(score, 30); drivers.push(`Basin rain ${round(rainToday, 0)} mm today`); }
  else if (rain6h != null && rain6h >= 15) { score = Math.max(score, 35); drivers.push(`${rain6h} mm rain / 6h`); }

  const peak = floodForecast?.peakCms;
  const todayQ = floodForecast?.todayCms;
  if (peak != null && peak >= 250) { score = Math.max(score, 50); drivers.push(`GloFAS peak ${peak} m³/s`); }
  else if (todayQ != null && todayQ >= 200) { score = Math.max(score, 35); drivers.push(`GloFAS discharge ${todayQ} m³/s`); }

  const metActive = metWarnings?.activeCount || 0;
  if (metActive > 0) {
    score = Math.max(score, 40);
    drivers.push(`${metActive} MET Malaysia warning(s) active`);
  }

  // Northeast monsoon floor (Nov–Feb) — never imply the season is "over".
  const month = new Date().getUTCMonth() + 1;
  const monsoon = month >= 11 || month <= 2;
  if (monsoon && score < 20) {
    score = 20;
    drivers.push("Northeast monsoon window — stay informed");
  }

  const band = floodActionBand(score);
  const meta = FLOOD_ACTION_BANDS[band];
  const floodNews = (news?.items || []).filter((n) =>
    /flood|banjir|inundat|PPS|evacuee|relief centre|water level|paras air/i.test(`${n.title || ""} ${n.summary || ""}`),
  ).slice(0, 4);

  let reality = "CALM";
  const measuredBad = ["alert", "warning", "danger"].includes(infobanjir?.highestBand);
  if (floodNews.length >= 2 && measuredBad) reality = "CONFIRMED";
  else if (floodNews.length >= 2 && !measuredBad) reality = "OVERSTATED";
  else if (floodNews.length < 2 && measuredBad) reality = "UNDERSTATED";

  const checklists = {
    normal: [
      "No flood action required — keep one eye on Batu Kitang and Desa Wira gauges.",
      "Drainage crews stay on routine sweeps along Penrissen / Batu Kawa.",
    ],
    watch: [
      "Check iHYDRO Padawan gauges twice today (Batu Kitang, Batu Kawa, Desa Wira, Siniawan).",
      "Pre-position one mobile crew for Penrissen / Kota Padawan ponding.",
      "Share status with MBKS — Maong backflow crosses the council line.",
    ],
    prepare: [
      "Raise valuables / electrics in Desa Wira, Sinar Budi Baru, and riverside kampungs.",
      "Confirm JPAM PPS open/closed status before directing residents.",
      "Clear critical drains: Penrissen, Batu Kawa, Sg. Maong junctions.",
      "Brief ward councillors in flood-prone localities (Wards H / I / NPQ).",
    ],
    act: [
      "Follow JPAM / district official instructions — this board does not issue evacuation orders.",
      "Open nearest standby PPS only when JPAM activates it; use hotlines below.",
      "Close flooded road segments (Penrissen, Batu Kawa, Satok) and publish diversions.",
      "Coordinate MPP + MBKS + DBKU — treat the basin as one system.",
    ],
  };

  return {
    status: infobanjir?.status || "reference",
    updatedAt: nowIso(),
    score: Math.min(100, Math.round(score)),
    band,
    verb: meta.verb,
    verbBm: meta.verbBm,
    verbZh: meta.verbZh,
    tone: meta.tone,
    reason: drivers[0] || (monsoon ? "Monsoon window — no gauge above Alert." : "All monitored gauges below Alert."),
    drivers: drivers.slice(0, 5),
    checklist: checklists[band],
    worstStation: worst ? {
      id: worst.id, name: worst.name, band: worst.band, level: worst.waterLevelM, council: worst.council,
    } : null,
    padawanLive: infobanjir?.padawanLiveCount ?? scoredStations.length,
    metroLive: infobanjir?.liveCount ?? 0,
    realityCheck: {
      verdict: reality,
      newsCount: floodNews.length,
      measuredBand: infobanjir?.highestBand || "reference",
      headlines: floodNews.map((n) => ({ title: n.title, source: n.source, url: n.url || n.link || null })),
    },
    shelters: FLOOD_SHELTERS,
    hotlines: FLOOD_HOTLINES,
    source: infobanjir?.source || "DID Sarawak iHYDRO",
    sourceUrl: infobanjir?.sourceUrl || IHYDRO_MAP_URL,
    confidence: infobanjir?.status === "live"
      ? `Live DID gauges · ${infobanjir.liveCount}/${infobanjir.stationCount} reporting`
      : "Reference hold — live DID feed degraded",
  };
}

const APIMS_STATIONS = [
  { id: "kuching", query: "kuching", label: "Kuching", council: "MBKS/DBKU" },
  { id: "samarahan", query: "samarahan", label: "Samarahan", council: "Adjacent" },
];

async function loadApimsAqi() {
  return cached("apims-ground-aq", 15 * 60 * 1000, async () => {
    const token = process.env.AQICN_TOKEN || "demo";
    const tokenMode = token === "demo" ? "demo" : "configured";
    // The WAQI mirror is a CORS-friendly aggregator that re-publishes the
    // DOE APIMS station feed. The demo token is rate-limited and frequently
    // returns a generic station (Shanghai) instead of the requested city —
    // we must detect that and refuse to label the result as ground truth.
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
          const cityName = (d.city?.name || "").toString().toLowerCase();
          // Reject responses that don't match the requested station — the
          // demo token returns "Shanghai" for anything it cannot resolve,
          // which previously surfaced as a fake Sarawak AQI.
          const isMatch =
            cityName.includes(station.label.toLowerCase()) ||
            cityName.includes(station.query.toLowerCase());
          const aqi = Number.isFinite(d.aqi) ? Math.round(d.aqi) : null;
          return {
            ...station,
            status: aqi == null || !isMatch ? "degraded" : "live",
            aqi: isMatch ? aqi : null,
            band: isMatch && aqi != null ? aqiBand(aqi) : null,
            pm25: isMatch && iaqi.pm25?.v != null ? round(iaqi.pm25.v, 1) : null,
            pm10: isMatch && iaqi.pm10?.v != null ? round(iaqi.pm10.v, 1) : null,
            o3: isMatch && iaqi.o3?.v != null ? round(iaqi.o3.v, 1) : null,
            no2: isMatch && iaqi.no2?.v != null ? round(iaqi.no2.v, 1) : null,
            dominant: isMatch ? d.dominentpol || null : null,
            stationName: station.label,
            resolvedCityName: d.city?.name || null,
            lat: isMatch && geo.length ? geo[0] : null,
            lon: isMatch && geo.length ? geo[1] : null,
            observedAt: isMatch ? d.time?.iso || null : null,
          };
        } catch (error) {
          return { ...station, status: "offline", aqi: null, error: error.message };
        }
      }),
    );

    const live = results.filter((r) => r.status === "live");
    const worst = live.reduce((acc, r) => (acc == null || (r.aqi ?? 0) > (acc.aqi ?? 0) ? r : acc), null);

    return {
      status: live.length > 0 ? (tokenMode === "demo" ? "demo" : "live") : "offline",
      updatedAt: nowIso(),
      // Cite the authoritative DOE portal; the WAQI mirror is only an
      // aggregator. Secretary Goh can read the live readings for any of the
      // 65 APIMS stations (including Sarawak: Kuching, Sibu, Bintulu, Miri,
      // Limbang, ILP Miri) at https://eqms.doe.gov.my/APIMS/main.
      source: "DOE JAS APIMS — eqms.doe.gov.my",
      sourceUrl: "https://eqms.doe.gov.my/APIMS/main",
      mirror: "WAQI aqicn.org aggregator",
      tokenMode,
      // The APIMS network has 65 stations across Malaysia; no APIMS station
      // sits inside MPP (Padawan) proper. Closest ground coverage is the
      // Kuching station (covers DBKU / MBKS) and the Samarahan station
      // (eastern neighbour). MPP-specific air quality falls back to the
      // Open-Meteo modelled series until DOE extends the network.
      coverageNote: "APIMS has no Padawan-located station; nearest ground coverage is Kuching (covers MBKS/DBKU) and Samarahan. See eqms.doe.gov.my/APIMS/main for the official live readings.",
      stations: results,
      worst,
      summary:
        live.length > 0
          ? `${live.length}/${results.length} ground stations reporting. Worst: ${worst?.stationName} AQI ${worst?.aqi} (${worst?.band?.label || "n/a"}).`
          : tokenMode === "demo"
            ? "DOE APIMS ground-truth feed requires an AQICN_TOKEN; falling back to Open-Meteo modelled values. Set AQICN_TOKEN in the GitHub Actions secret store to enable live Sarawak APIMS readings (eqms.doe.gov.my)."
            : "Ground-truth AQ feeds degraded — falling back to Open-Meteo modelled values.",
    };
  });
}

// NREB Sarawak — state-tier official Air Pollutant Index readings, published
// as public Google Sheets documents embedded in nreb.gov.my's "Latest API"
// page (/web/subpage/webpage_view/548). 16 stations across Sarawak, including
// Kuching, Samarahan, Serian, Sri Aman, Sarikei, Sibu, Mukah, Kapit, Bintulu,
// Samalaju, Miri, ILP Miri and Limbang. This outranks modeled AQI feeds.
const NREB_API_SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vT0x_xDAGHTOvyYtsGmGp9xt7nu_Nc9fwB0lAmnICxGnXKi656EmZT7lclEZxRxZEawA05SgiKZ7r5x/pubhtml?widget=false&chrome=false&headers=false&gridlines=false";
const NREB_API_TIME_SHEET = "https://docs.google.com/spreadsheets/d/e/2PACX-1vQu-3Gg1A2QELBvhtQQT1DRJJzFHE34tSpM3cF_6xB1Ej24pUIaInk-v4M-SywvlvUJ_IQtjKgv1yFV/pubhtml?widget=false&chrome=false&headers=false&gridlines=false";
const NREB_API_SCALE_URL = "https://www.nreb.gov.my/web/subpage/webpage_view/548";
const NREB_BAND_TONE = {
  Good: "good",
  Moderate: "watch",
  Unhealthy: "alert",
  "Very Unhealthy": "critical",
  Hazardous: "critical",
  "Very Hazardous": "critical",
};
function parsePubhtmlTable(html) {
  if (!html || typeof html !== "string") return [];
  const rows = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = Array.from(row[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi), (cell) =>
      stripTags(cell[1]).trim());
    rows.push(cells);
  }
  return rows;
}
async function loadNrebApi() {
  return cached("nreb-api", 30 * 60 * 1000, async () => {
    const [stationHtml, timeHtml] = await Promise.all([
      fetchText(NREB_API_SHEET, 12000),
      fetchText(NREB_API_TIME_SHEET, 12000).catch(() => ""),
    ]);
    // The NREB sheet has 4 columns: sequence, STATION, INDEX, STATUS. Strip
    // the header row (which starts with a numeric seq) and keep only rows
    // where the station cell is a non-numeric name.
    const rows = parsePubhtmlTable(stationHtml)
      .filter((cells) => cells.length >= 4 && /^\d+$/.test(cells[0]) && !/^station$/i.test(cells[1]) && /^\d+$/.test(cells[2]));
    if (!rows.length) return { status: "absent" };
    const stations = rows.map((cells) => ({
      name: cells[1],
      api: parseInt(cells[2], 10),
      band: cells[3] || "Unknown",
      tone: NREB_BAND_TONE[cells[3]] || "neutral",
    }));
    const sorted = stations.slice().sort((a, b) => b.api - a.api);
    // The time sheet is a separate publication; if we can't read it, omit
    // takenAt rather than invent a stamp.
    const takenAt = parsePubhtmlTable(timeHtml).find((cells) => cells.length >= 2 && cells[1])?.[1] || null;
    return {
      status: "ready",
      takenAt,
      stations,
      kuching: stations.find((s) => /kuching/i.test(s.name)) || null,
      worst: sorted[0],
      scaleUrl: NREB_API_SCALE_URL,
      fetchedAt: nowIso(),
    };
  }).catch(() => ({ status: "absent" }));
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

    const kmlUrl = String(process.env.PADAWAN_ZONING_KML_URL || "").trim();
    if (!kmlUrl) return fallback;

    try {
      const kml = await fetchText(kmlUrl, 12000);
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
    asset: "/assets/greater-kuching-map-blank.svg",
    title: "Greater Kuching municipal reference map",
    credit: "Greater Kuching map blank.svg adapted from Wikimedia Commons",
    updatedAt: nowIso(),
    focusLabel: "Padawan in focus, Greater Kuching in full frame",
    geometryStatus: jurisdictions.geometryStatus,
    wardCount: padawanZoning.wardCount,
    wardStatus: padawanZoning.status,
    hydroStations: infobanjir?.stations || [],
    hydroBands: infobanjir?.bands || [],
    watchpoints: ["Penrissen", "Batu Kawa", "Matang", "Batu Kitang", "Kota Sentosa", "Kota Padawan", "Siburan", "Tapah", "Beratok", "Mambong"],
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

function buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends, metWarnings, nrebApi) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");
  const totalKnownProperties = jurisdictions.items.reduce((sum, item) => sum + (item.properties ?? 0), 0);
  const totalKnownPopulation = jurisdictions.items.reduce((sum, item) => sum + (item.population ?? 0), 0);

  return [
    { id: "heat", label: "Heat index", value: weather.current.apparentTemperatureC, unit: "C", tone: weather.current.apparentTemperatureC >= 35 ? "warn" : "neutral", history: weather.history, context: weather.current.weatherLabel },
    { id: "aqi", label: "AQI", value: air.current.aqi, unit: "", tone: air.current.band.tone, history: air.history, context: air.current.band.label },
    ...(nrebApi?.status === "ready" && nrebApi.kuching ? [{
      // NREB's Kuching reading outranks modeled AQI — the state's own gauge.
      id: "nreb-api",
      label: "API (NREB Kuching)",
      value: nrebApi.kuching.api,
      unit: "",
      tone: nrebApi.kuching.tone,
      context: `NREB official · ${nrebApi.kuching.band}${nrebApi.takenAt ? ` · ${nrebApi.takenAt}` : ""}`,
    }] : []),
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
    { id: "flood-watch", label: "Flood watch", value: metWarnings?.activeCount ?? null, unit: "alert", tone: metWarnings?.status === "unavailable" || (metWarnings?.activeCount ?? 0) > 0 ? "warn" : "neutral", context: metWarnings?.status === "unavailable" ? "Warning status unavailable — check MET bulletin" : (metWarnings?.activeCount ?? 0) > 0 ? (metWarnings.items[0]?.heading ?? "Active MET warning") : "No active regional MET warnings at last check" },
  ];
}

// Directives are composed in English with BM / ZH twins built from the same
// numbers, so the board never mixes languages. Upstream text (MPP pledge
// wording, MET bulletins) stays as the agency published it.
function withI18n(item, ms, zh) {
  return { ...item, i18n: { ms, zh } };
}

function buildOperations({ weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes, govStats, infobanjir, apims, metWarnings, forecast, floodMatrix, mppService, tide, nrebApi }) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");
  const sarawakStats = govStats.sarawak;
  const openDosmStats = govStats.dosm;

  const items = [];

  // NREB haze directive — state-tier official readings, outranks modeled AQI.
  // Fires only when ANY Sarawak station reads Unhealthy (API 100+) or worse;
  // the detail names the worst station and the Kuching reading so the chief
  // can brief the council in one glance. Never fires on absent data.
  if (nrebApi?.status === "ready" && Array.isArray(nrebApi.stations) && nrebApi.stations.some((s) => s.api >= 100)) {
    const worst = nrebApi.stations.slice().sort((a, b) => b.api - a.api)[0];
    const kuching = nrebApi.kuching;
    items.push({
      severity: worst.api >= 200 ? "high" : "medium",
      owner: "Haze Watch",
      title: `NREB API ${worst.api} (${worst.band}) — ${worst.name}`,
      detail: `NREB Sarawak monitoring${nrebApi.takenAt ? `, ${nrebApi.takenAt}` : ""}: Kuching ${kuching ? `${kuching.api} (${kuching.band})` : "no reading"}. Suspend any open burning, stage masks for outdoor crews, defer non-essential outdoor work.`,
      humanContext: "These are the state's own gauges, not a model — sensitive groups feel this first. NREB outranks this board.",
    });
  }

  // Air-quality directive — fires when AQI enters Sensitive (>=100) or worse.
  // Ground-truth APIMS wins; Open-Meteo is the modelled fallback. This is the
  // single most-felt number on the public-health side: schools, outdoor works,
  // and elderly care all need the threshold language from a known source.
  const groundAqi = apims?.worst?.aqi ?? null;
  const effectiveAqi = groundAqi != null ? groundAqi : air.current.aqi;
  if (Number.isFinite(effectiveAqi) && effectiveAqi >= 100) {
    const tier = effectiveAqi >= 200 ? "Very Unhealthy"
      : effectiveAqi >= 150 ? "Unhealthy"
      : "Sensitive";
    const severity = effectiveAqi >= 200 ? "high"
      : effectiveAqi >= 150 ? "high"
      : "medium";
    const source = groundAqi != null ? `APIMS ground (${apims.worst.stationName})` : "Open-Meteo modelled";
    const aqiR = Math.round(effectiveAqi);
    const tierMs = { "Very Unhealthy": "Sangat Tidak Sihat", Unhealthy: "Tidak Sihat", Sensitive: "Sensitif" }[tier];
    const tierZh = { "Very Unhealthy": "非常不健康", Unhealthy: "不健康", Sensitive: "敏感" }[tier];
    const heavy = effectiveAqi >= 150;
    items.push(withI18n({
      severity,
      owner: "Public Health Watch",
      title: `Haze advisory · AQI ${aqiR} (${tier})`,
      detail: `${source}. ${heavy ? "Schools, outdoor worksites and elder-care facilities should reduce outdoor exposure. Issue the standing DOE advisory copy via the MPP bulletin." : "Sensitive groups (children, elderly, respiratory patients) should reduce prolonged outdoor exertion. Monitor DOE APIMS for escalation."}`,
      humanContext: "Source: DOE APIMS (eqms.doe.gov.my). PM10 and PM2.5 are cross-checked from the same upstream.",
    }, {
      owner: "Pemantauan Kesihatan Awam",
      title: `Nasihat jerebu · IKU ${aqiR} (${tierMs})`,
      detail: `${source}. ${heavy ? "Sekolah, tapak kerja luar dan pusat jagaan warga emas perlu mengurangkan pendedahan di luar. Edarkan teks nasihat JAS melalui buletin MPP." : "Golongan sensitif (kanak-kanak, warga emas, pesakit pernafasan) perlu mengurangkan aktiviti luar yang lama. Pantau APIMS JAS jika keadaan memburuk."}`,
      humanContext: "Sumber: APIMS JAS (eqms.doe.gov.my). PM10 dan PM2.5 disemak dari sumber yang sama.",
    }, {
      owner: "公共卫生监测",
      title: `烟霾提醒 · 空气质量指数 ${aqiR}（${tierZh}）`,
      detail: `${source}。${heavy ? "学校、户外工地和养老机构应减少户外暴露。请通过 MPP 公告发布环境局的标准提醒。" : "敏感人群（儿童、长者、呼吸道患者）应减少长时间户外活动。请留意环境局 APIMS 是否升级。"}`,
      humanContext: "来源：环境局 APIMS（eqms.doe.gov.my）。PM10 与 PM2.5 来自同一数据源交叉核对。",
    }));
  }

  // Client-charter directive — MPP's own published quarterly score. Names the
  // weakest pledge below 95% so the Secretary sees the gap before a councillor does.
  const charterGap = mppService?.charter?.weakest?.[0];
  if (charterGap) {
    const pledge = `${charterGap.pledge.replace(/\.\s*$/, "").slice(0, 140)}${charterGap.pledge.length > 140 ? "…" : ""}`;
    const q = mppService.charter.latestQuarter, upd = mppService.charter.updated || "n/a";
    items.push(withI18n({
      severity: charterGap.score < 80 ? "medium" : "low",
      owner: "Client Charter",
      title: `Charter #${charterGap.no} at ${charterGap.score}% (${q})`,
      detail: `${pledge}. MPP published achievement, updated ${upd}.`,
      humanContext: "Source: MPP Client Charter Achievement page. The council's own number, not this board's estimate.",
    }, {
      owner: "Piagam Pelanggan",
      title: `Piagam #${charterGap.no} pada ${charterGap.score}% (${q})`,
      detail: `${pledge}. Pencapaian diterbitkan MPP, dikemas kini ${upd}.`,
      humanContext: "Sumber: halaman Pencapaian Piagam Pelanggan MPP. Angka majlis sendiri, bukan anggaran papan ini.",
    }, {
      owner: "客户服务承诺",
      title: `承诺第 ${charterGap.no} 项达成 ${charterGap.score}%（${q}）`,
      detail: `${pledge}。MPP 公布的达成率，更新于 ${upd}。`,
      humanContext: "来源：MPP 客户服务承诺达成页面。这是市议会公布的数字，不是本看板的估算。",
    }));
  }

  // Rain on a high tide: Kuching's river floods worst when heavy rain meets a
  // high tide that slows the outflow. Fires only when both are present.
  const highSoon = tide?.status === "live" ? (tide.highs || []).find((h) => Date.parse(h.t) - Date.now() <= 12 * 3600 * 1000 && h.v >= tide.topThird) : null;
  if (highSoon && rain6h >= 5) {
    const at = new Date(highSoon.t).toLocaleTimeString("en-MY", { timeZone: "Asia/Kuching", hour: "2-digit", minute: "2-digit" });
    const lv = highSoon.v.toFixed(2);
    items.push(withI18n({
      severity: "medium",
      owner: "Tide Watch",
      title: `Rain on a high tide · ${at}`,
      detail: `${rain6h} mm forecast in 6 h while the sea level at the Sarawak River mouth peaks near ${lv} m (model) at ${at}. Low-lying tidal reaches drain slowly at high water; keep crews on the waterfront and Sg. Maong outfalls through the peak.`,
      humanContext: "Tide from the Open-Meteo marine model, not the JUPEM gauge. Check the official tide table for exact times.",
    }, {
      owner: "Pemantauan Pasang Surut",
      title: `Hujan semasa air pasang · ${at}`,
      detail: `${rain6h} mm diramal dalam 6 jam ketika paras laut di muara Sungai Sarawak memuncak sekitar ${lv} m (model) pada ${at}. Kawasan rendah berpasang surut lambat surut ketika air pasang; kekalkan pasukan di tebingan dan saluran keluar Sg. Maong sepanjang puncak.`,
      humanContext: "Pasang surut daripada model marin Open-Meteo, bukan tolok JUPEM. Semak jadual pasang surut rasmi untuk masa tepat.",
    }, {
      owner: "潮汐监测",
      title: `高潮时降雨 · ${at}`,
      detail: `预计 6 小时内降雨 ${rain6h} mm，同时砂拉越河口海平面约于 ${at} 达到 ${lv} m（模型）。高潮时低洼感潮河段排水缓慢；高峰期间请在河滨及 Sg. Maong 出水口保留人员。`,
      humanContext: "潮汐来自 Open-Meteo 海洋模型，不是 JUPEM 潮位站。确切时间请查官方潮汐表。",
    }));
  }

  // Hydrology directive — escalates from ground-truth river levels.
  if (infobanjir?.highestBand && !["normal", "reference"].includes(infobanjir.highestBand)) {
    const triggered = infobanjir.stations.filter((s) => ["alert", "warning", "danger"].includes(s.band));
    const triggerLine = triggered.map((s) => `${s.name} (${s.bandLabel} ${s.waterLevelM ?? "—"}m)`).join(", ");
    const worst = triggered[0];
    const bandMs = { alert: "WASPADA", warning: "AMARAN", danger: "BAHAYA" }[infobanjir.highestBand] || infobanjir.highestBandLabel.toUpperCase();
    const bandZh = { alert: "警戒", warning: "警告", danger: "危险" }[infobanjir.highestBand] || infobanjir.highestBandLabel;
    items.push(withI18n({
      severity: "high",
      owner: "Hydrology Watch",
      title: `River posture ${infobanjir.highestBandLabel.toUpperCase()}`,
      detail: `JPS Infobanjir: ${triggerLine || "watch the upper Sarawak basin"}. Cross-reference rain forecast (${rain6h}mm/6h).`,
      humanContext: worst?.humanBrief || [worst?.affectedEstimate, worst?.lastEvent].filter(Boolean).join(". ") || null,
    }, {
      owner: "Pemantauan Hidrologi",
      title: `Status sungai ${bandMs}`,
      detail: `JPS Infobanjir: ${triggerLine || "pantau lembangan hulu Sarawak"}. Semak bersama ramalan hujan (${rain6h}mm/6j).`,
    }, {
      owner: "水文监测",
      title: `河流状态：${bandZh}`,
      detail: `JPS Infobanjir：${triggerLine || "留意砂拉越河上游流域"}。请对照降雨预报（${rain6h}mm/6小时）。`,
    }));
  }

  // IOC 2.0/2.1 — forecast-driven directives. TimesFM p90 worst-case lookahead
  // turns the board from "what's happening" into "what's coming". Thresholds are
  // deliberately conservative — fires only when the worst-case curve escalates
  // meaningfully (Nonism §12.5: surface worst case, act on lead time, don't alarm).
  //
  // Audit #8: a stale forecast (server-side marked >48h old or p90 derived from
  // an outdated lastValue) MUST NOT generate "Do this today" directives. A STALE
  // badge on a separate panel does not protect downstream action advice; suppress
  // here instead of relying on the renderer to skip the item.
  const forecastFresh = forecast && forecast.status === "live" && forecast.series;
  if (forecastFresh) {
    const dis = forecast.series.river_discharge;
    if (Array.isArray(dis?.quantiles?.p90) && dis.quantiles.p90.length) {
      const peak = Math.max(...dis.quantiles.p90);
      const now = dis.lastValue ?? dis.quantiles.p50?.[0] ?? 0;
      const step = dis.quantiles.p90.indexOf(peak) + 1;
      if (now > 0 && peak >= now * 1.2) {
        const pk = Math.round(peak), nw = Math.round(now);
        items.push(withI18n({
          severity: peak >= now * 1.5 ? "high" : "medium",
          owner: "Hydrology Forecast",
          title: `River rising — p90 ${pk} m³/s in ${step}d`,
          detail: `TimesFM 14-day outlook: worst-case discharge climbs from ${nw} to ${pk} m³/s within ${step} day(s). Pre-position crews at Batu Kawa / Sg. Maong before the peak.`,
          humanContext: "The forecast lead time is the window to act — clear the worst drains before the rain, not during it.",
        }, {
          owner: "Ramalan Hidrologi",
          title: `Sungai meningkat — p90 ${pk} m³/s dalam ${step} hari`,
          detail: `Tinjauan 14 hari TimesFM: aliran terburuk naik dari ${nw} ke ${pk} m³/s dalam ${step} hari. Tempatkan pasukan di Batu Kawa / Sg. Maong sebelum puncak.`,
          humanContext: "Tempoh amaran ramalan ialah masa untuk bertindak — bersihkan longkang terburuk sebelum hujan, bukan semasa hujan.",
        }, {
          owner: "水文预报",
          title: `河流上涨 — p90 ${pk} m³/s，${step} 天内`,
          detail: `TimesFM 14天展望：最坏情况流量在 ${step} 天内由 ${nw} 升至 ${pk} m³/s。请在峰值前于 Batu Kawa / Sg. Maong 预置人员。`,
          humanContext: "预报提前量就是行动窗口——在下雨前清理最差的排水渠，而不是下雨时。",
        }));
      }
    }
    const aqiF = forecast.series.aqi;
    if (Array.isArray(aqiF?.quantiles?.p90) && aqiF.quantiles.p90.length) {
      const peak = Math.max(...aqiF.quantiles.p90);
      if (peak >= 100) {
        const step = aqiF.quantiles.p90.indexOf(peak) + 1;
        const pk = Math.round(peak);
        items.push(withI18n({
          severity: peak >= 150 ? "high" : "medium",
          owner: "Health Forecast",
          title: `Air quality may degrade — p90 AQI ${pk} in ${step}d`,
          detail: `TimesFM outlook: worst-case AQI reaches ${pk} within ${step} day(s). Stage a haze advisory for sensitive groups; check NASA FIRMS hotspots for open burning.`,
          humanContext: null,
        }, {
          owner: "Ramalan Kesihatan",
          title: `Kualiti udara mungkin merosot — p90 IKU ${pk} dalam ${step} hari`,
          detail: `Tinjauan TimesFM: IKU terburuk mencecah ${pk} dalam ${step} hari. Sediakan nasihat jerebu untuk golongan sensitif; semak titik panas NASA FIRMS untuk pembakaran terbuka.`,
        }, {
          owner: "健康预报",
          title: `空气质量可能恶化 — p90 指数 ${pk}，${step} 天内`,
          detail: `TimesFM 展望：最坏情况空气质量指数在 ${step} 天内达到 ${pk}。请为敏感人群准备烟霾提醒，并查看 NASA FIRMS 热点有无露天焚烧。`,
        }));
      }
    }
  }

  // IOC 2.1 — flood risk matrix directives (AMC + per-station p90 forecast).
  // Only fires for "alert" or "warning" level to avoid alarm fatigue.
  if (floodMatrix?.rows?.length) {
    const amcClass  = floodMatrix.basin_amc?.class || "I";
    const amcLabel  = floodMatrix.basin_amc?.label || "";
    const amcNote   = floodMatrix.basin_amc?.note || "";
    if (amcClass === "III") {
      const mm14 = floodMatrix.basin_amc?.total_mm14d ?? "—";
      items.push(withI18n({
        severity: "medium",
        owner: "Basin AMC Watch",
        title: `Catchment saturated — AMC Class III (${mm14}mm/14d)`,
        detail: `14-day accumulated rainfall has saturated the basin. ${amcNote} Pre-position drainage crews and review pump station readiness in the affected catchments.`,
        humanContext: "AMC III means the same rainstorm that would normally cause minor flooding will cause major flooding. Act before the next band arrives.",
      }, {
        owner: "Pemantauan AMC Lembangan",
        title: `Tadahan tepu — AMC Kelas III (${mm14}mm/14 hari)`,
        detail: "Hujan terkumpul 14 hari telah menepukan lembangan. Tempatkan pasukan saliran dan semak kesiapsiagaan stesen pam di tadahan yang terjejas.",
        humanContext: "AMC III bermaksud ribut yang biasanya menyebabkan banjir kecil kini boleh menyebabkan banjir besar. Bertindak sebelum jalur hujan seterusnya.",
      }, {
        owner: "流域前期湿度监测",
        title: `集水区已饱和 — AMC 第三级（${mm14}mm/14天）`,
        detail: "14天累计降雨已使流域饱和。请预置排水人员，并检查受影响集水区的抽水站准备情况。",
        humanContext: "AMC 第三级表示平常只造成小水灾的暴雨，现在可能造成大水灾。请在下一轮雨带到来前行动。",
      }));
    }
    // Station-level warning / alert directives
    for (const row of floodMatrix.rows) {
      const highest = [row.risk_6h, row.risk_24h, row.risk_72h]
        .reduce((w, r) => {
          const order = ["normal", "watch", "alert", "warning"];
          return r && order.indexOf(r.band) > order.indexOf(w?.band || "normal") ? r : w;
        }, null);
      if (!highest || !["alert", "warning"].includes(highest.band)) continue;
      const horizon = highest === row.risk_6h ? "6h" : highest === row.risk_24h ? "24h" : "72h";
      const stressNote = row.drainage_stress === "high"
        ? ` High impervious fraction (${Math.round((row.impervious_fraction || 0) * 100)}%) — drainage infrastructure may be undersized for current land cover.`
        : "";
      const lagNote = row.lag_h > 0
        ? ` (${row.lag_h}h propagation lag to downstream gauges)`
        : "";
      const hz = horizon.replace("h", "");
      items.push(withI18n({
        severity: highest.band === "warning" ? "high" : "medium",
        owner: `Flood Forecast // ${row.name}`,
        title: `${row.name}: ${highest.band.toUpperCase()} within ${horizon}`,
        detail: `TimesFM p90 + AMC ${amcClass} load index ${highest.load}. Catchment: ${row.basin}.${lagNote}${stressNote}`,
        humanContext: row.amc ? `${row.amc.label} catchment (${row.amc.total_mm14d}mm/14d). ${row.amc.note}` : null,
      }, {
        owner: `Ramalan Banjir // ${row.name}`,
        title: `${row.name}: ${highest.band === "warning" ? "AMARAN" : "WASPADA"} dalam ${hz} jam`,
        detail: `TimesFM p90 + AMC ${amcClass}, indeks beban ${highest.load}. Tadahan: ${row.basin}.${row.lag_h > 0 ? ` (sela ${row.lag_h} jam ke tolok hilir)` : ""}${row.drainage_stress === "high" ? ` Pecahan permukaan kedap tinggi (${Math.round((row.impervious_fraction || 0) * 100)}%) — saliran mungkin terlalu kecil untuk guna tanah semasa.` : ""}`,
      }, {
        owner: `洪水预报 // ${row.name}`,
        title: `${row.name}：${hz} 小时内${highest.band === "warning" ? "警告" : "警戒"}`,
        detail: `TimesFM p90 + AMC ${amcClass}，负荷指数 ${highest.load}。集水区：${row.basin}。${row.lag_h > 0 ? `（向下游水位站传播滞后 ${row.lag_h} 小时）` : ""}${row.drainage_stress === "high" ? `硬化地表比例高（${Math.round((row.impervious_fraction || 0) * 100)}%）——排水设施可能不足以应对现有土地覆盖。` : ""}`,
      }));
    }
    // Drainage stress directive (AlphaEarth-driven): stations where high impervious
    // fraction + elevated risk = likely under-drained for current land cover.
    const stressStations = floodMatrix.rows.filter(
      (r) => r.drainage_stress === "high" && r.risk_72h?.band !== "normal"
    );
    if (stressStations.length && floodMatrix.impervious_status === "ready") {
      const names = stressStations.map((s) => s.name).join(", ");
      items.push(withI18n({
        severity: "medium",
        owner: "AlphaEarth // Drainage Stress",
        title: `${stressStations.length} catchment(s) under drainage stress`,
        detail: `AlphaEarth 2024 analysis: ${names} show high impervious surface fraction but elevated flood risk. New land cover may exceed existing drain capacity.`,
        humanContext: "Hardened ground sends rain to the drains faster. Check these catchments first when rain is forecast.",
      }, {
        owner: "AlphaEarth // Tekanan Saliran",
        title: `${stressStations.length} tadahan di bawah tekanan saliran`,
        detail: `Analisis AlphaEarth 2024: ${names} menunjukkan pecahan permukaan kedap yang tinggi dan risiko banjir meningkat. Guna tanah baharu mungkin melebihi kapasiti longkang sedia ada.`,
        humanContext: "Tanah yang keras menghantar hujan ke longkang dengan lebih cepat. Semak tadahan ini dahulu apabila hujan diramalkan.",
      }, {
        owner: "AlphaEarth // 排水压力",
        title: `${stressStations.length} 个集水区排水压力偏高`,
        detail: `AlphaEarth 2024 分析：${names} 硬化地表比例高，洪水风险上升。新的土地覆盖可能超出现有排水能力。`,
        humanContext: "硬化地面使雨水更快流入排水渠。预报有雨时，请优先检查这些集水区。",
      }));
    }
  }

  // MET Malaysia active weather warnings.
  if (metWarnings?.activeCount > 0) {
    const w = metWarnings.items[0];
    items.push(withI18n({
      severity: "high",
      owner: "MET Malaysia",
      title: w.heading || "Active Weather Warning",
      detail: `${w.text || "Official MET warning active for Sarawak/Kuching region."} Valid until ${w.validTo ? new Date(w.validTo).toLocaleString("en-MY", { timeZone: "Asia/Kuching", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}.`,
      humanContext: metWarnings.activeCount > 1 ? `${metWarnings.activeCount} concurrent warnings active.` : null,
    }, {
      title: w.headingBm || w.heading || "Amaran cuaca aktif",
      detail: w.textBm ? `${w.textBm} Sah sehingga ${w.validTo ? new Date(w.validTo).toLocaleString("ms-MY", { timeZone: "Asia/Kuching", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}.` : undefined,
      humanContext: metWarnings.activeCount > 1 ? `${metWarnings.activeCount} amaran serentak aktif.` : null,
    }, {
      humanContext: metWarnings.activeCount > 1 ? `${metWarnings.activeCount} 项警报同时生效。` : null,
    }));
  }

  // Proactive Flood Directive
  if (metWarnings?.forecast?.hasRain || rain6h >= 5) {
    const fcText = metWarnings?.forecast?.text || `${rain6h}mm / 6h`;
    items.push(withI18n({
      severity: "high",
      owner: "Flood Command",
      title: `Pre-emptive drain clearance: ${fcText}`,
      detail: `MET Malaysia indicates ${fcText}. Projected rainfall ${rain6h}mm. Focus on Penrissen and Batu Kawa sectors.`,
      humanContext: "Sg. Maong is the first urban drain to back up. Watch the Kuala Maong gauge against its 2.0 m alert level.",
    }, {
      owner: "Arahan Banjir",
      title: `Pembersihan longkang awal: ${fcText}`,
      detail: `MET Malaysia menunjukkan ${fcText}. Unjuran hujan ${rain6h}mm. Utamakan sektor Penrissen dan Batu Kawa.`,
      humanContext: "Sg. Maong ialah longkang bandar pertama yang melimpah. Pantau tolok Kuala Maong berbanding paras waspada 2.0 m.",
    }, {
      owner: "防洪指挥",
      title: `提前清理排水渠：${fcText}`,
      detail: `MET Malaysia 显示 ${fcText}。预计降雨 ${rain6h}mm。重点关注 Penrissen 与 Batu Kawa 区域。`,
      humanContext: "Sg. Maong 是最先回涌的市区排水渠。请对照 2.0 m 警戒水位留意 Kuala Maong 水位站。",
    }));
  }

  // Demographic Intelligence Directive

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
      const [warningData, forecastData] = await Promise.allSettled([
        fetchJson("https://api.data.gov.my/weather/warning/", 8000),
        fetchJson("https://api.data.gov.my/weather/forecast?contains=Kuching@location__location_name", 8000)
      ]);

      // A rejected/malformed warning request is unknown, never zero warnings.
      return normalizeMetWeather(
        warningData.status === "fulfilled" ? warningData.value : null,
        forecastData.status === "fulfilled" ? forecastData.value : null,
      );
    } catch {
      return normalizeMetWeather(null, null);
    }
  });
}

async function loadFloodForecast() {
  return cached("flood-forecast", 6 * 60 * 60 * 1000, async () => {
    // Multi-point GloFAS: city centre + Padawan focus + lower-basin tributaries
    // (water ignores council lines). Ensemble band (min / mean / max) gives
    // operators a confidence spread — a tight band is a "low uncertainty"
    // forecast; a wide band means the model is hedging on a real risk.
    const points = [
      { id: "kuching", label: "Sarawak River at Kuching", lat: 1.5533, lon: 110.3592 },
      { id: "batu-kitang", label: "Batu Kitang (Padawan)", lat: 1.4524, lon: 110.2823 },
      { id: "batu-kawa", label: "Batu Kawa Bridge", lat: 1.5087, lon: 110.2703 },
      // Lower urban reaches where flooding shows up first at street level.
      { id: "sg-maong", label: "Sg. Maong confluence (Kuching)", lat: 1.5450, lon: 110.3680 },
      { id: "astana", label: "Jln Astana / Waterfront", lat: 1.5500, lon: 110.3700 },
      // Upper-basin rainfall signal ~4–6 h upstream of Batu Kitang.
      { id: "kpg-git", label: "Kpg. Git (upper Sg. Sarawak)", lat: 1.3555, lon: 110.2667 },
    ];
    try {
      const results = await Promise.all(points.map(async (p) => {
        const url = `https://flood-api.open-meteo.com/v1/flood?latitude=${p.lat}&longitude=${p.lon}`
          + `&daily=river_discharge,river_discharge_min,river_discharge_max,river_discharge_mean`
          + `&forecast_days=10&models=seamless_v4`;
        // One retry on transient failure. A point that still fails after
        // the retry returns null so partial coverage survives — the upper
        // Sarawak basin can still see the lower-basin forecast even if the
        // Sg. Maong call times out. A full outage is the only path that
        // triggers the outer catch and the whole-basin fallback.
        let data = null;
        try { data = await fetchJson(url, 12000); }
        catch { await new Promise((r) => setTimeout(r, 1500)); try { data = await fetchJson(url, 15000); } catch { /* leave null */ } }
        if (!data) return null;
        const dates = data.daily?.time ?? [];
        const dis = data.daily?.river_discharge ?? [];
        const min = data.daily?.river_discharge_min ?? [];
        const max = data.daily?.river_discharge_max ?? [];
        const mean = data.daily?.river_discharge_mean ?? [];
        return {
          ...p,
          forecast: dates.map((d, i) => ({
            date: d,
            dischargeCms: round(dis[i] ?? null, 1),
            minCms: round(min[i] ?? null, 1),
            maxCms: round(max[i] ?? null, 1),
            meanCms: round(mean[i] ?? null, 1),
          })),
          // Peak computed off the ensemble max so a single high-member
          // doesn't get averaged away — operators want the worst case.
          peakCms: max.length ? round(Math.max(...max.filter((v) => v != null)), 1) : null,
          todayCms: round(dis[0] ?? null, 1),
          spreadCms: max.length && min.length
            ? round((max.find((v) => v != null) ?? 0) - (min.find((v) => v != null) ?? 0), 1)
            : null,
        };
      }));
      // Drop null points (full point-level failure) and decide live vs
      // partial. Partial coverage is honest: the operator sees the reaches
      // that did respond, with the ones that didn't dropped from the rail.
      const okResults = results.filter((r) => r !== null);
      if (!okResults.length) {
        // All points failed twice — the outer try/catch returns the full
        // fallback. This branch is unreachable in practice but keeps the
        // type checker happy if the inner retry ever stops throwing.
        return null;
      }
      const primary = okResults.find((r) => r.id === "kuching") || okResults[0];
      // Live if every requested point responded; "partial" if at least one
      // responded. The dashboard tells the user which reaches are missing
      // from the rail instead of pretending the whole basin is ungauged.
      const requested = points.length;
      const reached = okResults.length;
      return {
        status: reached === requested ? "live" : "partial",
        updatedAt: nowIso(),
        station: primary.label,
        units: "m³/s",
        model: "GloFAS seamless v4 via Open-Meteo (50-member ensemble)",
        forecast: primary.forecast,
        peakCms: primary.peakCms,
        todayCms: primary.todayCms,
        reaches: okResults.map((r) => ({
          id: r.id, label: r.label, lat: r.lat, lon: r.lon,
          todayCms: r.todayCms, peakCms: r.peakCms, spreadCms: r.spreadCms,
        })),
        // Surface which points were asked for and which did not respond,
        // so a "partial" status is honest about its own gap.
        missingReaches: points.filter((p) => !okResults.find((r) => r.id === p.id)).map((p) => p.id),
      };
    } catch {
      return {
        status: "fallback",
        updatedAt: nowIso(),
        station: "Sarawak River at Kuching",
        units: "m³/s",
        model: "unreachable",
        // No invented discharge: an unreachable model shows "—", not a curve.
        forecast: [],
        peakCms: null,
        todayCms: null,
        reaches: [],
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
      chairman: redactPerson(doc.chairman),
      deputy: redactPerson(doc.deputy),
      wards: (doc.wards || []).map((ward) => ({
        ...ward,
        councillors: (ward.councillors || []).map(redactPerson),
      })),
      totals: doc.totals,
      notes: doc.notes,
      contacts: "withheld",
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
    const totals = { ...(doc.totals || {}) };
    totals.residential = null;
    totals.commercial = null;
    totals.industrial = null;
    totals.exempted = null;
    return {
      status: "official",
      updatedAt: doc.generatedAt || nowIso(),
      source: doc.source,
      propertyUsage: "withheld",
      items: (doc.items || []).map(redactLocality),
      totals,
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

// IOC 2.0 — TimesFM forecast. Read the static, locally-generated forecast.json
// (scripts/forecast/forecast_runner.py). Never inferred at request time. If the
// file is missing (fresh clone / forecaster not yet run) the dashboard degrades
// to BASELINE in the client. Age >48h is flagged "stale".
async function loadForecast() {
  return cached("forecast", 60_000, async () => {
    const raw = await fs.readFile(path.join(publicDir, "api", "forecast.json"), "utf-8");
    const doc = JSON.parse(raw);
    const parsed = doc.asOf ? Date.parse(doc.asOf) : NaN;
    const ageMs = Number.isFinite(parsed) ? Date.now() - parsed : Infinity;
    return {
      status: ageMs < 48 * 3600_000 ? "live" : "stale",
      asOf: doc.asOf || null,
      model: doc.model || "timesfm",
      horizon: doc.horizon || 0,
      frequency: doc.frequency || "D",
      site: doc.site || null,
      series: doc.series || {},
      // IOC 2.1 flood additions — present when forecast_runner.py has been updated
      stations: doc.stations || {},
      basin_amc: doc.basin_amc || null,
    };
  }).catch(() => ({ status: "absent", series: {}, stations: {}, basin_amc: null }));
}

// IOC 2.1 — AlphaEarth impervious surface fraction per sub-catchment.
// Written by scripts/alphaearth/compute_impervious.py (annual run, local only).
async function loadImperviousData() {
  return cached("impervious", 3600_000, async () => {
    const jsonPath = path.join(publicDir, "data", "alphaearth", "impervious.json");
    const doc = JSON.parse(await fs.readFile(jsonPath, "utf-8"));
    return {
      status: "ready",
      year: doc.year || 2024,
      image: `data/alphaearth/${doc.image}`,
      bounds: doc.bounds,
      stats: doc.stats,
      zones: doc.zones || [],
      dataset: doc.dataset,
    };
  }).catch(() => ({ status: "absent", zones: [] }));
}

// IOC 2.1 — Combine per-station AMC + forecast p90 + impervious fraction
// into a per-station flood risk matrix. Surfaced as payload.floodMatrix.
function buildFloodRiskMatrix(forecast, imperviousData) {
  const fStations = forecast?.stations || {};
  const zones = (imperviousData?.zones || []);

  // Build a lookup: station id → impervious fraction (from nearest zone)
  const imperviousByStation = {};
  for (const zone of zones) {
    if (zone.station && !imperviousByStation[zone.station]) {
      imperviousByStation[zone.station] = zone.impervious_fraction;
    }
  }

  const STATION_ORDER = ["batu-kitang", "kpg-git", "siniawan", "maong", "buntal", "bedup"];
  const rows = STATION_ORDER.map((sid) => {
    const stn = fStations[sid];
    if (!stn) return null;
    const impFrac = imperviousByStation[sid] ?? null;

    // Drainage stress: high impervious fraction + high risk = under-drained
    const highestRisk = [stn.risk_72h, stn.risk_24h, stn.risk_6h].reduce((worst, r) => {
      const order = ["normal", "watch", "alert", "warning"];
      return order.indexOf(r?.band || "normal") > order.indexOf(worst) ? (r?.band || "normal") : worst;
    }, "normal");
    const drainageStress = impFrac != null && impFrac > 0.5 && highestRisk !== "normal"
      ? "high"
      : impFrac != null && impFrac > 0.3 && ["alert", "warning"].includes(highestRisk)
      ? "moderate"
      : "low";

    return {
      id:   sid,
      name: stn.name,
      basin: stn.basin,
      lag_h: stn.lag_h,
      amc:  stn.amc || null,
      risk_6h:  stn.risk_6h  || null,
      risk_24h: stn.risk_24h || null,
      risk_72h: stn.risk_72h || null,
      impervious_fraction: impFrac,
      drainage_stress:     drainageStress,
      p90_day1: stn.cumulative_p90_mm?.day1 ?? null,
      p90_day4: stn.cumulative_p90_mm?.day4 ?? null,
    };
  }).filter(Boolean);

  const basinAmc = forecast?.basin_amc || null;
  const forecastStatus = forecast?.status || "absent";
  const worstBand = rows.reduce((worst, r) => {
    const order = ["normal", "watch", "alert", "warning"];
    const bands = [r.risk_6h?.band, r.risk_24h?.band, r.risk_72h?.band].filter(Boolean);
    const max = bands.reduce((w, b) => order.indexOf(b) > order.indexOf(w) ? b : w, "normal");
    return order.indexOf(max) > order.indexOf(worst) ? max : worst;
  }, "normal");

  return {
    status: forecastStatus,
    asOf:   forecast?.asOf || null,
    basin_amc: basinAmc,
    worst_band: worstBand,
    rows,
    impervious_status: imperviousData?.status || "absent",
  };
}

// IOC 2.2 — Citizen Reports from City Reporter Supabase.
// Queries reports within the Greater Kuching bounding box.
// Falls back to synthetic demo data when no credentials or no live reports.
// No report feed → say so. The previous fallback generated six invented
// complaints that were pinned on the live map (audit 13 Oct 2026).
function cityReportsNotConnected(reason = "not-connected") {
  return { status: reason, count: 0, open: 0, resolved: 0, recent: [], updatedAt: nowIso(),
    note: "No citizen report feed is connected. MPP complaints go through Talikhidmat (talikhidmat.sarawak.gov.my)." };
}

// ---------------------------------------------------------------------------
// Water supply context (audit 13 Oct 2026). Sarawak Water / LAKU / JBALB sites
// sit behind Cloudflare challenges and publish no machine-readable notices, so
// the board says so and links out. What IS public: DID iHYDRO's Batu Kitang
// Telemetry gauge (station 101002, the river reach at the Batu Kitang intake)
// with official thresholds, and DID's urban Intelligent Gauges in Kuching.
// ---------------------------------------------------------------------------
const IHYDRO_BASE = "https://ihydro.sarawak.gov.my/iHydro/en";

function parseIhydroChart(html) {
  const xml = /setXMLData\("([\s\S]+?)"\);/.exec(html)?.[1];
  if (!xml) return null;
  const caption = /Caption='([^']*)'/.exec(xml)?.[1]?.replace(/,\s*$/, "") || null;
  const cats = Array.from(xml.matchAll(/<category[^>]*label='([^']*)'/g), (m) => m[1]);
  const sets = Array.from(xml.matchAll(/<dataset([^>]*)>([\s\S]*?)<\/dataset>/g), (m) => ({
    name: /seriesname='([^']*)'/.exec(m[1])?.[1] || "",
    values: Array.from(m[2].matchAll(/value='([^']*)'/g), (v) => (v[1] === "" ? null : Number(v[1]))),
  }));
  const series = sets[0];
  if (!series || !cats.length) return null;
  const thresholds = {};
  for (const set of sets.slice(1)) {
    const m = /^(Normal|Alert|Warning|Danger)\s*\(([\d.]+)\s*m\)/i.exec(set.name);
    if (m) thresholds[m[1].toLowerCase()] = Number(m[2]);
  }
  const toIso = (label) => {
    const m = /^(\d{2})-(\d{2})-(\d{4})\s+(\d{2}):(\d{2})/.exec(label);
    return m ? `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:00+08:00` : null;
  };
  const points = cats.map((c, i) => ({ t: toIso(c), v: Number.isFinite(series.values[i]) ? series.values[i] : null }));
  const valid = points.filter((p) => p.v != null);
  const latest = valid.at(-1) || null;
  // Keep every 4th reading (~4-hourly over 7 days) plus the latest.
  const sampled = points.filter((_, i) => i % 4 === 0);
  if (latest && sampled.at(-1) !== latest) sampled.push(latest);
  return { station: series.name || caption, caption, points: sampled, latest, thresholds,
    min: valid.length ? Math.min(...valid.map((p) => p.v)) : null, max: valid.length ? Math.max(...valid.map((p) => p.v)) : null };
}

function parseIntelligentGauges(html) {
  return htmlTableRows(html)
    .filter((r) => /^\d+\.?$/.test(r[0]) && /kuching|samarahan|serian/i.test(r[2] || ""))
    .map((r) => ({ name: r[1], division: r[2], updated: r[3] || null, levelM: r[4] !== "" && r[4] != null ? Number(r[4]) : null,
      alertM: r[5] ? Number(r[5]) : null, warningM: r[6] ? Number(r[6]) : null, dangerM: r[7] ? Number(r[7]) : null }));
}

async function loadWaterSupply() {
  return cached("water-supply", 30 * 60 * 1000, async () => {
    const chartUrl = `${IHYDRO_BASE}/graph/waterlevel-graph-single.jsp?station=101002`;
    const igUrl = `${IHYDRO_BASE}/datatable/ig/latest-iglevel.jsp`;
    const [chart, ig] = await Promise.allSettled([
      fetchText(chartUrl, 20000, BROWSER_UA).then(parseIhydroChart),
      fetchText(igUrl, 15000, BROWSER_UA).then(parseIntelligentGauges),
    ]);
    const intake = chart.status === "fulfilled" ? chart.value : null;
    const gauges = ig.status === "fulfilled" ? ig.value : null;
    return {
      status: intake || gauges ? "live" : "unavailable",
      updatedAt: nowIso(),
      intake: intake ? { ...intake, url: chartUrl, note: "River level at the Batu Kitang intake reach (Sungai Sarawak). DID gauge, not a treatment-plant or supply reading." } : { status: "unavailable", url: chartUrl },
      gauges: gauges ? { items: gauges, url: igUrl } : { status: "unavailable", url: igUrl },
      utility: {
        name: "Sarawak Water (formerly Kuching Water Board)",
        status: "not-public",
        url: "https://sarawakwater.com/",
        note: "Supply-interruption notices and dam levels are not published in a machine-readable form; check the utility directly.",
      },
    };
  }).catch(() => ({ status: "unavailable", updatedAt: nowIso() }));
}

// DOSM district population. The data.gov.my API index for population_district
// is empty (checked 13 Oct 2026); DOSM's own CSV is current. Values in thousands.
// Siburan was split from Serian from 2025 — Serian's drop is that split.
const DOSM_DISTRICT_CSV = "https://storage.dosm.gov.my/population/population_district.csv";
const DOSM_DISTRICTS = ["Kuching", "Samarahan", "Serian", "Siburan"];

async function loadDistrictPopulation() {
  return cached("dosm-districts", 24 * 60 * 60 * 1000, async () => {
    const csv = await fetchText(DOSM_DISTRICT_CSV, 90000);
    const latest = new Map();
    for (const line of csv.split("\n")) {
      if (!line.startsWith("Sarawak,")) continue;
      const [, district, date, sex, age, ethnicity, population] = line.split(",");
      if (!DOSM_DISTRICTS.includes(district) || sex !== "both" || age !== "overall" || ethnicity !== "overall") continue;
      const prev = latest.get(district);
      if (!prev || date > prev.date) latest.set(district, { date, population: Number(population) });
    }
    return DOSM_DISTRICTS.map((name) => {
      const row = latest.get(name);
      return row && Number.isFinite(row.population)
        ? { name, status: "live", population: Math.round(row.population * 1000), year: row.date.slice(0, 4) }
        : { name, status: "missing" };
    });
  }).catch(() => DOSM_DISTRICTS.map((name) => ({ name, status: "missing" })));
}

// Rain regime: is today's rain monsoon-driven, a tropical system, or local
// convection? Rule-based and labelled as such. Inputs: JMA RSMC Tokyo active
// cyclones, MetMalaysia's tropical-cyclone advisory, and Open-Meteo model
// pressure + 850 hPa wind at Kuching and a South China Sea point.
const KUCHING_LL = [1.55, 110.35];

async function loadRainRegime() {
  return cached("rain-regime", 60 * 60 * 1000, async () => {
    const [tcList, warnings, om] = await Promise.allSettled([
      fetchJson("https://www.jma.go.jp/bosai/typhoon/data/targetTc.json", 12000),
      fetchJson("https://api.data.gov.my/weather/warning/?limit=50", 12000),
      // api.open-meteo.com intermittently refuses shared CI runner IPs; back off and retry.
      (async () => {
        const url = RAIN_REGIME_OPEN_METEO_URL;
        for (let attempt = 0; ; attempt += 1) {
          try { return await fetchJson(url, 15000); }
          catch (err) { if (attempt >= 2) throw err; await new Promise((r) => setTimeout(r, 3000 * (attempt + 1))); }
        }
      })(),
    ]);
    const cyclones = [];
    if (tcList.status === "fulfilled" && Array.isArray(tcList.value)) {
      for (const tc of tcList.value.slice(0, 6)) {
        try {
          const spec = await fetchJson(`https://www.jma.go.jp/bosai/typhoon/data/${tc.tropicalCyclone}/specifications.json`, 12000);
          const now = (Array.isArray(spec) ? spec : []).find((x) => x?.position?.deg);
          if (!now) continue;
          const [lat, lon] = now.position.deg;
          cyclones.push({ id: tc.tropicalCyclone, name: `TC ${tc.typhoonNumber || tc.tropicalCyclone}`, category: now.category?.en || tc.category, lat, lon,
            pressureHpa: Number(now.pressure) || null, validTime: now.validtime?.UTC || null, distanceKm: Math.round(kmBetween(KUCHING_LL[0], KUCHING_LL[1], lat, lon)) });
        } catch { /* skip one cyclone */ }
      }
    }
    const advisory = warnings.status === "fulfilled" && Array.isArray(warnings.value)
      ? warnings.value.find((w) => /tropical cyclone|ribut tropika|no advisory/i.test(`${w?.warning_issue?.title_en} ${w?.text_en}`)) : null;
    const [kuching, scs] = summariseOpenMeteo(om.status === "fulfilled" ? om.value : null);
    const inputsOk = (tcList.status === "fulfilled" || warnings.status === "fulfilled") && kuching && scs;
    const month = Number(new Date(Date.now() + 8 * 3600000).toISOString().slice(5, 7));
    const mmdTitle = advisory ? (advisory.warning_issue?.title_en || advisory.heading_en) : null;
    let result;
    if (inputsOk) {
      result = classifyRainRegime({ month, cyclones, mmdAdvisory: mmdTitle, kuching, scs });
    } else {
      // No wind data: still say what the cyclone feeds show. A tropical system
      // is detectable without wind; monsoon vs local convection is not.
      const partial = classifyRainRegime({ month, cyclones, mmdAdvisory: mmdTitle, kuching: null, scs: null });
      result = partial.label === "depression" ? partial : {
        label: "unknown", confidence: null, season: partial.season,
        evidence: [
          tcList.status === "fulfilled" || warnings.status === "fulfilled" ? "No tropical system within 1,500 km (JMA / MetMalaysia)" : "Cyclone feeds unreachable",
          "Wind data unreachable this cycle — monsoon vs local convection not assessed",
        ],
      };
    }
    return {
      status: inputsOk ? "live" : "partial",
      updatedAt: nowIso(),
      ...result,
      inputs: { kuching, scs, cyclones, mmdAdvisory: advisory ? { title: advisory.warning_issue?.title_en, text: advisory.text_en, issued: advisory.warning_issue?.issued } : null },
      method: "Rule-based (not a published algorithm): MetMalaysia TC advisory + JMA RSMC Tokyo positions; 24 h mean 850 hPa wind at Kuching and 12°N 112°E (NE ≥8 m/s from 0–90°, SW ≥5 m/s from 200–270°); calm (<5 m/s) = local convection. Model winds are Open-Meteo, not observations.",
      sources: [
        { name: "JMA RSMC Tokyo", url: "https://www.jma.go.jp/bosai/map.html#contents=typhoon" },
        { name: "MetMalaysia (data.gov.my)", url: "https://api.data.gov.my/weather/warning/" },
        { name: "Open-Meteo", url: "https://open-meteo.com/" },
      ],
    };
  }).catch(() => ({ status: "unavailable", label: "unknown", updatedAt: nowIso(), evidence: [] }));
}

// Who covers this place: MPP's published 2026 maintenance zones and the
// Trienekens refuse schedule. Company names and published area text only —
// contact persons and phone numbers (mostly personal mobiles) are dropped.
const PHONE_RE = /(?:HP\s*[:.]?\s*)?\(?\b0\d{1,3}[-\s]?\d{6,8}\b\)?/gi;
const scrubContact = (text) => String(text || "").replace(PHONE_RE, "").replace(/\s*;\s*$/, "").replace(/\s{2,}/g, " ").trim();

function parseMppDrainZones(html) {
  return htmlTableRows(html).filter((r) => /^\d+$/.test(r[0]) && /^PH\d+/i.test(r[1] || "")).map((r) => {
    const zone = /^(PH\d+)/i.exec(r[1])[1].toUpperCase();
    const areas = (/\((.*)\)/s.exec(r[1])?.[1] || r[1].replace(zone, "")).split(/,|;/).map((a) => a.trim()).filter(Boolean);
    return { zone, service: "drains-grass-sweeping", areas, contractor: scrubContact(r[2]) };
  });
}

function parseMppTreeZones(html) {
  return htmlTableRows(html).filter((r) => /^[TL]\d+$/i.test(r[0] || "")).map((r) => ({
    zone: r[0].toUpperCase(), service: "trees-landscape",
    areas: [scrubContact(r[1]).slice(0, 600)], contractor: scrubContact(String(r[2] || "").split(";")[0]),
  }));
}

function parseMppRefuseCodes(html) {
  return htmlTableRows(html).filter((r) => /^(PHH|PSC)\s?\S+/i.test(r[0] || "")).map((r) => ({
    zone: r[0].replace(/\s+/g, " ").trim(), service: "refuse", areas: [scrubContact(r[1]).slice(0, 600)], days: r[2] || null, contractor: "Trienekens",
  }));
}

async function loadMppCoverage() {
  return cached("mpp-coverage", 12 * 60 * 60 * 1000, async () => {
    const page = (id) => `${MPP_BASE}/web/subpage/webpage_view/${id}`;
    const [drain, trees, refuse] = await Promise.allSettled([
      fetchText(page(258), 15000).then(parseMppDrainZones),
      fetchText(page(257), 15000).then(parseMppTreeZones),
      fetchText(page(245), 15000).then(parseMppRefuseCodes),
    ]);
    const pick = (r, id) => (r.status === "fulfilled" && r.value.length ? { status: "live", url: page(id), items: r.value } : { status: "unavailable", url: page(id), items: [] });
    const out = { updatedAt: nowIso(), drain: pick(drain, 258), trees: pick(trees, 257), refuse: pick(refuse, 245) };
    out.status = [out.drain, out.trees, out.refuse].some((x) => x.status === "live") ? "live" : "unavailable";
    out.note = "Zones are MPP's own, not ward-aligned. Names only; contact numbers withheld — call MPP 082-615566 or use Talikhidmat.";
    return out;
  }).catch(() => ({ status: "unavailable", updatedAt: nowIso() }));
}

// JKM InfoBencana: open relief centres (PPS) for Sarawak, filtered to the
// Greater Kuching districts. The only verified public pin source with
// coordinates (13 Oct 2026). Empty list = no centre open, which is good news.
async function loadReliefCentres() {
  return cached("jkm-pps", 15 * 60 * 1000, async () => {
    const url = "https://infobencanajkmv2.jkm.gov.my/api/pusat-buka.php?a=13&b=0";
    const data = await fetchJson(url, 15000, BROWSER_UA);
    const points = Array.isArray(data?.points) ? data.points : null;
    if (!points) throw new Error("bad shape");
    const local = points.filter((p) => /kuching|samarahan|serian|siburan|padawan|bau/i.test(`${p.daerah} ${p.mukim}`))
      .map((p) => ({ id: p.id, name: p.name, lat: Number(p.latti), lon: Number(p.longi), district: p.daerah, disaster: p.bencana,
        evacuees: Number(p.mangsa) || 0, families: Number(p.keluarga) || 0, capacity: Number(p.kapasiti) || null }))
      .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon));
    return { status: "live", updatedAt: nowIso(), url: "https://infobencanajkmv2.jkm.gov.my/", sarawakOpen: points.length, items: local };
  }).catch(() => ({ status: "unavailable", updatedAt: nowIso(), url: "https://infobencanajkmv2.jkm.gov.my/", items: [] }));
}

// Regional fire detections (haze is regional first: Kuching's worst API
// episodes come from Kalimantan peat fires). NASA FIRMS publishes keyless
// 24 h VIIRS files per region; NOAA-20 has the densest coverage.
const FIRMS_SEA_24H = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv";
// Approximate Sarawak–Kalimantan border (west to east). Coarse on purpose and
// labelled as such: good enough to split "Kalimantan" from "Sarawak" counts.
const BORDER_APPROX = [[109.6, 1.95], [110.0, 1.65], [110.5, 1.05], [111.2, 1.15], [112.0, 1.35], [112.5, 1.5], [113.5, 1.4], [114.5, 1.9], [115.2, 2.6], [115.6, 4.3]];
function northOfBorder(lon, lat) {
  for (let i = 0; i < BORDER_APPROX.length - 1; i += 1) {
    const [x1, y1] = BORDER_APPROX[i], [x2, y2] = BORDER_APPROX[i + 1];
    if (lon >= x1 && lon <= x2) return lat > y1 + ((lon - x1) / (x2 - x1)) * (y2 - y1);
  }
  return lon < BORDER_APPROX[0][0] ? lat > 1.95 : false;
}

async function loadRegionalFires() {
  return cached("regional-fires", 3 * 60 * 60 * 1000, async () => {
    const csv = await fetchText(FIRMS_SEA_24H, 60000);
    const rows = csv.split("\n");
    const head = rows[0].split(",");
    const ix = (k) => head.indexOf(k);
    const [iLat, iLon, iConf, iFrp, iDate, iTime] = ["latitude", "longitude", "confidence", "frp", "acq_date", "acq_time"].map(ix);
    let kalimantan = 0, sarawak = 0, kFrp = 0;
    const strong = [];
    const cells = {}; // 0.5° cell -> detection count, for trajectory checks in the browser
    for (let r = 1; r < rows.length; r += 1) {
      const c = rows[r].split(",");
      const lat = Number(c[iLat]), lon = Number(c[iLon]);
      if (!(lat > -4.5 && lat < 5.2 && lon > 108.5 && lon < 119.5) || c[iConf] === "l") continue; // Borneo, drop low confidence
      const frp = Number(c[iFrp]) || 0;
      if (northOfBorder(lon, lat)) sarawak += 1; else { kalimantan += 1; kFrp += frp; }
      const key = `${Math.floor(lat * 2) / 2},${Math.floor(lon * 2) / 2}`;
      cells[key] = (cells[key] || 0) + 1;
      strong.push({ lat: Math.round(lat * 1000) / 1000, lon: Math.round(lon * 1000) / 1000, frp: Math.round(frp * 10) / 10, at: `${c[iDate]} ${c[iTime]}` });
    }
    strong.sort((a, b) => b.frp - a.frp);
    return { status: "live", updatedAt: nowIso(), source: "NASA FIRMS · NOAA-20 VIIRS · last 24 h", url: "https://firms.modaps.eosdis.nasa.gov/map/",
      kalimantan, sarawak, kalimantanFrpMw: Math.round(kFrp), points: strong.slice(0, 400), cells,
      note: "Detections, not confirmed fires; nominal/high confidence only. Sarawak/Kalimantan split uses an approximate border line." };
  }).catch(() => ({ status: "unavailable", updatedAt: nowIso(), points: [] }));
}

// Tide + surge at the Sarawak River mouth: Open-Meteo marine model sea level
// (0.25° grid, offshore Santubong). A model, not the JUPEM tide gauge.
async function loadTide() {
  return cached("tide", 60 * 60 * 1000, async () => {
    let json = null;
    for (let attempt = 0; attempt < 3 && !json; attempt += 1) {
      try { json = await fetchJson(TIDE_URL, 15000); } catch { await new Promise((r) => setTimeout(r, 2500 * (attempt + 1))); }
    }
    const tide = summariseTide(json);
    return tide ? { status: "live", updatedAt: nowIso(), url: TIDE_URL, source: "Open-Meteo marine model · sea level incl. tide (offshore Santubong)", ...tide }
      : { status: "unavailable", updatedAt: nowIso(), url: TIDE_URL };
  });
}

async function loadCityReports() {
  return cached("cityReports", 300_000, async () => {
    const supabaseUrl = process.env.CITY_REPORTER_SUPABASE_URL;
    const supabaseKey = process.env.CITY_REPORTER_SUPABASE_KEY;
    if (!supabaseUrl || !supabaseKey) return cityReportsNotConnected();

    const qUrl = `${supabaseUrl}/rest/v1/reports?latitude=gte.1.15&latitude=lte.1.85&longitude=gte.109.9&longitude=lte.110.7&select=id,ticket_number,timestamp,problem_type,description,ai_summary,latitude,longitude,urgency,status,location_text&order=timestamp.desc&limit=50`;
    const resp = await fetchWithTimeout(qUrl, {
      headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}` },
    }, 8000);
    if (!resp.ok) throw new Error(`City Reporter Supabase ${resp.status}`);
    const rows = await resp.json();
    if (!Array.isArray(rows) || rows.length === 0) return { ...cityReportsNotConnected("live"), note: "Feed connected; no reports in the Kuching area." };

    const recent = rows.slice(0, 5).map((r) => ({
      id: r.id,
      ticket: r.ticket_number || r.id.slice(0, 8),
      timestamp: r.timestamp,
      problem_type: r.problem_type || "—",
      description: r.description || "",
      ai_summary: r.ai_summary || r.description || "",
      lat: r.latitude,
      lon: r.longitude,
      urgency: ["high","urgent"].includes((r.urgency || "").toLowerCase()) ? "high" : r.urgency === "low" ? "low" : "medium",
      status: r.status || "received",
      location_text: r.location_text || "",
    }));
    const open = rows.filter((r) => !["completed","resolved"].includes(r.status)).length;
    return {
      status: "live",
      count: rows.length,
      open,
      resolved: rows.length - open,
      recent,
      updatedAt: nowIso(),
    };
  }).catch(() => cityReportsNotConnected("offline"));
}

// IOC 2.0 — AlphaEarth growth-ring change overlay. Read the newest
// growth-*.json sidecar produced by scripts/alphaearth/compute_change.py.
// Absent until Earth Engine auth + the pipeline have been run once.
async function loadAlphaEarth() {
  return cached("alphaearth", 3600_000, async () => {
    const dir = path.join(publicDir, "data", "alphaearth");
    const files = await fs.readdir(dir).catch(() => []);
    const sidecars = files.filter((f) => f.startsWith("growth-") && f.endsWith(".json")).sort();
    if (!sidecars.length) return { status: "absent" };
    
    const timeline = [];
    for (const file of sidecars) {
      const doc = JSON.parse(await fs.readFile(path.join(dir, file), "utf-8"));
      timeline.push({
        image: `data/alphaearth/${doc.image}`,
        bounds: doc.bounds,
        years: doc.years,
        stats: doc.stats,
      });
    }

    const latest = timeline[timeline.length - 1];
    return {
      status: "ready",
      image: latest.image,
      bounds: latest.bounds,
      years: latest.years,
      stats: latest.stats,
      dataset: latest.dataset || "GOOGLE/SATELLITE_EMBEDDING/V1/ANNUAL",
      timeline: timeline,
    };
  }).catch(() => ({ status: "absent" }));
}

async function buildDashboard() {
  const [
    weather, air, airport, jurisdictions, news, fires, quakes,
    padawanZoning, trends, govStats,
    infobanjirRaw, apims, ckanHarvest, exchange, metWarnings, floodForecast,
    mppCouncillors, mppLocalities, forecast, alphaEarth, imperviousData, cityReports,
    mppService, nrebApi,
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
    loadGovStats(),
    loadInfobanjir(),
    loadApimsAqi(),
    loadSarawakCkanHarvest(),
    loadExchangeRates(),
    loadMetWarnings(),
    loadFloodForecast(),
    loadMppCouncillors(),
    loadMppLocalities(),
    loadForecast(),
    loadAlphaEarth(),
    loadImperviousData(),
    loadCityReports(),
    loadMppServiceLedger(),
    loadNrebApi(),
  ]);

  // Second wave. Fired together with the first ~30 loaders, these hit undici's
  // 10 s connect timeout on CI runners (14 Oct 2026). Run them after, and
  // retry once with a fresh cache entry if a source came back unavailable.
  const wave2 = [
    ["water-supply", loadWaterSupply], ["rain-regime", loadRainRegime], ["mpp-coverage", loadMppCoverage],
    ["jkm-pps", loadReliefCentres], ["dosm-districts", loadDistrictPopulation],
    ["regional-fires", loadRegionalFires], ["tide", loadTide],
  ];
  const ok = (v) => Array.isArray(v) ? v.some((x) => x.status === "live") : v?.status === "live";
  const wave2Results = await Promise.all(wave2.map(async ([key, fn]) => {
    const first = await fn();
    if (ok(first)) return first;
    cache.delete(key);
    await new Promise((r) => setTimeout(r, 1500));
    return fn();
  }));
  const [waterSupply, rainRegime, mppCoverage, reliefCentres, dosmDistricts, regionalFires, tide] = wave2Results;

  // Catchment enrichment compounds Infobanjir + OSM drainage. Pure post-process,
  // no extra fetches — only runs if drainage cache is hot.
  const infobanjir = enrichInfobanjirWithCatchment(infobanjirRaw);
  const floodAction = buildFloodAction({ infobanjir, weather, floodForecast, metWarnings, news });

  const generatedAt = nowIso();
  const mapLayers = buildMapLayers();
  const summary = buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends, infobanjir, apims);
  const mapScene = buildMapScene(jurisdictions, padawanZoning, infobanjir);

  return {
    generatedAt,
    site: SITE,
    timeSignal: buildTimeSignal(),
    summary,
    metrics: buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends, metWarnings, nrebApi),
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
    mppService,
    waterSupply,
    rainRegime,
    mppCoverage,
    reliefCentres,
    regionalFires,
    tide,
    govStats: { latestSarawakPop: govStats.dosm.latestSarawakPop, year: govStats.dosm.year, datasetCount: govStats.sarawak.datasetCount, updatedAt: govStats.updatedAt, districts: dosmDistricts },
    sarawakStats: govStats.sarawak,
    openDosmStats: govStats.dosm,
    metWarnings,
    infobanjir,
    floodAction,
    apims,
    ckanHarvest,
    floodForecast,
    forecast,
    alphaEarth,
    impervious: imperviousData,
    floodMatrix: buildFloodRiskMatrix(forecast, imperviousData),
    nrebApi,
    cityReports,
    mppCouncillors,
    mppLocalities,
    osm: getOsmStatusSnapshot(),
    operations: buildOperations({ weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes, govStats, infobanjir, apims, metWarnings, forecast, floodMatrix: buildFloodRiskMatrix(forecast, imperviousData), mppService, tide, nrebApi }),
    sources: [
      sourceRecord(
        "mpp-reference-map",
        "Greater Kuching municipal reference map",
        "official",
        "Municipal boundaries and reference geometry for Greater Kuching.",
        "https://commons.wikimedia.org/wiki/File:Greater_Kuching_map_blank.svg",
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
        "https://commons.wikimedia.org/wiki/File:Greater_Kuching_map_blank.svg",
        generatedAt,
      ),
      sourceRecord(
        "mpp-zoning-map",
        "MPP zoning map",
        padawanZoning.status,
        `Padawan ward placemarks (${padawanZoning.wardCount}). An external zoning KML is used only when PADAWAN_ZONING_KML_URL is set.`,
        "https://mpp.sarawak.gov.my/web/subpage/webpage_view/55",
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
      sourceRecord("nreb-api", "NREB Sarawak / Air Pollutant Index", nrebApi?.status === "ready" ? "live" : (nrebApi?.status || "absent"), "State-tier official API readings from NREB's own monitoring network — 16 stations across Sarawak, outranks modeled AQI. The board labels it as official wherever shown.", nrebApi?.scaleUrl || "https://www.nreb.gov.my/web/subpage/webpage_view/548", nrebApi?.fetchedAt || generatedAt),
      sourceRecord("tvs-sarawak", "TVS (TV Sarawak)", news.laneStatus?.find((lane) => lane.id === "tvs-sarawak")?.status || news.status, "Sarawak's own broadcaster — direct BM/ZH headlines for the news digestion.", "https://www.tvsarawak.my/feed/", generatedAt),
      sourceRecord("tvs-english", "TVS English desk", news.laneStatus?.find((lane) => lane.id === "tvs-english")?.status || news.status, "TVS English category — all-English Sarawak broadcaster headlines.", "https://www.tvsarawak.my/category/english/feed/", generatedAt),
      sourceRecord("mbks-news", "MBKS News Collections", news.status, "Official MBKS municipal news lane.", "https://mbks.sarawak.gov.my/web/subpage/news_list/", generatedAt),
      sourceRecord("mpp-announcements", "MPP Announcement List", news.status, "Official MPP announcement lane.", "https://mpp.sarawak.gov.my/web/subpage/announcement_list/", generatedAt),
      sourceRecord("ihydro-intake", "DID iHYDRO · Batu Kitang intake reach + Intelligent Gauges", waterSupply.status === "live" ? "official" : "offline", "7-day river level at the Batu Kitang intake reach with DID thresholds; Kuching urban flash-flood gauges. Sarawak Water notices are not machine-readable.", waterSupply.intake?.url || IHYDRO_BASE, waterSupply.updatedAt || generatedAt),
      sourceRecord("rain-regime", "Rain regime (JMA + MetMalaysia + Open-Meteo)", rainRegime.status === "live" ? "live" : "offline", "Rule-based monsoon / tropical system / local convection label with its evidence. Not an official MetMalaysia classification.", "https://www.jma.go.jp/bosai/map.html#contents=typhoon", rainRegime.updatedAt || generatedAt),
      sourceRecord("mpp-coverage", "MPP maintenance zones + refuse schedule", mppCoverage.status === "live" ? "official" : "offline", "Who covers which area: drains/grass, trees and Trienekens refuse zones from MPP's pages. Names only.", "https://mpp.sarawak.gov.my/web/subpage/webpage_view/258", mppCoverage.updatedAt || generatedAt),
      sourceRecord("firms-borneo", "NASA FIRMS · Borneo fire detections (24 h)", regionalFires.status === "live" ? "live" : "offline", `VIIRS NOAA-20, nominal/high confidence: Kalimantan ${regionalFires.kalimantan ?? "—"}, Sarawak ${regionalFires.sarawak ?? "—"}. Keyless regional file.`, "https://firms.modaps.eosdis.nasa.gov/map/", regionalFires.updatedAt || generatedAt),
      sourceRecord("tide", "Tide + surge · Sarawak River mouth (model)", tide.status === "live" ? "live" : "offline", "Open-Meteo marine sea level, offshore Santubong. A model grid point, not the JUPEM tide gauge.", "https://open-meteo.com/en/docs/marine-weather-api", tide.updatedAt || generatedAt),
      sourceRecord("jkm-pps", "JKM InfoBencana · open relief centres", reliefCentres.status === "live" ? "official" : "offline", `Open PPS in Greater Kuching districts: ${reliefCentres.items?.length ?? "—"} (Sarawak-wide: ${reliefCentres.sarawakOpen ?? "—"}).`, reliefCentres.url, reliefCentres.updatedAt || generatedAt),
      sourceRecord("mpp-service-ledger", "MPP Client Charter + service lists", mppService.status, "Quarterly charter achievement, active tenders (count/dates only; titles are images), Grade-A food premises, refuse zones, parks, night markets.", mppService.charter?.url || "https://mpp.sarawak.gov.my/", mppService.updatedAt || generatedAt),
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
        "gov-stats",
        "Gov Data Sync (CKAN + OpenDOSM)",
        govStats.dosm.status === "live" ? "official" : "offline",
        `${govStats.dosm.latestSarawakPop != null ? `Sarawak population ${govStats.dosm.latestSarawakPop.toLocaleString("en-MY")} (${govStats.dosm.year}, OpenDOSM)` : "OpenDOSM population unreachable"}. Sarawak portal datasets: ${govStats.sarawak.datasetCount ?? "—"}.`,
        "https://open.dosm.gov.my/data-catalogue/population_state",
        govStats.updatedAt || generatedAt,
      ),
      sourceRecord(
        "official-warnings",
        "MET Malaysia Warnings",
        metWarnings.status === "unavailable" ? "offline" : metWarnings.status === "partial" ? "partial" : "official",
        `MET forecast: ${metWarnings.forecast.text || "unavailable"}. Warning status: ${metWarnings.status}.`,
        "https://developer.data.gov.my/realtime-api/weather",
        metWarnings.updatedAt || generatedAt,
      ),
      sourceRecord(
        "did-ihydro",
        "DID Sarawak iHYDRO",
        infobanjir.status,
        infobanjir.summary,
        infobanjir.sourceUrl || "https://ihydro.sarawak.gov.my/",
        infobanjir.updatedAt || generatedAt,
      ),
      sourceRecord(
        "flood-action",
        "Flood action card (FloodDash pattern)",
        floodAction.status,
        `${floodAction.verb} · score ${floodAction.score}/100 · ${floodAction.confidence}`,
        floodAction.sourceUrl || "https://ihydro.sarawak.gov.my/",
        floodAction.updatedAt || generatedAt,
      ),
      sourceRecord(
        "doe-apims",
        "DOE JAS APIMS — eqms.doe.gov.my",
        apims.status,
        apims.coverageNote
          ? `${apims.summary} ${apims.coverageNote}`
          : apims.summary,
        apims.sourceUrl || "https://eqms.doe.gov.my/APIMS/main",
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
        "MPP locality directory",
        mppLocalities.status,
        `${mppLocalities?.totals?.localities ?? 0} localities. Property-usage counts withheld. ${mppLocalities?.totals?.stateConstituencies ?? 0} state + ${mppLocalities?.totals?.parliamentConstituencies ?? 0} parliament constituencies.`,
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
  return { type: "FeatureCollection", features: [], _note: "Mock layer empty per Musk-style deletion rule" };
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
