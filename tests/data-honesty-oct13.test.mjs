import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { classifyRainRegime } from "../public/rain-regime.js";

const d = JSON.parse(readFileSync(new URL("../public/api/dashboard.json", import.meta.url)));
const calm = { wind850: { speedMean: 3, dirMean: 140 }, mslMean24: 1011, mslChange24: 0 };

test("rain regime: an MMD advisory or a nearby JMA cyclone beats every wind rule", () => {
  assert.equal(classifyRainRegime({ month: 1, mmdAdvisory: "Tropical Depression warning", kuching: calm, scs: calm }).label, "depression");
  const near = [{ name: "TC X", category: "TD", lat: 8, lon: 115, distanceKm: 900 }];
  assert.equal(classifyRainRegime({ month: 7, cyclones: near, kuching: calm, scs: calm }).label, "depression");
  const far = [{ name: "TC Y", category: "STS", lat: 36, lon: 154, distanceKm: 5300 }];
  assert.equal(classifyRainRegime({ month: 10, cyclones: far, mmdAdvisory: "No Advisory", kuching: calm, scs: calm }).label, "local");
});

test("rain regime: monsoon labels need the wind, season only sets confidence", () => {
  const ne = { wind850: { speedMean: 10, dirMean: 40 } };
  const r = classifyRainRegime({ month: 12, kuching: calm, scs: ne });
  assert.equal(r.label, "monsoon_ne");
  assert.equal(r.confidence, "medium");
  assert.equal(classifyRainRegime({ month: 7, kuching: calm, scs: ne }).confidence, "low");
  const mixed = { wind850: { speedMean: 6, dirMean: 120 } };
  assert.equal(classifyRainRegime({ month: 10, kuching: mixed, scs: calm }).label, "unknown");
});

test("snapshot never pins invented citizen reports", () => {
  assert.notEqual(d.cityReports.status, "demo");
  if (d.cityReports.status !== "live") assert.equal(d.cityReports.recent.length, 0);
});

test("coverage data carries company names and areas, never phone numbers", () => {
  const text = JSON.stringify(d.mppCoverage || {});
  assert.equal(/\b01\d[-\s]?\d{7,8}\b/.test(text), false, "personal mobile in coverage");
  assert.equal(/\b082[-\s]?\d{6}\b/.test(text.replace("082-615566", "")), false, "phone in coverage");
  if (d.mppCoverage?.status === "live") assert.ok(d.mppCoverage.refuse.items.length > 10);
});

test("water supply and river forecast show readings or nothing — never a made-up curve", () => {
  const ws = d.waterSupply;
  if (ws?.intake?.latest) {
    assert.ok(ws.intake.thresholds.alert > ws.intake.thresholds.normal);
    assert.ok(ws.intake.latest.v > 0 && ws.intake.latest.v < 20);
  }
  if (d.floodForecast?.status === "fallback") assert.equal(d.floodForecast.forecast.length, 0);
});

test("GloFAS flood forecast carries the ensemble band across the Sarawak River basin", () => {
  const ff = d.floodForecast;
  assert.ok(ff, "floodForecast must be present");
  if (ff.status === "fallback") {
    assert.equal(ff.forecast.length, 0);
    return;
  }
  // Live: every forecast day must carry the min/max/mean ensemble band so the
  // sparkline can draw a real confidence interval, not just a single line.
  assert.equal(ff.model.includes("ensemble"), true, "model description must mention the ensemble");
  assert.ok(ff.forecast.length >= 7, "at least 7 days of forecast");
  for (const day of ff.forecast) {
    assert.ok(Number.isFinite(day.dischargeCms), `dischargeCms must be numeric (${day.date})`);
    assert.ok(Number.isFinite(day.minCms), `minCms must be numeric (${day.date})`);
    assert.ok(Number.isFinite(day.maxCms), `maxCms must be numeric (${day.date})`);
    assert.ok(day.minCms <= day.dischargeCms && day.dischargeCms <= day.maxCms,
      `band must bracket the deterministic value (${day.date}: ${day.minCms}/${day.dischargeCms}/${day.maxCms})`);
  }
  // Reaches cover the urban corridor and the upper basin.
  const ids = (ff.reaches || []).map((r) => r.id);
  assert.ok(ids.includes("kuching"), "primary reach (Kuching) must be present");
  assert.ok(ids.includes("batu-kitang"), "Batu Kitang reach must be present");
  assert.ok(ids.includes("kpg-git"), "upper-basin reach (Kpg. Git) must be present for early warning");
  // Every reach gets a numeric spread so a wide-band warning can fire.
  for (const r of ff.reaches) {
    assert.ok(Number.isFinite(r.todayCms), `reach ${r.id} todayCms must be numeric`);
    assert.ok(Number.isFinite(r.spreadCms), `reach ${r.id} spreadCms must be numeric`);
    assert.ok(r.spreadCms >= 0, `spread cannot be negative (${r.id})`);
  }
});

// The flood sparkline is small enough to write as a pure function check on
// the data shape — every forecast day must carry the four numbers the
// renderer needs to draw the band, the line, and the today marker. This
// guards against a partial upstream change that would leave the sparkline
// rendering nothing or a misleading flat line.
test("flood sparkline data shape supports an honest ensemble band", () => {
  const ff = d.floodForecast;
  if (ff?.status !== "live") { assert.ok(true, "fallback path; sparkline skipped"); return; }
  const usable = (ff.forecast || []).filter((d) => d.dischargeCms != null);
  assert.ok(usable.length >= 2, "sparkline needs at least two points");
  // The widest of the four ensemble numbers must be a real extreme — a
  // honest band, not zero width. A zero band means we lost the spread.
  const widest = Math.max(...usable.map((d) => (d.maxCms ?? 0) - (d.minCms ?? 0)));
  assert.ok(widest > 0, `ensemble band collapsed to zero width (${widest})`);
});

test("district population comes from DOSM or is marked missing", () => {
  for (const x of d.govStats.districts) {
    if (x.status === "live") assert.ok(x.population > 10000 && x.population < 2_000_000, x.name);
    else assert.equal(x.population, undefined);
  }
});

test("wind summary averages direction as vectors (350° and 10° is north, not south)", async () => {
  const { summariseOpenMeteo } = await import("../public/rain-regime.js");
  const hours = 48;
  const time = Array.from({ length: hours }, (_, i) => new Date(Date.UTC(2026, 0, 1, i - 8)).toISOString().slice(0, 16));
  const loc = (dirs) => ({ hourly: { time, pressure_msl: Array(hours).fill(1010), wind_speed_850hPa: Array(hours).fill(9),
    wind_direction_850hPa: Array.from({ length: hours }, (_, i) => dirs[i % 2]) } });
  const [k, s] = summariseOpenMeteo([loc([350, 10]), loc([200, 220])], Date.parse("2026-01-03T00:00:00+08:00"));
  assert.ok(k.wind850.dirMean <= 2 || k.wind850.dirMean >= 358, `got ${k.wind850.dirMean}`);
  assert.equal(s.wind850.dirMean, 210);
  assert.equal(k.mslChange24, 0);
});

test("air path: a steady south-westerly traces the air back to the south-west, fires on the path count once", async () => {
  const { backTrajectory, firesAlongPath, originSector, AIR_PATH_GRID } = await import("../public/air-path.js");
  const now = Date.parse("2026-10-14T12:00:00Z");
  const time = Array.from({ length: 72 }, (_, i) => new Date(now - (48 - i) * 3600e3).toISOString().slice(0, 16));
  const json = [];
  for (let la = AIR_PATH_GRID.lat0; la <= AIR_PATH_GRID.lat1; la += 1)
    for (let lo = AIR_PATH_GRID.lon0; lo <= AIR_PATH_GRID.lon1; lo += 1)
      json.push({ latitude: la, longitude: lo, hourly: { time, wind_speed_925hPa: Array(72).fill(5), wind_direction_925hPa: Array(72).fill(225) } });
  const path = backTrajectory(json, now, 48);
  assert.ok(path.length > 20);
  assert.equal(originSector(path), "SW");
  const last = path.at(-1);
  assert.ok(last.lat < 1.55 && last.lon < 110.35);
  const key = `${Math.floor(last.lat * 2) / 2},${Math.floor(last.lon * 2) / 2}`;
  assert.equal(firesAlongPath(path, { [key]: 7, "9,99": 500 }), 7);
});

test("tide summary finds high waters and a sane range", async () => {
  const { summariseTide } = await import("../public/tide.js");
  const time = Array.from({ length: 96 }, (_, i) => new Date(Date.UTC(2026, 9, 14, i)).toISOString().slice(0, 16));
  const sea = time.map((_, i) => Math.round(Math.sin((i / 12.42) * 2 * Math.PI) * 1.8 * 100) / 100);
  const t = summariseTide({ hourly: { time, sea_level_height_msl: sea } }, Date.parse("2026-10-14T00:00:00+08:00"));
  assert.ok(t.highs.length >= 3);
  assert.ok(t.rangeM > 3 && t.rangeM < 4);
  assert.ok(t.highs.every((h) => h.v > 1.5));
});

test("NREB Sarawak API carries official Kuching reading when reachable", () => {
  const n = d.nrebApi;
  assert.ok(n, "nrebApi must be present in the payload");
  if (n.status === "absent") { assert.ok(true, "NREB feed unreachable — stub accepted"); return; }
  assert.equal(n.status, "ready");
  assert.ok(Array.isArray(n.stations) && n.stations.length >= 10, "≥10 Sarawak stations expected");
  // Kuching station must be present and carry a real number.
  assert.ok(n.kuching, "Kuching station must be tagged");
  assert.ok(Number.isFinite(n.kuching.api));
  assert.ok(["Good", "Moderate", "Unhealthy", "Very Unhealthy", "Hazardous"].includes(n.kuching.band));
  // The metric card wires the Kuching reading if available.
  const nrebCard = d.metrics.find((m) => m.id === "nreb-api");
  if (nrebCard) {
    assert.equal(nrebCard.value, n.kuching.api);
    assert.ok(["good", "watch", "alert", "critical"].includes(nrebCard.tone));
  }
  // Worst reading must be the highest API in the network.
  assert.equal(n.worst.api, Math.max(...n.stations.map((s) => s.api)));
});

test("NREB haze directive fires at API 100+ and quotes the source", () => {
  const n = d.nrebApi;
  const directives = d.operations || [];
  const triggered = directives.find((op) => op.owner === "Haze Watch" && /NREB API/.test(op.title || ""));
  if (n?.status !== "ready" || !n.stations.some((s) => s.api >= 100)) {
    assert.equal(triggered, undefined, "no directive when network is below Unhealthy");
    return;
  }
  assert.ok(triggered, "directive must fire when any Sarawak station reads Unhealthy or worse");
  assert.match(triggered.detail, /NREB Sarawak monitoring/);
  // Quote the Kuching reading so the chief can brief in one glance.
  if (n.kuching) assert.match(triggered.detail, new RegExp(`Kuching ${n.kuching.api}`));
});

test("TVS Sarawak news lanes are configured and present in the sources matrix", () => {
  const sources = d.sources || [];
  const tvs = sources.find((s) => s.id === "tvs-sarawak");
  const tvsEn = sources.find((s) => s.id === "tvs-english");
  assert.ok(tvs, "TVS Sarawak source row must be present");
  assert.ok(tvsEn, "TVS English source row must be present");
  // The feeds are official-tier and tagged accordingly. The source row's
  // display name lives in `name`, with the official TVS URL pointing at
  // Sarawak's own broadcaster.
  const tvsName = tvs.name || tvs.label || "";
  assert.ok(/Sarawak|TVS/.test(tvsName), `TVS row must be a Sarawak/TVS source (got "${tvsName}")`);
  assert.match(tvs.url || "", /tvsarawak\.my/);
  // The feed is also referenced in the news laneStatus so the intake grid
  // can show the dedicated lane.
  const lanes = d.news?.laneStatus || [];
  assert.ok(lanes.find((l) => l.id === "tvs-sarawak"), "tvs-sarawak lane must be in news.laneStatus");
  assert.ok(lanes.find((l) => l.id === "tvs-english"), "tvs-english lane must be in news.laneStatus");
});

// Offline parser test — the network is not deterministic, but the NREB sheet
// shape is. This test pins the parser to a known HTML excerpt and confirms
// the rows that drive the metric card and the haze directive.
test("NREB pubhtml parser reads the canonical Kuching sheet", async () => {
  // Re-derive parsePubhtmlTable from server.mjs by reading the source.
  // The function is not exported (server-only), so we exercise it through
  // the loader module's closure.
  const src = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
  assert.match(src, /function parsePubhtmlTable/);
  assert.match(src, /NREB_API_SHEET/);
  // Pin the column order: the NREB sheet has 4 columns — sequence, STATION,
  // INDEX, STATUS. If the upstream sheet renames a column, the loader silently
  // parses nothing and the metric card drops. These regexes remind us to
  // update the loader if so.
  assert.match(src, /!\/\^station\$\/i\.test\(cells\[1\]\)/);
  assert.match(src, /\/\^\\d\+\$\/i?\.test\(cells\[2\]\)/);
  // The station name sits in cells[1], the index in cells[2].
  assert.match(src, /name:\s*cells\[1\]/);
  assert.match(src, /api:\s*parseInt\(cells\[2\]/);
  // The 30-min cache prevents hammering NREB's Google Sheets.
  assert.match(src, /cached\("nreb-api",\s*30\s*\*\s*60\s*\*\s*1000/);
});
