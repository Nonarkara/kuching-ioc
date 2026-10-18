// Anchoring an Open-Meteo observation onto its hourly series.
//
// Open-Meteo does not report `current.time` at the same granularity in every
// endpoint, and `hourly.time` is always hourly. Measured against the live API
// for Kuching (UTC+8, utc_offset_seconds 28800):
//
//   /v1/forecast      current.time = "2026-10-19T00:30"  → hourly has "…T00:00"
//   /v1/air-quality   current.time = "2026-10-19T00:00"  → hourly has "…T00:00"
//
// So `hourly.time.indexOf(current.time)` returns -1 whenever the observation
// lands on a half hour — which is the forecast endpoint's *normal* case, half
// of all wall-clock time.
//
// Why that was not cosmetic: the loaders validate the anchored window before
// returning, and `nowIdx >= 24` is the check that fails. A -1 anchor produces
// exactly one entry in `degradedFields` — ["hourly.time[now-24]"] — and the
// loader then discards a perfectly good observation and returns the labelled
// fallback stub. Production shipped for a week in that state: the source chip
// read "degraded", `current` showed a real-looking 30.8 °C, and every one of
// those numbers came from buildWeatherFallback(), not from the sky. The
// board looked alive and was not.
//
// Anchor to the newest hourly bucket at or before the observation instead.
// That is the same rule public/rain-regime.js already applied to its own
// window, so this only makes the two paths agree.
//
// Timestamps are ISO-8601 local strings of identical shape, so lexical
// comparison is chronological comparison.
export function anchorHourIndex(times, currentTime) {
  if (!Array.isArray(times) || typeof currentTime !== "string" || !currentTime) return -1;
  const exact = times.indexOf(currentTime);
  if (exact >= 0) return exact;
  for (let i = times.length - 1; i >= 0; i -= 1) {
    const t = times[i];
    if (typeof t === "string" && t.length >= currentTime.length && t <= currentTime) return i;
  }
  return -1;
}