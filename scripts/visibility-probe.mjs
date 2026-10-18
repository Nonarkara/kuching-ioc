#!/usr/bin/env node
// Why is populated DOM invisible? Walks the brief column and the metric band
// and reports, per element, the chain of properties that hides it:
// display, visibility, opacity, zero-height ancestor, clipping, off-screen.
//
// Usage: node scripts/visibility-probe.mjs [--url ...]

import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.PROBE_PORT || 9335);
const args = process.argv.slice(2);
const argv = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const URL_UNDER_TEST = argv("--url", "https://kuching.nonarkara.org/");

class Cdp {
  #ws; #id = 0; #pending = new Map(); #listeners = new Map();
  static async attach(port) {
    const deadline = Date.now() + 20000; let target;
    while (Date.now() < deadline) {
      try { const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find((t) => t.type === "page"); if (target?.webSocketDebuggerUrl) break; } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("no page target");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
    const c = new Cdp(); c.#ws = ws;
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.#pending.has(m.id)) { const { resolve, reject } = c.#pending.get(m.id); c.#pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result); }
      else if (m.method) for (const fn of c.#listeners.get(m.method) ?? []) fn(m.params);
    });
    return c;
  }
  send(method, params = {}) { const id = ++this.#id;
    return new Promise((resolve, reject) => { this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.#pending.delete(id)) reject(new Error(`${method} timed out`)); }, 45000); }); }
  on(m, fn) { if (!this.#listeners.has(m)) this.#listeners.set(m, []); this.#listeners.get(m).push(fn); }
  close() { this.#ws.close(); }
}

const run = async () => {
  const chrome = spawn(CHROME, ["--headless=new", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(HERE, "../tmp/anti-slop", "probe-profile")}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--force-device-scale-factor=1", "about:blank"], { stdio: "ignore" });
  const cdp = await Cdp.attach(PORT);
  try {
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: URL_UNDER_TEST });
    await new Promise((r) => setTimeout(r, 12000));

    const { result } = await cdp.send("Runtime.evaluate", {
      expression: `(() => {
        const describe = (el) => {
          const cs = getComputedStyle(el);
          const r = el.getBoundingClientRect();
          return {
            cls: (el.className && typeof el.className === "string" ? el.className : "").slice(0, 70),
            tag: el.tagName,
            rect: { w: Math.round(r.width), h: Math.round(r.height), top: Math.round(r.top), left: Math.round(r.left) },
            display: cs.display, visibility: cs.visibility, opacity: cs.opacity,
            overflow: cs.overflow, maxHeight: cs.maxHeight, height: cs.height,
            position: cs.position, zIndex: cs.zIndex,
            clip: cs.clipPath, transform: cs.transform,
            open: el.tagName === "DETAILS" ? el.open : undefined,
            text: (el.textContent || "").trim().slice(0, 70),
          };
        };
        const out = { brief: [], metrics: [], columnHeights: {}, suspects: [] };

        for (const el of document.querySelectorAll(".brief-card, .brief-item")) out.brief.push(describe(el));
        for (const el of document.querySelectorAll(".metric-band .metric-card, .metric-band > *")) out.metrics.push(describe(el));

        for (const sel of [".col-now", ".col-map", ".board-grid", ".brief-strip", ".metric-band", ".brief-column", "main", ".dashboard-shell"]) {
          const e = document.querySelector(sel);
          if (e) out.columnHeights[sel] = { h: Math.round(e.getBoundingClientRect().height), scrollH: e.scrollHeight, display: getComputedStyle(e).display, gridTemplateRows: getComputedStyle(e).gridTemplateRows };
        }

        // Any element whose computed box is bigger than the first screen yet holds no paint.
        for (const el of document.querySelectorAll("main *")) {
          const cs = getComputedStyle(el);
          if (cs.display === "none") continue;
          const r = el.getBoundingClientRect();
          if (r.height > 200 && r.width > 200 && el.textContent.trim().length > 40 && el.children.length === 0) {
            out.suspects.push(describe(el));
          }
        }
        return out;
      })()`, returnByValue: true,
    });
    console.log(JSON.stringify(result.value, null, 2));
  } finally { cdp.close(); chrome.kill(); }
};

run().catch((e) => { console.error("probe failed:", e.message); process.exit(1); });