// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: the real Calendar7Viewer.turn on a real PhysicalCubeScene (research candidate, not
// certified). No WebGL: the scene graph is driven directly. At the end of each animated move the three.js world
// matrices of every body and sticker must equal those of a scene synced to the engine pose after that move. A flipped
// angle sign or layer-selection sign in viewer.ts makes this fail (mutation-checked, see the PR).
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { PhysicalCubeScene, createPlasticMaterial, createPresentationGeometry } from "@cubistry/cube-viewer";
import { STICKERS, applyMoves, clonePose, inverseMoves, samePose } from "../src/apps/calendar7/engine.ts";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { groupBlocks, expand } from "../src/apps/calendar7/blocks.ts";
import { Calendar7Viewer } from "../src/apps/calendar7/viewer.ts";
import { MoveTween, smoothstep } from "../src/apps/calendar7/tween.ts";
import { allOrientations, rotationBlock } from "../src/apps/calendar7/deferral.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const { printing, pose: root } = parseState(json("public/calendar7/state.v1.json"));
const LAST = graph.nodes.length - 1;

const frames = (pose) =>
  Array.from({ length: STICKERS }, (_, i) => ({
    id: i + 1,
    cubie: printing.piece[i],
    p: [...pose.pos.slice(3 * i, 3 * i + 3)],
    n: [...pose.normal.slice(3 * i, 3 * i + 3)],
    up: [...pose.up.slice(3 * i, 3 * i + 3)],
  }));
const presentation = new THREE.Group();
const materials = new Map();
const basic = new THREE.MeshBasicMaterial();
for (let i = 1; i <= STICKERS; i++) materials.set(i, basic);
const cube = new PhysicalCubeScene(presentation, frames(root), materials, createPlasticMaterial(), 1, createPresentationGeometry());
// The viewer without its WebGL constructor: only what turn() and show() use.
const viewer = Object.create(Calendar7Viewer.prototype);
const tween = new MoveTween();
const beginTween = tween.begin.bind(tween);
let tweenStart = 0;
tween.begin = (ms, update, end, startAt, ease) => {
  tweenStart = startAt;
  return beginTween(ms, update, end, startAt, ease);
};
Object.assign(viewer, { destroyed: false, cube, printing, tween, onLayer: new Uint8Array(219), frames: frames(root), dirty: false });

/** World matrices of every body (group holding stickers) and of its first sticker, by sticker id. */
const snapshot = () => {
  presentation.updateMatrixWorld(true);
  const out = new Map();
  presentation.traverse((o) => {
    const s = o.children.find((c) => c.userData.stickerId !== undefined);
    if (s) out.set(s.userData.stickerId, [o.matrixWorld.elements.slice(), s.matrixWorld.elements.slice()]);
  });
  return out;
};
const sameMaps = (a, b) =>
  a.size === b.size &&
  [...a].every(([id, [w, s]]) => {
    const o = b.get(id);
    return o && w.every((x, k) => Math.abs(x - o[0][k]) < 1e-6) && s.every((x, k) => Math.abs(x - o[1][k]) < 1e-6);
  });
/** Frame time relative to the actual start supplied by the viewer, independent of later clock reads or scheduling. */
const later = (ms) => tweenStart + ms;

// Capture the pose of the scene at progress 1, before the pivot is released and the bodies are synced.
const realBegin = cube.beginTurn.bind(cube);
let atEnd = null;
const seen = [];
cube.beginTurn = (pieces, axis, angle) => {
  const t = realBegin(pieces, axis, angle);
  return { update: (p) => (seen.push(p), t.update(p), p === 1 && (atEnd = snapshot())), dispose: () => t.dispose() };
};

const stats = { quarter: 0, quarterBack: 0, half: 0, rot: 0, single: 0, "outer-wide": 0, "inner-wide": 0 };
function playMove(before, block) {
  atEnd = null;
  const done = viewer.turn(block, before, 10);
  viewer.tween.tick(later(0));
  viewer.tween.tick(later(1000));
  assert.ok(atEnd, "the turn reached progress 1");
  const after = applyMoves(before, expand([block]));
  const afterTurn = snapshot(); // the viewer's own sync after the turn
  cube.sync(frames(after));
  const reference = snapshot();
  return { done, ok: sameMaps(atEnd, reference) && sameMaps(afterTurn, reference), after };
}
/** Plays the blocks of a word, each as ONE animation; the result must equal the plain engine replay of the word. */
function walk(from, moves, options) {
  let pose = clonePose(from);
  for (const block of groupBlocks(moves, options)) {
    cube.sync(frames(pose));
    const r = playMove(pose, block);
    assert.ok(r.ok, `world pose differs from the engine after block ${JSON.stringify(block)}`);
    if (block.kind === "rotation") stats.rot++;
    else if (block.angle === 2) stats.half++;
    else if (block.angle === 1) stats.quarter++;
    else stats.quarterBack++;
    stats[block.kind] = (stats[block.kind] ?? 0) + 1;
    pose = r.after;
  }
  assert.ok(samePose(pose, applyMoves(from, moves)), "blocks end on the pose of the plain word");
  return pose;
}
const nodePose = (k) => {
  let p = root;
  for (let i = 0; i < k; i++) p = applyMoves(p, graph.edges[i].moves);
  return p;
};

test("each animated move ends on the engine pose: forward and backward, quarter, counter-quarter, half, rot, chain start and end", async () => {
  // Chain start: edges 0..1 forward then back.
  let pose = walk(root, [...graph.edges[0].moves, ...graph.edges[1].moves]);
  walk(pose, [...inverseMoves(graph.edges[1].moves), ...inverseMoves(graph.edges[0].moves)]);
  // A middle edge and the last edge of the chain, both ways.
  for (const e of [300, LAST - 1]) {
    const start = nodePose(e);
    const end = walk(start, graph.edges[e].moves);
    walk(end, inverseMoves(graph.edges[e].moves));
  }
  // Explicit wide blocks: x-3..-1 (outer), y+1..+2' (inner-wide), z+2..+3 half turn (outer), a rotation, y-3..-2 half.
  walk(root, [[1, 1], [2, 1], [3, 1], [11, -1], [12, -1], [19, 2], [20, 2], [21, 1], [8, 2], [9, 2], [10, 1]]);
  for (const [kind, n] of Object.entries(stats)) assert.ok(n > 0, `sample includes ${kind} moves`);
});

test("a skipped (cancelled) turn leaves the bodies at the given pose", () => {
  const pose = nodePose(2);
  cube.sync(frames(pose));
  void viewer.turn(groupBlocks(graph.edges[2].moves)[0], pose, 100);
  viewer.tween.tick(later(50));
  const target = nodePose(3);
  viewer.show(target);
  const shown = snapshot();
  cube.sync(frames(target));
  assert.ok(sameMaps(shown, snapshot()));
  assert.equal(viewer.tween.running, false);
});

test("middle-slice blocks (rule c) animate as one slab turn of the interval including layer 0 and end on the engine pose", () => {
  // Every interval of the layers -3..3 that contains layer 0 (not the whole cube), every axis, every exponent, from a mixed pose.
  const start = nodePose(40);
  let n = 0;
  for (let axis = 0; axis < 3; axis++)
    for (let lo = -3; lo <= 0; lo++)
      for (let hi = 0; hi <= 3; hi++) {
        if (lo === -3 && hi === 3) continue;
        for (const angle of [1, -1, 2]) {
          cube.sync(frames(start));
          const block = { axis, lo, hi, angle, kind: "slice" };
          const r = playMove(start, block);
          assert.ok(r.ok, `slab turn of ${JSON.stringify(block)} differs from the engine`);
          n++;
        }
      }
  assert.equal(n, 3 * 15 * 3);
  // Stored edges grouped with the middle slice, forward and backward: every block (slice, wide, single, rotation) matches.
  stats.slice = 0;
  for (const e of [0, 300, LAST - 1]) {
    const from = nodePose(e);
    const end = walk(from, graph.edges[e].moves, { slice: true });
    walk(end, inverseMoves(graph.edges[e].moves), { slice: true });
  }
  assert.ok(stats.slice > 0, "the sample includes slice blocks");
});

test("negative control: a slab that leaves out layer 0 does not end on the pose of the slice block", () => {
  const start = nodePose(40);
  for (const block of [
    { axis: 0, lo: 0, hi: 0, angle: 1, kind: "slice" },
    { axis: 1, lo: -2, hi: 0, angle: -1, kind: "slice" },
    { axis: 2, lo: -1, hi: 2, angle: 2, kind: "slice" },
  ]) {
    cube.sync(frames(start));
    atEnd = null;
    void viewer.turn(block, start, 10);
    viewer.tween.tick(later(0));
    viewer.tween.tick(later(1000));
    // The reference pose of the slice block, and of the same interval without layer 0 (the middle slice left out).
    cube.sync(frames(applyMoves(start, expand([block]))));
    const full = snapshot();
    assert.ok(sameMaps(atEnd, full));
    const narrowed = block.lo === block.hi ? null : { ...block, lo: block.lo < 0 ? block.lo : 1, hi: block.hi > 0 ? block.hi : -1, kind: "single" };
    cube.sync(frames(narrowed ? applyMoves(start, expand([narrowed])) : start));
    assert.ok(!sameMaps(atEnd, snapshot()), `${JSON.stringify(block)} is not the slab without layer 0`);
  }
});

for (const [label, ease] of [["default smoothstep", undefined], ["custom easing", (p) => p * p]])
test(`end alignment: ${label} preserves the rotated pose (1e-6) for all 24 orientations`, () => {
  const start = nodePose(40);
  let moves = 0;
  for (const o of allOrientations()) {
    let pose = start;
    for (const move of o.moves) {
      const block = rotationBlock(move);
      const quarters = Math.abs(move[1]);
      cube.sync(frames(pose));
      seen.length = 0;
      atEnd = null;
      const duration = 1000 * quarters;
      void viewer.turn(block, pose, duration, ease);
      const curve = ease ?? smoothstep;
      const quarterTime = later(duration * 0.25);
      viewer.tween.tick(quarterTime);
      const quarter = seen.at(-1);
      // Use the representable frame fraction: adding to a fractional start can round by one floating-point bit.
      assert.ok(quarter >= curve((quarterTime - tweenStart) / duration) && quarter <= curve(0.27), `quarter-time progress: ${quarter}`);
      const midTime = later(duration * 0.5);
      viewer.tween.tick(midTime);
      const mid = seen.at(-1);
      const expected = curve((midTime - tweenStart) / duration);
      assert.ok(mid >= expected && mid <= curve(0.52), `eased progress at half time: ${mid} vs ${expected}`);
      if (ease) assert.notEqual(mid, smoothstep(0.5), "the custom curve overrides smoothstep");
      viewer.tween.tick(later(10 * duration));
      assert.equal(seen.at(-1), 1);
      assert.ok(atEnd, "reached progress 1");
      const after = applyMoves(pose, expand([block]));
      const afterTurn = snapshot();
      cube.sync(frames(after));
      assert.ok(sameMaps(atEnd, snapshot()) && sameMaps(afterTurn, snapshot()), `rotation ${JSON.stringify(move)}`);
      pose = after;
      moves++;
    }
    // The pose after the alignment equals the engine pose of the two rotations in the stored frame.
    assert.ok(samePose(pose, applyMoves(start, o.moves)));
  }
  assert.equal(moves, 9 + 2 * 14, "nine single rotations, fourteen pairs");
  // Reduced motion hands no easing: the plain smoothstep, and the same end pose.
  cube.sync(frames(start));
  seen.length = 0;
  void viewer.turn(rotationBlock([14, 1]), start, 150);
  viewer.tween.tick(later(75));
  assert.ok(Math.abs(seen.at(-1) - 0.5) < 0.02);
  viewer.tween.tick(later(1000));
  assert.ok(samePose(applyMoves(start, [[14, 1]]), applyMoves(start, expand([rotationBlock([14, 1])]))));
});

test("negative control: the opposite rotation does not end on the pose of the alignment", () => {
  const start = nodePose(40);
  cube.sync(frames(start));
  atEnd = null;
  void viewer.turn(rotationBlock([7, -1]), start, 10);
  viewer.tween.tick(later(0));
  viewer.tween.tick(later(10000));
  cube.sync(frames(applyMoves(start, [[7, 1]])));
  assert.ok(!sameMaps(atEnd, snapshot()));
});
