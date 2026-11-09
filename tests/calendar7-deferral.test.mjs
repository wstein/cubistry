// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: deferred whole-cube rotations and the end alignment (research candidate, not certified).
// A display layer over the stored words (mode F of research PR #346): the played word has no rotation, one alignment at the
// end restores the stored frame. Properties on seeded random words, the stored digest for EVERY stored edge in both
// directions, the player (phases, skip, pause, reduced motion, mismatch), the soft-start easing, and negative controls.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ROTATION_TUNING } from "@cubistry/cube-viewer";
import { blockCounts, expand, groupBlocks, layerGenerator } from "../src/apps/calendar7/blocks.ts";
import {
  IDENTITY,
  alignmentMoves,
  alignmentText,
  allOrientations,
  axisMatrix,
  deferRotationBlocks,
  deferRotations,
  findAlignments,
  matMul,
  playedBlocks,
  rotationOfMoves,
  sameMat,
} from "../src/apps/calendar7/deferral.ts";
import {
  applyMoves,
  clonePose,
  generatorAxis,
  generatorLayer,
  inverseMoves,
  isRotation,
  metrics,
  samePose,
  stateDigest,
} from "../src/apps/calendar7/engine.ts";
import { parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { Calendar7Player, REDUCED_ALIGN_MS, StateMismatchError } from "../src/apps/calendar7/player.ts";
import {
  SOFT_START_EPSILON,
  SOFT_START_RATE,
  softStartEase,
  softStartMs,
  softStartRemaining,
  softStartSeconds,
} from "../src/apps/calendar7/soft-start.ts";

const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const graph = parseGraph(json("public/calendar7/graph.v1.json"));
const { printing, pose: root } = parseState(json("public/calendar7/state.v1.json"));
const digest = (pose) => stateDigest(printing, pose);
const LAST = graph.nodes.length - 1;
const NODE_POSES = [root];
for (const e of graph.edges) NODE_POSES.push(applyMoves(NODE_POSES.at(-1), e.moves));
const playBlocks = (pose, blocks) => applyMoves(pose, expand(blocks));

const rng = (seed) => () => {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
/** Rotations are frequent (about one in four) so that the frame really changes mid-word. */
const randomWord = (next, length) => {
  const word = [];
  for (let i = 0; i < length; i++) {
    const axis = i > 0 && next() < 0.6 ? generatorAxis(word[i - 1][0]) : Math.floor(next() * 3);
    const slot = next() < 0.25 ? 7 : 1 + Math.floor(next() * 6);
    word.push([7 * axis + slot, [1, -1, 2][Math.floor(next() * 3)]]);
  }
  return word;
};

// ---- independent oracle for the rotation product: own code, quaternion-free, on triples ----
/** Image of the basis vectors under the rotation moves of a word, as a 3x3 row-major matrix, by turning triples. */
function oracleProduct(moves) {
  const cols = [[1, 0, 0], [0, 1, 0], [0, 0, 1]].map((v) => {
    let [x, y, z] = v;
    for (const [g, q] of moves) {
      if (!isRotation(g)) continue;
      for (let t = 0; t < ((q % 4) + 4) % 4; t++) {
        const a = generatorAxis(g);
        if (a === 0) [y, z] = [-z, y];
        else if (a === 1) [x, z] = [z, -x];
        else [x, y] = [-y, x];
      }
    }
    return [x, y, z];
  });
  return [0, 1, 2].flatMap((i) => cols.map((c) => c[i]));
}

test("the 24 orientations: all distinct, each a word of at most two rotations, the first matching the matrix", () => {
  const all = allOrientations();
  assert.equal(all.length, 24);
  assert.equal(new Set(all.map((o) => o.matrix.join())).size, 24);
  assert.ok(all.every((o) => o.moves.length <= 2 && o.moves.every(([g]) => isRotation(g))));
  assert.deepEqual(all[0].moves, []);
  for (const o of all) assert.ok(sameMat(oracleProduct(o.moves), o.matrix), alignmentText(o.moves));
  assert.equal(alignmentText([]), "none");
  assert.equal(alignmentText([[7, 1], [14, 2]]), "x+, y2");
  assert.equal(alignmentText([[21, -1]]), "z-");
  assert.throws(() => alignmentMoves([2, 0, 0, 0, 1, 0, 0, 0, 1]), RangeError);
  // Deterministic: a second call returns the same words.
  assert.deepEqual(allOrientations().map((o) => o.moves), all.map((o) => o.moves));
});

test("soft start: the formula of the rubber band, rate 9 per second, monotone, zero speed at the start, no overshoot", () => {
  assert.equal(SOFT_START_RATE, ROTATION_TUNING.returnRate);
  assert.equal(SOFT_START_EPSILON, ROTATION_TUNING.returnEpsilon);
  for (const t of [0, 0.05, 0.3, 1, 2]) {
    const u = SOFT_START_RATE * t;
    assert.ok(Math.abs(softStartRemaining(u) - Math.exp(-u) * (1 + u + (u * u) / 2)) < 1e-15);
  }
  assert.equal(softStartRemaining(0), 1);
  for (const quarters of [1, 2]) {
    const ease = softStartEase(quarters);
    assert.equal(ease(0), 0);
    assert.equal(ease(1), 1);
    let last = 0;
    for (let i = 1; i <= 1000; i++) {
      const v = ease(i / 1000);
      assert.ok(v >= last && v <= 1, "monotone, never past the target");
      last = v;
    }
    assert.ok(ease(0.001) < 1e-4, "starts with zero speed (second order contact)");
    // The time scale is that of the rubber band: the remaining offset at progress p is the formula at u = r * seconds * p.
    const s = softStartSeconds((quarters * Math.PI) / 2);
    assert.ok(Math.abs(ease(0.5) - (1 - softStartRemaining(SOFT_START_RATE * s * 0.5))) < 1e-12);
    // Ends when less than 1 mrad is left.
    assert.ok(((quarters * Math.PI) / 2) * softStartRemaining(SOFT_START_RATE * s) <= SOFT_START_EPSILON * 1.0001);
    assert.ok(((quarters * Math.PI) / 2) * softStartRemaining(SOFT_START_RATE * s * 0.99) > SOFT_START_EPSILON);
  }
  assert.ok(softStartMs(1) > 1000 && softStartMs(1) < 1500 && softStartMs(2) > softStartMs(1), `${softStartMs(1)} ms`);
});

test("property: seeded random words with many rotations: no rotation left, same layer moves, word = deferred word + alignment", () => {
  const next = rng(20271108);
  let withRotations = 0;
  let nonIdentity = 0;
  for (let n = 0; n < 400; n++) {
    const word = randomWord(next, 1 + Math.floor(next() * 60));
    const { word: deferred, rotation } = deferRotations(word);
    assert.ok(deferred.every(([g]) => !isRotation(g)), "no rotation entry");
    assert.equal(deferred.length, metrics(word).htm, "the layer moves are exactly those of the stored word");
    assert.ok(sameMat(rotation, oracleProduct(word)), "the alignment is the product of the removed rotations");
    const from = NODE_POSES[Math.floor(next() * 60)];
    const after = applyMoves(applyMoves(from, deferred), alignmentMoves(rotation));
    assert.ok(samePose(after, applyMoves(from, word)), `word ${n}`);
    if (metrics(word).rot) withRotations++;
    if (!sameMat(rotation, IDENTITY)) nonIdentity++;
    // The same through the blocks of both modes.
    for (const slice of [false, true]) {
      const played = playedBlocks(word, { slice, defer: true });
      assert.ok(played.blocks.every((b) => b.kind !== "rotation"));
      if (!slice) assert.equal(blockCounts(played.blocks).layerMoves, metrics(word).htm);
      assert.equal(blockCounts(played.blocks).rotations, 0);
      const got = applyMoves(playBlocks(from, played.blocks), played.alignment);
      assert.ok(samePose(got, applyMoves(from, word)), `blocks of word ${n}, slice ${slice}`);
      assert.ok(samePose(playBlocks(from, groupBlocks(word, { slice })), applyMoves(from, word)), "the plain grouping is unchanged");
    }
    assert.ok(sameMat(playedBlocks(word, { defer: true }).rotation, rotation), "plain mode: the product of the stored rotations");
  }
  assert.ok(withRotations > 350 && nonIdentity > 250, `${withRotations} words with rotations, ${nonIdentity} with an alignment`);
});

test("block conjugation: deferring the rotation blocks of any block list keeps the state; slice intervals mirror", () => {
  const next = rng(77);
  for (let n = 0; n < 200; n++) {
    const word = randomWord(next, 1 + Math.floor(next() * 40));
    const blocks = groupBlocks(word, { slice: true });
    const { blocks: layer, rotation } = deferRotationBlocks(blocks);
    assert.ok(layer.every((b) => b.kind !== "rotation"));
    assert.equal(layer.length, blocks.filter((b) => b.kind !== "rotation").length);
    const from = NODE_POSES[Math.floor(next() * 60)];
    assert.ok(samePose(applyMoves(playBlocks(from, layer), alignmentMoves(rotation)), applyMoves(from, word)));
  }
  const mirrored = deferRotationBlocks([
    { axis: 2, lo: -3, hi: 3, angle: 2, kind: "rotation" },
    { axis: 0, lo: -3, hi: -1, angle: 1, kind: "outer-wide" },
  ]);
  assert.deepEqual(mirrored.blocks, [{ axis: 0, lo: 1, hi: 3, angle: -1, kind: "outer-wide" }]);
});

test("EVERY stored edge, forward and backward, both groupings: deferred blocks + found alignment = stored target (pose and digest)", () => {
  let steps = 0;
  let withAlignment = 0;
  let withRotationsInWord = 0;
  for (let e = 0; e < LAST; e++) {
    for (const forward of [true, false]) {
      const from = forward ? e : e + 1;
      const to = forward ? e + 1 : e;
      const word = forward ? graph.edges[e].moves : inverseMoves(graph.edges[e].moves);
      if (metrics(word).rot) withRotationsInWord++;
      for (const slice of [false, true]) {
        const played = playedBlocks(word, { slice, defer: true });
        assert.ok(played.blocks.every((b) => b.kind !== "rotation"), `edge ${e} has no rotation block`);
        if (!slice) assert.equal(blockCounts(played.blocks).layerMoves, metrics(word).htm, `edge ${e} layer moves`);
        assert.equal(blockCounts(played.blocks).rotations, 0);
        const mid = playBlocks(NODE_POSES[from], played.blocks);
        // The planned alignment gives the stored pose and digest ...
        const done = applyMoves(mid, played.alignment);
        assert.ok(samePose(done, NODE_POSES[to]), `edge ${e} ${forward ? "forward" : "backward"} slice ${slice}: pose`);
        assert.equal(digest(done), graph.nodes[to].hash);
        // ... and the search over the 24 orientations (by digest only) finds exactly that one (all edges, rule c).
        if (slice) {
          const found = findAlignments(printing, mid, graph.nodes[to].hash);
          assert.equal(found.length, 1, `edge ${e}: exactly one of 24`);
          assert.ok(sameMat(found[0].matrix, played.rotation), `edge ${e}: the alignment is the product of the removed rotations`);
          assert.deepEqual(found[0].moves, played.alignment);
        } else {
          assert.ok(sameMat(played.rotation, oracleProduct(word)), `edge ${e}: product of the stored rotations`);
        }
        if (played.alignment.length) withAlignment++;
        steps++;
      }
    }
  }
  assert.equal(steps, LAST * 4);
  assert.ok(withAlignment > 1000 && withRotationsInWord > 0, `${withAlignment} alignments, ${withRotationsInWord} words with stored rotations`);
});

test("the alignment search matches exactly one orientation of the target, and none of a state that is no orientation of it", () => {
  const target = NODE_POSES[300];
  for (const o of allOrientations()) {
    const turned = applyMoves(target, o.moves);
    const inverse = alignmentMoves(axisInverse(o.matrix));
    const found = findAlignments(printing, turned, graph.nodes[300].hash);
    assert.equal(found.length, 1);
    assert.deepEqual(found[0].moves, inverse, alignmentText(o.moves));
  }
  // One extra layer turn: no orientation matches.
  assert.deepEqual(findAlignments(printing, applyMoves(target, [[1, 1]]), graph.nodes[300].hash), []);
  // The hash of another node: none either (and never two).
  assert.deepEqual(findAlignments(printing, target, graph.nodes[301].hash), []);
});
const axisInverse = (m) => [m[0], m[3], m[6], m[1], m[4], m[7], m[2], m[5], m[8]];

test("negative controls: a wrong rotation, a wrong conjugation sign and a dropped final alignment all break the digest", () => {
  const bad = { wrongRotation: 0, wrongSign: 0, dropped: 0, total: 0 };
  for (let e = 0; e < 120; e++) {
    const word = graph.edges[e].moves;
    const played = playedBlocks(word, { slice: true, defer: true });
    const mid = playBlocks(NODE_POSES[e], played.blocks);
    const want = graph.nodes[e + 1].hash;
    assert.equal(digest(applyMoves(mid, played.alignment)), want);
    if (!played.alignment.length) continue;
    bad.total++;
    // (a) another one of the 24 orientations.
    const other = allOrientations().find((o) => !sameMat(o.matrix, played.rotation));
    if (digest(applyMoves(mid, other.moves)) !== want) bad.wrongRotation++;
    // (b) conjugation with the sign of the layer left out (the exponent is not flipped for a negative row).
    const wrong = [];
    let r = IDENTITY;
    for (const [g, q] of word) {
      const a = generatorAxis(g);
      if (isRotation(g)) {
        r = matMul(axisMatrix(a, q), r);
        continue;
      }
      let k = 0;
      while (r[3 * a + k] === 0) k++;
      const s = r[3 * a + k];
      wrong.push([layerGenerator(k, s * generatorLayer(g)), q]); // q not flipped
    }
    const wrongEnd = applyMoves(applyMoves(NODE_POSES[e], wrong), played.alignment);
    if (digest(wrongEnd) !== want) bad.wrongSign++;
    // (c) the final alignment dropped.
    if (digest(mid) !== want) bad.dropped++;
  }
  assert.ok(bad.total > 50);
  assert.equal(bad.wrongRotation, bad.total, "a wrong rotation always breaks the digest");
  assert.equal(bad.dropped, bad.total, "dropping the alignment always breaks the digest");
  assert.ok(bad.wrongSign > bad.total * 0.5, `a wrong sign breaks it (${bad.wrongSign} of ${bad.total})`);
});

// ---- the player ----

function manualView() {
  const log = { turns: [], shows: [] };
  const pending = [];
  return {
    log,
    pending,
    show(pose) {
      log.shows.push(clonePose(pose));
      while (pending.length) pending.shift()();
    },
    turn(block, before, ms, ease) {
      log.turns.push({ block, before: clonePose(before), ms, ease });
      return new Promise((resolve) => pending.push(resolve));
    },
    /** Finishes the turn in progress. */
    finish() {
      pending.shift()?.();
    },
  };
}
const flush = async () => {
  for (let i = 0; i < 20; i++) await Promise.resolve();
};
const makePlayer = (over = {}) => {
  const view = over.view ?? manualView();
  const changes = [];
  const errors = [];
  const player = new Calendar7Player({
    graph,
    printing,
    root,
    view,
    reducedMotion: () => false,
    onChange: (s) => changes.push(s),
    onError: (e) => errors.push(e),
    ...over,
  });
  return { player, view, changes, errors };
};
const runAll = async (player, view) => {
  for (let i = 0; i < 100000 && player.snapshot.status === "playing"; i++) {
    view.finish();
    await flush();
  }
};
/** First edge (from 5 on) whose deferred step needs an alignment of two rotations, and one that needs none. */
const edgeWith = (pred) => {
  for (let e = 5; e < LAST; e++) if (pred(playedBlocks(graph.edges[e].moves, { slice: true, defer: true }).alignment)) return e;
  throw new Error("no such edge");
};

test("the default player keeps the stored rotations in the word and reports no alignment", async () => {
  const { player, view } = makePlayer();
  assert.equal(player.alignAtEnd, false);
  const e = edgeWith((a) => a.length > 0);
  player.jump(e);
  player.go(e + 1);
  await runAll(player, view);
  assert.deepEqual(view.log.turns.map((t) => t.block), groupBlocks(graph.edges[e].moves));
  assert.ok(view.log.turns.every((t) => t.ease === undefined));
  assert.equal(player.snapshot.alignment, "none");
  assert.equal(player.snapshot.phase, "idle");
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
});

test("deferred player: layer blocks first, then the alignment as a separate final phase timed and eased like a layer turn; digest after it", async () => {
  const e = edgeWith((a) => a.length === 2);
  const { player, view, changes, errors } = makePlayer({ defer: true, slice: true });
  assert.equal(player.alignAtEnd, true);
  player.jump(e);
  const played = playedBlocks(graph.edges[e].moves, { slice: true, defer: true });
  player.go(e + 1);
  assert.equal(player.snapshot.alignment, "at the end");
  assert.equal(player.snapshot.total, played.blocks.length, "progress counts layer blocks only");
  await runAll(player, view);
  const turns = view.log.turns;
  assert.equal(turns.length, played.blocks.length + 2);
  assert.deepEqual(turns.slice(0, played.blocks.length).map((t) => t.block), played.blocks);
  assert.ok(turns.slice(0, played.blocks.length).every((t) => t.block.kind !== "rotation" && t.ease === undefined));
  const tail = turns.slice(played.blocks.length);
  assert.ok(tail.every((t) => t.block.kind === "rotation" && t.ease === undefined && t.ms === player.snapshot.speed * Math.abs(t.block.angle)), "the alignment is a rotation of the whole model, with the default easing and the speed setting");
  assert.deepEqual(tail.map((t) => [7 * t.block.axis + 7, t.block.angle]), played.alignment);
  assert.equal(player.snapshot.alignment, alignmentText(played.alignment));
  assert.equal(player.snapshot.phase, "idle");
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
  assert.equal(errors.length, 0);
  // Phases seen while playing: blocks, then alignment; the layer-block count never grew and the alignment text appeared.
  const phases = changes.map((c) => c.phase);
  assert.ok(phases.indexOf("alignment") > phases.indexOf("blocks"));
  assert.ok(changes.every((c) => c.total === 0 || c.total === played.blocks.length));
  assert.ok(changes.some((c) => c.phase === "alignment" && c.alignment === alignmentText(played.alignment)));
});

test("deferred player: the speed is the alignment time in ms per turn; the first block starts from the stored frame", async () => {
  const e = edgeWith((a) => a.length === 1);
  const times = [];
  for (const speed of [250, 1000]) {
    const { player, view } = makePlayer({ defer: true, slice: true });
    player.setSpeed(speed);
    player.jump(e);
    player.go(e + 1);
    await runAll(player, view);
    const last = view.log.turns.at(-1);
    times.push(last.ms);
    assert.ok(samePose(view.log.turns[0].before, NODE_POSES[e]));
  }
  const q = Math.abs(playedBlocks(graph.edges[e].moves, { slice: true, defer: true }).alignment[0][1]);
  assert.deepEqual(times, [250 * q, 1000 * q]);
});

test("deferred player: skip in the blocks phase and during the alignment ends on the stored state; pause holds the alignment", async () => {
  const e = edgeWith((a) => a.length === 2);
  const word = graph.edges[e].moves;
  const n = playedBlocks(word, { slice: true, defer: true }).blocks.length;
  // Skip in the first block.
  let { player, view } = makePlayer({ defer: true, slice: true });
  player.jump(e);
  player.go(e + 1);
  await flush();
  player.skip();
  assert.equal(player.snapshot.status, "idle");
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
  assert.equal(player.snapshot.alignment, alignmentText(playedBlocks(word, { slice: true, defer: true }).alignment));
  // Skip while the first alignment rotation turns.
  ({ player, view } = makePlayer({ defer: true, slice: true }));
  player.jump(e);
  player.go(e + 1);
  for (let i = 0; i < n; i++) {
    view.finish();
    await flush();
  }
  assert.equal(player.snapshot.phase, "alignment");
  assert.equal(player.snapshot.done, n);
  player.skip();
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
  // Pause during the alignment: the second rotation does not start until play.
  ({ player, view } = makePlayer({ defer: true, slice: true }));
  player.jump(e);
  player.go(e + 1);
  for (let i = 0; i < n; i++) {
    view.finish();
    await flush();
  }
  const before = view.log.turns.length;
  player.pause();
  view.finish();
  await flush();
  assert.equal(view.log.turns.length, before, "paused: no second rotation");
  assert.equal(player.snapshot.status, "paused");
  assert.equal(player.snapshot.phase, "alignment");
  player.play();
  await runAll(player, view);
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
  // Interrupted by the next navigation: the step ends at once, then the next one plays.
  ({ player, view } = makePlayer({ defer: true, slice: true }));
  player.jump(e);
  player.go(e + 1);
  await flush();
  player.go(e);
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash, "the first step was brought to its end");
  await runAll(player, view);
  assert.equal(digest(player.shownPose), graph.nodes[e].hash);
});

test("reduced motion: a jump needs no alignment; if the preference turns on during a step, the alignment takes 150 ms without the easing", async () => {
  const e = edgeWith((a) => a.length > 0);
  let reduced = true;
  let { player, view } = makePlayer({ defer: true, slice: true, reducedMotion: () => reduced });
  player.jump(e);
  player.go(e + 1);
  assert.equal(view.log.turns.length, 0);
  assert.equal(player.snapshot.alignment, "none");
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
  reduced = false;
  ({ player, view } = makePlayer({ defer: true, slice: true, reducedMotion: () => reduced }));
  player.jump(e);
  player.go(e + 1);
  const n = player.snapshot.total;
  for (let i = 0; i < n - 1; i++) {
    view.finish();
    await flush();
  }
  reduced = true; // before the last layer block ends: the alignment is requested afterwards
  await runAll(player, view);
  const tail = view.log.turns.slice(n);
  assert.ok(tail.length > 0 && tail.every((t) => t.ms === REDUCED_ALIGN_MS && t.ease === undefined));
  assert.equal(digest(player.shownPose), graph.nodes[e + 1].hash);
});

test("mismatch: a wrong stored hash is a StateMismatchError at the alignment (play and skip), a tampered pose too", async () => {
  const tampered = { ...graph, nodes: graph.nodes.map((n, i) => (i === 11 ? { ...n, hash: "0".repeat(64) } : n)) };
  // Through the loop: onError gets it and the player pauses.
  let { player, view, errors } = makePlayer({ graph: tampered, defer: true });
  player.jump(10);
  player.go(11);
  await runAll(player, view);
  assert.equal(errors.length, 1);
  assert.ok(errors[0] instanceof StateMismatchError);
  assert.match(errors[0].message, /no whole-cube orientation/);
  assert.equal(player.snapshot.status, "paused");
  // Through skip: it throws.
  ({ player } = makePlayer({ graph: tampered, defer: true }));
  player.jump(10);
  player.go(11);
  assert.throws(() => player.skip(), StateMismatchError);
  // A pose that is not the start of the edge (one extra turn): no orientation matches the real target.
  const poseOff = { ...graph, edges: graph.edges.map((x, i) => (i === 10 ? { ...x, moves: [[1, 1], ...x.moves] } : x)) };
  ({ player } = makePlayer({ graph: poseOff, defer: true }));
  player.jump(10);
  player.go(11);
  assert.throws(() => player.skip(), StateMismatchError);
  // Without deferral the old check still reports the digest.
  ({ player } = makePlayer({ graph: tampered }));
  player.jump(10);
  player.go(11);
  assert.throws(() => player.skip(), /differs from the stored hash of node 11/);
});

test("the whole chain forward and back with deferral on: the shown pose equals the stored hash after every step", async () => {
  const { player } = makePlayer({ defer: true, slice: true });
  player.jump(0);
  for (let k = 1; k <= LAST; k++) {
    player.go(k);
    player.skip();
    assert.equal(digest(player.shownPose), graph.nodes[k].hash, `forward to ${k}`);
  }
  for (let k = LAST - 1; k >= 0; k--) {
    player.go(k);
    player.skip();
    assert.equal(digest(player.shownPose), graph.nodes[k].hash, `back to ${k}`);
  }
  assert.ok(samePose(player.shownPose, root));
});
