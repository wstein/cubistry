// Pair controller with carry (M/S Timer stack, PR 2): one combined counter over a
// minor and a major cube, for M/S (60/60 on two MsControllers) and H/M (60/24
// on two HsmControllers). Every cube turn the pair plays is recorded at the
// view and replayed through a SEPARATE cube model built in this file from the
// saved research data (setup words and period words), never from a controller's
// own state; the controllers' states are only cross-checked afterward.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateMsDesign, msTarget } from "../src/apps/ms/design.ts";
import { MsController } from "../src/apps/ms/controller.ts";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { PairController } from "../src/apps/pair/controller.ts";
import { hsmPairUnit } from "../src/apps/pair/hsm-unit.ts";
import { inverseWord } from "../scripts/ms/convert-witness.mjs";
import {
  applyMoves,
  initialState,
  matchesTarget,
  parseAlg,
  serializeMove,
} from "../packages/cube-mechanics/src/index.ts";
import { stateEquals } from "../packages/cube-core/src/index.ts";

const msRaw = JSON.parse(readFileSync("public/ms-counter.v1.json", "utf8"));
const hsmRaw = JSON.parse(readFileSync("public/hsm-counter.v3.json", "utf8"));
const ms = validateMsDesign(msRaw).print;
const hsm = validateHsmDesign(hsmRaw);
const assets = async () => ({ dispose() {} });
const poseKey = (state) => JSON.stringify(state.cubies);
const flush = async (n = 20) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

/** A view that records every turn and can hold turns until released. */
function makeView() {
  const view = {
    log: [],
    held: [],
    hold: false,
    started: 0,
    configure() {},
    resetCamera() {},
    animate: async (presentation) => {
      view.log.push(serializeMove(presentation.move));
      view.started++;
      if (view.hold) await new Promise((r) => view.held.push(r));
    },
    release(all = true) {
      if (all) view.hold = false;
      for (const r of view.held.splice(0)) r();
    },
  };
  return view;
}

// ------------------------------------------------------ the two parameter sets

/**
 * Each set builds a pair plus the independent model data: the print, the
 * display target of a unit, the saved period words and where a unit starts.
 */
const SETS = {
  "M/S": {
    minorMod: 60,
    majorMod: 60,
    print: ms.print,
    target: (unit, v) => msTarget(unit === "minor" ? "S" : "M", v),
    build(views) {
      const unit = (view, letter) => (onState) =>
        new MsController(view, ms, {}, letter, onState, assets);
      return new PairController({
        minorModulus: 60,
        majorModulus: 60,
        createMinor: unit(views.minor, "S"),
        createMajor: unit(views.major, "M"),
      });
    },
    stateOf: (pair, unit) => pair[unit].state,
    // Independent period data: saved run of the unit's letter.
    period(unit) {
      const run = ms.runs[unit === "minor" ? "S" : "M"];
      return { setup: run.setup, words: run.words, n: run.words.length };
    },
    // Saved word that leads from node i to i + 1 and the move back.
    forward: (p, i) => p.words[i % p.n],
    backward: (p, i) => inverseWord(p.words[(i - 1 + p.n) % p.n]),
    startNode: (p, v) => v,
  },
  "H/M": {
    minorMod: 60,
    majorMod: 24,
    print: hsm.print,
    target: (unit, v) => hsmTarget(unit === "minor" ? "M" : "H", v),
    build(views) {
      const unit = (view, letter, range) => (onState) =>
        hsmPairUnit(
          new HsmController(view, hsm, {}, letter, onState, assets),
          range,
        );
      return new PairController({
        minorModulus: 60,
        majorModulus: 24,
        createMinor: unit(views.minor, "M", 59),
        createMajor: unit(views.major, "H", 23),
      });
    },
    stateOf: (pair, unit) => pair[unit].controller.state,
    period(unit, direction = 1) {
      const letter = unit === "minor" ? "M" : "H",
        maximum = unit === "minor" ? 59 : 23,
        p = hsmRaw.periods.find(
          (x) =>
            x.letter === letter &&
            x.maximum === maximum &&
            x.direction === direction,
        );
      return { setup: p.setup, words: p.words, n: p.words.length, maximum };
    },
    forward: (p, i) => p.words[i % p.n],
    startNode: (p, v, direction = 1) =>
      direction === 1 ? v : (p.maximum + 1 - v) % (p.maximum + 1),
  },
};

const at = (text) => {
  const [major, minor] = text.split(":").map(Number);
  return { major, minor, value: major * 60 + minor };
};
const label = ({ major, minor }) =>
  `${String(major).padStart(2, "0")}:${String(minor).padStart(2, "0")}`;
const text = (moves) => moves.join(" ");

/**
 * A pair under test plus its independent model. `model[unit]` is the pose
 * reached by replaying the recorded turns from the pose built in this file.
 */
async function rig(set, from, direction = 1) {
  const views = { minor: makeView(), major: makeView() };
  const pair = set.build(views);
  await pair.configure(from, direction);
  const start = (unit, value) => {
    const p = set.period(unit, direction);
    let state = applyMoves(initialState(set.print), parseAlg(p.setup));
    const node = set.startNode(p, value, direction);
    for (let i = 0; i < node; i++)
      state = applyMoves(state, parseAlg(p.words[i]));
    return { state, node };
  };
  const major = start("major", Math.floor(from / 60)),
    minor = start("minor", from % 60);
  const r = {
    set,
    pair,
    views,
    direction,
    model: { minor: minor.state, major: major.state },
    node: { minor: minor.node, major: major.node },
    // Segment of turns played since the last check, per unit.
    take() {
      const out = {};
      for (const unit of ["minor", "major"]) {
        out[unit] = views[unit].log.splice(0);
        r.model[unit] = applyMoves(r.model[unit], parseAlg(text(out[unit])));
      }
      return out;
    },
    /** Replay what was played and assert both displays show `value`. */
    check(value) {
      const segments = r.take();
      const want = { major: Math.floor(value / 60), minor: value % 60 };
      for (const unit of ["minor", "major"]) {
        assert.ok(
          matchesTarget(set.print, r.model[unit], set.target(unit, want[unit])),
          `${unit} shows ${want[unit]} after replay`,
        );
        assert.ok(
          stateEquals(r.model[unit], set.stateOf(pair, unit)),
          `${unit} replay equals the controller pose`,
        );
      }
      assert.equal(pair.value, value);
      assert.equal(pair.target, value);
      assert.equal(pair.busy, false);
      return segments;
    },
    /**
     * Step and assert that each moving cube played exactly the saved word of
     * its period (or the inverse for a decrement) and a still cube played
     * nothing. `carry` says whether the major cube moves.
     */
    async step(dir, carry) {
      const before = pair.value;
      await pair.step(dir);
      const value = (before + dir + pair.size) % pair.size;
      const segments = r.check(value);
      if (!carry) assert.deepEqual(segments.major, [], "no carry, no turn");
      for (const unit of carry ? ["minor", "major"] : ["minor"]) {
        assert.ok(segments[unit].length > 0, `${unit} turns`);
        const p = set.period(unit, r.direction),
          node = r.node[unit];
        if (set.backward) {
          // M/S: one saved period run both ways (decrement = inverse edge).
          const word = dir === 1 ? set.forward(p, node) : set.backward(p, node);
          assert.equal(text(segments[unit]), word, `${unit} saved word`);
          r.node[unit] = (node + dir + p.n) % p.n;
        } else if (dir === r.direction) {
          // H/M: the period of the counting direction, node by node.
          assert.equal(text(segments[unit]), set.forward(p, node), unit);
          r.node[unit] = (node + 1) % p.n;
        }
      }
      return segments;
    },
  };
  return r;
}

// ------------------------------------------------------------- the carry cases

const MS_CARRIES = [
  ["00:59", "01:00"],
  ["01:59", "02:00"],
  ["58:59", "59:00"],
  ["14:59", "15:00"],
  ["35:59", "36:00"],
  ["55:59", "56:00"],
];
const HM_CARRIES = [
  ["00:59", "01:00"],
  ["12:59", "13:00"],
];

for (const [name, cases] of [
  ["M/S", MS_CARRIES],
  ["H/M", HM_CARRIES],
]) {
  test(`${name}: carry up and its reverse down play the saved words`, async () => {
    const set = SETS[name];
    for (const [low, high] of cases) {
      const up = await rig(set, at(low).value, 1);
      const segs = await up.step(1, true);
      assert.equal(label(at(high)), label(fromValue(up.pair.value)), high);
      if (name === "M/S" && ["14:59", "35:59", "55:59"].includes(low))
        assert.equal(segs.major.length, 4, `${low} is a 4-HTM minutes edge`);
      // The reverse step, in M/S on the same period, undoes both words.
      const down = await rig(set, at(high).value, name === "M/S" ? 1 : -1);
      const back = await down.step(-1, true);
      assert.equal(label(fromValue(down.pair.value)), low);
      if (name === "M/S") {
        // The seconds cube may sit on its other lap, so only the 1-lap
        // minutes cube is compared with the inverse here; the rig has already
        // checked the exact saved word of both cubes.
        assert.equal(text(back.major), inverseWord(text(segs.major)));
      }
    }
  });
}

const fromValue = (value) => ({
  major: Math.floor(value / 60),
  minor: value % 60,
});

test("M/S: 59:00 -> 58:59 down carries and the display wraps both ways", async () => {
  const set = SETS["M/S"];
  const down = await rig(set, at("59:00").value, 1);
  await down.step(-1, true);
  assert.equal(label(fromValue(down.pair.value)), "58:59");
  // 59:59 -> 00:00 up: both cubes wrap, as one step.
  const up = await rig(set, at("59:59").value, 1);
  await up.step(1, true);
  assert.equal(up.pair.value, 0);
  // 00:00 -> 59:59 down: the exact inverse, both cubes wrap.
  const wrap = await rig(set, 0, 1);
  await wrap.step(-1, true);
  assert.equal(label(fromValue(wrap.pair.value)), "59:59");
});

test("H/M: 23:59 -> 00:00 up and 00:00 -> 23:59 down wrap the hours", async () => {
  const set = SETS["H/M"];
  const up = await rig(set, at("23:59").value, 1);
  await up.step(1, true);
  assert.equal(up.pair.value, 0);
  const down = await rig(set, 0, -1);
  await down.step(-1, true);
  assert.equal(label(fromValue(down.pair.value)), "23:59");
  const mid = await rig(set, at("13:00").value, -1);
  await mid.step(-1, true);
  assert.equal(label(fromValue(mid.pair.value)), "12:59");
});

// -------------------------------------------------------------- full sweeps

test("M/S: all 3600 values up (every word exact), then all 3600 down", async () => {
  const r = await rig(SETS["M/S"], 0, 1);
  for (let v = 1; v <= 3600; v++) {
    const carry = (v - 1) % 60 === 59;
    await r.step(1, carry);
  }
  assert.equal(r.pair.value, 0, "a full 59:59 lap wraps to 00:00");
  for (let v = 0; v < 3600; v++) {
    const carry = (3600 - v) % 60 === 0;
    await r.step(-1, carry);
  }
  assert.equal(r.pair.value, 0);
});

test("H/M: all 1440 values up and all 1440 down on the saved periods", async () => {
  const up = await rig(SETS["H/M"], 0, 1);
  for (let v = 1; v <= 1440; v++) await up.step(1, (v - 1) % 60 === 59);
  assert.equal(up.pair.value, 0);
  const down = await rig(SETS["H/M"], 0, -1);
  for (let v = 0; v < 1440; v++) await down.step(-1, (1440 - v) % 60 === 0);
  assert.equal(down.pair.value, 0);
});

test("H/M: reversing the direction mid-count still shows every value", async () => {
  const r = await rig(SETS["H/M"], at("12:58").value, 1);
  for (const dir of [1, 1, -1, -1, -1, 1]) {
    await r.pair.step(dir);
    r.check(r.pair.value);
  }
  assert.equal(label(fromValue(r.pair.value)), "12:58");
});

// ------------------------------------------------------------------ Set, Reset

for (const [name, from, to] of [
  ["M/S", "00:50", "01:10"],
  ["M/S", "30:30", "29:10"],
  ["M/S", "59:50", "00:10"],
  ["H/M", "12:50", "13:10"],
  ["H/M", "23:50", "00:10"],
  ["H/M", "00:10", "23:50"],
]) {
  test(`${name}: set ${from} -> ${to} walks across the carry and shows the target`, async () => {
    const set = SETS[name];
    const r = await rig(set, at(from).value, 1);
    await r.pair.set(at(to).value);
    r.check(at(to).value);
  });
}

test("M/S: set and reset land on period nodes with the fewest HTM", async () => {
  const set = SETS["M/S"];
  const r = await rig(set, at("00:50").value, 1);
  await r.pair.set(at("01:10").value);
  const segs = r.take();
  // Independent: node poses of the unit's saved run, built here.
  for (const unit of ["minor", "major"]) {
    const p = set.period(unit);
    const key = poseKey(r.model[unit]);
    let state = applyMoves(initialState(set.print), parseAlg(p.setup));
    const nodes = [];
    for (let i = 0; i < p.n; i++) {
      nodes.push(poseKey(state));
      state = applyMoves(state, parseAlg(p.words[i]));
    }
    assert.ok(nodes.includes(key), `${unit} rests on a saved node`);
    // Cheapest walk from the start node to a node showing the target.
    const want = unit === "minor" ? 10 : 1,
      from = unit === "minor" ? 50 : 0,
      len = p.words.map((w) => parseAlg(w).length);
    let best = Infinity;
    for (let t = want; t < p.n; t += 60) {
      let fwd = 0,
        bwd = 0;
      for (let k = from; k !== t; k = (k + 1) % p.n) fwd += len[k];
      for (let k = from; k !== t; k = (k - 1 + p.n) % p.n)
        bwd += len[(k - 1 + p.n) % p.n];
      best = Math.min(best, fwd, bwd);
    }
    assert.equal(segs[unit].length, best, `${unit} walks ${best} HTM`);
  }
  await r.pair.reset();
  r.check(0);
  await r.pair.reset(at("15:00").value);
  r.check(at("15:00").value);
});

test("H/M: reset returns to 00:00 through legal turns only", async () => {
  const r = await rig(SETS["H/M"], at("18:42").value, 1);
  await r.pair.reset();
  r.check(0);
});

// ---------------------------------------------------- parallel carry and settle

for (const [name, low] of [
  ["M/S", "35:59"],
  ["H/M", "12:59"],
]) {
  test(`${name}: a carry turns both cubes in parallel and settles only when both are done`, async () => {
    const set = SETS[name];
    const r = await rig(set, at(low).value, 1);
    r.views.minor.hold = r.views.major.hold = true;
    let done = false;
    const p = r.pair.step(1).then(() => (done = true));
    await flush();
    // Both cubes started their first turn before either finished anything.
    assert.equal(r.views.minor.started, 1);
    assert.equal(r.views.major.started, 1);
    assert.equal(r.pair.minor.busy, true);
    assert.equal(r.pair.major.busy, true);
    assert.equal(r.pair.busy, true);
    assert.equal(r.pair.value, at(low).value, "last settled value");
    assert.equal(r.pair.target, at(low).value + 1);
    // Let the minor cube finish its whole word; hold the major cube.
    r.views.minor.release();
    await flush();
    assert.equal(r.pair.minor.busy, false, "the minor cube has settled");
    assert.equal(r.pair.major.busy, true);
    assert.equal(done, false, "the pair waits for the major cube");
    assert.equal(r.pair.busy, true);
    r.views.major.release();
    await p;
    assert.equal(done, true);
    assert.equal(r.pair.busy, false);
    assert.equal(r.pair.minor.busy || r.pair.major.busy, false);
    assert.equal(r.pair.value, at(low).value + 1);
    r.check(at(low).value + 1);
  });
}

// ------------------------------------------------------------------ retargeting

for (const [name, low] of [
  ["M/S", "55:59"],
  ["H/M", "12:59"],
]) {
  test(`${name}: a newer target during a carry replaces the pending one`, async () => {
    const set = SETS[name];
    const r = await rig(set, at(low).value, 1);
    r.views.minor.hold = r.views.major.hold = true;
    const first = r.pair.step(1);
    await flush();
    assert.equal(r.views.minor.started, 1);
    assert.equal(r.views.major.started, 1);
    const turned = {
      minor: [...r.views.minor.log],
      major: [...r.views.major.log],
    };
    // Retarget to the old value, then to a far one, while both turns run.
    const target = at(name === "M/S" ? "57:30" : "14:30").value;
    const second = r.pair.set(at(low).value);
    const third = r.pair.set(target);
    assert.equal(r.pair.target, target);
    r.views.minor.release();
    r.views.major.release();
    await Promise.all([first, second, third]);
    assert.equal(r.pair.value, target);
    const segments = r.check(target);
    // The turn in flight when the newer target arrived was played, and it is
    // the first turn of the saved carry word (never an invented turn).
    for (const unit of ["minor", "major"])
      assert.equal(segments[unit][0], turned[unit][0], `${unit} first turn`);
  });

  test(`${name}: retargeting back to the start undoes the partial carry`, async () => {
    const set = SETS[name];
    const r = await rig(set, at(low).value, 1);
    r.views.minor.hold = r.views.major.hold = true;
    const p = r.pair.step(1);
    await flush();
    const back = r.pair.set(at(low).value);
    r.views.minor.release();
    r.views.major.release();
    await Promise.all([p, back]);
    assert.equal(r.pair.value, at(low).value);
    r.check(at(low).value);
  });
}

// ------------------------------------------------------------ contract and API

test("the pair rejects invalid input and a configure while busy", async () => {
  const set = SETS["M/S"];
  const r = await rig(set, 0, 1);
  assert.equal(r.pair.size, 3600);
  for (const bad of [0, 2, NaN, "1"]) assert.throws(() => r.pair.step(bad));
  for (const bad of [-1, 3600, 1.5, NaN]) assert.throws(() => r.pair.set(bad));
  r.views.minor.hold = true;
  const p = r.pair.step(1);
  await flush();
  await assert.rejects(r.pair.configure(0));
  r.views.minor.release();
  await p;
});

test("the pair is generic in the moduli and the cube units (fake units)", async () => {
  // 7 minor values, 5 major values: no controller, no print.
  const units = [];
  const make = (onState) => {
    const unit = {
      busy: false,
      currentValue: 0,
      desired: 0,
      requests: [],
      direction: 1,
      async configure(v) {
        unit.currentValue = unit.desired = v;
      },
      setDirection(d) {
        unit.direction = d;
      },
      request(v) {
        unit.requests.push(v);
        unit.desired = v;
        if (unit.busy) return;
        unit.busy = true;
        onState(unit.currentValue, true);
        setImmediate(() => {
          unit.currentValue = unit.desired;
          unit.busy = false;
          onState(unit.currentValue, false);
        });
      },
      dispose() {},
    };
    units.push(unit);
    return unit;
  };
  const states = [];
  const pair = new PairController({
    minorModulus: 7,
    majorModulus: 5,
    createMinor: make,
    createMajor: make,
    onState: (s) => states.push(s),
  });
  const [minor, major] = units;
  assert.equal(pair.size, 35);
  await pair.configure(6, 1);
  await pair.step(1); // 0:6 -> 1:0
  assert.deepEqual(
    [pair.value, minor.currentValue, major.currentValue],
    [7, 0, 1],
  );
  await pair.configure(0, 1);
  await pair.step(-1); // 0:0 -> 4:6
  assert.deepEqual([minor.currentValue, major.currentValue], [6, 4]);
  assert.equal(minor.direction, -1);
  assert.equal(major.direction, -1);
  await pair.set(34);
  await pair.step(1);
  assert.equal(pair.value, 0, "the major unit wraps at its modulus");
  assert.equal(pair.busy, false);
  assert.ok(states.length > 0 && states.at(-1).busy === false);
  // A non-carry step leaves the major unit alone.
  const before = major.requests.length;
  await pair.step(1);
  assert.equal(pair.value, 1);
  assert.equal(major.requests.length, before, "no request to the major unit");
  // Two steps without waiting accumulate on the pending target.
  const a = pair.step(1),
    b = pair.step(1);
  assert.equal(pair.target, 3);
  await Promise.all([a, b]);
  assert.equal(pair.value, 3);
});
