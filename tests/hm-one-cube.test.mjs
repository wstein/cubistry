// H/M one-cube counter (print m3-SH, research PR #133) application regressions.
//
// These tests replay the pinned data in the app's own mechanics model
// (@cubistry/cube-mechanics) and through the real controller. They are app
// regression tests, NOT proofs: the research claims rest on the Julia and
// Flix checkers of research/hm-counter-3move, whose receipts are pinned here.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validateHsmDesign,
  hsmTarget,
  HSM_VARIANT,
} from "../src/apps/hsm/design.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { HsmPlanner } from "../src/apps/hsm/planner.ts";
import { HsmRecovery } from "../src/apps/hsm/recovery.ts";
import { HsmPeriods } from "../src/apps/hsm/periods.ts";
import { HM_VARIANT, hmImages } from "../src/apps/hm/variant.ts";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
  inverseMoves,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
import {
  check,
  build,
  HM_COUNTING_MODES,
} from "../scripts/prepare-hm.mjs";
import {
  convertWitness,
  sha256,
  inverseWord,
} from "../scripts/hm/convert-witness.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const pin = json("hm-source.json");
const raw = json(pin.runtimePath);
const witness = json(pin.convertedPath);
const design = validateHsmDesign(raw, HM_VARIANT);

/** Research figures for m3-SH (README and receipts of PR #133 at the pin). */
const RESEARCH = [
  { letter: "M", maximum: 59, edges: 60, total: 163, max: 3, at4: 0, hist: { 1: 4, 2: 9, 3: 47 } },
  { letter: "H", maximum: 23, edges: 24, total: 73, max: 4, at4: 5, hist: { 1: 0, 2: 4, 3: 15, 4: 5 } },
  { letter: "H", maximum: 11, edges: 12, total: 40, max: 4, at4: 5, hist: { 1: 0, 2: 1, 3: 6, 4: 5 } },
];
const H_SETUP = "U' B2 U B";

const FRONT = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
/** Explicit front-face read-out: blank upper-left, upright letter and digits. */
function assertShows(state, letter, value, label) {
  const poses = stickerPoses(design.print, state);
  const want = ["blank", letter, ...String(value).padStart(2, "0")];
  FRONT.forEach((p, cell) => {
    const seen = poses.filter(
      (s) =>
        JSON.stringify(s.p) === JSON.stringify(p) &&
        JSON.stringify(s.n) === "[0,0,1]",
    );
    assert.equal(seen.length, 1, label);
    assert.equal(seen[0].assetId, want[cell], `${label} cell ${cell}`);
    if (want[cell] !== "blank")
      assert.deepEqual(seen[0].up, [0, 1, 0], `${label} upright ${cell}`);
  });
  assert.ok(matchesTarget(design.print, state, hsmTarget(letter, value)));
}
const period = (letter, maximum, direction) =>
  design.periods.find(
    (p) =>
      p.letter === letter && p.maximum === maximum && p.direction === direction,
  );
const value = (direction, i, n) => (((direction * i) % n) + n) % n;
const sum = (a) => a.reduce((x, y) => x + y, 0);

// ------------------------------------------------------------ data and pins

test("pins, research copies, converted witness and runtime are current", () => {
  assert.equal(pin.commit, "44ca982d9e15dc28c62ba105f47f62a26cf8d261");
  assert.equal(pin.branch, "research/hm-counter-3move");
  assert.equal(pin.print, "m3-SH");
  check(pin);
  const { converted, runtime } = build(pin);
  assert.equal(sha256(converted), pin.convertedSHA256);
  assert.equal(sha256(runtime), pin.runtimeSHA256);
  // Both native receipts are byte-identical and name the pinned witness.
  const files = pin.researchFiles;
  const R = "research/hm-counter-3move/evidence/";
  assert.equal(
    files[`${R}receipt-blank-m3-SH.julia.tsv`],
    files[`${R}receipt-blank-m3-SH.flix.tsv`],
  );
  assert.equal(witness.source.sha256, files[`${R}witness-blank-m3-SH.tsv`]);
  assert.equal(witness.source.commit, pin.commit);
});

test("the print is m3-SH: three blanks, H twice, M three times, tens 0-5, units 0-9", () => {
  assert.equal(
    witness.printCode,
    "H U3 U7 | T2 _ T0 | T3 _ T1 | T4 T5 _ | U9 H U5 | M U8 U0 | U6 M U2 | U4 U1 M",
  );
  const glyphs = (slot) =>
    witness.printing
      .filter((s) => s.slot === slot && s.image !== "")
      .map((s) => s.image)
      .sort();
  assert.deepEqual(glyphs(1), ["H", "H", "M", "M", "M"]);
  assert.deepEqual(glyphs(2), [..."012345"]);
  assert.deepEqual(glyphs(3), [..."0123456789"]);
  const blanks = witness.printing.filter((s) => s.image === "");
  assert.equal(blanks.length, 3);
  // Three blanks on three corners, each next to two tens digits.
  assert.equal(new Set(blanks.map((s) => s.cubie)).size, 3);
  for (const b of blanks)
    assert.deepEqual(
      witness.printing
        .filter((s) => s.cubie === b.cubie && s !== b)
        .map((s) => s.slot),
      [2, 2],
    );
  assert.equal(
    design.print.stickers.filter((s) => s.assetId === "blank").length,
    3,
  );
  assert.equal(design.print.id, "hm_counter_m3_sh");
  assert.deepEqual(
    hmImages.map((i) => i.id),
    ["H", "M"],
  );
});

test("research numbers: totals, maxima, histograms and edge limit", () => {
  assert.equal(witness.edgeLimitHTM, 4);
  assert.equal(raw.edgeLimitHTM, HM_VARIANT.edgeLimit);
  for (const r of RESEARCH) {
    const m = witness.modes.find(
      (x) => x.letter === r.letter && x.maximum === r.maximum,
    );
    assert.equal(m.periodEdges, r.edges);
    assert.equal(m.laps, 1);
    assert.equal(m.preperiodEdges, 0);
    assert.equal(m.periodHTM, r.total);
    assert.equal(m.maximumHTM, r.max);
    assert.deepEqual(m.histogram, r.hist);
    assert.equal(m.steps.filter((s) => s.htm === 4).length, r.at4);
    for (const s of m.steps) assert.ok(s.htm >= s.lowerBound);
  }
});

// -------------------------------------------- every edge in the app mechanics

test("every period edge of every mode replays in the app mechanics, up and down", () => {
  assert.equal(design.periods.length, HM_COUNTING_MODES.length);
  for (const r of RESEARCH) {
    const up = period(r.letter, r.maximum, 1),
      down = period(r.letter, r.maximum, -1),
      n = r.maximum + 1,
      label = `${r.letter}/${r.maximum}`;
    assert.ok(up && down, label);
    assert.equal(up.traversal, "forward");
    assert.equal(down.traversal, "inverse");
    assert.equal(up.maximumHTM, r.max);
    assert.equal(down.maximumHTM, r.max);
    assert.ok(r.max <= HM_VARIANT.edgeLimit);
    // Up: node i shows i, every word within the mode's own maximum.
    const start = applyMoves(initialState(design.print), parseAlg(up.setup));
    let state = start;
    const nodes = [];
    const lengths = up.words.map((word, i) => {
      nodes.push(state);
      assertShows(state, r.letter, value(1, i, n), `${label} node ${i}`);
      const moves = parseAlg(word);
      assert.ok(moves.length >= 1 && moves.length <= r.max, `${label} edge ${i}`);
      const next = applyMoves(state, moves);
      // Exact inverse: undoing the word returns the full previous pose.
      assert.ok(stateEquals(applyMoves(next, inverseMoves(moves)), state));
      state = next;
      return moves.length;
    });
    // Closure at the period boundary: the exact full 24-sticker state.
    assert.ok(stateEquals(state, start), `${label} closes`);
    assertShows(state, r.letter, 0, `${label} wrap`);
    assert.equal(sum(lengths), r.total, label);
    assert.equal(up.periodHTM, r.total);
    assert.equal(Math.max(...lengths), r.max);
    // The period is minimal: no full pose repeats inside it.
    assert.equal(
      new Set(nodes.map((s) => JSON.stringify(s.cubies))).size,
      nodes.length,
    );
    // Down: the same poses in reverse order, every word the inverse.
    assert.equal(down.setup, up.setup);
    assert.deepEqual(
      down.words,
      up.words.slice().reverse().map(inverseWord),
    );
    state = start;
    down.words.forEach((word, i) => {
      assertShows(state, r.letter, value(-1, i, n), `${label} down ${i}`);
      assert.ok(stateEquals(state, nodes[(n - i) % n]), `${label} down pose ${i}`);
      const moves = parseAlg(word);
      assert.ok(moves.length <= r.max);
      state = applyMoves(state, moves);
    });
    assert.ok(stateEquals(state, start), `${label} down closes`);
  }
});

test("setups: M00 is the reference print state, H00 is four HTM away and not a counted step", () => {
  const home = initialState(design.print);
  assertShows(home, "M", 0, "reference");
  assert.equal(design.zeroWords.M, "");
  assert.equal(design.zeroWords.H, H_SETUP);
  assert.equal(parseAlg(H_SETUP).length, 4);
  assertShows(applyMoves(home, parseAlg(H_SETUP)), "H", 0, "H setup");
  for (const p of design.periods)
    assert.equal(p.setup, p.letter === "M" ? "" : H_SETUP);
  // Both hour periods start on the same H00 pose.
  const periods = new HsmPeriods(design.print, design.periods);
  assert.ok(
    stateEquals(periods.poseFor("H", 23, 1, 0), periods.poseFor("H", 11, 1, 0)),
  );
});

// ----------------------------------------------------- the real controller

const view = { configure() {}, animate: async () => {}, resetCamera() {} };
const dispose = async () => ({ dispose() {} });
const settled = async (c) => {
  for (let n = 0; c.busy && n < 100; n++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};
async function costs(letter, maximum, direction, laps) {
  const c = new HsmController(view, design, {}, letter, () => {}, dispose);
  c.setMode(maximum, direction);
  await c.configure();
  const out = [];
  for (let i = 0; i < laps * (maximum + 1); i++) {
    const target = (c.currentValue + direction + maximum + 1) % (maximum + 1),
      before = c.progress.sessionTotal;
    c.request(target);
    await settled(c);
    assert.equal(c.currentValue, target);
    assertShows(c.state, letter, target, `${letter}/${maximum} -> ${target}`);
    out.push(c.progress.sessionTotal - before);
  }
  c.dispose();
  return out;
}

test("three laps up and down per mode through the controller cost the research laps", async () => {
  for (const r of RESEARCH)
    for (const direction of [1, -1]) {
      const n = r.maximum + 1,
        out = await costs(r.letter, r.maximum, direction, 3),
        label = `${r.letter}/${r.maximum}/${direction}`;
      for (let lap = 0; lap < 3; lap++)
        assert.equal(sum(out.slice(lap * n, (lap + 1) * n)), r.total, label);
      assert.equal(Math.max(...out), r.max, label);
    }
});

test("unit change sets up 00; Set and Reset are free jumps that return to the period", async () => {
  const c = new HsmController(view, design, {}, "M", () => {}, dispose);
  c.setMode(59, 1);
  await c.configure();
  assert.equal(c.progress.sessionTotal, 0);
  assertShows(c.state, "M", 0, "M fresh");
  for (const target of [33, 58, 0, 17]) {
    const before = c.progress.sessionTotal;
    c.request(target);
    await settled(c);
    assertShows(c.state, "M", target, `jump ${target}`);
    assert.ok(c.progress.sessionTotal - before <= HM_VARIANT.jumpBound);
    // Counting on after the jump reaches the period within a few steps.
    const periods = new HsmPeriods(design.print, design.periods);
    let steps = 0;
    while (periods.nodeOf("M", 59, 1, c.state) < 0 && steps < 10) {
      c.request((c.currentValue + 1) % 60);
      await settled(c);
      steps++;
    }
    assert.ok(periods.nodeOf("M", 59, 1, c.state) >= 0, `recovered after ${target}`);
  }
  c.dispose();
  // The H controller of a unit change installs the H00 period pose directly.
  const h = new HsmController(view, design, {}, "H", () => {}, dispose);
  h.setMode(11, 1);
  await h.configure();
  assert.equal(h.progress.sessionTotal, 0);
  assertShows(h.state, "H", 0, "H fresh");
  assert.ok(
    stateEquals(
      h.state,
      applyMoves(initialState(design.print), parseAlg(H_SETUP)),
    ),
  );
  // Ranges are per letter: M only 00-59, H 00-23 or 00-11; no S on this print.
  assert.throws(() => h.setMode(59, 1));
  const m = new HsmController(view, design, {}, "M", () => {}, dispose);
  assert.throws(() => m.setMode(23, 1));
  assert.throws(() => new HsmController(view, design, {}, "S", () => {}, dispose));
});

test("free jumps from settled poses stay within the graph-radius cap", () => {
  const planner = new HsmPlanner(HM_VARIANT.jumpBound);
  const recovery = new HsmRecovery(
    design.print,
    planner,
    HM_VARIANT.edgeLimit,
    HM_VARIANT.jumpBound,
  );
  const periods = new HsmPeriods(design.print, design.periods);
  let worst = 0;
  for (const [letter, maximum] of [
    ["M", 59],
    ["H", 23],
    ["H", 11],
  ]) {
    let state = periods.poseFor(letter, maximum, 1, 0);
    for (let k = 0; k < 40; k++) {
      const target = (k * 37 + 11) % (maximum + 1);
      const word =
        recovery.jump(state, letter, maximum, 1, target, (v) =>
          periods.nodesShowing(letter, maximum, 1, v),
        ) ?? planner.plan(design.print, state, letter, target);
      worst = Math.max(worst, word.length);
      state = applyMoves(state, word);
      assertShows(state, letter, target, `jump ${letter}${target}`);
    }
  }
  assert.ok(worst <= HM_VARIANT.jumpBound);
});

// ------------------------------------------- step length after a free jump

/**
 * Replay: from the settled 00 pose, Set every value, then count on for one lap
 * in `direction`. Returns the HTM of every counting step (not the Set).
 */
async function stepsAfterEverySet(letter, maximum, direction) {
  const n = maximum + 1,
    out = [];
  for (let set = 0; set < n; set++) {
    const c = new HsmController(view, design, {}, letter, () => {}, dispose);
    c.setMode(maximum, direction);
    await c.configure();
    c.request(set);
    await settled(c);
    for (let i = 0; i < n; i++) {
      const before = c.progress.sessionTotal;
      c.request((c.currentValue + direction + n) % n);
      await settled(c);
      out.push({ set, cost: c.progress.sessionTotal - before });
    }
    c.dispose();
  }
  return out;
}

test("step length: period steps stay within 3 (M) or 4 (H); steps after a free jump can take 5", async () => {
  const docText = readFileSync("docs/HM_ONE_CUBE_COUNTER.md", "utf8"),
    help = /hsm-help"\)\.textContent = hm\s*\? "([^"]+)"/.exec(
      readFileSync("src/main.mjs", "utf8"),
    )?.[1];
  assert.ok(help, "H/M help text found in src/main.mjs");
  // Measured by replaying the controller (see the doc): [letter, maximum,
  // direction, steps above 3, steps at 5, a Set value, its first three steps].
  for (const [letter, maximum, direction, above3, at5, set, afterSet] of [
    ["M", 59, 1, 252, 2, 20, [5, 4, 2]],
    ["M", 59, -1, 254, 1, 12, [5, 4, 4]],
    ["H", 23, -1, 195, 3, 2, [4, 5, 4]],
  ]) {
    const label = `${letter}/${maximum}/${direction}`,
      steps = await stepsAfterEverySet(letter, maximum, direction),
      costs = steps.map((s) => s.cost);
    // Worst case after a jump is 5 HTM, never more (a replay, not a proof).
    assert.equal(Math.max(...costs), 5, label);
    assert.equal(costs.filter((c) => c > 3).length, above3, label);
    assert.deepEqual(
      steps.filter((s) => s.set === set).slice(0, 3).map((s) => s.cost),
      afterSet,
      label,
    );
    // "At most four" is false after a jump: a few steps cost exactly 5.
    assert.equal(costs.filter((c) => c === 5).length, at5, label);
  }
  // The period itself keeps its limits: M at most 3, H at most 4.
  assert.equal(period("M", 59, 1).maximumHTM, 3);
  assert.equal(period("H", 23, 1).maximumHTM, 4);
  assert.equal(period("H", 11, 1).maximumHTM, 4);
  // Help text and doc tell the measured truth, not the period-only claim.
  assert.match(help, /rarely five/);
  assert.match(help, /first steps may cost more/);
  assert.doesNotMatch(help, /Counting steps take at most four moves/);
  assert.match(docText, /up to\s+\*\*5 HTM\*\*/);
  assert.match(docText, /252/);
  assert.match(docText, /254/);
});

test("recovery after a free jump honors the variant's edge limit 4 where a 4-HTM route exists", async () => {
  // Replayed from every Set value: these three cases never need a step above 4
  // (H 00-23 up with the default recovery limit 5 takes 39 steps at 5 HTM).
  for (const [letter, maximum, direction] of [
    ["H", 23, 1],
    ["H", 11, 1],
    ["H", 11, -1],
  ]) {
    const steps = await stepsAfterEverySet(letter, maximum, direction);
    assert.equal(steps.length, (maximum + 1) ** 2);
    assert.ok(
      Math.max(...steps.map((s) => s.cost)) <= HM_VARIANT.edgeLimit,
      `${letter}/${maximum}/${direction}`,
    );
  }
});

test("recovery: a pose with no 4-HTM route to the next value takes its shortest word (5) as the first step", () => {
  const recovery = new HsmRecovery(
      design.print,
      new HsmPlanner(HM_VARIANT.jumpBound),
      HM_VARIANT.edgeLimit,
      HM_VARIANT.jumpBound,
    ),
    periods = new HsmPeriods(design.print, design.periods);
  // Poses off the period that show the value but need exactly 5 HTM to show
  // the next one (found by search over short scrambles of the print).
  for (const [scramble, value, direction] of [
    ["L B", 50, -1],
    ["U2 R D2 U2", 57, 1],
  ]) {
    const state = applyMoves(initialState(design.print), parseAlg(scramble));
    assert.ok(matchesTarget(design.print, state, hsmTarget("M", value)));
    assert.equal(periods.nodeOf("M", 59, direction, state), -1);
    const plan = recovery.plan(state, "M", 59, direction, value, (v) =>
      periods.nodesShowing("M", 59, direction, v),
    );
    assert.ok(plan, `${scramble}: a plan exists`);
    assert.equal(plan.words[0].length, 5, `${scramble}: first step`);
    const next = applyMoves(state, plan.words[0]);
    assert.ok(
      matchesTarget(
        design.print,
        next,
        hsmTarget("M", (value + direction + 60) % 60),
      ),
    );
  }
});

test("free-jump cap 7 is not slack: a least route of 7 HTM exists, and cap 6 refuses or shortchanges it", () => {
  assert.equal(HM_VARIANT.jumpBound, 7);
  const make = (bound) =>
      new HsmRecovery(
        design.print,
        new HsmPlanner(bound),
        HM_VARIANT.edgeLimit,
        bound,
      ),
    periods = new HsmPeriods(design.print, design.periods),
    capped = make(HM_VARIANT.jumpBound),
    lower = make(6);
  // Poses found by search over short scrambles of the print; each has a display
  // that no route shorter than 7 HTM reaches. Sampled jumps from settled poses
  // need at most 6, but that is a sample, not a bound.
  for (const [scramble, letter, maximum, target] of [
    ["U2 B' U'", "H", 23, 15],
    ["L2 B R F'", "H", 23, 17],
    ["U' D D2 R U'", "H", 11, 5],
  ]) {
    const state = applyMoves(initialState(design.print), parseAlg(scramble)),
      nodes = (v) => periods.nodesShowing(letter, maximum, 1, v),
      word = capped.jump(state, letter, maximum, 1, target, nodes);
    assert.equal(word?.length, 7, scramble);
    assert.ok(
      matchesTarget(
        design.print,
        applyMoves(state, word),
        hsmTarget(letter, target),
      ),
      scramble,
    );
    assert.equal(lower.jump(state, letter, maximum, 1, target, nodes), null);
  }
  // The search also looks one step beyond the least length for a route that
  // lets counting continue within the edge limit: here the least route is 6 HTM,
  // the chosen route 7 HTM, and the next step from it needs at most 4 HTM.
  const state = applyMoves(initialState(design.print), parseAlg("L2 U2 U U' B")),
    nodes = (v) => periods.nodesShowing("H", 23, 1, v),
    word = capped.jump(state, "H", 23, 1, 23, nodes);
  assert.equal(word?.length, 7);
  const landed = applyMoves(state, word);
  assert.ok(matchesTarget(design.print, landed, hsmTarget("H", 23)));
  assert.ok(capped.shortest(capped.encode(landed), "H", 0) <= HM_VARIANT.edgeLimit);
  assert.equal(lower.jump(state, "H", 23, 1, 23, nodes)?.length, 6);
});

// ------------------------------------------------------- negative controls

test("negative controls: wrong variant, corrupted runtime and tampered witness are rejected", () => {
  // The H/M runtime is not an H/S/M runtime and vice versa.
  assert.throws(() => validateHsmDesign(structuredClone(raw)), /another counter variant|Missing HSM setup|Invalid/);
  assert.throws(
    () => validateHsmDesign(json("public/hsm-counter.v3.json"), HM_VARIANT),
    /another counter variant/,
  );
  assert.equal(HSM_VARIANT.edgeLimit, 5);
  const length = (words) => words.reduce((n, w) => n + parseAlg(w).length, 0);
  for (const [mutate, reason] of [
    [(d) => (d.periods[0].maximumHTM = 4), /HSM period maximum mismatch/],
    [(d) => (d.edgeLimitHTM = 5), /another counter variant/],
    [(d) => (d.letters = ["H", "S", "M"]), /another counter variant/],
    [(d) => (d.printing[0].image = "S"), /Invalid immutable HSM glyph/],
    [(d) => (d.periods[0].words[5] = "R"), /HSM period node shows the wrong value/],
    [(d) => d.periods[2].words.pop(), /Invalid HSM period/],
    [(d) => (d.zeroWords.H = ""), /Invalid HSM setup/],
    [
      // Same poses, but one H 00-23 word padded to five HTM: above the limit 4.
      (d) => {
        d.periods[2].words[0] += " U U'";
        d.periods[2].periodHTM = length(d.periods[2].words);
        d.periods[2].maximumHTM = 5;
      },
      /HSM period edge too long/,
    ],
    [
      (d) => {
        d.periods[0].words[0] += " U U'";
        d.periods[0].periodHTM = length(d.periods[0].words);
      },
      /HSM period maximum mismatch/,
    ],
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateHsmDesign(d, HM_VARIANT), reason);
  }
  // The range is checked per letter: M only 59, H only 23 or 11, even when the
  // modulus fits the word count and the letter is allowed.
  for (const [index, letter, maximum] of [
    [2, "M", 23], // an hours period relabeled as minutes
    [0, "H", 59], // the minutes period relabeled as hours
    [3, "M", 11],
  ]) {
    const d = structuredClone(raw);
    d.periods[index].letter = letter;
    d.periods[index].maximum = maximum;
    assert.throws(
      () => validateHsmDesign(d, HM_VARIANT),
      /Invalid HSM period/,
      `${letter}${maximum}`,
    );
  }
  assert.doesNotThrow(() => validateHsmDesign(structuredClone(raw), HM_VARIANT));

  // The converter refuses tampered research bytes.
  const read = (r) => readFileSync(pin.copies[r], "utf8");
  const R = "research/hm-counter-3move/evidence/";
  const tsv = read(`${R}witness-blank-m3-SH.tsv`);
  const meta = {
    label: "m3-SH",
    source: {},
    receipts: {
      julia: read(`${R}receipt-blank-m3-SH.julia.tsv`),
      flix: read(`${R}receipt-blank-m3-SH.flix.tsv`),
    },
    checks: read(`${R}checks-blank-m3-SH.tsv`),
  };
  assert.doesNotThrow(() => convertWitness(tsv, meta));
  for (const [bad, reason] of [
    [tsv.replace("step\tM\t59\t5\t6\tR' B' R", "step\tM\t59\t5\t6\tR' B R"), /shows 6/],
    [tsv.replace("sticker\t4\t1\t-1,-1,1\t0,-1,0\t1,0,0\t_", "sticker\t4\t1\t-1,-1,1\t0,-1,0\t1,0,0\t7"), /shows|receipt/],
    [tsv.replace("mode\tH\t23\tU' B2 U B\t0\t24", "mode\tH\t23\t-\t0\t24"), /setup shows 00/],
    [tsv.replace("claim\tmaxEdgeHTM\t4", "claim\tmaxEdgeHTM\t3"), /claimed maximum/],
  ]) {
    assert.notEqual(bad, tsv);
    assert.throws(() => convertWitness(bad, meta), reason);
  }
  // A consistent but wrong receipt (both identical, digest re-recorded) must
  // still be refused when it disagrees on a single field of one mode.
  for (const [from, to, reason] of [
    [/(period\tH\t23\ttotal\t73\tmax\t)4/, "$13", /receipt agrees on H23/],
    [/(period\tM\t59\ttotal\t163\tmax\t)3/, "$14", /receipt agrees on M59/],
    [/(period\tH\t11\ttotal\t)40/, "$141", /receipt agrees on H11/],
  ]) {
    const receipt = meta.receipts.julia.replace(from, to);
    assert.notEqual(receipt, meta.receipts.julia);
    const checks = meta.checks.replace(
      /^receipts\tIDENTICAL\t[0-9a-f]+/,
      `receipts\tIDENTICAL\t${sha256(receipt)}`,
    );
    assert.throws(
      () => convertWitness(tsv, { ...meta, receipts: { julia: receipt, flix: receipt }, checks }),
      reason,
    );
  }
  assert.throws(
    () => convertWitness(tsv, { ...meta, receipts: { ...meta.receipts, flix: meta.receipts.flix + "x" } }),
    /byte-identical/,
  );
});

// ------------------------------------------------- physical reprint table

test("all 24 sticker identities differ from both earlier H/S/M prints", () => {
  const seconds = json("data/hsm/seconds-first/modes/witness.json").printing;
  const previous = json("tests/fixtures/hsm-blank-print.v2.json").printing;
  const same = (a, b) =>
    a.image === b.image &&
    (a.image === "" || JSON.stringify(a.up) === JSON.stringify(b.up));
  for (const old of [seconds, previous]) {
    let differ = 0;
    witness.printing.forEach((s, i) => {
      // The same 24 identities: corner and facelet.
      assert.deepEqual([s.cubie, s.p, s.n], [old[i].cubie, old[i].p, old[i].n]);
      if (!same(s, old[i])) differ++;
    });
    assert.equal(differ, 24);
  }
  // Glyph multisets: the seconds-first print has S x3, H, M where m3-SH has
  // H x2 and M x3; digits and blanks are the same multiset.
  const bag = (p) => p.map((s) => s.image || "_").sort().join("");
  assert.equal(bag(seconds).replace(/[HMS]/g, ""), bag(witness.printing).replace(/[HM]/g, ""));
  // By artwork, m3-SH needs exactly 3 glyphs that the seconds-first sheet lacks.
  const need = {};
  for (const s of witness.printing) need[s.image || "_"] = (need[s.image || "_"] ?? 0) + 1;
  for (const s of seconds) need[s.image || "_"] = (need[s.image || "_"] ?? 0) - 1;
  assert.equal(
    Object.values(need).filter((n) => n > 0).reduce((a, b) => a + b, 0),
    3,
  );
});
