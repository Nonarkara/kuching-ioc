import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { TRANSLATIONS } from '../public/data.js';
import { PHRASES, createTranslator } from '../public/ui-language.js';
import { MPP_SERVICES } from '../public/mpp-services.js';
import { findNewsSummary } from '../public/news-translation.js';
const translate = createTranslator(TRANSLATIONS);
test('all catalogue and council-service entries have three nonempty languages',()=>{
  for(const row of PHRASES) { assert.equal(row.length,3); assert.ok(row.every(value=>typeof value === 'string' && value.trim())); }
  for(const item of MPP_SERVICES) {
    assert.equal(new URL(item.url).protocol,'https:');
    for(const lang of ['en','ms','zh']) assert.ok(item[lang].length === 2 && item[lang].every(Boolean));
  }
});
test('static interface translations return to English without damaging names',()=>{
  assert.equal(translate('Water watch','zh'),'水情监测');
  assert.equal(translate('水情监测','en'),'Water watch');
  assert.equal(translate('Batu Kitang','zh'),'Batu Kitang');
  assert.equal(translate('https://mpp.sarawak.gov.my/','zh'),'https://mpp.sarawak.gov.my/');
});
test('dynamic status translates the sentence but preserves counts',()=>{
  assert.equal(translate('Gauge band: normal · 8/8 readings','zh'),'水位等级：正常 · 8/8 个读数');
  assert.equal(translate('Rain: 0mm in the next hours — 18.6 mm expected today','zh'),'降雨：未来数小时 0 毫米，今日预计 18.6 毫米');
  assert.equal(translate('18.6 mm expected today','ms'),'18.6 mm dijangka hari ini');
});
test('news translation cannot match a different or changed article',()=>{
  const entry = {link:'https://example.test/a',title:'Report A',basis:'headline-only',summaries:{en:'A',ms:'B',zh:'丙'}};
  assert.equal(findNewsSummary([entry],entry,'zh'),'丙');
  assert.equal(findNewsSummary([entry],{...entry,title:'Report B'},'zh'),null);
  assert.equal(findNewsSummary([entry],{...entry,link:'https://example.test/b'},'zh'),null);
  assert.equal(findNewsSummary([],entry,'zh'),null);
});
test('baked news summaries retain original metadata and explicit draft status',async()=>{
  const data = JSON.parse(await readFile(new URL('../public/news-translations.json',import.meta.url),'utf8'));
  for(const entry of data.entries) {
    assert.equal(entry.basis,'headline-only');
    assert.equal(entry.review,'machine-draft');
    assert.ok(entry.title && entry.link && entry.source && entry.translatedAt);
    for(const lang of ['en','ms','zh']) assert.ok(findNewsSummary(data.entries,entry,lang));
  }
});
test('reading surfaces override hard-coded legacy dot-matrix faces',async()=>{
  const css = await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/--font-sans: "Helvetica Neue", Helvetica, Arial/);
  assert.match(css,/\.dashboard-shell \*.*\{[\s\S]*?font-family: var\(--font-sans\) !important/);
});
