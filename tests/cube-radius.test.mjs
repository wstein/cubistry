// SPDX-License-Identifier: AGPL-3.0-or-later
// Owner decision 2026-11-14 (option O2): the bevel radius of a cube of N >= 4 keeps the millimeter radius of the 3x3 at the same
// cube edge: r = bodyRadius * edge / 3 (edge in inner layers: N, or the layer-width sum with a profile). N = 2 and 3 are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  PRESENTATION_PRESET as P, bodyRadiusFor, stickerRadiusFor, stickerSideFor, createStickerGeometry, createPresentationGeometry,
  presentationLayerProfile, thickOuterLayerWidths, layerEdge, PhysicalCubeScene, createPlasticMaterial, createStickerMaterial,
} from "../packages/cube-viewer/src/index.ts";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const UNIFORM = { 2: 0.03, 3: 0.055, 4: 0.055 * 4 / 3, 5: 0.055 * 5 / 3, 6: 0.055 * 6 / 3, 7: 0.055 * 7 / 3 };
const PROFILE = { 5: 1.1, 7: 1.6 }; // OUTER_LAYER_WIDTH of Calendar7

test("body radius per N: 2x2 and 3x3 unchanged, larger cubes keep the 3x3 millimeter radius (uniform pitch)", () => {
  for (const [n, r] of Object.entries(UNIFORM)) near(bodyRadiusFor(Number(n)), r, 1e-12, `N=${n}`);
  assert.equal(bodyRadiusFor(3), P.bodyRadius);
  assert.equal(bodyRadiusFor(2), P.size2BodyRadius);
  // the same millimeter radius: r / edge is the 3x3 value for every N >= 3
  for (const n of [3, 4, 5, 6, 7]) near(bodyRadiusFor(n) / n, P.bodyRadius / 3, 1e-12, `share of edge, N=${n}`);
});

test("body radius with a layer profile follows the edge (sum of the widths): 0.095 on 5x5 (f 1.1), 0.150 on 7x7 (f 1.6)", () => {
  for (const [n, f] of Object.entries(PROFILE)) {
    const edge = layerEdge(thickOuterLayerWidths(Number(n), f));
    near(bodyRadiusFor(Number(n), edge), 0.055 * edge / 3, 1e-12, `N=${n}`);
  }
  near(bodyRadiusFor(5, 5.2), 0.0953, 1e-4);
  near(bodyRadiusFor(7, 8.2), 0.1503, 1e-4);
});

test("createPresentationGeometry uses the per-N radius on body and sticker; N <= 3 geometry is unchanged", () => {
  for (const n of [2, 3, 4, 5, 6, 7]) {
    const g = createPresentationGeometry(n);
    near(g.body.parameters.radius, UNIFORM[n], 1e-12, `body radius N=${n}`);
    g.sticker.computeBoundingBox();
    near(g.sticker.boundingBox.max.x, stickerSideFor(1, stickerRadiusFor(n)) / 2, 1e-6, `sticker half width N=${n}`);
  }
  for (const n of [2, 3]) { const g = createPresentationGeometry(n); g.sticker.computeBoundingBox(); near(g.sticker.boundingBox.max.x, 0.435, 1e-6); }
  near(createPresentationGeometry().body.parameters.radius, 0.055, 0);
});

test("the sticker stays on the flat part of its body for every N and every layer-profile cell", () => {
  for (const [n, f] of [[2, 1], [3, 1], [4, 1], [5, 1.1], [6, 1.3], [7, 1.6], [7, 1]]) {
    const r = bodyRadiusFor(n, layerEdge(thickOuterLayerWidths(n, f)));
    for (const cell of [1, f]) assert.ok(stickerSideFor(cell, stickerRadiusFor(n, layerEdge(thickOuterLayerWidths(n, f)))) <= cell - (1 - P.bodyWidth) - 2 * r + 1e-12, `N=${n} cell ${cell}`);
  }
});

test("sticker radius is the same on both axes of a non-square sticker (no elliptic corner)", () => {
  const r = 0.15, g = createStickerGeometry(1.2, 0.7, r, 4), p = g.getAttribute("position");
  const has = (x, y) => { for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) < 1e-6 && Math.abs(p.getY(i) - y) < 1e-6) return true; return false; };
  assert.ok(has(0.6 - r, -0.35) && has(0.6, -0.35 + r), "lower right corner arc starts r from the corner on both axes");
  assert.ok(has(-0.6 + r, 0.35) && has(-0.6, 0.35 - r), "upper left");
  g.computeBoundingBox(); near(g.boundingBox.max.x, 0.6, 1e-6); near(g.boundingBox.max.y, 0.35, 1e-6);
  const uv = g.getAttribute("uv"); let lo = 1, hi = 0; for (let i = 0; i < uv.count; i++) { lo = Math.min(lo, uv.getX(i), uv.getY(i)); hi = Math.max(hi, uv.getX(i), uv.getY(i)); }
  near(lo, 0, 1e-6); near(hi, 1, 1e-6);
});

test("scene with presentationLayerProfile: every cell body has the O2 radius, every sticker its own cell size at scale 1", () => {
  for (const [n, f] of Object.entries(PROFILE)) {
    const widths = thickOuterLayerWidths(Number(n), f), edge = layerEdge(widths), profile = presentationLayerProfile(widths);
    const R = bodyRadiusFor(Number(n), edge);
    for (const cell of [[f, f, f], [f, 1, 1], [1, 1, 1], [f, f, 1]]) near(profile.body(cell).parameters.radius, R, 1e-12, `N=${n} cell ${cell}`);
    // outer corner sticker (f x f): square, side stickerSideFor(f)
    const s = profile.sticker(f, 1); s.computeBoundingBox();
    near(s.boundingBox.max.x * 2, stickerSideFor(f, stickerRadiusFor(Number(n), edge)), 1e-6);
    near(s.boundingBox.max.y * 2, stickerSideFor(1, stickerRadiusFor(Number(n), edge)), 1e-6);
  }
  const widths = thickOuterLayerWidths(5, 1.1), profile = presentationLayerProfile(widths), root = new THREE.Group();
  const tex = new THREE.Texture(), mat = createStickerMaterial(tex), g = createPresentationGeometry(5);
  const frames = [{ id: 1, cubie: 1, p: [-2, -2, 2], n: [0, 0, 1], up: [0, 1, 0] }, { id: 2, cubie: 2, p: [0, 0, 2], n: [0, 0, 1], up: [0, 1, 0] }];
  const scene = new PhysicalCubeScene(root, frames, new Map([[1, mat], [2, mat]]), createPlasticMaterial(), 1, g, new Map(), { layers: profile });
  const stickers = []; root.traverse((o) => { if (o.userData.stickerId) stickers.push(o); });
  assert.equal(stickers.length, 2);
  for (const s of stickers) { assert.deepEqual(s.scale.toArray(), [1, 1, 1]); s.geometry.computeBoundingBox(); }
  const corner = stickers.find((s) => s.userData.stickerId === 1), mid = stickers.find((s) => s.userData.stickerId === 2);
  near(corner.geometry.boundingBox.max.x * 2, stickerSideFor(1.1, stickerRadiusFor(5, 5.2)), 1e-6);
  near(mid.geometry.boundingBox.max.x * 2, stickerSideFor(1, stickerRadiusFor(5, 5.2)), 1e-6);
  scene.dispose?.();
});
