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
