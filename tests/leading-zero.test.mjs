import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { eq } from "@cubistry/cube-core";
import { stickerPoses, applyMove } from "@cubistry/cube-mechanics";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { validateCertifiedCounter } from "../src/apps/counter/certified.ts";
import { overriddenSticker } from "../packages/cube-viewer/src/facelet-image.ts";
const design = validateCounterDesign(
  JSON.parse(readFileSync("public/counter-design.v2.json")),
);
const route = validateCertifiedCounter(
  JSON.parse(readFileSync("public/counter-certified.v1.json")),
  design,
);
const rule = Object.freeze({
  position: [-1, -1, 1],
  normal: [0, 0, 1],
  sourceAssetId: "0",
  replacementAssetId: "blank",
});
test("all100 optimized states retain identical immutable printing and physics with only the leading zero selected", () => {
  const before = JSON.stringify(route);
  for (let value = 0; value < 100; value++) {
    const state = route.states[value];
    assert.equal(overriddenSticker(route.print, state, null), null);
    const id = overriddenSticker(route.print, state, rule);
    if (value < 10) {
      const s = stickerPoses(route.print, state).find((s) => s.id === id);
      assert.ok(s);
      assert.equal(s.assetId, "0");
      assert.ok(eq(s.p, [-1, -1, 1]));
      assert.ok(eq(s.n, [0, 0, 1]));
      const units = stickerPoses(route.print, state).find(
        (s) => eq(s.p, [1, -1, 1]) && eq(s.n, [0, 0, 1]),
      );
      assert.notEqual(id, units.id);
    } else assert.equal(id, null);
  }
  assert.equal(JSON.stringify(route), before);
});
test("each of339 physical commits selects at most the zero in the one designated field without touching other zeros", () => {
  let state = route.states[0],
    count = 0;
  for (const moves of route.increments)
    for (const move of moves) {
      state = applyMove(state, move);
      count++;
      const before = JSON.stringify({ print: route.print, state });
      const id = overriddenSticker(route.print, state, rule);
      const matches = stickerPoses(route.print, state).filter(
        (s) =>
          eq(s.p, rule.position) && eq(s.n, rule.normal) && s.assetId === "0",
      );
      assert.equal(id, matches[0]?.id ?? null);
      assert.ok(matches.length <= 1);
      assert.equal(JSON.stringify({ print: route.print, state }), before);
    }
  assert.equal(count, 339);
  assert.deepEqual(state, route.states[99]);
});
