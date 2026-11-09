// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: one turn timing for layer turns and whole-cube rotations (x, y, z). The player hands the
// view the same duration (the speed setting, milliseconds per turn) and the same easing (none: the view's smoothstep)
// for every block, whatever its kind and wherever the rotation sits (before the moves, after them, stored in the word).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { clonePose } from "../src/apps/calendar7/engine.ts";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { playedBlocks } from "../src/apps/calendar7/deferral.ts";
import { playerHtml } from "../src/apps/calendar7/month-view.ts";
import { Calendar7Player, DEFAULT_SPEED, SPEEDS, blockMs } from "../src/apps/calendar7/player.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const { printing, pose: root } = parseState(json("public/calendar7/state.v1.json"));
const LAST = graph.nodes.length - 1;

/** A view that records every turn and finishes it at once. */
const recordingView = () => {
  const turns = [];
  return { turns, show() {}, turn: (block, before, ms, ease) => (turns.push({ block, ms, ease, before: clonePose(before) }), Promise.resolve()) };
};
const settle = async (player) => {
  for (let i = 0; i < 100000 && player.snapshot.status === "playing"; i++) await Promise.resolve();
};
/** First edge whose played step contains at least one rotation turn and at least one layer turn under `orientation`. */
const edgeFor = (orientation) => {
  for (let e = 5; e < LAST; e++) {
    const p = playedBlocks(graph.edges[e].moves, { slice: true, orientation });
    const rotations = p.alignment.length + p.blocks.filter((b) => b.kind === "rotation").length;
    if (rotations > 0 && p.blocks.some((b) => b.kind !== "rotation")) return e;
  }
  throw new Error(`no edge with rotations for ${orientation}`);
};

test("the speeds are the repository's Rotation Speed stops in milliseconds per quarter turn: 100, 250, 500 ms and 1 s", () => {
  assert.deepEqual([...SPEEDS], [100, 250, 500, 1000]);
  assert.equal(DEFAULT_SPEED, 250);
  const html = playerHtml(DEFAULT_SPEED);
  const options = [...html.matchAll(/<option value="(\d+)"( selected)?>([^<]+)<\/option>/g)].filter((m) => SPEEDS.includes(Number(m[1])));
  assert.deepEqual(options.map((m) => [m[1], m[3]]), [["100", "100 ms"], ["250", "250 ms"], ["500", "500 ms"], ["1000", "1 s"]]);
  assert.deepEqual(options.filter((m) => m[2]).map((m) => m[1]), ["250"]);
});

for (const orientation of ["before", "after", "stored"]) {
  test(`orientation ${orientation}: a whole-cube rotation turns exactly like a layer turn at every speed (ms = speed x quarter turns, same easing)`, async () => {
    const e = edgeFor(orientation);
    for (const speed of SPEEDS) {
      const view = recordingView();
      const player = new Calendar7Player({ graph, printing, root, view, reducedMotion: () => false, orientation, slice: true });
      player.setSpeed(speed);
      player.jump(e);
      player.go(e + 1);
      await settle(player);
      const rotations = view.turns.filter((t) => t.block.kind === "rotation");
      const layers = view.turns.filter((t) => t.block.kind !== "rotation");
      assert.ok(rotations.length > 0 && layers.length > 0, `${orientation}: ${rotations.length} rotations, ${layers.length} layer turns`);
      for (const t of view.turns) {
        assert.equal(t.ms, speed * Math.abs(t.block.angle), `${t.block.kind} turn of ${t.block.angle} at ${speed}`);
        assert.equal(t.ease, undefined, `${t.block.kind} turn at ${speed} uses the view's default easing`);
      }
      assert.equal(player.snapshot.speed, speed);
    }
  });
}

test("duration = speed x quarter turns for layer and rotation blocks: q = 1, -1 and 2 at every speed", () => {
  const block = (kind, angle) => ({ axis: 0, lo: kind === "rotation" ? -3 : 1, hi: kind === "rotation" ? 3 : 1, angle, kind });
  for (const speed of SPEEDS) {
    for (const kind of ["single", "outer-wide", "slice", "rotation"]) {
      assert.equal(blockMs(block(kind, 1), speed), speed);
      assert.equal(blockMs(block(kind, -1), speed), speed, "the direction does not change the time");
      assert.equal(blockMs(block(kind, 2), speed), 2 * speed, `${kind} half turn takes twice a quarter turn`);
    }
  }
});

test("played half turns (layer and rotation) last twice a quarter turn, quarter turns last one speed", async () => {
  let found = null;
  for (let e = 5; e < LAST && !found; e++) {
    const blocks = playedBlocks(graph.edges[e].moves, { slice: true, orientation: "stored" }).blocks;
    const has = (rot, q) => blocks.some((b) => (b.kind === "rotation") === rot && Math.abs(b.angle) === q);
    if (has(true, 2) && has(false, 1) && has(false, 2)) found = e;
  }
  assert.notEqual(found, null, "an edge with a half-turn rotation, a half-turn layer and a quarter-turn layer exists");
  const view = recordingView();
  const player = new Calendar7Player({ graph, printing, root, view, reducedMotion: () => false, orientation: "stored", slice: true });
  player.setSpeed(500);
  player.jump(found);
  player.go(found + 1);
  await settle(player);
  const seen = new Set(view.turns.map((t) => `${t.block.kind === "rotation" ? "rot" : "layer"}${Math.abs(t.block.angle)}:${t.ms}`));
  for (const k of ["rot2:1000", "layer1:500", "layer2:1000"]) assert.ok(seen.has(k), `${k} in ${[...seen]}`);
  assert.ok(view.turns.every((t) => t.ease === undefined));
});

test("the old multiplier speeds are refused", () => {
  const player = new Calendar7Player({ graph, printing, root, view: recordingView(), reducedMotion: () => false });
  for (const old of [0.5, 1, 2, 4, 8]) assert.throws(() => player.setSpeed(old), RangeError, `${old}`);
});
