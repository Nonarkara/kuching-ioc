#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Sheets archive: ship a snapshot row to Google Sheets on every CI run.
//
// Reads public/api/dashboard.json (baked by build.mjs), spreads the payload
// across a dozen tabs, and appends one timestamped row per stream. Two
// reference tabs (councillors_roster, localities_master) are overwritten.
//
// No npm deps — uses Node crypto to sign a service-account JWT and hits the
// Sheets REST API directly. Skips cleanly if secrets are absent so CI doesn't
// fail on first-time deploys before the sheet is provisioned.
//
// Required env vars:
//   GOOGLE_SHEETS_ID               - target spreadsheet id (from the URL)
//   GOOGLE_SERVICE_ACCOUNT_JSON    - full service-account key JSON
// ---------------------------------------------------------------------------

import { readFile } from "node:fs/promises";
import { createSign } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const DASHBOARD_PATH = join(ROOT, "public", "api", "dashboard.json");

const SHEETS_ID = process.env.GOOGLE_SHEETS_ID;
const SA_JSON = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

if (!SHEETS_ID || !SA_JSON) {
  console.log("sheets-archive: skipping — GOOGLE_SHEETS_ID or GOOGLE_SERVICE_ACCOUNT_JSON not set.");
  process.exit(0);
}

// --- JWT + OAuth token exchange ---------------------------------------------

const base64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(toSign);
  const signature = signer.sign(credentials.private_key);
  const jwt = `${toSign}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

// --- Sheets REST helpers ----------------------------------------------------

class Sheets {
  constructor(token, sheetId) {
    this.token = token;
    this.sheetId = sheetId;
    this.base = `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}`;
  }
  async _req(path, init = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${this.token}`,
        "Content-Type": "application/json",
        ...(init.headers || {}),
      },
    });
    if (!res.ok) throw new Error(`Sheets ${init.method || "GET"} ${path}: ${res.status} ${await res.text()}`);
    return res.json();
  }
  async listTabs() {
    const data = await this._req("?fields=sheets(properties(title))");
    return new Set(data.sheets.map((s) => s.properties.title));
  }
  async addTabs(titles) {
    if (!titles.length) return;
    await this._req(":batchUpdate", {
      method: "POST",
      body: JSON.stringify({
        requests: titles.map((title) => ({ addSheet: { properties: { title } } })),
      }),
    });
  }
  async appendRows(tab, rows) {
    if (!rows.length) return;
    await this._req(
      `/values/${encodeURIComponent(tab)}!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      { method: "POST", body: JSON.stringify({ values: rows }) },
    );
  }
  async replaceRows(tab, rows) {
    await this._req(`/values/${encodeURIComponent(tab)}!A1:ZZ:clear`, { method: "POST", body: "{}" });
    if (!rows.length) return;
    await this._req(
      `/values/${encodeURIComponent(tab)}!A1?valueInputOption=USER_ENTERED`,
      { method: "PUT", body: JSON.stringify({ values: rows }) },
    );
  }
}

// --- Payload → tab rows -----------------------------------------------------

const num = (v) => (v == null || Number.isNaN(v) ? "" : Number(v));
const str = (v) => (v == null ? "" : String(v));

function buildStreams(payload) {
  const ts = payload.generatedAt || new Date().toISOString();
  const streams = {};

  // metrics — the KPI strip
  streams.metrics = {
    header: ["ts", "id", "label", "value", "unit", "context"],
    rows: (payload.metrics || []).map((m) => [ts, m.id, m.label, num(m.value), str(m.unit), str(m.context)]),
  };

  // flights — KCH airspace
  const airport = payload.airport || {};
  streams.flights = {
    header: ["ts", "airborne", "arrivals", "departures", "status", "nearest_callsign", "nearest_distance_km"],
    rows: [[
      ts,
      num(airport.stats?.total ?? airport.liveFlights?.length),
      num(airport.stats?.arrivals),
      num(airport.stats?.departures),
      str(airport.status),
      str(airport.liveFlights?.[0]?.callsign),
      num(airport.liveFlights?.[0]?.distanceKm),
    ]],
  };

  // hydro — JPS Infobanjir station-level (one row per station per snapshot)
  streams.hydro = {
    header: ["ts", "station_id", "name", "basin", "council", "water_level_m", "band", "threshold_alert", "threshold_warning", "threshold_danger"],
    rows: (payload.infobanjir?.stations || []).map((s) => [
      ts, s.id, s.name, s.basin, s.council,
      num(s.waterLevelM), str(s.band),
      num(s.thresholds?.alert), num(s.thresholds?.warning), num(s.thresholds?.danger),
    ]),
  };

  // ground_aq — APIMS ground stations
  streams.ground_aq = {
    header: ["ts", "station", "aqi", "band", "tone"],
    rows: (payload.apims?.stations || []).map((s) => [
      ts, s.label, num(s.aqi), str(s.band?.label), str(s.band?.tone),
    ]),
  };

  // met_warnings — MET Malaysia active alerts
  const met = payload.metWarnings || {};
  streams.met_warnings = {
    header: ["ts", "active_count", "headline", "valid_from", "valid_to", "severity"],
    rows: (met.items?.length ? met.items : [{}]).map((w) => [
      ts, num(met.activeCount || 0), str(w.heading), str(w.validFrom), str(w.validTo), str(w.severity),
    ]),
  };

  // news_counts — intake by language
  const news = payload.news || {};
  streams.news_counts = {
    header: ["ts", "total", "official", "en", "ms", "zh"],
    rows: [[
      ts,
      num(news.items?.length),
      num(news.counts?.official),
      num(news.counts?.en),
      num(news.counts?.ms),
      num(news.counts?.zh),
    ]],
  };

  // ground_pulse — Kuching / Padawan / Sarawak mention rollup (one row per lane)
  const gp = payload.groundPulse || {};
  streams.ground_pulse = {
    header: ["ts", "lane", "mentions_14d", "mentions_24h", "top_headline", "top_source", "top_trend", "narrative"],
    rows: (gp.lanes || []).map((lane) => [
      ts,
      str(lane.label),
      num(lane.mentionCount),
      num(lane.last24hCount),
      str(lane.headlines?.[0]?.title),
      str(lane.headlines?.[0]?.source),
      str(lane.trendMatches?.[0]?.term),
      str(lane.narrative),
    ]),
  };

  // earthquakes — regional USGS events
  streams.earthquakes = {
    header: ["ts", "event_id", "magnitude", "place", "depth_km", "event_time"],
    rows: (payload.earthquakes?.items || []).map((e) => [
      ts, str(e.id), num(e.magnitude), str(e.place), num(e.depthKm), str(e.time),
    ]),
  };

  // fires — NASA FIRMS hotspots summary
  const fires = payload.fires || {};
  streams.fires = {
    header: ["ts", "count", "brightest_k", "closest_km", "status"],
    rows: [[ts, num(fires.count), num(fires.brightestK), num(fires.closestKm), str(fires.status)]],
  };

  // economy — FX + CPI
  const econ = payload.exchange || {};
  const pair = (code) => econ.pairs?.find((p) => p.code === code)?.rate;
  streams.economy = {
    header: ["ts", "myr_usd", "myr_sgd", "myr_cny", "myr_thb", "myr_eur", "myr_gbp", "myr_jpy", "myr_idr"],
    rows: [[
      ts, num(pair("USD")), num(pair("SGD")), num(pair("CNY")),
      num(pair("THB")), num(pair("EUR")), num(pair("GBP")),
      num(pair("JPY")), num(pair("IDR")),
    ]],
  };

  // directives — operations / tactical cards
  streams.directives = {
    header: ["ts", "severity", "owner", "title", "detail"],
    rows: (payload.operations || []).map((o) => [ts, str(o.severity), str(o.owner), str(o.title), str(o.detail)]),
  };

  // flood_forecast — GloFAS discharge forecast
  const flood = payload.floodForecast || {};
  streams.flood_forecast = {
    header: ["ts", "station", "forecast_day", "discharge_cms", "return_period_2y", "return_period_5y", "return_period_20y"],
    rows: (flood.stations || []).flatMap((s) =>
      (s.days || []).map((d) => [
        ts, str(s.name), str(d.date), num(d.discharge),
        num(s.returnPeriods?.["2y"]), num(s.returnPeriods?.["5y"]), num(s.returnPeriods?.["20y"]),
      ]),
    ),
  };

  // summary — one row per snapshot covering the top-line
  streams.summary = {
    header: ["ts", "headline", "detail", "posture", "assetVersion"],
    rows: [[ts, str(payload.summary?.headline), str(payload.summary?.detail), str(payload.posture?.state), str(payload.assetVersion)]],
  };

  // --- Reference (overwrite, not append) -----------------------------------

  const council = payload.mppCouncillors || {};
  const councilRows = [
    ["role", "ward", "ward_label", "ward_area", "name", "title", "phone"],
    ...(council.chairman ? [["Chairman", "", "", str(council.chairman.coverage), str(council.chairman.name), str(council.chairman.title), str(council.chairman.phone)]] : []),
    ...(council.deputy ? [["Deputy", "", "", str(council.deputy.coverage), str(council.deputy.name), str(council.deputy.title), str(council.deputy.phone)]] : []),
    ...(council.wards || []).flatMap((w) =>
      (w.councillors || []).map((c) => ["Councillor", str(w.code), str(w.label), str(w.area), str(c.name), str(c.title), str(c.phone)]),
    ),
  ];

  const localities = payload.mppLocalities || {};
  const localityRows = [
    ["code", "name", "ward", "state_constituency", "parliament_constituency", "residential", "commercial", "industrial", "exempted"],
    ...(localities.items || []).map((it) => {
      const first = it.constituency?.parsed?.[0] || {};
      return [
        str(it.code), str(it.name), str(it.wardCode),
        str(first.stateCode ? `${first.stateCode} ${first.stateName}` : ""),
        str(first.parliamentCode ? `${first.parliamentCode} ${first.parliamentName}` : ""),
        num(it.residential), num(it.commercial), num(it.industrial), num(it.exempted),
      ];
    }),
  ];

  return { streams, referenceTabs: { councillors_roster: councilRows, localities_master: localityRows } };
}

// --- Main -------------------------------------------------------------------

async function main() {
  const started = Date.now();
  console.log("=== Sheets Archive ===");

  const credentials = JSON.parse(SA_JSON);
  const payload = JSON.parse(await readFile(DASHBOARD_PATH, "utf8"));
  const { streams, referenceTabs } = buildStreams(payload);

  console.log("Exchanging JWT for access token...");
  const token = await getAccessToken(credentials);
  const sheets = new Sheets(token, SHEETS_ID);

  // Ensure all tabs exist.
  const needed = [...Object.keys(streams), ...Object.keys(referenceTabs)];
  const existing = await sheets.listTabs();
  const missing = needed.filter((t) => !existing.has(t));
  if (missing.length) {
    console.log(`Creating ${missing.length} missing tab(s): ${missing.join(", ")}`);
    await sheets.addTabs(missing);
  }

  // Write headers to newly created tabs so the first append has context.
  await Promise.all(
    missing
      .filter((t) => streams[t])
      .map((t) => sheets.appendRows(t, [streams[t].header])),
  );

  // Append one row per stream snapshot.
  const results = await Promise.allSettled(
    Object.entries(streams).map(async ([tab, { rows }]) => {
      if (!rows.length) return { tab, skipped: true };
      await sheets.appendRows(tab, rows);
      return { tab, appended: rows.length };
    }),
  );
  results.forEach((r, i) => {
    const tab = Object.keys(streams)[i];
    if (r.status === "fulfilled") {
      const v = r.value;
      console.log(`  → ${tab}: ${v.skipped ? "skipped (empty)" : `+${v.appended} row(s)`}`);
    } else {
      console.warn(`  ✗ ${tab}: ${r.reason?.message || r.reason}`);
    }
  });

  // Overwrite reference tabs.
  for (const [tab, rows] of Object.entries(referenceTabs)) {
    await sheets.replaceRows(tab, rows);
    console.log(`  → ${tab}: ${rows.length} row(s) (overwrite)`);
  }

  console.log(`✓ Archive complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
}

main().catch((err) => {
  console.error(`✗ sheets-archive failed: ${err.message}`);
  process.exit(1);
});
