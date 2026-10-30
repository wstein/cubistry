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
import { LiveClockScheduler } from "../src/apps/clock/scheduler.ts";
import { ClockMoveStatistics } from "../src/apps/clock/statistics.ts";
import {
  deriveRuntime,
  serialize,
  COUNTING_PERIODS,
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
const blankRaw = json("tests/fixtures/hsm-blank-print.v2.json");
const planner = new HsmPlanner();

// ---------------------------------------------------------------- provenance

test("the witness copy and runtime file are pinned to the research commit", () => {
  assert.equal(pin.layoutBranch, "research/hsm-seconds-first");
  assert.match(pin.layoutCommit, /^[0-9a-f]{40}$/);
  assert.equal(pin.layoutCommit, "24240a3b2dbd691de99d5bf1170b5695fc62a320");
  assert.equal(pin.proofCommit, pin.layoutCommit);
  assert.equal(
    pin.layoutPath,
    "research/hsm-counter/seconds-first/witness.json",
  );
  assert.equal(sha(witnessBytes), pin.layoutSHA256);
  assert.equal(pin.researchFiles[pin.layoutPath], pin.layoutSHA256);
  for (const [path, hash] of Object.entries(pin.researchFiles)) {
    assert.match(path, /^research\/hsm-counter\/seconds-first\/[A-Za-z.]+$/);
    assert.match(hash, /^[0-9a-f]{64}$/);
  }
  assert.match(pin.reviewStatus, /^pending/);
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
  assert.equal(raw.version, 3);
  assert.deepEqual(
    raw.periods.map((p) => [p.letter, p.maximum]),
    COUNTING_PERIODS,
  );
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
    (w) => (w.schema = "cubistry.hsm-blank-counter"),
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
    (d) => (d.periods[1].setup = d.periods[0].setup),
    (d) => (d.periods[2].words[0] = "R R R R R R R"),
    (d) => (d.zeroWords.S = d.periods[1].setup),
    (d) => d.periods.push(structuredClone(d.periods[0])),
    (d) => delete d.periods,
    (d) => (d.version = 2),
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateHsmDesign(d));
  }
  // The unmutated clone is accepted, so each throw above is the mutation.
  assert.doesNotThrow(() => validateHsmDesign(structuredClone(raw)));
});

// ------------------------------------------------------------------ periods

const periods = new HsmPeriods(design.print, design.periods);
const spec = (letter, maximum) =>
  design.periods.find((p) => p.letter === letter && p.maximum === maximum);
const frames = (print, state) =>
  JSON.stringify(
    stickerPoses(print, state)
      .map((s) => ({ id: s.id, p: s.p, n: s.n, up: s.up }))
      .sort((a, b) => a.id - b.id),
  );

test("each period starts at the witness's saved full pose, closes, and every edge is a shortest word from its actual pose", () => {
  for (const [letter, maximum] of COUNTING_PERIODS) {
    const p = spec(letter, maximum),
      mode = witness.modes.find(
        (m) =>
          m.letter === letter && m.maximum === maximum && m.direction === 1,
      );
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
      const value = i % (maximum + 1),
        next = (i + 1) % (maximum + 1),
        moves = parseAlg(word);
      assert.ok(matchesTarget(design.print, state, hsmTarget(letter, value)));
      assert.equal(
        seen.has(poseKey(state)),
        false,
        "a period never repeats a pose early",
      );
      seen.add(poseKey(state));
      // Shortest from the actual pose: nothing reaches the next display faster.
      assert.equal(
        moves.length,
        planner.distance(design.print, state, letter, next),
        `${letter}/${maximum} edge ${i}`,
      );
      total += moves.length;
      maxEdge = Math.max(maxEdge, moves.length);
      state = applyMoves(state, moves);
      assert.equal(
        periods.nodeOf(letter, maximum, state),
        (i + 1) % p.words.length,
      );
    });
    assert.ok(stateEquals(state, start), "closed over the full pose");
    assert.equal(total, p.periodHTM);
    assert.equal(maxEdge, mode.maximumHTM);
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

// Research figures: per-lap HTM, largest edge, and wrap edge for each unit.
const RESEARCH = [
  { letter: "S", maximum: 59, lap: 159, periodLaps: 1, max: 4, wrap: 3 },
  { letter: "M", maximum: 59, lap: 204, periodLaps: 2, max: 5 },
  { letter: "H", maximum: 23, lap: 82, periodLaps: 2, max: 5 },
  { letter: "H", maximum: 11, lap: 40, periodLaps: 1, max: 4 },
];

test("three laps of every researched mode cost the research lap totals through the real controller", async () => {
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
  for (const [letter, maximum] of COUNTING_PERIODS) {
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

test("a free jump keeps the six-move bound and leaves the period; recounting stays legal", async () => {
  for (const [letter, maximum] of COUNTING_PERIODS) {
    const c = new HsmController(view, design, {}, letter, () => {}, dispose);
    c.setMode(maximum, 1);
    await c.configure();
    for (const target of [maximum, 13 % (maximum + 1), 0, maximum >> 1]) {
      c.request(target);
      await settled(c);
      assert.equal(c.currentValue, target);
      assert.ok(c.progress.total <= 6, `${letter} jump to ${target}`);
    }
    for (let i = 0; i < 2 * (maximum + 1); i++) {
      c.request((c.currentValue + 1) % (maximum + 1));
      await settled(c);
      assert.ok(c.progress.total <= 6);
    }
    c.dispose();
  }
});

test("reinstalling at a value starts on that node of the period", async () => {
  const c = new HsmController(view, design, {}, "S", () => {}, dispose);
  c.setMode(59, 1);
  for (const value of [0, 1, 37, 59]) {
    await c.configure(value);
    assert.equal(periods.nodeOf("S", 59, c.state), value);
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

test("modes without a saved period keep the exact planner and the general six-move bound", async () => {
  for (const [letter, maximum] of [
    ["S", 23],
    ["S", 11],
    ["M", 23],
    ["M", 11],
    ["H", 59],
  ])
    for (const direction of [1, -1])
      assert.ok(
        Math.max(...(await costs(design, letter, maximum, direction, 3))) <= 6,
        `${letter}/${maximum}/${direction}`,
      );
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
const blankDesign = validateHsmDesign({ ...blankRaw, version: 3, periods: [] });

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
  const p = (letter, max, c) => periods.nodeOf(letter, max, c.state) >= 0;
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

test("bounded catch-up still replans from the period and never exceeds six HTM", async () => {
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
  for (const u of sim.units) u.controller.dispose();
});
