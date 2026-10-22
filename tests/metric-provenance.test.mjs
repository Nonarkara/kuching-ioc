import test from 'node:test';
import assert from 'node:assert/strict';
import { nrebObservationTime, nrebFreshness } from '../public/evidence.js';
import { measureMetricEvidence } from '../public/measurement.js';
import { portableFailures, REQUIRED_WIDTHS } from '../scripts/spatial/check-portable.mjs';
import { withDeadline, releaseBrowser } from '../scripts/spatial/deadline.mjs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

test('NREB age is observation age in MYT, never the more recent retrieval age',()=>{
  const r={takenAt:'22 October 2026, Thursday 8:00 P.M.',fetchedAt:'2026-10-22T13:57:51.247Z'};
  const at=Date.parse('2026-10-22T14:00:00Z');
  assert.equal(nrebObservationTime(r.takenAt),Date.parse('2026-10-22T12:00:00Z'));
  assert.equal(nrebFreshness(r,at).label,'Obs 2h');
  assert.match(nrebFreshness(r,at).title,/8:00 P.M./);
  assert.equal(nrebFreshness({...r,fetchedAt:'2099-01-01'},at).label,'Obs 2h');
  assert.equal(nrebFreshness(r,at,'ms').label,'Cer 2j');
  assert.equal(nrebFreshness(r,at,'zh').label,'观测 2时');
});
test('NREB dates validate midnight, noon, impossible dates, unknown and future observations',()=>{
  assert.equal(nrebObservationTime('22 October 2026, Thursday 12:00 A.M.'),Date.parse('2026-10-21T16:00:00Z'));
  assert.equal(nrebObservationTime('22 October 2026, Thursday 12:00 P.M.'),Date.parse('2026-10-22T04:00:00Z'));
  for(const v of [null,'unknown','2026-02-31T20:00:00+08:00','31 February 2026, Tuesday 8:00 P.M.','22 October 2026, Thursday 13:00 P.M.'])assert.equal(nrebObservationTime(v),null);
  assert.equal(nrebFreshness({fetchedAt:'2026-10-22T13:00:00Z'},Date.now()).label,'Obs ?');
  const future=nrebFreshness({takenAt:'22 October 2026, Thursday 8:00 P.M.'},Date.parse('2026-10-22T10:00:00Z'));
  assert.equal(future.label,'Obs ?');assert.match(future.title,/Future timestamp/);
});

test('rendered probe catches a positioned button over glyphs, and respects visible clipping',()=>{
  let button={left:8,right:32,top:10,bottom:34};
  const fresh={getBoundingClientRect:()=>({left:0,right:60,top:20,bottom:35}),scrollWidth:60,clientWidth:60};
  const card={dataset:{metricId:'nreb-api'},querySelector:s=>s.includes('open')?{getBoundingClientRect:()=>button}:fresh};
  const d={querySelectorAll:()=>[card],createRange:()=>({selectNodeContents(){},getClientRects:()=>[{left:0,right:50,top:20,bottom:35}]})};
  assert.ok(measureMetricEvidence(d)[0].overlap>0);
  button={left:65,right:89,top:10,bottom:34};assert.equal(measureMetricEvidence(d)[0].overlap,0);
  fresh.scrollWidth=128;assert.equal(measureMetricEvidence(d)[0].freshnessClip,68);
  button={left:0,right:0,top:0,bottom:0};assert.equal(measureMetricEvidence(d)[0].missing,true);
});

test('portable gate rejects hidden-by-control and raw-timestamp mutations without a baseline exemption',()=>{
  const rows=REQUIRED_WIDTHS.map(w=>({route:'/',w,board:{state:'ready',metrics:4,brief:3,funnel:5,map:true,metricEvidence:Array.from({length:4},(_,i)=>({id:i?'other':'nreb-api',overlap:0,freshnessClip:0}))},findings:[]}));
  assert.deepEqual(portableFailures({measurements:rows}),[]);
  rows[0].board.metricEvidence[0].overlap=90;assert.ok(portableFailures({measurements:rows}).length);
  rows[0].board.metricEvidence[0].overlap=0;rows[0].board.metricEvidence[0].freshnessClip=122;assert.ok(portableFailures({measurements:rows}).length);
  delete rows[0].board.metricEvidence;assert.ok(portableFailures({measurements:rows}).length);
});

test('spatial watchdog returns timeout, propagates errors and does not hold a successful CLI open',async()=>{
  assert.equal(await withDeadline(new Promise(()=>{}),5,'timeout'),'timeout');
  await assert.rejects(withDeadline(Promise.reject(new Error('failed')),1000,'timeout'),/failed/);
  const url=new URL('../scripts/spatial/deadline.mjs',import.meta.url).href;
  const {stdout}=await promisify(execFile)(process.execPath,['--input-type=module','-e',`import {withDeadline} from ${JSON.stringify(url)}; console.log(await withDeadline(Promise.resolve('done'),45000,'timeout'));`],{timeout:15000});
  assert.equal(stdout.trim(),'done');
});

test('audit browser teardown closes inherited output pipes as well as the parent',()=>{
  const calls=[];
  releaseBrowser({kill:signal=>calls.push(signal),stdout:{destroy:()=>calls.push('stdout')},stderr:{destroy:()=>calls.push('stderr')},unref:()=>calls.push('unref')});
  assert.deepEqual(calls,['SIGKILL','stdout','stderr','unref']);
});
