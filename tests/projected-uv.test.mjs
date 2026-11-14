// SPDX-License-Identifier: AGPL-3.0-or-later
// The pure UV rule of the "Projected" picture mode: six beamers, one per face, each projecting its own image face-on onto
// its own face; only the stickers carry the image. These tests state the rule independently of the implementation (literal
// face orientations, the prototype formula) and cover every face, every size 2 to 7, corners, the margin of exactly one gap
// width and the layer-width profile.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PROJECTED_FACES, faceOfNormal, gapWidth, imageExtent, stickerWindow, windowUv, STICKER_SHARE,
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

test("uniform widths: the gap is 0.13 of a pitch (1 - 0.87) and the image side is n - 2 g", () => {
  assert.equal(STICKER_SHARE, 0.87);
  for (const n of SIZES) {
    const w = uniformLayerWidths(n);
    near(gapWidth(w, STICKER_SHARE), 0.13, 1e-12, `gap n=${n}`);
    near(imageExtent(w, STICKER_SHARE), n - 0.26, 1e-12, `image n=${n}`);
  }
});

for (const face of KEYS) for (const n of SIZES) test(`${face} ${n}x${n}: every sticker window equals the prototype formula (A = c_right + (u - .5) 0.87, s = A / IMG + .5, t = .5 - B / IMG)`, () => {
  const widths = uniformLayerWidths(n), IMG = n - 2 * 0.13, h = (n - 1) / 2;
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
    // the sticker's upper-left uv corner is the image corner plus the gap and a half margin: outside the image by 0.065 pitch
    const [s, tUp] = windowUv(win, 0, 1);
    const IMG = n - 0.26;
    near(s, ((-n / 2 + 0.5) - 0.435) / IMG + 0.5, 1e-9, `${face} ${n} s`);
    near(1 - tUp, 0.5 - ((n / 2 - 0.5) + 0.435) / IMG, 1e-9, `${face} ${n} t`);
    assert.ok(s < 0 && 1 - tUp < 0, "the outer rim of a corner sticker lies outside the image (plastic)");
  }
});

test("margin: the image ends exactly one gap width inside the face extent on every side, for every size", () => {
  for (const n of SIZES) {
    const w = uniformLayerWidths(n), g = gapWidth(w, STICKER_SHARE);
    for (const face of KEYS) {
      // the sticker row/column at the far ends: texture coordinate 0 and 1 are at the image edge
      const first = faceStickers(face, n).map((i) => stickerWindow(w, STICKER_SHARE, face, i));
      const left = first.find((x) => x.col === 0 && x.row === 0), right = first.find((x) => x.col === n - 1 && x.row === n - 1);
      // image coordinate s = 0 sits at A = -IMG/2; the face edge is A = -n/2: distance g
      const edgeA = (win, edge) => (edge - win.offsetU) / win.scaleU; // sticker-u (in 0..1 units) where s hits `edge`
      const aOfU = (win, u, c) => c + (u - 0.5) * 0.87;
      const cLeft = -(n - 1) / 2, cRight = (n - 1) / 2;
      near(aOfU(left, edgeA(left, 0), cLeft), -n / 2 + g, 1e-9, `${face} ${n} left margin`);
      near(aOfU(right, edgeA(right, 1), cRight), n / 2 - g, 1e-9, `${face} ${n} right margin`);
    }
  }
});

test("profile [f,1,...,1,f]: the face extent is the summed widths; g is the mean of the real gaps between neighbor stickers", () => {
  for (const [n, f] of [[2, 1.2], [3, 1.2], [5, 1.2], [6, 1.5], [7, 1.8]]) {
    const w = thickOuterLayerWidths(n, f), edge = layerEdge(w);
    // the gap between stickers of layers i and i + 1 is (1 - 0.87) (w_i + w_i+1) / 2, because a sticker is 0.87 of its cell
    let sum = 0;
    for (let i = 0; i + 1 < n; i++) sum += (1 - STICKER_SHARE) * (w[i] + w[i + 1]) / 2;
    const g = sum / (n - 1);
    near(gapWidth(w, STICKER_SHARE), g, 1e-12, `gap ${n} f=${f}`);
    near(imageExtent(w, STICKER_SHARE), edge - 2 * g, 1e-12, `image ${n} f=${f}`);
  }
  // the 7x7 values by hand: gaps 0.065 (1.8 + 1) = 0.182 twice and 0.13 four times; mean 0.156
  near(gapWidth(thickOuterLayerWidths(7, 1.8), STICKER_SHARE), (2 * 0.065 * 2.8 + 4 * 0.13) / 6, 1e-12);
  near(imageExtent(thickOuterLayerWidths(7, 1.8), STICKER_SHARE), 8.6 - 2 * ((2 * 0.065 * 2.8 + 4 * 0.13) / 6), 1e-12);
});

test("profile 7x7 f = 1.8: windows follow the real cell centers and sizes; the sticker of a thick corner covers 0.87 of 1.8", () => {
  const widths = thickOuterLayerWidths(7, 1.8), IMG = imageExtent(widths, STICKER_SHARE);
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

test("the body share (0.99) uses the same gap and image as the sticker share", () => {
  const w = uniformLayerWidths(3);
  const a = stickerWindow(w, 0.87, "F", [1, 1, 2]), b = stickerWindow(w, 0.99, "F", [1, 1, 2]);
  near(b.scaleU, 0.99 / imageExtent(w, STICKER_SHARE), 1e-12);
  near(a.offsetU + a.scaleU / 2, b.offsetU + b.scaleU / 2, 1e-12, "same center");
});

test("input checks", () => {
  const w = uniformLayerWidths(3);
  assert.throws(() => stickerWindow(w, STICKER_SHARE, "X", [0, 0, 0]));
  assert.throws(() => stickerWindow(w, STICKER_SHARE, "F", [0, 0, 3]));
  assert.throws(() => stickerWindow(w, 0, "F", [0, 0, 2]));
  assert.throws(() => gapWidth([1], STICKER_SHARE));
});
