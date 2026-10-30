import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stateEquals } from "@cubistry/cube-core";
import {
  matchesTarget,
  serializeMove,
  validatePresentation,
} from "@cubistry/cube-mechanics";
import {
  ClockMoveStatistics,
  countClockMoves,
  formatMean,
} from "../src/apps/clock/statistics.ts";
import { LiveClockScheduler } from "../src/apps/clock/scheduler.ts";
import { countCalendarMoves } from "../src/apps/calendar/controller.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";

const design = validateHsmDesign(
  JSON.parse(readFileSync("public/hsm-counter.v2.json")),
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const assets = async (manifest) => ({
  manifest,
  images: new Map(),
  materials: new Map(),
  textureOrigin: "bottom-left",
  dispose() {},
});
const utc = (epoch) => {
  const d = new Date(epoch);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
};
const progress = (sessionTotal, status) => ({
  sessionTotal,
  completed: 0,
  total: 0,
  target: null,
  queuedTarget: null,
  status,
});
/** A physical view whose turns commit only when the test releases them. */
function gate() {
  const pending = [],
    committed = [];
  let print, pose;
  return {
    pending,
    committed,
    configure(p, state) {
      print = p;
      pose = state;
    },
    resetCamera() {},
    animate(p) {
      validatePresentation(p, print);
      assert.ok(stateEquals(p.from, pose));
      return new Promise((resolve) =>
        pending.push(() => {
          pose = p.to;
          committed.push(p);
          resolve();
        }),
      );
    },
    async step() {
      assert.equal(pending.length, 1);
      pending.shift()();
      await flush();
    },
    async finish(c) {
      for (let i = 0; c.busy && i < 200; i++) await this.step();
      assert.equal(c.busy, false);
      assert.notEqual(c.progress.status, "failed");
    },
  };
}
async function clockUnits(stats, values, durations = [500, 250, 100]) {
  const units = [],
    gates = [];
  for (let i = 0; i < 3; i++) {
    const g = gate(),
      c = new HsmController(
        g,
        design,
        {},
        ["H", "M", "S"][i],
        (value, busy, error, p) => {
          assert.equal(error, undefined);
          if (p) stats.observe(i, p);
        },
        assets,
      );
    c.setMode(i === 0 ? 23 : 59, 1);
    await c.configure(values[i]);
    gates.push(g);
    units.push({ controller: c, duration: durations[i], setDuration() {} });
  }
  return { units, gates };
}

test("clock moves use the calendar HTM convention: a half turn counts once", () => {
  const moves = [
    { face: "R", turns: 2 },
    { face: "U", turns: -1 },
    { face: "F", turns: 1 },
  ];
  assert.deepEqual(countClockMoves(moves), { htm: 3, rotations: 0 });
  assert.deepEqual(
    countClockMoves(moves),
    countCalendarMoves(moves.map(serializeMove).join(" ")),
  );
  assert.deepEqual(countClockMoves([{ face: "D", turns: 2 }]), {
    htm: 1,
    rotations: 0,
  });
  assert.deepEqual(countClockMoves([]), { htm: 0, rotations: 0 });
});

test("whole-cube rotations stay separate from HTM and from tick costs", () => {
  const s = new ClockMoveStatistics();
  s.commit(2, { htm: 2, rotations: 1 });
  s.settle(2);
  s.closeTick();
  const snap = s.snapshot();
  assert.deepEqual(snap.units[2].session, { htm: 2, rotations: 1 });
  assert.equal(snap.units[2].last, 2);
  assert.deepEqual(snap.total.session, { htm: 2, rotations: 1 });
  assert.equal(snap.total.last, 2);
  assert.throws(() => s.commit(2, { htm: -1, rotations: 0 }));
  assert.throws(() => s.commit(3, { htm: 1, rotations: 0 }));
  assert.throws(() => s.settle(-1));
});

test("progress notifications count each committed move once and settle only after motion", () => {
  const s = new ClockMoveStatistics();
  s.observe(2, progress(0, "idle"));
  s.observe(2, progress(0, "playing"));
  s.observe(2, progress(1, "playing"));
  s.observe(2, progress(2, "playing"));
  // Planned totals and repeated notifications never add moves.
  s.observe(2, progress(2, "playing"));
  assert.equal(s.snapshot().units[2].session.htm, 2);
  assert.equal(s.snapshot().units[2].last, null);
  s.observe(2, progress(2, "completed"));
  s.observe(2, progress(2, "completed"));
  // A no-op request on a settled cube is not a display change.
  s.observe(2, progress(2, "completed"));
  s.closeTick();
  let snap = s.snapshot();
  assert.equal(snap.units[2].session.htm, 2);
  assert.equal(snap.units[2].changes, 1);
  assert.equal(snap.units[2].last, 2);
  assert.equal(snap.total.changes, 1);
  // A controller reinstall resets its own total; the clock session only rebases.
  s.observe(2, progress(0, "idle"));
  s.observe(2, progress(1, "playing"));
  snap = s.snapshot();
  assert.equal(snap.units[2].session.htm, 3);
  // A failed route is not a completed display change.
  s.observe(2, progress(1, "failed"));
  s.closeTick();
  assert.equal(s.snapshot().units[2].changes, 1);
});

test("a tick without moves keeps earlier costs, and a zero-move change costs zero", () => {
  const s = new ClockMoveStatistics();
  s.commit(1, { htm: 4, rotations: 0 });
  s.settle(1);
  s.commit(2, { htm: 5, rotations: 0 });
  s.settle(2);
  s.closeTick();
  const before = s.snapshot();
  s.closeTick();
  assert.equal(s.snapshot().revision, before.revision);
  assert.deepEqual(s.snapshot(), before);
  assert.equal(before.total.last, 9);
  s.commit(2, { htm: 3, rotations: 0 });
  s.settle(2);
  s.closeTick();
  let snap = s.snapshot();
  assert.equal(snap.units[1].last, 4, "minutes did not change on this tick");
  assert.equal(snap.units[2].last, 3);
  assert.equal(snap.total.last, 3);
  assert.equal(snap.total.max, 9);
  assert.equal(snap.units[2].max, 5);
  s.settle(2);
  s.closeTick();
  snap = s.snapshot();
  assert.equal(snap.units[2].last, 0);
  assert.equal(snap.total.last, 0);
  assert.equal(snap.total.max, 9);
  assert.equal(snap.total.changes, 3);
});

test("reset zeros the session and drops moves of a change already in flight", () => {
  const s = new ClockMoveStatistics();
  s.commit(0, { htm: 6, rotations: 0 });
  s.settle(0);
  s.closeTick();
  s.commit(2, { htm: 2, rotations: 0 });
  const revision = s.snapshot().revision;
  s.reset();
  let snap = s.snapshot();
  assert.ok(snap.revision > revision);
  for (const unit of [...snap.units, snap.total]) {
    assert.deepEqual(unit.session, { htm: 0, rotations: 0 });
    assert.equal(unit.last, null);
    assert.equal(unit.max, null);
    assert.equal(unit.changes, 0);
    assert.equal(unit.mean, null);
  }
  s.commit(2, { htm: 1, rotations: 0 });
  s.settle(2);
  s.closeTick();
  snap = s.snapshot();
  assert.equal(snap.units[2].last, 1);
  assert.equal(snap.total.session.htm, 1);
  assert.ok(snap.total.last <= snap.total.session.htm);
});

test("an interrupted live route counts only the turns that were physically played", async () => {
  const stats = new ClockMoveStatistics(),
    { units, gates } = await clockUnits(stats, [12, 34, 59]);
  const scheduler = new LiveClockScheduler(utc),
    boundary = Date.UTC(2026, 0, 1, 12, 35, 0),
    c = units[2].controller,
    g = gates[2];
  scheduler.tick(boundary - 50, 0, units);
  assert.equal(c.progress.target, 0);
  const planned = c.progress.total;
  assert.ok(planned > 1);
  await g.step();
  stats.closeTick();
  let snap = stats.snapshot();
  assert.equal(snap.units[2].session.htm, 1);
  assert.equal(snap.units[2].last, null, "an unfinished change has no cost");
  assert.equal(snap.total.last, null);
  // A suspended tab returns 31 s later: the stale route is superseded.
  scheduler.tick(boundary + 31000, 31050, units);
  assert.equal(c.progress.queuedTarget, 31);
  await g.step();
  assert.equal(c.progress.target, 31);
  for (let i = 0; i < 3; i++) await gates[i].finish(units[i].controller);
  stats.closeTick();
  snap = stats.snapshot();
  assert.ok(matchesTarget(design.print, c.state, hsmTarget("S", 31)));
  assert.equal(snap.units[2].session.htm, g.committed.length);
  assert.equal(snap.units[2].last, g.committed.length);
  assert.equal(snap.units[2].changes, 1, "the superseded target never settled");
  for (let i = 0; i < 3; i++)
    assert.equal(snap.units[i].session.htm, gates[i].committed.length);
  assert.equal(
    snap.total.session.htm,
    gates.reduce((n, g) => n + g.committed.length, 0),
  );
  for (const u of units) u.controller.dispose();
});

test("midnight rollover settles hours, minutes and seconds as one counted tick", async () => {
  const stats = new ClockMoveStatistics(),
    { units, gates } = await clockUnits(stats, [23, 59, 59]);
  const scheduler = new LiveClockScheduler(utc),
    boundary = Date.UTC(2027, 0, 1);
  // Poll when all three wrap routes are launchable. The scheduler rule is
  // unchanged: a route launches inside its nominal budget and only if it fits
  // ten ms per quarter unit. On this print the period wraps are H 5, M 6 and
  // S 3 quarter units; 50 ms before the boundary the minutes route (60 ms) no
  // longer fits, while 300 ms is the seconds budget (3 x 100 ms) and fits all.
  scheduler.tick(boundary - 300, 0, units);
  assert.ok(units.every((u) => u.controller.busy));
  assert.ok(units.every((u) => u.controller.progress.target === 0));
  for (let i = 0; i < 3; i++) await gates[i].finish(units[i].controller);
  stats.closeTick();
  const snap = stats.snapshot(),
    costs = gates.map((g) => g.committed.length);
  assert.deepEqual(
    units.map((u) => u.controller.currentValue),
    [0, 0, 0],
  );
  assert.ok(costs.every((n) => n > 0));
  assert.deepEqual(
    snap.units.map((u) => u.last),
    costs,
  );
  assert.equal(snap.total.last, costs[0] + costs[1] + costs[2]);
  assert.equal(snap.total.max, snap.total.last);
  assert.equal(snap.total.changes, 1);
  assert.deepEqual(snap.total.session, {
    htm: costs[0] + costs[1] + costs[2],
    rotations: 0,
  });
  for (const u of units) u.controller.dispose();
});

test("the first progress report already carrying a committed move is counted", () => {
  const s = new ClockMoveStatistics();
  s.observe(0, progress(1, "playing"));
  assert.equal(s.snapshot().units[0].session.htm, 1);
  assert.throws(() => s.observe(3, progress(1, "playing")));
});

/** Complete one change of a cube with the given HTM cost. */
const change = (s, index, cost) => {
  if (cost) s.commit(index, { htm: cost, rotations: 0 });
  s.settle(index);
  s.closeTick();
};

test("the average is a dash before the first completed change", () => {
  const s = new ClockMoveStatistics();
  s.commit(2, { htm: 5, rotations: 0 });
  const snap = s.snapshot();
  for (const unit of [...snap.units, snap.total]) assert.equal(unit.mean, null);
  assert.equal(formatMean(null), "—");
});

test("a single change has its cost as the average", () => {
  const s = new ClockMoveStatistics();
  change(s, 2, 7);
  const snap = s.snapshot();
  assert.equal(snap.units[2].mean, 7);
  assert.equal(snap.units[0].mean, null, "a cube without changes has none");
});

test("the average is the exact total cost over completed changes", () => {
  const s = new ClockMoveStatistics();
  for (const cost of [9, 1, 2, 4]) change(s, 2, cost);
  change(s, 1, 3);
  const snap = s.snapshot();
  assert.equal(snap.units[2].mean, 4);
  assert.equal(snap.units[1].mean, 3);
  assert.equal(snap.units[0].mean, null);
});

test("the average is rounded to two decimals only for display", () => {
  const s = new ClockMoveStatistics();
  for (const cost of [1, 0, 0]) change(s, 2, cost);
  const mean = s.snapshot().units[2].mean;
  assert.equal(mean, 1 / 3);
  assert.equal(formatMean(mean), "0.33");
  assert.equal(formatMean(2), "2.00");
  assert.equal(formatMean(2 / 3), "0.67");
  assert.equal(formatMean(1.5), "1.50");
});

test("zero-cost completed changes count, and unsettled moves do not", () => {
  const s = new ClockMoveStatistics();
  change(s, 2, 4);
  change(s, 2, 0);
  assert.equal(s.snapshot().units[2].last, 0);
  assert.equal(s.snapshot().units[2].mean, 2);
  s.closeTick();
  s.commit(2, { htm: 100, rotations: 0 });
  assert.equal(s.snapshot().units[2].mean, 2);
});

test("the grand total row shows no average", () => {
  const s = new ClockMoveStatistics();
  change(s, 2, 3);
  change(s, 1, 5);
  assert.equal(s.snapshot().total.mean, null);
  assert.equal(s.snapshot().total.last, 5);
});

test("a long session needs no per-tick history and stays exact", () => {
  const s = new ClockMoveStatistics();
  const n = 100000;
  for (let i = 0; i < n; i++) change(s, 2, i % 5);
  assert.equal(s.snapshot().units[2].mean, 2);
  assert.equal(s.snapshot().units[2].changes, n);
});

test("reset clears the average", () => {
  const s = new ClockMoveStatistics();
  change(s, 2, 3);
  change(s, 1, 8);
  s.reset();
  assert.equal(s.snapshot().units[2].mean, null);
  change(s, 2, 2);
  assert.equal(s.snapshot().units[2].mean, 2, "earlier changes no longer count");
});

test("midnight rollover gives each cube its change cost as the average", async () => {
  const stats = new ClockMoveStatistics(),
    { units, gates } = await clockUnits(stats, [23, 59, 59]);
  const scheduler = new LiveClockScheduler(utc);
  scheduler.tick(Date.UTC(2027, 0, 1) - 300, 0, units);
  for (let i = 0; i < 3; i++) await gates[i].finish(units[i].controller);
  stats.closeTick();
  const snap = stats.snapshot();
  snap.units.forEach((u, i) => assert.equal(u.mean, gates[i].committed.length));
  assert.equal(snap.total.mean, null);
  for (const u of units) u.controller.dispose();
});
