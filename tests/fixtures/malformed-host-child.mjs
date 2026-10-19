// Child process used by tests/release-hardening.test.mjs.
//
// It boots the REAL server.mjs, then sends it a request whose Host header is
// not a valid URL authority. Before the 19 Oct fix that made an unguarded
// `new URL()` throw inside an async callback — an unhandled rejection, which
// terminates the process. This asserts the server answers and stays up.
//
// This is the project's own local server, not the deployed Pages site; the
// audit's note that Cloudflare Pages is unaffected still holds.

import http from "node:http";
import path from "node:path";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const PORT = 34000 + Math.floor(Math.random() * 2000);

const child = spawn(process.execPath, [path.join(root, "server.mjs")], {
  env: { ...process.env, PORT: String(PORT), HOST: "127.0.0.1" },
  stdio: ["ignore", "pipe", "pipe"],
});

let log = "";
const ready = new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error(`server did not start: ${log}`)), 30000);
  child.stdout.on("data", (d) => {
    log += d;
    if (log.includes("listening on")) { clearTimeout(t); resolve(); }
  });
  child.stderr.on("data", (d) => { log += d; });
  child.on("exit", (code) => { clearTimeout(t); reject(new Error(`server exited early ${code}: ${log}`)); });
});

function request(pathname, hostHeader) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: "127.0.0.1", port: PORT, path: pathname, headers: { Host: hostHeader } }, (res) => {
      let body = "";
      res.on("data", (d) => { body += d; });
      res.on("end", () => resolve({ status: res.statusCode, body }));
    });
    req.on("error", reject);
    req.end();
  });
}

try {
  await ready;

  // 1. A Host header that is not a valid authority. The fix stopped consuming
  //    the header, so a 200 here is correct — the guarantee is that the process
  //    is still alive afterwards, not that it rejects the request.
  const bad = await request("/", "[bad");
  console.log(`malformed Host -> ${bad.status}`);

  // 2. The server must still be serving real requests afterwards. This is the
  //    actual assertion: before the fix the process was already dead.
  const health = await request("/api/health", "127.0.0.1:34000");
  console.log(`afterwards /api/health -> ${health.status}`);
  if (health.status !== 200) throw new Error(`server degraded after a malformed request: ${health.status}`);

  // 3. And it must still serve the board, proving no half-initialised state.
  const home = await request("/", "127.0.0.1:34000");
  console.log(`afterwards / -> ${home.status}`);
  if (home.status !== 200) throw new Error(`board unavailable after a malformed request: ${home.status}`);

  console.log("ALIVE");
  child.kill("SIGTERM");
  process.exit(0);
} catch (err) {
  console.log(`FAILED: ${err.message}`);
  console.log(`--- server log ---\n${log}`);
  child.kill("SIGKILL");
  process.exit(1);
}