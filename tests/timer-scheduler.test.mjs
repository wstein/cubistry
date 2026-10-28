import test from "node:test";
import assert from "node:assert/strict";
import { TimerScheduler, planSequence } from "../src/apps/timer/scheduler.ts";
import { validateTimerRoute } from "../src/apps/timer/design.ts";
import { readFileSync } from "node:fs";
const route = validateTimerRoute(JSON.parse(readFileSync(new URL("../public/workshop-timer.v1.json", import.meta.url))));
test("adaptive plans reserve real overhead, never slow preference, and explicitly reject impossible half budgets", () => {
  for (const rate of [1,10,20,50,100]) for (const n of [1,3,5,14]) {
    const p = planSequence(n, 2000, 10000/rate);
    if(p.feasible) assert.ok(p.duration <= 5000/rate + 1e-9);
    assert.ok(p.effective >= 10 && p.effective <= 2000);
    assert.equal(planSequence(n,10,10000/rate).effective,10);
  }
  assert.equal(planSequence(5,10,100).feasible,false);
  assert.equal(planSequence(1,10,100).feasible,false); // Conservative measured render reserve.
  assert.equal(planSequence(5,250,10000,20).feasible,false);
});
function mock() {
  const requests = [];
  const c = {state:route.states[90],currentValue:90,busy:false, progress:{target:90,queuedTarget:null,total:5,completed:0},
    prepare(){return Array(5)}, request(value){requests.push(value);this.busy=true;this.progress.target=value;} };
  return {c,requests};
}
const snapshot = (at, deadline=10000, bucket=90) => ({at,bucket,running:true,next:{target:bucket-1,deadline,interval:10000}});
test("scheduler starts before deadline, holds early settled target and pause reconciles actual legal target", () => {
  const s = new TimerScheduler(), {c,requests}=mock();
  let speed;
  s.tick(snapshot(0),c,250,v=>speed=v);
  assert.equal(requests.length,0); assert.equal(speed,250);
  s.tick(snapshot(8700),c,250,v=>speed=v);
  assert.deepEqual(requests,[89]); assert.equal(s.presentationTarget(snapshot(8700)),89);
  c.busy=false;c.currentValue=89;c.state=route.states[89];
  s.tick(snapshot(9900),c,250,()=>{});assert.deepEqual(requests,[89]);
  s.invalidate();s.tick({at:9900,bucket:90,running:false,next:null},c,250,()=>{});
  assert.deepEqual(requests,[89,90]);s.invalidate();
});
test("pending speed/rate changes replan, and an obsolete active target coalesces only latest logical target", () => {
  const s = new TimerScheduler(), {c,requests}=mock();
  s.tick(snapshot(0),c,250,()=>{});
  s.tick(snapshot(6000),c,2000,()=>{});assert.deepEqual(requests,[89]);
  s.tick(snapshot(6100,6200),c,2000,()=>{});assert.equal(s.warning,"Budget infeasible");
  s.tick(snapshot(6300,6400,87),c,2000,()=>{});assert.deepEqual(requests,[89,87]);
  assert.equal(s.warning,"Late");s.invalidate();
});
test("manual and paused settling never invent missed deadlines, while terminal misses stay visible", () => {
  const s = new TimerScheduler(), {c}=mock();
  c.busy=true;c.progress.target=89;
  s.tick({at:100,bucket:89,running:false,next:null},c,250,()=>{});
  assert.equal(s.warning,"");
  s.invalidate();c.busy=false;c.currentValue=90;
  s.tick(snapshot(9000),c,250,()=>{});
  s.tick({at:10001,bucket:89,running:false,next:null},c,250,()=>{});
  assert.equal(s.warning,"Late");
  s.invalidate();
  s.tick({at:10002,bucket:90,running:false,next:null},c,250,()=>{});
  assert.equal(s.warning,"");s.invalidate();
});
test("solver preparation time is included in dispatch and crossed deadlines invalidate stale plans", () => {
  const {c,requests}=mock();
  let fresh = snapshot(8500);
  const s = new TimerScheduler(()=>{},()=>fresh);
  s.tick(snapshot(8000),c,250,()=>{});
  assert.deepEqual(requests,[89]); // Preparation passed the absolute planned start.
  s.invalidate();c.busy=false;requests.length=0;
  fresh=snapshot(10010,20000,89);
  s.tick(snapshot(9900),c,250,()=>{});
  assert.equal(requests.length,0);assert.equal(s.presentationTarget(fresh),null);s.invalidate();
});
test("slowing an active infeasible clock clears an obsolete budget warning", () => {
  const s=new TimerScheduler(),{c}=mock();
  const fast={at:0,bucket:90,running:true,next:{target:89,deadline:100,interval:100}};
  s.tick(fast,c,250,()=>{});assert.equal(s.warning,"Budget infeasible");
  s.tick(snapshot(1),c,250,()=>{});assert.equal(s.warning,"");s.invalidate();
});
test("a changed full prepared source forces preparation again before dispatch", () => {
  const s=new TimerScheduler(),{c}=mock();let preparations=0;
  c.prepare=()=>{preparations++;return Array(5);};
  s.tick(snapshot(0),c,250,()=>{});
  c.state=route.states[20];
  s.tick(snapshot(100),c,250,()=>{});
  assert.equal(preparations,2);s.invalidate();
});
test("Start or Resume during initial manual settling has no late boundary until the clock crosses one", () => {
  const s=new TimerScheduler(),{c}=mock();
  c.busy=true;c.progress.target=90;
  s.tick(snapshot(0),c,250,()=>{});assert.equal(s.warning,"");
  s.tick(snapshot(100),c,250,()=>{});assert.equal(s.warning,"");
  s.tick(snapshot(10000,20000,89),c,250,()=>{});assert.equal(s.warning,"Late");s.invalidate();
});
test("fitting initial manual settlement preserves preferred speed and slow initial paths adapt once", () => {
  for(const preferred of [250,10,2000]) {
    const s=new TimerScheduler(),{c}=mock();c.busy=true;c.progress.target=90;let effective;
    s.tick(snapshot(0),c,preferred,v=>effective=v);
    assert.equal(effective,preferred===2000 ? 923.4 : preferred);
    const first=effective;c.progress.completed=1;
    s.tick(snapshot(100),c,preferred,v=>effective=v);
    assert.equal(effective,first);assert.equal(s.warning,"");s.invalidate();
  }
});
test("terminal deadline misses retain minimum catch-up speed while manual settling keeps preference", () => {
  const s=new TimerScheduler(),{c}=mock();let effective;
  c.busy=true;c.progress.target=90;
  s.tick({at:0,bucket:90,running:false,next:null},c,250,v=>effective=v);
  assert.equal(effective,250);assert.equal(s.warning,"");
  c.busy=false;s.invalidate();s.tick(snapshot(9000),c,2000,v=>effective=v);
  s.tick({at:11000,bucket:89,running:false,next:null},c,2000,v=>effective=v);
  assert.equal(effective,10);assert.equal(s.warning,"Late");s.invalidate();
});
