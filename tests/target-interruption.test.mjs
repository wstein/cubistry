import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stateEquals } from "@cubistry/cube-core";
import {
  applyMoves,
  validatePresentation,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { CounterController } from "../src/apps/counter/controller.ts";
import {
  validateCounterDesign,
  targetFor,
} from "../src/apps/counter/design.ts";
import { validateCertifiedCounter } from "../src/apps/counter/certified.ts";
import { TimerController } from "../src/apps/timer/controller.ts";
import {
  validateTimerRoute,
  validateFiveSecondRoute,
  timerTarget,
} from "../src/apps/timer/design.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import { hsmDesignFor } from "../src/apps/hsm/lettering.ts";
import { LiveClockScheduler } from "../src/apps/clock/scheduler.ts";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const json = (path) => JSON.parse(readFileSync(path));
const counterDesign = validateCounterDesign(
  json("public/counter-design.v2.json"),
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const assets = async (manifest) => ({
  manifest,
  images: new Map(),
  materials: new Map(),
  textureOrigin: "bottom-left",
  dispose() {},
});
function gate() {
  const pending = [],
    committed = [];
  let print, pose;
  return {
    pending,
    committed,
    get pose() {
      return pose;
    },
    get print() {
      return print;
    },
    configure(p, state) {
      print = p;
      pose = state;
    },
    resetCamera() {},
    animate(p, timing) {
      validatePresentation(p, print);
      assert.ok(stateEquals(p.from, pose));
      return new Promise((resolve) =>
        pending.push({
          p,
          timing,
          resolve() {
            pose = p.to;
            committed.push(p);
            resolve();
          },
        }),
      );
    },
    async step() {
      assert.equal(pending.length, 1);
      pending.shift().resolve();
      await flush();
    },
    async finish(c) {
      for (let i = 0; c.busy && i < 100; i++) await this.step();
      assert.equal(c.busy, false);
      assert.notEqual(c.progress.status, "failed");
      assert.ok(stateEquals(c.state, pose));
    },
  };
}
function observe(g) {
  const events = [],
    errors = [];
  return {
    events,
    errors,
    changed(value, busy, error, progress) {
      if (error) errors.push(error);
      events.push({ value, busy, progress, commits: g.committed.length });
    },
  };
}
async function supersede(c, g, observed, oldTarget, latest, valid) {
  c.request(oldTarget);
  assert.ok(
    c.progress.total > 1,
    "fixture must have obsolete moves to discard",
  );
  const initialTotal = c.progress.total;
  const first = g.pending[0].p;
  c.request(latest);
  assert.equal(c.progress.queuedTarget, latest);
  assert.equal(g.committed.length, 0, "an unresolved move must not count");
  await g.step();
  assert.equal(g.committed.length, 1);
  assert.ok(stateEquals(c.state, first.to));
  assert.equal(
    c.progress.target,
    latest,
    "replan before the obsolete second move starts",
  );
  assert.equal(c.progress.completed, 0);
  const nextTotal = c.progress.total;
  await g.finish(c);
  assert.deepEqual(observed.errors, []);
  assert.equal(c.currentValue, latest);
  assert.ok(valid(c.state));
  assert.equal(c.progress.sessionTotal, 1 + nextTotal);
  assert.equal(c.progress.completed, nextTotal);
  assert.equal(g.committed.length, 1 + nextTotal);
  assert.ok(
    !observed.events.some(
      (e) => e.value === oldTarget && e.progress.status === "completed",
    ),
    "abandoned target must never be reported completed",
  );
  assert.ok(initialTotal > 1);
}

test("counter padded, unpadded and certified prints interrupt at a committed turn and retain the exact new full goal", async () => {
  const certified = validateCertifiedCounter(
    json("public/counter-certified.v1.json"),
    counterDesign,
  );
  for (const [padded, route] of [
    [true, null],
    [false, null],
    [true, certified],
  ]) {
    const g = gate(),
      observed = observe(g),
      calls = [];
    const c = new CounterController(
      g,
      counterDesign,
      observed.changed,
      assets,
      async (print) => {
        const solver = await prepareTestSolver(print);
        return {
          solve(from, to, options) {
            calls.push({ from, to });
            return solver.solve(from, to, options);
          },
        };
      },
    );
    await c.configure("FIXED ART", padded, 15, route);
    await supersede(c, g, observed, 42, 17, (state) =>
      matchesTarget(g.print, state, targetFor(17, padded)),
    );
    assert.ok(stateEquals(c.state, calls.at(-1).to));
    assert.ok(stateEquals(calls.at(-1).from, g.committed[0].to));
    c.dispose();
  }
});

test("both timer prints solve directly from an interrupted move and returning to the last completed value is not a no-op", async () => {
  const routes = [
    validateTimerRoute(json("public/workshop-timer.v1.json")),
    validateFiveSecondRoute(json("public/five-second-timer.v1.json")),
  ];
  for (const route of routes) {
    const g = gate(),
      observed = observe(g),
      c = new TimerController(
        g,
        route,
        counterDesign.assets,
        observed.changed,
        assets,
        prepareTestSolver,
      );
    await c.configure(90);
    const initial = c.state;
    await supersede(c, g, observed, 25, 90, (state) =>
      matchesTarget(route.print, state, timerTarget(90, route.profile)),
    );
    assert.ok(
      stateEquals(c.state, initial),
      "return must restore every hidden frame",
    );
    assert.equal(
      c.progress.sessionTotal,
      2,
      "one move forward, one inverse, not two complete display routes",
    );
    c.dispose();
  }
});

test("all HSM units in both fixed lettering styles replan from the committed partial pose", async () => {
  const original = validateHsmDesign(json("public/hsm-counter.v2.json"));
  for (const style of ["symbols", "words"])
    for (const letter of ["H", "M", "S"]) {
      const design = hsmDesignFor(original, style),
        g = gate(),
        observed = observe(g);
      const c = new HsmController(
        g,
        design,
        {},
        letter,
        observed.changed,
        assets,
      );
      await c.configure(0);
      await supersede(c, g, observed, 33, 17, (state) =>
        matchesTarget(design.print, state, hsmTarget(letter, 17)),
      );
      assert.deepEqual(
        c.state.cubies.map((p) => p.id).sort(),
        g.committed[0].from.cubies.map((p) => p.id).sort(),
      );
      c.dispose();
    }
});

test("same-target scheduler polling does not restart a route, but a suspended live clock replaces stale seconds at the next move", async () => {
  const design = validateHsmDesign(json("public/hsm-counter.v2.json"));
  const units = [],
    gates = [],
    observers = [];
  for (const [letter, value, duration] of [
    ["H", 12, 500],
    ["M", 34, 250],
    ["S", 59, 100],
  ]) {
    const g = gate(),
      o = observe(g),
      c = new HsmController(g, design, {}, letter, o.changed, assets);
    await c.configure(value);
    gates.push(g);
    observers.push(o);
    units.push({ controller: c, duration, setDuration() {} });
  }
  const read = (epoch) => {
    const d = new Date(epoch);
    return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
  };
  const scheduler = new LiveClockScheduler(read),
    boundary = Date.UTC(2026, 0, 1, 12, 35, 0);
  scheduler.tick(boundary - 50, 0, units);
  const c = units[2].controller,
    g = gates[2],
    first = g.pending[0].p;
  assert.equal(c.progress.target, 0);
  scheduler.tick(boundary - 40, 10, units);
  assert.equal(
    g.pending[0].p,
    first,
    "normal tick must keep the current anticipated move",
  );
  scheduler.tick(boundary + 31000, 31050, units);
  assert.equal(c.progress.queuedTarget, 31);
  await g.step();
  assert.equal(c.progress.target, 31);
  assert.equal(g.committed.length, 1);
  await g.finish(c);
  assert.ok(matchesTarget(design.print, c.state, hsmTarget("S", 31)));
  assert.deepEqual(observers[2].errors, []);
  for (let i = 0; i < units.length; i++) {
    await gates[i].finish(units[i].controller);
    units[i].controller.dispose();
  }
});
