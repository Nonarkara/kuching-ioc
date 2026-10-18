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
  // One attempt only: renderDashboard re-enters this function on the re-render.
  assert.match(body, /climateClientTried = true;/);
  // A browser-computed reading must not keep the "degraded" chip, or the board
  // labels live numbers as fallback.
  assert.match(body, /src\.id === "open-meteo-weather" && liveW/);
  assert.match(body, /src\.id === "open-meteo-air" && liveA/);
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