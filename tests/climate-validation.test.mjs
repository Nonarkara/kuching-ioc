import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { windowComplete, seriesContinuous, observationWindow, MAX_OBSERVATION_AGE_MS } from "../public/climate-validate.js";

// Regression for the 19 Oct release audit. The loaders validated windows with
// `.slice(a, b).every(Number.isFinite)`, which is:
//   - vacuously true for an EMPTY slice, and
//   - true for a SHORT one (3 elements where 6 were required).
// Both produced empty history and NaN forecasts while still returning
// status "live".

test("an empty or short window is not a complete window", () => {
  const full = Array.from({ length: 48 }, (_, i) => i + 1);
  assert.equal(windowComplete(full, 10, 6), true, "a full 6-wide window is complete");
  assert.equal(windowComplete([], 10, 6), false, "empty array must fail");
  assert.equal(windowComplete([1, 2, 3], 10, 6), false, "short array must fail");
  // `full` has 48 elements, so a 5-wide window here genuinely is complete —
  // the point of the fix is *length*, not an arbitrary minimum.
  assert.equal(windowComplete(full, 10, 5), true, "a 5-wide window over enough data is complete");
  assert.equal(windowComplete(full, 44, 6), false, "a window running past the end must fail");
  assert.equal(windowComplete(full, 10, 6), true, "exactly enough elements must pass");
  // A hole in the middle is not a complete window.
  const holed = [...full]; holed[12] = null;
  assert.equal(windowComplete(holed, 10, 6), false);
  assert.equal(windowComplete(holed, 11, 3), false, "a 3-wide window that straddles the hole must fail");
  assert.equal(windowComplete(holed, 10, 2), true, "a window entirely before the hole is unaffected");
  assert.equal(windowComplete([1, 2, NaN], 0, 3), false, "NaN is not finite");
  assert.equal(windowComplete(null, 0, 6), false);
  assert.equal(windowComplete(full, -1, 6), false, "a negative start is not a window");
});

test("an hourly series with a gap or a repeat is not continuous", () => {
  const good = Array.from({ length: 40 }, (_, i) => `2026-10-18T${String(Math.floor(i / 24)).padStart(2, "0")}:${String(i % 24).padStart(2, "0")}`.replace("2026-10-18T0", "2026-10-1") + (i < 24 ? "" : ""));
  // Simpler and unambiguous: build real consecutive hours.
  const start = Date.parse("2026-10-18T00:00:00+08:00");
  const hours = (n) => Array.from({ length: n }, (_, i) =>
    new Date(start + i * 3600000).toISOString().slice(0, 16).replace("T", "T"));
  const t = hours(48);
  assert.equal(seriesContinuous(t, 24, 6), true);
  assert.equal(seriesContinuous(t, 0, 24), true);

  const gapped = [...t]; gapped[25] = "2026-10-18T05:00"; // jumps 2h
  assert.equal(seriesContinuous(gapped, 24, 6), false, "a two-hour jump is a gap");
  const duped = [...t]; duped[25] = duped[24];
  assert.equal(seriesContinuous(duped, 24, 6), false, "a duplicated stamp is not continuous");
  assert.equal(seriesContinuous(t, 45, 6), false, "a window past the end must fail");
  assert.equal(seriesContinuous([], 0, 6), false);
});

test("an observation that is stale or from the future is not 'now'", () => {
  const now = Date.parse("2026-10-19T09:00:00+08:00");
  // Fresh readings must pass — this validator must never suppress live data.
  assert.equal(observationWindow("2026-10-19T09:00", now), null, "current hour is fine");
  assert.equal(observationWindow("2026-10-19T08:30", now), null, "half an hour old is fine");
  assert.equal(observationWindow("2026-10-19T03:01", now), null, "just inside the 6h ceiling is fine");
  // A stuck feed, or a fixture dated years ago.
  assert.equal(observationWindow("2026-10-19T02:59", now), "current.time[stale]");
  assert.equal(observationWindow("2020-01-01T00:00", now), "current.time[stale]");
  assert.equal(observationWindow("2030-01-01T00:00", now), "current.time[future]");
  assert.equal(observationWindow("2026-10-19T09:29", now), null, "small skew is tolerated");
  assert.equal(observationWindow("2026-10-19T09:31", now), "current.time[future]", "beyond the skew allowance");
  assert.equal(observationWindow("not-a-time", now), "current.time");
  assert.equal(observationWindow(undefined, now), "current.time");
  // The ceiling must be generous enough for a real bake to pass it.
  assert.ok(MAX_OBSERVATION_AGE_MS >= 3 * 3600000, "3h minimum — the bake is not instant");
});

test("all four loaders use the shared validators, not slice-and-every", async () => {
  const server = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(server, /import \{ windowComplete, seriesContinuous, observationWindow \} from "\.\/public\/climate-validate\.js";/);
  assert.match(app, /climate-validate\.js\?v=\$\{encodeURIComponent\(__ASSET_VER__\)\}`\)/);

  for (const [name, src] of [["server.mjs", server], ["public/app.js", app]]) {
    assert.ok(!/a\.slice\(nowIdx[^)]*\)\.every\(/.test(src),
      `${name} must not validate a window with slice().every() — empty and short slices both pass`);
    assert.equal((src.match(/windowComplete\(a, nowIdx/g) || []).length, 4,
      `${name} must validate both the next-6h and past-24h window in both loaders`);
    assert.equal((src.match(/seriesContinuous\(times, nowIdx/g) || []).length, 4,
      `${name} must check hourly continuity in both loaders`);
    assert.equal((src.match(/observationWindow\(/g) || []).length, 2,
      `${name} must bound observation age in both loaders`);
  }
});

test("a live climate reading records its observation time, not only its fetch time", async () => {
  const server = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  // observedAt already existed for hydro/APIMS; climate joins that convention.
  assert.equal((server.match(/observedAt: current\.time/g) || []).length, 2, "both server climate returns");
  assert.equal((app.match(/observedAt: c\.time/g) || []).length, 2, "both client climate returns");
  // The comment naming the distinction must survive, or a future edit can merge
  // the two fields back together without anything failing.
  assert.match(server, /retrieval of an old reading is still an old reading/);
});
test("a climate card cannot claim a freshness it does not have", async () => {
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const fn = app.slice(app.indexOf("function metricFreshness"), app.indexOf("function renderMetrics"));

  // The literal "60 s" is the local loader cadence; on Pages the same card sat
  // beside a snapshot the 4 h bake can leave hours old.
  assert.match(app, /fresh: "60 s"/, "the cadence stays as the declared fallback");
  assert.match(fn, /reading\.observedAt \|\| reading\.updatedAt/,
    "age must come from the observation, falling back to retrieval time");
  assert.match(fn, /static-snapshot" \? " · baked"/,
    "the tier must be visible — a baked snapshot is not a live feed");
  assert.match(fn, /computedIn === "browser" \? " · browser-completed"/,
    "a browser-completed reading must say so");
  // No usable timestamp must fall back rather than invent an age.
  assert.match(fn, /if \(!stamp\) return fallback;/);
  assert.match(fn, /if \(!Number\.isFinite\(t\)\) return fallback;/);
  // Open-Meteo stamps are local without an offset; our own updatedAt is UTC.
  assert.match(fn, /\+08:00/);
  // And the rendered strings are escaped like every other external value.
  assert.match(app, /<span class="src-name">\$\{escapeHtml\(prov\.src\)\}<\/span>/);
  assert.match(app, /<span class="src-fresh">\$\{escapeHtml\(fresh\)\}<\/span>/);
});
