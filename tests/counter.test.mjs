import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as G from "../src/cube.mjs";
import { MinuteTimer, parseValue, shifted } from "../src/counter.mjs";
import {
  clampPitch,
  pitchLimit,
  viewTurn,
} from "../src/vendor/orbit-input.mjs";
const proof = JSON.parse(
  readFileSync(new URL("../public/counter-proof.json", import.meta.url)),
);
test("legal turns preserve rigid labeled cubies, and inverses restore exact frames", () => {
  for (const face of Object.keys(G.FACES)) {
    let state = proof.printing;
    for (let i = 0; i < 4; i++) state = G.move(state, face);
    assert.deepEqual(state, proof.printing);
    state = G.move(proof.printing, face);
    assert.deepEqual(G.apply(state, face + "'"), proof.printing);
    for (let c = 0; c < 8; c++)
      assert.equal(
        new Set(
          state.filter((s) => s.cubie === c).map((s) => JSON.stringify(s.p)),
        ).size,
        1,
      );
  }
});
test("both fixed prints cover every value upright, without changing image identities", () => {
  for (const [printing, padded] of [
    [proof.printing, true],
    [proof.unpaddedPrinting, false],
  ])
    for (const { value, word } of proof.witnesses) {
      const state = G.apply(printing, word);
      assert.ok(G.assertDisplay(state, value, padded));
      assert.deepEqual(
        state.map((s) => s.image),
        printing.map((s) => s.image),
      );
    }
});
test("rapid mixed target chains end in the exact next canonical state", () => {
  let current = 0,
    state = G.apply(proof.printing, proof.witnesses[0].word);
  for (const target of [99, 5, 0, 10, 20, 19, 18, 99, 0, 73, 17, 17, 1, 0]) {
    state = G.apply(
      state,
      G.inverse(proof.witnesses[current].word) +
        " " +
        proof.witnesses[target].word,
    );
    G.assertDisplay(state, target);
    assert.deepEqual(
      state,
      G.apply(proof.printing, proof.witnesses[target].word),
    );
    current = target;
  }
});
test("counter validates integers and explicitly clamps or wraps bounds", () => {
  for (const [text, n] of [
    ["0", 0],
    ["00", 0],
    [" 9 ", 9],
    ["99", 99],
  ])
    assert.equal(parseValue(text), n);
  for (const text of ["", "-1", "100", "1.5", "1e1", "NaN", "Infinity", "000"])
    assert.throws(() => parseValue(text));
  assert.equal(shifted(99, 10), 99);
  assert.equal(shifted(0, -10), 0);
  assert.equal(shifted(99, 1, true), 0);
  assert.equal(shifted(0, -1, true), 99);
});
test("countdown uses wall-clock deadlines, preserves partial minutes on pause, and resets", () => {
  const t = new MinuteTimer();
  assert.equal(t.start(15, 1000), 15);
  assert.equal(t.value(61000), 14);
  assert.equal(t.pause(91000), 14);
  assert.equal(t.remainingMs, 810000);
  assert.equal(t.value(1000000), 14);
  t.start(14, 1000000);
  assert.equal(t.deadline, 1810000);
  assert.equal(t.value(1810000), 0);
  assert.equal(t.state, "finished");
  assert.equal(t.reset(), 15);
  assert.equal(t.state, "idle");
});
test("deadline restoration survives a suspended tab and rejects corrupted state", () => {
  const now = Date.now(),
    t = new MinuteTimer();
  t.start(20, now - 5 * 60000);
  const restored = new MinuteTimer();
  assert.equal(restored.restore(t.serialize()), true);
  assert.equal(restored.value(now), 15);
  assert.equal(
    restored.restore({
      state: "running",
      initialMinutes: 100,
      remainingMs: 0,
      deadline: now,
    }),
    false,
  );
  const snapshot = {
    state: "paused",
    initialMinutes: 10,
    remainingMs: 123000,
    deadline: null,
    start: "bad",
  };
  assert.equal(restored.restore(snapshot), true);
  assert.equal(typeof restored.start, "function");
  assert.equal(restored.value(now + 100000), 3);
});
test("reused orbit input clamps pitch and caps release velocity without changing puzzle data", () => {
  const snapshot = JSON.stringify(proof.printing),
    turn = viewTurn(30, -40, 0);
  assert.equal(turn.yaw, 0.24);
  assert.equal(turn.yawVelocity, 0.006);
  assert.equal(turn.pitchVelocity, -0.006);
  assert.equal(clampPitch(999), pitchLimit);
  assert.equal(clampPitch(-999), -pitchLimit);
  assert.equal(JSON.stringify(proof.printing), snapshot);
});
