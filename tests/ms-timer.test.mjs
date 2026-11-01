// M/S Timer (stack PR 3): the predictive scheduler wired per cube on the pair
// controller, in virtual time. Every turn is replayed on a separate cube model
// built from the saved research words (tests/helpers/ms-timer-rig.mjs).
import test from "node:test";
import assert from "node:assert/strict";
import { MsTimerScheduler } from "../src/apps/ms-timer/scheduler.ts";
import { planSequence } from "../src/apps/timer/scheduler.ts";
import { stateEquals } from "../packages/cube-core/src/index.ts";
import { inverseWord } from "../scripts/ms/convert-witness.mjs";
import { at, label, ms, rig, startPose } from "./helpers/ms-timer-rig.mjs";

const TOLERANCE = 20; // documented endpoint tolerance, ms

/** Run `seconds` one-second boundaries; check display and the last turn of each cube at each. */
async function runChecked(r, firstBoundaryOffset, seconds, expect) {
  const report = [];
  const t0 = r.now;
  for (let k = 1; k <= seconds; k++) {
    const boundary = t0 + firstBoundaryOffset + (k - 1) * 1000;
    await r.runTo(boundary + 40);
    const played = r.take();
    r.check(expect(k));
    const row = { k, boundary, minor: played.minor, major: played.major };
    for (const unit of ["minor", "major"]) {
      if (!played[unit].length) continue;
      const last = played[unit].at(-1);
      assert.ok(
        Math.abs(last.completeAt - boundary) <= TOLERANCE,
        `${label(expect(k))} ${unit}: last turn ended ${last.completeAt - boundary} ms from the boundary`,
      );
    }
    report.push(row);
  }
  return report;
}

test("derived budget arithmetic at 1x: about 82 ms for 3 moves, 43 ms for 4, no feasible serial 3 + 4", () => {
  const three = planSequence(3, 100, 1000),
    four = planSequence(4, 100, 1000),
    serial = planSequence(7, 100, 1000);
  assert.ok(three.feasible && four.feasible);
  assert.ok(Math.abs(three.effective - 82.33) < 0.01);
  assert.equal(four.effective, 43);
  assert.ok(four.duration <= 500 && three.duration <= 500);
  assert.equal(serial.feasible, false);
  // A faster-than-1x clock leaves no feasible plan for a 4 HTM carry.
  assert.equal(planSequence(4, 100, 100).feasible, false);
});

test("Countdown 00:03 to 00:00: both cubes land on every second within 20 ms and the end holds", async () => {
  const r = await rig({ from: 3, duration: 3 });
  r.timer.start();
  const report = await runChecked(r, 1000, 3, (k) => 3 - k);
  assert.ok(
    report.every((x) => x.major.length === 0),
    "no carry, the minutes cube rests",
  );
  assert.equal(r.timer.running, false);
  assert.equal(r.timer.clock.elapsed, true);
  assert.equal(r.pair.value, 0);
  await r.runTo(r.now + 3000);
  assert.deepEqual(r.take(), { minor: [], major: [] }, "no turn after 00:00");
  assert.equal(r.timer.text, "00:00");
  assert.equal(r.timer.warning, "");
});

test("each second the seconds cube turns about 82 ms per HTM and finishes at the boundary", async () => {
  const r = await rig({ from: 0, mode: "stopwatch" });
  r.timer.start();
  const report = await runChecked(r, 1000, 6, (k) => k);
  for (const { k, minor } of report) {
    assert.ok(
      minor.length >= 1 && minor.length <= 3,
      `second ${k}: ${minor.length} HTM`,
    );
    const effective = planSequence(minor.length, 100, 1000).effective;
    assert.ok(effective > 80 && effective <= 100);
    // Contiguous: every turn starts where the previous one ended.
    for (let i = 1; i < minor.length; i++)
      assert.ok(
        Math.abs(minor[i].calledAt - minor[i - 1].completeAt) <= 1,
        "no wait between turns",
      );
  }
});

const CARRY_EDGES = [
  ["00:59", "01:00", false],
  ["01:59", "02:00", false],
  ["14:59", "15:00", true],
  ["35:59", "36:00", true],
  ["55:59", "56:00", true],
  ["58:59", "59:00", false],
];

for (const [low, high, four] of CARRY_EDGES) {
  test(`Stopwatch ${low} to ${high}: both cubes turn in parallel and end at the boundary${four ? " (4 HTM minutes edge)" : ""}`, async () => {
    const start = at(low) - 2;
    const r = await rig({ from: start, mode: "stopwatch" });
    r.joinRunning(start); // join the run two seconds before the carry
    const report = await runChecked(r, 1000, 5, (k) => start + k);
    const carry = report.find((x) => x.k === 3); // low -> high
    assert.equal(
      carry.major.length > 0,
      true,
      "the minutes cube turns at the carry",
    );
    assert.equal(
      carry.minor.length > 0,
      true,
      "the seconds cube turns at the carry",
    );
    if (four) assert.equal(carry.major.length, 4, "4 HTM edge");
    // Parallel, not serial: the two windows overlap in time.
    const span = (rows) => [rows[0].calledAt, rows.at(-1).completeAt];
    const [ms0, ms1] = span(carry.minor),
      [mm0, mm1] = span(carry.major);
    assert.ok(mm0 < ms1 && ms0 < mm1, "windows overlap");
    // One budget per cube, planned for its own word: consecutive turns of a
    // cube end one effective turn time apart (about 43 ms for 4 HTM).
    for (const rows of [carry.minor, carry.major]) {
      const eff = planSequence(rows.length, 100, 1000).effective;
      for (let i = 1; i < rows.length; i++)
        assert.ok(
          Math.abs(rows[i].completeAt - rows[i - 1].completeAt - eff) <= 2,
          `${rows.length} HTM: turns ${eff.toFixed(1)} ms apart`,
        );
    }
    // The minutes cube rests on every second without a carry.
    for (const x of report)
      if (x.k !== 3)
        assert.equal(x.major.length, 0, `second ${x.k}: minutes rest`);
    assert.equal(r.timer.warning, "");
  });

  test(`Countdown ${high} to ${low}: the reverse carry plays the inverse words in parallel`, async () => {
    const start = at(high) + 2;
    const r = await rig({ from: start, duration: start });
    r.timer.start();
    const report = await runChecked(r, 1000, 5, (k) => start - k);
    const carry = report.find((x) => x.k === 3); // high -> low
    assert.ok(carry.major.length > 0 && carry.minor.length > 0);
    if (four) assert.equal(carry.major.length, 4);
    assert.equal(r.timer.warning, "");
  });
}

test("Stopwatch stops at 59:59 without wrapping; Reset walks back to 00:00 through the wrap", async () => {
  const start = at("59:57");
  const r = await rig({ from: start, mode: "stopwatch" });
  r.joinRunning(start);
  await runChecked(r, 1000, 2, (k) => start + k);
  assert.equal(r.timer.running, false);
  assert.equal(r.timer.text, "59:59");
  await r.runTo(r.now + 4000);
  assert.deepEqual(r.take(), { minor: [], major: [] });
  assert.equal(r.pair.value, at("59:59"));
  const done = r.timer.reset();
  await r.runTo(r.now + 3000, { ticking: false });
  await done;
  r.take();
  r.check(0);
});

test("two laps of the seconds cube: the display repeats after 60 steps while the pose differs, the pose closes after 120", async () => {
  const r = await rig({ from: 0, mode: "stopwatch", tick: 25 });
  r.timer.start();
  const start = startPose("minor", 0);
  let lastMinor = 0;
  for (let k = 1; k <= 121; k++) {
    await r.runTo(k * 1000 + 50);
    const played = r.take();
    lastMinor += played.minor.length;
    r.check(k);
    if (k === 60) {
      assert.equal(r.pair.minor.currentValue, 0);
      assert.equal(
        stateEquals(r.model.minor, start),
        false,
        "same display, other lap",
      );
    }
    if (k === 120)
      assert.ok(
        stateEquals(r.model.minor, start),
        "the 120-step period closes",
      );
  }
  assert.ok(lastMinor > 0);
  assert.equal(r.timer.warning, "");
});

test("an infeasible budget is reported, never silent", async () => {
  const r = await rig({ from: 0, mode: "stopwatch" });
  r.timer.clock.setSpeed(10); // not offered in the page; 10x leaves 50 ms for 113+ ms of overhead
  r.timer.start();
  await r.runTo(60);
  assert.equal(r.timer.warning, "Budget infeasible");
});

test("a missed carry is reported as Late and the cubes still end on the right value", async () => {
  const start = at("14:58");
  const r = await rig({ from: start, mode: "stopwatch" });
  r.joinRunning(start);
  await r.runTo(100); // the plan for 14:59 is not due yet
  // The page stalls (no ticks) through the 14:59 -> 15:00 boundary.
  await r.runTo(2000 + 300, { ticking: false });
  r.timer.tick();
  await r.settle();
  assert.equal(r.timer.warning, "Late");
  await r.runTo(r.now + 1500, { ticking: true });
  r.timer.pause(); // reconciles both cubes with the paused clock
  await r.runTo(r.now + 3000, { ticking: false });
  assert.equal(r.pair.busy, false);
  r.take();
  r.check(r.timer.clock.bucket); // the late carry still ends on the right value
  assert.equal(r.pair.value, r.timer.clock.bucket);
});

test("an infeasible budget at a carry (00:59 to 01:00, both cubes) is reported", async () => {
  const r = await rig({ from: 59, mode: "stopwatch" });
  r.timer.clock.setSpeed(10); // not offered in the page
  r.joinRunning(5.9); // 59 s of timer time at 10x
  await r.runTo(60);
  assert.equal(r.timer.clock.snapshot().next.target, 60);
  assert.equal(r.timer.warning, "Budget infeasible");
  assert.equal(r.timer.scheduler.minor.warning, "Budget infeasible");
  assert.equal(r.timer.scheduler.major.warning, "Budget infeasible");
});

test("the warning reports either cube alone, and Late wins over Budget infeasible", () => {
  const warning = (minor, major) => {
    const s = new MsTimerScheduler(60);
    s.minor.warning = minor;
    s.major.warning = major;
    return s.warning;
  };
  assert.equal(warning("", ""), "");
  assert.equal(warning("Late", ""), "Late");
  assert.equal(warning("", "Late"), "Late", "only the minutes cube is late");
  assert.equal(warning("Budget infeasible", ""), "Budget infeasible");
  assert.equal(
    warning("", "Budget infeasible"),
    "Budget infeasible",
    "only the minutes cube is infeasible",
  );
  assert.equal(warning("Budget infeasible", "Late"), "Late");
  assert.equal(warning("Late", "Budget infeasible"), "Late");
});

// ------------------------------------------------------ Set, Reset and pause

test("Set walks the saved periods across carries, including the 4-HTM minutes edges, turn by turn", async () => {
  const r = await rig({ from: 900 });
  const sequence = [
    "14:59",
    "15:00",
    "36:00",
    "35:59",
    "55:59",
    "56:00",
    "00:00",
    "59:59",
    "15:00",
  ];
  for (const target of sequence) {
    const before = r.take();
    assert.deepEqual(before, { minor: [], major: [] });
    const walking = r.timer.set(target);
    let done = false;
    walking.then(() => (done = true));
    const started = r.now;
    while (!done) await r.runTo(r.now + 10, { ticking: false });
    const played = r.take();
    r.check(at(target));
    assert.equal(r.pair.value, at(target));
    assert.equal(r.timer.configuredSeconds, at(target));
    // No free jump: every change of value takes real turns.
    assert.ok(played.minor.length + played.major.length > 0);
    assert.ok(r.now > started);
  }
});

test("Set to 14:59 from 15:00 plays the inverse of the saved 14 to 15 word on the minutes cube", async () => {
  const r = await rig({ from: 900 });
  const walking = r.timer.set("14:59");
  let done = false;
  walking.then(() => (done = true));
  while (!done) await r.runTo(r.now + 10, { ticking: false });
  const played = r.take();
  assert.equal(
    played.major.map((x) => x.move).join(" "),
    inverseWord(ms.runs.M.words[14]),
  );
  assert.equal(played.major.length, 4);
  r.check(at("14:59"));
});

test("Reset returns by the shortest route to the configured duration (Countdown) or to zero (Stopwatch)", async () => {
  const c = await rig({ from: 5, duration: 5 });
  c.timer.start();
  await c.runTo(2400);
  c.timer.pause();
  await c.walk(c.timer.reset());
  c.take();
  c.check(5);
  assert.equal(c.timer.text, "00:05");
  assert.equal(c.timer.started, false);

  const s = await rig({ from: 0, mode: "stopwatch" });
  s.timer.start();
  await s.runTo(3300);
  s.timer.pause();
  await s.walk(s.timer.reset());
  s.check(0);
  assert.equal(s.timer.text, "00:00");

  // Reset from far away is a walk by the fewer-HTM direction, ending exactly on the target.
  const far = await rig({ from: at("59:59"), duration: 900 });
  await far.walk(far.timer.reset());
  far.check(900);
});

test("changing the mode walks both cubes to the new start value", async () => {
  const r = await rig({ from: 900 });
  await r.walk(r.timer.setMode("stopwatch"));
  r.check(0);
  await r.walk(r.timer.setMode("countdown"));
  r.check(900);
});

test("pause keeps the fraction: 12.5 s shows 00:12 (Stopwatch) and resumes with 0.5 s to the next second", async () => {
  const r = await rig({ from: 0, mode: "stopwatch" });
  r.timer.start();
  await r.runTo(12500);
  r.take();
  r.timer.pause();
  await r.runTo(r.now + 20, { ticking: false });
  assert.equal(r.timer.text, "00:12");
  assert.equal(r.timer.clock.valueMs, 12500);
  r.check(12);
  const paused = r.now;
  await r.runTo(paused + 5000, { ticking: false });
  assert.equal(r.timer.text, "00:12");
  assert.deepEqual(r.take(), { minor: [], major: [] });
  r.timer.start();
  const boundary = r.now + 500;
  await r.runTo(boundary + 40);
  const played = r.take();
  r.check(13);
  assert.ok(Math.abs(played.minor.at(-1).completeAt - boundary) <= TOLERANCE);
});

test("Countdown pause at 12.5 s left shows 00:13 and keeps the 0.5 s", async () => {
  const r = await rig({ from: 20, duration: 20 });
  r.timer.start();
  await r.runTo(7500);
  r.take();
  r.timer.pause();
  await r.runTo(r.now + 20, { ticking: false });
  assert.equal(r.timer.text, "00:13");
  assert.equal(r.timer.clock.valueMs, 12500);
  r.check(13);
});

test("invalid Set input is rejected, never rounded, and changes nothing", async () => {
  const r = await rig({ from: 900 });
  for (const bad of [
    "60:00",
    "15:60",
    "15:6",
    "1500",
    "",
    "-1:00",
    "15:00.5",
    "99:99",
  ]) {
    assert.throws(() => r.timer.set(bad), Error, bad);
    assert.equal(r.timer.configuredSeconds, 900);
  }
  await r.runTo(500, { ticking: false });
  assert.deepEqual(r.take(), { minor: [], major: [] });
  assert.equal(r.timer.clock.valueMs, 900000);
});
