import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { localityEvidence, waterEvidence, readingAge, dictionaryArtifact, FUNNEL, EVIDENCE_COPY } from '../public/evidence.js';
import { measurementClock, boardContentReady } from '../public/measurement.js';
import { portableFailures, REQUIRED_WIDTHS } from '../scripts/spatial/check-portable.mjs';

const at = Date.parse('2026-10-23T02:00:00Z');
const place = { code: 'A001', name: 'PANGKALAN EMPAT', wardCode: 'A', constituency: { raw: 'N.19 Mambong' } };
test('directory join preserves unknowns and combined wards; never creates geometry', () => {
  const data = JSON.parse(fs.readFileSync(new URL('../data/localities.json', import.meta.url)));
  assert.equal(data.items.length, 525);
  assert.equal(data.items.filter(x => !x.wardCode).length, 11);
  for (const item of data.items) {
    const e = localityEvidence(item, {}, at);
    assert.equal(e.location, null);
    assert.equal(e.ward, item.wardCode || null);
    assert.equal(e.history, null);
  }
  for (const ward of ['FG','JL','NPQ']) assert.equal(localityEvidence({...place, wardCode:ward}).ward, ward);
});
test('news mentions require full normalized name boundaries and are not events', () => {
  const p = { news:{items:[{title:'Flood in Padawan'}, {title:'Pangkalan Empat drainage check',source:'Press'}, {title:'Pangkalan Empatan rain'}]} };
  const e = localityEvidence(place,p,at);
  assert.equal(e.news.length,1);
  assert.equal(e.news[0].source,'Press');
  assert.equal(e.reportStatus,'not-connected');
  assert.equal(localityEvidence({...place,name:'PADAWAN, JLN PUNCAK BORNEO'},p).news.length,0);
});
test('water evidence retains zero, rejects invalid values, and never substitutes selected gauge', () => {
  const p={infobanjir:{stations:[{id:'g',name:'Gauge',waterLevelM:0,observedAt:'23-10-2026 10:00',focus:'padawan',thresholds:{alert:2}}]}};
  assert.equal(waterEvidence(p,'g',at).level,0);
  assert.equal(waterEvidence(p,'g',at).relation,'station-only');
  assert.equal(waterEvidence(p,'missing',at),null);
  for (const n of [null,NaN,Infinity,'2']) {p.infobanjir.stations[0].waterLevelM=n;assert.equal(waterEvidence(p,'g',at).level,null);}
});
test('observation age uses Malaysian time, not payload retrieval time',()=>{
  assert.equal(readingAge('23-10-2026 10:00',at).minutes,0);
  assert.equal(readingAge('22-10-2026 10:00',at).status,'review');
  assert.equal(readingAge('24-10-2026 10:00',at).status,'future');
  assert.equal(readingAge('invalid',at).status,'unknown');
});
test('satellite imagery and live gauges cannot green a missing derived artifact',()=>{
  const p={sources:[{id:'nasa-gibs',status:'live'},{id:'did-ihydro',status:'live'}]};
  assert.equal(dictionaryArtifact(p,'growth',at).status,'offline');
  assert.equal(dictionaryArtifact(p,'timesfm',at).status,'offline');
  p.forecast={series:{rain:{median:[1,2]}},asOf:'2020-01-01T00:00:00Z'};
  assert.equal(dictionaryArtifact(p,'timesfm',at).status,'reference');
  p.alphaEarth={status:'ready',image:'change.png',years:{a:2017,b:2024}};
  assert.equal(dictionaryArtifact(p,'growth',at).status,'reference');
  p.forecast={status:'offline',series:{},asOf:new Date(at).toISOString()};
  assert.equal(dictionaryArtifact(p,'timesfm',at).status,'offline');
  p.floodAction={status:'live'};p.floodForecast={status:'fallback'};
  assert.equal(dictionaryArtifact(p,'floodforecast',at).status,'offline');
  p.floodForecast={status:'live',updatedAt:'2020-01-01T00:00:00Z',forecast:[{dischargeCms:0}]};
  assert.equal(dictionaryArtifact(p,'floodforecast',at).status,'reference');
  p.floodForecast.updatedAt=new Date(at).toISOString();
  assert.equal(dictionaryArtifact(p,'floodforecast',at).status,'live');
  p.nrebApi={status:'ready',kuching:{api:72},takenAt:'22 October 2026'};
  assert.match(dictionaryArtifact(p,'aqi',at).name,/NREB/);
  assert.equal(dictionaryArtifact(p,'aqi',at).status,'reference');
  delete p.nrebApi;
  assert.equal(dictionaryArtifact(p,'aqi',at).status,'offline');
});
test('funnel and evidence controls have complete trilingual content',()=>{
  assert.equal(FUNNEL.length,5);
  for(const l of ['en','ms','zh']){
    for(const x of Object.values(EVIDENCE_COPY))assert.ok(x[l]?.trim());
    for(const x of FUNNEL)assert.ok(x.title[l]&&x.body[l]);
  }
});
test('measurement clock is local and preserves real instrument time',()=>{
  const Original=globalThis.Date, RealNow=Original.now();
  const Clock=measurementClock('2026-10-23T00:00:00Z',true);
  assert.equal(Clock.now(),Date.parse('2026-10-23T00:05:00Z'));
  assert.equal(new Clock().getTime(),Clock.now());
  assert.equal(new Clock('2020-01-01').getFullYear(),2020);
  assert.equal(globalThis.Date,Original);
  assert.ok(Date.now()>=RealNow);
  assert.equal(measurementClock('bad',true),Original);
  assert.equal(measurementClock('2026-10-23',false),Original);
});
test('critical content readiness refuses skeletons and absent maps',()=>{
  let rows=[];let map=null;
  const d={querySelectorAll:s=>rows.length ? s.includes('metricBand') ? [1,2,3,4] : s.includes('briefNow') ? [1] : [1,2,3,4,5] : [],querySelector:()=>map};
  assert.equal(boardContentReady(d),false);
  rows=[1];assert.equal(boardContentReady(d),false);
  map={};assert.equal(boardContentReady(d),true);
});
test('actual dictionary reducer fails closed on missing dependencies',()=>{
  const src=fs.readFileSync(new URL('../public/app.js',import.meta.url),'utf8');
  const fn=src.slice(src.indexOf('function dictStatus('),src.indexOf('function renderResearch('));
  const f=vm.runInNewContext(fn+';dictStatus');
  assert.equal(f({sources:[{id:'a',status:'live'}]},['a','missing']).status,'offline');
});
test('portable release floor refuses skeletons, duplicates, errors and overlap',()=>{
  const rows=REQUIRED_WIDTHS.map(w=>({route:'/',w,board:{state:'ready',metrics:6,brief:3,funnel:5,map:true,metricEvidence:Array.from({length:6},(_,i)=>({id:String(i),overlap:0,freshnessClip:0}))},findings:[]}));
  assert.deepEqual(portableFailures({measurements:rows}),[]);
  assert.ok(portableFailures({measurements:[]}).length);
  rows[0].board.metrics=0;assert.ok(portableFailures({measurements:rows}).length);
  delete rows[0].board.metrics;assert.ok(portableFailures({measurements:rows}).length);
  rows[0].board.metrics=6;rows[0].findings=[{kind:'overlap',sel:'button'}];assert.ok(portableFailures({measurements:rows}).length);
});
