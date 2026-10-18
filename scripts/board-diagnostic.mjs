#!/usr/bin/env node
// Diagnostic: is the empty desktop render a boot-timing artifact or a real
// failure? Loads the board, waits for the payload to land, then reports what
// the DOM actually contains and which requests failed.
//
// Usage: node scripts/board-diagnostic.mjs [--url ...] [--wait 9000]

import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(HERE, "../tmp/anti-slop");
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const PORT = Number(process.env.DIAG_PORT || 9334);

const args = process.argv.slice(2);
const argv = (f, d) => { const i = args.indexOf(f); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const URL_UNDER_TEST = argv("--url", "https://kuching.nonarkara.org/");
const WAIT = Number(argv("--wait", "9000"));

class Cdp {
  #ws; #id = 0; #pending = new Map(); #listeners = new Map();
  static async attach(port) {
    const deadline = Date.now() + 20000; let target;
    while (Date.now() < deadline) {
      try {
        const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
        target = list.find((t) => t.type === "page");
        if (target?.webSocketDebuggerUrl) break;
      } catch {}
      await new Promise((r) => setTimeout(r, 250));
    }
    if (!target) throw new Error("no page target");
    const ws = new WebSocket(target.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.addEventListener("open", res, { once: true }); ws.addEventListener("error", rej, { once: true }); });
    const c = new Cdp(); c.#ws = ws;
    ws.addEventListener("message", (ev) => {
      const m = JSON.parse(ev.data);
      if (m.id && c.#pending.has(m.id)) {
        const { resolve, reject } = c.#pending.get(m.id); c.#pending.delete(m.id);
        m.error ? reject(new Error(m.error.message)) : resolve(m.result);
      } else if (m.method) for (const fn of c.#listeners.get(m.method) ?? []) fn(m.params);
    });
    return c;
  }
  send(method, params = {}) {
    const id = ++this.#id;
    return new Promise((resolve, reject) => {
      this.#pending.set(id, { resolve, reject });
      this.#ws.send(JSON.stringify({ id, method, params }));
      setTimeout(() => { if (this.#pending.delete(id)) reject(new Error(`${method} timed out`)); }, 45000);
    });
  }
  on(method, fn) { if (!this.#listeners.has(method)) this.#listeners.set(method, []); this.#listeners.get(method).push(fn); }
  close() { this.#ws.close(); }
}

const ev = async (cdp, expr) => {
  const { result, exceptionDetails } = await cdp.send("Runtime.evaluate", {
    expression: `(() => { ${expr} })()`, returnByValue: true, awaitPromise: true,
  });
  if (exceptionDetails) throw new Error(exceptionDetails.exception?.description || "threw");
  return result.value;
};

const run = async () => {
  await mkdir(OUT, { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new", `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${path.join(OUT, "diag-profile")}`,
    "--no-first-run", "--no-default-browser-check", "--disable-gpu",
    "--force-device-scale-factor=1", "about:blank",
  ], { stdio: "ignore" });

  const cdp = await Cdp.attach(PORT);
  try {
    await cdp.send("Page.enable"); await cdp.send("Runtime.enable"); await cdp.send("Network.enable");

    const failed = [], requests = [];
    cdp.on("Network.responseReceived", (p) => {
      requests.push({ url: p.response.url.slice(0, 120), status: p.response.status, type: p.type });
      if (p.response.status >= 400) failed.push({ url: p.response.url.slice(0, 120), status: p.response.status, type: p.type });
    });
    cdp.on("Network.loadingFailed", (p) => failed.push({ url: "(failed)", error: p.errorText, type: p.type }));
    const logs = [];
    cdp.on("Runtime.consoleAPICalled", (p) => logs.push({ type: p.type, text: (p.args ?? []).map(a => a.value ?? a.description ?? "").join(" ").slice(0, 240) }));
    cdp.on("Runtime.exceptionThrown", (p) => logs.push({ type: "exception", text: String(p.exceptionDetails?.exception?.description ?? "").slice(0, 400) }));

    await cdp.send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.navigate", { url: URL_UNDER_TEST });
    await new Promise((r) => setTimeout(r, WAIT));

    const dom = await ev(cdp, `
      const txt = (sel) => { const e = document.querySelector(sel); return e ? (e.textContent||"").trim().slice(0,120) : null; };
      const box = (sel) => { const e = document.querySelector(sel); if (!e) return null; const r = e.getBoundingClientRect(); return {w:Math.round(r.width),h:Math.round(r.height)}; };
      const tiles = document.querySelectorAll(".leaflet-tile, .map-tile").length;
      return {
        bootJson: typeof window.__IOC_BOOT__,
        metricCards: document.querySelectorAll(".metric-card, .metric").length,
        metricBandHTML: (document.querySelector(".metric-band")||{}).innerHTML ? (document.querySelector(".metric-band").innerHTML.length) : null,
        verdictStrip: txt("#verdictStrip"),
        briefCards: document.querySelectorAll(".brief-card").length,
        briefItems: document.querySelectorAll(".brief-item").length,
        directiveCount: document.querySelectorAll(".directive, .op-item, [data-directive]").length,
        mapBox: box("#mapCanvas"),
        map3dBox: box("#map3d"),
        leafletTileEls: tiles,
        mapInnerLen: (document.querySelector("#mapCanvas")||{}).innerHTML ? document.querySelector("#mapCanvas").innerHTML.length : null,
        opsCount: document.querySelectorAll(".situation-rail > *").length,
        newsCount: document.querySelectorAll(".news-item, .headline").length,
        bodyLen: document.body.innerText.length,
      };
    `);

    const { data } = await cdp.send("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    await writeFile(path.join(OUT, "diag-1440.png"), Buffer.from(data, "base64"));

    console.log(JSON.stringify({
      waitedMs: WAIT,
      dom,
      requestCount: requests.length,
      failed: failed.slice(0, 25),
      logs: logs.slice(0, 30),
    }, null, 2));
  } finally { cdp.close(); chrome.kill(); }
};

run().catch((e) => { console.error("diag failed:", e.message); process.exit(1); });