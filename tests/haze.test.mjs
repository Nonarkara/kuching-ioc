import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { apiBand, hazeState, hazeAdvice, inflowPath, LOCAL_STATIONS, NREB_STATION_COORDS } from "../public/haze.js";

test("API bands follow Malaysia's published scale at every boundary", () => {
  assert.equal(apiBand(50).key, "good");
  assert.equal(apiBand(51).key, "moderate");
  assert.equal(apiBand(100).key, "moderate");
  assert.equal(apiBand(101).key, "unhealthy");
  assert.equal(apiBand(200).key, "unhealthy");
  assert.equal(apiBand(201).key, "veryUnhealthy");
  assert.equal(apiBand(301).key, "hazardous");
  assert.equal(apiBand(NaN), null);
  assert.equal(apiBand(-1), null);
});

test("the official NREB reading outranks the model, and the model says it is one", () => {
  const nrebApi = { status: "ready", takenAt: "19 Oct 10:00", stations: [
    { name: "KUCHING", api: 151 }, { name: "MIRI", api: 300 }, { name: "SERIAN (MCAQM)", api: 153 }] };
  const climate = { air: { current: { aqi: 69 } } };
  const h = hazeState({ nrebApi, climate });
  assert.equal(h.tier, "official");
  assert.equal(h.api, 151);
  assert.equal(h.band.key, "unhealthy");
  // Miri is Sarawak context, not Greater Kuching's air.
  assert.deepEqual(h.local.map((s) => s.name).sort(), ["KUCHING", "SERIAN (MCAQM)"]);
  assert.equal(h.worst.name, "SERIAN (MCAQM)");
  const m = hazeState({ nrebApi: { status: "unavailable" }, climate });
  assert.equal(m.tier, "model");
  assert.equal(m.api, 69);
  assert.equal(hazeState({}), null);
});

test("every local station has a map position and advice exists in three languages", () => {
  for (const name of LOCAL_STATIONS) assert.ok(Array.isArray(NREB_STATION_COORDS[name]), name);
  for (const lang of ["en", "ms", "zh"]) {
    for (const api of [20, 80, 150, 250, 350]) {
      const a = hazeAdvice(apiBand(api), lang);
      assert.ok(a.label && a.public.length > 0, `${lang} ${api}`);
      assert.ok(a.ui.title && a.ui.official && a.ui.model && a.ui.flow, `${lang} ui`);
    }
    // Unhealthy must tell the council to act, not just watch.
    assert.ok(hazeAdvice(apiBand(150), lang).council.length >= 3, lang);
  }
});

test("inflow path runs from the oldest point to Kuching and stays within the window", () => {
  const path = [0, 3, 6, 12, 18, 24, 36].map((h) => ({ hoursAgo: h, lat: 1.55 - h * 0.02, lon: 110.35 - h * 0.02 }));
  const flow = inflowPath(path, 18);
  assert.deepEqual(flow.map((p) => p.hoursAgo), [18, 12, 6, 3, 0]);
  assert.deepEqual(inflowPath([], 18), []);
});

test("the bake and the board both read haze through the shared module", () => {
  const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");
  const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
  assert.match(server, /from "\.\/public\/haze\.js"/);
  assert.match(server, /buildSummary\([^)]*nrebApi\)/);
  assert.match(app, /await import\(`\.\/haze\.js/);
  assert.match(app.slice(app.indexOf("function renderVerdict")), /hazeState\(payload\)/);
});
