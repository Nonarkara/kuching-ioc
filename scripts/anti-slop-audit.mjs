#!/usr/bin/env node
// Anti-slop audit harness for the Padawan IOC.
//
// Rule 4 of the anti-slop checklist demands a screenshot at 1440 / 1024 / 390
// and a squint test. Rules 1, 3, 5, 6 and 7 are all measurable from the DOM, so
// this script takes screenshots AND records the numbers that decide the verdict.
// Self-reporting a design audit is worthless; this produces the evidence.
//
// deviceScaleFactor is pinned to 1 on purpose: at a native 2x backing surface
// Page.captureScreenshot never returns on a large viewport (see agent memory,
// "CDP captureScreenshot never returns on a large backing surface").
//
// Usage: node scripts/anti-slop-audit.mjs [--url https://...] [--out dir]

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "..");

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.AUDIT_PORT || 9333);

const args = process.argv.slice(2);
const argv = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};
const URL_UNDER_TEST = argv("--url", "https://kuching.nonarkara.org/");
const OUT = path.resolve(ROOT, argv("--out", "tmp/anti-slop"));

const WIDTHS = [
  { name: "desktop-1440", width: 1440, height: 900 },
  { name: "tablet-1024", width: 1024, height: 768 },
  { name: "phone-390", width: 390, height: 844 },
];

// ── CDP plumbing ──────────────────────────────────────────────────────────────

class Cdp {
  #ws;
  #id = 0;
  #pending = new Map();
  #listeners = new Map();

  static async attach(port) {
    const deadline = Date.now() + 20000;
    let target;
    while (Date.now() < deadline) {
      try {
        const res = await fetch(`http://127.0.0.1:${port}/json/list`);
        const list = await res.json();
        target = list.find((t) => t.type === "page");
        if (target?.webSocketDebuggerUrl) break;
      } catch { /* chrome not up yet */ }
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("Chrome did not expose a page target");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => {
      ws.addEventListener("open", resolve, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const cdp = new Cdp();
    cdp.#ws = ws;
    ws.addEventListener("message", (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.id && cdp.#pending.has(msg.id)) {
        const { resolve, reject } = cdp.#pending.get(msg.id);
        cdp.#pending.delete(msg.id);
        if (msg.error) reject(new Error(`${msg.error.message} (${msg.error.code})`));
        else resolve(msg.result);
      } else if (msg.method) {
        for (const fn of cdp.#listeners.get(msg.method) ?? []) fn(msg.params);
      }
    });
    return cdp;
  }

  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => {
        if (this.#pending.delete(id)) reject(new Error(`${method} timed out`));
      }, 45000);
    });
  }

  on(method, fn) {
    if (!this.#listeners.has(method)) this.#listeners.set(method, []);
    this.#listeners.get(method).push(fn);
  }

  close() { this.#ws.close(); }
}

async function evaluate(cdp, expression) {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression: `(() => { ${expression} })()`,
    returnByValue: true,
    awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || "evaluate threw");
  return result.value;
}

// ── the audit itself, runs in the page ───────────────────────────────────────
//
// Everything here answers a numbered anti-slop rule. Nothing is a vibe check.

const AUDIT_FN = `
  const vis = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === "none" || cs.visibility === "hidden" || cs.opacity === "0") return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...document.querySelectorAll("body *")].filter(vis);

  // Rule 1 — boxes fit their content. A panel whose own text does not fill it
  // is a padded box wearing a card's clothes.
  const slack = [];
  for (const el of all) {
    if (!el.children.length) continue;                 // leaves are text, fine
    const cs = getComputedStyle(el);
    const own = [...el.childNodes].reduce((n, c) => n + (c.nodeType === 3 ? c.textContent.trim().length : 0), 0);
    if (own === 0) continue;                            // pure wrapper, not a box claim
    const r = el.getBoundingClientRect();
    const inner = r.height - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const pad = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom);
    if (r.height > 90 && inner > r.height * 0.45 && pad > r.height * 0.3) {
      slack.push({ sel: el.className || el.tagName, h: Math.round(r.height), inner: Math.round(inner), pad: Math.round(pad) });
    }
  }

  // Rule 2 — balanced composition. Is the page scrolling, and is the map the
  // heaviest mass? A dashboard that scrolls 4000px is not a command board.
  const doc = document.documentElement;
  const pageScroll = Math.max(0, doc.scrollHeight - doc.clientHeight);
  const map = document.querySelector("#mapCanvas, #map3d, .map-panel");
  const mapRect = map ? map.getBoundingClientRect() : null;

  // Rule 3 — line length. Prose blocks wider than 65ch are the hit.
  const longLines = [];
  for (const el of all) {
    const t = (el.textContent || "").trim();
    if (t.length < 160) continue;
    const w = el.getBoundingClientRect().width;
    const fs = parseFloat(getComputedStyle(el).fontSize);
    const chars = Math.round(w / (fs * 0.5));           // ~0.5em average advance
    if (chars > 95) longLines.push({ sel: el.className || el.tagName, chars, w: Math.round(w) });
  }

  // Rule 4 — AI-slop fonts.
  const BANNED = ["Inter","Poppins","Montserrat","Roboto","Open Sans","Lato","DM Sans","Space Grotesk","Geist","Plus Jakarta Sans","Manrope","Nunito"];
  const families = new Set();
  for (const el of all) families.add(getComputedStyle(el).fontFamily);
  const banned = [...families].filter((f) => BANNED.some((b) => f.includes(b)));

  // Rule 5 + 7 — lazy ornaments and fake depth.
  const count = (pred) => all.filter(pred).length;
  const hasBackgroundImage = (el) => {
    const bi = getComputedStyle(el).backgroundImage;
    return bi && bi !== "none" && !/linear-gradient|none/.test(bi);
  };
  const gradients = count((el) => /gradient/.test(getComputedStyle(el).backgroundImage));
  const shadows = count((el) => getComputedStyle(el).boxShadow !== "none");
  const radii = all.filter((el) => {
    const r = getComputedStyle(el).borderRadius;
    return r && r !== "0px" && !/^0px 0px 0px 0px$/.test(r);
  });
  const italics = count((el) => getComputedStyle(el).fontStyle === "italic");
  const textShadow = count((el) => getComputedStyle(el).textShadow !== "none");

  // Rule 6 — hierarchy. Type sizes in use, and the biggest number on screen.
  const sizes = {};
  for (const el of all) {
    if (!(el.textContent || "").trim()) continue;
    if (el.children.length) continue;                    // measure leaves only
    const fs = Math.round(parseFloat(getComputedStyle(el).fontSize));
    sizes[fs] = (sizes[fs] || 0) + 1;
  }

  return {
    viewport: { w: innerWidth, h: innerHeight },
    rule1_boxesTooTall: slack.slice(0, 12),
    rule1_count: slack.length,
    rule2_pageScrollPx: pageScroll,
    rule2_map: mapRect ? { w: Math.round(mapRect.width), h: Math.round(mapRect.height), area: Math.round(mapRect.width * mapRect.height) } : null,
    rule2_mapShareOfFirstScreen: mapRect ? +(mapRect.width * mapRect.height / (innerWidth * innerHeight)).toFixed(3) : null,
    rule3_longLines: longLines.slice(0, 12),
    rule3_count: longLines.length,
    rule4_fontFamilies: [...families],
    rule4_bannedFonts: banned,
    rule5_gradients: gradients,
    rule5_shadows: shadows,
    rule5_nonZeroRadii: radii.length,
    rule5_italics: italics,
    rule7_textShadows: textShadow,
    rule6_typeSizes: sizes,
    rule6_distinctSizes: Object.keys(sizes).length,
    rule6_smallestSize: Math.min(...Object.keys(sizes).map(Number)),
    rule6_textUnder11px: Object.entries(sizes).filter(([s]) => Number(s) < 11).reduce((n, [, c]) => n + c, 0),
  };
`;

async function shoot(cdp, outDir, name) {
  const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  const file = path.join(outDir, `${name}.png`);
  await writeFile(file, Buffer.from(data, "base64"));
  return file;
}

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const profile = path.join(OUT, "chrome-profile");
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    "--no-first-run",
    "--no-default-browser-check",
    "--disable-gpu",
    "--hide-scrollbars",
    "--force-device-scale-factor=1",
    "about:blank",
  ], { stdio: "ignore" });

  const cdp = await Cdp.attach(PORT);
  const report = { url: URL_UNDER_TEST, at: new Date().toISOString(), widths: {} };

  try {
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");

    const consoleErrors = [];
    cdp.on("Runtime.consoleAPICalled", (p) => {
      if (p.type === "error" || p.type === "warning") {
        consoleErrors.push({ type: p.type, text: (p.args ?? []).map((a) => a.value ?? a.description ?? "").join(" ").slice(0, 300) });
      }
    });
    cdp.on("Runtime.exceptionThrown", (p) => {
      consoleErrors.push({ type: "exception", text: String(p.exceptionDetails?.exception?.description ?? "").slice(0, 300) });
    });

    for (const { name, width, height } of WIDTHS) {
      // deviceScaleFactor 1 — non-negotiable, see the header.
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width, height, deviceScaleFactor: 1, mobile: width < 500,
      });
      await cdp.send("Page.navigate", { url: URL_UNDER_TEST });
      // The board fetches ~40 sources before it renders. A screenshot taken at
      // 4s captures a half-painted page and reports phantom "empty panel"
      // hits. Wait for a real signal — the metric band holding cards — rather
      // than a fixed guess, then settle.
      let painted = false;
      {
        const deadline = Date.now() + 30000;
        while (Date.now() < deadline) {
          const ok = await evaluate(cdp, `
            const b = document.querySelector(".metric-band");
            const cards = document.querySelectorAll(".brief-item");
            const canvas = document.querySelector("#mapCanvas");
            return (b ? b.querySelectorAll(".metric-card, .metric").length : 0) >= 4
              && cards.length >= 3
              && canvas && canvas.getBoundingClientRect().height > 100
              && canvas.querySelectorAll(".leaflet-tile").length > 0;
          `).catch(() => false);
          if (ok) { painted = true; break; }
          await new Promise((r) => setTimeout(r, 400));
        }
      }
      await new Promise((r) => setTimeout(r, 2500));

      report.widths[name] = await evaluate(cdp, AUDIT_FN);
      report.widths[name].painted = painted;
      report.widths[name].screenshot = await shoot(cdp, OUT, name);
      // Full-page shot too, so the scroll length is visible at a glance.
      try {
        const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: true });
        await writeFile(path.join(OUT, `${name}-full.png`), Buffer.from(data, "base64"));
      } catch { /* full-page capture is best-effort */ }
    }

    report.console = consoleErrors.slice(0, 40);
    await writeFile(path.join(OUT, "audit.json"), JSON.stringify(report, null, 2));
    console.log(JSON.stringify(report, null, 2));
  } finally {
    cdp.close();
    chrome.kill();
  }
};

run().catch((e) => { console.error("audit failed:", e.message); process.exit(1); });