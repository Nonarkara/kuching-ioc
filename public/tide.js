// Tide + surge at the Sarawak River mouth, shared by the server bake and the
// browser. Open-Meteo marine sea level (0.25° grid, offshore Santubong) — a
// model grid point, not the JUPEM tide gauge.
export const TIDE_URL = "https://marine-api.open-meteo.com/v1/marine?latitude=1.70&longitude=110.47&hourly=sea_level_height_msl&timezone=Asia%2FKuching&past_days=1&forecast_days=3";

export function summariseTide(json, nowMs = Date.now()) {
  const h = json?.hourly;
  if (!h?.time?.length) return null;
  const pts = h.time.map((t, i) => ({ t: `${t}:00+08:00`, v: h.sea_level_height_msl?.[i] })).filter((p) => Number.isFinite(p.v));
  if (pts.length < 6) return null;
  const highs = [];
  for (let i = 1; i < pts.length - 1; i += 1) if (pts[i].v >= pts[i - 1].v && pts[i].v > pts[i + 1].v) highs.push(pts[i]);
  const vals = pts.map((p) => p.v), max = Math.max(...vals), min = Math.min(...vals);
  const upcoming = highs.filter((p) => Date.parse(p.t) >= nowMs).slice(0, 4);
  return { points: pts, highs: upcoming, rangeM: Math.round((max - min) * 100) / 100, maxM: Math.round(max * 100) / 100,
    topThird: Math.round((min + (max - min) * 2 / 3) * 100) / 100 };
}
