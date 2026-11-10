// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { solverRenderTimeout } from "./helpers/solver-render-timeout.mjs";

test("the confirmed CI route needs 21 quarter turns before its readiness reserve", () => {
  // The CI response has 18 moves, including three half turns: 5250 ms at 250 ms/quarter.
  const word = "F' R' U' L2 F R2 U2 L U L F' L' U F' R U L' U'";
  assert.equal(solverRenderTimeout(word), 10250);
});

test("half turns consume twice the work of clockwise or inverse quarter turns", () => {
  assert.equal(solverRenderTimeout("R"), 5250);
  assert.equal(solverRenderTimeout("R'"), 5250);
  assert.equal(solverRenderTimeout("R2"), 5500);
});

test("an empty route retains only the existing five-second readiness reserve", () => {
  assert.equal(solverRenderTimeout(""), 5000);
});

test("the page's 128-move response contract also bounds the render wait", () => {
  assert.equal(solverRenderTimeout(Array(128).fill("F2").join(" ")), 69000);
  assert.throws(() => solverRenderTimeout(Array(129).fill("F2").join(" ")), /128-move contract/);
});
