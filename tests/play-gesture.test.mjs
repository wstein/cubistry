// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { beginGesture, moveGesture, releaseGesture, cancelGesture, beginPair, movePair, releasePair } from "../packages/cube-viewer/src/play-gesture.ts";

const FRONT = { x: [100, 0], y: [0, 100], z: [0, 0] };
const INVERTED = { x: [-100, 0], y: [0, -100], z: [0, 0] };
const PX = 100; // pixels per quarter turn
const hit = (face, point) => ({ face, point });
const start = (n = 3, h = hit("F", [0, 0.9, 1]), extra = {}) => beginGesture({ n, hit: h, point: [200, 200], axes: FRONT, pxPerQuarter: PX, ...extra });
const at = (g, dx, dy = 0) => moveGesture(g, [200 + dx, 200 + dy]);

function prng(seed) {
  return () => { seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

test("sticker is highlighted from pointer-down, before any decision", () => {
  const g = start();
  assert.equal(g.phase, "pending");
  assert.deepEqual(g.highlight, { face: "F", cell: [1, 2, 2] });
  assert.equal(g.lock, null);
  assert.equal(g.displayDeg, 0);
});

test("inside the dead zone nothing is locked; the first move past 8 px locks axis and layer", () => {
  let g = at(start(), 5);
  assert.equal(g.phase, "pending");
  g = at(g, 9);
  assert.equal(g.phase, "turning");
  assert.equal(g.lock.axis, "y"); assert.equal(g.lock.layer, 2);
  assert.equal(g.rawDeg, (9 / PX) * 90);
});

test("the lock holds: later movement in another direction does not change axis or layer", () => {
  let g = at(start(), 20);
  g = at(g, 20, 300);
  assert.equal(g.lock.axis, "y"); assert.equal(g.lock.layer, 2);
  assert.equal(g.rawDeg, (20 / PX) * 90, "only progress along the locked direction counts");
});

test("grab, drag a quarter, drag back to the start without release: net 0, release commits nothing", () => {
  let g = at(start(), 100);
  assert.equal(g.netQuarters, 1);
  assert.equal(g.displayDeg, 90, "magnet");
  g = at(g, 3);
  assert.equal(g.netQuarters, 0);
  g = at(g, 0);
  assert.equal(g.phase, "turning");
  assert.equal(g.netQuarters, 0);
  assert.equal(g.rawDeg, 0);
  const r = releaseGesture(g);
  assert.equal(r.commit, null);
  assert.equal(r.gesture.phase, "released");
});

test("inverted view: grab, drag, drag back, release: layer returns, one commit of the net only", () => {
  let g = beginGesture({ n: 3, hit: hit("F", [0, 0.9, 1]), point: [0, 0], axes: INVERTED, pxPerQuarter: PX });
  g = moveGesture(g, [-100, 0]);
  assert.equal(g.netQuarters, 1, "screen-left in an inverted view is +x world: positive about +y");
  g = moveGesture(g, [-20, 0]);
  assert.equal(g.netQuarters, 0);
  assert.equal(releaseGesture(g).commit, null);
});

test("270 degrees and back to 90 commits one quarter turn", () => {
  let g = at(start(), 270);
  assert.ok(Math.abs(g.displayDeg - 243) < 1e-9, "270 px = 243 deg, outside the magnet, free");
  g = at(g, 200);
  g = at(g, 100);
  const r = releaseGesture(g);
  assert.deepEqual(r.commit, { axis: "y", from: 2, to: 2, quarters: 1 });
});

test("dragging past a full turn commits the net turn reduced to a physical move", () => {
  assert.deepEqual(releaseGesture(at(start(), 500)).commit, { axis: "y", from: 2, to: 2, quarters: 1 }, "5 quarters = 1");
  assert.equal(releaseGesture(at(start(), 400)).commit, null, "full turn = no move");
  assert.deepEqual(releaseGesture(at(start(), -300)).commit, { axis: "y", from: 2, to: 2, quarters: 1 }, "-3 quarters = +1");
  assert.deepEqual(releaseGesture(at(start(), -100)).commit, { axis: "y", from: 2, to: 2, quarters: -1 });
  assert.deepEqual(releaseGesture(at(start(), 200)).commit, { axis: "y", from: 2, to: 2, quarters: 2 });
  assert.deepEqual(releaseGesture(at(start(), -200)).commit, { axis: "y", from: 2, to: 2, quarters: 2 });
});

test("release between quarters rounds to the nearest", () => {
  assert.deepEqual(releaseGesture(at(start(), 49)).commit, null);
  assert.deepEqual(releaseGesture(at(start(), 51)).commit, { axis: "y", from: 2, to: 2, quarters: 1 });
  assert.deepEqual(releaseGesture(at(start(), -51)).commit, { axis: "y", from: 2, to: 2, quarters: -1 });
});

test("release inside the dead zone, or without a decision, commits nothing", () => {
  assert.equal(releaseGesture(at(start(), 5)).commit, null);
  assert.equal(releaseGesture(start()).commit, null);
});

test("cancel commits nothing and clears the highlight; a finished gesture ignores further input", () => {
  const g = cancelGesture(at(start(), 100));
  assert.equal(g.phase, "cancelled"); assert.equal(g.highlight, null);
  assert.equal(releaseGesture(g).commit, null);
  assert.equal(moveGesture(g, [900, 900]), g);
  const done = releaseGesture(at(start(), 100)).gesture;
  assert.equal(moveGesture(done, [900, 900]), done);
  assert.equal(releaseGesture(done).commit, null, "no second commit");
});

test("a hit that is not on the cube face never starts a move gesture", () => {
  const g = beginGesture({ n: 3, hit: hit("F", [0, 0, 0.2]), point: [0, 0], axes: FRONT, pxPerQuarter: PX });
  assert.equal(g.phase, "invalid");
  assert.equal(releaseGesture(moveGesture(g, [200, 0])).commit, null);
});

test("every size N = 2..7 and every layer: the commit names the touched layer", () => {
  for (let n = 2; n <= 7; n++) for (let i = 0; i < n; i++) {
    const c = -1 + (2 * i + 1) / n;
    const r = releaseGesture(at(start(n, hit("F", [0, c, 1])), 100));
    assert.deepEqual(r.commit, { axis: "y", from: i, to: i, quarters: 1 }, `n=${n} i=${i}`);
  }
});

test("mouse Shift+drag: the wide range runs from the touched layer to the nearest outer layer", () => {
  const r = releaseGesture(at(start(5, hit("F", [0, 0.1, 1]), { wide: true }), 100));
  assert.deepEqual(r.commit, { axis: "y", from: 0, to: 2, quarters: 1 }, "middle layer of 5 ties to the low side");
  const top = releaseGesture(at(start(5, hit("F", [0, 0.9, 1]), { wide: true }), 100));
  assert.deepEqual(top.commit, { axis: "y", from: 4, to: 4, quarters: 1 });
});

test("property: the commit depends only on the final pointer position, not on the path", () => {
  const rnd = prng(2026);
  for (let it = 0; it < 300; it++) {
    const n = 2 + Math.floor(rnd() * 6), h = hit("F", [rnd() * 1.9 - 0.95, rnd() * 1.9 - 0.95, 1]);
    const finalDx = rnd() * 900 - 450;
    let g = start(n, h);
    g = at(g, rnd() < 0.5 ? 12 : -12); // lock first (either side)
    for (let s = 0; s < 12; s++) g = at(g, rnd() * 1200 - 600, rnd() * 100 - 50);
    g = at(g, finalDx);
    const direct = at(at(start(n, h), finalDx > 0 ? 12 : -12), finalDx);
    assert.deepEqual(releaseGesture(g).commit, releaseGesture(direct).commit);
  }
});

test("property: dragging to any position and back to the start commits nothing", () => {
  const rnd = prng(7);
  for (let it = 0; it < 200; it++) {
    let g = at(start(2 + Math.floor(rnd() * 6)), 12);
    g = at(g, rnd() * 2000 - 1000);
    g = at(g, 0);
    assert.equal(releaseGesture(g).commit, null);
  }
});

// Two fingers
const pair = (a, b, extra = {}) => beginPair({ n: 5, a: { hit: a.hit, point: a.point }, b: { hit: b.hit, point: b.point }, axes: FRONT, pxPerQuarter: PX, ...extra });
const ROW = (y, x = 0) => ({ hit: hit("F", [x, y, 1]), point: [100 + x * 10, 200] });
const ROW2 = (y, x = 0) => ({ hit: hit("F", [x, y, 1]), point: [300 + x * 10, 200] });

test("two fingers on two layers of the same axis turn all layers between and including them", () => {
  let p = pair(ROW(0.9), ROW2(-0.1)); // layers 4 and 2 of five
  assert.equal(p.phase, "pending");
  p = movePair(p, [100 + 100, 200], [300 + 100, 200]);
  assert.equal(p.phase, "turning");
  assert.equal(p.netQuarters, 1);
  assert.deepEqual(releasePair(p).commit, { axis: "y", from: 2, to: 4, quarters: 1 });
});

test("two fingers on the same layer behave like one finger", () => {
  let p = pair(ROW(0.9, -0.5), ROW2(0.9, 0.5));
  p = movePair(p, [100 - 100, 200], [300 - 100, 200]);
  assert.deepEqual(releasePair(p).commit, { axis: "y", from: 4, to: 4, quarters: -1 });
});

test("wide turn range is symmetric in the order of the fingers", () => {
  const run = (a, b) => { const p = movePair(pair(a, b), [200, 200], [400, 200]); return releasePair(p).commit; };
  assert.deepEqual(run(ROW(0.9), ROW2(-0.5)), { axis: "y", from: 1, to: 4, quarters: 1 });
  assert.deepEqual(run(ROW(-0.5), ROW2(0.9)), run(ROW(0.9), ROW2(-0.5)));
});

test("fingers on different axes are invalid: no move, ever", () => {
  const rowFinger = { hit: hit("F", [0, 0.9, 1]), point: [100, 200] };
  const colFinger = { hit: hit("F", [0.5, 0, 1]), point: [300, 200] };
  let p = pair(rowFinger, colFinger);
  p = movePair(p, [200, 200], [300, 300]); // first drags horizontally (y axis), second vertically (x axis)
  assert.equal(p.phase, "invalid");
  p = movePair(p, [400, 200], [300, 100]);
  assert.equal(releasePair(p).commit, null);
});

test("pair stays pending until both fingers left the dead zone", () => {
  let p = pair(ROW(0.9), ROW2(-0.1));
  p = movePair(p, [200, 200], [303, 200]);
  assert.equal(p.phase, "pending");
  p = movePair(p, [200, 200], [400, 200]);
  assert.equal(p.phase, "turning");
});

test("pair angle is the mean of both fingers, so moving them in opposite senses cancels", () => {
  let p = pair(ROW(0.9), ROW2(-0.1));
  p = movePair(p, [100 + 100, 200], [300 - 100, 200]);
  assert.equal(p.phase, "turning");
  assert.equal(p.netQuarters, 0);
  assert.equal(releasePair(p).commit, null);
});

test("lifting one finger: release of the pair commits the net once", () => {
  let p = pair(ROW(0.9), ROW2(0.1));
  p = movePair(p, [300, 200], [500, 200]);
  const r = releasePair(p);
  assert.deepEqual(r.commit, { axis: "y", from: 2, to: 4, quarters: 2 });
  assert.equal(releasePair(r.gesture).commit, null);
});

test("release and cancel clear the highlight; cancel does not change a released gesture", () => {
  const g = at(start(), 100);
  assert.notEqual(g.highlight, null);
  const r = releaseGesture(g);
  assert.equal(r.gesture.highlight, null);
  assert.equal(cancelGesture(r.gesture), r.gesture);
  assert.equal(cancelGesture(r.gesture).phase, "released");
  const c = cancelGesture(g);
  assert.equal(cancelGesture(c), c);
});

test("beginGesture rejects an invalid pxPerQuarter and an invalid size", () => {
  const o = { n: 3, hit: hit("F", [0, 0, 1]), point: [0, 0], axes: FRONT };
  assert.throws(() => beginGesture({ ...o, pxPerQuarter: 0 }), /pxPerQuarter/);
  assert.throws(() => beginGesture({ ...o, pxPerQuarter: -5 }), /pxPerQuarter/);
  assert.throws(() => beginGesture({ ...o, pxPerQuarter: NaN }), /pxPerQuarter/);
  assert.throws(() => beginGesture({ ...o, n: 8, pxPerQuarter: 100 }), /size/);
});

test("a pair with one finger off the face is invalid and commits nothing", () => {
  const off = { hit: hit("F", [0, 0, 0.2]), point: [300, 200] };
  let p = pair(ROW(0.9), off);
  assert.equal(p.phase, "invalid");
  assert.deepEqual(p.highlights, []);
  p = movePair(p, [400, 200], [500, 200]);
  assert.equal(releasePair(p).commit, null);
});
