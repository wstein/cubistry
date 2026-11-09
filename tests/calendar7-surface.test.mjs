// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: the optional top-level "surface" field of the state file ("sticker" default, or "face" for
// the stickerless 3D view). The shipped state file has no such field and keeps drawing stickers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseState } from "../src/apps/calendar7/graph.ts";

const state = JSON.parse(readFileSync("public/calendar7/state.v1.json", "utf8"));

test("the shipped state file has no surface field and parses as sticker", () => {
  assert.equal("surface" in state, false);
  assert.equal(parseState(state).surface, "sticker");
});

test("surface sticker and face are accepted", () => {
  assert.equal(parseState({ ...state, surface: "sticker" }).surface, "sticker");
  assert.equal(parseState({ ...state, surface: "face" }).surface, "face");
});

test("any other surface is a validation error with a stable message", () => {
  for (const bad of ["Face", "stickerless", "", null, 1, true, ["face"], {}])
    assert.throws(() => parseState({ ...state, surface: bad }), { message: 'state surface must be "sticker" or "face"' }, JSON.stringify(bad));
});

test("the rest of the state is unaffected by the field", () => {
  const a = parseState(state);
  const b = parseState({ ...state, surface: "face" });
  assert.deepEqual(b.printing, a.printing);
  assert.deepEqual(b.node, a.node);
  assert.deepEqual([...b.pose.pos], [...a.pose.pos]);
});
