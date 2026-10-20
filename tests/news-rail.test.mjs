import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";

// 20 Oct: the operator reported "a white plane on the left-hand side" of the
// board. Reproduced with a geometry probe in headless Chrome, not by eye:
// at 2560x1440 the News digest panel was 330px tall inside a 554px rail and
// the renderer printed only 3 headlines out of 14 already in the payload.
// 174px of empty warm paper sat below it. The cause was a fixed cap on real
// data, not a styling accident — so these tests guard the cap and the CSS
// that lets the panel fill the space it already reserves.

const app = await fs.readFile(new URL("../public/app.js", import.meta.url), "utf8");
const reading = await fs.readFile(new URL("../public/reading.css", import.meta.url), "utf8");

// The renderer body, so a match cannot be satisfied by a comment elsewhere.
function rendererBody(source) {
  const start = source.indexOf("function renderNewsIntake");
  assert.ok(start > -1, "renderNewsIntake must exist");
  const end = source.indexOf("\nfunction ", start + 10);
  return source.slice(start, end === -1 ? source.length : end);
}

test("the news digest is not capped at three headlines", () => {
  const body = rendererBody(app);
  assert.ok(!/\.slice\(0,\s*3\)/.test(body),
    "slice(0, 3) is what left 174px of empty panel — real headlines were dropped to fit a fixed count");
  const cap = body.match(/\.slice\(0,\s*(\d+)\)/);
  assert.ok(cap, "the list must stay bounded by an explicit cap");
  assert.ok(Number(cap[1]) >= 10,
    `a cap of ${cap[1]} leaves the rail mostly empty again; the payload holds 14 items`);
});

test("operator notices and news items are merged without repeating a headline", () => {
  const body = rendererBody(app);
  assert.match(body, /news\.operatorItems/, "operator notices must still lead the list");
  assert.match(body, /seen\.has\(key\)/,
    "operator notices and news items overlap; without a dedupe the same headline renders twice");
  assert.match(body, /item\?\.title\s*\+\s*"\|"/,
    "dedupe on a stable key, not on array position");
});

test("the digest states how much of the window it is not showing", () => {
  const body = rendererBody(app);
  assert.match(body, /newsMoreInWindow/,
    "silently trimming the window is the same defect as trimming it with a cap and no note");
  assert.match(body, /escapeHtml\(tFill\("newsMoreInWindow"/,
    "the count is interpolated, so it must be escaped and localised, not concatenated raw");
});

test("the panel fills the column the board already reserves for it", () => {
  assert.match(reading, /\.dashboard-shell \.sentiment-panel\s*\{[^}]*flex:\s*1 0 auto/,
    "the panel must absorb leftover column height; flex-grow 0 leaves the white plane back");
  assert.match(reading, /\.dashboard-shell \.sentiment-panel\s*\{[^}]*min-height:\s*min-content/,
    "min-height guards the collapse: shrink-0 alone still lets the panel shrink below its content");
});

test("the news rail has exactly one scroll container", () => {
  // The first attempt also gave .news-intake-list its own overflow. On a short
  // column the panel then collapsed to 72px while its fixed children overflowed
  // to 992px and painted over the sibling disclosures. panel-inner scrolls; the
  // list inside it must not.
  const listRule = reading.match(/\.dashboard-shell \.news-intake-list\s*\{[^}]*\}/g) || [];
  for (const rule of listRule) {
    assert.ok(!/overflow\s*:\s*(auto|scroll|hidden)/.test(rule),
      `.news-intake-list must not scroll (${rule.trim()}) — two scrollers broke the rail`);
  }
  assert.match(reading, /\.dashboard-shell \.news-rail \.panel-inner\s*\{[^}]*overflow-y:\s*auto/,
    "panel-inner is the single scroller that lets a short column still reach the tail of the list");
});
// The left column is a fixed-height flex stack: brief → insights → news. The
// brief strip shipped as `flex: 0 0 auto`, so flex-shrink: 0 meant it could not
// yield to a short column. At 1440x900 it took 736px of an 813px column and
// the rail computed to ZERO height — fourteen headlines, no visible window, and
// no page scroll that would ever reach them.

test("the brief strip can yield to a short column", () => {
  assert.match(reading, /\.dashboard-shell \.col-now \.brief-strip\s*\{[^}]*flex:\s*0 1 auto/,
    "flex: 0 0 auto pins the brief at its content height and starves the rail");
  assert.match(reading, /\.dashboard-shell \.col-now \.brief-strip\s*\{[^}]*min-height:\s*0/,
    "without min-height: 0 the brief cannot shrink below its content");
  assert.match(reading, /\.dashboard-shell \.col-now \.brief-strip\s*\{[^}]*overflow-y:\s*auto/,
    "the brief must scroll inside itself once it yields, or its tail becomes unreachable");
});

test("the news rail keeps a window big enough to read a headline in", () => {
  const rule = reading.match(/\.dashboard-shell \.col-now \.news-rail\s*\{([^}]*)\}/);
  assert.ok(rule, "the rail floor rule must exist");
  const floor = rule[1].match(/min-height:\s*(\d+)px/);
  assert.ok(floor, "the rail needs a min-height floor or it collapses to zero again");
  // Measured 20 Oct 2026: the panel head is ~51px and one headline ~67px, so
  // 96px left a 45px window — below a single story.
  assert.ok(Number(floor[1]) >= 160,
    `a ${floor[1]}px floor leaves too little list to read (needs >= 160)`);
});
