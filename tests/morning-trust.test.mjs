import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeMetWeather, malaysiaTime } from '../public/met-weather.js';
import { observationHealth, dataHealth, warningHealth } from '../public/data-health.js';
import { morningBrief } from '../public/morning-brief.js';
import { readFile } from 'node:fs/promises';
const at = Date.parse('2026-10-11T02:00:00Z');
test('failed and malformed warning feeds never become all clear', () => {
  for (const input of [null, {}, [{valid_from:'broken',valid_to:'broken'}]]) {
    const m = normalizeMetWeather(input, [], at);
    assert.equal(m.status, 'unavailable'); assert.equal(m.activeCount, null);
    assert.equal(warningHealth(m, at).uncertain, true);
  }
  assert.equal(normalizeMetWeather([], null, at).status, 'clear');
});
test('MET official fields select earliest current Kuching day and Malay rain', () => {
  const f = date => ({location:{location_name:'Kuching'},date,summary_forecast:'Ribut petir di beberapa tempat'});
  const result = normalizeMetWeather([], [f('2026-10-17'),f('2026-10-11'),f('2026-10-10')], at);
  assert.equal(result.forecast.date, '2026-10-11');
  assert.equal(result.forecast.hasRain, true); assert.equal(result.forecast.language,'ms');
});
test('timezone-less warnings and iHYDRO times use Malaysia UTC+8', () => {
  assert.equal(malaysiaTime('11-10-2026 10:00'), at);
  assert.equal(malaysiaTime('2026-10-11T10:00:00'), at);
  const w = {valid_from:'2026-10-11T09:00:00',valid_to:'2026-10-11T11:00:00',text_en:'Kuching'};
  assert.equal(normalizeMetWeather([w],[],at).activeCount,1);
  const partial = normalizeMetWeather([w,{valid_from:null,valid_to:null,heading_en:'Unknown validity'}],[],at);
  assert.equal(partial.status,'partial'); assert.equal(partial.activeCount,1);
  assert.equal(partial.undatedItems.length,1); assert.equal(warningHealth(partial,at).uncertain,true);
});
test('new payload cannot hide old, missing or future station observations', () => {
  for (const observedAt of ['11-10-2026 07:00',null,'11-10-2026 12:00']) {
    assert.equal(observationHealth({observedAt},at).uncertain,true);
    assert.equal(dataHealth({generatedAt:new Date(at).toISOString(),infobanjir:{stations:[
      {focus:'padawan',observedAt,waterLevelM:0,band:'normal'}]}},'padawan',at).uncertain,true);
  }
  assert.equal(observationHealth({observedAt:'11-10-2026 09:45'},at).status,'recent');
});
test('three translated actions expose uncertainty and keep absent values unknown', () => {
  for (const lang of ['en','ms','zh']) {
    const b = morningBrief({metrics:[],forecast:{status:'stale'}},lang,'padawan',at);
    assert.equal(b.now.length,3); assert.equal(b.next.length,2); assert.equal(b.blind.length,3);
    assert.ok(b.now.every(v=>v.length>15)); assert.doesNotMatch(b.next.join(' '),/0 mm|0毫米/);
  }
  assert.match(morningBrief({},'en','padawan',at).now[1],/unavailable/);
});
test('actual MET adapter preserves failure and passes documented query to normalizer', async () => {
  const source = await readFile(new URL('../server.mjs',import.meta.url),'utf8');
  const block = source.slice(source.indexOf('async function loadMetWarnings()'),source.indexOf('async function loadFloodForecast()'));
  const urls = [];
  const load = new Function('cached','fetchJson','normalizeMetWeather',
    block + ';return loadMetWarnings;')((_key,_ttl,fn)=>fn(),url=>{
      urls.push(url);
      return url.includes('/warning') ? Promise.reject(new Error('fixture outage')) : Promise.resolve([]);
    },normalizeMetWeather);
  assert.equal((await load()).status,'unavailable');
  assert.ok(urls.some(url=>url.includes('contains=Kuching@location__location_name')));
});
