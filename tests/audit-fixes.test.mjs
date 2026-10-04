import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const appJs = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const serverJs = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
const buildJs = await readFile(new URL("../build.mjs", import.meta.url), "utf8");
const workflow = await readFile(
  new URL("../.github/workflows/cloudflare-pages.yml", import.meta.url),
  "utf8",
);

// --- Audit #10: OSM-derived tooltip properties are escaped at the HTML boundary ---
test("OSM tooltip properties are escaped before interpolation (audit #10)", () => {
  // The catch-all feature tooltip builder must escape p.name, p.kind, p.ref,
  // p.lanes, p.tunnel. The ward tooltip must escape p.wardCode, p.wardLabel, p.area.
  // Audit #10: prior code interpolated raw, leaving tags.name from Overpass open
  // to an attacker-controlled HTML injection.
  const tooltipBlock = appJs.slice(
    appJs.indexOf("Index sub-layers by feature id"),
    appJs.indexOf("lyr.bindTooltip(lines.join"),
  );
  assert.match(
    tooltipBlock,
    /escapeHtml\(p\.name\)/,
    "feature tooltip must escape p.name",
  );
  assert.match(
    tooltipBlock,
    /escapeHtml\(p\.wardLabel\)/,
    "ward tooltip must escape p.wardLabel",
  );
  assert.match(
    tooltipBlock,
    /escapeHtml\(p\.area/,
    "ward tooltip must escape p.area",
  );
  assert.match(
    tooltipBlock,
    /escapeHtml\(p\.wardCode/,
    "ward tooltip must escape p.wardCode",
  );
  // No raw `${p.name}` or `${p.kind}` should reach the tooltip string.
  assert.doesNotMatch(
    tooltipBlock,
    /`[^`]*\$\{p\.name\}[^`]*`/,
    "p.name is interpolated raw",
  );
  assert.doesNotMatch(
    tooltipBlock,
    /`[^`]*\$\{p\.wardLabel\}[^`]*`/,
    "p.wardLabel is interpolated raw",
  );
});

// --- Audit #8: stale forecast does NOT generate "Do this today" directives ---
test("stale forecast does not produce directive rows (audit #8)", () => {
  // The forecast-driven directive block must check forecast.status === "live"
  // before adding river-rising / air-quality degrade items. A STALE badge on a
  // separate panel does not protect downstream action advice.
  const block = serverJs.slice(
    serverJs.indexOf("forecast-driven directives"),
    serverJs.indexOf("dis.quantiles.p90.length"),
  );
  assert.match(
    block,
    /forecastFresh/,
    "buildOperations must gate forecast directives on a fresh forecast",
  );
  assert.match(
    block,
    /forecast\.status\s*===\s*['"]live['"]/,
    "forecast gate must require status === live",
  );
});

// --- Audit #11: weather + air loaders refuse to label an incomplete payload "live" ---
test("weather loader rejects incomplete payload with degraded status (audit #11)", () => {
  // The schema check must list required current + hourly fields and fall back
  // to the labelled stub when any are missing. Silent zero-as-live is the bug.
  const block = serverJs.slice(
    serverJs.indexOf("async function loadWeather"),
    serverJs.indexOf("async function loadAirQuality"),
  );
  assert.match(block, /missing/);
  assert.match(block, /current\.temperature_2m/);
  assert.match(block, /hourly\.temperature_2m/);
  assert.match(block, /degraded/);
});

test("air-quality loader rejects incomplete payload with degraded status (audit #11)", () => {
  const block = serverJs.slice(
    serverJs.indexOf("async function loadAirQuality"),
    serverJs.indexOf("async function loadFires"),
  );
  assert.match(block, /missing/);
  assert.match(block, /current\.us_aqi/);
  assert.match(block, /hourly\.us_aqi/);
  assert.match(block, /degraded/);
  // Every field the live return reads must be validated — a partial check
  // lets missing optional-looking fields serialize as null while the row
  // still claims "live".
  for (const field of ["current.ozone", "current.nitrogen_dioxide", "hourly.pm2_5", "hourly.time"]) {
    assert.ok(block.includes(field), `air loader must validate ${field}`);
  }
});

test("weather loader validates every field its live return reads (audit #11)", () => {
  const block = serverJs.slice(
    serverJs.indexOf("async function loadWeather"),
    serverJs.indexOf("async function loadAirQuality"),
  );
  for (const field of [
    "current.apparent_temperature",
    "current.relative_humidity_2m",
    "current.cloud_cover",
    "current.pressure_msl",
    "current.weather_code",
    "hourly.precipitation_probability",
    "daily.temperature_2m_min",
    "daily.precipitation_sum",
    "daily.uv_index_max",
    "daily.sunrise",
    "daily.sunset",
  ]) {
    assert.ok(block.includes(field), `weather loader must validate ${field}`);
  }
});

// --- Window anchoring: "next 6h"/"past 24h" are clock hours, not offsets ---
test("server loaders anchor windows to current.time, never fixed offsets (audit #11b)", () => {
  // forecast_hours truncates hourly to only future hours and drops past_days,
  // which made slice(24,30) empty and rain6h report a false 0mm as fact.
  assert.ok(!serverJs.includes('searchParams.set("forecast_hours"'),
    'neither loader may set "forecast_hours"');
  for (const fn of ["async function loadWeather", "async function loadAirQuality"]) {
    const start = serverJs.indexOf(fn);
    const end = serverJs.indexOf("async function", start + 10);
    const block = serverJs.slice(start, end > 0 ? end : undefined);
    assert.match(block, /times\.indexOf\(current\.time\)/, `${fn} must locate nowIdx from current.time`);
    assert.match(block, /slice\(nowIdx, nowIdx \+ 6\)|slice\(nowIdx, nowIdx\+6\)/, `${fn} must slice next 6h from nowIdx`);
    assert.match(block, /slice\(nowIdx - 24, nowIdx\)/, `${fn} must slice past 24h from nowIdx`);
    assert.ok(!block.includes("slice(24, 30)") && !block.includes("slice(24,30)"),
      `${fn} must not use the fixed 24..30 offset`);
  }
});

test("client fallback loaders anchor windows the same way (audit #11b)", () => {
  // Tier-3 Pages path builds weather/air in the browser — same bug, same fix.
  assert.ok(!appJs.includes('searchParams.set("forecast_hours"'),
    'client loaders may not set "forecast_hours"');
  const wStart = appJs.indexOf("async function loadWeather");
  const wEnd = appJs.indexOf("async function loadEarthquakes");
  const block = appJs.slice(wStart, wEnd);
  assert.match(block, /times\.indexOf\(c\.time\)/, "client weather must locate nowIdx from current.time");
  assert.ok(!block.includes("slice(24,30)") && !block.includes("slice(24, 30)"),
    "client weather must not use the fixed 24..30 offset");
  assert.match(block, /WEATHER_FALLBACK, updatedAt: nowIso\(\), status: "degraded"/,
    "incomplete client payload must route to the labelled stub, not print zeros");
});

// --- Audit #13: the build contract never writes an unvalidated artifact ---
test("dashboard payload is parsed before it is written (audit #13)", () => {
  const parseIdx = buildJs.indexOf("JSON.parse(dashboard)");
  const writeIdx = buildJs.indexOf("writeFile(dashboardPath, dashboard)");
  assert.ok(parseIdx > 0 && writeIdx > 0, "both parse and write present");
  assert.ok(parseIdx < writeIdx, "dashboard must be parsed before writing");
});

test("layer bodies are validated as non-empty FeatureCollections before atomic write (audit #13)", () => {
  // A rejected layer must leave the committed snapshot in place — the build
  // records `rejected` in the manifest instead of corrupting the artifact.
  const block = buildJs.slice(buildJs.indexOf("const results = await Promise.allSettled"));
  assert.match(block, /FeatureCollection/);
  assert.match(block, /fc\.features\.length === 0/);
  const parseIdx = block.indexOf("JSON.parse(body)");
  const writeIdx = block.indexOf("writeFile(tmpPath");
  assert.ok(parseIdx > 0 && writeIdx > 0, "both parse and write present");
  assert.ok(parseIdx < writeIdx, "layer body must be parsed before writing");
  assert.match(block, /rename\(tmpPath, path\)/, "layer write must be atomic (tmp + rename)");
});

// --- Audit #2: scheduled refresh keeps the baked snapshot operationally fresh ---
test("deploy workflow schedules a recurring snapshot refresh (audit #2)", () => {
  assert.match(workflow, /schedule:/, "workflow must declare a schedule trigger");
  assert.match(workflow, /cron:/, "workflow must declare a cron cadence");
  // Deploy must also be serialised so a push racing the cron cannot publish
  // two snapshots out of order.
  assert.match(workflow, /concurrency:/, "workflow must serialise deploys");
  // Scheduled builds hit the same test gate as pushes.
  const schedIdx = workflow.indexOf("schedule:");
  const testIdx = workflow.indexOf("node --test");
  assert.ok(schedIdx > 0 && testIdx > 0, "schedule and test steps both present");
});

// --- Audit #6: deploy workflow runs the test suite before publishing ---
test("Cloudflare Pages deploy workflow runs tests before publishing (audit #6)", () => {
  // The CI pipeline must fail on a red test suite — a green test suite is the
  // minimum acceptance threshold before bytes reach the live site.
  assert.match(
    workflow,
    /node\s+--test\s+tests\/\*\.test\.mjs/,
    "workflow must invoke `node --test tests/*.test.mjs`",
  );
  // Tests must run BEFORE `node build.mjs` and the deploy step.
  const testIdx = workflow.indexOf("node --test");
  const buildIdx = workflow.indexOf("node build.mjs");
  const deployIdx = workflow.indexOf("pages deploy");
  assert.ok(testIdx > 0 && buildIdx > 0 && deployIdx > 0, "all three steps present");
  assert.ok(
    testIdx < buildIdx,
    "test step must run before the build step",
  );
  assert.ok(
    buildIdx < deployIdx,
    "build step must run before the deploy step",
  );
});