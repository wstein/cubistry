import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  WorkshopClock,
  formatTimer,
  formatLiveTimer,
  parseDuration,
} from "../src/apps/timer/clock.ts";
import {
  validateTimerRoute,
  timerTarget,
  timerStep,
} from "../src/apps/timer/design.ts";
import { TimerController } from "../src/apps/timer/controller.ts";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { matchesTarget, applyMoves, parseAlg } from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const raw = JSON.parse(
  readFileSync(new URL("../public/workshop-timer.v1.json", import.meta.url)),
);
const route = validateTimerRoute(raw);
const design = validateCounterDesign(
  JSON.parse(
    readFileSync(new URL("../public/counter-design.v2.json", import.meta.url)),
  ),
);
const settle = async (c) => {
  for (let i = 0; c.busy && i < 300; i++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};
const token = (m) => m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : "");
async function harness(value = 90) {
  let calls = 0;
  const moves = [];
  const c = new TimerController(
    {
      configure() {},
      resetCamera() {},
      async animate(p) {
        moves.push(p.move);
      },
    },
    route,
    design.assets,
    (_v, _b, e) => assert.equal(e, undefined),
    async (manifest) => ({
      manifest,
      images: new Map(),
      materials: new Map(),
      textureOrigin: "bottom-left",
      dispose() {},
    }),
    async (p) => {
      const solver = await prepareTestSolver(p);
      return {
        solve(from, to, options) {
          calls++;
          return solver.solve(from, to, options);
        },
      };
    },
  );
  await c.configure(value);
  return {
    c,
    moves,
    get calls() {
      return calls;
    },
  };
}
test("workshop clock uses absolute monotonic deadlines, ten-second ceiling and frozen pause", () => {
  let now = 500;
  const c = new WorkshopClock(() => now);
  assert.equal(c.bucket, 90);
  c.start();
  now += 9999;
  assert.equal(c.bucket, 90);
  now++;
  assert.equal(c.bucket, 89);
  now += 25432;
  c.pause();
  const frozen = c.remainingMs;
  now += 100000;
  assert.equal(c.remainingMs, frozen);
  c.start();
  now += frozen;
  assert.equal(c.bucket, 0);
  assert.equal(c.elapsed, true);
  c.reset();
  assert.equal(c.bucket, 90);
  assert.equal(c.running, false);
  for (const x of [-10, 3600, 15, NaN]) assert.throws(() => c.configure(x));
  assert.equal(parseDuration("59:50"), 3590);
  assert.equal(formatTimer(90), "15:00");
  for (const x of ["60:00", "15:01", "1:70", "9"])
    assert.throws(() => parseDuration(x));
});
test("all 360 immutable MMSS states and full 1324-HTM route independently preserve canonical poses", async () => {
  const h = await harness(0);
  for (let i = 1; i < 360; i++) {
    h.c.request(i);
    await settle(h.c);
    assert.equal(matchesTarget(route.print, h.c.state, timerTarget(i)), true);
    assert.equal(stateEquals(h.c.state, route.states[i]), true);
  }
  assert.equal(h.moves.length, 1324);
  assert.equal(h.calls, 0);
  assert.equal(Math.max(...route.increments.map((m) => m.length)), 5);
});
test("actual fifteen-minute countdown commits 331 HTM, 90 edges and 91 displays without setup", async () => {
  const h = await harness();
  const start = h.c.state;
  const transitions = [];
  assert.equal(h.c.progress.sessionTotal, 0);
  for (let value = 89; value >= 0; value--) {
    const before = h.moves.length;
    h.c.request(value);
    await settle(h.c);
    transitions.push({
      value,
      word: h.moves.slice(before).map(token).join(" "),
      state: h.c.state,
    });
  }
  assert.equal(transitions.length, 90);
  assert.equal(h.moves.length, 331);
  assert.equal(h.c.progress.sessionTotal, 331);
  assert.equal(stateEquals(h.c.state, route.states[0]), true);
  assert.equal(h.calls, 0);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/workshop-timer-commits.json",
    JSON.stringify({
      kind: "countdown",
      print: route.print,
      start,
      startValue: 90,
      transitions,
    }),
  );
});
test("timer arbitrary/catch-up/reset uses shared solver and full-state-only route eligibility", async () => {
  const h = await harness();
  h.c.request(25);
  await settle(h.c);
  assert.equal(h.calls, 1);
  h.c.request(24);
  await settle(h.c);
  assert.equal(h.calls, 1);
  const altered = applyMoves(h.c.state, parseAlg("B"));
  assert.equal(matchesTarget(route.print, altered, timerTarget(24)), true);
  assert.equal(timerStep(route, altered, 24, 23), null);
  h.c.authoritative = altered;
  h.c.request(23);
  await settle(h.c);
  assert.equal(h.calls, 2);
  h.c.request(90);
  await settle(h.c);
  assert.equal(h.calls, 3);
  assert.ok(h.c.progress.sessionTotal > 0);
});
test("timer route rejects unsupported versions, counterfeit identities and damaged edges", () => {
  for (const mutate of [
    (d) => (d.version = 2),
    (d) => (d.maxSeconds = 3600),
    (d) => (d.printing[0].cubie = false),
    (d) => (d.increments[0] = "R"),
    (d) => (d.printing[0].image = "title-left"),
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateTimerRoute(d));
  }
});

test("one virtual clock supports Stopwatch floor granularity, fractional pause, rate changes and terminal cap", () => {
  let now = 0;
  const c = new WorkshopClock(() => now);
  c.setMode("stopwatch");
  assert.equal(c.bucket, 0);
  c.start();
  now = 9999;
  assert.equal(c.bucket, 0);
  now = 10000;
  assert.equal(c.bucket, 1);
  now = 12500;
  c.pause();
  now = 50000;
  assert.equal(c.valueMs, 12500);
  c.setSpeed(10);
  c.start();
  now += 750;
  assert.equal(c.bucket, 2);
  assert.equal(c.valueMs, 20000);
  c.setSpeed(100);
  now += 40000;
  assert.equal(c.bucket, 359);
  assert.equal(c.elapsed, true);
  assert.equal(c.running, false);
  c.reset();
  assert.equal(c.bucket, 0);
  assert.equal(c.speed, 100);
  c.setMode("countdown");
  assert.equal(c.bucket, 90);
  assert.equal(c.running, false);
  for (const rate of [0, 2, NaN, Infinity])
    assert.throws(() => c.setSpeed(rate));
});
test("accelerated countdown retains an absolute deadline across speed changes without rounding away fractions", () => {
  let now = 0;
  const c = new WorkshopClock(() => now);
  c.configure(60);
  c.start();
  now = 1250;
  c.setSpeed(10);
  assert.equal(c.remainingMs, 58750);
  now += 5000;
  assert.equal(c.remainingMs, 8750);
  c.pause();
  now += 100000;
  assert.equal(c.remainingMs, 8750);
  c.setSpeed(20);
  c.start();
  now += 437.5;
  assert.equal(c.bucket, 0);
  assert.equal(c.elapsed, true);
});

test("rate changes sample the monotonic source once so preemption cannot discard old-rate time", () => {
  let samples = 0;
  const c = new WorkshopClock(() => samples++ * 100);
  c.configure(60);
  c.start();
  const before = samples;
  c.setSpeed(10);
  assert.equal(samples, before + 1);
  assert.equal(c.remainingMs, 58900);
});

test("read-only next boundaries use one monotonic sample in both modes and every rate", () => {
  for (const mode of ["countdown", "stopwatch"]) for (const rate of [1,10,20,50,100]) {
    let now = 100, samples = 0;
    const c = new WorkshopClock(() => { samples++; return now; });
    c.configure(20); c.setMode(mode); c.setSpeed(rate); c.start();
    now += 1250 / rate;
    const before = samples, s = c.snapshot();
    assert.equal(samples, before + 1);
    assert.equal(s.bucket, mode === "countdown" ? 2 : 0);
    assert.equal(s.next.target, 1);
    assert.equal(s.next.deadline, 100 + 10000 / rate);
    assert.equal(s.next.interval, 10000 / rate);
    c.pause(); assert.equal(c.snapshot().next, null);
  }
});

test("prepared exact sequences are cached but invalid hidden sources never reuse them", async () => {
  const h = await harness();
  const moves = h.c.prepare(25);
  assert.equal(h.calls, 1);
  assert.equal(h.c.prepare(25), moves);
  h.c.request(25); await settle(h.c);
  assert.equal(h.calls, 1);
  h.c.prepare(24);
  h.c.authoritative = applyMoves(h.c.state, parseAlg("B"));
  h.c.request(24); await settle(h.c);
  assert.equal(h.calls, 2);
  assert.equal(stateEquals(h.c.state, route.states[24]), true);
});


test("one-second live readout shares the physical clock sample, rounds by direction and retains paused fractions", () => {
  for (const mode of ["countdown", "stopwatch"]) for (const rate of [1,10,20,50,100]) {
    let now=0,samples=0;
    const c=new WorkshopClock(()=>{samples++;return now;});
    c.configure(20);c.setMode(mode);c.setSpeed(rate);c.start();
    now=12500/rate;
    const before=samples,s=c.snapshot();
    assert.equal(samples,before+1);
    assert.equal(s.liveSeconds,mode === "countdown" ? 8 : 12);
    assert.equal(s.bucket,1);
    assert.equal(formatLiveTimer(s.liveSeconds),mode === "countdown" ? "00:08" : "00:12");
    c.pause();now+=100000;assert.equal(c.snapshot().liveSeconds,s.liveSeconds);
    c.start();now+=500/rate;
    assert.equal(c.snapshot().liveSeconds,mode === "countdown" ? 7 : 13);
    now+=4000000/rate;
    assert.equal(c.snapshot().liveSeconds,mode === "countdown" ? 0 : 3590);
    assert.equal(c.snapshot().next,null);
    c.reset();assert.equal(c.snapshot().liveSeconds,mode === "countdown" ? 20 : 0);
  }
  for (const invalid of [-1,3591,0.5,NaN]) assert.throws(()=>formatLiveTimer(invalid));
  assert.equal(formatLiveTimer(3590),"59:50");
});
test("exact ten-second clock boundaries retain next-event and terminal semantics", () => {
  let now=0;
  for(const mode of ["countdown","stopwatch"]) {
    now=0;const c=new WorkshopClock(()=>now);c.configure(20);c.setMode(mode);c.start();
    now=10000;const s=c.snapshot();
    assert.equal(s.bucket,1);assert.equal(s.liveSeconds,10);
    assert.equal(s.next.target,mode === "countdown" ? 0 : 2);assert.equal(s.next.deadline,20000);
    now=4000000;assert.equal(c.snapshot().next,null);
  }
});
