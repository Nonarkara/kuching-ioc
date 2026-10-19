import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = __dirname;
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const INDEX_TEMPLATE_PATH = path.join(PUBLIC_DIR, "index.template.html");
export const INDEX_OUTPUT_PATH = path.join(PUBLIC_DIR, "index.html");
export const DEFAULT_PAGES_URL = "https://kuching.nonarkara.org/";
// Production is Cloudflare Pages only — no separate live host.
export const DEFAULT_LIVE_URL = "https://kuching.nonarkara.org/";

function normalizeUrl(value, fallback) {
  const url = String(value || fallback || "").trim();
  if (!url) return null;
  return url.endsWith("/") ? url : `${url}/`;
}

function compactAssetToken(value) {
  return String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function timestampToken(value) {
  return String(value || new Date().toISOString()).replace(/\D/g, "").slice(0, 14);
}

export function resolveAssetVersion({ env = process.env, builtAt = new Date().toISOString() } = {}) {
  const envCandidates = [
    env.ASSET_VERSION,
    env.SOURCE_VERSION,
    env.GITHUB_SHA,
    env.FLY_IMAGE_REF,
    env.RENDER_GIT_COMMIT,
  ];

  for (const candidate of envCandidates) {
    const normalized = compactAssetToken(candidate);
    if (normalized) return normalized;
  }

  try {
    const gitSha = execFileSync("git", ["rev-parse", "--short=12", "HEAD"], {
      cwd: ROOT_DIR,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    const normalized = compactAssetToken(gitSha);
    if (normalized) {
      try {
        const dirty = execFileSync("git", ["status", "--porcelain", "public", "server.mjs", "data.js"], {
          cwd: ROOT_DIR,
          encoding: "utf8",
          stdio: ["ignore", "pipe", "ignore"],
        }).trim();
        if (dirty) {
          return compactAssetToken(`${normalized}-${timestampToken(builtAt).slice(-6)}`);
        }
      } catch {}
      return normalized;
    }
  } catch {
    // Fall back to a timestamp when git metadata is unavailable.
  }

  return timestampToken(builtAt);
}

function escapeScriptJson(value) {
  // U+2028/2029 are legal in JSON but end a line in older JS parsers.
  return JSON.stringify(value).replace(/</g, "\\u003c").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export async function renderIndexHtml({
  env = process.env,
  assetVersion,
  builtAt = null,
  deploymentMode = "live-service",
  boardLabel = deploymentMode === "pages-static" ? "SNAPSHOT BOARD" : "LIVE BOARD",
  pagesUrl = env.PAGES_PUBLIC_URL || DEFAULT_PAGES_URL,
  liveUrl = env.LIVE_IOC_URL || DEFAULT_LIVE_URL,
  visitorBeaconUrl = env.VISITOR_BEACON_URL || "",
} = {}) {
  const resolvedAssetVersion = compactAssetToken(assetVersion) || resolveAssetVersion({ env, builtAt: builtAt || undefined });
  const template = await fs.readFile(INDEX_TEMPLATE_PATH, "utf8");
  // Honest version reporting: the board shows the package.json release version
  // in the runtime detail + title tooltip. Unreadable package → "dev".
  let appVersion = "dev";
  try {
    const pkg = JSON.parse(await fs.readFile(path.join(ROOT_DIR, "package.json"), "utf8"));
    if (pkg.version) appVersion = String(pkg.version);
  } catch { /* keep "dev" */ }
  const bootMeta = {
    version: appVersion,
    assetVersion: resolvedAssetVersion,
    builtAt,
    deploymentMode,
    boardLabel,
    pagesUrl: normalizeUrl(pagesUrl, DEFAULT_PAGES_URL),
    liveUrl: normalizeUrl(liveUrl, DEFAULT_LIVE_URL),
  };

  return template
    .replaceAll("__ASSET_VERSION__", resolvedAssetVersion)
    // Function replacements: a "$&" or "$'" in an env value must stay literal.
    .replace("__VISITOR_BEACON_URL__", () => escapeScriptJson(visitorBeaconUrl))
    .replace("__IOC_BOOT_JSON__", () => escapeScriptJson(bootMeta));
}

// Every origin the board's own code loads from, by directive. Anything not
// listed is refused by the browser, so an injected script or a swapped
// third-party asset cannot run or phone home.
const CSP_SOURCES = {
  // Cesium compiles WebAssembly (draco/basis decoders): wasm only, not eval.
  script: ["'self'", "'wasm-unsafe-eval'", "https://unpkg.com", "https://cdn.jsdelivr.net"],
  connect: ["'self'", "https://api.open-meteo.com", "https://air-quality-api.open-meteo.com", "https://marine-api.open-meteo.com",
    "https://opensky-network.org", "https://open.er-api.com", "https://api.rainviewer.com", "https://tilecache.rainviewer.com",
    "https://cdn.jsdelivr.net", "https://server.arcgisonline.com", "https://services.arcgisonline.com",
    "https://gibs.earthdata.nasa.gov", "https://earthquake.usgs.gov", "https://ipwho.is", "https://script.google.com",
    "https://script.googleusercontent.com"],
};

// Hash each inline <script> that the browser executes. JSON blocks are data,
// so CSP does not apply to them.
export function inlineScriptHashes(html) {
  const hashes = [];
  for (const [, attrs, body] of html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>([\s\S]*?)<\/script>/g)) {
    if (/type="(?!module|text\/javascript)/.test(attrs)) continue;
    hashes.push(`'sha256-${createHash("sha256").update(body, "utf8").digest("base64")}'`);
  }
  return hashes;
}

export function contentSecurityPolicy(html) {
  return [
    "default-src 'self'",
    `script-src ${[...CSP_SOURCES.script, ...inlineScriptHashes(html)].join(" ")}`,
    // Cesium spawns its workers from blob: URLs built from the CDN build.
    "worker-src 'self' blob: https://cdn.jsdelivr.net",
    // Leaflet, Cesium and our own renderers set element styles at runtime.
    "style-src 'self' 'unsafe-inline' https://unpkg.com https://cdn.jsdelivr.net",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://cdn.jsdelivr.net",
    `connect-src ${CSP_SOURCES.connect.join(" ")}`,
    "frame-src 'none'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "form-action 'self'",
    "upgrade-insecure-requests",
  ].join("; ");
}

export async function writeRenderedIndex(options = {}) {
  const html = await renderIndexHtml(options);
  await fs.writeFile(INDEX_OUTPUT_PATH, html);
  // The inline boot script changes every build, so its hash is written into
  // Cloudflare's _headers in the same step as the page it protects.
  const headersPath = path.join(PUBLIC_DIR, "_headers");
  const headers = await fs.readFile(headersPath, "utf8");
  const next = headers.replace(/^  Content-Security-Policy: .*$/m, () => `  Content-Security-Policy: ${contentSecurityPolicy(html)}`);
  if (next !== headers) await fs.writeFile(headersPath, next);
  return html;
}
