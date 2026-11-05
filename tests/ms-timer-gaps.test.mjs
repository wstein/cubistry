// M/S Timer: acceptance bullets of knowledge/plans/ms-timer.md that the other
// ms-timer tests leave open. Virtual clock only (tests/helpers/ms-timer-rig.mjs):
// no real-time waits, no races. Every pose is checked on the rig's separate
// cube models, which replay the turns from the saved research words.
import test from "node:test";
import assert from "node:assert/strict";
import { stateEquals } from "../packages/cube-core/src/index.ts";
import { at, ms, rig, startPose } from "./helpers/ms-timer-rig.mjs";

const TOLERANCE = 20; // documented endpoint tolerance, ms

/** Tick through `seconds` whole seconds; after each, check the display and collect the turns. */
async function seconds(r, count, expect, after = () => {}) {
  const t0 = r.now;
  for (let k = 1; k <= count; k++) {
    await r.runTo(t0 + k * 1000 + 40);
    const played = r.take();
    r.check(expect(k));
    after(k, played);
  }
}

test("Countdown replays both laps of the seconds cube downward on the independent model", async () => {
  const r = await rig({ from: 120, duration: 120, tick: 25 });
  const start = startPose("minor", 0);
  r.timer.start();
  await seconds(
    r,
    120,
    (k) => 120 - k,
    (k) => {
      if (k === 60) {
        assert.equal(r.pair.minor.currentValue, 0);
        assert.equal(
          stateEquals(r.model.minor, start),
          false,
          "same display after 60 steps, other lap",
        );
      }
    },
  );
  assert.equal(r.timer.clock.elapsed, true);
  assert.equal(r.pair.value, 0);
  assert.ok(
    stateEquals(r.model.minor, start),
    "the 120-step period closes after the second lap",
  );
  assert.equal(r.timer.warning, "");
});

test("Stopwatch crosses the second lap boundary at a minutes carry and keeps the lap-aware pose", async () => {
  const r = await rig({ from: 59, mode: "stopwatch", tick: 25 });
  r.joinRunning(59);
  // 00:59 -> 02:01 passes two carries and the seconds cube's lap switch at 01:00.
  await seconds(r, 62, (k) => 59 + k);
  assert.equal(r.pair.value, at("02:01"));
  assert.equal(r.timer.warning, "");
});

test("Countdown with a fractional duration ends exactly at 00:00.0 and holds", async () => {
  const r = await rig({ from: 2.5, duration: 2.5 });
  r.timer.start();
  await r.runTo(2500);
  await r.runTo(r.now + 40);
  r.take();
  r.check(0);
  assert.equal(r.timer.running, false);
  assert.equal(r.timer.clock.elapsed, true);
  assert.equal(r.timer.text, "00:00.0");
  await r.runTo(r.now + 5000);
  assert.deepEqual(r.take(), { minor: [], major: [], tenth: [] });
  r.check(0);
});

test("pressing Start at either end neither turns a cube nor runs the timer", async () => {
  const c = await rig({ from: 2, duration: 2 });
  c.timer.start();
  await c.runTo(2040);
  c.take();
  assert.equal(c.timer.running, false);
  c.timer.start();
  await c.runTo(c.now + 3000);
  assert.deepEqual(c.take(), { minor: [], major: [], tenth: [] });
  assert.equal(c.timer.running, false);
  assert.equal(c.timer.text, "00:00.0");
  c.check(0);

  const start = at("59:58");
  const s = await rig({ from: start, mode: "stopwatch" });
  s.joinRunning(start);
  await s.runTo(2040);
  s.take();
  assert.equal(s.timer.running, false);
  s.timer.start();
  await s.runTo(s.now + 3000);
  assert.deepEqual(s.take(), { minor: [], major: [], tenth: [] });
  assert.equal(s.timer.running, false);
  assert.equal(s.timer.text, "59:59.0");
  s.check(at("59:59"));
});

test("Stopwatch paused at 00:59.5 resumes and the carry still lands on the boundary", async () => {
  const r = await rig({ from: 59, mode: "stopwatch" });
  r.joinRunning(59);
  await r.runTo(500); // 59.5 s of timer time
  r.take();
  r.timer.pause();
  await r.runTo(r.now + 200, { ticking: false });
  r.take();
  assert.equal(r.timer.text, "00:59.5");
  r.check(59.5);
  await r.runTo(r.now + 4000, { ticking: false });
  assert.deepEqual(r.take(), { minor: [], major: [], tenth: [] });
  r.timer.start();
  const boundary = r.now + 500;
  await r.runTo(boundary + 40);
  const played = r.take();
  r.check(60);
  assert.ok(
    played.minor.length > 0 && played.major.length > 0,
    "both cubes carry",
  );
  for (const unit of ["minor", "major"])
    assert.ok(
      Math.abs(played[unit].at(-1).completeAt - boundary) <= TOLERANCE,
      `${unit}: last turn ${played[unit].at(-1).completeAt - boundary} ms from the boundary`,
    );
  assert.equal(r.timer.warning, "");
});

test("Countdown paused at 15:00.5 into the 4-HTM minutes edge resumes and keeps the 0.5 s", async () => {
  const r = await rig({ from: 901.5, duration: 901.5 });
  r.timer.start();
  await r.runTo(1000); // 15:00.5 left
  r.take();
  r.timer.pause();
  await r.runTo(r.now + 2000, { ticking: false }); // the reconcile walk settles
  r.take();
  assert.equal(r.timer.text, "15:00.5");
  assert.equal(r.timer.clock.valueMs, 900500);
  r.check(900.5);
  await r.runTo(r.now + 3000, { ticking: false });
  assert.deepEqual(r.take(), { minor: [], major: [], tenth: [] });
  r.timer.start();
  const boundary = r.now + 500; // 15:00.0
  await r.runTo(boundary + 1000 + 40); // and on to 14:59.0 across the carry
  const played = r.take();
  r.check(899);
  assert.equal(played.major.length, 4, "the 4-HTM minutes edge 15 to 14");
  assert.ok(
    Math.abs(played.major.at(-1).completeAt - (boundary + 1000)) <= TOLERANCE,
  );
  assert.equal(r.timer.warning, "");
});

// ------------------------------------------------------ Set and Reset routes
// Built variant: a jump (Set, Reset, mode change) uses the optimal 2x2 solver
// to the target's canonical period node; only adjacent steps play the saved
// period word (src/apps/ms-timer/cube.ts). The plan's "step by step" wording of
// decision 5 therefore holds only for adjacent targets.

const htm = (word) => (word ? word.split(" ").length : 0);

test("Set to an adjacent second plays exactly the saved period word, forward and inverse", async () => {
  const r = await rig({ from: 30 });
  let walking = r.timer.set("00:31");
  await r.walk(walking);
  r.check(31);
  walking = r.timer.set("00:30");
  await r.walk(walking);
  r.check(30);
  // Both steps are single period edges: their lengths equal the saved words.
  const r2 = await rig({ from: 30 });
  const w = r2.timer.set("00:31");
  let done = false;
  w.then(() => (done = true));
  while (!done) await r2.runTo(r2.now + 10, { ticking: false });
  const played = r2.take();
  assert.equal(played.minor.length, htm(ms.runs.S.words[30]));
  assert.equal(played.major.length, 0);
});

test("Set and Reset across far distances finish on a period node within 11 HTM per cube", async () => {
  const r = await rig({ from: 900 });
  for (const target of ["00:00", "59:59", "29:30", "15:00"]) {
    const walking = r.timer.set(target);
    let done = false;
    walking.then(() => (done = true));
    while (!done) await r.runTo(r.now + 10, { ticking: false });
    const played = r.take();
    r.check(at(target));
    for (const unit of ["minor", "major"]) {
      assert.ok(
        played[unit].length <= 11,
        `${target} ${unit}: ${played[unit].length} HTM`,
      );
    }
    assert.ok(played.tenth.length <= 14 * 10);
    // The cube rests on a node of its period that shows the target: for the
    // seconds cube either lap, for the minutes cube its single lap.
    const sec = at(target);
    const onNode = (cube, value, laps) =>
      Array.from({ length: laps }, (_, lap) => value + lap * 60).some((n) =>
        stateEquals(cube.state, cube.period.nodes[n]),
      );
    assert.ok(
      onNode(r.pair.minor, sec % 60, 2),
      `${target}: seconds cube on a period node`,
    );
    assert.ok(
      onNode(r.pair.major, Math.floor(sec / 60), 1),
      `${target}: minutes cube on a period node`,
    );
  }
  const far = await rig({ from: at("59:59"), duration: 900 });
  await far.walk(far.timer.reset());
  far.check(900);
  assert.equal(far.timer.warning, "");
});

test("a newer Set interrupts a running Set walk and the cubes end on the newer target", async () => {
  const r = await rig({ from: 900 });
  const first = r.timer.set("45:10");
  await r.runTo(r.now + 120, { ticking: false }); // mid-route, turns still queued
  const second = r.timer.set("05:20");
  let done = false;
  Promise.all([first, second]).then(() => (done = true));
  while (!done) await r.runTo(r.now + 10, { ticking: false });
  r.take();
  r.check(at("05:20"));
  assert.equal(r.timer.configuredSeconds, at("05:20"));
  assert.equal(r.timer.busy, false);
});

// Known defect, reported and not fixed here (no app behavior changes in this
// change set): while a Countdown runs between two whole seconds, the seconds
// cube shows the next higher second (readout 00:19.5, cubes 00:20.5) because
// the cubes carry the rounded-up bucket and the 1/10 cube the true tenth. The
// Stopwatch agrees at every tenth. `todo` keeps the test visible without
// failing the suite; remove `todo` when the defect is fixed.
test(
  "running Countdown: the cubes show the readout between whole seconds",
  { todo: "cubes run one second ahead of the readout" },
  async () => {
    const r = await rig({ from: 20, duration: 20 });
    r.timer.start();
    for (const t of [500, 1500, 7500]) {
      await r.runTo(t);
      assert.equal(r.timer.shown, r.timer.text, `at ${t} ms`);
    }
  },
);
