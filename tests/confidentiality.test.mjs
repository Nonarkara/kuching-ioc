import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === ".git") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const TEXT_EXT = new Set([".js", ".mjs", ".py", ".json", ".md", ".yml", ".yaml", ".html", ".sh", ".css", ".txt"]);

test("tracked text does not publish client contacts, the FIRMS key, or the unlisted zoning map", () => {
  const hits = [];
  for (const file of walk(root)) {
    if (!TEXT_EXT.has(path.extname(file))) continue;
    const rel = path.relative(root, file);
    const text = fs.readFileSync(file, "utf8");
    if (/firms\.modaps\.eosdis\.nasa\.gov\/api\/country\/csv\/[0-9a-fA-F]{16,}/.test(text)) {
      hits.push(`${rel}: keyed FIRMS url`);
    }
    if (/wa\.me\/60\d{6,}/.test(text)) hits.push(`${rel}: personal WhatsApp link`);
    if (/phone["']?\s*[:=]\s*["']01\d/.test(text)) hits.push(`${rel}: personal mobile`);
    if (/google\.com\/maps\/d\/[^"'\s]*mid=/.test(text)) hits.push(`${rel}: unlisted My Map link`);
    if (/Ext\.\s*302/.test(text)) hits.push(`${rel}: internal extension`);
  }
  assert.deepEqual(hits, []);
});

test("councillor roster and locality register withhold personal numbers and property counts", () => {
  const council = JSON.parse(read("data/councillors.json"));
  const people = [council.chairman, council.deputy, ...(council.wards || []).flatMap((w) => w.councillors || [])];
  assert.ok(people.length >= 10);
  for (const person of people) assert.equal(person.phone, null);
  assert.equal(council.contacts, "withheld");

  const localities = JSON.parse(read("data/localities.json"));
  assert.equal(localities.propertyUsage, "withheld");
  assert.equal(localities.sheetTotals, undefined);
  assert.ok(localities.items.length > 100);
  assert.equal(localities.totals.residential, null);
  for (const item of localities.items) {
    assert.equal(item.residential, null);
    assert.equal(item.commercial, null);
    assert.equal(item.industrial, null);
    assert.equal(item.exempted, null);
    assert.ok(item.name);
  }

  const dashboard = JSON.parse(read("public/api/dashboard.json"));
  assert.equal(dashboard.site.monitoring.firms.url.includes("/api/country/csv/"), false);
  assert.equal(dashboard.mppCouncillors.contacts, "withheld");
  assert.equal(dashboard.mppLocalities.propertyUsage, "withheld");
  assert.equal(dashboard.mppLocalities.totals.residential, null);
  const zoning = (dashboard.sources || []).find((s) => s.id === "mpp-zoning-map");
  assert.ok(zoning);
  assert.equal(zoning.url.includes("google.com/maps/d/"), false);
});

test("deploy workflow pins third-party actions and keeps checkout-only permissions", () => {
  const yml = read(".github/workflows/cloudflare-pages.yml");
  assert.match(yml, /permissions:\n {2}contents: read\n/);
  assert.equal(yml.includes("deployments:"), false);
  const uses = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
  assert.ok(uses.length >= 3);
  for (const ref of uses) {
    assert.match(ref, /@[0-9a-f]{40}$/, ref);
  }
});
