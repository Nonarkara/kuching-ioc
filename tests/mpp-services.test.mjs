import test from 'node:test';
import assert from 'node:assert/strict';
import { TRANSLATIONS, MPP_OFFICIAL_SERVICES } from '../public/data.js';

test('MPP official services catalog contains valid safe URLs and complete trilingual descriptions', () => {
  assert.ok(Array.isArray(MPP_OFFICIAL_SERVICES));
  assert.ok(MPP_OFFICIAL_SERVICES.length >= 8);

  for (const s of MPP_OFFICIAL_SERVICES) {
    assert.ok(s.id, 'service item must have an id');
    assert.ok(s.url.startsWith('https://'), `service ${s.id} url must be secure https`);
    assert.ok(s.category, `service ${s.id} must have a category`);
    for (const lang of ['en', 'ms', 'zh']) {
      assert.ok(s[lang]?.title, `service ${s.id} missing ${lang} title`);
      assert.ok(s[lang]?.desc, `service ${s.id} missing ${lang} desc`);
    }
  }
});

test('TRANSLATIONS parity: newly introduced keys exist across en, ms, and zh', () => {
  const requiredKeys = ['csPath', 'mppServices', 'mppServicesSub', 'viewInExplorer'];
  for (const lang of ['en', 'ms', 'zh']) {
    for (const key of requiredKeys) {
      assert.ok(
        TRANSLATIONS[lang]?.[key] && typeof TRANSLATIONS[lang][key] === 'string',
        `TRANSLATIONS[${lang}][${key}] must be non-empty string`
      );
    }
  }
});
