// UI coverage checks are not a flood model or an agency freshness standard.
export function dataHealth(payload = {}, scope = 'padawan', now = Date.now()) {
  const time = Date.parse(payload.generatedAt);
  const ageHours = Number.isFinite(time) ? (now - time) / 3600000 : null;
  const outdated = ageHours === null || ageHours < -0.1 || ageHours > 6;
  const stations = (payload.infobanjir?.stations || []).filter(s => scope !== 'padawan' || s.focus === 'padawan');
  const readings = stations.filter(s => typeof s.waterLevelM === 'number' && Number.isFinite(s.waterLevelM));
  const ranks = { normal: 0, alert: 1, warning: 2, danger: 3 };
  const classified = readings.filter(s => s.band in ranks);
  const highest = classified.reduce((band, s) => ranks[s.band] > ranks[band] ? s.band : band, 'normal');
  return { ageHours, outdated, count: readings.length, total: stations.length,
    highest, classified: classified.length,
    uncertain: outdated || readings.length === 0 || readings.length !== stations.length || classified.length !== readings.length
      || ['offline', 'reference', 'error'].includes(payload.infobanjir?.status) };
}
