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
  const source = applyMoves(initialState(design.print), parseAlg("U D2 B D'"));
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
test("real blank print preserves independently checked 00–59 prefix totals including overflow", () => {
  for (const [letter, total] of [
    ["H", 267],
    ["S", 269],
    ["M", 262],
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
