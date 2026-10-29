import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { stateEquals, validateState } from "@cubistry/cube-core";
import {
  applyMoves,
  inverseMoves,
  parseAlg,
  serializeMove,
  stickerPoses,
} from "@cubistry/cube-mechanics";
import {
  createDesign,
  classify,
  fullGoal,
  scramble,
} from "../src/apps/playground/model.ts";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
for (const style of ["classic", "picture"]) {
  test(`${style}: permanent IDs, local frames, rotation classification and real provider exact solve`, async () => {
    const d = createDesign(style);
    assert.equal(d.print.stickers.length, 24);
    assert.equal(d.print.cubies.length, 8);
    assert.equal(new Set(d.print.stickers.map((s) => s.id)).size, 24);
    assert.equal(d.equivalents.length, 24);
    const original = JSON.stringify(d.print);
    for (const seed of [0, 1, 42, 4294967295]) {
      const word = scramble(seed, 20);
      assert.deepEqual(word, scramble(seed, 20));
      assert.deepEqual(parseAlg(word.map(serializeMove).join(" ")), word);
      const moved = applyMoves(d.target, word);
      validateState(moved, d.print);
      assert.deepEqual(
        stickerPoses(d.print, moved).map((s) => s.id),
        stickerPoses(d.print, d.target).map((s) => s.id),
      );
      assert.ok(fullGoal(d, applyMoves(moved, inverseMoves(word))));
    }
    const reoriented = applyMoves(d.target, parseAlg("R L'"));
    assert.deepEqual(classify(d, reoriented), {
      exact: false,
      rotationEquivalent: true,
    });
    const solver = await prepareTestSolver(d.print);
    for (const state of [
      reoriented,
      applyMoves(d.target, scramble(0, 17)),
      applyMoves(d.target, scramble(9, 20)),
    ]) {
      const result = solver.solve(state, d.target);
      assert.deepEqual(parseAlg(result.map(serializeMove).join(" ")), result);
      assert.ok(fullGoal(d, applyMoves(state, result)));
    }
    assert.equal(JSON.stringify(d.print), original);
  });
}
test("distinct print sessions and original image tile provenance", () => {
  const classic = createDesign("classic"),
    picture = createDesign("picture");
  assert.notEqual(classic.print.id, picture.print.id);
  assert.ok(!stateEquals(classic.target, picture.target));
  for (const image of picture.assets.images) {
    const source = readFileSync(
      new URL(`../public${image.url}`, import.meta.url),
      "utf8",
    );
    assert.equal(
      createHash("sha256").update(source).digest("hex"),
      image.sha256,
    );
    assert.ok(!/<(?:text|clipPath|image|script)\b|href=/.test(source));
    assert.match(
      source,
      /width="160" height="160" viewBox="(?:0|160) (?:0|160) 160 160"/,
    );
  }
  assert.throws(() => scramble(-1, 20));
  assert.throws(() => scramble(0, 101));
  assert.throws(() => scramble(1.5, 20));
});
