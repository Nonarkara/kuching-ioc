import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { padawanResearchContext } from '../public/research-selection.js';

test('research follows the explicit latest target even when old panels remain selected', () => {
  const payload = { mppLocalities: { items: [{ code: 'L1', name: 'Locality A' }] }, infobanjir: { stations: [{ id: 'g1', name: 'Gauge B', observedAt: '25-10-2026 12:00' }] } };
  let selected = { kind: 'locality', id: 'L1' };
  assert.equal(padawanResearchContext(selected, payload).label, 'Locality A');
  selected = { kind: 'gauge', id: 'g1' };
  assert.deepEqual(padawanResearchContext(selected, payload), { label: 'Gauge B', observedAt: '25-10-2026 12:00 MYT (UTC+08)' });
  selected = { kind: 'ward', id: 'H' };
  assert.equal(padawanResearchContext(selected, payload).label, 'MPP · H');
  assert.equal(padawanResearchContext({ kind: 'gauge', id: 'missing' }, payload), null);
  assert.equal(padawanResearchContext(null, payload), null);
});
test('selection is written at explicit actions, not background catchment rendering', () => {
  const app = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
  assert.match(app, /async function openWaterPath\(station, bandColor\)\s*\{\s*if \(!station\) return;\s*state\.researchSelection = \{ kind: 'gauge', id: station\.id \}/);
  const renderer = app.slice(app.indexOf('function renderCatchmentStory('), app.indexOf('function renderCatchmentStory(') + 500);
  assert.equal(renderer.includes('researchSelection ='), false);
  assert.match(app, /state\.activeLocality = e\.code;\s*state\.researchSelection = \{ kind: 'locality', id: e\.code \}/);
});
