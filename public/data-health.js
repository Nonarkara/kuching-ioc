// UI coverage checks are not a flood model or an agency freshness standard.
import { malaysiaTime } from './met-weather.js';
// Conservative UI review window, not a JPS flood or freshness standard.
export function observationHealth(station, now = Date.now()) {
  const time = malaysiaTime(station?.observedAt);
  const ageMinutes = Number.isFinite(time) ? (now - time) / 60000 : null;
  const status = ageMinutes === null ? 'unknown' : ageMinutes < -5 ? 'future' : ageMinutes > 120 ? 'stale' : 'recent';
  return { ageMinutes, status, uncertain: status !== 'recent' };
}

export function warningHealth(met, now = Date.now()) {
  const age = (now - Date.parse(met?.updatedAt)) / 60000;
  return { uncertain: !['live', 'clear'].includes(met?.status)
    || !Number.isFinite(age) || age < -5 || age > 120 };
}

export function dataHealth(payload = {}, scope = 'padawan', now = Date.now()) {
  const time = Date.parse(payload.generatedAt);
  const ageHours = Number.isFinite(time) ? (now - time) / 3600000 : null;
  const outdated = ageHours === null || ageHours < -0.1 || ageHours > 6;
  const stations = (payload.infobanjir?.stations || []).filter(s => scope !== 'padawan' || s.focus === 'padawan');
  const readings = stations.filter(s => typeof s.waterLevelM === 'number' && Number.isFinite(s.waterLevelM));
  const ranks = { normal: 0, alert: 1, warning: 2, danger: 3 };
  const classified = readings.filter(s => s.band in ranks);
  const outdatedReadings = readings.filter(s => observationHealth(s, now).uncertain).length;
  const highest = classified.reduce((band, s) => ranks[s.band] > ranks[band] ? s.band : band, 'normal');
  return { ageHours, outdated, count: readings.length, total: stations.length,
    highest, classified: classified.length, outdatedReadings,
    uncertain: outdated || readings.length === 0 || readings.length !== stations.length || classified.length !== readings.length
      || outdatedReadings > 0 || ['offline', 'reference', 'error'].includes(payload.infobanjir?.status) };
}
