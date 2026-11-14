// SPDX-License-Identifier: AGPL-3.0-or-later
// The pure UV rule of the "Projected" picture mode: six beamers, one per face, each projecting its own image face-on onto
// its own face; the image rectangle is the full face extent. These tests state the rule independently of the implementation (literal
// face orientations, the prototype formula) and cover every face, every size 2 to 7, corners, the image that reaches the
// face edge (no margin, g = 0) and the layer-width profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECTED_FACES, faceOfNormal, imageExtent, stickerWindow, windowUv, STICKER_SHARE,
} from "../packages/cube-viewer/src/projected-uv.ts";
import { thickOuterLayerWidths, uniformLayerWidths, layerEdge } from "../packages/cube-viewer/src/layer-widths.ts";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const SIZES = [2, 3, 4, 5, 6, 7];
const KEYS = ["U", "R", "F", "D", "L", "B"];

// Literal orientation of each face, as printed nets show it (looking at the face from outside): the world direction of the
// image's right and up, and the world corner (as signs) that holds the image's top-left corner.
const ORIENTATION = {
  F: { right: [1, 0, 0], up: [0, 1, 0], topLeft: [-1, 1, 1] },
  B: { right: [-1, 0, 0], up: [0, 1, 0], topLeft: [1, 1, -1] },
  R: { right: [0, 0, -1], up: [0, 1, 0], topLeft: [1, 1, 1] },
  L: { right: [0, 0, 1], up: [0, 1, 0], topLeft: [-1, 1, -1] },
  U: { right: [1, 0, 0], up: [0, 0, -1], topLeft: [-1, 1, -1] },
  D: { right: [1, 0, 0], up: [0, 0, 1], topLeft: [-1, -1, 1] },
};
const NORMAL = { F: [0, 0, 1], B: [0, 0, -1], R: [1, 0, 0], L: [-1, 0, 0], U: [0, 1, 0], D: [0, -1, 0] };

/** Every sticker of a face: its world layer indices (0..n-1 per axis, increasing with the world coordinate). */
function faceStickers(face, n) {
  const axis = NORMAL[face].findIndex((c) => c !== 0), at = NORMAL[face][axis] > 0 ? n - 1 : 0, out = [];
  for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
    const index = [0, 0, 0]; index[axis] = at; index[(axis + 1) % 3] = a; index[(axis + 2) % 3] = b;
    out.push(index);
  }
  return out;
}

test("the face table: normals, right and up of the six faces; faceOfNormal inverts it", () => {
  assert.deepEqual(Object.keys(PROJECTED_FACES).sort(), [...KEYS].sort());
  for (const k of KEYS) {
    assert.deepEqual(PROJECTED_FACES[k].normal, NORMAL[k], k);
    assert.deepEqual(PROJECTED_FACES[k].up, ORIENTATION[k].up, `${k} up`);
    assert.equal(faceOfNormal(NORMAL[k]), k);
  }
  assert.throws(() => faceOfNormal([1, 1, 0]));
});

test("the image is the whole face: its side is the face extent n pitches, no margin (g = 0)", () => {
  assert.equal(STICKER_SHARE, 0.87);
  for (const n of SIZES) near(imageExtent(uniformLayerWidths(n)), n, 1e-12, `image n=${n}`);
});

for (const face of KEYS) for (const n of SIZES) test(`${face} ${n}x${n}: every sticker window equals the prototype formula (A = c_right + (u - .5) 0.87, IMG = n, s = A / IMG + .5, t = .5 - B / IMG)`, () => {
  const widths = uniformLayerWidths(n), IMG = n, h = (n - 1) / 2;
  const { right, up } = ORIENTATION[face];
  const seen = new Set();
  for (const index of faceStickers(face, n)) {
    const win = stickerWindow(widths, STICKER_SHARE, face, index);
    // world position of the cubie in pitch units, from the layer index
    const p = index.map((i) => i - h);
    const cRight = p[0] * right[0] + p[1] * right[1] + p[2] * right[2];
    const cUp = p[0] * up[0] + p[1] * up[1] + p[2] * up[2];
    assert.equal(win.col, Math.round(cRight + h), `${face} col`);
    assert.equal(win.row, Math.round(h - cUp), `${face} row`);
    seen.add(win.col + "," + win.row);
    for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1], [0.5, 0.5], [0.25, 0.8]]) {
      const A = cRight + (u - 0.5) * 0.87, B = cUp + (v - 0.5) * 0.87;
      const s = A / IMG + 0.5, t = 0.5 - B / IMG;
      const [tu, tv] = windowUv(win, u, v);
      near(tu, s, 1e-9, `${face} ${n} s at ${u},${v}`);
      near(1 - tv, t, 1e-9, `${face} ${n} t at ${u},${v}`);
    }
  }
  assert.equal(seen.size, n * n, "every (col,row) cell occurs once");
});

for (const face of KEYS) test(`${face}: the image's top-left corner lies on the literal corner of the face (all sizes)`, () => {
  for (const n of SIZES) {
    const corner = ORIENTATION[face].topLeft.map((s) => (s > 0 ? n - 1 : 0));
    // the corner cubie holds the sticker of this face in this corner: its index along the normal is the face's layer
    const axis = NORMAL[face].findIndex((c) => c !== 0);
    corner[axis] = NORMAL[face][axis] > 0 ? n - 1 : 0;
    const win = stickerWindow(uniformLayerWidths(n), STICKER_SHARE, face, corner);
    assert.deepEqual([win.col, win.row], [0, 0], `${face} ${n}`);
    // the sticker's upper-left uv corner is the face corner plus the half gap (0.065 pitch): inside the image, never outside
    const [s, tUp] = windowUv(win, 0, 1);
    near(s, ((-n / 2 + 0.5) - 0.435) / n + 0.5, 1e-9, `${face} ${n} s`);
    near(1 - tUp, 0.5 - ((n / 2 - 0.5) + 0.435) / n, 1e-9, `${face} ${n} t`);
    assert.ok(s > 0 && 1 - tUp > 0, "the outer rim of a corner sticker lies inside the image");
  }
});

test("the image reaches the face edge: texture coordinates 0 and 1 sit exactly on the face extent, for every size and face", () => {
  for (const n of SIZES) {
    const w = uniformLayerWidths(n);
    for (const face of KEYS) {
      const all = faceStickers(face, n).map((i) => stickerWindow(w, STICKER_SHARE, face, i));
      const left = all.find((x) => x.col === 0 && x.row === 0), right = all.find((x) => x.col === n - 1 && x.row === n - 1);
      const edgeA = (win, edge) => (edge - win.offsetU) / win.scaleU; // sticker-u where the texture coordinate hits `edge`
      const aOfU = (win, u, c) => c + (u - 0.5) * 0.87;
      near(aOfU(left, edgeA(left, 0), -(n - 1) / 2), -n / 2, 1e-9, `${face} ${n} left edge`);
      near(aOfU(right, edgeA(right, 1), (n - 1) / 2), n / 2, 1e-9, `${face} ${n} right edge`);
      for (const win of all) for (const [u, v] of [[0, 0], [1, 1], [0, 1], [1, 0]]) {
        const [tu, tv] = windowUv(win, u, v);
        assert.ok(tu >= -1e-12 && tu <= 1 + 1e-12 && tv >= -1e-12 && tv <= 1 + 1e-12, `${face} ${n}: a sticker corner lies inside the image`);
      }
    }
  }
});

test("profile [f,1,...,1,f]: the image is the face extent, the summed widths", () => {
  for (const [n, f] of [[2, 1.2], [3, 1.2], [5, 1.2], [6, 1.5], [7, 1.8]]) {
    const w = thickOuterLayerWidths(n, f);
    near(imageExtent(w), layerEdge(w), 1e-12, `image ${n} f=${f}`);
  }
  near(imageExtent(thickOuterLayerWidths(7, 1.8)), 8.6, 1e-12);
});

test("profile 7x7 f = 1.8: windows follow the real cell centers and sizes; the sticker of a thick corner covers 0.87 of 1.8", () => {
  const widths = thickOuterLayerWidths(7, 1.8), IMG = imageExtent(widths);
  const centers = [-3.4, -2, -1, 0, 1, 2, 3.4];
  for (const face of KEYS) {
    const { right, up } = ORIENTATION[face];
    for (const index of faceStickers(face, 7)) {
      const win = stickerWindow(widths, STICKER_SHARE, face, index);
      const world = index.map((i) => centers[i]);
      const cRight = world[0] * right[0] + world[1] * right[1] + world[2] * right[2];
      const cUp = world[0] * up[0] + world[1] * up[1] + world[2] * up[2];
      const axisOf = (v) => v.findIndex((c) => c !== 0);
      const wR = widths[index[axisOf(right)]], wU = widths[index[axisOf(up)]];
      near(win.scaleU, 0.87 * wR / IMG, 1e-12, `${face} scaleU`);
      near(win.scaleV, 0.87 * wU / IMG, 1e-12, `${face} scaleV`);
      for (const [u, v] of [[0, 0], [1, 1], [0.3, 0.6]]) {
        const A = cRight + (u - 0.5) * 0.87 * wR, B = cUp + (v - 0.5) * 0.87 * wU;
        const [tu, tv] = windowUv(win, u, v);
        near(tu, A / IMG + 0.5, 1e-9, `${face} s`);
        near(tv, B / IMG + 0.5, 1e-9, `${face} v`);
      }
    }
  }
  // the corner sticker: 1.8 wide cell
  const corner = stickerWindow(widths, STICKER_SHARE, "F", [0, 6, 6]);
  near(corner.scaleU, 0.87 * 1.8 / IMG, 1e-12);
});

test("the body share (0.99) uses the same image as the sticker share", () => {
  const w = uniformLayerWidths(3);
  const a = stickerWindow(w, 0.87, "F", [1, 1, 2]), b = stickerWindow(w, 0.99, "F", [1, 1, 2]);
  near(b.scaleU, 0.99 / imageExtent(w), 1e-12);
  near(a.offsetU + a.scaleU / 2, b.offsetU + b.scaleU / 2, 1e-12, "same center");
});

test("input checks", () => {
  const w = uniformLayerWidths(3);
  assert.throws(() => stickerWindow(w, STICKER_SHARE, "X", [0, 0, 0]));
  assert.throws(() => stickerWindow(w, STICKER_SHARE, "F", [0, 0, 3]));
  assert.throws(() => stickerWindow(w, 0, "F", [0, 0, 2]));
});
