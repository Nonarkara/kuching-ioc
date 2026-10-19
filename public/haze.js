// Haze state shared by the bake (server.mjs) and the board (app.js).
// The official reading always wins: NREB Sarawak's Air Pollutant Index first,
// DOE APIMS ground stations second, Open-Meteo's modelled AQI last and labelled
// as a model. Bands and colours are Malaysia's published API scale; advice is
// paraphrased from the DOE / Ministry of Health API health advisory.

// Malaysia API scale (DOE): 0-50 Good, 51-100 Moderate, 101-200 Unhealthy,
// 201-300 Very unhealthy, >300 Hazardous. Colours follow the official legend.
export const API_BANDS = [
  { level: 0, max: 50, key: "good", color: "#2563b8" },
  { level: 1, max: 100, key: "moderate", color: "#2e8b57" },
  { level: 2, max: 200, key: "unhealthy", color: "#d4a900" },
  { level: 3, max: 300, key: "veryUnhealthy", color: "#e07000" },
  { level: 4, max: Infinity, key: "hazardous", color: "#c62828" },
];

export function apiBand(api) {
  if (!Number.isFinite(api) || api < 0) return null;
  return API_BANDS.find((b) => api <= b.max);
}

// NREB publishes station names, not coordinates. These are the town each
// station is named for (OSM town node), so markers are approximate by design
// and say so in their tooltip.
export const NREB_STATION_COORDS = {
  KUCHING: [1.5535, 110.3593],
  SAMARAHAN: [1.4611, 110.4930],
  "SERIAN (MCAQM)": [1.1671, 110.5664],
  LUNDU: [1.6667, 109.8500],
  TEBEDU: [1.0280, 110.3640],
};
// Greater Kuching's own air: the stations an MPP decision should react to.
export const LOCAL_STATIONS = ["KUCHING", "SAMARAHAN", "SERIAN (MCAQM)", "LUNDU"];

export function hazeState(payload) {
  const nreb = payload?.nrebApi;
  const local = nreb?.status === "ready"
    ? (nreb.stations || []).filter((s) => LOCAL_STATIONS.includes(s.name) && Number.isFinite(s.api))
        .map((s) => ({ ...s, coords: NREB_STATION_COORDS[s.name] || null, band: apiBand(s.api) }))
    : [];
  const kuching = local.find((s) => s.name === "KUCHING") || null;
  if (kuching) {
    const worst = local.slice().sort((a, b) => b.api - a.api)[0];
    return { tier: "official", source: "NREB Sarawak", api: kuching.api, band: kuching.band,
      station: "Kuching", takenAt: nreb.takenAt || null, url: nreb.scaleUrl || null, worst, local };
  }
  const apims = payload?.apims;
  if (apims?.status === "live" && Number.isFinite(apims.worst?.aqi)) {
    return { tier: "official", source: "DOE APIMS", api: apims.worst.aqi, band: apiBand(apims.worst.aqi),
      station: apims.worst.stationName || "Kuching", takenAt: apims.updatedAt || null, url: null, worst: null, local };
  }
  const model = payload?.climate?.air?.current?.aqi;
  if (Number.isFinite(model)) {
    return { tier: "model", source: "Open-Meteo model", api: model, band: apiBand(model),
      station: "Kuching", takenAt: payload.climate.air.observedAt || null, url: null, worst: null, local };
  }
  return null;
}

// What to do, by band. Public lines follow the DOE/MOH API advisory; council
// lines are this board's operational reading of it and are labelled as such.
const ADVICE = {
  en: {
    band: { good: "Good", moderate: "Moderate", unhealthy: "Unhealthy", veryUnhealthy: "Very unhealthy", hazardous: "Hazardous" },
    public: [
      ["Normal activities."],
      ["Normal activities.", "People with asthma, heart or lung conditions: watch for symptoms."],
      ["Cut long or hard outdoor activity.", "Children, older people and anyone with asthma, heart or lung conditions: stay indoors.", "Wear a fitted mask (N95) outdoors."],
      ["Avoid outdoor activity; keep windows and doors closed.", "Sensitive groups stay indoors.", "Schools follow the Ministry of Education haze SOP."],
      ["Stay indoors.", "Follow official emergency instructions.", "Seek medical help for breathing difficulty."],
    ],
    council: [
      [],
      ["Watch for open burning reports."],
      ["Enforce the open-burning ban; report fires to NREB.", "Issue N95 masks to outdoor crews; shorten outdoor shifts.", "Postpone outdoor council events where possible."],
      ["Suspend non-essential outdoor works.", "Open clean-air rooms at community halls and relief centres.", "Coordinate school notices with the district office."],
      ["Activate the disaster committee.", "Keep only essential outdoor services running."],
    ],
    publicHead: "For the public", councilHead: "For the council (board guidance)",
    title: "Haze now", official: "Official reading", model: "Model estimate, not an official reading",
    approx: "Marker at the town the station is named for; position approximate.",
    flow: "Moving line: where the air reaching Kuching came from over the last 18 h (wind model, not HYSPLIT).",
    scale: "API scale", hide: "Hide",
  },
  ms: {
    band: { good: "Baik", moderate: "Sederhana", unhealthy: "Tidak sihat", veryUnhealthy: "Sangat tidak sihat", hazardous: "Berbahaya" },
    public: [
      ["Aktiviti seperti biasa."],
      ["Aktiviti seperti biasa.", "Penghidap asma, sakit jantung atau paru-paru: perhatikan simptom."],
      ["Kurangkan aktiviti luar yang lama atau berat.", "Kanak-kanak, warga emas dan penghidap asma, jantung atau paru-paru: kekal di dalam rumah.", "Pakai pelitup muka (N95) di luar."],
      ["Elakkan aktiviti luar; tutup tingkap dan pintu.", "Kumpulan sensitif kekal di dalam rumah.", "Sekolah ikut SOP jerebu Kementerian Pendidikan."],
      ["Kekal di dalam rumah.", "Ikut arahan kecemasan rasmi.", "Dapatkan rawatan jika sukar bernafas."],
    ],
    council: [
      [],
      ["Pantau laporan pembakaran terbuka."],
      ["Kuatkuasa larangan pembakaran terbuka; lapor kepada NREB.", "Bekalkan pelitup N95 kepada pekerja luar; pendekkan syif luar.", "Tangguhkan acara luar majlis jika boleh."],
      ["Gantung kerja luar yang tidak penting.", "Buka bilik udara bersih di dewan komuniti dan pusat pemindahan.", "Selaras notis sekolah dengan pejabat daerah."],
      ["Aktifkan jawatankuasa bencana.", "Hanya perkhidmatan luar yang penting diteruskan."],
    ],
    publicHead: "Untuk orang awam", councilHead: "Untuk majlis (panduan papan)",
    title: "Jerebu kini", official: "Bacaan rasmi", model: "Anggaran model, bukan bacaan rasmi",
    approx: "Penanda di pekan nama stesen; kedudukan anggaran.",
    flow: "Garis bergerak: dari mana udara yang tiba di Kuching datang dalam 18 jam lalu (model angin, bukan HYSPLIT).",
    scale: "Skala IPU", hide: "Tutup",
  },
  zh: {
    band: { good: "良好", moderate: "中等", unhealthy: "不健康", veryUnhealthy: "非常不健康", hazardous: "危险" },
    public: [
      ["照常活动。"],
      ["照常活动。", "哮喘、心脏或肺部疾病患者：留意身体症状。"],
      ["减少长时间或剧烈的户外活动。", "儿童、长者及哮喘、心肺疾病患者：留在室内。", "外出佩戴贴合的口罩（N95）。"],
      ["避免户外活动；关好门窗。", "敏感人群留在室内。", "学校按教育部烟霾标准作业程序执行。"],
      ["留在室内。", "遵从官方紧急指示。", "呼吸困难时立即就医。"],
    ],
    council: [
      [],
      ["留意露天焚烧举报。"],
      ["执行露天焚烧禁令；向 NREB 举报火点。", "为户外人员发放 N95 口罩；缩短户外班次。", "尽量延后理事会户外活动。"],
      ["暂停非必要户外工程。", "在社区礼堂和疏散中心开放洁净空气室。", "与县署协调学校通知。"],
      ["启动灾难委员会。", "只保留必要的户外服务。"],
    ],
    publicHead: "给公众", councilHead: "给理事会（本系统建议）",
    title: "当前烟霾", official: "官方读数", model: "模型估算，非官方读数",
    approx: "标记位于测站所在城镇，位置为近似。",
    flow: "移动线条：过去 18 小时抵达古晋的空气来自何方（风场模型，非 HYSPLIT）。",
    scale: "API 等级", hide: "关闭",
  },
};

export function hazeAdvice(band, lang = "en") {
  const a = ADVICE[lang] || ADVICE.en;
  if (!band) return null;
  return { label: a.band[band.key], public: a.public[band.level], council: a.council[band.level],
    publicHead: a.publicHead, councilHead: a.councilHead, ui: a };
}

// Air arrives along the back-trajectory in reverse: oldest point first, ending
// at Kuching. Only the last `hours` are drawn inside the city frame.
export function inflowPath(path, hours = 18) {
  if (!Array.isArray(path) || path.length < 2) return [];
  return path.filter((p) => p.hoursAgo <= hours).slice().sort((a, b) => b.hoursAgo - a.hoursAgo);
}
