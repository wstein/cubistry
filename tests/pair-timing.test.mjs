// Timed steps of the pair controller (M/S Timer stack): the per-cube carry
// budget planned from each cube's word, and the reports for an infeasible
// budget, a late carry and a missed boundary, within the pair's existing
// configure/dispose and rollback contracts. Scripted fake units, plus one
// timed carry through two real S3 controllers.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PairController } from "../src/apps/pair/controller.ts";
import { hsmPairUnit } from "../src/apps/pair/hsm-unit.ts";
import { validateMsDesign } from "../src/apps/ms/design.ts";
import { MsController } from "../src/apps/ms/controller.ts";
import { serializeMove } from "../packages/cube-mechanics/src/index.ts";

const T = (deadline, interval = 1000, preferred = 100) => ({ deadline, interval, preferred });
const at = (text) => {
  const [major, minor] = text.split(":").map(Number);
  return major * 60 + minor;
};

/**
 * Scripted units: a request starts at once and finishes when the test calls
 * `finish`; `words(from, to)` gives the HTM `prepare` reports. Every call is
 * logged in order, so direction changes can be checked against requests.
 */
function rig({ minorModulus = 60, majorModulus = 60, words = {}, throwOn = {} } = {}) {
  const log = [];
  let clock = 0;
  const reports = [],
    states = [];
  const make = (name) => (onState) => {
    const unit = {
      name,
      busy: false,
      currentValue: 0,
      target: 0,
      async configure(v) {
        unit.currentValue = unit.target = v;
      },
      prepare(v) {
        log.push(`${name}:prepare:${v}`);
        if (throwOn[`${name}:prepare`]) throw Error(`${name}: cannot plan`);
        return Array.from({ length: (words[name] ?? (() => 3))(unit.currentValue, v) }, () => "R");
      },
      request(v) {
        log.push(`${name}:request:${v}`);
        if (throwOn[`${name}:request`]) throw Error(`${name}: request failed`);
        unit.target = v;
        if (!unit.busy) {
          unit.busy = true;
          onState(unit.currentValue, true);
        }
      },
      finish() {
        unit.currentValue = unit.target;
        unit.busy = false;
        onState(unit.currentValue, false);
      },
      /** The unit stops where it is and reports an error, as a failed playback does. */
      fail(error) {
        unit.busy = false;
        onState(unit.currentValue, false, error);
      },
      setDirection(d) {
        log.push(`${name}:direction:${d}`);
      },
      dispose() {},
    };
    return unit;
  };
  const pair = new PairController({
    minorModulus,
    majorModulus,
    createMinor: make("minor"),
    createMajor: make("major"),
    now: () => clock,
    onReport: (r) => reports.push(r),
    onState: (st) => states.push(st),
  });
  return { pair, log, reports, states, throwOn, set: (t) => (clock = t) };
}

test("a timed carry plans each cube's own word and one budget per cube for the larger word", async () => {
  const r = rig({ words: { minor: () => 3, major: () => 4 } });
  await r.pair.configure(at("14:59"));
  r.log.length = 0;
  const done = r.pair.step(1, T(1000));
  // Both words are planned, then both cubes are requested in the same call.
  assert.deepEqual(r.log, ["minor:prepare:0", "major:prepare:15", "minor:request:0", "major:request:15"]);
  assert.equal(r.pair.minor.busy && r.pair.major.busy, true);
  r.pair.minor.finish();
  r.pair.major.finish();
  await done;
  assert.equal(r.pair.value, at("15:00"));
  assert.deepEqual(r.reports, []);
  // No carry: only the minor word is planned and requested.
  r.log.length = 0;
  const plain = r.pair.step(1, T(2000));
  assert.deepEqual(r.log, ["minor:prepare:1", "minor:request:1"]);
  r.pair.minor.finish();
  await plain;
});

test("the budget uses the time left before the deadline, not the whole interval", async () => {
  const r = rig({ words: { minor: () => 3, major: () => 4 } });
  await r.pair.configure(at("35:59"));
  // 200 ms left: 4 HTM need 368 ms, so the carry is infeasible. With the whole
  // interval (a 500 ms budget) it would fit.
  r.set(800);
  const done = r.pair.step(1, T(1000));
  assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].kind, "budget-infeasible");
  const step = r.reports[0].step;
  assert.deepEqual(
    { from: step.from, to: step.to, carry: step.carry, moves: step.moves },
    { from: at("35:59"), to: at("36:00"), carry: true, moves: { minor: 3, major: 4 } },
  );
  assert.equal(step.budget.feasible, false);
  assert.equal(step.budget.larger, 4);
  // The step still plays and settles.
  r.pair.minor.finish();
  r.pair.major.finish();
  await done;
  assert.equal(r.pair.value, at("36:00"));
  // The same step with the whole interval left is feasible: 43 ms per minutes move.
  const fresh = rig({ words: { minor: () => 3, major: () => 4 } });
  await fresh.pair.configure(at("35:59"));
  const ok = fresh.pair.step(1, T(1000));
  assert.deepEqual(fresh.reports, []);
  fresh.pair.minor.finish();
  fresh.pair.major.finish();
  await ok;
});

test("a carry that settles after its deadline is reported late, never shown late silently", async () => {
  const r = rig();
  await r.pair.configure(at("01:59"));
  r.set(500);
  let done = r.pair.step(1, T(1000));
  r.set(1020);
  r.pair.minor.finish();
  r.pair.major.finish();
  await done;
  assert.deepEqual(r.reports, [], "within the 20 ms endpoint tolerance");
  const set = r.pair.set(at("02:59"));
  r.pair.minor.finish();
  r.pair.major.finish();
  await set;
  r.set(1500);
  done = r.pair.step(1, T(2000));
  r.set(1990);
  r.pair.minor.finish();
  assert.deepEqual(r.reports, [], "the pair waits for the major cube");
  r.set(2021);
  r.pair.major.finish();
  await done;
  assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].kind, "late");
  assert.equal(r.reports[0].settledAt, 2021);
  assert.equal(r.reports[0].step.carry, true);
  assert.equal(r.pair.value, at("03:00"));
});

test("a boundary that arrives while the carry still moves is reported missed; the new target replaces it", async () => {
  const r = rig();
  await r.pair.configure(at("58:59"));
  const first = r.pair.step(1, T(1000));
  r.pair.minor.finish();
  r.set(1000);
  r.log.length = 0;
  const second = r.pair.step(1, T(2000));
  assert.equal(r.reports.length, 1);
  assert.equal(r.reports[0].kind, "missed");
  assert.equal(r.reports[0].at, 1000);
  assert.equal(r.reports[0].step.to, at("59:00"), "names the step in flight");
  // Nothing is planned while a cube moves; the newer target is requested
  // from both cubes (the moving major cube keeps its target 59).
  assert.deepEqual(r.log, ["minor:request:1", "major:request:59"]);
  assert.equal(r.pair.target, at("59:01"));
  r.set(1500);
  r.pair.minor.finish();
  r.pair.major.finish();
  await Promise.all([first, second]);
  assert.equal(r.pair.value, at("59:01"));
  assert.deepEqual(r.reports.map((x) => x.kind), ["missed"], "the replacing step met its deadline");
});

test("a Set replaces a timed step: no late report for a target that was dropped", async () => {
  const r = rig();
  await r.pair.configure(at("00:59"));
  const step = r.pair.step(1, T(1000));
  const set = r.pair.set(at("10:10"));
  r.set(5000);
  r.pair.minor.finish();
  r.pair.major.finish();
  await Promise.all([step, set]);
  assert.equal(r.pair.value, at("10:10"));
  assert.deepEqual(r.reports, []);
});

test("a prepare that throws is a unit failure: nothing requested, target unchanged, not stuck busy", async () => {
  const r = rig({ throwOn: { "major:prepare": true } });
  await r.pair.configure(at("12:59"));
  r.log.length = 0;
  await r.pair.step(1, T(1000)); // resolves at once, never rejects
  assert.equal(r.pair.error?.message, "major: cannot plan");
  assert.deepEqual(r.log, ["minor:prepare:0", "major:prepare:13"]);
  assert.equal(r.pair.target, at("12:59"));
  assert.equal(r.pair.busy, false);
  assert.deepEqual(r.reports, []);
  // A new configure clears the failure, and a later step works.
  await r.pair.configure(at("12:58"));
  assert.equal(r.pair.error, undefined);
});

test("a timed carry whose second request throws rolls back, settles and reports nothing late", async () => {
  const r = rig({ minorModulus: 60, majorModulus: 24, throwOn: { "major:request": true } });
  await r.pair.configure(at("00:59"));
  r.log.length = 0;
  r.set(0);
  const done = r.pair.step(1, T(1000));
  assert.equal(r.pair.error?.message, "major: request failed");
  assert.equal(r.pair.target, at("00:59"), "target rolled back");
  assert.deepEqual(r.log, [
    "minor:prepare:0",
    "major:prepare:1",
    "minor:request:0",
    "major:request:1",
    "minor:request:59",
  ]);
  r.set(9000);
  r.pair.minor.finish();
  await done;
  assert.equal(r.pair.busy, false);
  assert.equal(r.pair.value, at("00:59"));
  assert.deepEqual(r.reports, [], "a rolled-back step has no deadline to miss");
});

test("invalid timing and units without prepare throw before any state change", async () => {
  const r = rig();
  assert.throws(() => r.pair.step(1, T(1000)), /configure/i);
  await r.pair.configure(5);
  r.log.length = 0;
  for (const bad of [T(NaN), T(1000, 0), T(1000, NaN), T(1000, 1000, 0)])
    assert.throws(() => r.pair.step(1, bad), /timing/);
  delete r.pair.major.prepare;
  assert.throws(() => r.pair.step(1, T(1000)), /prepare/);
  assert.deepEqual(r.log, []);
  assert.equal(r.pair.target, 5);
  assert.equal(r.pair.busy, false);
  // Untimed steps do not need prepare.
  const s = r.pair.step(1);
  r.pair.minor.finish();
  await s;
  assert.equal(r.pair.value, 6);
});

test("both cubes switch direction before the step is planned or requested", async () => {
  for (const timing of [null, T(1000)]) {
    const r = rig();
    await r.pair.configure(at("13:00"));
    r.log.length = 0;
    const done = r.pair.step(-1, timing);
    const firstWork = r.log.findIndex((e) => /prepare|request/.test(e));
    const switched = r.log.slice(0, firstWork);
    assert.deepEqual(switched.sort(), ["major:direction:-1", "minor:direction:-1"], JSON.stringify(r.log));
    r.pair.minor.finish();
    r.pair.major.finish();
    await done;
    assert.equal(r.pair.value, at("12:59"));
  }
});

test("hsmPairUnit passes prepare through to the controller", () => {
  const calls = [];
  const controller = {
    setMode: (range, d) => calls.push(["setMode", range, d]),
    prepare: (v) => (calls.push(["prepare", v]), ["R", "U"]),
  };
  const unit = hsmPairUnit(controller, 23);
  assert.deepEqual(unit.prepare(7), ["R", "U"]);
  assert.deepEqual(calls, [["setMode", 23, 1], ["prepare", 7]]);
});

test("a timed carry through two real S3 controllers plans exactly the words it plays", async () => {
  const s3 = validateMsDesign(JSON.parse(readFileSync("public/ms-counter.v1.json", "utf8"))).print;
  const played = { minor: [], major: [] };
  const view = (name) => ({
    configure() {},
    resetCamera() {},
    animate: async (p) => {
      played[name].push(serializeMove(p.move));
    },
  });
  const reports = [];
  let clock = 0;
  const pair = new PairController({
    minorModulus: 60,
    majorModulus: 60,
    createMinor: (s) => new MsController(view("minor"), s3, {}, "S", s, async () => ({ dispose() {} })),
    createMajor: (s) => new MsController(view("major"), s3, {}, "M", s, async () => ({ dispose() {} })),
    now: () => clock,
    onReport: (r) => reports.push(r),
  });
  await pair.configure(at("55:59"));
  await pair.step(1, T(1000));
  assert.equal(pair.value, at("56:00"));
  assert.deepEqual(reports, []);
  // The planned words are exactly the words the views played: 4 HTM on the
  // 55 -> 56 minutes edge, at most 3 on the seconds.
  const planned = pair.lastTimedStep;
  assert.deepEqual(planned.moves, { minor: played.minor.length, major: played.major.length });
  assert.equal(planned.moves.major, 4);
  assert.ok(planned.moves.minor <= 3);
  assert.equal(planned.budget.major.effective, 43);
  assert.equal(planned.budget.feasible, true);
  // Ten milliseconds before the deadline: infeasible, and then late. Both are reported.
  played.minor.length = played.major.length = 0;
  clock = 2000;
  const late = pair.step(1, T(2010));
  clock = 2031;
  await late;
  assert.deepEqual(reports.map((r) => r.kind), ["budget-infeasible", "late"]);
  assert.equal(reports[0].step, reports[1].step);
  assert.deepEqual(reports[0].step.moves, { minor: played.minor.length, major: null });
});

test("an older failure does not hide a late carry; a failure during the step is its own report", async () => {
  // An untimed request failure first: error is recorded and stays until configure.
  const r = rig({ minorModulus: 60, majorModulus: 24 });
  await r.pair.configure(at("00:59"));
  r.throwOn["major:request"] = true;
  const failed = r.pair.step(1);
  r.pair.minor.finish();
  await failed;
  assert.equal(r.pair.error?.message, "major: request failed");
  assert.equal(r.pair.value, at("00:59"));
  // Then a timed carry that settles late must still be reported late.
  delete r.throwOn["major:request"];
  r.set(0);
  const late = r.pair.step(1, T(1000));
  r.set(1100);
  r.pair.minor.finish();
  r.pair.major.finish();
  await late;
  assert.equal(r.pair.value, at("01:00"));
  assert.deepEqual(r.reports.map((x) => x.kind), ["late"]);
  assert.equal(r.reports[0].settledAt, 1100);
  // A unit that fails during a timed step that then settles late: the failure
  // is the report (error and onState), not a second "late".
  const f = rig();
  await f.pair.configure(at("00:59"));
  f.set(0);
  const step = f.pair.step(1, T(1000));
  f.set(2000);
  f.pair.minor.finish();
  f.pair.major.fail(Error("major broke"));
  await step;
  assert.equal(f.pair.error?.message, "major broke");
  assert.equal(f.states.at(-1).error?.message, "major broke");
  assert.equal(f.pair.busy, false);
  assert.deepEqual(f.reports, []);
});

test("a late carry is reported once", async () => {
  const r = rig();
  await r.pair.configure(at("09:59"));
  const step = r.pair.step(1, T(1000));
  r.set(1500);
  r.pair.minor.finish();
  r.pair.major.finish();
  await step;
  // Later settles (a Set to the shown value, an untimed step) do not repeat it.
  await r.pair.set(r.pair.value);
  const next = r.pair.step(1);
  r.pair.minor.finish();
  await next;
  assert.deepEqual(r.reports.map((x) => x.kind), ["late"]);
});

test("a prepare failure is published through onState", async () => {
  const r = rig({ throwOn: { "minor:prepare": true } });
  await r.pair.configure(3);
  r.states.length = 0;
  await r.pair.step(1, T(1000));
  assert.equal(r.states.length, 1);
  assert.deepEqual(
    { value: r.states[0].value, target: r.states[0].target, busy: r.states[0].busy, error: r.states[0].error?.message },
    { value: 3, target: 3, busy: false, error: "minor: cannot plan" },
  );
});

test("a minor unit without prepare, or invalid timing with a direction change, throws before any state change", async () => {
  const r = rig();
  await r.pair.configure(at("13:00"));
  r.log.length = 0;
  for (const bad of [T(NaN), T(1000, -1)]) assert.throws(() => r.pair.step(-1, bad), /timing/);
  assert.equal(r.pair.direction, 1, "the direction did not change");
  delete r.pair.minor.prepare;
  assert.throws(() => r.pair.step(-1, T(1000)), /prepare/);
  assert.deepEqual(r.log, [], "no direction change, plan or request");
  assert.equal(r.pair.direction, 1);
  assert.equal(r.pair.target, at("13:00"));
  assert.equal(r.pair.busy, false);
});
