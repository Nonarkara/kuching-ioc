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
  const requiredKeys = [
    'csPath', 'mppServices', 'mppServicesSub', 'viewInExplorer',
    'scopeMyWards', 'scopeWholeKuching', 'radarPadawan', 'radarGreater',
    'wardCategoryAll', 'cat_urban_core', 'cat_suburban_growth',
    'cat_riverine_catchment', 'cat_rural_foothills',
    'heroMapToggle', 'deepTrayToggle'
  ];
  for (const lang of ['en', 'ms', 'zh']) {
    for (const key of requiredKeys) {
      assert.ok(
        TRANSLATIONS[lang]?.[key] && typeof TRANSLATIONS[lang][key] === 'string',
        `TRANSLATIONS[${lang}][${key}] must be non-empty string`
      );
    }
  }
});

test('MPP ward categories: all 10 wards partitioned into 4 civic clusters with trilingual names', async () => {
  const { MPP_WARD_CATEGORIES, WARD_TO_CATEGORY } = await import('../public/data.js');
  assert.ok(MPP_WARD_CATEGORIES, 'MPP_WARD_CATEGORIES must exist');
  assert.ok(WARD_TO_CATEGORY, 'WARD_TO_CATEGORY must exist');

  const catKeys = Object.keys(MPP_WARD_CATEGORIES);
  assert.equal(catKeys.length, 4, 'Must have exactly 4 ward categories');

  const expectedWards = ['A', 'B', 'D', 'FG', 'H', 'I', 'JL', 'K', 'M', 'NPQ'];
  const allMappedWards = [];

  for (const [id, cat] of Object.entries(MPP_WARD_CATEGORIES)) {
    assert.equal(cat.id, id);
    assert.ok(cat.code, `Category ${id} must have a code`);
    assert.ok(cat.icon, `Category ${id} must have an icon`);
    assert.ok(cat.color, `Category ${id} must have a color`);
    assert.ok(Array.isArray(cat.wardCodes) && cat.wardCodes.length > 0, `Category ${id} must have wardCodes`);

    for (const lang of ['en', 'ms', 'zh']) {
      assert.ok(cat.name?.[lang], `Category ${id} must have ${lang} name`);
      assert.ok(cat.shortLabel?.[lang], `Category ${id} must have ${lang} shortLabel`);
      assert.ok(cat.description?.[lang], `Category ${id} must have ${lang} description`);
    }

    for (const w of cat.wardCodes) {
      assert.ok(expectedWards.includes(w), `Unknown ward code ${w} in category ${id}`);
      assert.equal(WARD_TO_CATEGORY[w], id, `WARD_TO_CATEGORY[${w}] must match ${id}`);
      allMappedWards.push(w);
    }
  }

  // All 10 wards mapped once and only once
  assert.equal(allMappedWards.length, 10);
  assert.deepEqual(allMappedWards.sort(), [...expectedWards].sort());
});

