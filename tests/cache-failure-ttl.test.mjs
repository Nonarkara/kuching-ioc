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
