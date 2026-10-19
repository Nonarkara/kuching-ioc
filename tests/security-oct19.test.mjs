import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";

const app = readFileSync(new URL("../public/app.js", import.meta.url), "utf8");
const server = readFileSync(new URL("../server.mjs", import.meta.url), "utf8");

test("signal cards escape every feed field (NREB sheet text reached innerHTML raw)", () => {
  const block = app.slice(app.indexOf("const signalHtml"), app.indexOf("const signalHtml") + 500);
  assert.match(block, /escapeHtml\(s\.context \|\| ""\)/);
  assert.match(block, /escapeHtml\(String\(s\.label\)/);
  assert.doesNotMatch(block, /\$\{s\.context\|\|''\}/);
});

test("the NREB loader only accepts known bands and a plain time stamp", () => {
  const fn = server.slice(server.indexOf("async function loadNrebApi"), server.indexOf("async function loadSarawakCkanHarvest"));
  assert.match(fn, /Object\.hasOwn\(NREB_BAND_TONE, cells\[3\]\)/);
  assert.match(fn, /\/\^\[A-Za-z0-9 ,\.:\]\{5,60\}\$\/\.test\(rawTakenAt\)/);
});

test("static serving checks the directory boundary, not a string prefix", () => {
  assert.match(server, /path\.relative\(publicDir, filePath\)/);
  assert.doesNotMatch(server, /if \(!filePath\.startsWith\(publicDir\)\)/);
  assert.match(server, /response\.setHeader\("x-content-type-options", "nosniff"\)/);
  assert.doesNotMatch(server, /message: error instanceof Error \? error\.message : "Unknown error"/);
});

test("generated CSP hashes every executable inline script and allows no inline script", async () => {
  const { renderIndexHtml, contentSecurityPolicy, inlineScriptHashes } = await import("../site-build.mjs");
  const html = await renderIndexHtml({ env: {}, assetVersion: "t", visitorBeaconUrl: "" });
  const csp = contentSecurityPolicy(html);
  const scriptSrc = csp.split("; ").find((d) => d.startsWith("script-src "));
  assert.ok(scriptSrc, "script-src present");
  assert.doesNotMatch(scriptSrc, /'unsafe-inline'|'unsafe-eval'/);
  const hashes = inlineScriptHashes(html);
  assert.ok(hashes.length >= 2, "boot + beacon scripts hashed");
  for (const h of hashes) assert.ok(scriptSrc.includes(h), h);
  // Recompute one hash independently so the generator cannot drift.
  const boot = html.match(/<script>(window\.__IOC_BOOT__[\s\S]*?)<\/script>/)[1];
  assert.ok(scriptSrc.includes(`'sha256-${createHash("sha256").update(boot, "utf8").digest("base64")}'`));
  assert.match(csp, /frame-ancestors 'none'/);
  assert.match(csp, /object-src 'none'/);
});

test("committed _headers carries the generated policy for the committed page", async () => {
  const { contentSecurityPolicy } = await import("../site-build.mjs");
  const headers = readFileSync(new URL("../public/_headers", import.meta.url), "utf8");
  const page = readFileSync(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(headers.includes(`Content-Security-Policy: ${contentSecurityPolicy(page)}`), "regenerate with writeRenderedIndex()");
});

test("env values cannot inject template text through $-patterns", async () => {
  const { renderIndexHtml } = await import("../site-build.mjs");
  const html = await renderIndexHtml({ env: {}, assetVersion: "t", visitorBeaconUrl: "https://x/$&$' " });
  assert.ok(html.includes('var SH="https://x/$&$\'\\u2028";'));
});

test("Cesium loads with subresource integrity", () => {
  const loader = app.slice(app.indexOf("function loadCesium"), app.indexOf("async function setDimension"));
  assert.equal((loader.match(/\.integrity = "sha384-/g) || []).length, 2);
  assert.equal((loader.match(/crossOrigin = "anonymous"/g) || []).length, 2);
});
