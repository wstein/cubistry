import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {stateEquals} from '@cubistry/cube-core';
import {validateTimerRoute,validateFiveSecondRoute,timerStep} from '../src/apps/timer/design.ts';
import {planSequence} from '../src/apps/timer/scheduler.ts';
import {timerMotion} from './helpers/timer-motion.mjs';
const routes=[validateTimerRoute(JSON.parse(readFileSync('public/workshop-timer.v1.json'))),validateFiveSecondRoute(JSON.parse(readFileSync('public/five-second-timer.v1.json')))];
test('actual Timer routes move contiguously after the first reserve, preserving fast HTM preferences through the deadline',async()=>{
 for(const route of routes)for(const [from,target] of [[90,89],[89,90]])for(const preferred of [10,250,2000]){
  const count=timerStep(route,route.states[from],from,target).length,deadline=10000;
  const plan=planSequence(count,preferred,10000),dispatch=deadline-plan.duration;
  const h=await timerMotion(route,from,plan.effective,dispatch),before=JSON.stringify(route.print);
  h.controller.prepare(target);h.controller.setDeadline(target,deadline,plan.effective);h.controller.request(target);
  for(let i=0;i<count;i++)await h.finishRow();
  assert.equal(h.controller.busy,false);assert.equal(h.controller.progress.sessionTotal,count);assert(stateEquals(h.controller.state,route.states[target]));assert.equal(JSON.stringify(route.print),before);
  const gaps=h.rows.slice(1).map((row,i)=>row.motionStart-h.rows[i].completeAt);
  assert(gaps.every(g=>Math.abs(g)<1e-7),`preference${preferred}: interior waits ${JSON.stringify(gaps)}`);
  assert(Math.abs(h.rows[0].motionStart-dispatch-(75*count+8))<1e-7);
  assert.equal(h.rows.at(-1).completeAt,deadline);
  for(const row of h.rows){assert.equal(typeof row.source,'function');assert.equal(row.source().durationMs,plan.effective);assert.equal(row.samples.filter(s=>s.progress===1).length,1);
   assert(row.samples.some(s=>Math.abs(s.progress-.5)<1e-7));}
 }
});
