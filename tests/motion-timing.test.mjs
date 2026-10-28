import test from "node:test";
import assert from "node:assert/strict";
import { animateTimedProgress } from "../packages/cube-viewer/src/motion-timing.ts";
function harness(duration=250,endAt=1000) {
  let at=0,id=0,plan={endAt,durationMs:duration,revision:1},fallback=duration;
  const frames=new Map(),timers=new Map(),all=[],samples=[];
  const runtime={now:()=>at,frame(cb){const n=++id;frames.set(n,cb);all.push(cb);return n;},
    cancelFrame(n){frames.delete(n);},timer(cb,delay){const n=++id;timers.set(n,{cb,at:at+delay});all.push(cb);return n;},
    cancelTimer(n){timers.delete(n);}};
  const promise=animateTimedProgress(()=>plan,()=>fallback,p=>samples.push({at,p}),runtime);
  return {samples,promise,all,frames,timers,
    frame(time,actual=time){at=actual;const callbacks=[...frames.values()];frames.clear();for(const cb of callbacks)cb(time);},
    timer(time){at=time;const callbacks=[...timers.entries()].filter(([,v])=>v.at<=at);for(const[n,v]of callbacks){timers.delete(n);v.cb();}},
    revise(time,durationMs=duration){plan={endAt:time,durationMs,revision:(plan?.revision??1)+1};},
    cancel(){plan=null;},fallback(value){fallback=value;},
  };
}
test("final turn holds its start pose, preserves nominal duration and reaches the exact timer endpoint",async()=>{
  const h=harness();h.frame(749);assert.equal(h.samples.at(-1).p,0);
  h.frame(875);assert.equal(h.samples.at(-1).p,.5);
  h.timer(1000);await h.promise;
  assert.deepEqual(h.samples.at(-1),{at:1000,p:1});
  assert.equal(h.samples.filter(s=>s.p===1).length,1);
});
test("10 ms motion remains 10 ms rather than stretching across a render reserve",async()=>{
  const h=harness(10);h.frame(989);assert.equal(h.samples.at(-1).p,0);
  h.frame(995);assert.equal(h.samples.at(-1).p,.5);h.timer(1000);await h.promise;
  assert.equal(h.samples.at(-1).at,1000);
});
for(const first of ["frame","timer"]) test(`RAF/timer race finishes once when ${first} runs first`,async()=>{
  const h=harness();h.frame(875);const stale=[...h.all];
  h[first](1000);h[first==="frame"?"timer":"frame"](1000);
  for(const cb of stale)cb(1000);
  await h.promise;assert.equal(h.samples.filter(s=>s.p===1).length,1);
  assert.equal(h.frames.size,0);assert.equal(h.timers.size,0);
});
test("rate extension rebases remaining motion without reversing angle or honoring a stale timer",async()=>{
  const h=harness();h.frame(875);const stale=[...h.timers.values()][0].cb;
  h.revise(2000);h.frame(900);assert.equal(h.samples.at(-1).p,.5);
  h.timer(1000);stale();assert.equal(h.samples.at(-1).p,.5);
  h.frame(1937.5);assert.equal(h.samples.at(-1).p,.75);h.timer(2000);await h.promise;
  assert.ok(h.samples.every((s,i)=>i===0||s.p>=h.samples[i-1].p));
});
test("pause/reset releases an unstarted hold without crediting waiting time as rotation",async()=>{
  const h=harness();h.frame(700);h.cancel();h.frame(800);
  assert.equal(h.samples.at(-1).p,0);assert.equal(h.timers.size,0);
  h.frame(925);assert.equal(h.samples.at(-1).p,.5);h.frame(1050);await h.promise;
});
test("canceling an active curve continues forward at the live normal speed",async()=>{
  const h=harness();h.frame(875);h.cancel();h.frame(900);assert.equal(h.samples.at(-1).p,.5);
  h.fallback(100);h.frame(950);await h.promise;assert.equal(h.samples.at(-1).p,1);
});
test("an expired or subminimum endpoint falls back to a legal 10 ms incremental turn",async()=>{
  for(const endAt of [-1,5]) {
    const h=harness(250,endAt);assert.equal(h.samples.at(-1).p,0);
    assert.equal(h.timers.size,0);h.frame(5);assert.equal(h.samples.at(-1).p,.5);
    h.frame(10);await h.promise;assert.equal(h.samples.at(-1).p,1);
  }
});
test("a rounded zero-length remaining window still finishes with finite monotonic progress",async()=>{
  const h=harness();h.frame(999.9999999999999);
  assert.ok(h.samples.at(-1).p>.99999999);
  h.revise(1e9);h.frame(1000);h.timer(1e9);await h.promise;
  assert.equal(h.samples.at(-1).p,1);assert.ok(h.samples.every(s=>Number.isFinite(s.p)));
});
test("a missed clock half turn retains twice the quarter-turn incremental duration",async()=>{
  async function sample(durationMs){let at=0,callback;const samples=[];
    const runtime={now:()=>at,frame(cb){callback=cb;return 1;},cancelFrame(){},timer(){throw Error('Expired timing must not install a timer');},cancelTimer(){}};
    const promise=animateTimedProgress(()=>({endAt:-1,durationMs:100,lateDurationMs:durationMs,revision:1}),()=>100,p=>samples.push(p),runtime);
    at=10;callback(10);const halfway=samples.at(-1);at=20;callback(20);await promise;return halfway;
  }
  assert.equal(await sample(10),1);assert.equal(await sample(20),.5);
});
test("a late RAF callback uses actual monotonic time instead of holding on a stale frame timestamp",async()=>{
  const h=harness(200,200);
  h.frame(0,100);assert.equal(h.samples.at(-1).p,.5);
  h.frame(100,200);await h.promise;assert.equal(h.samples.at(-1).p,1);
});
