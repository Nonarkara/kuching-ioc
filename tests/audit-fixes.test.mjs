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
    assert.match(block, /anchorHourIndex\(times, current\.time\)/, `${fn} must anchor nowIdx to current.time`);
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
  // Assert the behaviour, not the expression. This previously pinned
  // `times.indexOf(c.time)`, which reads as "anchor to current.time" but is
  // not: Open-Meteo reports `current` at :00/:30 while `hourly` is hourly, so
  // that exact match returns -1 and collapses the block to the stub. See
  // tests/open-meteo-anchor.test.mjs.
  assert.match(block, /anchorHourIndex\(times, c\.time\)/,
    "client weather must anchor nowIdx to current.time");
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
  // The cadence is now a single "13 */4 * * *" — once every 4 h. The earlier
  // 30-min schedule was a phantom: GH Actions guarantees scheduled workflows
  // run at most every 5 min but de-duplicates in practice at 3–5 h. Match
  // the cron to the platform reality so the comment and the truth agree.
  const cronMatch = workflow.match(/cron:\s*"([^"]+)"/);
  assert.ok(cronMatch, "cron must be a quoted string");
  const cron = cronMatch[1].trim();
  assert.match(cron, /\*\/4/, "cron must be the 4-hour cadence (e.g. \"13 */4 * * *\")");
});

test("build step wires the optional source credentials without baking them (audit #2)", () => {
  // The dashboard never embeds a key. The build reads them from the env block
  // and the runner maps them to secrets; if any key leaks into the source,
  // this test should catch it.
  assert.match(workflow, /FIRMS_MAP_KEY:\s*\$\{\{\s*secrets\.FIRMS_MAP_KEY\s*\}\}/, "FIRMS_MAP_KEY must come from secrets");
  assert.match(workflow, /AQICN_TOKEN:\s*\$\{\{\s*secrets\.AQICN_TOKEN\s*\}\}/, "AQICN_TOKEN must come from secrets");
  assert.match(workflow, /VISITOR_BEACON_URL:\s*\$\{\{\s*secrets\.VISITOR_BEACON_URL\s*\}\}/, "VISITOR_BEACON_URL must come from secrets");
  // No raw key material in the workflow file itself.
  for (const key of ["FIRMS_MAP_KEY", "AQICN_TOKEN", "VISITOR_BEACON_URL"]) {
    assert.doesNotMatch(workflow, new RegExp(`${key}:\\s*['"]?[A-Za-z0-9_-]{20,}`), `${key} must not be inlined`);
  }
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
// --- Audit followup: visitor beacon restored with privacy note ---
test("index template ships the ipwho.is beacon with a privacy note and env-injected endpoint", async () => {
  const { readFile } = await import("node:fs/promises");
  const tpl = await readFile(new URL("../public/index.template.html", import.meta.url), "utf8");
  // The ipwho.is call is back.
  assert.match(tpl, /ipwho\.is/, "ipwho.is lookup must be wired");
  // Hard 4-s timeout — no risk of a slow third party stalling the boot.
  assert.match(tpl, /AbortSignal\.timeout\(4000\)/, "ipwho.is call must be timeout-bounded");
  // A privacy note sits next to the beacon, not just bare code.
  assert.match(tpl, /Visitor beacon/, "beacon must carry a privacy note");
  // The Apps Script endpoint comes from an env var, not a hardcoded URL.
  assert.match(tpl, /__VISITOR_BEACON_URL__/, "beacon URL must be env-injected");
  // The template processor must wire that placeholder to an env var.
  const sb = await readFile(new URL("../site-build.mjs", import.meta.url), "utf8");
  assert.match(sb, /__VISITOR_BEACON_URL__/);
  assert.match(sb, /VISITOR_BEACON_URL/, "site-build.mjs must read VISITOR_BEACON_URL");
});

// --- Audit followup: Supabase RLS runbook is documented ---
test("Supabase RLS one-liner is in the repo with a runbook and a default-deny policy", async () => {
  const { readFile } = await import("node:fs/promises");
  const sql = await readFile(new URL("../scripts/ops-monitoring-rls.sql", import.meta.url), "utf8");
  assert.match(sql, /ENABLE ROW LEVEL SECURITY/, "must enable RLS on the skills table");
  // Default-deny until the application adds a real policy. The service role
  // key bypasses RLS, so existing admin reads still work.
  assert.match(sql, /USING \(false\)/, "default-deny policy must be in place");
  // Idempotent: re-running is a no-op.
  assert.match(sql, /DROP POLICY IF EXISTS/, "policy create must be idempotent");
});

// 16 Oct: the beacon shipped as `window.""` (a syntax error on every load)
// and called ipwho.is even with no endpoint. Every inline script must parse,
// and an unset endpoint must mean no third-party call at all.
test("rendered inline scripts parse, and the beacon is silent without an endpoint", async () => {
  const { renderIndexHtml } = await import("../site-build.mjs");
  for (const url of ["", "https://script.google.com/macros/s/x/exec"]) {
    const html = await renderIndexHtml({ env: {}, assetVersion: "t", visitorBeaconUrl: url });
    for (const [, attrs, body] of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
      if (/json/.test(attrs) || !body.trim()) continue;
      assert.doesNotThrow(() => new Function(body), `inline script fails to parse: ${body.slice(0, 80)}`);
    }
    const beacon = html.slice(html.indexOf("Visitor beacon"));
    assert.ok(beacon.indexOf("if(!SH)return") < beacon.indexOf("ipwho.is/'"), "endpoint gate must precede the ipwho.is call");
  }
});

test("desktop keeps a real map column between brief and situation rail", async () => {
  const css = await readFile(new URL("../public/reading.css", import.meta.url), "utf8");
  assert.match(css, /@media\(min-width:1041px\)\s*\{\s*\.dashboard-shell \.board-grid\.war-room \{ grid-template-columns:clamp\(250px,19vw,340px\) minmax\(0,1fr\) clamp\(/);
  // The page frame is one viewport on desktop (28 Sep brief); no rule may reopen page scroll.
  assert.doesNotMatch(css, /min-width: 1041px\) \{\s*\.dashboard-shell \{\s*height: auto/);
});

// 18 Oct Rams pass: a city board, not a globe; one type scale; no page-wide texture.
test("3D camera is bounded to Greater Kuching and the sky is off", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app, /maximumZoomDistance = CESIUM_MAX_RANGE_M/);
  assert.match(app, /CESIUM_MAX_RANGE_M = (\d+)/);
  assert.ok(Number(app.match(/CESIUM_MAX_RANGE_M = (\d+)/)[1]) <= 100000, "3D zoom-out must stay city-scale");
  assert.match(app, /skyBox\.show = false/);
  assert.match(app, /camera\.moveEnd\.addEventListener\(\(\) => \{/);
});

test("Rams layer: three type sizes, no grid texture, partial river forecast is named", async () => {
  const css = await readFile(new URL("../public/reading.css", import.meta.url), "utf8");
  const rams = css.slice(css.indexOf("RAMS PASS"));
  assert.deepEqual([...new Set(rams.match(/var\(--t-(\w+)\)/g))].sort(), ["var(--t-body)", "var(--t-display)", "var(--t-micro)"]);
  assert.match(css, /body::before \{ display: none !important; \}/);
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(app.slice(app.indexOf("function renderFloodForecast")), /missingReaches/);
});

// Runtime check: actually execute the beacon with an empty endpoint and
// prove zero third-party calls go out. The source-order test above would
// still pass if a future refactor moved the gate after the fetch, so this
// is the load-bearing privacy assertion.
test("beacon runtime: empty endpoint makes zero fetch calls", async () => {
  const { renderIndexHtml } = await import("../site-build.mjs");
  const html = await renderIndexHtml({ env: {}, assetVersion: "t", visitorBeaconUrl: "" });
  const start = html.indexOf("(function(){");
  const end = html.indexOf("})();", start);
  const body = html.slice(start, end + 5);
  // Extract the literal __VISITOR_BEACON_URL__ that the template processor
  // should have already replaced. If anything is left, the test fixture is
  // broken — escapeScriptJson would not let this survive, so the assertion
  // doubles as a sanity check on the template pipeline.
  assert.doesNotMatch(body, /__VISITOR_BEACON_URL__/);
  const vm = await import("node:vm");
  const calls = [];
  const ctx = {
    fetch: (url) => { calls.push(String(url)); return Promise.resolve({ json: () => Promise.resolve({}) }); },
    navigator: { userAgent: "t", language: "en" },
    screen: { width: 1024, height: 768 },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "UTC" }) }) },
    AbortSignal: { timeout: () => new AbortController().signal },
    AbortController,
    setTimeout, clearTimeout, Promise, console,
  };
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  // Yield once so any microtask would have run.
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(calls, [], `empty endpoint must make zero third-party calls (saw: ${calls.join(", ")})`);
});

// Runtime check: a real endpoint DOES hit ipwho.is, then the operator's
// sheet. The source-order test would pass even if a refactor moved the
// fetch after the gate, so this confirms the gate is runtime-effective.
test("beacon runtime: configured endpoint makes exactly one ipwho.is call", async () => {
  const { renderIndexHtml } = await import("../site-build.mjs");
  const html = await renderIndexHtml({
    env: {},
    assetVersion: "t",
    visitorBeaconUrl: "https://script.google.com/macros/s/abc/exec",
  });
  const start = html.indexOf("(function(){");
  const end = html.indexOf("})();", start);
  const body = html.slice(start, end + 5);
  const vm = await import("node:vm");
  const calls = [];
  const ctx = {
    fetch: (url, init) => {
      calls.push({ url: String(url), method: init?.method || "GET" });
      if (String(url).includes("ipwho.is")) {
        return Promise.resolve({ json: () => Promise.resolve({ ip: "1.2.3.4", country: "MY", region: "Sarawak", city: "Kuching" }) });
      }
      return Promise.resolve({});
    },
    navigator: { userAgent: "t", language: "en" },
    screen: { width: 1024, height: 768 },
    Intl: { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: "UTC" }) }) },
    AbortSignal: { timeout: () => new AbortController().signal },
    AbortController, setTimeout, clearTimeout, Promise, console,
  };
  vm.createContext(ctx);
  vm.runInContext(body, ctx);
  await new Promise((r) => setImmediate(r));
  await new Promise((r) => setImmediate(r));
  const ipwho = calls.filter((c) => c.url.includes("ipwho.is"));
  const beacon = calls.filter((c) => c.url.includes("script.google.com"));
  assert.equal(ipwho.length, 1, "operator-configured beacon must hit ipwho.is exactly once");
  assert.equal(beacon.length, 1, "operator-configured beacon must post to the Apps Script endpoint");
});
