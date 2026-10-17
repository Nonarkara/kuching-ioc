import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

test("cached() gives degraded results a short TTL so transient failures recover", async () => {
  const src = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function cached("), src.indexOf("const FAILED_TTL_MS"));
  assert.match(fn, /"fallback"/);
  assert.match(fn, /Math\.min\(ttlMs, FAILED_TTL_MS\)/);
  const m = src.match(/const FAILED_TTL_MS = ([^;]+);/);
  assert.ok(m && eval(m[1]) <= 5 * 60 * 1000, "failed TTL must be <= 5 min");
});

test("GloFAS loader retries each point once before falling back", async () => {
  const src = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function loadFloodForecast"), src.indexOf("function buildFloodZones"));
  assert.equal((fn.match(/fetchJson\(url/g) || []).length, 2);
});

// Partial-failure mode: if some reaches succeed and others fail twice,
// the loader must NOT take the whole basin to fallback. Operators should
// see which reaches are missing, not an empty "Sarawak River at Kuching"
// with no explanation.
test("GloFAS loader returns partial coverage when some reaches fail twice", async () => {
  const src = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("async function loadFloodForecast"), src.indexOf("function buildFloodZones"));
  // The inner function must catch the second failure and return null
  // rather than throw — so Promise.all resolves and the outer code can
  // distinguish "all points dead" from "some points alive".
  assert.match(fn, /try \{ data = await fetchJson\(url, 15000\); \} catch \{ \/\* leave null \*\/ \}/);
  // Status is "live" only when every requested point responded; otherwise
  // "partial" is the honest answer.
  assert.match(fn, /status: reached === requested \? "live" : "partial"/);
  // The loader must surface which points were asked for but failed, so a
  // "partial" status names its own gap rather than faking a clean rail.
  assert.match(fn, /missingReaches/);
});
