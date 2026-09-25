import test from 'node:test';
import assert from 'node:assert/strict';
import { dataHealth } from '../public/data-health.js';
const now = Date.parse('2026-09-25T00:00:00Z');
const station = { focus:'padawan', waterLevelM:0, band:'normal' };
const payload = stations => ({ generatedAt:new Date(now).toISOString(), infobanjir:{stations} });
test('missing or null readings are unknown, never all clear', () => {
  assert.equal(dataHealth({}, 'padawan', now).uncertain, true);
  assert.equal(dataHealth(payload([{...station,waterLevelM:null}]), 'padawan', now).count, 0);
});
test('zero metres is a real reading, not a missing reading', () => {
  assert.equal(dataHealth(payload([station]), 'padawan', now).uncertain, false);
});
test('Padawan does not borrow other councils’ coverage or hazard band', () => {
  const p = payload([station,{focus:'other',waterLevelM:4,band:'danger'}]);
  assert.equal(dataHealth(p,'padawan',now).highest,'normal');
  assert.equal(dataHealth(p,'greater_kuching',now).highest,'danger');
});
test('old, invalid and future timestamps require review', () => {
  for (const generatedAt of ['2026-09-24T00:00:00Z','invalid','2026-09-26T00:00:00Z']) {
    assert.equal(dataHealth({...payload([station]),generatedAt},'padawan',now).uncertain,true);
  }
});
test('unclassified readings cannot claim normal', () => {
  assert.equal(dataHealth(payload([{...station,band:'reference'}]),'padawan',now).uncertain,true);
});
test('partial and offline coverage require review even with numeric readings', () => {
  assert.equal(dataHealth(payload([station,{...station,waterLevelM:null}]),'padawan',now).uncertain,true);
  const p = payload([station]);
  p.infobanjir.status = 'offline';
  assert.equal(dataHealth(p,'padawan',now).uncertain,true);
});
