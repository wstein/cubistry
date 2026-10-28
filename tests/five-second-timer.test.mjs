import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import {
  WorkshopClock,
  FIVE_SECOND_TIMER,
  formatTimer,
  parseDuration,
} from "../src/apps/timer/clock.ts";
import {
  validateFiveSecondRoute,
  timerTarget,
  timerStep,
} from "../src/apps/timer/design.ts";
import { TimerController } from "../src/apps/timer/controller.ts";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { stateEquals } from "@cubistry/cube-core";
import { applyMoves, parseAlg, matchesTarget } from "@cubistry/cube-mechanics";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const raw = JSON.parse(readFileSync("public/five-second-timer.v1.json"));
const route = validateFiveSecondRoute(raw);
const design = validateCounterDesign(
  JSON.parse(readFileSync("public/counter-design.v2.json")),
);
const token = (m) => m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : "");
const settle = async (c) => {
  for (let i = 0; c.busy && i < 400; i++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};

test("five-second clock visits every inclusive bucket in both directions at each supported rate", () => {
  for (const speed of [1, 10, 20, 50, 100])
    for (const mode of ["countdown", "stopwatch"]) {
      let now = 0;
      const c = new WorkshopClock(() => now, FIVE_SECOND_TIMER);
      c.configure(2395);
      c.setMode(mode);
      c.setSpeed(speed);
      c.start();
      for (let i = 0; i < 480; i++) {
        now = (i * 5000) / speed;
        assert.equal(c.bucket, mode === "countdown" ? 479 - i : i);
      }
      assert.equal(c.elapsed, true);
      now += 500000;
      assert.equal(c.bucket, mode === "countdown" ? 0 : 479);
      c.reset();
      assert.equal(c.running, false);
      assert.equal(c.bucket, mode === "countdown" ? 479 : 0);
    }
});
test("five-second fractions survive pause/resume/rate changes and unsupported times never round", () => {
  let now = 0;
  const c = new WorkshopClock(() => now, FIVE_SECOND_TIMER);
  assert.equal(c.bucket, 360);
  c.start();
  now = 4999;
  assert.equal(c.bucket, 360);
  c.pause();
  now += 100000;
  assert.equal(c.valueMs, 1795001);
  c.setSpeed(10);
  c.start();
  now += 0.1;
  assert.equal(c.bucket, 359);
  c.setMode("stopwatch");
  c.setSpeed(1);
  c.start();
  now += 4999;
  assert.equal(c.bucket, 0);
  now++;
  assert.equal(c.bucket, 1);
  c.pause();
  now += 10000;
  assert.equal(c.bucket, 1);
  for (const x of ["40:00", "39:56", "00:01", "60:00", "0:60"])
    assert.throws(() => parseDuration(x, FIVE_SECOND_TIMER));
  for (const x of [-5, 2400, 2396, NaN]) assert.throws(() => c.configure(x));
  assert.equal(parseDuration("39:55", FIVE_SECOND_TIMER), 2395);
  assert.equal(formatTimer(479, FIVE_SECOND_TIMER), "39:55");
  assert.throws(() => formatTimer(480, FIVE_SECOND_TIMER));
});
test("optimized fixed print replays all479 forward and reverse controller edges, with independently checkable actual commits", async () => {
  const moves = [];
  let calls = 0;
  const c = new TimerController(
    {
      configure() {},
      resetCamera() {},
      async animate(p) {
        moves.push(p);
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
        solve(...args) {
          calls++;
          return solver.solve(...args);
        },
      };
    },
  );
  await c.configure(0);
  const start = c.state;
  const transitions = [];
  for (const values of [
    Array.from({ length: 479 }, (_, i) => i + 1),
    Array.from({ length: 479 }, (_, i) => 478 - i),
  ])
    for (const value of values) {
      const before = moves.length;
      const prepared = c.prepare(value);
      assert.strictEqual(c.prepare(value), prepared);
      assert.ok(
        stateEquals(applyMoves(c.state, prepared), route.states[value]),
      );
      c.request(value);
      await settle(c);
      assert.ok(stateEquals(c.state, route.states[value]));
      assert.ok(
        matchesTarget(
          route.print,
          c.state,
          timerTarget(value, FIVE_SECOND_TIMER),
        ),
      );
      transitions.push({
        value,
        word: moves
          .slice(before)
          .map((p) => token(p.move))
          .join(" "),
        state: c.state,
      });
    }
  assert.equal(moves.length, 4474);
  assert.equal(c.progress.sessionTotal, 4474);
  assert.equal(calls, 0);
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/five-second-commits.json",
    JSON.stringify({ print: route.print, start, startValue: 0, transitions }),
  );
  for (const invalid of [-1, 480, NaN]) assert.throws(() => c.prepare(invalid));
  const prepared = c.prepare(479);
  assert.strictEqual(c.prepare(479), prepared);
  assert.equal(calls, 1);
  // A visually unchanged front is insufficient for the prepared full-state cache.
  c.authoritative = applyMoves(c.state, parseAlg("B"));
  const revised = c.prepare(479);
  assert.equal(calls, 2);
  assert.ok(stateEquals(applyMoves(c.state, revised), route.states[479]));
  c.request(479);
  await settle(c);
  assert.equal(calls, 2);
  assert.ok(stateEquals(c.state, route.states[479]));
  assert.equal(timerStep(route, c.state, 479, 0), null);
  c.dispose();
});
test("five-second certificate rejects damaged glyphs, edges, identities and counterfeit upper bounds", () => {
  for (const mutate of [
    (d) => (d.maxSeconds = 2400),
    (d) => (d.stepSeconds = 10),
    (d) => (d.printing[0].id = false),
    (d) => (d.printing[0].up = d.printing[0].up.map((n) => -n)),
    (d) => d.increments.pop(),
    (d) => (d.increments[0] = "R"),
    (d) => (d.totalHTM = 2261),
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateFiveSecondRoute(d));
  }
});

test("five-second snapshots preserve exact next deadlines across both directions and every supported rate", () => {
  for (const mode of ["countdown", "stopwatch"])
    for (const speed of [1, 10, 20, 50, 100]) {
      let now = 1200;
      const epoch = now,
        c = new WorkshopClock(() => now, FIVE_SECOND_TIMER);
      c.configure(2395);
      c.setMode(mode);
      c.setSpeed(speed);
      c.start();
      for (let i = 0; i < 479; i++) {
        now = epoch + (i * 5000) / speed;
        const s = c.snapshot();
        assert.equal(s.bucket, mode === "countdown" ? 479 - i : i);
        assert.equal(s.running, true);
        assert.equal(s.next.target, mode === "countdown" ? 478 - i : i + 1);
        assert.ok(Math.abs(s.next.interval - 5000 / speed) < 1e-7);
        assert.ok(
          Math.abs(s.next.deadline - (epoch + ((i + 1) * 5000) / speed)) < 1e-7,
        );
      }
      now = epoch + 2395000 / speed;
      assert.equal(c.snapshot().running, false);
      assert.equal(c.snapshot().next, null);
      assert.equal(c.snapshot().bucket, mode === "countdown" ? 0 : 479);
    }
  let now = 0;
  const c = new WorkshopClock(() => now, FIVE_SECOND_TIMER);
  c.start();
  now = 1250;
  c.pause();
  now = 100000;
  assert.equal(c.snapshot().next, null);
  c.setSpeed(20);
  c.start();
  assert.equal(c.snapshot().next.deadline, 100000 + 3750 / 20);
});

test("five-second scheduler fits six-move normal/adaptive plans into half an interval and reports100x infeasibility", async () => {
  const { TimerScheduler, planSequence } = await import(
    "../src/apps/timer/scheduler.ts"
  );
  for (const preferred of [250, 2000, 10]) {
    const word = timerStep(route, route.states[1], 1, 0);
    assert.equal(word.length, 6);
    const planned = planSequence(word.length, preferred, 5000);
    assert.ok(planned.feasible);
    assert.ok(planned.duration <= 2500);
    assert.ok(planned.effective <= preferred);
    const requests = [],
      s = new TimerScheduler();
    let effective;
    const c = {
      state: route.states[1],
      currentValue: 1,
      busy: false,
      progress: { target: null, queuedTarget: null, total: 0, completed: 0 },
      setDeadline(target, endAt, durationMs) {
        this.timing = { target, endAt, durationMs };
      },
      clearDeadline() {
        this.timing = null;
      },
      prepare(value) {
        return timerStep(route, this.state, this.currentValue, value);
      },
      request(value) {
        requests.push(value);
        this.state = applyMoves(this.state, word);
        this.currentValue = value;
      },
    };
    const snapshot = (at) => ({
      at,
      bucket: 1,
      running: true,
      next: { target: 0, deadline: 5000, interval: 5000 },
    });
    s.tick(snapshot(0), c, preferred, (v) => (effective = v));
    assert.equal(requests.length, 0);
    s.tick(
      snapshot(5000 - planned.duration),
      c,
      preferred,
      (v) => (effective = v),
    );
    assert.deepEqual(requests, [0]);
    assert.equal(c.timing.endAt, 5000);
    assert.equal(c.timing.target, 0);
    assert.ok(stateEquals(c.state, route.states[0]));
    assert.equal(effective, planned.effective);
    s.tick(snapshot(4999), c, preferred, () => {});
    assert.deepEqual(requests, [0]);
    assert.equal(s.warning, "");
    s.invalidate();
  }
  const p = planSequence(6, 250, 50);
  assert.equal(p.feasible, false);
  assert.equal(p.effective, 10);
  const s = new TimerScheduler(),
    c = {
      state: route.states[1],
      currentValue: 1,
      busy: false,
      progress: { target: null, queuedTarget: null, total: 6, completed: 0 },
      setDeadline() {},
      clearDeadline() {},
      prepare() {
        return Array(6);
      },
      request(value) {
        this.busy = true;
        this.progress.target = value;
      },
    };
  s.tick(
    {
      at: 0,
      bucket: 1,
      running: true,
      next: { target: 0, deadline: 50, interval: 50 },
    },
    c,
    250,
    () => {},
  );
  assert.equal(s.warning, "Budget infeasible");
  assert.equal(c.busy, true);
  s.invalidate();
});
