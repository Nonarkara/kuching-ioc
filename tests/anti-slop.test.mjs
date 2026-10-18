import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (p) => readFile(new URL(p, import.meta.url), "utf8");
const css = await read("../public/reading.css");
const template = await read("../public/index.template.html");
const styles = await read("../public/styles.css");
const app = await read("../public/app.js");

// Anti-slop rule 1 — boxes fit their content.
// Regression: the collapsed disclosures and the tray stack each carry their own
// padding and could grow past their text. Pin that the Rams layer still clears
// fixed min-heights on the scroll containers it owns.
test("rule 1: Rams layer strips fixed heights from the board's scroll containers", () => {
  assert.match(css, /box-shadow: none !important/, "ornament removal must survive");
  // The board is one screen with internal scrolling; no container may claim a
  // fixed height that outruns the viewport it lives in.
  for (const sel of [".board-grid", ".col-now", ".col-map"]) {
    assert.ok(css.includes(sel), `${sel} must be styled by reading.css`);
  }
});

// Anti-slop rule 3 — readable line length, 45–75 characters.
// Regression: at 1024 px the brief column goes full-bleed and prose ran to
// 137 characters. Cap the measure on the prose elements that were measured.
test("rule 3: prose is capped to a readable measure", () => {
  assert.match(
    css,
    /max-width:\s*68ch/,
    "prose must carry a max-width in ch so the measure survives a font change",
  );
  const capped = css.slice(css.indexOf("max-width: 68ch") - 600, css.indexOf("max-width: 68ch") + 40);
  for (const el of [".brief-item", ".verdict-why", ".regional-status"]) {
    assert.ok(capped.includes(el), `${el} must be inside the measure cap`);
  }
  // A narrow rail must not be letterboxed by the cap — but ONLY on the wide
  // layout. At <=1040px `.col-now` is `display: contents` and the brief runs
  // full-bleed, so an unscoped opt-out silently disabled the measure on
  // tablet (measured 137ch). Pin the media query, not just the presence.
  const optOut = css.slice(css.indexOf("@media screen and (min-width: 1041px)"));
  assert.match(optOut, /\.situation-rail[\s\S]{0,220}max-width: none !important/,
    "the rail is narrower than the cap; it must opt out on the wide layout only");
  assert.doesNotMatch(
    css.replace(optOut, ""),
    /\.col-now[\s\S]{0,160}max-width: none/,
    "an unscoped .col-now opt-out disables the measure at tablet width",
  );
});

// Anti-slop rules 5 + 7 — no fake depth.
// Regression: the active-control rule set both a 1px border AND an inset 1px
// shadow on the same edge, drawing a 2px line that read as a glow.
test("rules 5/7: active controls signal with border colour, not a second ring", () => {
  assert.doesNotMatch(
    css,
    /box-shadow:\s*inset 0 0 0 1px/,
    "an inset shadow on the same edge as the border is fake depth",
  );
  // The active state must still be visible: a colour change, not nothing.
  assert.match(css, /\.scope-btn\.active[\s\S]{0,200}border-color:\s*var\(--cyan\)/,
    "active controls must still show a state change");
});

// Anti-slop rule 4 — no AI-slop fonts.
test("rule 4: the design stack contains no banned face", () => {
  const BANNED = ["Inter", "Poppins", "Montserrat", "Roboto", "Open Sans", "Lato",
    "DM Sans", "Space Grotesk", "Geist", "Plus Jakarta Sans", "Manrope", "Nunito"];
  for (const face of BANNED) {
    assert.doesNotMatch(css, new RegExp(`--font-[a-z]+:[^;]*${face}`, "i"),
      `${face} is a banned AI-slop primary face`);
    assert.doesNotMatch(styles, new RegExp(`--font-[a-z]+:[^;]*${face}`, "i"),
      `${face} is a banned AI-slop primary face`);
  }
  // At most two families. styles.css declares three tokens, but --font-mono
  // and --font-sans resolve to the same stack (written in a different order),
  // so the product is a two-family system: sans for body, serif for display.
  // Compare resolved family names — raw strings differ by ordering alone.
  const families = (decl) =>
    new Set(decl.split(",").map((f) => f.trim().replace(/["']/g, "")).filter(Boolean));
  const tokens = Object.fromEntries(
    [...styles.matchAll(/--font-(sans|display|mono):\s*([^;]+);/g)]
      .map((m) => [m[1], m[2]]),
  );
  assert.ok(tokens.sans && tokens.display, "a sans and a display face must be declared");
  assert.equal(tokens.display, "var(--font-sans)",
    "the board is a single-family sans system; --font-display must alias --font-sans");
  const sans = [...families(tokens.sans)].sort().join("|");
  const mono = [...families(tokens.mono)].sort().join("|");
  assert.equal(mono, sans, "--font-mono must resolve to the same faces as --font-sans");
});

// Anti-slop rule 6 — three type sizes, real contrast between them.
test("rule 6: the type scale is three sizes with a real jump from body to display", () => {
  const m = css.match(/--t-display:\s*(\d+)px;\s*--t-body:\s*(\d+)px;\s*--t-micro:\s*(\d+)px/);
  assert.ok(m, "the three type tokens must be declared together");
  const [display, body, micro] = m.slice(1).map(Number);
  assert.ok(display / body >= 1.5, `display/body jump must be >=1.5x (${display}/${body})`);
  assert.ok(body / micro >= 1.2, `body/micro jump must be >=1.2x (${body}/${micro})`);
  assert.ok(micro >= 11, "micro text must stay at or above 11px for legibility");
  assert.ok(new Set([display, body, micro]).size === 3, "the three sizes must be distinct");
});

// Anti-slop rule 7 — no thick chrome.
// Regression: the map is the hero. If the masthead regrows, the map loses the
// screen and rule 6 loses its focal point. Assert the budget in viewport
// fractions rather than a pixel count, so a deliberate tweak is a visible diff
// instead of a silent re-layout.
test("rule 7: masthead and ticker stay inside 12% of the viewport height", () => {
  // Masthead is owned by reading.css (the final layout layer); the ticker's
  // height is set in styles.css and only narrowed in the wide-screen block.
  const mast = css.match(/\.dashboard-shell \.masthead \{[\s\S]{0,240}?min-height:\s*(\d+)px/);
  assert.ok(mast, "masthead must declare an explicit min-height");
  const mastPx = Number(mast[1]);

  const tickRules = [...styles.matchAll(/\.ticker-bar \{[^}]*\}/g)].map((m) => m[0]);
  const tickHeights = tickRules
    .map((r) => r.match(/(?:min-)?height:\s*(\d+)px/)?.[1])
    .filter(Boolean)
    .map(Number);
  assert.ok(tickHeights.length, "ticker must declare an explicit height somewhere");
  // Use the tallest declared ticker height: a later rule may only widen it.
  const tickPx = Math.max(...tickHeights);

  const budget = 900 * 0.12;
  assert.ok(mastPx + tickPx <= budget,
    `masthead (${mastPx}px) + tallest ticker (${tickPx}px) must leave >88% of a 900px screen`);

  assert.match(css, /\.dashboard-shell \.masthead \{[\s\S]*?display:\s*flex/,
    "masthead must be one flex row, not a stacked block");
  // The board must still fit the screen rather than scrolling the page.
  assert.match(css, /overflow-y:\s*(hidden|clip|auto)/,
    "the one-screen board needs an explicit overflow policy on its frame");
});

// Anti-slop rule 5 — circles are circles, cards are square.
// Regression: the Rams layer sets every border-radius to 0 to keep the control
// room square. Legend and map dots are deliberately exempt so a dot stays round.
test("rule 5: cards are square while map dots stay circular", () => {
  assert.match(css, /border-radius:\s*0 !important/, "the square-corner rule must survive");
  assert.match(
    css,
    /:where\([^)]*\.legend-dot[^)]*\) \{ border-radius: 50% !important/,
    "legend dots must stay round",
  );
});

// ---------------------------------------------------------------------------
// ONE-LINE COMMAND BAR (18 Oct 2026). The secretary's call: the top of the
// board was three stacked bands (masthead 46 + ticker 27 + verdict 72 = 145px)
// for one line of reading each, and the map below them was 19.7% of the first
// screen. These gate the fix. Measured after: one 34px row, map 32.8%.
// ---------------------------------------------------------------------------

const desktopBar = css.slice(css.indexOf("ONE-LINE COMMAND BAR"));
assert.ok(desktopBar.length, "reading.css must document and own the one-line bar");

test("rule 7: the three top zones share ONE grid row instead of stacking", () => {
  // The defect was a stacked head/ticker/verdict block. The fix must place all
  // three on row 1 explicitly — not merely stop giving them heights.
  for (const zone of ["masthead", "ticker-bar", "verdict-strip"]) {
    assert.match(
      desktopBar,
      new RegExp(`\\.dashboard-shell \\.${zone}\\s*\\{[^}]*grid-row:\\s*1`),
      `.${zone} must be pinned to grid row 1`,
    );
  }
  // And row 1 must be a fixed, shallow budget so it cannot creep back.
  assert.match(desktopBar, /min-height:\s*34px/, "the command bar must declare its height");
  assert.match(desktopBar, /max-height:\s*34px/,
    "the command bar must cap its height; a max is what stops chrome regrowing");
});

test("rule 7: every named grid area used by the shell actually exists", () => {
  // The exact regression of 18 Oct: the bar collapsed head/ticker/verdict into
  // one row, but styles.css still assigns .ticker-bar{grid-area:ticker} and
  // .verdict-strip{grid-area:verdict}. Those names were gone from
  // grid-template-areas, so both elements fell into implicit rows at the
  // BOTTOM of the shell and the map column collapsed to 0px — the same class
  // of bug as the 1600px three-areas/two-columns defect in b8f67f5.
  const block = desktopBar.slice(0, desktopBar.indexOf("@media screen and (min-width: 1041px) and"));
  const declared = new Set(
    [...block.matchAll(/grid-template-areas:([\s\S]*?);/g)].flatMap((m) =>
      [...m[1].matchAll(/"([a-z\s]+)"/g)].flatMap((r) => r[1].trim().split(/\s+/)),
    ),
  );
  assert.ok(declared.size, "the shell must declare grid-template-areas");
  // Every grid-area a shell child can ask for, across both layers.
  const used = [...(css + styles).matchAll(/grid-area:\s*([a-z]+)\s*;/g)].map((m) => m[1]);
  for (const name of new Set(used)) {
    if (!["head", "ticker", "verdict", "board", "tools", "tele", "foot"].includes(name)) continue;
    if (desktopBar.indexOf(`grid-area: ${name}`) !== -1) continue;
    assert.ok(declared.has(name),
      `grid-area "${name}" is used but missing from grid-template-areas — ` +
      `the element will auto-place into an implicit row`);
  }
  // The narrow-desktop override must drop the third track, not zero it: a
  // 0-width track still forced the footer into it and wrapped the disclaimer
  // to 163px tall, stealing 118px of map height at 1366px.
  const narrow = desktopBar.slice(desktopBar.indexOf("(min-width: 1041px) and (max-width: 1399px)"));
  assert.match(narrow.slice(0, 400), /grid-template-columns:\s*auto minmax\(0, 1fr\)/,
    "below 1400px the crawl yields by dropping the column, not by zeroing it");
});

test("rule 1: the KPI card is micro type, so the band cannot regrow to 118px", () => {
  // The card measured 117px because .metric-label and .metric-context were
  // never in the micro list, so both rendered at 14px body and the context
  // wrapped to two lines. The band was 118px of the map's screen.
  const microList = css.slice(css.indexOf(".dashboard-shell .verdict-verb,"), css.indexOf("font-size: var(--t-micro) !important"));
  for (const el of [".metric-label", ".metric-context"]) {
    assert.ok(microList.includes(el),
      `${el} must be named in the micro size list, or the KPI band regrows`);
  }
  // ...and the band must be able to stay one row of cards, not three.
  assert.match(desktopBar, /#metricBand \.metric-context \{[^}]*text-overflow:\s*ellipsis/,
    "a long context must truncate rather than wrap the card taller");
});

test("rule 5: the verdict bar says its headline once, in statuses that add something", () => {
  // The reason line was morningBrief().now[0] — character-identical to the first
  // line of "DO THIS TODAY" — so the board said one sentence twice, 30px apart.
  // Strip comments first: the fix is DOCUMENTED in a comment that names the
  // symbol, and a gate must read code, not the prose describing it.
  const src = app.slice(app.indexOf("function renderVerdict"), app.indexOf("// Zone 2"));
  const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, "");
  assert.doesNotMatch(code, /verdict-why/,
    "the reason duplicates briefNow[0]; the brief column is its only copy");
  assert.doesNotMatch(code, /morningBrief/,
    "renderVerdict must not re-read the morning brief that the brief column owns");
  // A chip that repeats the headline verbatim is a box that wraps nothing.
  assert.match(code, /weatherUnverified/,
    "the weather chip must state the warning state, not restate the headline");
  assert.doesNotMatch(code, /verdict-chip[^>]*>\s*\$\{weatherUnknown \? t\("weatherUnknown"\)/,
    "the weather chip must never be the headline string");
});