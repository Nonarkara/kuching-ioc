#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Static build script for GitHub Pages deployment.
//
// Boots the server on an ephemeral port, fetches the dashboard payload and
// all GIS layer endpoints, writes them to public/ as static JSON files, then
// shuts down. GitHub Actions calls this before the Pages artifact upload so
// the deployed site ships with the freshest data snapshot available.
//
// Usage:  node build.mjs
//
// Works locally too — `node build.mjs && npx serve public` gives you a fully
// static preview without keeping the server running.
// ---------------------------------------------------------------------------

import { spawn } from "node:child_process";
import { access, mkdir, stat, writeFile } from "node:fs/promises";
import { constants as fsConstants } from "node:fs";
import { join } from "node:path";
import {
  DEFAULT_LIVE_URL,
  DEFAULT_PAGES_URL,
  INDEX_OUTPUT_PATH,
  PUBLIC_DIR,
  resolveAssetVersion,
  writeRenderedIndex,
} from "./site-build.mjs";
import { fetchGroundPulseHistory } from "./scripts/sheets-read.mjs";

const BUILD_PORT = 9876;
const LAYERS_DIR = join(PUBLIC_DIR, "api", "layers");
const BASE = `http://127.0.0.1:${BUILD_PORT}`;
const MAX_WAIT_MS = 180_000; // 3 minutes total budget for the build
const REQUIRED_ARTIFACTS = [
  join(PUBLIC_DIR, "api", "dashboard.json"),
  join(PUBLIC_DIR, "api", "build-manifest.json"),
  join(PUBLIC_DIR, "api", "layers", "drainage.json"),
  join(PUBLIC_DIR, "api", "layers", "transit.json"),
  join(PUBLIC_DIR, "api", "layers", "land_use.json"),
  join(PUBLIC_DIR, "api", "layers", "flood_risk.json"),
  join(PUBLIC_DIR, "api", "layers", "flood_zones.json"),
  INDEX_OUTPUT_PATH,
];

async function fetchWithRetry(url, retries = 3, timeout = 120_000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    try {
      const res = await fetch(url, { signal: controller.signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (!text || text.length < 2) throw new Error("Empty body");
      return text;
    } catch (error) {
      console.warn(`  [attempt ${attempt}/${retries}] ${url}: ${error.message}`);
      if (attempt === retries) throw error;
      await new Promise((r) => setTimeout(r, 2000 * attempt));
    } finally {
      clearTimeout(timer);
    }
  }
}

async function waitForServer(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${BASE}/api/health`, { signal: AbortSignal.timeout(2000) });
      if (res.ok) return;
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error("Server did not become ready in time");
}

async function assertReadableFiles(paths) {
  for (const filePath of paths) {
    await access(filePath, fsConstants.R_OK);
    const info = await stat(filePath);
    if (!info.isFile() || info.size <= 0) {
      throw new Error(`Required artifact missing or empty: ${filePath}`);
    }
  }
}

async function main() {
  const started = Date.now();
  const buildStartedAt = new Date().toISOString();
  const assetVersion = resolveAssetVersion({ builtAt: buildStartedAt });
  console.log("=== Greater Kuching IOC — Static Build ===");
  console.log(`Port: ${BUILD_PORT} | Budget: ${MAX_WAIT_MS / 1000}s | Asset: ${assetVersion}`);

  // 1. Boot the server.
  const server = spawn(process.execPath, ["server.mjs"], {
    env: {
      ...process.env,
      PORT: String(BUILD_PORT),
      ASSET_VERSION: assetVersion,
    },
    stdio: ["ignore", "pipe", "pipe"],
    cwd: import.meta.dirname,
  });
  server.stdout.on("data", (d) => process.stdout.write(`  [server] ${d}`));
  server.stderr.on("data", (d) => process.stderr.write(`  [server:err] ${d}`));

  let exitCode = 0;
  try {
    console.log("Waiting for server...");
    await waitForServer();
    console.log("Server ready.");

    // 2. Fetch the dashboard payload.
    console.log("Fetching /api/dashboard...");
    const dashboard = await fetchWithRetry(`${BASE}/api/dashboard`);
    const dashboardPath = join(PUBLIC_DIR, "api", "dashboard.json");
    await mkdir(join(PUBLIC_DIR, "api"), { recursive: true });
    await writeFile(dashboardPath, dashboard);
    const parsed = JSON.parse(dashboard);
    console.log(`  → ${dashboardPath} (${(dashboard.length / 1024).toFixed(1)} KB, ${parsed.sources?.length || "?"} sources)`);

    // 2.5. Enrich Ground Pulse with the rolling archive from Google Sheets.
    // Skips cleanly when creds aren't set or the tab is empty (first runs).
    try {
      const history = await fetchGroundPulseHistory({
        sheetId: process.env.GOOGLE_SHEETS_ID,
        saJson: process.env.GOOGLE_SERVICE_ACCOUNT_JSON,
        daysBack: 14,
      });
      const lanes = parsed.groundPulse?.lanes || [];
      if (history && lanes.length) {
        for (const lane of lanes) {
          lane.history = history[lane.label] || [];
        }
        await writeFile(dashboardPath, JSON.stringify(parsed));
        console.log(
          `  → ground pulse history: ${lanes.map((l) => `${l.label}=${l.history.length}`).join(" ")}`,
        );
      } else {
        console.log("  → ground pulse history: skipped (no sheets creds or empty archive)");
      }
    } catch (err) {
      console.warn(`  → ground pulse history: ${err.message}`);
    }

    // 3. Fetch all GIS layers in parallel.
    const layerIds = ["drainage", "transit", "land_use", "flood_risk", "flood_zones", "mpp_wards"];
    await mkdir(LAYERS_DIR, { recursive: true });
    console.log(`Fetching ${layerIds.length} GIS layers...`);
    const results = await Promise.allSettled(
      layerIds.map(async (id) => {
        const body = await fetchWithRetry(`${BASE}/api/layers/${id}`, 2, 90_000);
        const path = join(LAYERS_DIR, `${id}.json`);
        await writeFile(path, body);
        const fc = JSON.parse(body);
        console.log(`  → ${id}: ${fc.features?.length ?? 0} features (${(body.length / 1024).toFixed(1)} KB)`);
        return { id, features: fc.features?.length ?? 0 };
      }),
    );
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(`  ⚠ ${failed.length} layer(s) failed — will use client-side fallback.`);
      failed.forEach((r) => console.warn(`    ${r.reason?.message || r.reason}`));
    }

    // 4. Write a build manifest so the client can show "data as of...".
    const builtAt = new Date().toISOString();
    const manifest = {
      builtAt,
      buildDurationMs: Date.now() - started,
      dashboardSizeKb: Math.round(dashboard.length / 1024),
      assetVersion,
      deploymentMode: "pages-static",
      boardLabel: "SNAPSHOT BOARD",
      pagesUrl: process.env.PAGES_PUBLIC_URL || DEFAULT_PAGES_URL,
      liveUrl: process.env.LIVE_IOC_URL || DEFAULT_LIVE_URL,
      layers: results.map((r, i) => ({
        id: layerIds[i],
        status: r.status,
        features: r.status === "fulfilled" ? r.value.features : 0,
      })),
    };
    const manifestPath = join(PUBLIC_DIR, "api", "build-manifest.json");
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(`  → ${manifestPath}`);

    // 5. Render the static entrypoint with the current asset version and route metadata.
    await writeRenderedIndex({
      assetVersion,
      builtAt,
      deploymentMode: "pages-static",
      boardLabel: "SNAPSHOT BOARD",
      pagesUrl: process.env.PAGES_PUBLIC_URL || DEFAULT_PAGES_URL,
      liveUrl: process.env.LIVE_IOC_URL || DEFAULT_LIVE_URL,
    });
    console.log(`  → ${INDEX_OUTPUT_PATH}`);

    // 6. Hard fail if the Pages contract is incomplete.
    await assertReadableFiles(REQUIRED_ARTIFACTS);
    console.log(`  → contract ok (${REQUIRED_ARTIFACTS.length} required artifacts)`);

    console.log(`\n✓ Build complete in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (error) {
    console.error(`\n✗ Build failed: ${error.message}`);
    exitCode = 1;
  } finally {
    server.kill("SIGTERM");
    // Grace period.
    await new Promise((r) => setTimeout(r, 500));
    if (!server.killed) server.kill("SIGKILL");
  }

  process.exit(exitCode);
}

main();
