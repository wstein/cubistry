// SPDX-License-Identifier: AGPL-3.0-or-later
import test from "node:test";
import assert from "node:assert/strict";
import { cellIndex, hitCell, mapDrag, wideRangeFromOne, DEAD_ZONE_PX } from "../packages/cube-viewer/src/play-gesture-map.ts";

// Front-on view: +x right, +y up (screen y grows upward here), +z toward the camera.
const FRONT = { x: [100, 0], y: [0, 100], z: [0, 0] };
// Inverted view: cube turned upside down (x and y mirrored by a half turn about z).
const INVERTED = { x: [-100, 0], y: [0, -100], z: [0, 0] };

// Deterministic PRNG (mulberry32) for property-style tests.
function prng(seed) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const mul = (a, b) => a.map((r) => [0, 1, 2].map((j) => r[0] * b[0][j] + r[1] * b[1][j] + r[2] * b[2][j]));
const rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
const ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
const rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
const apply = (R, v) => R.map((r) => r[0] * v[0] + r[1] * v[1] + r[2] * v[2]);
const E = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const FACES = { R: [0, 1], L: [0, -1], U: [1, 1], D: [1, -1], F: [2, 1], B: [2, -1] };

test("cellIndex covers N = 2..7: every layer centre maps to its layer, every inner boundary to the higher layer", () => {
  for (let n = 2; n <= 7; n++) {
    for (let i = 0; i < n; i++) {
      assert.equal(cellIndex(-1 + (2 * i + 1) / n, n), i, `centre n=${n} i=${i}`);
      assert.equal(cellIndex(-1 + (2 * i) / n, n), i, `lower boundary n=${n} i=${i}`);
    }
    assert.equal(cellIndex(1, n), n - 1, "upper cube edge belongs to the last layer");
    assert.equal(cellIndex(-1, n), 0);
    assert.equal(cellIndex(1.0000001, n), n - 1, "overshoot clamps");
    assert.equal(cellIndex(-1.0000001, n), 0);
  }
});

test("sticker edge rule: a hit within 1e-9 below a boundary belongs to the higher layer (float noise), 1e-3 below stays lower", () => {
  for (let n = 2; n <= 7; n++) for (let i = 1; i < n; i++) {
    const b = -1 + (2 * i) / n;
    assert.equal(cellIndex(b - 1e-12, n), i);
    assert.equal(cellIndex(b - 1e-3, n), i - 1);
    assert.equal(cellIndex(b + 1e-3, n), i);
  }
});

test("hitCell gives the cubie index triple, normal coordinate at the outer layer", () => {
  assert.deepEqual(hitCell({ face: "F", point: [-0.9, 0.9, 1] }, 3), [0, 2, 2]);
  assert.deepEqual(hitCell({ face: "B", point: [0, 0, -1] }, 3), [1, 1, 0]);
  assert.deepEqual(hitCell({ face: "R", point: [1, -0.99, 0.99] }, 7), [6, 0, 6]);
});

test("hitCell rejects hits that are off the face or off the cube", () => {
  assert.equal(hitCell({ face: "F", point: [0, 0, 0.5] }, 3), null, "not on the face plane");
  assert.equal(hitCell({ face: "F", point: [1.2, 0, 1] }, 3), null, "outside the face");
  assert.equal(hitCell({ face: "F", point: [NaN, 0, 1] }, 3), null);
  assert.throws(() => hitCell({ face: "F", point: [0, 0, 1] }, 1), /size/);
  assert.throws(() => hitCell({ face: "F", point: [0, 0, 1] }, 8), /size/);
  assert.throws(() => hitCell({ face: "F", point: [0, 0, 1] }, 2.5), /size/);
});

test("front face, front view: horizontal drag turns a row (y axis), vertical drag turns a column (x axis)", () => {
  const hit = { face: "F", point: [0.1, 0.9, 1] };
  // drag right on top row of F: top layer moves to the right = U turn counterclockwise seen from top = right-hand about +y is positive; point on +z moving toward +x is rotation about +y, positive.
  const r = mapDrag(hit, 3, [20, 0], FRONT);
  assert.equal(r.axis, "y"); assert.equal(r.layer, 2); assert.equal(r.direction, 1);
  const l = mapDrag(hit, 3, [-20, 0], FRONT);
  assert.equal(l.axis, "y"); assert.equal(l.layer, 2); assert.equal(l.direction, -1);
  // drag up on middle column of F: points on +z move toward +y = rotation about -x? Right-hand about +x moves +z toward -y, so up is negative.
  const up = mapDrag({ face: "F", point: [0.1, 0.1, 1] }, 3, [0, 20], FRONT);
  assert.equal(up.axis, "x"); assert.equal(up.layer, 1); assert.equal(up.direction, -1);
  const down = mapDrag({ face: "F", point: [-0.9, 0.1, 1] }, 3, [0, -20], FRONT);
  assert.equal(down.axis, "x"); assert.equal(down.layer, 0); assert.equal(down.direction, 1);
});

test("inverted view: the same screen drag selects the same axis but the opposite direction", () => {
  const hit = { face: "F", point: [0.1, 0.9, 1] };
  const a = mapDrag(hit, 3, [20, 0], FRONT), b = mapDrag(hit, 3, [20, 0], INVERTED);
  assert.equal(a.axis, b.axis); assert.equal(a.layer, b.layer); assert.equal(a.direction, -b.direction);
});

test("dead zone: below 8 px nothing is decided, at 8 px it is", () => {
  assert.equal(DEAD_ZONE_PX, 8);
  const hit = { face: "F", point: [0, 0, 1] };
  assert.equal(mapDrag(hit, 3, [7.99, 0], FRONT), null);
  assert.equal(mapDrag(hit, 3, [0, 0], FRONT), null);
  assert.ok(mapDrag(hit, 3, [8, 0], FRONT));
  assert.equal(mapDrag(hit, 3, [5.6, 5.6], FRONT), null, "length 7.92");
  assert.ok(mapDrag(hit, 3, [3, 3], FRONT, 4), "custom dead zone");
});

test("diagonal drag: the dominant tangent direction wins; an exact tie goes to the lower axis", () => {
  const hit = { face: "F", point: [0.2, 0.2, 1] };
  assert.equal(mapDrag(hit, 3, [20, 10], FRONT).axis, "y");
  assert.equal(mapDrag(hit, 3, [10, 20], FRONT).axis, "x");
  assert.equal(mapDrag(hit, 3, [15, 15], FRONT).axis, "x", "tie -> lower axis index");
});

test("an edge-on view yields no decision instead of NaN", () => {
  const EDGE = { x: [100, 0], y: [0, 0], z: [0, 0] };
  const r = mapDrag({ face: "F", point: [0, 0, 1] }, 3, [20, 0], EDGE);
  assert.ok(r === null || (Number.isFinite(r.progressPx) && r.axis === "y"));
  assert.equal(mapDrag({ face: "F", point: [0, 0, 1] }, 3, [20, 0], { x: [0, 0], y: [0, 0], z: [0, 0] }), null);
});

test("N >= 4: the layer is the hit depth of the touched sticker along the rotation axis", () => {
  for (let n = 4; n <= 7; n++) for (let i = 0; i < n; i++) {
    const c = -1 + (2 * i + 1) / n;
    const row = mapDrag({ face: "F", point: [0, c, 1] }, n, [30, 0], FRONT);
    assert.equal(row.axis, "y"); assert.equal(row.layer, i);
    const col = mapDrag({ face: "F", point: [c, 0, 1] }, n, [0, 30], FRONT);
    assert.equal(col.axis, "x"); assert.equal(col.layer, i);
  }
});

test("highlight cell is reported with the decision", () => {
  const r = mapDrag({ face: "R", point: [1, 0.5, -0.5] }, 4, [0, 20], FRONT);
  assert.deepEqual(r.cell, [3, 3, 1]);
});

test("property: every face, any view, every N: a drag along the true 3D velocity selects that rotation axis, layer and sense", () => {
  const rnd = prng(12345);
  let checked = 0;
  for (let it = 0; it < 4000; it++) {
    const R = mul(rx((rnd() - 0.5) * 6.28), mul(ry((rnd() - 0.5) * 6.28), rz((rnd() - 0.5) * 6.28)));
    const faceNames = Object.keys(FACES), face = faceNames[Math.floor(rnd() * 6)];
    const [fa, fs] = FACES[face];
    const nvec = E[fa].map((c) => c * fs);
    if (apply(R, nvec)[2] < 0.3) continue; // only faces turned toward the camera can be hit
    const n = 2 + Math.floor(rnd() * 6);
    const point = [0, 0, 0]; point[fa] = fs;
    for (let a = 0; a < 3; a++) if (a !== fa) point[a] = rnd() * 1.98 - 0.99;
    const ks = [0, 1, 2].filter((k) => k !== fa), k = ks[Math.floor(rnd() * 2)], s = rnd() < 0.5 ? 1 : -1;
    const v = cross(E[k], nvec).map((c) => c * s);
    const pv = apply(R, v), scale = (12 + rnd() * 200) / Math.hypot(pv[0], pv[1]);
    const axisScreen = { x: apply(R, E[0]).slice(0, 2), y: apply(R, E[1]).slice(0, 2), z: apply(R, E[2]).slice(0, 2) };
    for (const key of ["x", "y", "z"]) axisScreen[key] = axisScreen[key].map((c) => c * 100);
    const r = mapDrag({ face, point }, n, [pv[0] * scale, pv[1] * scale], axisScreen);
    assert.ok(r, `decided (it ${it})`);
    assert.equal(r.axis, "xyz"[k]); assert.equal(r.direction, s);
    assert.equal(r.layer, cellIndex(point[k], n));
    checked++;
  }
  assert.ok(checked > 1000, `checked ${checked}`);
});

test("property: reversing the drag reverses the direction only", () => {
  const rnd = prng(99);
  for (let it = 0; it < 500; it++) {
    const n = 2 + Math.floor(rnd() * 6), hit = { face: "U", point: [rnd() * 1.9 - 0.95, 1, rnd() * 1.9 - 0.95] };
    const d = [rnd() * 60 - 30, rnd() * 60 - 30];
    const a = mapDrag(hit, n, d, FRONT), b = mapDrag(hit, n, [-d[0], -d[1]], FRONT);
    assert.equal(a === null, b === null);
    if (a) { assert.equal(a.axis, b.axis); assert.equal(a.layer, b.layer); assert.equal(a.direction, -b.direction); }
  }
});

test("wide turn from one point (mouse Shift+drag): touched layer through the nearest outer layer, middle ties to the low side", () => {
  assert.deepEqual(wideRangeFromOne(0, 3), [0, 0]);
  assert.deepEqual(wideRangeFromOne(1, 3), [0, 1]);
  assert.deepEqual(wideRangeFromOne(2, 3), [2, 2]);
  assert.deepEqual(wideRangeFromOne(1, 4), [0, 1]);
  assert.deepEqual(wideRangeFromOne(2, 4), [2, 3]);
  assert.deepEqual(wideRangeFromOne(3, 7), [0, 3]);
  assert.deepEqual(wideRangeFromOne(4, 7), [4, 6]);
});
