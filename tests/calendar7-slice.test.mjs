// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: middle-slice block moves ("rule c", research candidate, not certified). A display layer
// over the stored words: `groupBlocks(word, { slice: true })` regroups a word into blocks that may contain layer 0.
// Properties on seeded random words, the same stored digest for every stored edge in both directions, the counts of the
// research measurement (research/calendar-7x7/wide-blocks, PR #346) for the 91 historical root words and the shipped chain edges, an
// independent slab-turn oracle, an independent exact-minimum oracle (plain BFS), and negative controls.
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
  STICKERS,
} from "../src/apps/calendar7/engine.ts";
import { parseDisplays, parseGraph, parseState } from "../src/apps/calendar7/graph.ts";
import { buildModel, chainRange, chooseMonth, pageHtml, playerHtml, stepFrom } from "../src/apps/calendar7/month-view.ts";
import { Calendar7Player } from "../src/apps/calendar7/player.ts";

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
/** Runs on one axis are likely, rotations (slot 7) are rare, so that slice blocks actually form. */
const randomWord = (next, length) => {
  const word = [];
  for (let i = 0; i < length; i++) {
    const axis = i > 0 && next() < 0.75 ? generatorAxis(word[i - 1][0]) : Math.floor(next() * 3);
    const slot = 1 + Math.floor(next() * (next() < 0.15 ? 7 : 6));
    word.push([7 * axis + slot, [1, -1, 2][Math.floor(next() * 3)]]);
  }
  return word;
};
const tokens = (w) => groupBlocks(w, { slice: true }).map(blockToken);

// ---- independent oracles ----

/** Slab turn of the layers lo..hi (pos[axis] in lo..hi, layer 0 included) by `angle` positive quarter turns, own code. */
function slabTurn(pose, block) {
  const out = clonePose(pose);
  const turns = ((block.angle % 4) + 4) % 4;
  const rot = (a, o) => {
    const [x, y, z] = [a[o], a[o + 1], a[o + 2]];
    if (block.axis === 0) [a[o + 1], a[o + 2]] = [-z, y];
    else if (block.axis === 1) [a[o], a[o + 2]] = [z, -x];
    else [a[o], a[o + 1]] = [-y, x];
  };
  for (let i = 0; i < STICKERS; i++) {
    const p = pose.pos[3 * i + block.axis];
    if (block.kind !== "rotation" && (p < block.lo || p > block.hi)) continue;
    for (let t = 0; t < turns; t++) for (const a of [out.pos, out.normal, out.up]) rot(a, 3 * i);
  }
  return out;
}
const slab = (pose, blocks) => blocks.reduce((p, b) => slabTurn(p, b), pose);

/**
 * Plain BFS over the 4^7 states "exponent mod 4 per physical layer": every interval of layers (never all 7) with an
 * exponent 1..3 costs 1. dist[s] = fewest block turns to reach s. Written separately from the Dijkstra in blocks.ts.
 */
const bfs = (() => {
  const dist = new Int8Array(4 ** 7).fill(-1);
  dist[0] = 0;
  let frontier = [0];
  const digits = (s) => Array.from({ length: 7 }, (_, i) => (s >> (2 * i)) & 3);
  const pack = (d) => d.reduce((s, v, i) => s | ((v & 3) << (2 * i)), 0);
  while (frontier.length) {
    const next = [];
    for (const s of frontier) {
      const d = digits(s);
      for (let lo = 0; lo < 7; lo++)
        for (let hi = lo; hi < 7; hi++) {
          if (lo === 0 && hi === 6) continue;
          for (let t = 1; t <= 3; t++) {
            const e = d.slice();
            for (let i = lo; i <= hi; i++) e[i] += t;
            const s2 = pack(e);
            if (dist[s2] < 0) {
              dist[s2] = dist[s] + 1;
              next.push(s2);
            }
          }
        }
    }
    frontier = next;
  }
  return { dist, pack };
})();
/** Net exponent per physical layer of a one-axis word (a rotation turns all seven layers). */
function netVector(word) {
  const e = [0, 0, 0, 0, 0, 0, 0];
  for (const [g, q] of word) for (let i = isRotation(g) ? 0 : generatorLayer(g) + 3; i <= (isRotation(g) ? 6 : generatorLayer(g) + 3); i++) e[i] += q;
  return e;
}
/** Exact minimum of block turns for a one-axis word; whole-cube rotations are free (any k added to all layers). */
function minimumBlocks(word) {
  const e = netVector(word);
  let best = Infinity;
  for (let k = 0; k < 4; k++) best = Math.min(best, bfs.dist[bfs.pack(e.map((v) => v + k))]);
  return best;
}
/** Block turns needed without any added rotation: the exact target. */
const blocksWithoutRotation = (word) => bfs.dist[bfs.pack(netVector(word))];

/** The root words of the research measurement, merged like its htm count (adjacent equal generators add up mod 4). */
function rootWords() {
  const lines = readFileSync("tests/fixtures/calendar7-roots91.tsv", "utf8").split("\n").filter((l) => l && !l.startsWith("#"));
  return lines.map((line) => {
    const signed = line.split("\t")[1].split(",").map(Number);
    const stack = [];
    for (const v of signed) {
      const g = Math.abs(v);
      const t = v > 0 ? 1 : 3;
      if (stack.length && stack.at(-1)[0] === g) {
        const n = (stack.pop()[1] + t) % 4;
        if (n) stack.push([g, n]);
      } else stack.push([g, t]);
    }
    return stack.map(([g, t]) => [g, t === 3 ? -1 : t]);
  });
}

// ---- tests ----

test("fixed examples: the middle slice, intervals across it, rotations of the same axis join the run", () => {
  const six = [[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]];
  // The research example: a rotation and the six other layers the other way round are the middle slice alone.
  assert.deepEqual(tokens([[7, 1], ...six.map(([g]) => [g, -1])]), ["x0"]);
  // The six layers alone are the middle slice turned back plus a (free) rotation.
  assert.deepEqual(tokens(six), ["x0'", "xrot"]);
  // An interval that contains layer 0 and has no cheaper form: -2..0 (its complement is two blocks).
  assert.deepEqual(tokens([[7, 1], [1, -1], [4, -1], [5, -1], [6, -1]]), ["x-2..0"]);
  // Equal block count: the layers -3..0 together, or the layers +1..+3 the other way round plus a rotation. No rotation is added
  // when it saves no block, so the first.
  assert.deepEqual(tokens([[7, 1], [4, -1], [5, -1], [6, -1]]), ["x-3..0"]);
  assert.deepEqual(tokens([[1, 1], [2, 1], [3, 1]]), ["x-3..-1"], "no layer 0 needed: as before");
  assert.deepEqual(tokens([[5, 1], [6, 1]]), ["x+2..+3"], "an interval without layer 0 stays what it is");
  assert.equal(tokens([[3, 2], [4, 2]]).length, 2, "layers -1 and +1 alone are two blocks");
  assert.deepEqual(tokens([[7, 1]]), ["xrot"]);
  assert.deepEqual(tokens([[7, 1], [7, 1], [7, 1], [7, 1]]), [], "four quarter turns of the cube cancel");
  assert.deepEqual(tokens([[1, 1], [1, -1]]), [], "opposite turns of one layer cancel");
  assert.deepEqual(tokens([[1, 2], [1, 2]]), []);
  assert.deepEqual(tokens([[1, 1], [8, 1]]), ["x-3", "y-3"], "different axes do not merge");
  assert.deepEqual(tokens([[1, 1], [14, 1], [2, 1]]), ["x-3", "yrot", "x-2"], "a rotation of another axis ends the run");
  assert.deepEqual(tokens([[1, 1], [7, 1], [2, 1]]), ["x-3..-2", "xrot"], "a rotation of the same axis is part of the run");
  assert.deepEqual(groupBlocks([], { slice: true }), []);
  assert.throws(() => groupBlocks([[22, 1]], { slice: true }), RangeError);
  assert.throws(() => groupBlocks([[1, 3]], { slice: true }), RangeError);
  // Kinds, and the expansion of a slice block: the rotation, then the opposite turns of the layers outside the interval.
  const [slice] = groupBlocks([[7, 1], [1, -1], [4, -1], [5, -1], [6, -1]], { slice: true });
  assert.deepEqual(slice, { axis: 0, lo: -2, hi: 0, angle: 1, kind: "slice" });
  assert.deepEqual(expandBlock(slice), [[7, 1], [1, -1], [4, -1], [5, -1], [6, -1]]);
  assert.deepEqual(expandBlock({ axis: 1, lo: 0, hi: 0, angle: 2, kind: "slice" }).map(([g]) => g), [14, 8, 9, 10, 11, 12, 13]);
  assert.equal(groupBlocks([[7, 1]], { slice: true })[0].kind, "rotation");
});

test("the default grouping and the opt-out are unchanged", () => {
  const next = rng(7);
  for (let n = 0; n < 50; n++) {
    const word = randomWord(next, 1 + Math.floor(next() * 50));
    assert.deepEqual(groupBlocks(word), groupBlocks(word, {}));
    assert.deepEqual(groupBlocks(word), groupBlocks(word, { slice: false }));
    for (const b of groupBlocks(word)) assert.notEqual(b.kind, "slice");
  }
});

test("slab oracle: expandBlock of every interval containing layer 0 equals the slab turn of that interval", () => {
  const mixed = applyMoves(root, randomWord(rng(99), 80));
  let checked = 0;
  for (const start of [root, mixed])
    for (let axis = 0; axis < 3; axis++)
      for (let lo = -3; lo <= 0; lo++)
        for (let hi = 0; hi <= 3; hi++)
          for (const angle of [1, -1, 2]) {
            const full = lo === -3 && hi === 3;
            const block = { axis, lo, hi, angle, kind: full ? "rotation" : "slice" };
            const expected = slabTurn(start, block);
            assert.ok(samePose(applyMoves(start, expandBlock(block)), expected), `expand ${axis} ${lo}..${hi} ${angle}`);
            const pose = clonePose(start);
            applyBlockInPlace(pose, block);
            assert.ok(samePose(pose, expected), `apply ${axis} ${lo}..${hi} ${angle}`);
            assert.equal(digest(pose), digest(expected));
            checked++;
          }
  assert.equal(checked, 2 * 3 * 16 * 3);
});

test("property: the slice grouping is state-identical, valid, never worse than the default blocks (random words)", () => {
  const next = rng(20280101);
  let slice = 0,
    wordsWithSlice = 0;
  for (let n = 0; n < 500; n++) {
    const word = randomWord(next, 1 + Math.floor(next() * 70));
    const blocks = groupBlocks(word, { slice: true });
    const want = applyMoves(root, word);
    assert.ok(samePose(applyMoves(root, expand(blocks)), want), `state, case ${n}`);
    assert.equal(digest(applyMoves(root, expand(blocks))), digest(want), `digest, case ${n}`);
    // Independent slab turns of the blocks (no generator involved) reach the same state.
    assert.ok(samePose(slab(root, blocks), want), `slab, case ${n}`);
    const pose = clonePose(root);
    for (const b of blocks) applyBlockInPlace(pose, b);
    assert.ok(samePose(pose, want));
    assert.deepEqual(groupBlocks(word, { slice: true }), blocks, "deterministic");
    // Counts.
    const c = blockCounts(blocks);
    const plain = blockCounts(groupBlocks(word));
    assert.ok(c.blockMoves <= plain.blockMoves, `no worse than the default blocks, case ${n}`);
    assert.ok(c.blockMoves <= metrics(word).htm, `no worse than HTM, case ${n}`);
    // Each block: one axis, one exponent, an interval of the layers; kinds as documented; no 7-layer block but a rotation.
    let hasSlice = false;
    for (const b of blocks) {
      assert.ok(b.lo >= -3 && b.hi <= 3 && b.lo <= b.hi);
      assert.ok([1, -1, 2].includes(b.angle));
      if (b.kind === "rotation") {
        assert.deepEqual([b.lo, b.hi], [-3, 3]);
        continue;
      }
      assert.ok(!(b.lo === -3 && b.hi === 3), "a block of all seven layers is a rotation");
      const touches0 = b.lo <= 0 && b.hi >= 0;
      assert.equal(b.kind === "slice", touches0);
      if (!touches0) assert.equal(b.kind, b.lo === b.hi ? "single" : b.lo === -3 || b.hi === 3 ? "outer-wide" : "inner-wide");
      const moves = expandBlock(b);
      assert.ok(moves.length >= 1);
      if (touches0) {
        assert.deepEqual(moves[0], [7 * b.axis + 7, b.angle], "the rotation first");
        hasSlice = true;
        slice++;
      }
    }
    if (hasSlice) wordsWithSlice++;
    // The inverse word also regroups to a word that undoes it.
    assert.ok(samePose(applyMoves(want, expand(groupBlocks(inverseMoves(word), { slice: true }))), root), `inverse, case ${n}`);
  }
  assert.ok(slice > 100 && wordsWithSlice > 50, `the sample contains slice blocks (${slice} blocks in ${wordsWithSlice} words)`);
});

test("property: the number of block moves of a run is the exact minimum (independent BFS)", () => {
  const next = rng(424242);
  let beatsPlain = 0;
  for (let n = 0; n < 600; n++) {
    // One axis only: a single run. Layers biased to the 6-layer sweeps that make slices worthwhile.
    const axis = Math.floor(next() * 3);
    const word = [];
    const length = 1 + Math.floor(next() * 14);
    const q = next() < 0.6 ? 1 : [1, -1, 2][Math.floor(next() * 3)];
    for (let i = 0; i < length; i++)
      word.push([7 * axis + 1 + Math.floor(next() * (next() < 0.1 ? 7 : 6)), next() < 0.7 ? q : [1, -1, 2][Math.floor(next() * 3)]]);
    const blocks = groupBlocks(word, { slice: true });
    assert.equal(blockCounts(blocks).blockMoves, minimumBlocks(word), `minimum, case ${n}: ${blocks.map(blockToken).join(" ")}`);
    // A rotation is only in the plan when the exact target needs more blocks without it.
    if (blocksWithoutRotation(word) === minimumBlocks(word))
      assert.ok(blocks.every((b) => b.kind !== "rotation"), `no needless rotation, case ${n}: ${blocks.map(blockToken).join(" ")}`);
    else assert.ok(blocks.some((b) => b.kind === "rotation"), `the rotation saves a block, case ${n}`);
    if (blockCounts(groupBlocks(word)).blockMoves > blocks.length) beatsPlain++;
  }
  assert.ok(beatsPlain > 20, "rule c is sometimes strictly better than the blocks of one side");
  // The oracle itself: known values. The six layers other than the middle one cost 1 (the middle slice, plus a free rotation),
  // layers -1 and +1 alone cost 2 (they are not neighbors), a rotation costs nothing.
  assert.equal(minimumBlocks([[1, 1], [2, 1], [3, 1], [4, 1], [5, 1], [6, 1]]), 1);
  assert.equal(minimumBlocks([[3, 1], [4, 1]]), 2);
  assert.equal(minimumBlocks([[1, 1]]), 1);
  assert.equal(minimumBlocks([[7, 1]]), 0);
});

test("every stored edge, forward and backward, with slice blocks: the stored digest of the next node is reached", () => {
  let pose = clonePose(root);
  assert.equal(digest(pose), graph.nodes[0].hash);
  let htm = 0,
    plainBlocks = 0,
    sliceBlocks = 0,
    withSlice = 0;
  for (let k = 0; k < graph.edges.length; k++) {
    const word = graph.edges[k].moves;
    const blocks = groupBlocks(word, { slice: true });
    const forward = clonePose(pose);
    for (const b of blocks) applyBlockInPlace(forward, b);
    assert.equal(digest(forward), graph.nodes[k + 1].hash, `edge ${k} forward`);
    assert.ok(samePose(slab(pose, blocks), forward), `edge ${k} slab turns`);
    const back = clonePose(forward);
    for (const b of groupBlocks(inverseMoves(word), { slice: true })) applyBlockInPlace(back, b);
    assert.equal(digest(back), graph.nodes[k].hash, `edge ${k} backward`);
    htm += graph.edges[k].htm;
    plainBlocks += blockCounts(groupBlocks(word)).blockMoves;
    const c = blockCounts(blocks);
    sliceBlocks += c.blockMoves;
    if (blocks.some((b) => b.kind === "slice")) withSlice++;
    pose = forward;
  }
  // The joined strict chain: exact stored layer count and measured rule-c block count.
  assert.equal(htm, 103618);
  assert.equal(sliceBlocks, 79100);
  assert.ok(plainBlocks > sliceBlocks && plainBlocks < htm);
  assert.ok(withSlice > 400, `slice blocks occur on ${withSlice} of 883 edges`);
});

test("the 91 root words of the research measurement: 40642 layer moves, 30696 block moves with the middle slice", () => {
  const words = rootWords();
  assert.equal(words.length, 91);
  let htm = 0,
    blocks = 0,
    sliceTouching = 0,
    total = 0;
  for (const word of words) {
    htm += metrics(word).htm;
    const g = groupBlocks(word, { slice: true });
    blocks += blockCounts(g).blockMoves;
    total += g.filter((b) => b.kind !== "rotation").length;
    sliceTouching += g.filter((b) => b.kind === "slice").length;
    assert.ok(samePose(applyMoves(root, expand(g)), applyMoves(root, word)));
    assert.ok(samePose(slab(root, g), applyMoves(root, word)));
  }
  assert.equal(htm, 40642);
  assert.equal(blocks, 30696);
  assert.equal(total, blocks);
  assert.equal(sliceTouching, 2062, "blocks touching layer 0 (the research plans, which add a rotation freely, have 2051)");
});

test("negative controls: a dropped, turned, narrowed or half expanded slice block changes the state", () => {
  const next = rng(31337);
  let tested = 0;
  for (let n = 0; n < 400 && tested < 60; n++) {
    const word = randomWord(next, 20 + Math.floor(next() * 40));
    const blocks = groupBlocks(word, { slice: true });
    const i = blocks.findIndex((b) => b.kind === "slice");
    if (i < 0) continue;
    tested++;
    const want = digest(applyMoves(root, word));
    const after = (bs) => digest(applyMoves(root, expand(bs)));
    assert.equal(after(blocks), want);
    // Drop the slice block.
    assert.notEqual(after(blocks.filter((_, k) => k !== i)), want, "dropped");
    // Change its exponent.
    const b = blocks[i];
    const other = { ...b, angle: b.angle === 1 ? 2 : 1 };
    assert.notEqual(after(blocks.map((x, k) => (k === i ? other : x))), want, "turned");
    // Narrow it so that it no longer contains layer 0 (as if the middle slice could not be turned).
    const narrow = b.lo === 0 && b.hi === 0 ? null : b.lo < 0 ? { ...b, hi: -1, kind: "single" } : { ...b, lo: 1, kind: "single" };
    if (narrow) assert.notEqual(after(blocks.map((x, k) => (k === i ? narrow : x))), want, "narrowed");
    // The expansion without the rotation, and without the outer turns, is not the slab turn.
    const parts = expandBlock(b);
    const slabState = digest(slabTurn(root, b));
    assert.equal(digest(applyMoves(root, parts)), slabState);
    assert.notEqual(digest(applyMoves(root, parts.slice(1))), slabState, "no rotation");
    if (parts.length > 1) assert.notEqual(digest(applyMoves(root, parts.slice(0, -1))), slabState, "one outer turn missing");
    // The wrong sign of the outer turns (a quarter turn only: the half turn is its own inverse).
    if (b.angle !== 2 && parts.length > 1)
      assert.notEqual(digest(applyMoves(root, parts.map(([g, q], k) => (k === 0 ? [g, q] : [g, -q])))), slabState, "outer turns with the wrong sign");
  }
  assert.ok(tested >= 40, "the sample has slice blocks");
});

// ---- the player with slice blocks (fake view) ----

function fakeView() {
  const log = { turns: [], shows: 0 };
  return {
    log,
    show: () => log.shows++,
    turn(block, before) {
      log.turns.push({ block, before: clonePose(before) });
      return Promise.resolve();
    },
  };
}
const makePlayer = (slice) => {
  const view = fakeView();
  const player = new Calendar7Player({ graph, printing, root, view, reducedMotion: () => false, slice });
  return { player, view };
};
const settle = async (player) => {
  for (let i = 0; i < 100000 && player.snapshot.status === "playing"; i++) await Promise.resolve();
};

test("the player with slice blocks plays one turn per block and ends on the stored hash, both directions", async () => {
  for (const [from, to] of [[0, 1], [1, 0], [100, 101], [101, 100], [300, 301], [575, 576], [576, 575]]) {
    const { player, view } = makePlayer(true);
    assert.equal(player.middleSlice, true);
    player.jump(from);
    player.go(to);
    await settle(player);
    const word = to > from ? graph.edges[from].moves : inverseMoves(graph.edges[to].moves);
    const blocks = groupBlocks(word, { slice: true });
    assert.deepEqual(view.log.turns.map((t) => t.block), blocks);
    assert.equal(player.snapshot.status, "idle");
    assert.equal(digest(player.shownPose), graph.nodes[to].hash, `end ${to}`);
    assert.ok(view.log.turns.some((t) => t.block.kind === "slice"), "a step with a slice block");
  }
});

test("setSlice chooses the grouping of the next step only; skipping a slice step reaches the stored hash", async () => {
  const { player, view } = makePlayer(false);
  assert.equal(player.middleSlice, false, "the player default is the plain blocks");
  player.jump(10);
  player.go(11);
  await settle(player);
  assert.deepEqual(view.log.turns.map((t) => t.block), groupBlocks(graph.edges[10].moves));
  view.log.turns.length = 0;
  player.setSlice(true);
  player.go(12);
  assert.equal(player.snapshot.total, groupBlocks(graph.edges[11].moves, { slice: true }).length);
  player.setSlice(false); // a step in progress keeps its blocks
  assert.equal(player.snapshot.total, groupBlocks(graph.edges[11].moves, { slice: true }).length);
  player.skip();
  assert.equal(digest(player.shownPose), graph.nodes[12].hash);
  player.go(13);
  assert.equal(player.snapshot.total, groupBlocks(graph.edges[12].moves).length, "the next step uses the new setting");
  player.skip();
  assert.equal(digest(player.shownPose), graph.nodes[13].hash);
});

test("the page shows the three counts, both block words and the note on the middle slice; the option is offered", () => {
  const range = chainRange(graph);
  const today = { year: 2028, month: 1 };
  const choice = chooseMonth(new URLSearchParams("year=2028&month=2"), today, range);
  const html = pageHtml(buildModel(graph, parseDisplays(json("public/calendar7/displays.v1.json")), choice, today));
  const esc = (s) => s.replace(/&/g, "&amp;").replace(/'/g, "&#39;");
  const toks = (a) => a.map((t) => `<span class="c7-tok">${esc(t)}</span>`).join(" ");
  for (const [label, delta] of [["next", 1], ["previous", -1]]) {
    const step = stepFrom(graph, range, { year: 2028, month: 2 }, delta);
    const plain = groupBlocks(step.moves);
    const sliced = groupBlocks(step.moves, { slice: true });
    const [b, c] = [blockCounts(plain).blockMoves, blockCounts(sliced).blockMoves];
    assert.ok(c < b && b < step.htm, "three different counts");
    assert.ok(
      html.includes(`${step.htm} layer moves (HTM), ${b} block moves, without the middle slice, ${c} block moves, with the middle slice (it counts as a move there), ${step.qtm} quarter turns (QTM),`),
      `${label} counts`,
    );
    assert.ok(html.includes(`data-blocks-slice="${label}">${toks(sliced.map(blockToken))}</p>`), `${label} slice block word`);
    assert.ok(html.includes(`data-blocks="${label}">${toks(plain.map(blockToken))}</p>`), `${label} plain block word`);
    assert.ok(html.includes(`data-word="${label}">`), "the move word stays");
  }
  assert.match(html, /Whole-cube rotations stay free in every count/);
  assert.match(html, /<code>x0<\/code> is the middle slice alone/);
  const controls = playerHtml(2);
  assert.match(controls, /<input type="checkbox" data-c7="slice" checked> Middle slice counts as a move/);
});
