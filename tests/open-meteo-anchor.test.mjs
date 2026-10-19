import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { anchorHourIndex } from "../public/open-meteo-anchor.js";

// Regression: every Open-Meteo loader anchored its hourly windows with
//   hourly.time.indexOf(current.time)
// The forecast endpoint reports current at :00/:30 (derived from the location
// UTC offset) while hourly is always hourly, so that returned -1 half the time,
// failed the single `nowIdx >= 24` check, and threw away a real observation in
// favour of the fallback stub. Production carried
// degradedFields: ["hourly.time[now-24]"] with fabricated current values.

const isoHour = (h) => `2026-10-19T${String(h).padStart(2, "0")}:00`;

test("anchorHourIndex handles the half-hour observation the forecast endpoint actually sends", () => {
  const times = [19, 20, 21].flatMap((day) => Array.from({ length: 24 }, (_, h) => `2026-10-${day}T${String(h).padStart(2, "0")}:00`));
  // Captured from api.open-meteo.com/v1/forecast for 1.53/110.35, +08:00.
  assert.equal(anchorHourIndex(times, "2026-10-19T00:30"), 0, "must snap :30 back to the 00:00 bucket, not -1");
  assert.equal(anchorHourIndex(times, "2026-10-20T13:00"), 37, "an exact hour must still match exactly");
  assert.equal(anchorHourIndex(times, "2026-10-21T13:00"), 61, "observation past the series anchors to the last bucket");
});

test("anchorHourIndex refuses to invent an anchor", () => {
  const times = Array.from({ length: 24 }, (_, h) => isoHour(h));
  assert.equal(anchorHourIndex(times, "2026-10-18T22:15"), -1, "observation before the series is not an anchor");
  assert.equal(anchorHourIndex(times, ""), -1);
  assert.equal(anchorHourIndex(times, null), -1);
  assert.equal(anchorHourIndex(times, undefined), -1);
  assert.equal(anchorHourIndex(null, "2026-10-19T00:30"), -1);
  assert.equal(anchorHourIndex("not-an-array", "2026-10-19T00:30"), -1);
});

test("an anchored :30 observation still yields real next-6h and past-24h windows", () => {
  // The shape that used to break: the observation sits between hourly buckets,
  // yet every window the loaders slice must still be populated and finite.
  const times = Array.from({ length: 72 }, (_, i) => `2026-10-${18 + Math.floor(i / 24)}T${String(i % 24).padStart(2, "0")}:00`);
  const temp = times.map((_, i) => 25 + (i % 7));
  const nowIdx = anchorHourIndex(times, "2026-10-19T00:30");
  assert.ok(nowIdx >= 24, "past-24h window must be satisfiable");
  assert.ok(nowIdx + 6 <= times.length, "next-6h window must be satisfiable");
  assert.equal(temp.slice(nowIdx, nowIdx + 6).length, 6);
  assert.equal(temp.slice(nowIdx, nowIdx + 6).every(Number.isFinite), true);
  assert.equal(temp.slice(nowIdx - 24, nowIdx).length, 24);
  assert.equal(temp.slice(nowIdx - 24, nowIdx).every(Number.isFinite), true);
  // "next 6h" must start at the current hour bucket, never run backwards.
  assert.equal(times[nowIdx], "2026-10-19T00:00");
});

test("the static tier can finish climate in the browser when the bake could not", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const body = app.slice(app.indexOf("async function completeClimateInBrowser"), app.indexOf("async function loadEarthquakes"));

  // Rain regime already had this; climate did not, so a refused CI runner left
  // the Pages board on buildWeatherFallback() constants for the whole window.
  assert.match(app, /async function completeClimateInBrowser\(payload\)/);
  // Must actually be called — an unreferenced helper is the shape of the bug.
  const rd = app.slice(app.indexOf("function renderDashboard(payload)"), app.indexOf("function renderDashboard(payload)") + 200);
  assert.match(rd, /completeClimateInBrowser\(payload\);/);

  // Must reuse the validated loaders, not a second parse that could drift.
  assert.match(body, /wantWeather \? loadWeather\(\)/);
  assert.match(body, /wantAir \? loadAirQuality\(\)/);
  // Only a genuinely non-live reading is worth a browser round trip.
  assert.match(body, /climate\.weather\.status !== "live"/);
  assert.match(body, /climate\.air\.status !== "live"/);
  // Only the baked tier needs it — the live API is already refreshing server-side.
  assert.match(body, /mode !== "static-snapshot"/);
  // A browser-computed reading must not keep the "degraded" chip, or the board
  // labels live numbers as fallback.
  assert.match(body, /src\.id === "open-meteo-weather" && liveW/);
  assert.match(body, /src\.id === "open-meteo-air" && liveA/);
});

test("browser recovery cannot leave the board showing two different readings", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const helper = app.slice(app.indexOf("function applyClimateToPayload"), app.indexOf("async function loadEarthquakes"));

  // The audit's P1: the first version swapped payload.climate and stopped, so
  // metrics/summary/operations still held the bake's fallback numbers — the
  // panel read 24 °C beside a metric strip reading 30 °C.
  assert.match(helper, /const nextSummary = buildSummary\(/);
  assert.match(helper, /const nextOperations = buildOperations\(/);
  assert.match(helper, /applyClimateToPayload\(payload, nextWeather, nextAir\)/);

  // Recompute from the same builders the bake used, not a hand-rolled subset.
  assert.match(helper, /buildMetrics\(weather, air, airport, jurisdictions, news, zoning, trends\)/);
  // buildOperations dereferences padawanZoning.wardCount, but the server
  // publishes zoning under mapScene — passing payload.padawanZoning straight
  // through (it is undefined on a baked payload) throws a TypeError and the
  // recovery silently does nothing.
  assert.match(helper, /payload\.mapScene/);
  assert.match(helper, /wardCount: payload\.mapScene\.wardCount/);
});

test("recovering climate must not delete the non-climate metric cards", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const helper = app.slice(app.indexOf("function applyClimateToPayload"), app.indexOf("async function loadEarthquakes"));

  // The server's strip has 14 cards; the client's buildMetrics emits 8 with
  // different ids. Assigning buildMetrics() wholesale would drop nreb-api,
  // wards, population, headlines, trends and flood-watch and rename
  // padawan-share to pdw-share. Only the four climate cards may change.
  assert.match(helper, /const CLIMATE_CARD_IDS = \["heat", "aqi", "pm25", "rain6h"\];/);
  assert.match(helper, /nextMetrics = payload\.metrics\.map\(/,
    "the strip must be mapped in place, preserving card count, order and ids");
  assert.match(helper, /if \(nextMetrics\) payload\.metrics = nextMetrics;/,
    "the mapped strip must still reach the payload");
  assert.ok(!/payload\.metrics = buildMetrics\(/.test(helper),
    "a wholesale assignment drops the seven server-only cards");
  // id/label/unit come from the baked card so i18n and the source map resolve.
  assert.match(helper, /\.\.\.next, id: m\.id, label: m\.label, unit: m\.unit/);
});

test("the baked payload actually contains the keys the recovery recompute reads", async () => {
  // Structural assertions pass while behaviour is destructive. Read the real
  // committed snapshot so a key rename breaks here, not in the browser.
  const payloadPath = new URL("../public/api/dashboard.json", import.meta.url);
  let raw;
  try {
    raw = await fs.readFile(payloadPath, "utf8");
  } catch {
    return; // no baked snapshot committed yet; the structural guards still run
  }
  const d = JSON.parse(raw);
  for (const key of ["jurisdictions", "news", "trends", "airport", "fires", "quakes", "climate", "metrics", "summary", "operations", "mapScene"]) {
    assert.ok(d[key] !== undefined, `baked payload is missing "${key}" — applyClimateToPayload would break`);
  }
  assert.ok(Array.isArray(d.metrics) && d.metrics.length >= 10,
    `expected the full metric strip, got ${(d.metrics || []).length}`);
  assert.ok(d.mapScene.wardCount != null, "mapScene.wardCount feeds buildOperations");
  // And the four climate cards the recovery rewrites must actually exist.
  for (const id of ["heat", "aqi", "pm25", "rain6h"]) {
    assert.ok(d.metrics.some((m) => m.id === id), `no "${id}" card to recover`);
  }
});

test("browser recovery is bounded, retryable, and cannot paint a superseded payload", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const fn = app.slice(app.indexOf("async function completeClimateInBrowser"), app.indexOf("async function loadEarthquakes"));

  // Ownership: checked before the await AND after it. Checking only before was
  // the defect — a slow response landed on a newer 60s payload.
  assert.equal((fn.match(/payload !== state\.payload/g) || []).length, 2,
    "identity must be re-checked after awaiting the fetch, not only before");
  // Bounded: a latching one-shot flag blocked every later snapshot forever, and
  // a failed first attempt could not retry until reload.
  assert.match(app, /const climateRecovery = \{ attempts: 0, max: \d+, inflight: false/);
  assert.match(fn, /climateRecovery\.attempts >= climateRecovery\.max/);
  assert.match(fn, /climateRecovery\.inflight = true;/);
  assert.match(fn, /finally \{[\s\S]*climateRecovery\.inflight = false;/);
  // A healthy snapshot must give the next degraded one a fresh retry budget.
  assert.match(fn, /climateRecovery\.forSnapshot !== snapshotId/);
});

test("every Open-Meteo anchor site uses anchorHourIndex, not an exact indexOf match", async () => {
  const server = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(server, /import \{ anchorHourIndex \} from "\.\/public\/open-meteo-anchor\.js";/);
  assert.match(app, /import\(`\.\/open-meteo-anchor\.js\?v=\$\{encodeURIComponent\(__ASSET_VER__\)\}`\)/);

  // Four call sites: server weather, server air quality, client weather, client air quality.
  // Slice from the weather loader to the next unrelated loader so both the
  // weather and the air-quality bodies are inside the window.
  const sites = [
    ["server.mjs", server, (s) => s.slice(s.indexOf("async function loadWeather"), s.indexOf("async function loadEarthquakes"))],
    ["public/app.js", app, (s) => s.slice(s.indexOf("async function loadWeather"), s.indexOf("async function loadEarthquakes"))],
  ];
  for (const [name, src, slice] of sites) {
    const body = slice(src);
    assert.ok(body.includes("anchorHourIndex(times"), `${name} must anchor via anchorHourIndex`);
    assert.ok(
      !/times\.indexOf\((c|current)\.time\)/.test(body),
      `${name} still exact-matches current.time against the hourly series — that is the bug`,
    );
    assert.equal(
      (body.match(/anchorHourIndex\(times/g) || []).length,
      2,
      `${name} must anchor both the weather and the air-quality loader`,
    );
  }
});
test("a partially-applied recovery is impossible", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const helper = app.slice(app.indexOf("function applyClimateToPayload"), app.indexOf("async function loadEarthquakes"));
  const fn = app.slice(app.indexOf("async function completeClimateInBrowser"), app.indexOf("async function loadEarthquakes"));

  // The builders can throw on an unexpected payload shape. If the payload is
  // mutated before that, a failure leaves live climate beside stale metrics and
  // nothing ever corrects it. Compute first, commit last.
  const applyIdx = helper.indexOf("applyClimateToPayload");
  assert.ok(applyIdx > -1);
  const firstClimateAssign = helper.indexOf("payload.summary = nextSummary;");
  assert.ok(firstClimateAssign > -1 && helper.indexOf("const nextSummary =") < firstClimateAssign,
    "nextSummary must be computed before it is assigned");
  assert.match(helper, /\/\/ --- commit ---/, "commit phase must be visually separated");
  assert.match(fn, /try \{[\s\S]*applyClimateToPayload\(payload, nextWeather, nextAir\);[\s\S]*\} catch \{[\s\S]*return;/,
    "a throwing recompute must abandon the update, not leave it half-applied");
  // And the payload must not be touched before the try succeeds.
  const climateAssign = fn.indexOf("climate.weather = nextWeather;");
  const tryIdx = fn.indexOf("try {", fn.indexOf("const nextWeather"));
  assert.ok(tryIdx > -1 && climateAssign > tryIdx,
    "climate is swapped only after the recompute succeeded");
});
