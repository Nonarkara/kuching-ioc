// Release the watchdog when work finishes, so a successful CLI can exit.
export async function withDeadline(work, ms, timeoutValue) {
  let timer;
  try {
    return await Promise.race([work, new Promise(resolve => { timer = setTimeout(() => resolve(timeoutValue), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}

// Browser descendants can inherit stdout/stderr after the browser parent exits.
// Close this audit's read ends; never signal unrelated browser processes.
export function releaseBrowser(child) {
  try { child.kill('SIGKILL'); } catch { /* already gone */ }
  child.stdout?.destroy();
  child.stderr?.destroy();
  child.unref();
}
