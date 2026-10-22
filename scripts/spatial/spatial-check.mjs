#!/usr/bin/env node
/**
 * THE SPATIAL GATE — the portable half of the spatial law.
 *
 * WHAT THIS IS FOR
 * ----------------
 * An interface invents a reason for things to occupy space when it arranges
 * itself around a grid instead of around how people read, choose and act.
 * The six modes are: unjustified gaps, orphan elements, scattered actions,
 * false hierarchy, accidental wrapping, spatially expensive information.
 *
 * The recurring question is "Why is this here, why this size, and why this
 * far from that?" — and the answer must never be "because the grid put it
 * there."
 *
 * HOW THIS TOOL ENFORCES THAT
 * ----------------------------
 * Not with thresholds. A threshold that is wrong for one page is wrong for a
 * thousand, and a gate that cries wolf is worse than a gate that stays quiet.
 * (That is not a theory here — it is what happened to a sibling gate in this
 * same project: a limit of "at most 12 bold things per page" was written,
 * never compared, and turned out to be unmeetable by correct design, because
 * a dictionary of 89 headwords is supposed to have 89 headwords.)
 *
 * Instead: GEOMETRY BECOMES A FACT THAT CANNOT CHANGE SILENTLY.
 *
 *   - Every hole, orphan, scattered pair, wrap and clipped row is MEASURED.
 *   - Every measurement is written into a per-project BASELINE, together with
 *     a written reason. A finding with no reason is a failure, because "no
 *     reason" is exactly what "the grid put it there" sounds like when you
 *     write it down.
 *   - When a page changes, its geometry changes, the baseline diff changes,
 *     and the change is visible in a review. A new hole has no reason yet, so
 *     it fails the gate until somebody writes one.
 *
 * So the law is not a limit. It is a receipt.
 *
 * THE THREE RULES THAT ARE ABSOLUTE
 * ---------------------------------
 * Three things fail regardless of any baseline, because no reading of them
 * makes them acceptable in any project:
 *
 *   - the page scrolls sideways at some width;
 *   - a row breaks and leaves one orphan alone on the last row;
 *   - the instrument failed to measure (a missing route, an unreadable page,
 *     a missing browser). A gate that measures less than it promised fails;
 *     it never passes quietly.
 *
 * USAGE
 * -----
 *   node spatial-check.mjs --dir out --baseline design/spatial-baseline.json
 *   node spatial-check.mjs --dir out --update     # refresh the baseline
 *   node spatial-check.mjs --dir out --report     # print, do not fail
 *   node spatial-check.mjs --base https://host/   # measure a deployed site
 *
 *   --dir <path>       the built site to measure (default: out)
 *   --baseline <path>  the project's baseline file (default: design/spatial-baseline.json)
 *   --routes a,b,c     measure only these routes (default: every built route)
 *   --widths a,b,c     the widths to sweep (default: 360,480,768,1024,1440,1920)
 *   --base <url>       measure a running site instead of a directory
 *   --update           write the measurements into the baseline
 *   --report           print the measurements without failing
 *   --json <path>      also write the raw measurements to a file
 */
import { createServer } from "node:http";
import { readdir } from "node:fs/promises";
import { existsSync, readFileSync, writeFileSync, mkdirSync, statSync, rmSync, readdirSync } from "node:fs";
import { execFileSync, spawn } from "node:child_process";
import { tmpdir, homedir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { measureMetricEvidence } from '../../public/measurement.js';
import { withDeadline } from './deadline.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));

// ---------------------------------------------------------------- arguments
const argv = process.argv.slice(2);
function arg(name, fallback) {
  const i = argv.indexOf("--" + name);
  if (i === -1) return fallback;
  const v = argv[i + 1];
  return v && !v.startsWith("--") ? v : true;
}
const DIR = arg("dir", "out");
const BASELINE = arg("baseline", path.join("design", "spatial-baseline.json"));
const ROUTES_ARG = arg("routes", null);
const WIDTHS_ARG = arg("widths", null);
const BASE = arg("base", null);
const UPDATE = argv.includes("--update");
const REPORT = argv.includes("--report");
const JSON_OUT = arg("json", null);

const DEFAULT_WIDTHS = [360, 480, 768, 1024, 1440, 1920];
const DEFAULT_LIMITS = {
  // A hole must be at least this tall to be a hole (px).
  deadGap: 72,
  // A cell filling less than this fraction of its row is stranded.
  orphanFill: 0.5,
  // Two loud controls further apart than this fraction of the container are
  // scattered.
  scatteredApart: 0.55,
  // How much a known finding may grow before the growth itself is the defect.
  grownTolerance: 24,
  // How much the first action may move before the move is the defect (px).
  firstActionTolerance: 120,
  // How much the chrome may grow before the growth is the defect (px).
  // Chrome is the furniture of the page: every pixel it takes is a pixel the
  // work does not get.
  chromeTolerance: 16,
  // Optional absolute limits. Off by default; a project turns them on with
  // the numbers it has measured for itself.
  firstAction: null,
  titleRatio: null,
  peerShare: null,
  // The share of the first screen the chrome may take. Off by default: a
  // large footprint is a prompt to investigate, not a number that is wrong
  // for every house.
  chromeTopPct: null,
  // The type sizes this project is allowed to set text at. null = any.
  allowedSizes: null,
};

// The metric of each finding kind is compared with its own tolerance: px for
// space, percentage points for distance, and "no change" for structure.
const KIND_TOLERANCE = {
  dead: "grownTolerance",
  orphan: "grownTolerance",
  scattered: 6,
  wrap: 0,
  clip: 8,
  overflow: 0,
  overlap: 8,
};

// ---------------------------------------------------------------- chrome
const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
].filter(Boolean);
const CHROME = CHROME_CANDIDATES.find((c) => existsSync(c));

if (!CHROME) {
  console.error(
    "\nFAIL — the spatial gate could not measure.\n" +
      "  No Chrome binary found. Tried:\n" +
      CHROME_CANDIDATES.map((c) => `    ${c}\n`).join("") +
      "  Set CHROME_PATH=/path/to/chrome.\n",
  );
  process.exit(1);
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".woff": "font/woff",
  ".mp3": "audio/mpeg",
  ".mp4": "video/mp4",
};

const PROBE_SRC = readFileSync(path.join(HERE, "spatial-probe.js"), "utf8");

// ---------------------------------------------------------------- the harness
// One page, one iframe per measurement. The iframe is same-origin with the
// harness, so the probe can be injected into it and read its geometry.
//
// EVERY MEASUREMENT IS A FRESH LOAD AT THE WIDTH BEING MEASURED.
//
// That is the whole design, and it is a change of mind. The gate used to load
// each route once and measure the other widths by resizing the loaded page,
// because that is what a browser does when the window changes. It was fast,
// and it was wrong in two ways that a reviewer found:
//
//   - Resizing a page does not re-run the page's own load-time decisions. A
//     page whose layout is decided once, from the width it was loaded at,
//     keeps that decision at every other width — so the gate measured a page
//     no reader ever sees, and passed a page with a 260px hole in it.
//   - A layout that catches up after a resize (a ResizeObserver, a chart
//     redraw) is delivered at a RENDERING OPPORTUNITY. Under a virtual clock
//     the browser does not produce those, so the measurement was taken of a
//     layout that had not caught up yet — which is why the same build passed
//     on one run and failed on the next.
//
// So the gate stopped assuming anything. It loads the page at the width it is
// about to measure, gives it real time to render, and measures what a reader
// would get. It is slower and it is honest, and honesty is the only thing a
// gate has.
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><title>spatial probe</title>
<style>html,body{margin:0;padding:0;background:#111;color:#eee}
iframe{border:0;display:block;background:#fff}
pre{font:11px/1.35 ui-monospace,Menlo,monospace;white-space:pre-wrap;word-break:break-all;padding:8px;margin:0}</style>
</head><body>
<iframe id="f" title="probe target"></iframe><pre id="out"></pre>
<script>
var WIDTHS = __WIDTHS__;
var ROUTES = __ROUTES__;
var PROBE = __PROBE__;
var f = document.getElementById('f');
var out = document.getElementById('out');
var TAG_OK = 'RESULT' + 'S:';
var TAG_ERR = 'RESULT' + 'S:ERROR:';
window.onerror = function (msg, src, line, col, err) {
  out.textContent = TAG_ERR + (err && err.stack ? err.stack : msg) +
    ' @' + line + ':' + col + ' src=' + String(src).slice(0, 80);
  try { fetch('/__spatial-results', { method: 'POST', body: JSON.stringify({ error: out.textContent }) }); } catch (e) {}
  return true;
};

// The probe belongs to the page, not the harness.
function installProbe(d) {
  var s = d.createElement('script');
  s.textContent = PROBE;
  (d.head || d.documentElement).appendChild(s);
}

// A page has finished re-laying-out when its shape stops changing AND the
// things that can change it late have arrived: its fonts, its images.
//
// The signature is deliberately cheap and deliberately blind to what the reader
// sees: the document's own scroll size, how many elements it holds, the
// rendered width of every SVG (the one thing a ResizeObserver re-draws),
// and how much TEXT the page holds.
//
// The text matters because a page can change what it SAYS without changing
// what it LOOKS like: a status line that says "saving…" and then says
// "ready" is two different pages with the same geometry. Measuring one of
// them at one moment and the other at another is how two measurements of
// "the same page" stop agreeing.
function signature(d) {
  var doc = d.documentElement;
  var svgs = d.getElementsByTagName('svg');
  var sw = 0;
  for (var i = 0; i < svgs.length; i++) sw += Math.round(svgs[i].getBoundingClientRect().width);
  var main = d.querySelector("main#content") || d.querySelector("main") || d.body;
  var text = main ? main.textContent.length : 0;
  return doc.scrollWidth + '|' + doc.scrollHeight + '|' +
    d.getElementsByTagName('*').length + '|' + sw + '|' + text;
}

// Is everything that can arrive late here yet?
function arrived(d) {
  try {
    var ff = d.fonts;
    if (ff && ff.status && ff.status !== 'loaded') return false;
  } catch (e) { /* no font API in this document */ }
  var imgs = d.getElementsByTagName('img');
  for (var i = 0; i < imgs.length; i++) {
    if (!imgs[i].complete) return false;
  }
  return true;
}

// Wait for the page to stop moving: three identical readings in a row, at
// least a tenth of a second of real time gone by, everything that can arrive
// late has arrived — and then ONE MORE beat to be sure.
//
// The clock here is REAL time, and that is the point. The browser is given
// real time to render, because a layout that catches up after a load is
// delivered at a rendering opportunity, and a measurement taken before that
// opportunity is a measurement of a page nobody ever sees.
//
// The wait is never unbounded: the deadline is five seconds, because a wait
// that never ends is a measurement that never arrives.
function settle(d, cb) {
  var tries = 0, last = null, stable = 0, start = Date.now();
  var verified = false;
  function step() {
    var elapsed = Date.now() - start;
    if (tries++ > 600 || elapsed > 5000) return cb();
    var s;
    try { s = signature(d); } catch (e) { return cb(); }
    if (s === last) stable++; else { stable = 0; last = s; }
    if (stable >= 3 && elapsed >= 100 && arrived(d)) {
      if (verified) return cb();
      verified = true;
      // One more beat, then look again. If the page moved, it was still
      // moving, and the measurement is taken again.
      setTimeout(function () {
        var again;
        try { again = signature(d); } catch (e) { return cb(); }
        if (again === last) return cb();
        verified = false; stable = 0; last = again;
        step();
      }, 40);
      return;
    }
    setTimeout(step, 25);
  }
  setTimeout(step, 25);
}

function measureDoc(d, route, w, cb) {
  if (!d.__spatialInstalled) { d.__spatialInstalled = true; installProbe(d); }
  var wv = d.defaultView;
  if (!wv || typeof wv.__SPATIAL_MEASURE__ !== 'function') {
    return cb({ route: route, w: w, error: 'probe missing' });
  }
  // A reader arrives at the top of the page. A measurement taken half way
  // down would be of a page nobody sees.
  try { wv.scrollTo(0, 0); } catch (e) { /* nothing to scroll */ }
  var rec = wv.__SPATIAL_MEASURE__(route, w, d);
  if (d.querySelector('meta[name="spatial-ready"]')) {
    rec.board = {
      state: d.documentElement.getAttribute('data-board-state'),
      metrics: d.querySelectorAll('#metricBand [data-metric-id]').length,
      brief: d.querySelectorAll('#briefNow .brief-item').length,
      funnel: d.querySelectorAll('#researchPanel .evidence-funnel .rp-step').length,
      map: !!d.querySelector('#mapCanvas .leaflet-pane'),
      font: wv.getComputedStyle(d.body).fontFamily
    };
    rec.board.metricEvidence = (__METRIC_PROBE__)(d);
    for (var item of rec.board.metricEvidence) {
      if (item.overlap > 0) rec.findings.push({ kind: 'overlap', sel: 'metric-evidence:' + item.id, metric: item.overlap, detail: 'Evidence control covers visible freshness glyphs' });
    }
    if (rec.board.state !== 'ready' || rec.board.metrics < 4 || rec.board.brief < 1 || rec.board.funnel !== 5 || !rec.board.map) {
      return cb({ route: route, w: w, error: 'critical board content missing', board: rec.board });
    }
  }
  // Clear what this page left behind, so the NEXT measurement of this route
  // starts from an empty state. A receipt of a page that remembers the last
  // measurement is a receipt of the instrument, not of the product.
  try { wv.localStorage.clear(); wv.sessionStorage.clear(); } catch (e) { /* no storage */ }
  cb(rec);
}

// A FRESH NAVIGATION — the only way to be sure the page is what a reader
// would get at this width.
//
// Two guards, both learned the hard way.
//
// TOKEN: the iframe fires load for about:blank as well as for the real
// page, so one navigation can start twice. A stale run must never call
// back — after the iframe navigates, the captured window forwards to the
// new document, the probe it installed is gone, and calling it throws
// "is not a function".
//
// done: exactly one result per navigation. Two loops racing on the same
// iframe would report the same page twice, and the gate would then claim
// to have measured more than it promised.
function loadPage(route, w, h, cb) {
  var token = ++TOKEN;
  var done = false;
  function finish(rec) {
    if (done) return;
    done = true;
    cb(rec);
  }
  f.style.width = w + 'px';
  f.style.height = h + 'px';
  // The query string stops the browser from answering with a page it has
  // already laid out at another width.
  f.src = route + (route.indexOf('?') >= 0 ? '&' : '?') + '__spatial=' + token;
  f.onload = function () {
    if (token !== TOKEN) return;
    var tries = 0;
    (function wait() {
      if (token !== TOKEN) return;
      var d;
      try { d = f.contentDocument; } catch (e) { return finish({ route: route, w: w, error: 'cross-origin' }); }
      if (!d) return finish({ route: route, w: w, error: 'no document' });
      if (tries++ > 600) return finish({ route: route, w: w, error: 'timed out waiting for the page' });
      var mainEl = d && (d.querySelector('main#content') || d.querySelector('main') || d.body);
      // A page that loads its content after 'complete' can say so:
      // <meta name="spatial-ready" content="data-some-attribute"> makes the
      // gate wait for that attribute on <html>. Without it the gate settles
      // on a skeleton between two async stages and measures nothing real.
      var rm = d.querySelector('meta[name="spatial-ready"]');
      if (rm && d.documentElement.getAttribute('data-board-state') === 'error') {
        return finish({ route: route, w: w, error: 'board render failed' });
      }
      if (rm && !d.documentElement.hasAttribute(rm.getAttribute('content'))) {
        return setTimeout(wait, 50);
      }
      if (d.readyState === 'complete' && mainEl) {
        if (!d.__spatialInstalled) { d.__spatialInstalled = true; installProbe(d); }
        var wv = d.defaultView;
        if (wv && typeof wv.__SPATIAL_MEASURE__ === 'function') {
          return settle(d, function () {
            if (token !== TOKEN) return;
            // The page may have navigated while we settled. If it did, the
            // window we captured now belongs to a different document, and the
            // probe is not there any more.
            //
            // The window proxy is REUSED across a same-origin navigation, so
            // comparing defaultView cannot tell the two documents apart —
            // the probe's presence is the only honest test.
            if (typeof wv.__SPATIAL_MEASURE__ !== 'function') return wait();
            measureDoc(d, route, w, finish);
          });
        }
      }
      setTimeout(wait, 25);
    })();
  };
}

// The FIRST-SCREEN SIZES the law names.
//
//   390 x 844   a phone fold
//   1440 x 900  a laptop window
//
// The width in between is measured at 1000px, and the height used is
// recorded, because a first screen measured at an unnamed height is a
// first screen nobody can reproduce.
function heightFor(w) {
  if (w <= 480) return 844;
  if (w >= 1200) return 900;
  return 1000;
}

var TOKEN = 0;

function post(payload) {
  out.textContent = TAG_OK + JSON.stringify(payload);
  try {
    fetch('/__spatial-results', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } catch (e) { /* the dump below is the fallback */ }
}

function run() {
  var results = [];
  var i = 0, j = 0;
  function step() {
    if (i >= ROUTES.length) { post({ measurements: results }); return; }
    var route = ROUTES[i];
    var W = WIDTHS[j];
    loadPage(route, W, heightFor(W), function (rec) {
      rec.route = route; rec.w = W;
      results.push(rec);
      j++;
      if (j >= WIDTHS.length) { j = 0; i++; }
      step();
    });
  }
  document.documentElement.style.overflow = 'hidden';
  document.body.style.overflow = 'hidden';
  step();
}
run();
</script></body></html>`;

function harnessHtml(widths, routes) {
  return HARNESS.replace("__WIDTHS__", JSON.stringify(widths))
    .replace("__ROUTES__", JSON.stringify(routes))
    .replace("__METRIC_PROBE__", measureMetricEvidence.toString())
    .replace("__PROBE__", JSON.stringify(PROBE_SRC));
}

// ---------------------------------------------------------------- the server
let server = null;
let port = 0;

// The results come back over HTTP, not over --dump-dom.
//
// A dump is taken when the top-level page finishes loading, which is long
// before a sweep of a thousand measurements has finished — and under a real
// clock the browser has to be kept alive until the work is done, which a
// dump cannot do. So the harness POSTS its measurements to the server that
// served it, and the gate waits for that.
let resultsResolve = null;
function newResultsPromise() {
  return new Promise((resolve) => {
    resultsResolve = resolve;
  });
}
function takeResults(req, res) {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => {
    res.writeHead(204);
    res.end();
    let payload = null;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (e) {
      payload = { error: "the harness posted something that is not JSON" };
    }
    if (resultsResolve) resultsResolve(payload);
  });
}

async function startServer(routes, widths) {
  if (BASE) {
    // Measure a running site. Everything is proxied through one local
    // origin so the iframe stays same-origin with the harness and its
    // geometry can be read.
    const base = String(BASE).replace(/\/+$/, "");
    server = createServer(async (req, res) => {
      const raw = decodeURIComponent((req.url || "/").split("?")[0]);
      if (raw === "/__spatial-harness") {
        res.writeHead(200, { "content-type": MIME[".html"] });
        return res.end(harnessHtml(widths, routes));
      }
      if (raw === "/__spatial-results") return takeResults(req, res);
      try {
        const target = new URL(raw, base + "/");
        const upstream = await fetch(target, {
          method: req.method === "HEAD" ? "HEAD" : "GET",
          headers: { "user-agent": "spatial-law-probe", accept: "text/html,*/*" },
          redirect: "follow",
        });
        const ct = upstream.headers.get("content-type") || "application/octet-stream";
        const body = Buffer.from(await upstream.arrayBuffer());
        // The proxy keeps every path, so the page's own relative URLs —
        // its scripts, its stylesheets, its images — resolve to the same
        // paths here as they do there.
        //
        // It used to inject a <base href> instead. That broke every
        // absolute asset path on the page: the app's chunks failed to load,
        // the app router gave up and rendered its global-error page, and
        // the gate measured the ERROR PAGE while labelling it with the
        // route it was asked to measure. A deployed site that renders its
        // error page on every route measured zero findings and passed.
        res.writeHead(upstream.status, { "content-type": ct });
        res.end(body);
      } catch (e) {
        res.writeHead(502, { "content-type": "text/plain" });
        res.end("proxy error: " + e.message);
      }
    });
  } else {
    const root = path.resolve(String(DIR));
    server = createServer((req, res) => {
      const raw = decodeURIComponent((req.url || "/").split("?")[0]);
      if (raw === "/__spatial-harness") {
        res.writeHead(200, { "content-type": MIME[".html"] });
        return res.end(harnessHtml(widths, routes));
      }
      if (raw === "/__spatial-results") return takeResults(req, res);
      const url = path.posix.normalize(raw).replace(/\/+$/, "") || "/";
      if (url.includes("..")) {
        res.writeHead(400);
        return res.end("bad path");
      }
      for (const c of [
        path.join(root, url),
        path.join(root, url, "index.html"),
        path.join(root, url + ".html"),
      ]) {
        try {
          if (existsSync(c) && statSync(c).isFile()) {
            res.writeHead(200, { "content-type": MIME[path.extname(c)] || "application/octet-stream" });
            return res.end(readFileSync(c));
          }
        } catch {
          /* not a file — try the next candidate */
        }
      }
      res.writeHead(404);
      res.end("not found");
    });
  }
  port = await new Promise((resolve) => server.listen(0, "127.0.0.1", () => resolve(server.address().port)));
}

// ---------------------------------------------------------------- the routes
async function discoverRoutes() {
  if (ROUTES_ARG && typeof ROUTES_ARG === "string") {
    return ROUTES_ARG.split(",").map((r) => r.trim()).filter(Boolean);
  }
  if (BASE) {
    // A deployed site has no directory to walk. Measure the same set the
    // project ships by reading its sitemap AND the links on the home page —
    // both, because either one alone misses pages: the sitemap of this site
    // did not list /learn/ or /tikki/, and a home page link list does not
    // reach the pages two links down.
    const base = String(BASE).replace(/\/+$/, "");
    const routes = new Set(["/"]);
    try {
      const sm = await (await fetch(base + "/sitemap.xml")).text();
      for (const m of sm.matchAll(/<loc>([^<]+)<\/loc>/g)) {
        const u = new URL(m[1]);
        if (u.origin === new URL(base).origin) routes.add(u.pathname);
      }
    } catch {
      /* no sitemap — the home page links are still worth having */
    }
    try {
      const home = await (await fetch(base + "/")).text();
      for (const m of home.matchAll(/href="(\/[^"#?]*)/g)) {
        const p = m[1];
        if (p.startsWith("/_") || p.startsWith("/api")) continue;
        // A link with a file extension is an ASSET, not a page. /icon.svg and
        // /fonts/fonts.css are files; measuring them produced "no document"
        // failures and, with them, a run that measured nothing at all.
        if (/\.[a-z0-9]{2,5}$/i.test(p)) continue;
        routes.add(p.endsWith("/") ? p : p + "/");
      }
    } catch {
      /* nothing else to try */
    }
    return [...routes].sort();
  }
  const root = path.resolve(String(DIR));
  if (!existsSync(root)) {
    console.error(`\nFAIL — nothing to measure: ${root} does not exist.\n`);
    process.exit(1);
  }
  const routes = [];
  if (existsSync(path.join(root, "index.html"))) routes.push("/");
  // Walk the tree RECURSIVELY. A build can nest a route one level down —
  // /bible/parliament/ is a page of this site — and a page the gate never
  // measures is a page nobody has a receipt for. The reviewer found fourteen
  // of them: real pages, carrying real findings, with no numbers recorded.
  async function walk(dir, prefix) {
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      if (e.name.startsWith("_") || e.name.startsWith(".") || e.name === "404") continue;
      const sub = path.join(dir, e.name);
      if (existsSync(path.join(sub, "index.html"))) routes.push(`${prefix}/${e.name}/`);
      await walk(sub, `${prefix}/${e.name}`);
    }
  }
  await walk(root, "");
  routes.sort();
  return routes;
}

// ---------------------------------------------------------------- the baseline
function loadBaseline() {
  const p = path.resolve(String(BASELINE));
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch (e) {
    console.error(`\nFAIL — the baseline at ${p} is not readable JSON: ${e.message}\n`);
    process.exit(1);
  }
}

function limitsOf(base) {
  return { ...DEFAULT_LIMITS, ...((base && base.limits) || {}) };
}

function keyOf(f) {
  return `${f.kind}|${f.sel}`;
}

/** Does this decision have a written reason in the baseline? */
function hasReasonKey(k) {
  const why = reasons[k];
  return !!(why && String(why).trim() && String(why).trim() !== "UNREVIEWED");
}
function hasReason(f) {
  return hasReasonKey(keyOf(f));
}

// ---------------------------------------------------------------- the widths
//
// A layout is checked at the widths where it CHANGES, not only at the widths
// a habit suggested. A breakpoint at 560px means the page is a different page
// at 560 than at 561, so both are measured — and so is every breakpoint the
// project's own CSS declares.
//
// This is not a theory. In the project that first adopted this instrument,
// the fixes were written at breakpoints of 520, 560, 720, 900 and 1100 while
// the gate swept 360, 480, 768, 1024, 1440 and 1920 — and not one of those
// widths was on either side of a single breakpoint. Three of the fixes were
// broken exactly there, and a fourth was jumbled by the same cause, and the
// gate was green the whole time. A gate that cannot see where the layout
// changes is a gate that cannot see the defect it was written to catch.
//
// Where the stylesheet could not be found, the sweep falls back to the
// project's own widths — and says so, because a silent fallback is the
// blindness this function exists to remove.
let cssNotFound = null;

/**
 * The stylesheet's own cliffs.
 *
 *   viewport  — the widths a MEDIA query changes the layout at. These are
 *               swept as viewport widths.
 *   container — the widths a CONTAINER query changes the layout at. These
 *               are NOT viewport widths: the layout changes when the
 *               CONTAINER changes size, which happens at some viewport
 *               width nobody can read off the stylesheet. They are swept as
 *               viewport widths too (so the sweep passes near them), and
 *               the gate separately checks that the sweep actually landed
 *               on them.
 */
function scanStylesheets(text, into) {
  for (const q of text.matchAll(/@(media|container)([^{]*)\{/g)) {
    const kind = q[1];
    const body = q[2];
    const target = kind === "media" ? into.viewport : into.container;
    // A container query may NAME the container it applies to. A named query
    // can be matched to the container it belongs to, so the gate knows which
    // element's cliff it is looking at. An anonymous query cannot, and the
    // gate says so rather than guessing.
    let cname = null;
    if (kind === "container") {
      const nm = /^\s*([a-zA-Z_-][\w-]*)/.exec(body);
      cname = nm ? nm[1] : null;
    }
    // Every media query is matched first, and every width feature INSIDE it
    // is then read. Matching the features directly would find only the first
    // one in a compound query — `(min-width:721px) and (max-width:1000px)`
    // would contribute 721 and lose 1000, and the 1000px cliff would go
    // unswept in exactly the way this function exists to prevent.
    for (const m of body.matchAll(/\((?:min|max)-width:\s*([\d.]+)(px|rem|em)\)/g)) {
      const n = parseFloat(m[1]);
      if (!Number.isFinite(n) || n <= 0) continue;
      const px = m[2] === "px" ? n : n * 16;
      const bp = Math.round(px);
      // A cliff is a cliff: measure the width just below it, the width
      // itself, and the width just above it.
      for (const w of [bp - 1, bp, bp + 1]) if (w > 0) target.add(w);
      // A container cliff is also worth passing near as a viewport width,
      // because that is the only way a viewport sweep can come near it.
      if (kind === "container") {
        for (const w of [bp - 1, bp, bp + 1]) if (w > 0) into.viewport.add(w);
        into.cliffs.add(bp);
        const key = cname || "";
        if (!into.namedCliffs.has(key)) into.namedCliffs.set(key, new Set());
        into.namedCliffs.get(key).add(bp);
      }
    }
  }
}

function cssBreakpoints(root) {
  const into = { viewport: new Set(), container: new Set(), cliffs: new Set(), namedCliffs: new Map() };
  const dir = path.join(root, "_next", "static", "css");
  let files = [];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".css"));
  } catch {
    // The stylesheet was not where this instrument expected it. The sweep
    // would silently fall back to the project's own widths — the exact
    // blindness this function exists to remove — so it is reported.
    cssNotFound = dir;
    return into;
  }
  for (const f of files) {
    let text = "";
    try {
      text = readFileSync(path.join(dir, f), "utf8");
    } catch {
      continue;
    }
    scanStylesheets(text, into);
  }
  return into;
}

/**
 * The same scan, but for a site that is already running somewhere else.
 * The stylesheets are fetched, because a deployed site changes its layout
 * at ITS breakpoints, not at the ones this machine happens to have.
 */
async function remoteBreakpoints(base) {
  const into = { viewport: new Set(), container: new Set(), cliffs: new Set(), namedCliffs: new Map() };
  let html = "";
  try {
    const r = await fetch(base + "/", { headers: { "user-agent": "spatial-law-probe" } });
    html = await r.text();
  } catch {
    return into;
  }
  const hrefs = [...html.matchAll(/<link[^>]+rel=["']?stylesheet["']?[^>]*>/gi)]
    .map((m) => /href=["']([^"']+)["']/i.exec(m[0]))
    .filter(Boolean)
    .map((m) => m[1]);
  for (const href of hrefs) {
    let url;
    try {
      url = new URL(href, base + "/").toString();
    } catch {
      continue;
    }
    try {
      const r = await fetch(url, { headers: { "user-agent": "spatial-law-probe" } });
      scanStylesheets(await r.text(), into);
    } catch {
      /* a stylesheet that cannot be read is a stylesheet we cannot sweep */
    }
  }
  return into;
}

// ---------------------------------------------------------------- measure
const baseline = loadBaseline();
const projectWidths =
  baseline && Array.isArray(baseline.widths) && baseline.widths.length
    ? baseline.widths.map(Number).filter(Boolean)
    : DEFAULT_WIDTHS;
const cssScan = BASE
  ? await remoteBreakpoints(String(BASE).replace(/\/+$/, ""))
  : cssBreakpoints(path.resolve(String(DIR)));
const cssWidths = cssScan.viewport;
const widths = WIDTHS_ARG
  ? String(WIDTHS_ARG).split(",").map((w) => parseInt(w.trim(), 10)).filter(Boolean)
  : [...new Set([...projectWidths, ...cssWidths])].sort((a, b) => a - b);

const routes = await discoverRoutes();
if (!routes.length) {
  console.error("\nFAIL — the spatial gate found no routes to measure. Nothing was verified.\n");
  process.exit(1);
}

// There is no cross-check any more, and that is the point.
//
// The gate used to measure most widths by resizing a page it had already
// loaded, and to prove — at six narrow widths out of fifty-seven — that a
// resized page and a freshly loaded page agreed. The reviewer showed that
// proof was too weak to be worth anything: a page whose layout is decided
// once, from the width it was loaded at, passed the gate with a 260px hole
// in it, and 44 of the 45 widths where the CSS changes were never fresh-
// loaded at all.
//
// So the assumption is gone. Every measurement is a fresh load at the width
// being measured, and there is nothing left to prove.
await startServer(routes, widths);

const prof = `${tmpdir()}/spatial-law-${process.pid}-${Date.now()}`;
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  try {
    // The profile is this process's own scratch directory. The trash helper
    // belongs to the runtime and is not in the same place on every machine,
    // so a shared instrument asks the environment first and falls back to the
    // standard location — it never carries one person's home directory.
    const trash = process.env.MAVIS_TRASH || path.join(homedir(), ".minimax", "bin", "mavis-trash");
    if (existsSync(trash)) execFileSync(trash, ["--", prof]);
    else rmSync(prof, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { cleanup(); process.exit(130); });

// The browser runs on a REAL clock.
//
// It used to run on a virtual one, which made the gate fast: the settle
// wait cost nothing, because virtual time is free. But a virtual clock does
// not produce RENDERING OPPORTUNITIES, and a layout that catches up after a
// load — a ResizeObserver, a chart redraw — is delivered at one. So the
// measurement was taken of a layout that had not arrived yet, which is how
// the same build passed on one run and failed on the next.
//
// The clock is real now. The gate is slower and its verdict is the same on
// every run, which is the only property a verdict is worth.
const RUN_TIMEOUT_MS = 45 * 60 * 1000;
let payload = null;
let chromeError = null;
for (let attempt = 1; attempt <= 3; attempt++) {
  // A FRESH profile per attempt: a browser that was killed leaves a dirty
  // profile behind, and the next attempt would fail for the wrong reason.
  const attemptProf = attempt === 1 ? prof : `${prof}-${attempt}`;
  const waiting = newResultsPromise();
  const child = spawn(
    CHROME,
    [
      "--headless=new",
      "--disable-gpu",
      "--hide-scrollbars",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-extensions",
      `--user-data-dir=${attemptProf}`,
      `http://127.0.0.1:${port}/__spatial-harness`,
    ],
    { stdio: ["ignore", "pipe", "pipe"] },
  );
  let out = "";
  let err = "";
  child.stdout.on("data", (d) => {
    out += d;
    if (out.length > 64 * 1024 * 1024) child.kill("SIGKILL");
  });
  child.stderr.on("data", (d) => {
    err += d;
  });
  // The browser POSTs its measurements back when it is done. The watchdog is
  // LONGER than the job that runs this gate, or the browser is taken down
  // mid-sweep and the gate reports a failure that is really a timeout — the
  // measurement was fine.
  const timeout = Symbol("timeout");
  const got = await withDeadline(waiting, RUN_TIMEOUT_MS, timeout);
  try {
    child.kill("SIGKILL");
  } catch {
    /* already gone */
  }
  if (got !== timeout) {
    payload = got;
    chromeError = null;
    break;
  }
  chromeError = new Error(`the browser did not finish within ${Math.round(RUN_TIMEOUT_MS / 60000)} minutes`);
  console.error(`  · Chrome attempt ${attempt}/3 did not finish — retrying`);
  try {
    rmSync(attemptProf, { recursive: true, force: true });
  } catch {
    /* best effort */
  }
  await new Promise((r) => setTimeout(r, 3000));
}
if (chromeError || !payload) {
  server.close();
  cleanup();
  console.error(`\nFAIL — the spatial gate could not measure: ${(chromeError && chromeError.message) || "the browser reported nothing"}\n`);
  process.exit(1);
}
server.close();
cleanup();

if (payload.error) {
  console.error(`\nFAIL — the spatial harness threw. Nothing was verified.\n${String(payload.error).trim()}\n`);
  process.exit(1);
}
const results = Array.isArray(payload.measurements) ? payload.measurements : [];

const expected = routes.length * widths.length;
// The gate must have measured every ROUTE at every WIDTH. Counting the
// measurements is not enough: one page measured twice is the same count as
// one page never measured, and the count would not notice.
const seenPairs = new Set(results.map((r) => `${r.route}@${r.w}`));
const missingPairs = [];
for (const rt of routes) {
  for (const w of widths) {
    if (!seenPairs.has(`${rt}@${w}`)) missingPairs.push(`${rt} @${w}px`);
  }
}
const duplicatePairs = [];
{
  const counts = new Map();
  for (const r of results) {
    const k = `${r.route}@${r.w}`;
    counts.set(k, (counts.get(k) || 0) + 1);
  }
  for (const [k, n] of counts) if (n > 1) duplicatePairs.push(`${k} measured ${n} times`);
}
if (results.length !== expected || missingPairs.length || duplicatePairs.length) {
  console.error(
    `\nFAIL — the spatial gate is under-measuring.\n` +
      `  Expected ${expected} measurements (${routes.length} routes x ${widths.length} widths), got ${results.length}.\n`,
  );
  if (missingPairs.length) {
    console.error(`  Missing ${missingPairs.length} measurement(s):`);
    for (const p of missingPairs.slice(0, 20)) console.error(`    · ${p}`);
  }
  if (duplicatePairs.length) {
    console.error(`  Measured twice: ${duplicatePairs.slice(0, 20).join(", ")}`);
  }
  console.error(`  A page measured twice is the same count as a page never measured.\n`);
  process.exit(1);
}
const errored = results.filter((r) => r.error);
if (errored.length) {
  console.error(`\nFAIL — the spatial gate could not read ${errored.length} page measurement(s):`);
  for (const e of errored.slice(0, 10)) console.error(`  ✗ ${e.route} @${e.w}px — ${e.error}`);
  process.exit(1);
}
// The notes are printed at the end of the run.
const notes = [];

// ---------------------------------------------------------------- the raw measurements
if (JSON_OUT) {
  mkdirSync(path.dirname(path.resolve(String(JSON_OUT))), { recursive: true });
  writeFileSync(path.resolve(String(JSON_OUT)), JSON.stringify({ measurements: results }, null, 2));
}

// ---------------------------------------------------------------- policy
const limits = limitsOf(baseline);
const baselineRoutes = (baseline && baseline.routes) || {};
// A REASON belongs to a design DECISION, not to a page. The same decision —
// "the footer's engine links stack below 480px" — shows up on many routes,
// and it is one promise, not many. So reasons are keyed by signature
// (kind|selector) and the per-page numbers stay in `routes`.
const reasons = (baseline && baseline.reasons) || {};

const failures = [];
if (cssNotFound) {
  notes.push(
    `the stylesheet was not found at ${cssNotFound} — the sweep fell back to the project's own widths, ` +
      `so the CSS breakpoints were NOT measured. A layout checked only at the widths somebody listed is ` +
      `checked at the widths where nothing changes.`,
  );
}
const unexplained = [];
const unrecorded = [];
const grownFindings = [];
const shrunkFindings = [];
const goneFindings = [];
const staleReasons = [];
const staleExempts = [];
const chromeDrift = [];
const chromeHeavy = [];
const chromeUnrecorded = [];

function baselineFor(route, w) {
  const r = baselineRoutes[route];
  if (!r) return null;
  return r[String(w)] || null;
}

for (const r of results) {
  const label = `${r.route} @${r.w}px`;
  const base = baselineFor(r.route, r.w);

  // --- absolute: the page scrolls sideways -------------------------------
  for (const f of r.findings) {
    if (f.kind === "overflow") {
      failures.push(`${label} — ${f.detail} (${f.sel})`);
    }
  }

  if (!base) {
    // A route or width with no recorded numbers yet. The decision still has
    // to be justified; the numbers simply have nothing to compare against.
    for (const f of r.findings) {
      if (f.kind === "overflow") continue;
      if (!hasReason(f)) unexplained.push({ ...f, route: r.route, w: r.w });
      else unrecorded.push({ ...f, route: r.route, w: r.w, why: "the baseline records no numbers for this route and width" });
    }
    if (!r.findings.length) {
      notes.push(`${label} — no baseline entry for this route/width`);
    }
  } else {
    const prior = new Map((base.findings || []).map((p) => [keyOf(p), p]));
    const seen = new Set();
    for (const f of r.findings) {
      const k = keyOf(f);
      seen.add(k);
      const p = prior.get(k);
      // A decision nobody has justified. Whether the finding is new or old,
      // the reason is what makes it allowed to exist.
      if (!hasReason(f)) {
        if (f.kind !== "overflow") unexplained.push({ ...f, route: r.route, w: r.w });
        continue;
      }
      if (!p) {
        // The decision is justified, but the baseline does not record the
        // numbers for it, so nothing would notice if that space grew. A gate
        // that cannot check what it says it checks must fail rather than
        // pass on a check it never ran.
        unrecorded.push({ ...f, route: r.route, w: r.w, why: "the baseline records no numbers for this decision" });
        continue;
      }
      const tolKey = KIND_TOLERANCE[f.kind];
      const tol = typeof tolKey === "number" ? tolKey : limits.grownTolerance;
      const delta = f.metric - (p.metric || 0);
      if (delta > tol) {
        grownFindings.push({ ...f, route: r.route, w: r.w, was: p.metric, delta, why: reasons[keyOf(f)] });
      } else if (delta < -tol) {
        // A hole that SHRANK changed the geometry just as much as one that
        // grew. The receipt is a record of what the page looks like, so a
        // change in either direction has to be seen: a baseline that still
        // says 300px when the page now says 100px is a receipt that lies.
        shrunkFindings.push({ ...f, route: r.route, w: r.w, was: p.metric, delta, why: reasons[keyOf(f)] });
      }
    }
    for (const p of base.findings || []) {
      if (!seen.has(keyOf(p))) {
        goneFindings.push({ ...p, route: r.route, w: r.w });
      }
    }

    // --- chrome cost: the furniture grew ----------------------------------
    // "Chrome earns its pixels." The receipt records how tall the chrome is
    // at every route and every width, so the day the header grows, the diff
    // says so. A chrome that grew has taken height away from the work; a
    // chrome that shrank means the receipt no longer describes the page.
    // Both are the same event: the geometry changed and the record did not.
    const ch = r.chrome;
    const priorChrome = base.chrome;
    if (ch && priorChrome) {
      for (const edge of ["top", "bottom"]) {
        const now = Number(ch[edge] || 0);
        const was = Number(priorChrome[edge] || 0);
        const drift = now - was;
        if (Math.abs(drift) > limits.chromeTolerance) {
          chromeDrift.push({ route: r.route, w: r.w, edge, was, now, drift });
        }
      }
    } else if (ch) {
      chromeUnrecorded.push({ route: r.route, w: r.w });
    }

    // --- spatially expensive: the first action moved ---------------------
    const fa = base.firstAction;
    if (fa && fa.y !== null && r.firstAction && r.firstAction.y !== null) {
      const drift = r.firstAction.y - fa.y;
      if (Math.abs(drift) > limits.firstActionTolerance) {
        failures.push(
          `${label} — the first thing you can do moved ${drift > 0 ? "down" : "up"} ${Math.abs(drift)}px ` +
            `(now ${r.firstAction.y}, was ${fa.y}); a decision that used to cost ${fa.y}px of scrolling now costs ${r.firstAction.y}px`,
        );
      }
    }
  }

  // The ABSOLUTE limits apply to every measurement, whether or not the
  // baseline has ever seen this route. A limit that only holds for pages
  // somebody already reviewed is not a limit — it is a note, and a new page
  // with a 2000px scroll before its first action would sail past it.
  //
  // An EXEMPTION is a written exception to an absolute limit. It is not a
  // quiet pass: it names the page, the check, and the reason, and it lives
  // in the baseline where a reviewer can see it and argue with it.
  const exempts = (baseline && baseline.exempt) || [];
  function exempted(check) {
    for (const e of exempts) {
      if (e.check !== check) continue;
      if (e.route && e.route !== r.route) continue;
      if (e.w !== undefined && e.w !== null) {
        // An exemption may name one width or a list of them. A decision that
        // holds at several widths is still ONE decision, and the exemption
        // should be able to say so in one place.
        const ws = (Array.isArray(e.w) ? e.w : [e.w]).map(Number);
        if (!ws.includes(Number(r.w))) continue;
      }
      return e;
    }
    return null;
  }
  {
    const label = `${r.route} @${r.w}px`;

    // An exemption applies to EVERY absolute limit, not only the first one.
    // If one check could be excused and another could not, the excuse would
    // live in the wrong place — and the place a reviewer reads is the
    // baseline, never the body of the check.
    function absolute(check, message, summary) {
      const ex = exempted(check);
      if (ex) {
        notes.push(`${label} — ${summary || check}, exempted: ${ex.why}`);
      } else {
        failures.push(message);
      }
    }

    if (limits.firstAction !== null && r.firstAction && r.firstAction.y !== null && r.firstAction.y > limits.firstAction) {
      absolute(
        "firstAction",
        `${label} — the first thing you can do is ${r.firstAction.y}px down the page (limit ${limits.firstAction}px)`,
        `first action at ${r.firstAction.y}px exceeds ${limits.firstAction}px`,
      );
    }

    // --- false hierarchy --------------------------------------------------
    const h = r.hierarchy || {};
    if (limits.titleRatio !== null && h.ratio !== null && h.ratio < limits.titleRatio) {
      absolute(
        "titleRatio",
        `${label} — the title is only ${h.ratio}x the next largest text (limit ${limits.titleRatio})`,
        `the title is only ${h.ratio}x the next largest text (limit ${limits.titleRatio})`,
      );
    }
    if (limits.peerShare !== null && h.share !== undefined && h.share > limits.peerShare) {
      absolute(
        "peerShare",
        `${label} — ${Math.round(h.share * 100)}% of the page is set in the loud voice (limit ${Math.round(limits.peerShare * 100)}%)`,
        `${Math.round(h.share * 100)}% of the page is set in the loud voice (limit ${Math.round(limits.peerShare * 100)}%)`,
      );
    }
    // The chrome's share of the first screen. A big number is not a failure
    // by itself — it is a prompt to look at the page and say why the header
    // needs that room. A project that has measured its own pages can turn it
    // into a limit, and then it is one.
    const chromeHere = r.chrome;
    if (chromeHere && chromeHere.topPct !== null && chromeHere.topPct !== undefined) {
      if (limits.chromeTopPct !== null && chromeHere.topPct > limits.chromeTopPct) {
        absolute(
          "chromeTopPct",
          `${label} — the chrome takes ${chromeHere.topPct}% of the first screen (limit ${limits.chromeTopPct}%)`,
          `the chrome takes ${chromeHere.topPct}% of the first screen`,
        );
      }
      if (chromeHere.topPct >= 20) {
        chromeHeavy.push({ route: r.route, w: r.w, pct: chromeHere.topPct, top: chromeHere.top, vh: chromeHere.vh });
      }
    }

    if (limits.allowedSizes) {
      const allowed = new Set(limits.allowedSizes.map(Number));
      const off = Object.keys(h.ramp || {})
        .map(Number)
        .filter((s) => !allowed.has(s))
        .sort((a, b) => a - b);
      if (off.length) {
        absolute(
          "allowedSizes",
          `${label} — text is set in ${off.join("px, ")}px, off the house ramp (${limits.allowedSizes.join(" / ")})`,
          `text is set in ${off.join("px, ")}px, off the house ramp (${limits.allowedSizes.join(" / ")})`,
        );
      }
    }
  }
}

for (const d of chromeDrift) {
  failures.push(
    `${d.route} @${d.w}px — the ${d.edge} chrome ${d.drift > 0 ? "GREW" : "SHRANK"} by ${Math.abs(d.drift)}px ` +
      `(now ${d.now}px, was ${d.was}px). ` +
      (d.drift > 0
        ? "Chrome has taken height away from the work; the space that made sense at " +
          `${d.was}px does not make sense at ${d.now}px.`
        : "The receipt still describes a chrome of " + `${d.was}px, and the page no longer has one. Update the baseline.`),
  );
}
for (const c of chromeUnrecorded) {
  failures.push(
    `${c.route} @${c.w}px — the chrome is measured but the baseline records no numbers for it, so a change in it ` +
      `would not be noticed. Re-run the gate with --update and read the diff before you read the receipt as still true.`,
  );
}
if (chromeHeavy.length) {
  chromeHeavy.sort((a, b) => b.pct - a.pct);
  notes.push(
    `the chrome takes a large share of the first screen at ${chromeHeavy.length} measured viewport(s) — ` +
      `the worst is ${chromeHeavy[0].route} @${chromeHeavy[0].w}px, where it is ${chromeHeavy[0].top}px of ` +
      `${chromeHeavy[0].vh}px (${chromeHeavy[0].pct}%). A large footprint is a prompt to investigate, not a failure: ` +
      `look at the page and say why the header needs that room.`,
  );
}
for (const f of unrecorded) {
  failures.push(
    `${f.route} @${f.w}px — ${f.kind}: ${f.sel} is measured but ${f.why}, so a change in it would not be ` +
      `noticed. Re-run the gate with --update and read the diff before you read the reason as still true.`,
  );
}
for (const f of unexplained) {
  failures.push(
    `${f.route} @${f.w}px — ${f.kind}: ${f.sel} has no written reason in the baseline. "${f.detail}" ` +
      `needs to be justified, not just recorded.`,
  );
}
for (const f of grownFindings) {
  failures.push(`${f.route} @${f.w}px — ${f.kind} GREW: ${f.sel} went from ${f.was} to ${f.metric} (+${f.delta}). The space that made sense at ${f.was} does not make sense at ${f.metric}.`);
}
for (const f of shrunkFindings) {
  failures.push(
    `${f.route} @${f.w}px — ${f.kind} SHRANK: ${f.sel} went from ${f.was} to ${f.metric} (${f.delta}). ` +
      `That is a change to the page, and the receipt still says ${f.was}. Update the baseline so the receipt matches what the page does.`,
  );
}
for (const f of goneFindings) {
  failures.push(
    `${f.route} @${f.w}px — ${f.kind} GONE: ${f.sel} is no longer measured here, but the receipt still records it at ${f.metric}. ` +
      `Update the baseline so the receipt matches what the page does.`,
  );
}

// ---- a reason with nothing under it ----------------------------------------
// A reason is written for a decision. When the decision is gone — the hole
// was closed, the plate moved — the reason stays in the baseline for ever,
// and the worst thing about it is that it is still a BLESSING: if a decision
// of the same shape ever comes back, the stale reason silently excuses it,
// and nobody re-reads why the first one was allowed.
//
// So a reason that no longer matches any measured decision is a failure. The
// fix is to delete it from the baseline, by hand, so that the deletion is a
// thing a person did and can be read in the diff.
const measuredKeys = new Set();
for (const r of results) {
  for (const f of r.findings) {
    if (f.kind === "overflow") continue;
    measuredKeys.add(keyOf(f));
  }
}
const measuredRoutes = new Set(results.map((r) => r.route));
const measuredWidths = new Set(results.map((r) => Number(r.w)));

// ---- the container cliffs --------------------------------------------------
//
// A CONTAINER query changes the layout when the container changes size, not
// when the window does. A viewport sweep can walk straight past one. So the
// gate asks a question the sweep can answer: did the sweep ever put a
// container within a hair of the cliff it declares?
//
// If the answer is no, but the container's width crossed the cliff somewhere
// in the sweep, then the layout on one side of that cliff was never
// measured — and a gate that did not measure it must say so.
//
// A NAMED query (`@container settings-card (min-width: 640px)`) can be
// matched to the container it belongs to, so the answer is exact. An
// ANONYMOUS query cannot be matched to anything, so the gate says that
// instead of blaming a container that may have nothing to do with it.
const namedCliffs = cssScan.namedCliffs || new Map();
if (namedCliffs.size) {
  // The check is only binding when the sweep actually covered the CSS's own
  // cliffs. A narrowed sweep — a quick look, a project that has not yet
  // adopted the CSS-derived widths — is a partial sweep, and a partial sweep
  // records the cliff instead of failing on it.
  const cssComplete = [...cssScan.viewport].every((w) => measuredWidths.has(Number(w)));
  const byContainer = new Map();
  for (const r of results) {
    for (const c of r.containers || []) {
      const names = String(c.name || "")
        .split(/\s+/)
        .filter(Boolean);
      for (const nm of names) {
        if (!byContainer.has(nm)) byContainer.set(nm, new Map());
        const perSel = byContainer.get(nm);
        if (!perSel.has(c.sel)) perSel.set(c.sel, new Map());
        perSel.get(c.sel).set(Number(r.w), c.w);
      }
    }
  }
  for (const [name, cliffs] of namedCliffs) {
    for (const cliff of [...cliffs].sort((a, b) => a - b)) {
      if (!name) {
        notes.push(
          `the container cliff at ${cliff}px belongs to an ANONYMOUS container query — the gate cannot tell which container it applies to, so it cannot say whether it was swept. Name the query (@container name (min-width: ${cliff}px)) and the gate will check it.`,
        );
        continue;
      }
      const perSel = byContainer.get(name);
      if (!perSel || !perSel.size) {
        notes.push(
          `the container cliff at ${cliff}px belongs to "${name}", which no measured page contains — there was nothing to sweep.`,
        );
        continue;
      }
      let landed = null;
      let straddled = null;
      for (const [sel, pairs] of perSel) {
        const list = [...pairs.entries()].sort((a, b) => a[1] - b[1]);
        const near = list.find(([, w]) => Math.abs(w - cliff) <= 2);
        if (near) {
          landed = { sel, w: near[1], v: near[0] };
          break;
        }
        const below = [...list].reverse().find(([, w]) => w < cliff);
        const above = list.find(([, w]) => w > cliff);
        if (below && above) {
          straddled = { sel, below, above };
          break;
        }
      }
      if (landed) {
        notes.push(
          `the container cliff at ${cliff}px was measured — the container "${name}" was ${landed.w}px wide at viewport ${landed.v}px`,
        );
      } else if (straddled) {
        const [v1, w1] = straddled.below;
        const [v2, w2] = straddled.above;
        // Where would the container land exactly on the cliff? Between the
        // two measurements that bracket it, the container's width moves with
        // the viewport, so the width that puts it on the cliff can be read
        // off. Naming it turns "add a width" into one number.
        const guess =
          w2 > w1 ? Math.round(v1 + ((cliff - w1) * (v2 - v1)) / (w2 - w1)) : Math.round((v1 + v2) / 2);
        const where = `the container is ${w1}px wide at viewport ${v1}px and ${w2}px wide at viewport ${v2}px`;
        if (cssComplete) {
          failures.push(
            `unswept container cliff — the layout changes when the container "${name}" is ${cliff}px wide, ` +
              `but the sweep never put it there (${where}). The layout on one side of that cliff was never measured. ` +
              `Add a viewport width of about ${guess}px to the project's widths — that is where the container lands on the cliff.`,
          );
        } else {
          notes.push(
            `the container cliff at ${cliff}px was crossed but not measured (${where}) — this sweep did not cover every cliff the CSS declares, so it is recorded, not failed.`,
          );
        }
      } else {
        notes.push(
          `the container cliff at ${cliff}px was never crossed — the container "${name}" never reached it at any swept width, so there was nothing to measure`,
        );
      }
    }
  }
}

// A route the BASELINE knows and the BUILD does not have is a page that has
// vanished from the receipt. It used to be enough to leave one route out of
// the build to switch the stale-reason rule off for the whole project —
// the gate then passed while judging nothing. So a missing page is a
// failure in its own right, not a reason to stop judging.
//
// A run that was told which routes to measure is a deliberate narrowing and
// is not a failure; it is a note.
const baselineRouteList = Object.keys(baselineRoutes);
const vanishedRoutes = baselineRouteList.filter((rt) => !measuredRoutes.has(rt));
if (!ROUTES_ARG) {
  for (const rt of vanishedRoutes) {
    failures.push(
      `missing page — the baseline records "${rt}" but this build has no such page. ` +
        `A page that was reviewed and is no longer built must be removed from the baseline, ` +
        `and until somebody does that, the receipt is claiming a page that does not exist.`,
    );
  }
}

// A stale reason can only be judged when the sweep was COMPLETE — and
// "complete" means both axes. A run over a few routes has not seen the
// routes the reason belongs to, and calling that reason stale would be the
// instrument inventing a defect. The same is true of a run over a few
// widths: a decision can be alive at 721px and absent at 360px, and a
// narrowed width list cannot tell the two apart.
const baselineWidthList = (baseline && baseline.measuredWidths) || [];
const widthsComplete = baselineWidthList.every((w) => measuredWidths.has(Number(w)));
const fullSweep =
  !ROUTES_ARG && !vanishedRoutes.length && widthsComplete && !!baselineWidthList.length;
if (fullSweep) {
  for (const k of Object.keys(reasons)) {
    if (measuredKeys.has(k)) continue;
    staleReasons.push(k);
    failures.push(
      `stale reason — the baseline justifies "${k}" but no measured decision is that shape any more. ` +
        `A reason that blesses nothing will bless the next thing that looks like it, without anybody re-reading it. ` +
        `Delete it from the baseline.`,
    );
  }
  for (const e of (baseline && baseline.exempt) || []) {
    if (!e.route) continue;
    if (measuredRoutes.has(e.route)) continue;
    staleExempts.push(e);
    failures.push(
      `stale exemption — the baseline excuses ${e.check} on ${e.route}, which is not a route this build measures. ` +
        `Delete it from the baseline.`,
    );
  }
} else {
  const why = [];
  if (ROUTES_ARG) why.push("the run was told which routes to measure");
  if (!ROUTES_ARG && vanishedRoutes.length) why.push(`the build has no ${vanishedRoutes[0]}`);
  if (!widthsComplete) why.push("the run did not sweep every width the baseline recorded");
  notes.push(`stale reasons were not checked — ${why.join("; ")}`);
}
// A NOTE is something the gate saw and did not fail on. It used to be
// collected and never printed, which meant a page the baseline had never
// seen was reviewed in silence. Silence is not a result.
function printNotes() {
  if (!notes.length) return;
  console.log(`\nNOTES (${notes.length}) — seen, recorded, and not a failure:`);
  for (const n of notes.slice(0, 40)) console.log(`  · ${n}`);
  if (notes.length > 40) console.log(`  · ... and ${notes.length - 40} more`);
}

// ---------------------------------------------------------------- update
if (UPDATE) {  // A reason for a decision that is no longer there is not recorded again.
  // It is dropped, loudly, so the deletion shows up in the diff of the
  // baseline instead of hiding inside a tool.
  const keptReasons = { ...reasons };
  for (const k of staleReasons) delete keptReasons[k];
  const keptExempts = ((baseline && baseline.exempt) || []).filter((e) => !staleExempts.includes(e));
  const next = {
    version: 2,
    tool: "spatial-law",
    // The widths the project chose, kept as chosen. The widths the CSS
    // declares are worked out from the build on every run, so a breakpoint
    // that is removed stops being measured without anybody editing this.
    widths: projectWidths,
    // The receipt of what was actually swept this time.
    measuredWidths: widths,
    limits: limits,
    // The reasons of decisions that were already justified. A reason is kept
    // because the DECISION is kept; a decision whose geometry changed is
    // caught by the GROWN check, not by losing its reason.
    reasons: keptReasons,
    // Written exceptions to the absolute limits, kept for the same reason:
    // an exception is a decision, and a decision is written down.
    exempt: keptExempts,
    routes: {},
  };
  const signatureDetail = new Map();
  for (const r of results) {
    for (const f of r.findings) {
      if (f.kind === "overflow") continue;
      const k = keyOf(f);
      if (!signatureDetail.has(k)) signatureDetail.set(k, { kind: f.kind, sel: f.sel, detail: f.detail, at: `${r.route} @${r.w}px` });
    }
  }
  for (const r of results) {
    const findings = r.findings.map((f) => ({
      kind: f.kind,
      sel: f.sel,
      metric: f.metric,
      detail: f.detail,
    }));
    next.routes[r.route] = next.routes[r.route] || {};
    next.routes[r.route][String(r.w)] = {
      findings,
      firstAction: r.firstAction,
      chrome: r.chrome
        ? {
            vh: r.chrome.vh,
            top: r.chrome.top,
            topPct: r.chrome.topPct,
            bottom: r.chrome.bottom,
            bottomPct: r.chrome.bottomPct,
            stacked: r.chrome.stacked,
            topSel: r.chrome.topSel,
            bottomSel: r.chrome.bottomSel,
          }
        : null,
      hierarchy: r.hierarchy
        ? {
            h1: r.hierarchy.h1,
            largest: r.hierarchy.largest,
            ratio: r.hierarchy.ratio,
            peers: r.hierarchy.peers,
            share: r.hierarchy.share,
          }
        : null,
    };
  }
  const target = path.resolve(String(BASELINE));
  mkdirSync(path.dirname(target), { recursive: true });
  writeFileSync(target, JSON.stringify(next, null, 2) + "\n");

  // Every decision that has no reason yet.
  const needReason = [...signatureDetail.entries()].filter(([k]) => !hasReasonKey(k));
  console.log(`  · baseline written: ${target}`);
  console.log(`  · ${signatureDetail.size} distinct decision(s) measured; ${signatureDetail.size - needReason.length} already justified.`);
  if (staleReasons.length || staleExempts.length) {
    console.log(
      `  · ${staleReasons.length} stale reason(s) and ${staleExempts.length} stale exemption(s) dropped — ` +
        `they described a decision that is no longer there:`,
    );
    for (const k of staleReasons) console.log(`      - ${k}`);
    for (const e of staleExempts) console.log(`      - ${e.check} on ${e.route}`);
  }
  if (needReason.length) {
    console.error(
      `\nFAIL — ${needReason.length} decision(s) have no reason.\n` +
        `  A hole with no reason is a hole nobody chose. Write why each one is there —\n` +
        `  "the section break before the guide" is a reason; "the grid put it there" is\n` +
        `  not — in the "reasons" block of the baseline, and run the gate again.\n`,
    );
    for (const [k, v] of needReason) {
      console.error(`  ✗ ${v.kind} ${v.sel} — ${v.detail}  (first seen at ${v.at})`);
    }
    process.exit(1);
  }
  console.log("  · every decision in the baseline carries a reason.");
  process.exit(0);
}

// ---------------------------------------------------------------- report
if (REPORT) {
  console.log(
    "route".padEnd(22) + "w".padEnd(6) + "find".padEnd(6) + "dead".padEnd(6) + "orph".padEnd(6) +
    "wrap".padEnd(6) + "clip".padEnd(6) + "scat".padEnd(6) + "ovlp".padEnd(6) + "act-y".padEnd(8) +
    "h1".padEnd(6) + "ratio".padEnd(7) + "share".padEnd(7) + "chrome-t".padEnd(9) + "chrome-b".padEnd(9) + "stack",
  );
  for (const r of results) {
    const count = (k) => r.findings.filter((f) => f.kind === k).length;
    const h = r.hierarchy || {};
    const c = r.chrome || {};
    console.log(
      String(r.route).padEnd(22) + String(r.w).padEnd(6) + String(r.findings.length).padEnd(6) +
      String(count("dead")).padEnd(6) + String(count("orphan")).padEnd(6) + String(count("wrap")).padEnd(6) +
      String(count("clip")).padEnd(6) + String(count("scattered")).padEnd(6) + String(count("overlap")).padEnd(6) +
      String(r.firstAction ? r.firstAction.y : "-").padEnd(8) + String(h.h1 || "-").padEnd(6) +
      String(h.ratio === null || h.ratio === undefined ? "-" : h.ratio).padEnd(7) + String(h.share ?? "-").padEnd(7) +
      String(c.top === undefined ? "-" : `${c.top}px`).padEnd(9) +
      String(c.bottom === undefined ? "-" : `${c.bottom}px`).padEnd(9) +
      String(c.stacked === undefined ? "-" : c.stacked),
    );
  }
  console.log(`\n${results.length} measurements across ${routes.length} routes and ${widths.length} widths.`);
  console.log(
    `  · every one of them was taken from a FRESH page load at the width being measured, on a real clock — ` +
      `so the geometry recorded is the geometry a reader gets, not the geometry of a page that had not finished arriving.`,
  );

  // The decisions, not the findings. One decision can show up on many pages
  // at many widths; it is still one promise, and it needs one reason.
  const decisions = new Map();
  for (const r of results) {
    for (const f of r.findings) {
      if (f.kind === "overflow") continue;
      const k = keyOf(f);
      if (!decisions.has(k)) decisions.set(k, { kind: f.kind, sel: f.sel, detail: f.detail, seen: 0, where: [] });
      const d = decisions.get(k);
      d.seen++;
      if (d.where.length < 4) d.where.push(`${r.route} @${r.w}px`);
    }
  }
  console.log(`\n${decisions.size} distinct decision(s) measured:`);
  for (const [k, d] of decisions) {
    const why = reasons[k];
    const mark = hasReasonKey(k) ? "✓" : "?";
    console.log(
      `  ${mark} ${d.kind.padEnd(10)} ${d.sel.padEnd(44)} seen ${String(d.seen).padStart(3)}x  ${d.detail.slice(0, 70)}`,
    );
    if (!hasReasonKey(k)) console.log(`      ↳ NO REASON YET — ${d.where.join(", ")}`);
  }
  if (chromeDrift.length) {
    console.log(`\nCHROME drift (${chromeDrift.length}) — the furniture changed and the receipt did not:`);
    for (const d of chromeDrift.slice(0, 40)) {
      console.log(`  · ${d.route} @${d.w}px ${d.edge}: ${d.was}px → ${d.now}px (${d.drift > 0 ? "+" : ""}${d.drift})`);
    }
  }
  if (unrecorded.length) {
    console.log(`\nUNRECORDED findings (${unrecorded.length}) — the baseline has no numbers for them:`);
    for (const f of unrecorded.slice(0, 40)) console.log(`  · ${f.route} @${f.w}px ${f.kind} ${f.sel} — ${f.why}`);
  }
  if (unexplained.length) {
    console.log(`\nUNEXPLAINED findings (${unexplained.length}):`);
    for (const f of unexplained.slice(0, 40)) console.log(`  · ${f.route} @${f.w}px ${f.kind} ${f.sel} — ${f.detail}`);
  }
  if (grownFindings.length) {
    console.log(`\nGROWN findings (${grownFindings.length}):`);
    for (const f of grownFindings.slice(0, 40)) console.log(`  · ${f.route} @${f.w}px ${f.kind} ${f.sel} — ${f.was} → ${f.metric} (+${f.delta})`);
  }
  if (goneFindings.length) {
    console.log(`\nGONE findings (${goneFindings.length}) — the baseline is stale here:`);
    for (const f of goneFindings.slice(0, 40)) console.log(`  · ${f.route} @${f.w}px ${f.kind} ${f.sel}`);
  }
  if (staleReasons.length) {
    console.log(`\nSTALE reasons (${staleReasons.length}) — a reason with nothing under it:`);
    for (const k of staleReasons) console.log(`  · ${k}`);
  }
  printNotes();
  process.exit(0);
}

// ---------------------------------------------------------------- verdict
if (!baseline) {
  console.error(
    `\nFAIL — there is no spatial baseline at ${path.resolve(String(BASELINE))}.\n` +
      `  Nothing has been reviewed, so nothing is known to be deliberate.\n` +
      `  Run with --update to record what is there, then give every finding a reason.\n`,
  );
  process.exit(1);
}

if (failures.length) {
  console.error(`\nFAIL — ${failures.length} spatial problem(s):\n`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  console.error(
    "\n  Whitespace is intentional when it separates meaningful groups, supports reading,\n" +
      "  or establishes emphasis. It is a hallucination when it asks the reader to supply\n" +
      "  an intention nobody had. Give every finding a reason, or remove it.\n",
  );
  printNotes();
  process.exit(1);
}

printNotes();
console.log(
  `  · spatial: ${results.length} measurements across ${routes.length} routes and ${widths.length} widths — ` +
    `every hole, orphan, scattered pair and wrap is either fixed or written down`,
  `  · spatial: every measurement was a fresh load at the width measured, on a real clock — ` +
    `the chrome of each page is recorded, and a chrome that changed is a change the receipt cannot hide`,
);
