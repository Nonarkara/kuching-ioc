// Release the watchdog when work finishes, so a successful CLI can exit.
export async function withDeadline(work, ms, timeoutValue) {
  let timer;
  try {
    return await Promise.race([work, new Promise(resolve => { timer = setTimeout(() => resolve(timeoutValue), ms); })]);
  } finally {
    clearTimeout(timer);
  }
}
