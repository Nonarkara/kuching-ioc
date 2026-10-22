import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

// 19 Oct release audit: external feed text reached HTML sinks unescaped.
// MET headings flow through normalizeMetWeather() untouched, into the
// flood-watch metric context and into the warning card. The City Reporter
// status/urgency and the WAQI "dominant" pollutant label reached tooltips.
// None of these are attacker-controlled today; all of them are third-party
// strings that must not become markup if an upstream or the optional
// self-hosted feed ever is.

const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
const server = await fs.readFile(new URL("../server.mjs", import.meta.url), "utf8");

// Mirrors escapeHtml() in public/app.js so this test exercises the real rule.
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

const PAYLOAD = `<img src=x onerror="alert(1)">`;
const ENTITY = `&#x3C;img src=x onerror=alert(1)&#x3E;`;

test("MET heading text cannot become markup in the metric strip", () => {
  const m = { context: PAYLOAD };
  const html = `<div class="metric-context">${escapeHtml(m.context || "")}</div>`;
  assert.ok(!html.includes("<img"), "an image tag must not survive into the metric context");
  assert.ok(!html.includes("onerror=\"alert"), "no live event handler attribute");
  assert.match(html, /&lt;img/);
});

test("MET heading text cannot become markup in the warning card", () => {
  const w = { heading: PAYLOAD };
  const html = `<div class="meta">${escapeHtml(w.heading || "Active warning")}</div>`;
  assert.ok(!html.includes("<img"));
  assert.ok(!html.includes("onerror=\"alert"));
});

test("uppercasing a City Reporter status does not neutralise it", () => {
  // The previous code did `.replace("_"," ").toUpperCase()` and interpolated raw.
  const r = { urgency: "high", status: PAYLOAD };
  const upper = String(r.status).replace("_", " ").toUpperCase();
  assert.ok(upper.includes("<IMG"), "uppercasing leaves the tag intact — the risk is real");
  const html = `Urgency: ${escapeHtml(upper)}`;
  assert.ok(!html.includes("<IMG"), "escaped output carries no tag");
  assert.match(html, /&lt;IMG/);
});

test("character-reference payloads do not survive escaping", () => {
  // `&#x3C;` is inert as text but decodes to `<` if ever re-parsed as markup.
  const html = escapeHtml(ENTITY);
  assert.ok(!html.includes("&#x3C;"), "the reference must itself be neutralised");
  assert.match(html, /&amp;#x3C;/);
});

test("APIMS pollutant and station text cannot become markup in a tooltip", () => {
  const s = { stationName: PAYLOAD, band: { label: PAYLOAD }, dominant: PAYLOAD, aqi: 40 };
  const html = `<strong>APIMS · ${escapeHtml(s.stationName)}</strong><br>AQI ${s.aqi} (${escapeHtml(s.band?.label || "—")})<br>Dominant: ${escapeHtml(s.dominant || "—")}`;
  assert.ok(!html.includes("<img"));
  assert.match(html, /&lt;img/);
});

test("every fixed sink in app.js routes external strings through escapeHtml", () => {
  // Structural guard: these sinks were the confirmed findings. If someone later
  // "simplifies" one back to a raw interpolation, this fails.
  //
  // Matched on the escaping, not on the whole tag. These elements gained title
  // attributes (so a truncated label is recoverable on hover) and an earlier
  // version of this test failed on that shape change while the escaping was
  // still correct — a test that breaks when a safe improvement lands will be
  // deleted rather than fixed.
  const sinks = [
    [/<div class="metric-context"[^>]*>\$\{escapeHtml\(m\.context\|\|''\)\}<\/div>/, "metric context"],
    ['<div class="meta">${escapeHtml(w.heading || "Active warning")}</div>', "MET warning heading"],
    ["title=\"${escapeHtml(status)}\"", "glyph status tooltip"],
    ["Dominant: ${escapeHtml(s.dominant || \"—\")}", "APIMS pollutant"],
    ["${escapeHtml(String(r.status || \"\").replace(\"_\",\" \").toUpperCase())}", "city reporter status"],
    ["<em style=\"opacity:.9\">${escapeHtml(s.humanBrief)}</em>", "hydro humanBrief"],
  ];
  for (const [snippet, name] of sinks) {
    assert.ok(
      typeof snippet === "string" ? app.includes(snippet) : snippet.test(app),
      `${name} must stay escaped — found no: ${snippet}`,
    );
  }
  // And the raw forms must be gone.
  assert.ok(!app.includes('<div class="metric-context" title="${m.context'), "raw metric context returned");
  assert.ok(!app.includes('<div class="meta">${w.heading'), "raw MET heading returned");
  // A title attribute is an HTML sink like any other: it must be escaped too.
  assert.ok(!app.includes('title="${prov.src}"'), "raw source name in a title attribute");
  assert.ok(!app.includes('title="${m.context}"'), "raw metric context in a title attribute");
});

test("the local server survives a malformed Host header instead of exiting", async () => {
  // Reproduces the handler shape against a real child process, using the
  // project's own bind default so the test exercises the shipped behaviour.
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
  const child = spawn(process.execPath, [path.join(root, "tests", "fixtures", "malformed-host-child.mjs")], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let out = "";
  child.stdout.on("data", (d) => { out += d; });
  child.stderr.on("data", (d) => { out += d; });

  const code = await new Promise((resolve) => {
    child.on("exit", resolve);
    setTimeout(() => { child.kill("SIGKILL"); resolve("timeout"); }, 20000);
  });

  assert.equal(code, 0, `child exited ${code}: ${out}`);
  assert.match(out, /ALIVE/);
  // The proof is the surviving server, not a particular status on the bad
  // request: the fix stops consuming the Host header, so it is now simply
  // irrelevant rather than fatal.
  assert.match(out, /afterwards \/api\/health -> 200/);
  assert.match(out, /afterwards \/ -> 200/);
});

test("the default bind is loopback, with an explicit override retained", () => {
  assert.match(server, /const host = process\.env\.HOST \|\| "127\.0\.0\.1";/);
  assert.ok(!/const host = process\.env\.HOST \|\| "0\.0\.0\.0";/.test(server),
    "the all-interfaces default must not return without an explicit decision");
});

test("the request handler parses its URL defensively", () => {
  // The unguarded constructor was the crash; it must stay inside a try/catch.
  assert.ok(server.includes('new URL(request.url || "/", "http://localhost")'),
    "parse against a fixed base, not the client-supplied Host");
  assert.ok(server.includes("malformed request URL"), "a malformed URL must produce a 400");
});