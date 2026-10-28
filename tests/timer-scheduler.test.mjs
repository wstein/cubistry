import test from "node:test";
import assert from "node:assert/strict";
import { TimerScheduler, planSequence } from "../src/apps/timer/scheduler.ts";
import { validateTimerRoute } from "../src/apps/timer/design.ts";
import { readFileSync } from "node:fs";
const route = validateTimerRoute(JSON.parse(readFileSync(new URL("../public/workshop-timer.v1.json", import.meta.url))));
test("adaptive plans reserve real overhead, never slow preference, and explicitly reject impossible half budgets", () => {
  for (const rate of [1,10,20,50,100]) for (const n of [1,3,5]) {
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
