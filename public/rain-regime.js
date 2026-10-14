// Rain regime classifier — rule-based and labelled as such on the board.
// Not an official MetMalaysia product. Thresholds (13 Oct 2026):
//   tropical system: MetMalaysia TC advisory active, or a JMA-tracked cyclone
//     within 1500 km (west of 130°E, south of 25°N), or Kuching 24 h mean
//     pressure < 1007 hPa with a 24 h fall of 3 hPa or more;
//   NE monsoon: 24 h mean 850 hPa wind >= 8 m/s from 0–90° (cold-surge proxy);
//   SW monsoon: >= 5 m/s from 200–270°;
//   local convection: < 5 m/s at both points; otherwise "unknown".
// Season (Nov–Mar NE, May–Sep SW) only sets confidence, never the label.
export function classifyRainRegime({ month, cyclones = [], mmdAdvisory = null, kuching = null, scs = null }) {
  const evidence = [];
  const near = cyclones.filter((c) => c.distanceKm != null && c.distanceKm <= 1500 && c.lon <= 130 && c.lat <= 25);
  if (mmdAdvisory && !/no advisory/i.test(mmdAdvisory)) evidence.push(`MetMalaysia tropical-cyclone advisory: ${mmdAdvisory}`);
  near.forEach((c) => evidence.push(`${c.name} (${c.category}) ${c.distanceKm} km from Kuching — JMA`));
  const lowPressure = kuching?.mslMean24 != null && kuching.mslMean24 < 1007 && kuching.mslChange24 <= -3;
  if (lowPressure) evidence.push(`Kuching pressure ${kuching.mslMean24} hPa, ${kuching.mslChange24} hPa in 24 h`);
  if ((mmdAdvisory && !/no advisory/i.test(mmdAdvisory)) || near.length || lowPressure) {
    return { label: "depression", confidence: near.length || mmdAdvisory ? "high" : "low", evidence };
  }
  const ne = [kuching, scs].some((p) => p?.wind850 != null && p.wind850.speedMean >= 8 && p.wind850.dirMean >= 0 && p.wind850.dirMean <= 90);
  const sw = [kuching, scs].some((p) => p?.wind850 != null && p.wind850.speedMean >= 5 && p.wind850.dirMean >= 200 && p.wind850.dirMean <= 270);
  const season = [11, 12, 1, 2, 3].includes(month) ? "ne" : month >= 5 && month <= 9 ? "sw" : "inter";
  if (scs?.wind850) evidence.push(`South China Sea 850 hPa wind ${scs.wind850.speedMean} m/s from ${scs.wind850.dirMean}°`);
  if (kuching?.wind850) evidence.push(`Kuching 850 hPa wind ${kuching.wind850.speedMean} m/s from ${kuching.wind850.dirMean}°`);
  if (ne) return { label: "monsoon_ne", confidence: season === "ne" ? "medium" : "low", evidence, season };
  if (sw) return { label: "monsoon_sw", confidence: season === "sw" ? "medium" : "low", evidence, season };
  const calm = [kuching, scs].every((p) => p?.wind850 != null && p.wind850.speedMean < 5);
  if (calm) return { label: "local", confidence: "medium", evidence, season };
  return { label: "unknown", confidence: null, evidence, season };
}

// Shared by the server bake and the browser (Open-Meteo is CORS-open; CI
// runner IPs are sometimes refused, a visitor's browser is not).
export const RAIN_REGIME_OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast?latitude=1.55,12.0&longitude=110.35,112.0&hourly=pressure_msl,wind_speed_850hPa,wind_direction_850hPa&wind_speed_unit=ms&past_days=2&forecast_days=1&timezone=Asia%2FKuching";

function vecMean(speeds, dirs) {
  let u = 0, v = 0, n = 0;
  speeds.forEach((sp, i) => { if (sp == null || dirs[i] == null) return; const r = dirs[i] * Math.PI / 180; u += sp * Math.sin(r); v += sp * Math.cos(r); n += 1; });
  if (!n) return null;
  const dir = (Math.atan2(u / n, v / n) * 180 / Math.PI + 360) % 360;
  const meanSpeed = speeds.filter((x) => x != null).reduce((a, b) => a + b, 0) / n;
  return { speedMean: Math.round(meanSpeed * 10) / 10, dirMean: Math.round(dir) };
}

// Open-Meteo multi-location JSON -> [kuching, southChinaSea] 24 h summaries.
export function summariseOpenMeteo(json, nowMs = Date.now()) {
  const point = (i) => {
    const loc = Array.isArray(json) ? json[i] : i === 0 ? json : null;
    const h = loc?.hourly;
    if (!h?.time?.length) return null;
    const nowIdx = h.time.findIndex((t) => Date.parse(`${t}:00+08:00`) > nowMs) - 1;
    const end = nowIdx > 24 ? nowIdx : h.time.length - 1;
    const last24 = (arr) => arr.slice(Math.max(0, end - 23), end + 1);
    const prev24 = (arr) => arr.slice(Math.max(0, end - 47), Math.max(0, end - 23));
    const mean = (arr) => { const v = arr.filter((x) => x != null); return v.length ? Math.round(v.reduce((a, b) => a + b, 0) / v.length * 10) / 10 : null; };
    const m1 = mean(last24(h.pressure_msl)), m0 = mean(prev24(h.pressure_msl));
    return { mslMean24: m1, mslChange24: m1 != null && m0 != null ? Math.round((m1 - m0) * 10) / 10 : null,
      wind850: vecMean(last24(h.wind_speed_850hPa), last24(h.wind_direction_850hPa)), asOf: h.time[end] };
  };
  return [point(0), point(1)];
}
