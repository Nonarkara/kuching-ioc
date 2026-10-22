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

// The literal "60 s" is the local loader's cadence, and it sat next to a Pages
// snapshot that the 4 h bake can leave hours old - a number claiming a freshness
// it did not have. Say what is true instead: how old the observation actually
// is, and which tier produced it.
//
// Only cards genuinely derived from climate may borrow the climate reading's
// age. Everything else - airport, wards, census, headlines - keeps its declared
// cadence; captioning those with the weather's timestamp is a fresh wrong
// provenance, the same defect as the literal it replaces.
export const CLIMATE_METRIC_READING = { heat: "weather", rain6h: "weather", aqi: "air", pm25: "air" };

export function metricFreshness(payload, id, fallback, at = Date.now()) {
  const which = CLIMATE_METRIC_READING[id];
  if (!which) return fallback;
  const reading = which === "air" ? payload?.climate?.air : payload?.climate?.weather;
  if (!reading) return fallback;
  const stamp = reading.observedAt || reading.updatedAt;
  if (!stamp) return fallback;
  // Open-Meteo reports a local stamp with no offset; our own updatedAt is UTC.
  const iso = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(stamp) ? `${stamp}:00+08:00` : stamp;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return fallback;
  const mins = Math.max(0, Math.round((at - t) / 60000));
  const age = mins < 1 ? "just now" : mins < 60 ? `${mins} min old` : `${Math.round(mins / 60)} h old`;
  const tier = payload?.delivery?.mode === "static-snapshot" ? " · baked" : "";
  const origin = reading.computedIn === "browser" ? " · browser-completed" : "";
  return `${age}${origin}${tier}`;
}
