// Pins and replays the seconds-first print: provenance, sticker changes, the
// closed counting periods, lap costs through the real controller and the
// three-cube live clock, and negative controls for each pin.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import { HsmPlanner } from "../src/apps/hsm/planner.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import { HsmPeriods, poseKey } from "../src/apps/hsm/periods.ts";
import { HsmRecovery } from "../src/apps/hsm/recovery.ts";
import { LiveClockScheduler } from "../src/apps/clock/scheduler.ts";
import { ClockMoveStatistics } from "../src/apps/clock/statistics.ts";
import {
  deriveRuntime,
  derivePrintSource,
  serialize,
  inverseWord,
  COUNTING_MODES,
} from "../scripts/derive-hsm-runtime.mjs";
import {
  applyMoves,
  initialState,
  inverseMoves,
  matchesTarget,
  parseAlg,
  stickerPoses,
  validatePresentation,
} from "../packages/cube-mechanics/src/index.ts";
import { stateEquals } from "../packages/cube-core/src/index.ts";

const sha = (bytes) => createHash("sha256").update(bytes).digest("hex");
const json = (path) => JSON.parse(readFileSync(path, "utf8"));
const pin = json("hsm-source.json");
const witnessBytes = readFileSync(pin.appCopy);
const witness = JSON.parse(witnessBytes);
const runtimeBytes = readFileSync(pin.runtimePath);
const raw = JSON.parse(runtimeBytes);
const design = validateHsmDesign(raw);
const recoveryTable = json("data/hsm/seconds-first/modes/recovery.json");
const blankRaw = json("tests/fixtures/hsm-blank-print.v2.json");
/** The nine letter/range pairs; each has one period per direction. */
const PAIRS = [
  ...new Map(COUNTING_MODES.map(([l, m]) => [`${l}/${m}`, [l, m]])).values(),
];
const planner = new HsmPlanner();

// ---------------------------------------------------------------- provenance

test("the witness copies and runtime file are pinned to the research commit", () => {
  // The all-mode research is a new branch on top of the long-lived research
  // branch, where the print landed with its independent review; the base and
  // the first publication stay recorded.
  assert.equal(pin.layoutBranch, "research/hsm-seconds-first-modes");
  assert.match(pin.layoutCommit, /^[0-9a-f]{40}$/);
  assert.equal(pin.layoutCommit, "30b6d022da60c366d79de5498497df0a07e28caf");
  assert.equal(pin.proofCommit, pin.layoutCommit);
  assert.deepEqual(
    [pin.basePublished.branch, pin.basePublished.commit],
    [
      "research/cube-display-feasibility",
      "4d9ef771305def5c4f6e9b1f2eec7689a03ed21b",
    ],
  );
  assert.deepEqual(
    [pin.firstPublished.branch, pin.firstPublished.commit],
    ["research/hsm-seconds-first", "24240a3b2dbd691de99d5bf1170b5695fc62a320"],
  );
  assert.equal(
    pin.layoutPath,
    "research/hsm-counter/seconds-first/modes/witness.json",
  );
  assert.equal(sha(witnessBytes), pin.layoutSHA256);
  assert.equal(pin.researchFiles[pin.layoutPath], pin.layoutSHA256);
  // Every copy under data/hsm is byte-identical to its research file.
  for (const [copy, path] of [
    [pin.appCopy, pin.layoutPath],
    [
      pin.recoveryCopy,
      "research/hsm-counter/seconds-first/modes/recovery.json",
    ],
    [pin.baseCopy, "research/hsm-counter/seconds-first/witness.json"],
  ])
    assert.equal(sha(readFileSync(copy)), pin.researchFiles[path], copy);
  assert.equal(witness.printCode, json(pin.baseCopy).printCode);
  assert.deepEqual(witness.printing, json(pin.baseCopy).printing);
  assert.equal(Object.keys(pin.researchFiles).length, 11);
  for (const [path, hash] of Object.entries(pin.researchFiles)) {
    assert.match(
      path,
      /^research\/hsm-counter\/seconds-first\/(modes\/)?[A-Za-z_.]+$/,
    );
    assert.match(hash, /^[0-9a-f]{64}$/);
  }
  // Original and recovery proof scopes are distinct; neither confirms the
  // application runtime or global print optimality. Keep metadata bound to
  // the unchanged raw recovery input and the matching native verdict.
  assert.match(
    pin.reviewStatus,
    /^CONFIRMED for the original witnesses and the recovery table/,
  );
  assert.match(pin.reviewStatus, /old hsm command remains UNSUPPORTED/);
  assert.match(pin.reviewStatus, /optimality is UNKNOWN/i);
  assert.match(pin.reviewStatus, /software-tested, not proven/);
  assert.match(pin.reviewStatus, /f71d4237/);
  assert.match(pin.reviewStatus, /5dd24dd7/);
  assert.match(
    pin.reviewStatus,
    /0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70/,
  );
  assert.equal(
    sha(readFileSync(pin.recoveryCopy)),
    "0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda",
  );
  assert.equal(sha(runtimeBytes), pin.runtimeSHA256);
  // The previous pin is kept as history and still names the old print.
  assert.equal(
    pin.supersedes.layoutSHA256,
    "13eea2a1ad88561775158a70633b80e25d06f883e42d44aafb4e6808699be47b",
  );
  assert.equal(
    sha(readFileSync("tests/fixtures/hsm-blank-print.v2.json")),
    pin.supersedes.runtimeSHA256,
  );
});

test("the runtime file is exactly what the pinned witness derives", () => {
  assert.equal(serialize(deriveRuntime(witness)), runtimeBytes.toString());
  assert.deepEqual(raw.printing, witness.printing);
  assert.equal(raw.version, 4);
  assert.deepEqual(
    raw.periods.map((p) => [p.letter, p.maximum, p.direction]),
    COUNTING_MODES,
  );
  assert.equal(COUNTING_MODES.length, 18);
  // Each letter's 00 setup is unchanged from the first four published periods,
  // so the print bundles' setup examples stay byte-identical.
  assert.deepEqual(
    [raw.zeroWords.S, raw.zeroWords.M, raw.zeroWords.H],
    [
      ["S", 59],
      ["M", 59],
      ["H", 23],
    ].map(
      ([l, m]) =>
        witness.modes.find(
          (w) => w.letter === l && w.maximum === m && w.direction === 1,
        ).setup,
    ),
  );
});

test("the frozen print source of the print sheets is unchanged and matches the runtime print", () => {
  const source = pin.printSource,
    bytes = readFileSync(source.path),
    base = readFileSync(source.derivedFrom);
  assert.equal(source.path, "public/hsm-counter.v2.json");
  assert.notEqual(source.path, pin.runtimePath);
  assert.equal(sha(bytes), source.sha256);
  // Byte for byte the file the seconds-first print sheets were built from.
  assert.equal(
    source.sha256,
    "32f0fdc7eb4aafdcfea64f6cf4f1f5b84e23b3bf41fcf635a96ae631bcd244ae",
  );
  assert.equal(sha(base), source.derivedFromSHA256);
  assert.equal(
    sha(base),
    pin.researchFiles["research/hsm-counter/seconds-first/witness.json"],
  );
  assert.equal(
    serialize(derivePrintSource(JSON.parse(base))),
    bytes.toString(),
  );
  for (const style of ["symbols", "words"]) {
    const m = json(`public/print/hsm-${style}-20mm-3sets/manifest.json`);
    assert.deepEqual(m.source, { path: source.path, sha256: source.sha256 });
  }
  const frozen = JSON.parse(bytes);
  assert.deepEqual(frozen.printing, raw.printing);
  assert.deepEqual(frozen.zeroWords, raw.zeroWords);
});

test("negative controls: a tampered witness, runtime or period is detected", () => {
  const tamper = (bytes) => {
    const copy = Buffer.from(bytes);
    copy[copy.length >> 1] ^= 1;
    return copy;
  };
  assert.notEqual(sha(tamper(witnessBytes)), pin.layoutSHA256);
  assert.notEqual(sha(tamper(runtimeBytes)), pin.runtimeSHA256);
  const edited = structuredClone(witness);
  edited.modes[0].steps[0].word = "R";
  assert.notEqual(serialize(deriveRuntime(edited)), runtimeBytes.toString());
  for (const mutate of [
    (w) => w.modes.splice(0, 1),
    (w) => (w.modes[0].steps[3].from = 7),
    (w) => (w.modes[0].steps[3].word = ""),
    (w) => (w.printing = w.printing.slice(1)),
    (w) => (w.schema = "cubistry.hsm-seconds-first"),
    (w) => (w.modes[4].steps[0].word = "R U R' U' R2 U"),
    (w) => (w.modes[4].maximumHTM = 6),
    (w) => w.appModes.splice(1, 1),
    (w) => (w.appModes[1].traversal = "forward"),
    (w) => (w.edgeLimitHTM = 6),
  ]) {
    const w = structuredClone(witness);
    mutate(w);
    assert.throws(() => deriveRuntime(w));
  }
});

// -------------------------------------------------------------------- print

const CHANGED = [1, 2, 3, 4, 6, 8, 9, 10, 12, 14, 15, 17, 18, 19];
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/** The research notation: one triple per corner, stickers on its x, y, z faces. */
const printCode = (printing) =>
  [0, 1, 2, 3, 4, 5, 6, 7]
    .map((cubie) =>
      printing
        .filter((s) => s.cubie === cubie)
        .sort(
          (a, b) => b.n.findIndex(Boolean) * -1 - a.n.findIndex(Boolean) * -1,
        )
        .map((s) =>
          s.image === ""
            ? "_"
            : /^[HSM]$/.test(s.image)
              ? s.image
              : (s.slot === 2 ? "T" : "U") + s.image,
        )
        .join(" "),
    )
    .join(" | ");

test("the app print is the research print code with three S, one H, one M and one blank corner", () => {
  assert.equal(
    printCode(raw.printing),
    "T0 T2 T4 | T1 T3 T5 | U3 U1 U9 | U8 S U5 | U2 U7 S | U4 U0 U6 | S H M | _ _ _",
  );
  assert.equal(printCode(raw.printing), witness.printCode);
  assert.equal(
    printCode(blankRaw.printing),
    "T0 T1 T2 | T3 T4 T5 | U0 U1 U2 | U3 U4 U5 | U6 U7 U8 | U9 U0 U9 | H S M | _ _ _",
  );
  const count = (f) => raw.printing.filter(f).length;
  assert.equal(
    count((s) => s.image === "S"),
    3,
  );
  assert.equal(
    count((s) => s.image === "H"),
    1,
  );
  assert.equal(
    count((s) => s.image === "M"),
    1,
  );
  assert.equal(
    count((s) => s.image === ""),
    3,
  );
  // Ten distinct units glyphs and six distinct tens glyphs: no duplicates.
  const glyphs = (slot) =>
    raw.printing.filter((s) => s.slot === slot).map((s) => s.image);
  assert.deepEqual(glyphs(3).sort(), [..."0123456789"]);
  assert.deepEqual(glyphs(2).sort(), [..."012345"]);
  assert.equal(raw.printing.length, 24);
});

test("exactly the 14 documented sticker identities differ from the previous print", () => {
  const before = blankRaw.printing;
  const changed = raw.printing.filter(
    (s, i) => s.image !== before[i].image || !same(s.up, before[i].up),
  );
  assert.deepEqual(
    changed.map((s) => s.id),
    CHANGED,
  );
  // Bodies and positions are shared; only glyphs (and their up) change.
  for (const s of raw.printing) {
    const o = before[s.id];
    assert.deepEqual([s.cubie, s.p, s.n], [o.cubie, o.p, o.n]);
  }
  // Two units stickers (ids 10, 14) become S, and H and S swap on corner 6.
  assert.deepEqual(
    [10, 14, 18, 19].map((id) => [before[id].image, raw.printing[id].image]),
    [
      ["4", "S"],
      ["8", "S"],
      ["H", "S"],
      ["S", "H"],
    ],
  );
  // Every unchanged sticker keeps its glyph and up vector, so already printed
  // copies of exactly ten identities remain valid.
  const kept = raw.printing.filter((s) => !CHANGED.includes(s.id));
  assert.deepEqual(
    kept.map((s) => s.id),
    [0, 5, 7, 11, 13, 16, 20, 21, 22, 23],
  );
});

test("negative controls: a corrupted sticker breaks the replayed periods", () => {
  const swap = structuredClone(raw);
  [swap.printing[0].image, swap.printing[5].image] = [
    swap.printing[5].image,
    swap.printing[0].image,
  ];
  assert.throws(() => validateHsmDesign(swap));
  for (const mutate of [
    (d) => (d.printing[18].image = "H"),
    (d) => (d.printing[10].image = "4"),
    (d) => (d.printing[3].up = [0, 0, 1]),
    (d) => (d.periods[0].words[7] = "R"),
    (d) => d.periods[0].words.reverse(),
    (d) => d.periods[0].words.pop(),
    (d) => (d.periods[0].periodHTM += 1),
    (d) => (d.periods[2].setup = d.periods[0].setup),
    (d) => (d.periods[2].words[0] = "R R R R R R R"),
    (d) => (d.periods[1].direction = 1),
    (d) => (d.periods[1].traversal = "reverse"),
    (d) => (d.zeroWords.S = d.periods[2].setup),
    (d) => d.periods.push(structuredClone(d.periods[0])),
    (d) => delete d.periods,
    (d) => (d.version = 2),
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateHsmDesign(d));
  }
  // Each remaining load check, alone: these corruptions pass every other check.
  const length = (words) => words.reduce((n, w) => n + parseAlg(w).length, 0);
  for (const [mutate, reason] of [
    [
      // One lap of the two-lap hours period shows the right values but ends on
      // a different full pose.
      (d) => {
        d.periods[12].words = d.periods[12].words.slice(0, 24);
        d.periods[12].periodHTM = length(d.periods[12].words);
      },
      /HSM period does not close/,
    ],
    [
      // Same 00 display and pose, but not the period's own setup word.
      (d) => (d.zeroWords.S = d.periods[0].setup + " U U'"),
      /HSM setup is not the first period's setup/,
    ],
    [
      // Same pose after the edge, but a six-move word: above the five limit.
      (d) => {
        let w = d.periods[0].words[0];
        while (parseAlg(w).length < 6) w += " U U'";
        d.periods[0].words[0] = w;
        d.periods[0].periodHTM = length(d.periods[0].words);
      },
      /HSM period edge too long/,
    ],
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateHsmDesign(d), reason);
  }
  // The unmutated clone is accepted, so each throw above is the mutation.
  assert.doesNotThrow(() => validateHsmDesign(structuredClone(raw)));
});

// ------------------------------------------------------------------ periods

const periods = new HsmPeriods(design.print, design.periods);
const spec = (letter, maximum, direction = 1) =>
  design.periods.find(
    (p) =>
      p.letter === letter && p.maximum === maximum && p.direction === direction,
  );
const frames = (print, state) =>
  JSON.stringify(
    stickerPoses(print, state)
      .map((s) => ({ id: s.id, p: s.p, n: s.n, up: s.up }))
      .sort((a, b) => a.id - b.id),
  );

test("each of the 18 periods starts at the witness's saved full pose, closes, and never exceeds five HTM", () => {
  for (const [letter, maximum, direction] of COUNTING_MODES) {
    const p = spec(letter, maximum, direction),
      app = witness.appModes.find(
        (m) =>
          m.letter === letter &&
          m.maximum === maximum &&
          m.direction === direction,
      ),
      mode = witness.modes.find(
        (m) =>
          m.letter === letter &&
          m.maximum === maximum &&
          m.direction === app.sourceDirection,
      ),
      label = `${letter}/${maximum}/${direction}`,
      n = maximum + 1;
    assert.equal(p.traversal, app.traversal, label);
    assert.equal(p.setup, mode.setup);
    assert.equal(p.periodHTM, mode.periodHTM);
    assert.equal(p.words.length, mode.periodEdges);
    let state = applyMoves(initialState(design.print), parseAlg(p.setup));
    // The independent saved start frames equal our replay of the setup word.
    assert.equal(
      frames(design.print, state),
      JSON.stringify(mode.periodStartFrames),
    );
    const start = state,
      seen = new Set();
    let total = 0,
      maxEdge = 0;
    p.words.forEach((word, i) => {
      const value = (((direction * i) % n) + n) % n,
        next = (((direction * (i + 1)) % n) + n) % n,
        moves = parseAlg(word);
      assert.ok(matchesTarget(design.print, state, hsmTarget(letter, value)));
      assert.equal(
        seen.has(poseKey(state)),
        false,
        "a period never repeats a pose early",
      );
      seen.add(poseKey(state));
      // The install pose for a value is this replayed first-lap node.
      if (i <= maximum)
        assert.ok(
          stateEquals(
            periods.poseFor(letter, maximum, direction, value),
            state,
          ),
        );
      if (p.traversal === "forward")
        // Shortest from the actual pose: nothing reaches the next display faster.
        assert.equal(
          moves.length,
          planner.distance(design.print, state, letter, next),
          `${label} edge ${i}`,
        );
      // Run backward, word i undoes the source period's word L-1-i.
      else
        assert.equal(
          word,
          inverseWord(mode.steps[mode.steps.length - 1 - i].word),
        );
      assert.ok(moves.length <= 5, `${label} edge ${i}`);
      total += moves.length;
      maxEdge = Math.max(maxEdge, moves.length);
      state = applyMoves(state, moves);
      assert.equal(
        periods.nodeOf(letter, maximum, direction, state),
        (i + 1) % p.words.length,
      );
    });
    assert.ok(stateEquals(state, start), "closed over the full pose");
    assert.equal(total, p.periodHTM);
    assert.equal(maxEdge, app.maximumHTM);
    assert.ok(maxEdge <= 5, label);
  }
});

// -------------------------------------------------------------------- laps

const view = { configure() {}, animate: async () => {}, resetCamera() {} };
const dispose = async () => ({ dispose() {} });
const settled = async (c) => {
  for (let n = 0; c.busy && n < 100; n++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};
/** HTM cost of every count step, through the controller's real plan and playback. */
async function costs(d, letter, maximum, direction, laps) {
  const c = new HsmController(view, d, {}, letter, () => {}, dispose);
  c.setMode(maximum, direction);
  await c.configure();
  const out = [];
  for (let i = 0; i < laps * (maximum + 1); i++) {
    const target = (c.currentValue + direction + maximum + 1) % (maximum + 1),
      before = c.progress.sessionTotal;
    c.request(target);
    await settled(c);
    assert.equal(c.currentValue, target);
    assert.ok(matchesTarget(d.print, c.state, hsmTarget(letter, target)));
    out.push(c.progress.sessionTotal - before);
  }
  c.dispose();
  return out;
}
const sum = (a) => a.reduce((x, y) => x + y, 0);
const lapSums = (a, n) =>
  Array.from({ length: a.length / n }, (_, i) =>
    sum(a.slice(i * n, (i + 1) * n)),
  );

// Research figures (research/hsm-counter/seconds-first/modes/verification.json):
// per-lap HTM, laps per period, largest edge, and the wrap edge, the same up and
// down because counting down runs the up period backward.
const RESEARCH = [
  { letter: "S", maximum: 59, lap: 159, periodLaps: 1, max: 4, wrap: 3 },
  { letter: "S", maximum: 23, lap: 68, periodLaps: 1, max: 5, wrap: 5 },
  { letter: "S", maximum: 11, lap: 32, periodLaps: 1, max: 4, wrap: 4 },
  { letter: "M", maximum: 59, lap: 204, periodLaps: 2, max: 5 },
  { letter: "M", maximum: 23, lap: 82, periodLaps: 2, max: 5 },
  { letter: "M", maximum: 11, lap: 40, periodLaps: 1, max: 4, wrap: 4 },
  { letter: "H", maximum: 59, lap: 204, periodLaps: 2, max: 5 },
  { letter: "H", maximum: 23, lap: 82, periodLaps: 2, max: 5 },
  { letter: "H", maximum: 11, lap: 40, periodLaps: 1, max: 4, wrap: 4 },
];

test("the pinned lap table is the witness's application-mode table", () => {
  for (const r of RESEARCH)
    for (const direction of [1, -1]) {
      const app = witness.appModes.find(
        (m) =>
          m.letter === r.letter &&
          m.maximum === r.maximum &&
          m.direction === direction,
      );
      assert.deepEqual(
        [app.perLapHTM, app.periodEdges / (r.maximum + 1), app.maximumHTM],
        [`${r.lap}/1`, r.periodLaps, r.max],
      );
      assert.equal(app.traversal, direction === 1 ? "forward" : "inverse");
    }
  assert.equal(RESEARCH.length * 2, COUNTING_MODES.length);
});

test("three laps of every mode cost the research lap totals through the real controller", async () => {
  for (const r of RESEARCH)
    for (const direction of [1, -1]) {
      const n = r.maximum + 1,
        laps = 2 * r.periodLaps + (r.periodLaps === 1 ? 1 : 0),
        out = await costs(design, r.letter, r.maximum, direction, laps),
        label = `${r.letter}/${r.maximum}/${direction}`;
      assert.equal(sum(out) / laps, r.lap, label);
      if (r.periodLaps === 1)
        for (const l of lapSums(out, n)) assert.equal(l, r.lap, label);
      assert.equal(Math.max(...out), r.max, label);
      // Wrap: 59→00 counting up, 00→59 counting down; sits at index 59 or 0.
      if (r.wrap) assert.equal(out[direction === 1 ? n - 1 : 0], r.wrap, label);
    }
});

test("the stated S, M and H laps hold over repeated passes and the largest M edge is five", async () => {
  const s = await costs(design, "S", 59, 1, 3);
  assert.deepEqual(lapSums(s, 60), [159, 159, 159]);
  assert.equal(Math.max(...s), 4);
  assert.equal(s[59], 3, "59→00 costs three HTM");
  const m = await costs(design, "M", 59, 1, 4);
  assert.equal(sum(m), 816);
  assert.equal(Math.max(...m), 5);
  assert.ok(Math.max(...(await costs(design, "M", 59, -1, 4))) <= 5);
  assert.equal(sum(await costs(design, "H", 23, 1, 4)), 328);
  assert.equal(sum(await costs(design, "H", 11, 1, 3)), 120);
});

test("counting down walks the same period backward at the same lap cost", async () => {
  for (const [letter, maximum] of PAIRS) {
    const c = new HsmController(view, design, {}, letter, () => {}, dispose);
    c.setMode(maximum, 1);
    await c.configure();
    const start = c.state;
    const up = [];
    for (let i = 0; i < 7; i++) {
      c.request((c.currentValue + 1) % (maximum + 1));
      await settled(c);
      up.push(c.progress.total);
    }
    c.setMode(maximum, -1);
    const down = [];
    for (let i = 0; i < 7; i++) {
      c.request((c.currentValue + maximum) % (maximum + 1));
      await settled(c);
      down.push(c.progress.total);
    }
    assert.deepEqual(down, up.slice().reverse());
    assert.ok(
      stateEquals(c.state, start),
      "backward steps undo the forward steps",
    );
    c.dispose();
  }
});

// ---------------------------------------------------------------- off period

const recoveryRow = (letter, maximum, direction) =>
  recoveryTable.modes.find(
    (m) =>
      m.letter === letter && m.maximum === maximum && m.direction === direction,
  );

test("after free jumps counting returns onto the period within the research step bound, at most five HTM per step", async () => {
  for (const [letter, maximum, direction] of COUNTING_MODES) {
    const c = new HsmController(view, design, {}, letter, () => {}, dispose);
    c.setMode(maximum, direction);
    await c.configure();
    const bound = recoveryRow(letter, maximum, direction).maximumSteps,
      label = `${letter}/${maximum}/${direction}`;
    for (const target of [maximum, 13 % (maximum + 1), 0, maximum >> 1]) {
      c.request(target);
      await settled(c);
      assert.equal(c.currentValue, target);
      // A free jump keeps the universal six-move bound.
      assert.ok(c.progress.total <= 6, `${label} jump to ${target}`);
      let steps = 0;
      while (periods.nodeOf(letter, maximum, direction, c.state) < 0) {
        c.request((c.currentValue + direction + maximum + 1) % (maximum + 1));
        await settled(c);
        steps++;
        assert.ok(c.progress.total <= 5, `${label} recovery step`);
        assert.ok(steps <= bound, `${label} back on the period`);
      }
    }
    // Back on the period, a full period of counting stays on it.
    for (let i = 0; i < 2 * (maximum + 1); i++) {
      c.request((c.currentValue + direction + maximum + 1) % (maximum + 1));
      await settled(c);
      assert.ok(c.progress.total <= 5);
      assert.ok(periods.nodeOf(letter, maximum, direction, c.state) >= 0);
    }
    c.dispose();
  }
});

test("recovery from every saved research pose is exact: the fewest steps, then the fewest HTM", () => {
  const recovery = new HsmRecovery(design.print, planner);
  let slowest = 0;
  for (const row of recoveryTable.modes) {
    const { letter, maximum, direction } = row,
      n = maximum + 1;
    for (const sample of row.samples) {
      let state = applyMoves(
        initialState(design.print),
        parseAlg(sample.setupFromSolved),
      );
      assert.ok(
        matchesTarget(design.print, state, hsmTarget(letter, sample.fromValue)),
      );
      const t0 = performance.now();
      const plan = recovery.plan(
        state,
        letter,
        maximum,
        direction,
        sample.fromValue,
        (v) => periods.nodesShowing(letter, maximum, direction, v),
      );
      slowest = Math.max(slowest, performance.now() - t0);
      const label = `${letter}/${maximum}/${direction} from ${sample.fromValue}`;
      assert.equal(plan.words.length, sample.steps, label);
      assert.equal(
        plan.htm,
        sum(sample.words.map((w) => parseAlg(w).length)),
        label,
      );
      let value = sample.fromValue;
      for (const word of plan.words) {
        const target = (value + direction + n) % n,
          shortest = planner.distance(design.print, state, letter, target);
        // At most five, or the shortest word from a pose that has none of five.
        assert.ok(
          word.length <= 5 || (word.length === shortest && shortest > 5),
          label,
        );
        state = applyMoves(state, word);
        assert.ok(
          matchesTarget(design.print, state, hsmTarget(letter, target)),
        );
        value = target;
      }
      assert.ok(periods.nodeOf(letter, maximum, direction, state) >= 0, label);
    }
  }
  // The worst research poses included: the search stays interactive.
  assert.ok(slowest < 2000, `slowest recovery search ${slowest.toFixed(0)} ms`);
});

test("a pose with no route of five takes its six-HTM shortest word once, then counts at most five", () => {
  const recovery = new HsmRecovery(design.print, planner);
  let checked = 0;
  for (const row of recoveryTable.modes) {
    const { letter, maximum, direction } = row,
      n = maximum + 1;
    // S has no such pose; M and H have 252 (00–11, 00–23) or 756 (00–59).
    assert.equal(row.poseWithoutEdgeAtMostLimit > 0, letter !== "S");
    if (!row.poseWithoutEdgeAtMostLimit) continue;
    // The third saved sample is the first such pose of the research graph.
    const sample = row.samples[2],
      state = applyMoves(
        initialState(design.print),
        parseAlg(sample.setupFromSolved),
      ),
      next = (sample.fromValue + direction + n) % n;
    assert.equal(planner.distance(design.print, state, letter, next), 6);
    const plan = recovery.plan(
      state,
      letter,
      maximum,
      direction,
      sample.fromValue,
      (v) => periods.nodesShowing(letter, maximum, direction, v),
    );
    assert.equal(plan.words[0].length, 6);
    assert.ok(plan.words.slice(1).every((w) => w.length <= 5));
    assert.ok(plan.words.length <= row.maximumSteps);
    checked++;
  }
  assert.equal(checked, 12);
});

test("reinstalling at a value starts on that node of the period", async () => {
  const c = new HsmController(view, design, {}, "S", () => {}, dispose);
  c.setMode(59, 1);
  for (const value of [0, 1, 37, 59]) {
    await c.configure(value);
    assert.equal(periods.nodeOf("S", 59, 1, c.state), value);
    // Independently replayed: the setup word, then the first `value` words.
    const p = spec("S", 59);
    assert.ok(
      stateEquals(
        c.state,
        applyMoves(
          initialState(design.print),
          parseAlg([p.setup, ...p.words.slice(0, value)].join(" ")),
        ),
      ),
      `configure(${value}) installs the period node directly`,
    );
    const before = c.progress.sessionTotal;
    c.request((value + 1) % 60);
    await settled(c);
    assert.equal(
      c.progress.sessionTotal - before,
      parseAlg(spec("S", 59).words[value]).length,
    );
  }
  c.dispose();
});

test("an interrupted route lands off the period; counting on returns onto it at most five HTM per step", async () => {
  let off = 0;
  for (const [letter, maximum, direction] of COUNTING_MODES) {
    const g = gate(),
      c = new HsmController(g, design, {}, letter, () => {}, assets),
      n = maximum + 1,
      label = `${letter}/${maximum}/${direction}`;
    c.setMode(maximum, direction);
    await c.configure(0);
    // One committed turn toward 7, then the target changes to 5.
    c.request(7);
    await flush();
    g.pending.shift()();
    await flush();
    c.request(5);
    await g.finish(c);
    assert.equal(c.currentValue, 5);
    off += periods.nodeOf(letter, maximum, direction, c.state) < 0;
    let steps = 0;
    while (periods.nodeOf(letter, maximum, direction, c.state) < 0) {
      c.request((c.currentValue + direction + n) % n);
      await g.finish(c);
      steps++;
      assert.ok(c.progress.total <= 5, label);
      assert.ok(
        steps <= recoveryRow(letter, maximum, direction).maximumSteps,
        label,
      );
    }
    c.dispose();
  }
  assert.ok(off >= 12, `${off} of 18 modes left the period`);
});

// Mutation-style control for the five-HTM requirement: the same print without
// the saved M 00-23 periods falls back to the exact planner and needs six HTM
// on the 19→20 step from a fresh setup, which the 18-mode regression in
// tests/hsm-counter.test.mjs would catch.
test("negative control: without its saved period, M 00–23 up needs six HTM again", async () => {
  const stripped = validateHsmDesign({
    ...structuredClone(raw),
    periods: raw.periods.filter((p) => !(p.letter === "M" && p.maximum === 23)),
  });
  const out = await costs(stripped, "M", 23, 1, 3);
  assert.equal(Math.max(...out), 6);
  assert.equal(Math.max(...(await costs(design, "M", 23, 1, 3))), 5);
});

test("the retained inverse is exact: an inverted period word undoes its edge", () => {
  for (const p of design.periods)
    for (const word of p.words.slice(0, 5)) {
      const s = applyMoves(initialState(design.print), parseAlg(p.setup));
      assert.ok(
        stateEquals(
          applyMoves(
            applyMoves(s, parseAlg(word)),
            inverseMoves(parseAlg(word)),
          ),
          s,
        ),
      );
    }
});

// --------------------------------------------------------------- live clock

const flush = () => new Promise((resolve) => setImmediate(resolve));
const utc = (epoch) => {
  const d = new Date(epoch);
  return [d.getUTCHours(), d.getUTCMinutes(), d.getUTCSeconds()];
};
/** A physical view whose turns commit when the test releases them. */
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
    async finish(c) {
      for (let i = 0; c.busy && i < 200; i++) {
        assert.equal(this.pending.length, 1);
        this.pending.shift()();
        await flush();
      }
      assert.equal(c.busy, false);
      assert.notEqual(c.progress.status, "failed");
    },
  };
}
const assets = async (manifest) => ({
  manifest,
  images: new Map(),
  materials: new Map(),
  textureOrigin: "bottom-left",
  dispose() {},
});
async function clock(d, start) {
  const stats = new ClockMoveStatistics(3),
    gates = [],
    units = [];
  for (let i = 0; i < 3; i++) {
    const g = gate(),
      c = new HsmController(
        g,
        d,
        {},
        "HMS"[i],
        (value, busy, error, progress) => {
          assert.equal(error, undefined);
          if (progress) stats.observe(i, progress);
        },
        assets,
      );
    c.setMode(i === 0 ? 23 : 59, 1);
    await c.configure(utc(start)[i]);
    gates.push(g);
    units.push({
      controller: c,
      duration: [250, 100, 50][i],
      setDuration() {},
    });
  }
  return { stats, gates, units, scheduler: new LiveClockScheduler(utc) };
}
/**
 * One live second, polled every 25 ms like the page: the scheduler launches each
 * successor route once the boundary is within that route's nominal duration;
 * the test then plays the committed turns at once and closes the tick.
 */
async function second(sim, boundary) {
  for (let t = boundary - 650; t < boundary; t += 25) {
    sim.scheduler.tick(t, t - sim.origin, sim.units);
    for (let i = 0; i < 3; i++)
      await sim.gates[i].finish(sim.units[i].controller);
  }
  sim.stats.closeTick();
}
async function seconds(d, start, ticks) {
  const sim = await clock(d, start);
  sim.origin = start;
  const perTick = [];
  for (let k = 1; k <= ticks; k++) {
    const before = sim.gates[2].committed.length;
    await second(sim, start + 1000 * k);
    perTick.push(sim.gates[2].committed.length - before);
  }
  return { sim, perTick };
}
const blankDesign = validateHsmDesign({ ...blankRaw, version: 4, periods: [] });

test("the live clock's seconds cube costs 2.65 HTM per tick on the new print and drops from about 4.5", async () => {
  const start = Date.UTC(2026, 0, 1, 12, 34, 0);
  const after = await seconds(design, start, 180),
    before = await seconds(blankDesign, start, 180);
  const meanOf = (r) => r.sim.stats.snapshot().units[2].mean;
  // Three S laps through the scheduler: every lap is the research 159 HTM.
  assert.deepEqual(lapSums(after.perTick, 60), [159, 159, 159]);
  assert.equal(meanOf(after), 159 / 60);
  assert.equal(Math.max(...after.perTick), 4);
  // The previous print under the same scheduler and statistics (policy 13).
  assert.equal(sum(before.perTick), 808);
  assert.ok(meanOf(before) > 4.4);
  assert.ok(meanOf(before) - meanOf(after) > 1.8);
  console.log(
    `S mean HTM per tick over 3 laps: before ${meanOf(before).toFixed(3)}, after ${meanOf(after).toFixed(3)}`,
  );
  const snapshot = after.sim.stats.snapshot();
  assert.equal(snapshot.units[2].session.htm, 477);
  assert.equal(snapshot.units[2].changes, 180);
  for (const u of after.sim.units) u.controller.dispose();
  for (const u of before.sim.units) u.controller.dispose();
});

test("the whole clock stays on its periods across a minute and hour boundary", async () => {
  const start = Date.UTC(2026, 0, 1, 12, 59, 55);
  const { sim } = await seconds(design, start, 12);
  assert.deepEqual(
    sim.units.map((u) => u.controller.currentValue),
    [13, 0, 7],
  );
  const p = (letter, max, c) => periods.nodeOf(letter, max, 1, c.state) >= 0;
  assert.ok(p("H", 23, sim.units[0].controller));
  assert.ok(p("M", 59, sim.units[1].controller));
  assert.ok(p("S", 59, sim.units[2].controller));
  const snap = sim.stats.snapshot();
  assert.equal(
    snap.total.session.htm,
    sim.gates.reduce((n, g) => n + g.committed.length, 0),
  );
  // Wrap edges: minutes 59→00 and hours 12→13 each took at most five HTM.
  assert.ok(snap.units[0].max <= 5 && snap.units[1].max <= 5);
  for (const u of sim.units) u.controller.dispose();
});

test("after a bounded catch-up the live seconds return onto the period within six ticks, at most five HTM each", async () => {
  const start = Date.UTC(2026, 0, 1, 12, 34, 5);
  const sim = await clock(design, start);
  sim.origin = start;
  // A suspended tab returns 40 s later: one replanned jump, no backlog.
  const before = sim.gates.map((g) => g.committed.length);
  sim.scheduler.tick(start + 40000, 60000, sim.units);
  for (let i = 0; i < 3; i++)
    await sim.gates[i].finish(sim.units[i].controller);
  assert.deepEqual(
    sim.units.map((u) => u.controller.currentValue),
    [12, 34, 45],
  );
  sim.gates.forEach((g, i) => assert.ok(g.committed.length - before[i] <= 6));
  // The jump leaves the seconds period; counting on recovers within the
  // research bound for S 00–59 (six steps) and then stays on the period.
  const seconds = sim.units[2].controller,
    onPeriod = () => periods.nodeOf("S", 59, 1, seconds.state) >= 0;
  assert.equal(onPeriod(), false);
  const ticks = [];
  let back = -1;
  for (let k = 41; k <= 52; k++) {
    const count = sim.gates[2].committed.length;
    await second(sim, start + 1000 * k);
    ticks.push(sim.gates[2].committed.length - count);
    if (back < 0 && onPeriod()) back = k - 40;
  }
  assert.equal(seconds.currentValue, 57);
  assert.ok(
    back >= 1 && back <= recoveryRow("S", 59, 1).maximumSteps,
    `back after ${back}`,
  );
  assert.ok(onPeriod());
  assert.ok(Math.max(...ticks) <= 5, `ticks ${ticks}`);
  for (const u of sim.units) u.controller.dispose();
});

// Mutation controls. Each test below fails on a named mutant of
// src/apps/hsm/recovery.ts (see the PR description).
const poseText = (recovery, state) => recovery.encode(state).join(",");

test("a free jump from a period node lands on a period node when a least route can (jump keeps its period preference)", () => {
  const recovery = new HsmRecovery(design.print, planner);
  // [letter, range, direction, start node display, jumped-to value]. Measured
  // against the unpreferenced search: each of these lands off the period
  // without the preference, on it with it, at the same HTM.
  const cases = [
    ["S", 59, 1, 0, 57],
    ["S", 59, 1, 20, 17],
    ["S", 23, 1, 0, 1],
    ["S", 11, 1, 10, 1],
    ["M", 59, 1, 10, 11],
    ["M", 23, 1, 15, 0],
    ["M", 11, 1, 0, 11],
    ["H", 59, 1, 5, 6],
    ["H", 23, 1, 20, 17],
    ["H", 11, 1, 10, 9],
  ];
  for (const [letter, maximum, direction, from, value] of cases) {
    const state = periods.poseFor(letter, maximum, direction, from),
      label = `${letter}/${maximum}/${direction} ${from} -> ${value}`,
      word = recovery.jump(state, letter, maximum, direction, value, (v) =>
        periods.nodesShowing(letter, maximum, direction, v),
      ),
      after = applyMoves(state, word);
    assert.ok(matchesTarget(design.print, after, hsmTarget(letter, value)));
    assert.equal(
      word.length,
      planner.distance(design.print, state, letter, value),
      label,
    );
    assert.ok(periods.nodeOf(letter, maximum, direction, after) >= 0, label);
  }
});

test("recovery reach equals a brute-force search over every move sequence", () => {
  const recovery = new HsmRecovery(design.print, planner);
  // Brute force on the search's own pose tables (recovery.trans), but without
  // its canonical-word pruning: every pose within `limit` HTM, layer by layer.
  const step = (pose, m) => {
    const out = new Uint8Array(8);
    for (let c = 0; c < 8; c++) out[c] = recovery.trans[c][m][pose[c]];
    return out;
  };
  // [letter, range, start display, jumped-to value, limit]. The last two fail
  // if the search also drops the second order of two opposite faces (R L vs L R).
  const cases = [
    ["S", 59, 0, 5, 3],
    ["S", 59, 7, 9, 4],
    ["M", 59, 7, 8, 5],
    ["S", 59, 49, 51, 5],
    ["S", 59, 49, 54, 5],
  ];
  let compared = 0;
  for (const [letter, maximum, from, value, limit] of cases) {
    const origin = recovery.encode(periods.poseFor(letter, maximum, 1, from));
    let layer = new Map([[origin.join(","), origin]]);
    const expected = new Set();
    for (let depth = 1; depth <= limit; depth++) {
      const next = new Map();
      for (const pose of layer.values())
        for (let m = 0; m < 18; m++) {
          const q = step(pose, m),
            key = q.join(",");
          if (next.has(key)) continue;
          next.set(key, q);
          if (recovery.shortest(q, letter, value) === 0) expected.add(key);
        }
      layer = next;
    }
    const found = recovery.reach(origin, letter, value, limit),
      got = new Set([...found.values()].map((e) => e.pose.join(",")));
    assert.ok(expected.size > 0);
    assert.deepEqual(
      [...got].sort(),
      [...expected].sort(),
      `${letter}/${maximum} ${from} -> ${value} within ${limit}`,
    );
    // Each reported word is a real route of at most `limit` moves to its pose.
    for (const e of found.values()) {
      let q = origin;
      for (const m of e.word) q = step(q, m);
      assert.equal(q.join(","), e.pose.join(","));
      assert.ok(e.word.length <= limit);
    }
    compared += expected.size;
  }
  assert.ok(compared > 0);
});

test("configure() followed by a mode, range or direction switch counts at most five HTM per step and is back on the period within six steps", async () => {
  let worst = 0,
    checked = 0;
  for (const letter of ["S"]) {
    const modes = COUNTING_MODES.filter(([l]) => l === letter);
    for (const [, fromMax, fromDir] of modes)
      for (const [, toMax, toDir] of modes) {
        if (fromMax === toMax && fromDir === toDir) continue;
        for (const advance of [3]) {
          const c = new HsmController(
            view,
            design,
            {},
            letter,
            () => {},
            dispose,
          );
          c.setMode(fromMax, fromDir);
          await c.configure();
          for (let i = 0; i < advance; i++) {
            c.request((c.currentValue + fromDir + fromMax + 1) % (fromMax + 1));
            await settled(c);
          }
          assert.ok(periods.nodeOf(letter, fromMax, fromDir, c.state) >= 0);
          // The display must exist in the new range (the app resets otherwise).
          if (c.currentValue > toMax) {
            c.dispose();
            continue;
          }
          c.setMode(toMax, toDir);
          const label = `${letter} ${fromMax}/${fromDir} -> ${toMax}/${toDir} after ${advance}`;
          let steps = 0;
          while (periods.nodeOf(letter, toMax, toDir, c.state) < 0) {
            c.request((c.currentValue + toDir + toMax + 1) % (toMax + 1));
            await settled(c);
            steps++;
            worst = Math.max(worst, steps);
            assert.ok(c.progress.total <= 5, `${label} step ${steps}`);
            assert.ok(steps <= 6, `${label} back on the period`);
          }
          checked++;
          c.dispose();
        }
      }
  }
  assert.ok(checked >= 20, `${checked} switches`);
  assert.ok(worst <= 6);
});

// prepare(next) caches a plan for the mode it was made in. A mode, range or
// direction switch before the request must drop it: the request then plans like
// a controller that never prepared anything and never plays the stale plan.
test("a plan prepared before a range or direction switch is not used after it", async () => {
  const switches = [
    [59, 1, 59, -1],
    [59, 1, 23, 1],
    [23, -1, 23, 1],
    [23, 1, 11, -1],
  ];
  let differing = 0;
  for (const letter of ["H", "S", "M"])
    for (const [fromMax, fromDir, toMax, toDir] of switches)
      for (const jump of [false, true]) {
        const run = async (withPrepared) => {
          const c = new HsmController(
            view,
            design,
            {},
            letter,
            () => {},
            dispose,
          );
          c.setMode(fromMax, fromDir);
          await c.configure();
          for (let i = 0; i < 2; i++) {
            c.request((c.currentValue + fromDir + fromMax + 1) % (fromMax + 1));
            await settled(c);
          }
          // A free jump leaves the period, so recovery steps are involved.
          if (jump) {
            c.request((c.currentValue + 7) % (fromMax + 1));
            await settled(c);
          }
          const next = (c.currentValue + fromDir + fromMax + 1) % (fromMax + 1);
          const before = c.state,
            stale = withPrepared ? c.prepare(next) : null;
          c.setMode(toMax, toDir);
          c.request(next);
          await settled(c);
          const out = {
            value: c.currentValue,
            state: c.state,
            total: c.progress.total,
            stale: stale && applyMoves(before, stale),
          };
          c.dispose();
          return out;
        };
        const label = `${letter} ${fromMax}/${fromDir} -> ${toMax}/${toDir}${jump ? " after a jump" : ""}`;
        const prepared = await run(true),
          fresh = await run(false);
        assert.equal(prepared.value, fresh.value, label);
        assert.ok(stateEquals(prepared.state, fresh.state), label);
        assert.equal(prepared.total, fresh.total, label);
        // Count the cases where the stale plan would have ended elsewhere.
        if (!stateEquals(prepared.stale, prepared.state)) differing++;
      }
  assert.ok(differing >= 10, `${differing} switches change the route`);
});
