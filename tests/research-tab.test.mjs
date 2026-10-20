import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { PIPELINE, DICTIONARY, RECIPES, OMISSIONS, buildRecord, DICT_SOURCE_IDS } from "../public/research-data.js";

// The Research tab is the blueprint for people who want to change this board.
// Two failure modes matter and neither is caught by asserting a function call
// exists: a row that quietly stops matching the feed it describes, and a
// limitation column that gets softened into a disclaimer.

test("every dictionary row is complete in all three languages", () => {
  for (const row of DICTIONARY) {
    assert.ok(row.id, "each row needs an id to map to sources");
    for (const field of ["signal", "is", "limit"]) {
      for (const locale of ["en", "ms", "zh"]) {
        const value = row[field]?.[locale];
        assert.equal(typeof value, "string", `${row.id}.${field}.${locale} must be a string`);
        // A signal may legitimately be one word ("Weather"); the prose fields
        // are where substance is required. Chinese is denser per character.
        const floor = field === "signal" ? 2 : locale === "zh" ? 12 : 25;
        assert.ok(value.trim().length >= floor,
          `${row.id}.${field}.${locale} is too short to be useful (${value.trim().length} < ${floor})`);
      }
    }
  }
  assert.ok(DICTIONARY.length >= 10, "a dictionary of fewer than ten signals is not a dictionary");
});

test("a limitation must be a limitation, not a disclaimer", () => {
  // "Data may be incomplete" passes every shape check and tells a reader
  // nothing. Require each row to name a concrete consequence or subject.
  const weak = /^(data|information|values?|results?) (may|might|could|can) (be )?(incomplete|unavailable|approximate)/i;
  for (const row of DICTIONARY) {
    const limit = row.limit.en;
    assert.ok(limit.length > 30, `${row.id}: the limitation is too short to constrain a reading`);
    assert.ok(!weak.test(limit), `${row.id}: "${limit}" is a disclaimer, not a limitation`);
    // Must name what the reader must not conclude.
    assert.match(limit, /not\b|never\b|no\b/i,
      `${row.id}: the limitation should say what this signal is NOT good for`);
  }
});

test("every dictionary row maps to at least one real source id", async () => {
  for (const row of DICTIONARY) {
    const ids = DICT_SOURCE_IDS[row.id];
    assert.ok(Array.isArray(ids) && ids.length, `${row.id} has no source mapping, so its status glyph would always be dead`);
  }
  // And every mapped id must exist in the committed snapshot — a typo here is
  // invisible on screen, the glyph just goes quiet forever.
  let raw;
  try {
    raw = await fs.readFile(new URL("../public/api/dashboard.json", import.meta.url), "utf8");
  } catch {
    return; // no baked snapshot committed yet
  }
  const known = new Set(JSON.parse(raw).sources.map((s) => s.id));
  for (const [row, ids] of Object.entries(DICT_SOURCE_IDS)) {
    for (const id of ids) {
      assert.ok(known.has(id), `dictionary row "${row}" maps to unknown source id "${id}"`);
    }
  }
});

test("recipes name a file a maintainer can actually open", () => {
  for (const r of RECIPES) {
    for (const locale of ["en", "ms", "zh"]) {
      assert.ok(r.want?.[locale]?.trim(), `recipe want.${locale} missing`);
      assert.ok(r.do?.[locale]?.trim(), `recipe do.${locale} missing`);
    }
    // Every recipe must point at a real file or command, or it is not a recipe.
    assert.match(r.do.en, /[a-z-]+\.(js|mjs|css|html)|node /,
      `"${r.want.en}" does not name a file or command`);
  }
  assert.ok(RECIPES.some((r) => /index\.template\.html/.test(r.do.en)),
    "one recipe must warn that index.html is generated");
});

test("omissions are explicit and complete in all three languages", () => {
  assert.ok(OMISSIONS.length >= 4, "the omissions section should cover traffic, cameras, personal data and authority");
  OMISSIONS.forEach((o, i) => {
    for (const locale of ["en", "ms", "zh"]) {
      assert.equal(typeof o?.[locale], "string", `omission ${i}.${locale} missing`);
      const floor = locale === "zh" ? 12 : 20;
      assert.ok(o[locale].trim().length >= floor, `omission ${i}.${locale} is too vague`);
    }
  });
});

test("the pipeline describes four stages and each has a body", () => {
  assert.equal(PIPELINE.length, 4, "source -> loader -> snapshot -> renderer");
  for (const step of PIPELINE) {
    assert.match(step.step, /^[1-4]$/);
    for (const locale of ["en", "ms", "zh"]) {
      assert.ok(step.title?.[locale]?.trim(), `step ${step.step} title.${locale}`);
      assert.ok(step.body?.[locale]?.trim(), `step ${step.step} body.${locale}`);
    }
  }
});

test("the build record is derived from the payload, never hardcoded", () => {
  // A build record that lies is worse than none: it is the thing a reader
  // cites when they come back to check a number.
  const payload = {
    generatedAt: "2026-10-19T03:15:37.695Z",
    delivery: { mode: "static-snapshot", assetVersion: "9c3c6623ebca-031400", snapshotBuiltAt: "2026-10-19T03:15:37.695Z" },
    climate: { weather: { status: "live", observedAt: "2026-10-19T10:45" }, air: { status: "live", observedAt: "2026-10-19T10:00" } },
    sources: [{ id: "a", status: "live" }, { id: "b", status: "official" }, { id: "c", status: "offline" }],
  };
  const r = buildRecord(payload, { assetVersion: payload.delivery.assetVersion, builtAt: payload.delivery.snapshotBuiltAt });
  assert.equal(r.assetVersion, "9c3c6623ebca-031400");
  assert.equal(r.mode, "static-snapshot");
  assert.equal(r.total, 3);
  assert.equal(r.live, 2, "live + official count as answering");
  assert.equal(r.weather, "live");
  assert.equal(r.weatherObservedAt, "2026-10-19T10:45", "observation time, not retrieval time");

  // Degrades to honest unknowns rather than throwing on a thin payload.
  const thin = buildRecord({}, {});
  assert.equal(thin.total, 0);
  assert.equal(thin.weather, "unknown");
  assert.equal(thin.weatherObservedAt, null);
});

test("the research tab is wired into the tray, not orphaned", async () => {
  const template = await fs.readFile(new URL("../public/index.template.html", import.meta.url), "utf8");
  const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(template, /data-pane="research"/, "the tab button is missing");
  assert.match(template, /id="researchPanel"/, "the pane target is missing");
  assert.match(template, /data-i18n="trayResearch"/, "the tab label must be translatable");
  // An unreferenced renderer is the shape of the bug: the tab opens empty.
  assert.ok((app.match(/renderResearch\(/g) || []).length >= 3,
    "renderResearch must be defined and called from both render paths");
  assert.match(app, /research-data\.js\?v=/, "content must come from the shared module");
  // Research prose is authored in research-data.js, not inlined into app.js.
  const prose = app.slice(app.indexOf("function renderResearch"), app.indexOf("function renderSourceMatrix"));
  assert.ok(!/Built-up area and impervious/.test(prose), "dictionary content must not be inlined");
});

test("every interpolated value in the Research tab is escaped", async () => {
  const src = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("function renderResearch"), src.indexOf("function renderSourceMatrix"));

  // Find every ${...} in template literals and require it to be wrapped in
  // escapeHtml, or to be one of the few things that are genuinely safe
  // (numbers we computed, or strings we built ourselves above the template).
  // Composed sub-templates are escaped at their own construction site, which
  // is this codebase's idiom (see renderSourceMatrix, renderNewsIntake). Naming
  // them here makes that a stated contract rather than an assumption: each one
  // must escape every value it interpolates, which the assertions below check
  // by requiring the named expressions to appear wrapped.
  const COMPOSED = new Set(["pipelineHtml", "dictHtml", "recipeHtml", "omitHtml"]);
  const SAFE = /^(p\.step|record\.(live|total)|glyph\(|statusTone\()/;
  const interpolations = [...body.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim());
  assert.ok(interpolations.length > 20, `expected a populated template, found ${interpolations.length} interpolations`);

  const unescaped = interpolations.filter((expr) =>
    !expr.startsWith("escapeHtml(") && !SAFE.test(expr) && !COMPOSED.has(expr));
  assert.deepEqual(unescaped, [],
    `these reach the DOM unescaped: ${unescaped.join(", ")}`);

  // Each composed template must escape its own inputs — prove it, don't assume it.
  const composedBodies = {
    pipelineHtml: body.slice(body.indexOf("const pipelineHtml"), body.indexOf("const dictHtml")),
    dictHtml: body.slice(body.indexOf("const dictHtml"), body.indexOf("const recipeHtml")),
    recipeHtml: body.slice(body.indexOf("const recipeHtml"), body.indexOf("const omitHtml")),
    omitHtml: body.slice(body.indexOf("const omitHtml"), body.indexOf("el.innerHTML")),
  };
  for (const [name, chunk] of Object.entries(composedBodies)) {
    const inner = [...chunk.matchAll(/\$\{([^}]*)\}/g)].map((m) => m[1].trim())
      .filter((e) => !e.startsWith("escapeHtml(") && !SAFE.test(e));
    assert.deepEqual(inner, [], `${name} interpolates unescaped: ${inner.join(", ")}`);
  }

  // Named specifically, because these carry authored prose and feed names.
  for (const expr of [
    "localeText(p.title)", "localeText(p.body)", "localeText(d.signal)",
    "localeText(d.is)", "localeText(d.limit)", "localeText(r.want)",
    "localeText(r.do)", "localeText(o)", 'src?.name || ""',
  ]) {
    assert.ok(interpolations.includes(`escapeHtml(${expr})`),
      `${expr} must reach the DOM through escapeHtml()`);
  }
});
