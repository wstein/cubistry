import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseAlg} from '@cubistry/cube-mechanics';
import {routeTurnTiming} from '../src/apps/shared/turn-timing.ts';
import {stateEquals} from '@cubistry/cube-core';
import {validateTimerRoute,validateFiveSecondRoute,timerStep} from '../src/apps/timer/design.ts';
import {planSequence} from '../src/apps/timer/scheduler.ts';
import {timerMotion} from './helpers/timer-motion.mjs';
const routes=[validateTimerRoute(JSON.parse(readFileSync('public/workshop-timer.v1.json'))),validateFiveSecondRoute(JSON.parse(readFileSync('public/five-second-timer.v1.json')))];
test('actual Timer routes move contiguously after the first reserve, preserving fast HTM preferences through the deadline',async()=>{
 for(const route of routes)for(const [from,target] of [[90,89],[89,90]])for(const preferred of [10,250,2000]){
  const count=timerStep(route,route.states[from],from,target).length,deadline=route.profile.stepSeconds*1000;
  const plan=planSequence(count,preferred,route.profile.stepSeconds*1000),dispatch=deadline-plan.duration;
  const h=await timerMotion(route,from,plan.effective,dispatch),before=JSON.stringify(route.print);
  h.controller.prepare(target);h.controller.setDeadline(target,deadline,plan.effective);h.controller.request(target);
  for(let i=0;i<count;i++){
   const row=h.rows.at(-1),start=deadline-(count-i)*plan.effective,end=deadline-(count-i-1)*plan.effective;
   if(i===0){await h.advance(start-.001);assert.equal(row.samples.at(-1).progress,0);}
   else assert.equal(row.calledAt,h.rows[i-1].completeAt);
   await h.advance(start);assert(row.samples.at(-1).progress<1e-7);
   await h.advance(start+plan.effective/4);const observed=row.samples.at(-1);
   assert(Math.abs(observed.progress-.25)<1e-7,'production interpolation must advance immediately after this boundary');
   row.observedStart=observed.at-observed.progress*plan.effective;
   await h.advance(start+plan.effective/2);assert(Math.abs(row.samples.at(-1).progress-.5)<1e-7);
   await h.advance(end);assert.equal(row.completeAt,end);
  }
  assert.equal(h.controller.busy,false);assert.equal(h.controller.progress.sessionTotal,count);assert(stateEquals(h.controller.state,route.states[target]));assert.equal(JSON.stringify(route.print),before);
  const gaps=h.rows.slice(1).map((row,i)=>row.observedStart-h.rows[i].completeAt);
  assert(gaps.every(g=>Math.abs(g)<1e-7),`preference${preferred}: interior waits ${JSON.stringify(gaps)}`);
  assert(Math.abs(h.rows[0].observedStart-dispatch-(75*count+8))<1e-7);
  assert.equal(h.rows.at(-1).completeAt,deadline);
  for(const row of h.rows){assert.equal(typeof row.source,'function');assert.equal(row.source().durationMs,plan.effective);assert.equal(row.samples.filter(s=>s.progress===1).length,1);
   assert(row.samples.some(s=>Math.abs(s.progress-.5)<1e-7));}
 }
});

test('mixed quarter/half Timer routes retain equal HTM durations while HSM default angular weighting stays 2:1',async()=>{
 for(const route of routes){const index=route.increments.findIndex(word=>word.some(m=>Math.abs(m.turns)===1)&&word.some(m=>m.turns===2));assert(index>=0);
  const h=await timerMotion(route,index,250,0),moves=h.controller.prepare(index+1);h.controller.setDeadline(index+1,10000,250);h.controller.request(index+1);
  for(let i=0;i<moves.length;i++)await h.finishRow();
  assert(h.rows.some(r=>r.event.move.turns===2)&&h.rows.some(r=>Math.abs(r.event.move.turns)===1));
  assert(h.rows.every(r=>r.source().durationMs===250&&r.source().lateDurationMs===10));assert(stateEquals(h.controller.state,route.states[index+1]));
 }
 const moves=parseAlg("R U2 R'");assert.deepEqual(moves.map((_m,i)=>routeTurnTiming(moves,i,10000,250,1).durationMs),[250,500,250]);
 assert.deepEqual(moves.map((_m,i)=>routeTurnTiming(moves,i,10000,250,1,'htm').durationMs),[250,250,250]);
});
test('nonfinal timing attaches live, explicit revisions stay monotone, clearing releases current motion and queued targets cannot lend stale callbacks a deadline',async()=>{
 const route=routes[0],h=await timerMotion(route,90,250,0);h.controller.request(89);
 const first=h.rows[0];assert.equal(first.source(),null);await h.advance(125);assert.equal(first.samples.at(-1).progress,.5);
 h.controller.setDeadline(89,2000,250);const revision=first.source().revision;h.controller.setDeadline(89,2000,250);assert.equal(first.source().revision,revision);
 await h.advance(150);assert.equal(first.samples.at(-1).progress,.5);const firstTimer=[...h.timers.values()][0].cb;
 await h.advance(1437.5);assert.equal(first.samples.at(-1).progress,.75);await h.advance(1500);assert.equal(first.completeAt,1500);
 const second=h.rows[1],secondTimer=[...h.timers.values()][0].cb;h.controller.clearDeadline();assert.equal(second.source(),null);
 await h.advance(1510);await h.advance(1635);assert.equal(second.samples.at(-1).progress,.5);firstTimer();secondTimer();assert.equal(second.samples.at(-1).progress,.5);
 await h.advance(1760);assert.equal(second.completeAt,1760);const third=h.rows[2];
 h.controller.setDeadline(89,3000,100);assert(third.source().revision>revision);await h.advance(1800);assert.equal(third.samples.at(-1).progress,0);
 h.controller.setDeadline(88,4000,100);h.controller.request(88);assert.equal(third.source(),null);assert.equal(first.source(),null);
 await h.advance(1810);await h.advance(1935);assert.equal(third.samples.at(-1).progress,.5);await h.advance(2060);
 for(let i=0;h.controller.busy&&i<50;i++)await h.finishRow();
 assert.equal(h.controller.busy,false);assert(stateEquals(h.controller.state,route.states[88]));assert.equal(h.controller.progress.sessionTotal,h.rows.length);
 for(const row of h.rows){assert(row.samples.every((s,i)=>!i||s.progress>=row.samples[i-1].progress));assert.equal(row.samples.filter(s=>s.progress===1).length,1);}
});
test('expired windows play each previously unplayed HTM incrementally, including half turns',async()=>{
 const route=routes[0],h=await timerMotion(route,90,250,0);h.controller.setDeadline(89,-1,250);h.controller.request(89);
 const count=h.controller.progress.total;
 for(let i=0;i<count;i++){const row=h.rows[i],before=h.controller.state;assert.equal(row.samples.at(-1).progress,0);
  await h.advance(h.now+5);assert.equal(row.samples.at(-1).progress,.5);assert(stateEquals(h.controller.state,before));
  await h.advance(h.now+5);assert.equal(row.completeAt,(i+1)*10);assert.equal(h.controller.progress.sessionTotal,i+1);}
 assert(stateEquals(h.controller.state,route.states[89]));assert.equal(h.controller.busy,false);
});
test('pause-like clearing and reset requests complete only legal turns then repair the latest full target',async()=>{
 for(const target of [90,0]){
  const route=routes[0],h=await timerMotion(route,90,250,0);h.controller.setDeadline(89,2000,250);h.controller.request(89);
  await h.advance(1375);const active=h.rows[0];assert.equal(active.samples.at(-1).progress,.5);
  h.controller.clearDeadline();h.controller.request(target);assert.equal(active.source(),null);
  await h.advance(1400);assert.equal(active.samples.at(-1).progress,.5);await h.advance(1525);
  for(let i=0;h.controller.busy&&i<100;i++)await h.finishRow();
  assert.equal(h.controller.busy,false);assert(stateEquals(h.controller.state,route.states[target]));assert.equal(h.controller.progress.sessionTotal,h.rows.length);
  for(let i=0;i<h.rows.length;i++){assert.equal(h.rows[i].samples.filter(s=>s.progress===1).length,1);if(i)assert(stateEquals(h.rows[i].event.from,h.rows[i-1].event.to));}
 }
});
