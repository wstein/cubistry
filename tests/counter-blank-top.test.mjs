// Blank-top Counter variant: replays every research route word (LZ and NZ)
// in the app's own mechanics model and through the real controller.
// These are app regression tests, NOT proofs. The print and routes are
// confirmed only by the native Julia and Flix checkers on the research branch.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CounterController } from "../src/apps/counter/controller.ts";
import { validateCounterDesign, targetFor, configurePrint, validateCounterConfig } from "../src/apps/counter/design.ts";
import { validateCertifiedCounter, certifiedStep } from "../src/apps/counter/certified.ts";
import {
  validateBlankTopCounter,
  modeSwitchMoves,
  modeSwitchAt,
  BLANK_TOP_STATISTICS,
} from "../src/apps/counter/blank-top.ts";
import { parseTsv } from "../scripts/counter-blank-top.mjs";
import { stateEquals, eq } from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  parseAlg,
  matchesTarget,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const design = validateCounterDesign(json("public/counter-design.v2.json"));
const raw = json("public/counter-blank-top.v1.json");
const blankTop = validateBlankTopCounter(raw, design);
const titled = validateCertifiedCounter(json("public/counter-certified.v1.json"), design);
const rows = (f) => parseTsv(readFileSync(`data/counter/blank-top/${f}`, "utf8"));
const token = (m) => m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : "");
const FRONT = [
  [-1, 1, 1],
  [1, 1, 1],
  [-1, -1, 1],
  [1, -1, 1],
];
/** The four front cells read independently of matchesTarget. */
function front(print, state) {
  const poses = stickerPoses(print, state);
  return FRONT.map((p) => poses.find((s) => eq(s.p, p) && eq(s.n, [0, 0, 1])));
}
function assertDisplay(print, state, value, mode) {
  const cells = front(print, state);
  const tens = mode === "nz" && value < 10 ? "blank" : String(Math.floor(value / 10));
  const want = ["blank", "blank", tens, String(value % 10)];
  cells.forEach((s, i) => {
    assert.equal(s.assetId, want[i], `${mode} ${value} cell ${i}`);
    if (s.assetId !== "blank") assert.deepEqual(s.up, [0, 1, 0], `${mode} ${value} upright`);
  });
  assert.ok(matchesTarget(print, state, targetFor(value, mode === "lz", "blank-top")));
}

for (const mode of ["lz", "nz"]) {
  test(`every ${mode.toUpperCase()} research edge replays in the app mechanics with its exact inverse`, () => {
    const print = blankTop.print;
    const routeRows = rows(`routes-${mode}.tsv`);
    const setup = rows(`setup-${mode}.tsv`)[0];
    assert.equal(routeRows.length, 100);
    const start = applyMoves(initialState(print), parseAlg(setup.setup));
    assert.equal(parseAlg(setup.setup).length, BLANK_TOP_STATISTICS[mode].setupHTM);
    let state = start,
      total = 0;
    const histogram = [0, 0, 0, 0, 0];
    for (const [value, r] of routeRows.entries()) {
      assertDisplay(print, state, value, mode);
      const inc = parseAlg(r.increment),
        dec = parseAlg(r.decrement);
      assert.equal(inc.length, Number(r.inc_htm));
      assert.ok(inc.length >= 1 && inc.length <= 4, `${mode} edge ${value} at most 4 HTM`);
      const next = applyMoves(state, inc);
      // The research decrement word, literally, restores the complete state.
      assert.ok(stateEquals(applyMoves(next, dec), state), `${mode} decrement ${value}`);
      assert.equal(dec.length, inc.length);
      assert.ok(stateEquals(state, blankTop.routes[mode].states[value]));
      total += inc.length;
      histogram[inc.length]++;
      state = next;
    }
    // Wraparound: 99 -> 00 (LZ) or 99 -> _0 (NZ) closes on the exact start.
    assert.ok(stateEquals(state, start));
    assertDisplay(print, state, 0, mode);
    assert.equal(total, mode === "lz" ? 278 : 270);
    assert.deepEqual(histogram.slice(1), mode === "lz" ? [8, 9, 80, 3] : [9, 13, 77, 1]);
  });
}

test("the printed state shows LZ 00 and the 6-HTM switch word connects LZ 00 and NZ _0", () => {
  const print = blankTop.print;
  const printed = initialState(print);
  assertDisplay(print, printed, 0, "lz");
  const word = rows("setup-nz.tsv")[0].setup;
  assert.equal(word, "L' U B' U L2 U");
  assert.equal(blankTop.modeSwitch.map(token).join(" "), word);
  const nz = applyMoves(printed, parseAlg(word));
  assertDisplay(print, nz, 0, "nz");
  // NZ _0 shows three blanks on three distinct corners.
  const blanks = front(print, nz).filter((s) => s.assetId === "blank");
  assert.equal(new Set(blanks.map((s) => s.cubie)).size, 3);
  assert.ok(stateEquals(applyMoves(nz, modeSwitchMoves(blankTop, "lz")), printed));
  assert.equal(modeSwitchMoves(blankTop, "lz").map(token).join(" "), "U' L2 U' B U' L");
});

test("LZ and NZ store identical complete states from 31 to 99, so a switch there needs no turn", () => {
  const shared = [];
  for (let v = 0; v < 100; v++)
    if (stateEquals(blankTop.routes.lz.states[v], blankTop.routes.nz.states[v])) shared.push(v);
  assert.deepEqual(shared, Array.from({ length: 69 }, (_, i) => 31 + i));
  assert.deepEqual(modeSwitchAt(blankTop, "nz", 57), []);
  assert.deepEqual(modeSwitchAt(blankTop, "lz", 31), []);
  assert.equal(modeSwitchAt(blankTop, "nz", 30), null);
  assert.equal(modeSwitchAt(blankTop, "lz", 7), null);
  assert.equal(modeSwitchAt(blankTop, "nz", 0).length, 6);
});

test("ingress rejects damaged blank-top runtime data", () => {
  const controls = [
    (d) => (d.version = 2),
    (d) => (d.printing[5].image = "blank"),
    (d) => (d.printing[11].image = "7"),
    (d) => (d.printing[0].n = [0, 0, -1]),
    (d) => (d.printing[1].up = [0, 0, -1]),
    (d) => (d.modes[0].increments[3] = "R"),
    (d) => d.modes[1].increments.pop(),
    (d) => (d.modes[0].totalHTM = 279),
    (d) => (d.modes[1].setup = "L' U B' U L2"),
    (d) => (d.modeSwitch.word = "U L2 U B' U L'"),
    (d) => ([d.modes[0], d.modes[1]] = [d.modes[1], d.modes[0]]),
  ];
  for (const mutate of controls) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateBlankTopCounter(d, design));
  }
});

test("eligibility is per print and per mode; the titled route is unchanged", () => {
  assert.deepEqual([titled.variant, titled.padded, titled.cyclic], ["titled", true, false]);
  assert.equal(titled.increments.reduce((n, w) => n + w.length, 0), 339);
  assert.equal(Math.max(...titled.increments.map((w) => w.length)), 5);
  // The titled route has no wrap edge; the cyclic routes do.
  assert.equal(certifiedStep(titled, titled.states[99], 99, 0), null);
  const { lz, nz } = blankTop.routes;
  assert.deepEqual(certifiedStep(lz, lz.states[99], 99, 0), lz.increments[99]);
  assert.equal(certifiedStep(lz, lz.states[0], 0, 99).length, lz.increments[99].length);
  // Same visible digits are not enough: other mode, other print, rear turn.
  assert.equal(certifiedStep(lz, nz.states[5], 5, 6), null);
  assert.equal(certifiedStep(nz, lz.states[12], 12, 13), null);
  assert.equal(certifiedStep(lz, titled.states[42], 42, 43), null);
  const rear = applyMoves(lz.states[42], parseAlg("B"));
  assert.ok(matchesTarget(blankTop.print, rear, targetFor(42, true, "blank-top")));
  assert.equal(certifiedStep(lz, rear, 42, 43), null);
  // The titled targets keep their title cells.
  assert.deepEqual(
    targetFor(7, true).facelets.map((f) => f.assetId),
    ["title-left", "title-right", "0", "7"],
  );
});

test("the blank-top print instance loads digits and blanks without a title document", async () => {
  const config = validateCounterConfig({ label: "COUNTER", padded: true, wrap: false, minimum: 0, maximum: 99 });
  const instance = await configurePrint(design, config, blankTop.print);
  assert.deepEqual(instance.assets.documents, []);
  assert.deepEqual(instance.assets.fonts, []);
  assert.deepEqual(
    instance.assets.images.map((i) => i.id).sort(),
    ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "blank"],
  );
  const titledInstance = await configurePrint(design, config, titled.print);
  assert.notEqual(titledInstance.print.id, instance.print.id);
  assert.ok(titledInstance.assets.documents.some((d) => d.id === "counter-title"));
});

// ------------------------------------------------------- real controller runs

const settle = async (c) => {
  for (let i = 0; c.busy && i < 400; i++) await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};
async function harness(mode = "lz", value = 0) {
  const moves = [];
  let print,
    solverCalls = 0;
  const view = {
    configure(p) {
      print = p;
    },
    resetCamera() {},
    async animate(p) {
      moves.push(p.move);
    },
  };
  const c = new CounterController(
    view,
    design,
    (_v, _b, error) => assert.equal(error, undefined),
    async (manifest) => ({ manifest, images: new Map(), materials: new Map(), textureOrigin: "bottom-left", dispose() {} }),
    async (p) => {
      const solver = await prepareTestSolver(p);
      return {
        solve(from, to, options) {
          solverCalls++;
          return solver.solve(from, to, options);
        },
      };
    },
  );
  await c.configure("COUNTER", mode === "lz", value, blankTop.routes[mode]);
  return {
    c,
    moves,
    get print() {
      return print;
    },
    get solverCalls() {
      return solverCalls;
    },
  };
}
const canonical = (h, mode, value) =>
  stateEquals(h.c.state, { ...blankTop.routes[mode].states[value], printId: h.print.id });

for (const [mode, lap] of [
  ["lz", 278],
  ["nz", 270],
]) {
  test(`controller counts a full ${mode.toUpperCase()} lap up and down through the wrap edge in ${lap} HTM each`, async () => {
    const h = await harness(mode);
    assert.equal(h.c.variant, "blank-top");
    const start = h.c.state;
    for (let step = 1; step <= 100; step++) {
      const value = step % 100,
        before = h.moves.length;
      h.c.request(value);
      await settle(h.c);
      assert.equal(h.c.currentValue, value);
      assert.ok(canonical(h, mode, value));
      assertDisplay(h.print, h.c.state, value, mode);
      assert.ok(h.moves.length - before <= 4);
    }
    assert.equal(h.moves.length, lap);
    assert.equal(h.c.progress.sessionTotal, lap);
    assert.ok(stateEquals(h.c.state, start));
    const words = [];
    for (let step = 1; step <= 100; step++) {
      const value = (100 - step) % 100,
        before = h.moves.length;
      h.c.request(value);
      await settle(h.c);
      assert.ok(canonical(h, mode, value));
      words.push(h.moves.slice(before).map(token).join(" "));
    }
    // Decrements are the research decrement words, 99 -> 98 ... 00 -> 99 order reversed.
    const research = rows(`routes-${mode}.tsv`);
    assert.equal(words[0], research[99].decrement); // 00 -> 99
    assert.equal(words[99], research[0].decrement); // 01 -> 00
    assert.equal(h.c.progress.sessionTotal, 2 * lap);
    assert.equal(h.solverCalls, 0);
    assert.equal(h.c.modeSwitch.committed, 0);
  });
}

test("the mode switch plays the 6-HTM word at 00 as setup moves, never as session moves", async () => {
  const h = await harness("lz", 1);
  await assert.rejects(
    h.c.switchRoute(blankTop.routes.nz, modeSwitchMoves(blankTop, "nz")),
    /canonical state/,
  );
  h.c.request(0);
  await settle(h.c);
  const session = h.c.progress.sessionTotal,
    before = h.moves.length;
  await h.c.switchRoute(blankTop.routes.nz, modeSwitchMoves(blankTop, "nz"));
  assert.equal(h.moves.slice(before).map(token).join(" "), "L' U B' U L2 U");
  assert.equal(h.c.progress.sessionTotal, session);
  assert.deepEqual(h.c.modeSwitch, { active: false, completed: 6, total: 6, committed: 6 });
  assert.equal(h.c.config.padded, false);
  assert.ok(canonical(h, "nz", 0));
  assertDisplay(h.print, h.c.state, 0, "nz");
  // NZ counting continues on its own stored route.
  h.c.request(1);
  await settle(h.c);
  assert.equal(h.c.progress.sessionTotal, session + blankTop.routes.nz.increments[0].length);
  h.c.request(0);
  await settle(h.c);
  await h.c.switchRoute(blankTop.routes.lz, modeSwitchMoves(blankTop, "lz"));
  assert.ok(canonical(h, "lz", 0));
  assert.equal(h.c.modeSwitch.committed, 12);
  assert.equal(h.solverCalls, 0);
  // Where both modes share the complete state, the switch plays no turn.
  h.c.request(45);
  await settle(h.c);
  const moved = h.moves.length;
  await h.c.switchRoute(blankTop.routes.nz, modeSwitchAt(blankTop, "nz", 45));
  assert.equal(h.moves.length, moved);
  assert.equal(h.c.config.padded, false);
  assert.equal(h.c.modeSwitch.committed, 12);
  await h.c.switchRoute(blankTop.routes.lz, []);
  // A route of another print is refused.
  await assert.rejects(h.c.switchRoute(titled, modeSwitchMoves(blankTop, "nz")), /same permanent print/);
});

test("arbitrary jumps and noncanonical states use the shared exactPhysical solver to blank-top targets", async () => {
  const h = await harness("nz", 23);
  h.c.request(5);
  await settle(h.c);
  assert.equal(h.solverCalls, 1);
  assert.ok(canonical(h, "nz", 5));
  assertDisplay(h.print, h.c.state, 5, "nz");
  const jump = h.moves.length;
  assert.equal(h.c.progress.sessionTotal, jump);
  h.c.request(6);
  await settle(h.c);
  assert.equal(h.solverCalls, 1);
  assert.equal(h.moves.length - jump, blankTop.routes.nz.increments[5].length);
  // Test-only injection models a noncanonical pose with the same display.
  const rear = applyMoves(h.c.state, parseAlg("B"));
  assert.ok(matchesTarget(h.print, rear, targetFor(6, false, "blank-top")));
  h.c.authoritative = rear;
  h.c.request(7);
  await settle(h.c);
  assert.equal(h.solverCalls, 2);
  assert.ok(canonical(h, "nz", 7));
});

test("the blank-top route rejects the other display format at configuration", async () => {
  const h = await harness("lz", 0);
  await assert.rejects(h.c.configure("COUNTER", false, 0, blankTop.routes.lz), /leading-zero/);
  await assert.rejects(h.c.configure("COUNTER", true, 0, blankTop.routes.nz), /no-leading-zero/);
});
