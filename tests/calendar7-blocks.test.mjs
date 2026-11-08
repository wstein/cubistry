// English 7x7 calendar cube: block moves (wide and inner-wide), a display layer over the stored words (research
// candidate, not certified). Properties of groupBlocks/expand, the identical SHA-256 digest for every stored edge in both
// directions, and the notation and counts on the page. Deterministic: seeded random words, no network, no timers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  applyBlockInPlace,
  blockCounts,
  blockToken,
  expand,
  expandBlock,
  groupBlocks,
} from "../src/apps/calendar7/blocks.ts";
import { applyMoves, clonePose, generatorAxis, generatorLayer, inverseMoves, isRotation, metrics, samePose, stateDigest } from "../src/apps/calendar7/engine.ts";
import { encodeMoves, parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { moveToken, rawToken, stepFrom, chainRange, pageHtml, buildModel, chooseMonth } from "../src/apps/calendar7/month-view.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const { printing, pose: root } = parseState(json("public/calendar7/state.v1.json"));
const digest = (pose) => stateDigest(printing, pose);

/** Small seeded generator (mulberry32). */
const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const randomWord = (next, length, axes = 3) => {
  const word = [];
  for (let i = 0; i < length; i++) {
    // Runs on one axis are likely, so that blocks actually form.
    const axis = i > 0 && next() < 0.7 ? generatorAxis(word[i - 1][0]) : Math.floor(next() * axes);
    const slot = 1 + Math.floor(next() * (next() < 0.1 ? 7 : 6));
    word.push([7 * axis + slot, [1, -1, 2][Math.floor(next() * 3)]]);
  }
  return word;
};
const multiset = (word) => word.map(([g, q]) => `${g}:${q}`).sort();

test("fixed examples: single, outer-wide, inner-wide, no merge across the middle layer or different exponents", () => {
  const tokens = (w) => groupBlocks(w).map(blockToken);
  assert.deepEqual(tokens([[1, 1]]), ["x-3"]);
  assert.deepEqual(tokens([[1, 1], [2, 1], [3, 1]]), ["x-3..-1"]);
  assert.deepEqual(tokens([[3, 1], [2, 1], [1, 1]]), ["x-3..-1"], "commuting moves of a run are reordered");
  assert.deepEqual(tokens([[5, -1], [6, -1]]), ["x+2..+3'"]);
  assert.deepEqual(tokens([[2, 2], [3, 2]]), ["x-2..-1²"]);
  assert.deepEqual(tokens([[4, 1], [5, 1]]), ["x+1..+2"]);
  assert.deepEqual(tokens([[3, 1], [4, 1]]), ["x-1", "x+1"], "layers -1 and +1 are not neighbors (layer 0 is never turned)");
  assert.deepEqual(tokens([[1, 1], [2, -1]]), ["x-3", "x-2'"], "different exponents do not merge");
  assert.deepEqual(tokens([[1, 1], [8, 1]]), ["x-3", "y-3"], "different axes do not merge");
  assert.deepEqual(tokens([[1, 1], [7, 1], [2, 1]]), ["x-3", "xrot", "x-2"], "a rotation ends the run");
  assert.deepEqual(tokens([[1, 1], [1, 1], [2, 1]]), ["x-3..-2", "x-3"], "the same layer twice: the multiset is kept");
  const kinds = groupBlocks([[1, 1], [2, 1], [4, 1], [5, 1], [6, -1], [8, 2]]).map((b) => b.kind);
  assert.deepEqual(kinds, ["outer-wide", "inner-wide", "single", "single"]);
  assert.deepEqual(groupBlocks([]), []);
  assert.throws(() => groupBlocks([[22, 1]]), RangeError);
  assert.throws(() => groupBlocks([[1, 3]]), RangeError);
});

test("tokens: single layers and rotations equal moveToken, wide ranges are new", () => {
  for (let g = 1; g <= 21; g++)
    for (const q of [1, -1, 2]) assert.equal(blockToken(groupBlocks([[g, q]])[0]), moveToken([g, q]));
});

test("property: expand(groupBlocks(w)) is state-identical, keeps the multiset and never adds moves (random words)", () => {
  const next = rng(20280101);
  let wide = 0;
  for (let n = 0; n < 400; n++) {
    const word = randomWord(next, 1 + Math.floor(next() * 60));
    const blocks = groupBlocks(word);
    const back = expand(blocks);
    assert.deepEqual(multiset(back), multiset(word), `multiset, case ${n}`);
    assert.ok(samePose(applyMoves(root, back), applyMoves(root, word)), `state, case ${n}`);
    assert.equal(digest(applyMoves(root, back)), digest(applyMoves(root, word)), `digest, case ${n}`);
    // Counts: layer moves equal HTM, blocks never exceed layer moves, rotations as before.
    const c = blockCounts(blocks);
    const m = metrics(word);
    assert.equal(c.layerMoves, m.htm);
    assert.equal(c.rotations, m.rot);
    assert.ok(c.blockMoves <= c.layerMoves);
    // Determinism, and applying block by block equals applying the expansion.
    assert.deepEqual(groupBlocks(word), blocks);
    const pose = clonePose(root);
    for (const b of blocks) applyBlockInPlace(pose, b);
    assert.ok(samePose(pose, applyMoves(root, word)));
    for (const b of blocks) {
      assert.ok(expandBlock(b).length >= 1);
      if (b.kind === "rotation") continue;
      // One axis, one exponent, contiguous layers on one side of the middle.
      assert.ok(b.lo <= b.hi && (b.lo > 0 || b.hi < 0), "one side of the middle layer");
      const layers = expandBlock(b).map(([g]) => generatorLayer(g));
      assert.deepEqual(layers, layers.map((_, i) => b.lo + i), "contiguous");
      for (const [g, q] of expandBlock(b)) {
        assert.equal(generatorAxis(g), b.axis);
        assert.equal(q, b.angle);
        assert.ok(!isRotation(g));
      }
      assert.equal(b.kind, b.lo === b.hi ? "single" : b.lo === -3 || b.hi === 3 ? "outer-wide" : "inner-wide");
      if (b.lo !== b.hi) wide++;
    }
    // The inverse word also regroups to the same state.
    assert.ok(samePose(applyMoves(root, [...word, ...expand(groupBlocks(inverseMoves(word)))]), root));
  }
  assert.ok(wide > 100, "the random sample contains many wide blocks");
});

test("property: the grouping is minimal per run (a block-wide word of k equal layers is one block)", () => {
  for (const axis of [0, 1, 2])
    for (const q of [1, -1, 2]) {
      const side = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, i) => [7 * axis + 1 + [-3, -2, -1, 1, 2, 3].indexOf(lo + i), q]);
      assert.equal(groupBlocks(side(-3, -1)).length, 1);
      assert.equal(groupBlocks(side(1, 3)).length, 1);
      assert.equal(groupBlocks([...side(-3, -1), ...side(1, 3)]).length, 2);
    }
});

test("every stored edge, forward and backward: the grouped word reaches the stored digest of the next node", () => {
  let pose = clonePose(root);
  assert.equal(digest(pose), graph.nodes[0].hash);
  let layerMoves = 0,
    blockMoves = 0,
    rotations = 0;
  for (let k = 0; k < graph.edges.length; k++) {
    const word = graph.edges[k].moves;
    // Forward: from the pose of node k with the blocks of the edge.
    const blocks = groupBlocks(word);
    const forward = clonePose(pose);
    for (const b of blocks) applyBlockInPlace(forward, b);
    assert.equal(digest(forward), graph.nodes[k + 1].hash, `edge ${k} forward`);
    // Backward: from the pose of node k+1 with the blocks of the inverse edge.
    const back = clonePose(forward);
    for (const b of groupBlocks(inverseMoves(word))) applyBlockInPlace(back, b);
    assert.equal(digest(back), graph.nodes[k].hash, `edge ${k} backward`);
    const c = blockCounts(blocks);
    assert.equal(c.layerMoves, graph.edges[k].htm, `edge ${k} HTM`);
    assert.equal(c.rotations, graph.edges[k].rot, `edge ${k} rotations`);
    layerMoves += c.layerMoves;
    blockMoves += c.blockMoves;
    rotations += c.rotations;
    pose = forward;
  }
  assert.ok(blockMoves < layerMoves, "the stored words contain mergeable layers");
  assert.ok(rotations > 0);
});

test("the page shows block word, move word and raw generators, and both counts", () => {
  const range = chainRange(graph);
  const today = { year: 2028, month: 1 };
  const choice = chooseMonth(new URLSearchParams("year=2028&month=2"), today, range);
  const model = buildModel(graph, json_displays(), choice, today);
  const html = pageHtml(model);
  const step = stepFrom(graph, range, { year: 2028, month: 2 }, 1);
  const blocks = groupBlocks(step.moves);
  const { layerMoves, blockMoves } = blockCounts(blocks);
  assert.equal(layerMoves, step.htm);
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  assert.ok(html.includes(`${step.htm} layer moves (HTM), ${blockMoves} block moves,`));
  assert.ok(html.includes(`data-blocks="next">${esc(blocks.map(blockToken).join(" "))}</p>`));
  assert.ok(html.includes(`data-word="next">${esc(step.moves.map(moveToken).join(" "))}</p>`), "own move notation still shown");
  assert.ok(html.includes(`data-raw="next">${step.moves.map(rawToken).join(" ")}</p>`), "raw generators still shown");
  assert.equal(encodeMoves(step.moves), encodeMoves(graph.edges[1].moves), "the stored word is untouched");
});

import { parseDisplays } from "../src/apps/calendar7/graph.ts";
function json_displays() {
  return parseDisplays(json("public/calendar7/displays.v1.json"));
}
