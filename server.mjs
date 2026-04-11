import http from "node:http";
import path from "node:path";
import fs from "node:fs/promises";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.join(__dirname, "public");
const port = Number(process.env.PORT || 3000);

const SITE = {
  title: "Secretary Goh's Super Dashboard",
  subtitle: "Greater Kuching operating picture with Padawan in focus",
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

const LOCAL_PRESS_FEED = {
  id: "kuching-local-press",
  label: "Local press",
  url:
    "https://news.google.com/rss/search?q=%28Kuching%20OR%20Padawan%20OR%20%22Batu%20Kawa%22%20OR%20Siburan%20OR%20Stutong%20OR%20Penrissen%20OR%20%22Petra%20Jaya%22%29%20%28site%3Atheborneopost.com%20OR%20site%3Adayakdaily.com%20OR%20site%3Asarawaktribune.com%20OR%20site%3Abernama.com%29%20when%3A14d&hl=en-MY&gl=MY&ceid=MY%3Aen",
};

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

const LOCAL_NEWS_RE = /kuching|padawan|batu kawa|petra jaya|siburan|stutong|penrissen|sarawak|3rd mile/i;
const BAD_NEWS_RE =
  /ontario|newmarket|aurora|nipissing|fedeli|rural ontario|dawn gallagher|billy denault|toronto|scarborough/i;
const LOCAL_TRENDS_RE = /kuching|padawan|batu kawa|petra jaya|siburan|sarawak|borneo|kch|wbgg/i;
const NATIONAL_TRENDS_RE = /malaysia|malaysian|sabah|sarawak|johor|penang|selangor|kuala lumpur|kl/i;

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

function parseRssItems(xml, lane) {
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

  return {
    ...item,
    title: stripTags(item.title),
    source: stripTags(item.source || "Unknown"),
    link: item.link,
    publishedAt: item.publishedAt || nowIso(),
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

async function loadGoogleLocalPress() {
  const xml = await fetchText(LOCAL_PRESS_FEED.url, 12000);
  return parseRssItems(xml, LOCAL_PRESS_FEED.label).map((item) => ({
    ...item,
    source: item.source || "Local press",
    isOfficial: false,
  }));
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
    const settled = await Promise.allSettled([
      loadGoogleLocalPress(),
      loadMbksNews(),
      loadMppAnnouncements(),
      loadDbkuNews(),
    ]);

    const fulfilledCount = settled.filter((result) => result.status === "fulfilled").length;
    const items = dedupeNews(
      settled
        .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
        .map(sanitizeNewsItem)
        .filter(Boolean)
        .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)),
    );
    const headlines = items.slice(0, 12);

    return {
      status: headlines.length > 0 && fulfilledCount >= 2 ? "live" : "fallback",
      updatedAt: nowIso(),
      systemLabel:
        "MBKS news + MPP announcements + DBKU releases + local press RSS / 15-minute cache / locality filtered",
      items: headlines.length > 0 ? headlines : FALLBACK_NEWS,
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

function buildMapScene(jurisdictions, padawanZoning) {
  return {
    ...MUNICIPAL_MAP,
    updatedAt: nowIso(),
    focusLabel: "Padawan in focus, Greater Kuching in full frame",
    geometryStatus: jurisdictions.geometryStatus,
    wardCount: padawanZoning.wardCount,
    wardStatus: padawanZoning.status,
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

function buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");
  const conditions = [];

  if (rain6h >= 8) conditions.push("drainage watch");
  if (air.current.aqi >= 75) conditions.push("air-quality watch");
  if (airport.movements.totalTracked >= 6) conditions.push("airport spillover");

  const posture =
    conditions.length >= 3
      ? "stretched"
      : conditions.length === 2
        ? "watch"
        : conditions.length === 1
          ? "steady-watch"
          : "stable";

  const headlineMap = {
    stretched: "Padawan needs coordinated eyes on drains, air, and airport access now.",
    watch: "Padawan is in watch mode. The system is fine, but the weather-air mix can turn ugly fast.",
    "steady-watch": "Padawan is stable enough to clear backlog while keeping one operational eye open.",
    stable: "Greater Kuching is calm enough for delivery, not complacency.",
  };

  return {
    posture,
    headline: headlineMap[posture],
    detail: `Padawan covers ${padawan?.areaSharePct ?? 0}% of the three-council land area. Heat index ${weather.current.apparentTemperatureC}C, AQI ${air.current.aqi}, ${rain6h} mm rain risk over 6 hours, ${airport.movements.totalTracked} aircraft in the KCH envelope, ${news.items.length} local headlines, and ${trends.localMatchCount} locally relevant Google Trends hits.`,
  };
}

function buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends) {
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
    { id: "headlines", label: "Local headlines", value: news.items.length, unit: "", tone: news.items.length >= 10 ? "neutral" : "muted", context: "official + local press lanes" },
    { id: "trends", label: "MY trend matches", value: trends.localMatchCount, unit: "", tone: trends.localMatchCount > 0 ? "focus" : "muted", context: trends.summary },
  ];
}

function buildOperations(weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes) {
  const rain6h = round(weather.nextHours.reduce((sum, hour) => sum + hour.precipitationMm, 0), 1);
  const padawan = jurisdictions.items.find((item) => item.id === "mpp");

  const items = [];

  if (rain6h >= 6) {
    items.push({
      severity: "high",
      owner: "Drainage",
      title: "Sweep Penrissen, Batu Kawa, and low-lying feeder roads",
      detail: `${rain6h} mm projected inside the next 6 hours. Put the boring but essential drain checks first.`,
    });
  }

  if (air.current.aqi >= 70 || air.current.pm25 >= 25) {
    items.push({
      severity: "medium",
      owner: "Health Intelligence",
      title: "Prepare a sensitive-group advisory for haze drift",
      detail: `AQI ${air.current.aqi}, PM2.5 ${air.current.pm25}. Keep schools and clinics ahead of the curve, not behind it.`,
    });
  }

  if (airport.movements.totalTracked >= 6) {
    items.push({
      severity: "medium",
      owner: "Traffic Command",
      title: "Watch KCH ingress and outbound spillover",
      detail: `${airport.movements.arrivals} arrivals and ${airport.movements.departures} departures are sitting in the local envelope.`,
    });
  }

  if (trends.localMatches.length > 0) {
    items.push({
      severity: "medium",
      owner: "Public Communications",
      title: "Local search pulse moved. Read it before Facebook weaponises it.",
      detail: `${trends.localMatches
        .slice(0, 2)
        .map((item) => item.title)
        .join(" / ")} surfaced inside the Malaysia trends feed.`,
    });
  }

  if (fires.hotspots.length > 0) {
    items.push({
      severity: "medium",
      owner: "Environmental Command",
      title: `${fires.hotspots.length} thermal hotspots in the wider Malaysia envelope`,
      detail: "Not a local crisis by default, but it is the first place haze trouble starts writing its own memo.",
    });
  }

  if (quakes.events.length > 0) {
    items.push({
      severity: "low",
      owner: "Disaster Watch",
      title: "Regional seismic activity registered",
      detail: quakes.summary,
    });
  }

  items.push({
    severity: "low",
    owner: "Planning",
    title: "Padawan remains the growth ring",
    detail: `${padawan?.areaKm2 ?? 0} km² across ${padawanZoning.wardCount} official zoning wards. That is the municipal board that changes the metro story.`,
  });

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

function buildTimeSignal() {
  return {
    serverNow: nowIso(),
    asean: ASEAN_CLOCKS,
  };
}

async function buildDashboard() {
  const [weather, air, airport, jurisdictions, news, fires, quakes, padawanZoning, trends] = await Promise.all([
    loadWeather(),
    loadAirQuality(),
    loadAirport(),
    loadJurisdictions(),
    loadNews(),
    loadFires(),
    loadEarthquakes(),
    loadPadawanZoning(),
    loadGoogleTrends(),
  ]);

  const generatedAt = nowIso();
  const satellites = buildSatelliteCards();
  const mapLayers = buildMapLayers();
  const summary = buildSummary(weather, air, airport, jurisdictions, news, padawanZoning, trends);
  const mapScene = buildMapScene(jurisdictions, padawanZoning);

  return {
    generatedAt,
    site: SITE,
    timeSignal: buildTimeSignal(),
    summary,
    metrics: buildMetricCards(weather, air, airport, jurisdictions, news, padawanZoning, trends),
    jurisdictions,
    mapScene,
    mapLayers,
    climate: buildClimatePanel(weather, air),
    airport,
    news,
    trends,
    satellites,
    fires,
    quakes,
    operations: buildOperations(weather, air, airport, news, jurisdictions, padawanZoning, trends, fires, quakes),
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
      sourceRecord("google-news-rss", "Google News RSS", news.status, "Local press lane for Kuching coverage.", "https://news.google.com/rss", generatedAt),
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
    ],
  };
}

async function serveStatic(requestPath, response) {
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
      }),
    );
    return;
  }

  await serveStatic(url.pathname, response);
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Secretary Goh's Super Dashboard listening on http://127.0.0.1:${port}`);
});
