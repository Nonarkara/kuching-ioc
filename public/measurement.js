// A module-local clock: never patch Date for the document, map engine or probe.
export function measurementClock(builtAt, enabled, RealDate = globalThis.Date) {
  const t0 = RealDate.parse(builtAt) + 5 * 60000;
  if (!enabled || !Number.isFinite(t0)) return RealDate;
  return class extends RealDate {
    constructor(...args) { args.length ? super(...args) : super(t0); }
    static now() { return t0; }
  };
}
export function boardContentReady(document) {
  return document.querySelectorAll('#metricBand [data-metric-id]').length >= 4
    && document.querySelectorAll('#briefNow .brief-item').length >= 1
    && document.querySelectorAll('#researchPanel .evidence-funnel .rp-step').length === 5
    && !!document.querySelector('#mapCanvas .leaflet-pane');
}

// A normal-flow band heuristic misses absolutely positioned evidence buttons.
// Measure their intersection with the visible freshness glyphs explicitly.
export function measureMetricEvidence(document) {
  return Array.from(document.querySelectorAll('#metricBand .metric-card')).map(card => {
    const button = card.querySelector('.metric-evidence-open');
    const fresh = card.querySelector('.src-fresh');
    if (!button || !fresh) return { id: card.dataset.metricId, missing: true };
    const b = button.getBoundingClientRect(), f = fresh.getBoundingClientRect();
    const range = document.createRange(); range.selectNodeContents(fresh);
    const glyphs = Array.from(range.getClientRects());
    if (!(b.right - b.left >= 24 && b.bottom - b.top >= 24 && f.right > f.left && f.bottom > f.top) || !glyphs.some(g => g.right > g.left && g.bottom > g.top)) return { id: card.dataset.metricId, missing: true };
    const overlap = glyphs.reduce((area, g) => Math.max(area,
      Math.max(0, Math.min(b.right, f.right, g.right) - Math.max(b.left, f.left, g.left)) *
      Math.max(0, Math.min(b.bottom, f.bottom, g.bottom) - Math.max(b.top, f.top, g.top))), 0);
    return { id: card.dataset.metricId, overlap, freshnessClip: Math.max(0, fresh.scrollWidth - fresh.clientWidth) };
  });
}
