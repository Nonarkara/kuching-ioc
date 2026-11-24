import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dataHealth, HEALTH_SOURCE_KEYS, buildHealthPayload } from '../public/data-health.js';
import { computeSnapshotHash, writeHealthArtifact } from '../build.mjs';
const now = Date.parse('2026-09-25T00:00:00Z');
const station = { focus:'padawan', waterLevelM:0, band:'normal', observedAt:'25-09-2026 08:00' };
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

test('bake writes valid health.json with every source key data-health.js knows', async (t) => {
  const dashRaw = await fs.readFile(new URL('../public/api/dashboard.json', import.meta.url), 'utf8');
  const dash = JSON.parse(dashRaw);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'kuching-health-'));
  t.after(() => fs.rm(tmpDir, { recursive: true, force: true }));
  const outPath = path.join(tmpDir, 'health.json');

  const hashA = computeSnapshotHash(dash, { drainage: 'abc' }, 'deadbeef');
  const hashB = computeSnapshotHash({ ...dash, generatedAt: '2099-01-01T00:00:00.000Z' }, { drainage: 'abc' }, 'deadbeef');
  assert.equal(hashA, hashB, 'snapshot hash must ignore volatile generatedAt timestamps');

  await writeHealthArtifact(dash, {
    buildId: 'test-build-1',
    bakedAt: '2026-11-25T00:00:00.000Z',
    snapshotHash: hashA,
    outputPath: outPath,
  });

  const parsed = JSON.parse(await fs.readFile(outPath, 'utf8'));
  assert.equal(parsed.service, 'kuching-ioc');
  assert.equal(parsed.build_id, 'test-build-1');
  assert.equal(parsed.baked_at, '2026-11-25T00:00:00.000Z');
  assert.equal(parsed.snapshot_hash, hashA);
  assert.ok(Array.isArray(parsed.sources) && parsed.sources.length > 0);

  const keys = new Set(parsed.sources.map(s => s.key));
  for (const knownKey of HEALTH_SOURCE_KEYS) {
    assert.ok(keys.has(knownKey), `health.json must include source key "${knownKey}"`);
  }
  for (const s of parsed.sources) {
    assert.equal(typeof s.key, 'string');
    assert.ok(s.key.length > 0);
    assert.ok(s.observed_at === null || typeof s.observed_at === 'string');
    assert.equal(typeof s.status, 'string');
  }

  // Also verify buildHealthPayload includes HEALTH_SOURCE_KEYS even on a minimal payload.
  const minimal = buildHealthPayload({});
  const minKeys = new Set(minimal.sources.map(s => s.key));
  for (const knownKey of HEALTH_SOURCE_KEYS) {
    assert.ok(minKeys.has(knownKey), `minimal health payload must include "${knownKey}"`);
  }
});
