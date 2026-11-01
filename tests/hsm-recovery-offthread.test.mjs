// The recovery search runs in slices that yield to the event loop. These tests
// pin that it returns exactly what the previous synchronous search returned
// (a frozen copy is the oracle), that a retarget cancels a pending search and
// never applies a stale plan, that no slice blocks for long, and that the live
// clock still returns onto the period after a catch-up.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateHsmDesign } from "../src/apps/hsm/design.ts";
import { HsmPlanner } from "../src/apps/hsm/planner.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { HsmPeriods } from "../src/apps/hsm/periods.ts";
import { HsmRecovery, runSync } from "../src/apps/hsm/recovery.ts";
import { HsmRecovery as Reference } from "./fixtures/hsm-recovery-reference.ts";
import { SlicedExecutor } from "../src/apps/hsm/recovery-executor.ts";
import { LiveClockScheduler } from "../src/apps/clock/scheduler.ts";
import { COUNTING_MODES } from "../scripts/derive-hsm-runtime.mjs";
import {
  applyMoves,
  initialState,
  parseAlg,
  validatePresentation,
} from "../packages/cube-mechanics/src/index.ts";
import { stateEquals } from "../packages/cube-core/src/index.ts";

const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const pin = json("hsm-source.json");
const design = validateHsmDesign(json(pin.runtimePath));
const table = json("data/hsm/seconds-first/modes/recovery.json");
const planner = new HsmPlanner();
const periods = new HsmPeriods(design.print, design.periods);
const reference = new Reference(design.print, planner);
const recovery = new HsmRecovery(design.print, planner);
const targetsOf = (letter, maximum, direction) => (v) =>
  periods.nodesShowing(letter, maximum, direction, v);
const flush = () => new Promise((resolve) => setImmediate(resolve));
const word = (w) => JSON.stringify(w);
const view = { configure() {}, animate: async () => {}, resetCamera() {} };
const dispose = async () => ({ dispose() {} });
const assets = async (manifest) => ({
  manifest,
  images: new Map(),
  materials: new Map(),
  textureOrigin: "bottom-left",
  dispose() {},
});

/** Slices of about `budgetMs`; every yield is a microtask so tests stay fast. */
const sliced = (budgetMs = 1) =>
  new SlicedExecutor({ budgetMs, yieldNow: () => Promise.resolve() });
/** Slices that really return to the event loop between each other. */
const realSliced = (budgetMs = 8) =>
  new SlicedExecutor({ budgetMs, yieldNow: flush });
const outcome = async (executor, task) => {
  const result = await executor.start(task).done;
  assert.equal(result.cancelled, false);
  return result.value;
};
/** A deterministic generator for random poses. */
const lcg = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const ALL = parseAlg("R R2 R' L L2 L' U U2 U' D D2 D' F F2 F' B B2 B'");

// ------------------------------------------------------------ equivalence

test("sliced and synchronous plans equal the previous synchronous search for every research sample", async () => {
  const executor = sliced(0.25);
  let samples = 0;
  for (const row of table.modes) {
    const { letter, maximum, direction } = row,
      targets = targetsOf(letter, maximum, direction);
    for (const sample of row.samples) {
      const state = applyMoves(
          initialState(design.print),
          parseAlg(sample.setupFromSolved),
        ),
        args = [state, letter, maximum, direction, sample.fromValue, targets],
        label = `${letter}/${maximum}/${direction} from ${sample.fromValue}`;
      const old = reference.plan(...args);
      assert.deepEqual(recovery.plan(...args), old, `sync ${label}`);
      assert.deepEqual(
        await outcome(executor, recovery.planTask(...args)),
        old,
        `sliced ${label}`,
      );
      assert.equal(old.words.length, sample.steps, label);
      samples++;
    }
  }
  assert.ok(samples >= 200, `${samples} samples`);
  assert.ok(executor.stats.slices > samples, "the searches really were sliced");
});

test("sliced and synchronous jumps and plans equal the previous search for random poses", async () => {
  const random = lcg(20260101),
    executor = sliced(0.25);
  let jumps = 0,
    plans = 0;
  for (let i = 0; i < 120; i++) {
    const [letter, maximum, direction] =
        COUNTING_MODES[Math.floor(random() * COUNTING_MODES.length)],
      targets = targetsOf(letter, maximum, direction);
    let state = periods.poseFor(
      letter,
      maximum,
      direction,
      Math.floor(random() * (maximum + 1)),
    );
    for (let k = 3 + Math.floor(random() * 8); k > 0; k--)
      state = applyMoves(state, [ALL[Math.floor(random() * 18)]]);
    const value = Math.floor(random() * (maximum + 1)),
      jump = [state, letter, maximum, direction, value, targets],
      old = reference.jump(...jump);
    assert.deepEqual(recovery.jump(...jump), old, `sync jump ${i}`);
    assert.deepEqual(
      await outcome(executor, recovery.jumpTask(...jump)),
      old,
      `sliced jump ${i}`,
    );
    jumps++;
    if (!old) continue;
    const landed = applyMoves(state, old),
      plan = [landed, letter, maximum, direction, value, targets],
      expected = reference.plan(...plan);
    assert.deepEqual(recovery.plan(...plan), expected, `sync plan ${i}`);
    assert.deepEqual(
      await outcome(executor, recovery.planTask(...plan)),
      expected,
      `sliced plan ${i}`,
    );
    plans++;
  }
  assert.ok(jumps === 120 && plans > 100, `${jumps} jumps, ${plans} plans`);
});

test("a task driven by hand yields the synchronous result and may be abandoned at any safe point", () => {
  const row = table.modes[0],
    { letter, maximum, direction } = row,
    sample = row.samples[0],
    state = applyMoves(
      initialState(design.print),
      parseAlg(sample.setupFromSolved),
    ),
    args = [
      state,
      letter,
      maximum,
      direction,
      sample.fromValue,
      targetsOf(letter, maximum, direction),
    ];
  const task = recovery.planTask(...args);
  let yields = 0;
  for (let step = task.next(); !step.done; step = task.next()) yields++;
  assert.ok(yields > 10, `${yields} safe points`);
  const again = recovery.planTask(...args);
  again.next();
  again.next();
  assert.deepEqual(again.return(undefined), { value: undefined, done: true });
  assert.deepEqual(runSync(recovery.planTask(...args)), recovery.plan(...args));
});

// ----------------------------------------------------------- cancellation

test("a cancelled job settles at once, is closed at its next wake-up and never runs another slice", async () => {
  const wakes = [];
  const executor = new SlicedExecutor({
    budgetMs: 0,
    yieldNow: () => new Promise((resolve) => wakes.push(resolve)),
  });
  let closed = false,
    steps = 0;
  const task = (function* () {
    try {
      for (;;) {
        steps++;
        yield;
      }
    } finally {
      closed = true;
    }
  })();
  const job = executor.start(task);
  assert.equal(steps, 0, "start never runs a slice in the caller's turn");
  wakes.shift()();
  await flush();
  const before = steps;
  assert.ok(before >= 1);
  job.cancel();
  assert.deepEqual(await job.done, { cancelled: true });
  wakes.shift()();
  await flush();
  assert.equal(closed, true);
  assert.equal(steps, before, "no slice after cancel");
  assert.equal(wakes.length, 0);
  job.cancel();
  assert.equal(executor.stats.cancelled, 1);
});

test("a failing task rejects its job instead of hanging", async () => {
  const executor = sliced();
  const job = executor.start(
    (function* () {
      yield;
      throw Error("boom");
    })(),
  );
  await assert.rejects(job.done, /boom/);
});

/** Holds every job until the test releases it; cancel is honored. */
function manualExecutor({ honorCancel = true } = {}) {
  const jobs = [];
  return {
    jobs,
    start(task) {
      let resolve;
      const done = new Promise((r) => (resolve = r)),
        job = {
          task,
          cancelled: false,
          finished: false,
          done,
          cancel() {
            if (job.finished) return;
            job.cancelled = true;
            if (honorCancel) {
              job.finished = true;
              task.return(undefined);
              resolve({ cancelled: true });
            }
          },
          /** Run the search to its end now and report the result. */
          finish() {
            if (job.finished) return;
            job.finished = true;
            resolve({ cancelled: false, value: runSync(task) });
          },
        };
      jobs.push(job);
      return job;
    },
  };
}
const newController = (letter, maximum, direction, executor) => {
  const c = new HsmController(
    view,
    design,
    {},
    letter,
    () => {},
    assets,
    executor,
  );
  c.setMode(maximum, direction);
  return c;
};
const settleN = async (c) => {
  for (let n = 0; c.busy && n < 20000; n++) await flush();
  assert.equal(c.busy, false, "settled");
  assert.notEqual(c.progress.status, "failed");
};

test("a later request cancels the pending search and only the latest target is planned and played", async () => {
  const executor = manualExecutor(),
    c = newController("S", 59, 1, executor),
    plain = newController("S", 59, 1, null);
  await c.configure(0);
  await plain.configure(0);
  c.request(40);
  await flush();
  assert.equal(
    executor.jobs.length,
    1,
    "the jump to 40 searches off the critical path",
  );
  assert.equal(c.busy, true);
  assert.equal(c.currentValue, 0, "nothing moved while searching");
  c.request(17);
  assert.equal(
    executor.jobs[0].cancelled,
    true,
    "the old search is dropped at once",
  );
  await flush();
  assert.equal(executor.jobs.length, 2, "one search for the new target");
  executor.jobs[1].finish();
  await settleN(c);
  assert.equal(c.currentValue, 17);
  plain.request(17);
  await settleN(plain);
  assert.ok(stateEquals(c.state, plain.state), "same pose as the direct jump");
  assert.equal(c.progress.sessionTotal, plain.progress.sessionTotal);
});

test("a result that arrives after the target changed is never applied", async () => {
  // This executor ignores cancellation and finishes the old job late.
  const executor = manualExecutor({ honorCancel: false }),
    c = newController("S", 59, 1, executor),
    plain = newController("S", 59, 1, null);
  await c.configure(0);
  await plain.configure(0);
  c.request(40);
  await flush();
  c.request(17);
  await flush();
  // The stubborn old job still counts as pending for the controller; the new
  // search replaced it, so releasing the old result later must change nothing.
  assert.equal(executor.jobs.length, 2);
  executor.jobs[1].finish();
  await settleN(c);
  executor.jobs[0].finish();
  await flush();
  assert.equal(c.currentValue, 17);
  plain.request(17);
  await settleN(plain);
  assert.ok(stateEquals(c.state, plain.state));
  // The late result is keyed to its own inputs: the next jump to 40 uses it
  // and is the same route as a direct jump.
  c.request(40);
  plain.request(40);
  await flush();
  await settleN(plain);
  for (const job of executor.jobs) job.finish();
  await settleN(c);
  assert.ok(stateEquals(c.state, plain.state));
  assert.equal(c.progress.sessionTotal, plain.progress.sessionTotal);
});

test("tryPrepare keeps one search per route, returns null until it finishes, then the exact synchronous route", async () => {
  const executor = manualExecutor(),
    c = newController("S", 59, 1, executor),
    plain = newController("S", 59, 1, null);
  await c.configure(0);
  await plain.configure(0);
  assert.equal(
    c.tryPrepare(1)?.length > 0,
    true,
    "an on-period step needs no search",
  );
  assert.equal(executor.jobs.length, 0);
  // Leave the period with a free jump, then ask for the next count.
  c.request(40);
  await flush();
  executor.jobs[0].finish();
  await settleN(c);
  plain.request(40);
  await settleN(plain);
  assert.equal(executor.jobs.length, 1);
  assert.equal(c.tryPrepare(41), null);
  assert.equal(c.tryPrepare(41), null);
  assert.equal(
    executor.jobs.length,
    2,
    "polling does not start another search",
  );
  // Another value replaces it.
  assert.equal(c.tryPrepare(42), null);
  assert.equal(executor.jobs[1].cancelled, true);
  assert.equal(executor.jobs.length, 3);
  assert.equal(c.tryPrepare(41), null);
  assert.equal(executor.jobs.length, 4);
  executor.jobs[3].finish();
  await flush();
  const route = c.tryPrepare(41);
  assert.deepEqual(word(route), word(plain.prepare(41)));
  assert.equal(executor.jobs.length, 4);
  for (const x of [c, plain]) x.dispose();
});

test("a plan search without a route does not loop: the async path reaches the synchronous route", async () => {
  const original = HsmRecovery.prototype.planTask;
  const executor = sliced(0.5);
  let started = 0;
  const c = newController("S", 59, 1, executor),
    plain = newController("S", 59, 1, null);
  try {
    await c.configure(0);
    await plain.configure(0);
    c.request(40);
    await settleN(c);
    plain.request(40);
    await settleN(plain);
    // The recovery plan finds no route here, so the jump search must take over.
    HsmRecovery.prototype.planTask = function () {
      started++;
      return (function* () {
        return null;
      })();
    };
    const expected = plain.prepare(41),
      before = executor.stats.jobs;
    let route = null;
    for (let n = 0; n < 30 && !route; n++) {
      route = c.tryPrepare(41);
      await flush();
    }
    assert.ok(route, `no route after polling (${executor.stats.jobs - before} searches)`);
    assert.equal(word(route), word(expected));
    assert.equal(executor.stats.jobs - before, 2, "one plan and one jump search");
    assert.ok(started >= 1);
  } finally {
    HsmRecovery.prototype.planTask = original;
    c.dispose();
    plain.dispose();
  }
});

/** A controller (with and without an executor) that left the period by a free jump to 40. */
async function offPeriod(executor, via = []) {
  const c = newController("S", 59, 1, executor),
    plain = newController("S", 59, 1, null);
  await c.configure(0);
  await plain.configure(0);
  for (const v of [...via, 40]) {
    c.request(v);
    await flush();
    for (const job of executor.jobs) job.finish();
    await settleN(c);
    plain.request(v);
    await settleN(plain);
  }
  assert.ok(stateEquals(c.state, plain.state));
  return { c, plain };
}

test("a finished search is used only for the exact pose it was computed for", async () => {
  const executor = manualExecutor(),
    { c, plain } = await offPeriod(executor);
  assert.equal(c.tryPrepare(41), null);
  executor.jobs.at(-1).finish();
  await flush();
  assert.equal(word(c.tryPrepare(41)), word(plain.prepare(41)));
  const first = c.state;
  // The same value reached from another pose: the earlier plan must not apply.
  for (const v of [5, 40]) {
    c.request(v);
    plain.request(v);
    await flush();
    for (const job of executor.jobs) job.finish();
    await settleN(c);
    await settleN(plain);
  }
  assert.ok(stateEquals(c.state, plain.state));
  assert.ok(!stateEquals(first, c.state), "a different pose for value 40");
  const jobs = executor.jobs.length;
  assert.equal(c.tryPrepare(41), null, "a new search, not the old result");
  assert.ok(executor.jobs.length > jobs);
  executor.jobs.at(-1).finish();
  await flush();
  assert.equal(word(c.tryPrepare(41)), word(plain.prepare(41)));
  c.dispose();
  plain.dispose();
});

test("a finished search is used only for the exact value it was computed for", async () => {
  const executor = manualExecutor(),
    { c, plain } = await offPeriod(executor);
  assert.equal(c.tryPrepare(10), null);
  executor.jobs.at(-1).finish();
  await flush();
  assert.equal(word(c.tryPrepare(10)), word(plain.prepare(10)));
  const jobs = executor.jobs.length;
  assert.equal(c.tryPrepare(20), null, "another value starts its own search");
  assert.equal(executor.jobs.length, jobs + 1);
  executor.jobs.at(-1).finish();
  await flush();
  assert.equal(word(c.tryPrepare(20)), word(plain.prepare(20)));
  c.dispose();
  plain.dispose();
});

test("a mode switch cancels the pending search, and a changed mode drops a late result", async () => {
  const executor = manualExecutor(),
    { c, plain } = await offPeriod(executor);
  assert.equal(c.tryPrepare(10), null);
  const job = executor.jobs.at(-1);
  c.setMode(59, 1);
  assert.equal(job.cancelled, false, "the same mode keeps the search");
  c.setMode(23, 1);
  assert.equal(job.cancelled, true, "a new mode drops the search at once");
  c.setMode(59, 1);
  // A search that ignores cancellation finishes late, in another mode.
  const stubborn = manualExecutor({ honorCancel: false }),
    s = await offPeriod(stubborn);
  assert.equal(s.c.tryPrepare(10), null);
  const late = stubborn.jobs.at(-1);
  s.c.setMode(23, 1);
  late.finish();
  await flush();
  s.c.setMode(59, 1);
  const jobs = stubborn.jobs.length;
  assert.equal(s.c.tryPrepare(10), null, "the late result left nothing behind");
  assert.equal(stubborn.jobs.length, jobs + 1);
  stubborn.jobs.at(-1).finish();
  await flush();
  assert.equal(word(s.c.tryPrepare(10)), word(s.plain.prepare(10)));
  for (const x of [c, plain, s.c, s.plain]) x.dispose();
});

test("a request retargeted while its search runs never plays the old target", async () => {
  const executor = manualExecutor(),
    played = [],
    c = new HsmController(
      view,
      design,
      {},
      "S",
      (_v, _busy, _error, progress) => {
        if (progress?.status === "playing") played.push(progress.target);
      },
      assets,
      executor,
    );
  await c.configure(0);
  c.request(40);
  await flush();
  c.request(17);
  await flush();
  executor.jobs.at(-1).finish();
  await settleN(c);
  assert.equal(c.currentValue, 17);
  assert.ok(!played.includes(40), `played targets ${played}`);
  c.dispose();
});

// ------------------------------------------------- through the controller

test("every mode counts, jumps and recovers identically with and without the sliced executor", async () => {
  const jumps = [37, 38, 39, 40, 41, 42, 43, 44, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  let searches = 0;
  for (const [letter, maximum, direction] of COUNTING_MODES) {
    const executor = sliced(0.5),
      a = newController(letter, maximum, direction, executor),
      b = newController(letter, maximum, direction, null);
    await a.configure(0);
    await b.configure(0);
    for (const v of jumps) {
      const value = v % (maximum + 1);
      a.request(value);
      b.request(value);
      await settleN(a);
      await settleN(b);
      const label = `${letter}/${maximum}/${direction} to ${value}`;
      assert.ok(stateEquals(a.state, b.state), label);
      assert.equal(a.progress.sessionTotal, b.progress.sessionTotal, label);
    }
    searches += executor.stats.jobs;
    a.dispose();
    b.dispose();
  }
  assert.ok(searches > 18, `${searches} off-thread searches`);
});

test("a controller without an executor never defers: planning stays synchronous", async () => {
  const c = newController("S", 59, 1, null);
  await c.configure(0);
  assert.ok(c.tryPrepare(30).length > 0);
  c.request(30);
  await flush();
  assert.equal(c.currentValue, 30);
});

// ------------------------------------------------------------- blocking

test("a slice is bounded by its budget and the search has dense safe points: every research sample", async () => {
  // A fake clock makes the bound deterministic: every step of the task between
  // two safe points costs one tick, so a slice may take at most `budget` ticks.
  const budget = 4;
  let ticks = 0;
  const executor = new SlicedExecutor({
    budgetMs: budget,
    now: () => ticks,
    yieldNow: () => Promise.resolve(),
  });
  const counted = function* (task) {
    for (;;) {
      ticks++;
      const step = task.next();
      if (step.done) return step.value;
      yield;
    }
  };
  let safePoints = 0;
  for (const row of table.modes) {
    const { letter, maximum, direction } = row,
      targets = targetsOf(letter, maximum, direction);
    for (const sample of row.samples) {
      const state = applyMoves(
          initialState(design.print),
          parseAlg(sample.setupFromSolved),
        ),
        before = ticks;
      const value = await outcome(
        executor,
        counted(
          recovery.planTask(
            state,
            letter,
            maximum,
            direction,
            sample.fromValue,
            targets,
          ),
        ),
      );
      assert.ok(value === null || value.words.length > 0);
      safePoints += ticks - before;
    }
  }
  const { worstSliceMs, slices } = executor.stats;
  assert.ok(
    worstSliceMs <= budget,
    `worst slice ${worstSliceMs} ticks exceeds the ${budget}-tick budget`,
  );
  assert.ok(
    slices >= safePoints / budget,
    `${slices} slices for ${safePoints} safe points`,
  );
  // The count is deterministic: 1,125,296 safe points over the research
  // samples. A margin of about 11% allows small search changes; dropping the
  // yield after each depth-2 subtree leaves only 23,256 and the worst gap grows
  // several times over, so a coarser search fails here.
  assert.ok(safePoints >= 1_000_000, `${safePoints} safe points`);
});

test("an endless task is cut into slices of at most the budget", async () => {
  let ticks = 0,
    steps = 0;
  const executor = new SlicedExecutor({
    budgetMs: 3,
    now: () => ticks,
    yieldNow: () => Promise.resolve(),
  });
  const task = (function* () {
    for (;;) {
      ticks++;
      if (++steps === 100) return steps;
      yield;
    }
  })();
  assert.equal(await outcome(executor, task), 100);
  assert.equal(executor.stats.worstSliceMs, 3);
  assert.equal(executor.stats.slices, 34);
});

// -------------------------------------------------------------- live clock

const utc = (epoch) => {
  const d = new Date(epoch);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
};
/** A view whose turns commit at once and are recorded. */
function recordingView() {
  const committed = [];
  let print;
  return {
    committed,
    configure(p) {
      print = p;
    },
    resetCamera() {},
    async animate(p) {
      validatePresentation(p, print);
      committed.push(p.move);
    },
  };
}
async function liveClock(start, executor) {
  const views = [],
    units = [];
  for (let i = 0; i < 3; i++) {
    const v = recordingView(),
      c = new HsmController(
        v,
        design,
        {},
        "HMS"[i],
        () => {},
        assets,
        executor,
      );
    c.setMode(i === 0 ? 23 : 59, 1);
    await c.configure(utc(start)[i]);
    views.push(v);
    units.push({
      controller: c,
      duration: [250, 100, 50][i],
      setDuration() {},
    });
  }
  return {
    views,
    units,
    scheduler: new LiveClockScheduler(utc),
    origin: start,
  };
}
/** Tick every 25 ms; between ticks the event loop runs, as in the page. */
async function runClock(sim, from, to) {
  for (let t = from; t <= to; t += 25) {
    sim.scheduler.tick(t, t - sim.origin, sim.units);
    await flush();
    for (let n = 0; sim.units.some((u) => u.controller.busy) && n < 20000; n++)
      await flush();
  }
}

test("the live seconds catch up through the sliced search and return onto the period within the research bound, move for move as before", async () => {
  const start = Date.UTC(2026, 0, 1, 12, 34, 5),
    bound = table.modes.find(
      (m) => m.letter === "S" && m.maximum === 59 && m.direction === 1,
    ).maximumSteps;
  const run = async (executor) => {
    const sim = await liveClock(start, executor),
      s = sim.units[2].controller,
      onPeriod = () => periods.nodeOf("S", 59, 1, s.state) >= 0;
    // A suspended tab returns 40 s later; the catch-up needs a jump search.
    const jumpAt = start + 40000;
    for (let n = 0; s.currentValue !== 45 && n < 400; n++) {
      sim.scheduler.tick(jumpAt, jumpAt - sim.origin, sim.units);
      for (
        let k = 0;
        sim.units.some((u) => u.controller.busy) && k < 20000;
        k++
      )
        await flush();
      await flush();
    }
    assert.equal(s.currentValue, 45);
    assert.equal(onPeriod(), false);
    let back = -1;
    const perTick = [];
    for (let k = 41; k <= 52; k++) {
      const before = sim.views[2].committed.length;
      await runClock(sim, start + 1000 * k - 650, start + 1000 * k);
      perTick.push(sim.views[2].committed.length - before);
      if (back < 0 && onPeriod()) back = k - 40;
    }
    assert.equal(s.currentValue, 57);
    const moves = sim.views.map((v) =>
      v.committed.map((m) => JSON.stringify(m)),
    );
    for (const u of sim.units) u.controller.dispose();
    return { back, perTick, moves };
  };
  const executor = realSliced(8),
    async = await run(executor),
    direct = await run(null);
  assert.ok(async.back >= 1 && async.back <= bound, `back after ${async.back}`);
  assert.ok(Math.max(...async.perTick) <= 5, `ticks ${async.perTick}`);
  assert.ok(
    executor.stats.jobs >= 2,
    "the jump and the recovery both searched off-thread",
  );
  // The same turns in the same order as the all-synchronous controller.
  assert.deepEqual(async.moves, direct.moves);
  assert.deepEqual(async.perTick, direct.perTick);
});
