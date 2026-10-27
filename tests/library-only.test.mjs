import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseDesignState } from "@cubistry/cube-assets";
import { stateEquals } from "@cubistry/cube-core";
import {
  applyMoves,
  parseAlg,
  inverseMoves,
  stickerPoses,
} from "@cubistry/cube-mechanics";
test("library-only JSON consumer retains physical identity and frames without counter modules", async () => {
  const { print, state, assets } = await parseDesignState(
    readFileSync(
      new URL("../public/examples/library-design.json", import.meta.url),
      "utf8",
    ),
  );
  assert.deepEqual(
    new Set(assets.images.map((i) => i.kind)),
    new Set(["color", "image", "text"]),
  );
  const moves = parseAlg("R U F2 L'"),
    changed = applyMoves(state, moves),
    restored = applyMoves(changed, inverseMoves(moves));
  assert.ok(!stateEquals(changed, state));
  assert.ok(stateEquals(restored, state));
  assert.deepEqual(stickerPoses(print, restored), stickerPoses(print, state));
  assert.ok(Object.isFrozen(print.stickers));
});
