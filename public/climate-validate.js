// Shared climate validation — one implementation for the server bake and the
// browser, so a payload the bake accepts is a payload the browser accepts.
//
// Every rule here exists because its absence shipped a lie to the board:
//
//   windowComplete  — `.slice(a, b).every(Number.isFinite)` is vacuously true
//     on an empty slice, and true for a short one. Both passed validation and
//     produced empty history with NaN forecast values (JSON-null downstream)
//     while the loader still returned status "live".
//   seriesContinuous — an hourly series with a gap or a duplicated stamp is not
//     an hourly series; the "next 6h"/"past 24h" windows become fiction.
//   observationWindow — `current.time` from a feed that lags or has a runaway
//     clock must not be printed as the weather right now.

// A window must exist, be the full requested length, and be entirely finite.
export function windowComplete(values, start, length) {
  if (!Array.isArray(values) || length <= 0 || start < 0) return false;
  if (values.length < start + length) return false;
  const slice = values.slice(start, start + length);
  return slice.length === length && slice.every(Number.isFinite);
}

// Consecutive hourly stamps, no gaps and no duplicates.
export function seriesContinuous(times, start, length, stepMs = 3600000) {
  if (!Array.isArray(times) || length <= 0 || start < 0) return false;
  if (times.length < start + length) return false;
  for (let i = start; i < start + length - 1; i += 1) {
    const a = Date.parse(`${times[i]}:00+08:00`);
    const b = Date.parse(`${times[i + 1]}:00+08:00`);
    if (!Number.isFinite(a) || !Number.isFinite(b) || b - a !== stepMs) return false;
  }
  return true;
}

// A "current" observation more than this old is not a current observation.
// Deliberately generous: the bake retrieves, validates and serialises over a few
// minutes and Open-Meteo rounds to the half hour, so a healthy feed lands well
// inside this. The ceiling exists to catch a stale cache being relabelled
// "live", not to second-guess a fresh reading.
export const MAX_OBSERVATION_AGE_MS = 6 * 3600000;
// A clock that far ahead of us is a broken feed, not a forecast.
export const MAX_CLOCK_SKEW_MS = 30 * 60000;

// Returns null when acceptable, else the field name to record in
// degradedFields — matching the existing validator shape so the operator sees
// which reading failed rather than a bare "degraded".
export function observationWindow(observedAt, nowMs = Date.now()) {
  const t = Date.parse(`${observedAt}:00+08:00`);
  if (!Number.isFinite(t)) return "current.time";
  if (t - nowMs > MAX_CLOCK_SKEW_MS) return "current.time[future]";
  if (nowMs - t > MAX_OBSERVATION_AGE_MS) return "current.time[stale]";
  return null;
}