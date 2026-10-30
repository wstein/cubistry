import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { validateHsmDesign, hsmTarget } from "../src/apps/hsm/design.ts";
import { HsmPlanner } from "../src/apps/hsm/planner.ts";
import { HsmController } from "../src/apps/hsm/controller.ts";
import {
  initialState,
  applyMoves,
  parseAlg,
  matchesTarget,
  inverseMoves,
} from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
const raw = JSON.parse(readFileSync("public/hsm-counter.v2.json"));
const design = validateHsmDesign(raw);
const planner = new HsmPlanner();
test("real blank is part of every physical target and the known free jump needs six moves", () => {
  assert.equal(hsmTarget("M", 33).facelets.length, 4);
  assert.equal(hsmTarget("M", 33).facelets[0].assetId, "blank");
  assert.equal(
    design.print.stickers.filter((s) => s.assetId === "blank").length,
    3,
  );
  const source = applyMoves(
    initialState(design.print),
    parseAlg(design.zeroWords.H),
  );
  assert.ok(matchesTarget(design.print, source, hsmTarget("H", 0)));
  const moves = planner.plan(design.print, source, "H", 34);
  assert.equal(moves.length, 6);
  assert.ok(
    matchesTarget(design.print, applyMoves(source, moves), hsmTarget("H", 34)),
  );
});
const settled = async (c) => {
  for (let n = 0; c.busy && n < 100; n++)
    await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
  assert.notEqual(c.progress.status, "failed");
};
// The exact shortest-path planner with lookahead (policy 13) is the fallback
// for every pose that is not on a saved period. Its first 00–59–00 pass from each
// unit's setup on the seconds-first print is pinned here; the saved periods
// (tests/hsm-seconds-first.test.mjs) do better.
test("fallback planner keeps its pinned 00–59 prefix totals including overflow", () => {
  for (const [letter, total] of [
    ["H", 242],
    ["S", 195],
    ["M", 231],
  ]) {
    let state = applyMoves(
        initialState(design.print),
        parseAlg(design.zeroWords[letter]),
      ),
      sum = 0;
    for (let n = 1; n <= 60; n++) {
      const value = n % 60,
        moves = planner.plan(
          design.print,
          state,
          letter,
          value,
          n === 60 ? undefined : (value + 1) % 60,
        );
      assert.ok(moves.length <= 6);
      sum += moves.length;
      const old = state;
      state = applyMoves(state, moves);
      assert.ok(matchesTarget(design.print, state, hsmTarget(letter, value)));
      assert.ok(stateEquals(applyMoves(state, inverseMoves(moves)), old));
    }
    assert.equal(sum, total);
  }
});
test("controller repeats all eighteen modes, changes ranges/direction and replans arbitrary targets within six HTM", async () => {
  const traces = [];
  for (const letter of ["H", "S", "M"]) {
    const committed = [];
    const c = new HsmController(
      {
        configure() {},
        animate: async (p) => {
          committed.push(p);
        },
        resetCamera() {},
      },
      design,
      {},
      letter,
      () => {},
      async () => ({ dispose() {} }),
    );
    await c.configure();
    const start = c.state;
    for (const maximum of [59, 11, 23])
      for (const direction of [1, -1]) {
        c.setMode(maximum, direction);
        c.request(0);
        await settled(c);
        for (let i = 0; i < 3 * (maximum + 1); i++) {
          const target =
              (c.currentValue + direction + maximum + 1) % (maximum + 1),
            before = c.progress.sessionTotal;
          c.request(target);
          await settled(c);
          assert.equal(c.currentValue, target);
          assert.ok(c.progress.sessionTotal - before <= 6);
          assert.ok(
            matchesTarget(design.print, c.state, hsmTarget(letter, target)),
          );
        }
      }
    for (const value of [59, 0, 13, 44, 11, 23, 0]) {
      const before = c.progress.sessionTotal;
      c.request(value);
      await settled(c);
      assert.ok(c.progress.sessionTotal - before <= 6);
    }
    traces.push({ letter, start, committed });
    c.dispose();
  }
  mkdirSync("test-results", { recursive: true });
  writeFileSync(
    "test-results/hsm-controller-commits.json",
    JSON.stringify({ print: design.print, traces }),
  );
});
test("HSM stop finishes active target, drops queued work and retains authoritative pose", async () => {
  let release;
  let hold = true;
  const c = new HsmController(
    {
      configure() {},
      animate: async () => {
        if (hold) {
          hold = false;
          await new Promise((r) => (release = r));
        }
      },
      resetCamera() {},
    },
    design,
    {},
    "H",
    () => {},
    async () => ({ dispose() {} }),
  );
  await c.configure();
  c.request(1);
  c.request(59);
  assert.equal(c.stopAfterCurrent(), 1);
  release();
  await settled(c);
  assert.equal(c.currentValue, 1);
  assert.equal(c.progress.status, "stopped");
  c.request(0);
  await settled(c);
  assert.ok(c.progress.total <= 6);
  c.resetSessionMoves();
  assert.equal(c.progress.sessionTotal, 0);
  c.dispose();
});
test("HSM rejects unsupported prints, values and counting modes", () => {
  for (const n of [-1, 60, 1.5, NaN]) assert.throws(() => hsmTarget("H", n));
  assert.throws(() => hsmTarget("X", 0));
  for (const mutate of [
    (d) => d.printing.pop(),
    (d) => (d.printing[0].image = "X"),
    (d) => (d.zeroWords.H = ""),
    (d) => (d.printing[0].up = [0, 0, 0]),
  ]) {
    const d = structuredClone(raw);
    mutate(d);
    assert.throws(() => validateHsmDesign(d));
  }
  const c = new HsmController({}, design, {}, "H", () => {});
  assert.throws(() => c.setMode(99, 1));
  assert.throws(() => c.setMode(59, 0));
});
test("blank up vectors are free while printed glyphs stay oriented", () => {
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const turned = structuredClone(raw);
  for (const s of turned.printing)
    if (s.image === "") s.up = cross(s.n, s.up).map((x) => x + 0);
  const variant = validateHsmDesign(turned);
  const setup = parseAlg(design.zeroWords.H);
  const source = applyMoves(initialState(design.print), setup);
  const moved = applyMoves(initialState(variant.print), setup);
  for (const value of [34, 0, 59, 17])
    assert.deepEqual(
      planner
        .plan(variant.print, moved, "H", value)
        .map((m) => JSON.stringify(m)),
      planner
        .plan(design.print, source, "H", value)
        .map((m) => JSON.stringify(m)),
    );
  assert.equal(planner.plan(variant.print, moved, "H", 34).length, 6);
  const letter = structuredClone(raw);
  for (const s of letter.printing)
    if (/^[HSM]$/.test(s.image)) s.up = s.up.map((x) => -x + 0);
  assert.throws(() => validateHsmDesign(letter), /Invalid HSM setup/);
});
// Counting modes that have a saved period (S and M 00–59, H 00–23 and 00–11,
// each up and down) close over the full pose within one period and never exceed
// five HTM per step. The other combinations have no period; they use the exact
// planner and keep the universal six-move bound.
const PERIOD_MODES = [
  ["S", 59],
  ["M", 59],
  ["H", 23],
  ["H", 11],
];
test("each fresh 00 setup reaches a full-state counting period within the stated HTM bound", async () => {
  for (const letter of ["H", "S", "M"])
    for (const maximum of [59, 23, 11])
      for (const direction of [1, -1]) {
        const researched = PERIOD_MODES.some(
          ([l, m]) => l === letter && m === maximum,
        );
        const c = new HsmController(
          { configure() {}, animate: async () => {}, resetCamera() {} },
          design,
          {},
          letter,
          () => {},
          async () => ({ dispose() {} }),
        );
        c.setMode(maximum, direction);
        await c.configure();
        const seen = new Set([JSON.stringify(c.state)]);
        let closed = false;
        for (
          let pass = 0;
          pass < (researched ? 40 : 6) && !(closed && researched);
          pass++
        ) {
          for (let i = 0; i <= maximum; i++) {
            const target =
              (c.currentValue + direction + maximum + 1) % (maximum + 1);
            c.request(target);
            await settled(c);
            assert.equal(c.currentValue, target);
            assert.ok(
              c.progress.total <= (researched ? 5 : 6),
              `${letter}/${maximum}/${direction} step to ${target} took ${c.progress.total} HTM`,
            );
          }
          const key = JSON.stringify(c.state);
          closed = seen.has(key);
          seen.add(key);
        }
        if (researched)
          assert.ok(closed, `${letter}/${maximum}/${direction} did not close`);
        c.dispose();
      }
});
