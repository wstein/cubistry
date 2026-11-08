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
import { MoveTween } from "../src/apps/calendar7/tween.ts";

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
Object.assign(viewer, { destroyed: false, cube, printing, tween: new MoveTween(), onLayer: new Uint8Array(219), frames: frames(root), dirty: false });

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
/** Frame time far after the start of the tween that just began (its clock starts at performance.now()). */
const later = (ms) => performance.now() + ms;

// Capture the pose of the scene at progress 1, before the pivot is released and the bodies are synced.
const realBegin = cube.beginTurn.bind(cube);
let atEnd = null;
cube.beginTurn = (pieces, axis, angle) => {
  const t = realBegin(pieces, axis, angle);
  return { update: (p) => (t.update(p), p === 1 && (atEnd = snapshot())), dispose: () => t.dispose() };
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
function walk(from, moves) {
  let pose = clonePose(from);
  for (const block of groupBlocks(moves)) {
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
