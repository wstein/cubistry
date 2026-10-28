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
import { matchesTarget } from "@cubistry/cube-mechanics";
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
  c.request(479);
  await settle(c);
  assert.equal(calls, 1);
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
