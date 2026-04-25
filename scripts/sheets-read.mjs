// ---------------------------------------------------------------------------
// Sheets read: pull the rolling Ground Pulse archive back into the build.
//
// Mirrors the auth path from sheets-archive.mjs but in the read direction.
// Returns rows grouped by lane label (Kuching / Padawan / Sarawak), each
// sorted chronologically. Skips cleanly with `null` if creds aren't set so
// build.mjs can degrade to "no sparkline" without failing.
// ---------------------------------------------------------------------------

import { createSign } from "node:crypto";

const TAB = "ground_pulse";
const HEADER_COLUMNS = "A:H"; // ts | lane | mentions_14d | mentions_24h | top_headline | top_source | top_trend | narrative

const base64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");

async function getAccessToken(credentials) {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: "RS256", typ: "JWT" };
  const claim = {
    iss: credentials.client_email,
    scope: "https://www.googleapis.com/auth/spreadsheets.readonly",
    aud: "https://oauth2.googleapis.com/token",
    exp: now + 3600,
    iat: now,
  };
  const toSign = `${base64url(JSON.stringify(header))}.${base64url(JSON.stringify(claim))}`;
  const signer = createSign("RSA-SHA256");
  signer.update(toSign);
  const signature = signer.sign(credentials.private_key);
  const jwt = `${toSign}.${base64url(signature)}`;

  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!res.ok) throw new Error(`Token exchange failed: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function fetchGroundPulseHistory({ sheetId, saJson, daysBack = 14 } = {}) {
  if (!sheetId || !saJson) return null;
  let credentials;
  try {
    credentials = JSON.parse(saJson);
  } catch {
    return null;
  }
  const token = await getAccessToken(credentials);

  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}` +
    `/values/${encodeURIComponent(TAB)}!${HEADER_COLUMNS}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });

  // Tab missing on first run → 400; treat as "no history yet".
  if (res.status === 400 || res.status === 404) return null;
  if (!res.ok) throw new Error(`Sheets read failed: ${res.status} ${await res.text()}`);

  const data = await res.json();
  const rows = data.values || [];
  if (rows.length < 2) return null; // header only

  const [, ...body] = rows;
  const cutoff = Date.now() - daysBack * 24 * 60 * 60 * 1000;
  const byLane = {};

  for (const row of body) {
    const tsRaw = row[0];
    const lane = row[1];
    if (!tsRaw || !lane) continue;
    const ts = Date.parse(tsRaw);
    if (!Number.isFinite(ts) || ts < cutoff) continue;
    const point = {
      ts: tsRaw,
      mentions14d: Number(row[2]) || 0,
      mentions24h: Number(row[3]) || 0,
    };
    (byLane[lane] = byLane[lane] || []).push(point);
  }

  for (const lane of Object.keys(byLane)) {
    byLane[lane].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
  }

  return byLane;
}
