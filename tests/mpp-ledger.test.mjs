import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const { mppService: m } = JSON.parse(readFileSync(new URL('../public/api/dashboard.json', import.meta.url)));
const live = (part) => part && part.status !== 'unavailable';

test('ledger is either live with sourced sections or honestly unavailable', () => {
  assert.ok(m, 'mppService missing from snapshot');
  assert.ok(['live', 'unavailable'].includes(m.status));
  if (m.status === 'live') for (const k of ['charter', 'tenders', 'food', 'refuse', 'parks', 'markets']) {
    assert.match(m[k].url, /^https:\/\/mpp\.sarawak\.gov\.my\//, `${k} has no MPP source url`);
  }
});

test('charter: quarter scores are percentages and weakest pledges are sorted below 95%', () => {
  if (!live(m?.charter)) return;
  for (const q of m.charter.quarters) if (q.score != null) assert.ok(q.score > 0 && q.score <= 100);
  const scores = m.charter.weakest.map((w) => w.score);
  assert.ok(scores.every((s) => s < 95));
  assert.deepEqual(scores, [...scores].sort((a, b) => a - b));
  assert.ok(m.charter.pledgeCount >= 20, 'charter table layout changed: too few pledges parsed');
});

test('tenders, food grading and parks counts reconcile with their own rows', () => {
  if (live(m?.tenders)) assert.equal(m.tenders.active, m.tenders.items.length);
  if (live(m?.food)) assert.ok(m.food.gradeA <= m.food.premises);
  if (live(m?.parks)) assert.ok(m.parks.count > 0 && m.parks.areaSqm > 0);
});
