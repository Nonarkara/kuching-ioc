#!/usr/bin/env node
/**
 * FALSIFY THE SPATIAL GATE.
 *
 * A gate that has never failed proves nothing. This injects one real defect
 * per mode of spatial hallucination into a COPY of the built site and checks
 * that the gate catches each one — and then checks that the clean copy
 * passes, so the gate is not simply always-failing.
 *
 * The defects are self-contained fixtures injected into the page's <main>.
 * They carry their own class names and their own styles, so the falsifier
 * needs to know nothing about the project it is testing. That is deliberate:
 * the instrument has to be portable, so its own proof cannot depend on a
 * project's CSS.
 *
 * Usage: node spatial-falsify.mjs [path-to-built-site]
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHECK = path.join(HERE, "spatial-check.mjs");
const SITE = path.resolve(process.argv[2] || "out");

if (!existsSync(SITE)) {
  console.error(`\nFAIL — no built site at ${SITE}. Nothing was falsified.\n`);
  process.exit(1);
}

// A 1x1 transparent PNG. The size of the drawn image comes from the style
// attribute, so the intrinsic size does not matter.
const PIXEL =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

/**
 * One defect per mode. `at` is where the fixture goes: "bottom" keeps it out
 * of the reader's way so the OTHER checks stay quiet, which is what makes the
 * failure attributable to this fixture alone.
 */
const FIXTURES = [
  {
    name: "an unjustified gap opens between two blocks",
    mode: "unjustified gaps",
    at: "bottom",
    html: `<div class="sl-dead" style="display:flex;flex-direction:column">
<div class="sl-dead-a" style="height:24px;background:#d8d8d8"></div>
<div class="sl-dead-b" style="height:24px;background:#d8d8d8;margin-top:260px"></div>
</div>`,
    expect: "dead: div.sl-dead-a",
  },
  {
    name: "a picture is stranded beside an empty column",
    mode: "orphan elements",
    at: "bottom",
    html: `<div class="sl-orph" style="display:flex;align-items:flex-start">
<div class="sl-orph-cell" style="width:220px"><img class="sl-orph-img" src="${PIXEL}" alt="" style="display:block;width:220px;height:24px"></div>
<div class="sl-orph-tall" style="width:220px;height:420px"></div>
</div>`,
    expect: "orphan: div.sl-orph-cell",
  },
  {
    name: "two related actions are pushed to opposite edges",
    mode: "scattered actions",
    at: "bottom",
    html: `<div class="sl-scat" style="display:flex;justify-content:space-between;width:100%">
<a class="sl-scat-a" href="#sl" style="background:#f59e0b;color:#000;padding:14px 20px;border-radius:8px;text-decoration:none">A</a>
<a class="sl-scat-b" href="#sl" style="background:#f59e0b;color:#000;padding:14px 20px;border-radius:8px;text-decoration:none">B</a>
</div>`,
    expect: "scattered: div.sl-scat",
  },
  {
    name: "a row breaks and leaves one item alone on the last line",
    mode: "accidental wrapping",
    at: "bottom",
    html: `<nav class="sl-wrap" style="display:flex;flex-wrap:wrap;gap:10px;width:170px">
<a class="sl-wrap-a" href="#sl" style="flex:0 0 70px">One</a>
<a class="sl-wrap-b" href="#sl" style="flex:0 0 70px">Two</a>
<a class="sl-wrap-c" href="#sl" style="flex:0 0 70px">Three</a>
</nav>`,
    expect: "wrap: nav.sl-wrap",
  },
  {
    name: "the page scrolls sideways",
    mode: "accidental wrapping",
    at: "bottom",
    html: `<div class="sl-over" style="width:4000px;height:10px"></div>`,
    expect: "scrolls sideways",
  },
  {
    name: "the page makes you scroll before you can do anything",
    mode: "spatially expensive information",
    at: "top",
    html: `<div class="sl-tall" style="height:2400px"></div>`,
    expect: "the first thing you can do moved",
  },
  {
    // The sixth mode. A page where the TITLE loses to another piece of text:
    // the reader cannot tell what the page is for, because nothing on it
    // wins. The house sets its title ratio limit; this proves the limit
    // bites, which no other fixture did.
    name: "a heading louder than the title",
    mode: "false hierarchy",
    at: "top",
    html: `<h2 style="font-size:64px;margin:0">A heading that shouts over the title</h2>`,
    limits: { titleRatio: 1.6 },
    expect: "the title is only",
  },
  {
    // The chrome of a page: the furniture that stands at the edge of the
    // screen. A band that grows takes height away from the work, and the
    // receipt records how tall the chrome is — so a chrome that grows must
    // fail until somebody says why it is there. The baseline rule below
    // proves the same check from the other side, by doctoring the receipt;
    // this one proves it on the page itself.
    name: "the chrome of the page grows",
    mode: "chrome cost",
    at: "top",
    html: `<div class="sl-chrome" style="position:fixed;top:0;left:0;right:0;height:300px;background:#d8d8d8;z-index:9999"></div>`,
    expect: "chrome GREW",
  },
  {
    // The seventh mode, and the one the furniture is measured in: a PINNED
    // band that sits ON the work. The chrome is measured for its cost; this
    // proves the measurement also catches the chrome that covers the work
    // instead of merely costing height. Without this fixture the overlap
    // rule would be a rule nobody had ever seen fail.
    //
    // The bar has to REACH the work. It is 420px tall because this site's
    // own furniture — the header and the door row under it — already occupies
    // the top ~140px, so a shorter bar stands in empty space above the
    // reading and covers nothing: the gate reported that the chrome had
    // grown, which is the previous fixture's job, and the overlap it was
    // injected to prove went unmentioned. A fixture that lands on empty
    // space proves nothing about the rule it names.
    name: "a fixed bar sits on top of the work",
    mode: "overlapping chrome",
    at: "top",
    html: `<div class="sl-overlap" style="position:fixed;top:0;left:0;right:0;height:420px;background:#334455;z-index:9999"></div>`,
    // The finding names the element that is on top of the work. The gate
    // prints it in two places — in the failure line ("overlap: div.sl-overlap
    // has no written reason") and in the list of decisions — and the check
    // is for the ELEMENT, not for the punctuation around it.
    expect: "div.sl-overlap",
  },
  {
    // The SAME overlap, pinned to the RIGHT of the column instead of across
    // it. The fixture above is full width, so its bar sits over the content's
    // left edge too — and a rule that only ever looked near the left edge
    // would pass that one and miss this. The rule used to ask the browser
    // what was on top at one point: twenty pixels in from the content's left
    // edge. A bar that starts further right than that was never asked
    // about, so a bar covering the reading was reported as clean. The rule
    // now asks across the width where the two actually meet.
    name: "a fixed bar pinned to the right sits on top of the work",
    mode: "overlapping chrome",
    at: "top",
    html: `<div class="sl-overlap-right" style="position:fixed;top:0;right:0;width:200px;height:420px;background:#334455;z-index:9999"></div>`,
    expect: "sl-overlap-right",
  },
];

const ROUTES = "/";
const WIDTHS = "390,768,1440";

// ---------------------------------------------------------------- the copy
const WORK = path.join(tmpdir(), `spatial-falsify-${process.pid}-${Date.now()}`);
const COPY = path.join(WORK, "site");
const BASELINE = path.join(WORK, "baseline.json");
mkdirSync(COPY, { recursive: true });
// SITE + "/." and NOT path.join(SITE, "."): path.join normalises the dot away,
// and `cp -R <dir> <existing-dir>` then copies the site INTO it as <dir>/out.
// The gate would serve a directory with no index.html and measure a 404.
execFileSync("cp", ["-R", `${SITE}/.`, COPY], { stdio: "ignore" });
if (!existsSync(path.join(COPY, "index.html"))) {
  console.error(`\nFAIL — the copy at ${COPY} has no index.html. Nothing was falsified.\n`);
  process.exit(1);
}

function cleanup() {
  try {
    // The trash helper belongs to the runtime and is not in the same place on
    // every machine, so it is asked for rather than assumed.
    const trash = process.env.MAVIS_TRASH || path.join(homedir(), ".minimax", "bin", "mavis-trash");
    if (existsSync(trash)) execFileSync(trash, ["--", WORK]);
    else rmSync(WORK, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { cleanup(); process.exit(130); });

// The verdict is at the END of the output — the notes are printed to stdout and
// the failures to stderr, and stdout comes first — so the excerpt shows the
// tail, not the head.
function excerpt(out) {
  return out.trim().split("\n").slice(-14).join("\n");
}

function runGate(args, routes) {
  const res = spawnSync(
    process.execPath,
    [
      CHECK,
      "--dir",
      COPY,
      "--baseline",
      BASELINE,
      "--routes",
      routes || ROUTES,
      "--widths",
      WIDTHS,
      ...args,
    ],
    { encoding: "utf8", timeout: 600000 },
  );
  return {
    pass: res.status === 0,
    out: `${res.stdout || ""}${res.stderr || ""}`,
  };
}

/** The same gate, but over EVERY route in the copy. */
function runFullGate(args) {
  const res = spawnSync(
    process.execPath,
    [CHECK, "--dir", COPY, "--baseline", BASELINE, "--widths", WIDTHS, ...args],
    { encoding: "utf8", timeout: 900000 },
  );
  return {
    pass: res.status === 0,
    out: `${res.stdout || ""}${res.stderr || ""}`,
  };
}

// ---------------------------------------------------------------- the baseline
// Generated from the clean copy, with a synthetic reason on every finding so
// the clean copy can pass. This baseline is a measuring device for the
// falsifier, not a review of the project.
const gen = runFullGate(["--update"]);
if (!existsSync(BASELINE)) {
  console.error(`\nFAIL — the gate could not write a baseline for the falsifier.\n${gen.out}\n`);
  process.exit(1);
}
const baseline = JSON.parse(readFileSync(BASELINE, "utf8"));
let blessed = 0;
// A reason belongs to a decision, so the falsifier gives every decision it
// finds a synthetic reason. This baseline is a measuring device for the
// falsifier, not a review of the project.
baseline.reasons = baseline.reasons || {};
for (const byWidth of Object.values(baseline.routes || {})) {
  for (const entry of Object.values(byWidth)) {
    for (const f of entry.findings || []) {
      const k = `${f.kind}|${f.sel}`;
      if (!baseline.reasons[k]) {
        baseline.reasons[k] = "synthetic baseline for falsification";
        blessed++;
      }
    }
  }
}
writeFileSync(BASELINE, JSON.stringify(baseline, null, 2) + "\n");

// ---------------------------------------------------------------- the clean run
const clean = runGate([]);
if (!clean.pass) {
  console.error("\nFAIL — the gate does not pass on the clean build. Fix that first.\n");
  console.error(clean.out);
  process.exit(1);
}
console.log(`  · clean build passes (${blessed} pre-existing finding(s) given synthetic reasons)`);

// ---------------------------------------------------------------- the fixtures
const PAGE = path.join(COPY, "index.html");
if (!existsSync(PAGE)) {
  console.error("\nFAIL — the copy has no index.html to inject into.\n");
  process.exit(1);
}
const ORIGINAL = readFileSync(PAGE, "utf8");

/**
 * The fixture is MOUNTED BY SCRIPT, not pasted into the markup.
 *
 * A modern app hydrates the page after the HTML is parsed, and hydration can
 * remove nodes the framework does not own. A fixture pasted into the
 * exported markup can therefore be gone before anything measures it — and a
 * gate that never sees the defect it was given is a gate that looks fine
 * because it looked at nothing. So the fixture mounts after load, and
 * re-mounts if anything removes it.
 */
const MOUNTER = `<script id="__sl_mounter__">
(function () {
  var HTML = __HTML__;
  var WHERE = __WHERE__;
  function mount() {
    var m = document.querySelector("main#content") || document.querySelector("main") || document.body;
    if (!m) return;
    var existing = document.getElementById("__sl_fixture__");
    if (existing && existing.parentElement === m) return;
    if (existing) existing.remove();
    var t = document.createElement("template");
    t.innerHTML = HTML;
    // The fixture is wrapped, so the wrapper's id never becomes the finding's
    // selector: the finding must name the element that actually misbehaves.
    //
    // The wrapper generates NO BOX. The page's own layout is a grid, and a
    // wrapper inserted as the first child becomes a grid item: it takes the
    // first row, and everything below it moves down. The fixture then
    // measures a page that is not the page - the tools row sat 48px lower
    // than the receipt said, the gate reported THAT, and the defect the
    // fixture was injected to prove went unmentioned. The rule is that the
    // wrapper generates no box at all (display:contents), so the wrapper keeps
    // its identity without becoming a grid item, and the fixture lands on the
    // page the reader gets.
    //
    // NOTE: this whole script is a template literal. No backticks in here.
    var wrap = document.createElement("div");
    wrap.id = "__sl_fixture__";
    wrap.style.display = "contents";
    while (t.content.firstChild) wrap.appendChild(t.content.firstChild);
    if (WHERE === "top" && m.firstChild) m.insertBefore(wrap, m.firstChild);
    else m.appendChild(wrap);
  }
  function start() {
    mount();
    setTimeout(mount, 60);
    setTimeout(mount, 140);
    setTimeout(mount, 200);
  }
  if (document.readyState === "complete") setTimeout(start, 0);
  else addEventListener("load", function () { setTimeout(start, 0); });
})();
</script>`;

function inject(html, at) {
  const mounter = MOUNTER.replace("__HTML__", JSON.stringify(html)).replace("__WHERE__", JSON.stringify(at));
  // The script has to RUN, so it cannot go inside a <noscript>: a browser
  // does not execute what is in there, so the fixture is never mounted, the
  // gate never sees the defect it was given, and every rule reports itself
  // dead while proving nothing. An app shell usually carries a <main>
  // inside its <noscript> fallback — the "JavaScript is required" page —
  // and that is the one a regex finds first. So the script goes at the end
  // of the body, and the mounter finds the page's own mount target at
  // runtime, which is what it was written to do.
  const m3 = /<\/body\s*>/i.exec(ORIGINAL);
  if (m3) return ORIGINAL.slice(0, m3.index) + "\n" + mounter + "\n" + ORIGINAL.slice(m3.index);
  return ORIGINAL + mounter;
}

let failures = 0;
for (const f of FIXTURES) {
  const savedBaseline = readFileSync(BASELINE, "utf8");
  if (f.limits) {
    const b = JSON.parse(savedBaseline);
    b.limits = { ...(b.limits || {}), ...f.limits };
    writeFileSync(BASELINE, JSON.stringify(b, null, 2) + "\n");
  }
  writeFileSync(PAGE, inject(f.html, f.at));
  const res = runGate([]);
  writeFileSync(BASELINE, savedBaseline);
  writeFileSync(PAGE, ORIGINAL);
  if (res.pass) {
    console.error(`  ✗ ${f.name} — the gate did NOT catch it. The rule is dead.`);
    failures++;
  } else if (!res.out.includes(f.expect)) {
    console.error(
      `  ✗ ${f.name} — the gate failed, but not for the expected reason.\n` +
        `      expected a message containing "${f.expect}", got:\n${excerpt(res.out)}`,
    );
    failures++;
  } else {
    console.log(`  · caught: ${f.name}  [${f.mode}]`);
  }
}

if (failures) {
  console.error(`\nFAIL — ${failures} rule(s) did not bite. The gate is not trustworthy.\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- the rules about the baseline
// The gate is also a set of rules about the BASELINE, and a rule about the
// baseline can be as dead as a rule about a page. Each case below breaks the
// baseline on purpose and expects the gate to notice. A rule that has never
// failed is a rule nobody should rely on.
const BASELINE_SAVED = readFileSync(BASELINE, "utf8");

function withBaseline(mutate) {
  const b = JSON.parse(BASELINE_SAVED);
  mutate(b);
  writeFileSync(BASELINE, JSON.stringify(b, null, 2) + "\n");
}

const BASELINE_RULES = [
  {
    name: "a reason for a decision that no longer exists",
    expect: "stale reason",
    full: true,
    mutate: (b) => {
      b.reasons["dead|div.__gone__"] = "a reason for a decision that is not there";
    },
  },
  {
    name: "the chrome grows and the receipt does not",
    expect: "chrome GREW",
    full: true,
    mutate: (b) => {
      // The receipt records how tall the chrome is, at every route and every
      // width. Take forty pixels off the number it recorded, and the chrome
      // the gate measures now looks forty pixels BIGGER than the page it was
      // measured on — which is what happens the day somebody makes the header
      // taller and forgets the receipt. Without this rule, the chrome drift
      // check is a check nobody has ever seen fail.
      for (const byw of Object.values(b.routes || {})) {
        for (const entry of Object.values(byw)) {
          if (entry.chrome && entry.chrome.top) {
            entry.chrome.top = Math.max(0, entry.chrome.top - 40);
            return;
          }
        }
      }
    },
  },
  {
    name: "an absolute limit bites on a page the baseline already knows",
    expect: "the first thing you can do is",
    full: true,
    mutate: (b) => {
      b.limits = { ...b.limits, firstAction: 200 };
    },
  },
  {
    name: "a page the baseline has never seen, with a long scroll before the action",
    expect: "the first thing you can do is",
    also: ["sl-never-seen"],
    full: true,
    mutate: (b) => {
      // A bound only the new page breaks: every other page's first action is
      // well inside 1200px, so the failure can only be about the new page.
      b.limits = { ...b.limits, firstAction: 1200 };
    },
    site: () => {
      // A route that has never been in the baseline: a copy of the home page
      // with two thousand pixels of nothing in front of its first action.
      // The name must not begin with an underscore — the gate skips those
      // directories, the way it skips a framework's own build output.
      //
      // The spacer is MOUNTED BY SCRIPT, not pasted into the markup: a
      // modern app hydrates the page and removes the nodes the framework
      // does not own, so a pasted spacer is gone before anything measures
      // it — and a fixture that vanishes is a fixture that never happened.
      const dir = path.join(COPY, "sl-never-seen");
      mkdirSync(dir, { recursive: true });
      const html = readFileSync(path.join(COPY, "index.html"), "utf8");
      writeFileSync(path.join(dir, "index.html"), inject('<div style="height:2000px"></div>', "top"));
    },
    cleanupSite: () => rmSync(path.join(COPY, "sl-never-seen"), { recursive: true, force: true }),
  },
  {
    name: "an exemption that is written down excuses the limit it names",
    expect: null,
    note: "the written exemption let the limit pass",
    full: false,
    mutate: (b) => {
      b.limits = { ...b.limits, firstAction: 200 };
      b.exempt = [
        { route: "/", check: "firstAction", why: "a synthetic exemption, written down for falsification" },
      ];
    },
  },
  {
    name: "a page with no <main> element at all",
    expect: null,
    note: "the gate measured a page with no <main>",
    full: true,
    site: () => {
      // A project whose pages have no <main> must still be measured, not
      // waited on until the harness gives up.
      const dir = path.join(COPY, "sl-no-main");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "index.html"),
        "<!doctype html><html><head><meta charset=utf-8><title>no main</title></head>" +
          "<body><p>A page that never learned the main element.</p></body></html>",
      );
    },
    cleanupSite: () => rmSync(path.join(COPY, "sl-no-main"), { recursive: true, force: true }),
  },
  {
    name: "an exemption for a page that is not there",
    expect: "stale exemption",
    full: true,
    mutate: (b) => {
      b.exempt = [
        ...(b.exempt || []),
        {
          route: "/no-such-route/",
          check: "firstAction",
          why: "a synthetic exemption, written down for falsification",
        },
      ];
    },
  },
  {
    name: "a decision the receipt has no numbers for",
    expect: "the baseline records no numbers for this route and width",
    full: true,
    mutate: (b) => {
      // Keep the reason, lose the numbers. The decision is still justified,
      // so the gate cannot complain that it is unjustified — it must
      // complain that nothing would notice if it changed.
      for (const byw of Object.values(b.routes || {})) {
        for (const [w, entry] of Object.entries(byw)) {
          if ((entry.findings || []).length) {
            delete byw[w];
            return;
          }
        }
      }
    },
  },
  {
    name: "a hole that grew since the receipt was written",
    expect: "GREW",
    full: true,
    mutate: (b) => {
      for (const byw of Object.values(b.routes || {})) {
        for (const entry of Object.values(byw)) {
          for (const f of entry.findings || []) {
            if (f.kind === "dead" || f.kind === "orphan") {
              f.metric = Math.max(0, f.metric - 300);
              return;
            }
          }
        }
      }
    },
  },
  {
    name: "a hole that shrank since the receipt was written",
    expect: "SHRANK",
    full: true,
    mutate: (b) => {
      for (const byw of Object.values(b.routes || {})) {
        for (const entry of Object.values(byw)) {
          for (const f of entry.findings || []) {
            if (f.kind === "dead" || f.kind === "orphan") {
              f.metric = f.metric + 300;
              return;
            }
          }
        }
      }
    },
  },
  {
    // The gate loads EVERY width fresh, so the geometry it records is the
    // geometry a reader gets at that width. If it did not, a page that
    // decides its layout once, from the width it was loaded at, would be
    // measured at whichever width it happened to be loaded at first — and
    // every other width would be a lie.
    //
    // This page decides its gap ONCE, at load, and never again. The gap
    // exists only between 700px and 800px. So the gate must find it at
    // 768px and must NOT report it at 390px or at 1440px, where the page
    // has no gap at all.
    name: "a page whose layout is decided by the width it was loaded at",
    expect: "/sl-one-width/ @768px",
    // The finding marker, not the route: a route the receipt has never seen
    // is named in the NOTES as well ("no baseline entry for this
    // route/width"), so a bare route would read as a finding at every width
    // it was measured at. A FINDING at 390 or 1440 would be the gate
    // inventing a hole where the page has none.
    not: ["✗ /sl-one-width/ @390px", "✗ /sl-one-width/ @1440px"],
    routes: "/sl-one-width/",
    site: () => {
      const dir = path.join(COPY, "sl-one-width");
      mkdirSync(dir, { recursive: true });
      writeFileSync(
        path.join(dir, "index.html"),
        `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>one width</title>
<style>html,body{margin:0;padding:0;background:#fff}main{padding:24px}
main h1{font-size:32px;margin:0 0 16px}
.sl-col{display:flex;flex-direction:column}
.sl-a{height:24px;background:#ddd}.sl-b{height:24px;background:#ccc}</style>
</head><body>
<main id="content">
<h1>One width</h1>
<div class="sl-col"><div class="sl-a"></div><div class="sl-b"></div></div>
</main>
<script>
// The gap is decided ONCE, when the page loads, from the width it was
// loaded at. Resizing the window afterwards does not move it, so a resized
// page and a freshly loaded page are genuinely different pages. The gap
// exists only in one range of widths, so the gate has to be measuring each
// width at its own width.
var w = window.innerWidth;
document.querySelector(".sl-b").style.marginTop = (w >= 700 && w < 800) ? "260px" : "0px";
</script>
</body></html>`,
      );
    },
    cleanupSite: () => rmSync(path.join(COPY, "sl-one-width"), { recursive: true, force: true }),
  },
];

for (const rule of BASELINE_RULES) {
  writeFileSync(BASELINE, BASELINE_SAVED);
  if (rule.site) rule.site();
  withBaseline(rule.mutate || (() => {}));
  const res = rule.full ? runFullGate([]) : runGate([], rule.routes);
  if (rule.cleanupSite) rule.cleanupSite();
  writeFileSync(BASELINE, BASELINE_SAVED);
  if (rule.expect === null) {
    // This one must PASS: the page has no <main>, and the gate must measure
    // it rather than time out on it.
    if (!res.pass) {
      console.error(
        `  ✗ ${rule.name} — the gate failed instead of measuring it:\n${excerpt(res.out)}`,
      );
      failures++;
    } else if (res.out.includes("timed out waiting for the page")) {
      console.error(`  ✗ ${rule.name} — the gate timed out on it. The body fallback is not working.`);
      failures++;
    } else {
      console.log(`  · caught: ${rule.name}  [${rule.note || "the gate measured it"}]`);
    }
    continue;
  }
  if (res.pass) {
    console.error(`  ✗ ${rule.name} — the gate did NOT catch it. The rule is dead.`);
    failures++;
  } else if (
    !res.out.includes(rule.expect) ||
    (rule.also || []).some((a) => !res.out.includes(a)) ||
    (rule.not || []).some((n) => res.out.includes(n))
  ) {
    console.error(
      `  ✗ ${rule.name} — the gate failed, but not for the expected reason.\n` +
        `      expected a message containing "${rule.expect}"${(rule.also || []).map((a) => ` and "${a}"`).join("")}` +
        `${(rule.not || []).map((n) => ` and NOT "${n}"`).join("")}, got:\n${excerpt(res.out)}`,
    );
    failures++;
  } else {
    console.log(`  · caught: ${rule.name}  [a rule about the baseline]`);
  }
}

// The other direction: a PARTIAL sweep has not seen the routes the reason
// belongs to, so it must not call that reason stale. A rule that fires on
// everything is as useless as a rule that fires on nothing.
{
  const b = JSON.parse(BASELINE_SAVED);
  b.reasons["dead|div.__gone__"] = "a reason for a decision that is not there";
  writeFileSync(BASELINE, JSON.stringify(b, null, 2) + "\n");
  const res = runGate([]);
  writeFileSync(BASELINE, BASELINE_SAVED);
  if (!res.pass) {
    console.error(
      `  ✗ a partial sweep is not told a reason is stale — the gate failed on a reason it never had the chance to see:\n` +
        excerpt(res.out),
    );
    failures++;
  } else {
    console.log(`  · caught: a partial sweep is not told a reason is stale  [the rule does not fire on everything]`);
  }
}

if (failures) {
  console.error(`\nFAIL — ${failures} rule(s) did not bite. The gate is not trustworthy.\n`);
  process.exit(1);
}

const modes = [...new Set(FIXTURES.map((f) => f.mode))].sort();
console.log(
  `\n  · spatial gate: ${FIXTURES.length} injected page defects, ${BASELINE_RULES.length + 1} broken-baseline cases ` +
    `and 1 case about the instrument itself, all caught.\n` +
    `  · modes covered: ${modes.join(", ")} — ${modes.length} of the 8.\n` +
    `  · Every mode has failed at least once, every rule about the baseline has failed at least once, ` +
    `and a page that decides its layout once, from the width it was loaded at, has been caught at the width ` +
    `where a reader would see it.\n`,
);
// Everything was caught, so the proof is over and the process ends here
// rather than waiting for a handle it has no further use for.
process.exit(0);
