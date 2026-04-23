import { execFileSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const ROOT_DIR = __dirname;
export const PUBLIC_DIR = path.join(ROOT_DIR, "public");
export const INDEX_TEMPLATE_PATH = path.join(PUBLIC_DIR, "index.template.html");
export const INDEX_OUTPUT_PATH = path.join(PUBLIC_DIR, "index.html");
export const DEFAULT_PAGES_URL = "https://nonarkara.github.io/kuching-ioc/";
export const DEFAULT_LIVE_URL = "https://nonarkara-kuching-ioc-live.fly.dev/";

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
  return JSON.stringify(value).replace(/</g, "\\u003c");
}

export async function renderIndexHtml({
  env = process.env,
  assetVersion,
  builtAt = null,
  deploymentMode = "live-service",
  boardLabel = deploymentMode === "pages-static" ? "SNAPSHOT BOARD" : "LIVE BOARD",
  pagesUrl = env.PAGES_PUBLIC_URL || DEFAULT_PAGES_URL,
  liveUrl = env.LIVE_IOC_URL || DEFAULT_LIVE_URL,
} = {}) {
  const resolvedAssetVersion = compactAssetToken(assetVersion) || resolveAssetVersion({ env, builtAt: builtAt || undefined });
  const template = await fs.readFile(INDEX_TEMPLATE_PATH, "utf8");
  const bootMeta = {
    assetVersion: resolvedAssetVersion,
    builtAt,
    deploymentMode,
    boardLabel,
    pagesUrl: normalizeUrl(pagesUrl, DEFAULT_PAGES_URL),
    liveUrl: normalizeUrl(liveUrl, DEFAULT_LIVE_URL),
  };

  return template
    .replaceAll("__ASSET_VERSION__", resolvedAssetVersion)
    .replace("__IOC_BOOT_JSON__", escapeScriptJson(bootMeta));
}

export async function writeRenderedIndex(options = {}) {
  const html = await renderIndexHtml(options);
  await fs.writeFile(INDEX_OUTPUT_PATH, html);
  return html;
}
