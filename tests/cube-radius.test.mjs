// SPDX-License-Identifier: AGPL-3.0-or-later
// Owner decision 2026-11-14 (option O2): the bevel radius of a cube of N >= 4 keeps the millimeter radius of the 3x3 at the same
// cube edge: r = bodyRadius * edge / 3 (edge in inner layers: N, or the layer-width sum with a profile). N = 2 and 3 are unchanged.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { faceUvAxes } from "../packages/cube-viewer/src/cut-faces.ts";
import {
  PRESENTATION_PRESET as P, bodyRadiusFor, innerRadiusFor, stickerRadiusFor, stickerSideFor, createStickerGeometry, createPresentationGeometry,
  presentationLayerProfile, thickOuterLayerWidths, layerEdge, PhysicalCubeScene, createPlasticMaterial, createStickerMaterial,
} from "../packages/cube-viewer/src/index.ts";

// Three's rounded box (arc-length UV): the planar-UV option and its cut-face rule are about this body; the two-radius body is planar by itself.
const roundedProfile = (widths) => ({ widths, body: (cell) => new RoundedBoxGeometry(cell[0] - 0.01, cell[1] - 0.01, cell[2] - 0.01, 3, 0.055 * layerEdge(widths) / 3) });
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

test("createPresentationGeometry: the reference body has the per-N radius of the cube edges, the sticker is limited by the inner radius; N <= 3 stickers are unchanged", () => {
  for (const n of [2, 3, 4, 5, 6, 7]) {
    const g = createPresentationGeometry(n);
    near(g.body.parameters.radius, UNIFORM[n], 1e-12, `body radius N=${n}`);
    g.sticker.computeBoundingBox();
    near(g.sticker.boundingBox.max.x, stickerSideFor(1, innerRadiusFor(n)) / 2, 1e-6, `sticker half width N=${n} (the inner radius limits it)`);
  }
  for (const n of [2, 3]) { const g = createPresentationGeometry(n); g.sticker.computeBoundingBox(); near(g.sticker.boundingBox.max.x, 0.435, 1e-6); }
  near(createPresentationGeometry().body.parameters.radius, 0.055, 0);
});

test("the sticker stays on the flat part of its body for every N and every layer-profile cell", () => {
  for (const [n, f] of [[2, 1], [3, 1], [4, 1], [5, 1.1], [6, 1.3], [7, 1.6], [7, 1]]) {
    const r = innerRadiusFor(n, layerEdge(thickOuterLayerWidths(n, f)));
    for (const cell of [1, f]) assert.ok(stickerSideFor(cell, r) <= cell - (1 - P.bodyWidth) - 2 * r + 1e-12, `N=${n} cell ${cell}`);
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

test("scene with presentationLayerProfile: one sticker size on every cell (the inner cell's), at scale 1; the bodies are the two-radius cubies", () => {
  for (const [n, f] of Object.entries(PROFILE)) {
    const widths = thickOuterLayerWidths(Number(n), f), edge = layerEdge(widths), profile = presentationLayerProfile(widths);
    const side = stickerSideFor(1, innerRadiusFor(Number(n), edge));
    for (const [w, h] of [[f, 1], [1, 1], [f, f]]) { const s = profile.sticker(w, h); s.computeBoundingBox(); near(s.boundingBox.max.x * 2, side, 1e-6); near(s.boundingBox.max.y * 2, side, 1e-6); }
  }
  const widths = thickOuterLayerWidths(5, 1.1), profile = presentationLayerProfile(widths), root = new THREE.Group();
  const tex = new THREE.Texture(), mat = createStickerMaterial(tex), g = createPresentationGeometry(5);
  const frames = [{ id: 1, cubie: 1, p: [-2, -2, 2], n: [0, 0, 1], up: [0, 1, 0] }, { id: 2, cubie: 2, p: [0, 0, 2], n: [0, 0, 1], up: [0, 1, 0] }];
  const scene = new PhysicalCubeScene(root, frames, new Map([[1, mat], [2, mat]]), createPlasticMaterial(), 1, g, new Map(), { layers: profile });
  const stickers = []; root.traverse((o) => { if (o.userData.stickerId) stickers.push(o); });
  assert.equal(stickers.length, 2);
  for (const s of stickers) { assert.deepEqual(s.scale.toArray(), [1, 1, 1]); s.geometry.computeBoundingBox(); }
  const corner = stickers.find((s) => s.userData.stickerId === 1), mid = stickers.find((s) => s.userData.stickerId === 2);
  const side = stickerSideFor(1, innerRadiusFor(5, 5.2));
  near(corner.geometry.boundingBox.max.x * 2, side, 1e-6); near(mid.geometry.boundingBox.max.x * 2, side, 1e-6);
  scene.dispose?.();
});

test("planarFaceUv (stickerless only): on three's rounded box the exterior faces take UV linear in position over the body, other looks keep the arc-length UV (the two-radius body is planar by itself)", () => {
  const widths = thickOuterLayerWidths(5, 1.1), profile = { widths, body: (cell) => new RoundedBoxGeometry(cell[0] - 0.01, cell[1] - 0.01, cell[2] - 0.01, 3, 0.055) }; // three's rounded box: arc-length UV
  const fr = [{ id: 1, cubie: 1, p: [0, 0, 2], n: [0, 0, 1], up: [0, 1, 0] }, { id: 2, cubie: 2, p: [-2, 2, 2], n: [0, 0, 1], up: [0, 1, 0] }];
  const read = (planar, stickerless) => {
    const root = new THREE.Group(), mat = createStickerMaterial(new THREE.Texture());
    const scene = new PhysicalCubeScene(root, fr, new Map(fr.map((s) => [s.id, mat])), createPlasticMaterial(), 1, createPresentationGeometry(5, 5.2), new Map(), { layers: profile, planarFaceUv: planar });
    scene.setConstruction(stickerless ? "stickerless" : "stickered");
    const out = [];
    root.traverse((o) => {
      if (!o.isMesh || o.userData.stickerId !== undefined || !o.userData.sourceFaceStickerIds) return;
      const g = o.geometry, pos = g.getAttribute("position"), uv = g.getAttribute("uv"), group = g.groups.find((x) => x.materialIndex === 4);
      g.computeBoundingBox(); const size = g.boundingBox.getSize(new THREE.Vector3());
      let worst = 0;
      for (let i = group.start; i < group.start + group.count; i++) {
        const v = g.index?.getX(i) ?? i;
        worst = Math.max(worst, Math.abs(uv.getX(v) - (pos.getX(v) / size.x + 0.5)), Math.abs(uv.getY(v) - (pos.getY(v) / size.y + 0.5)));
      }
      out.push(worst);
    });
    return out;
  };
  for (const worst of read(true, true)) assert.ok(worst < 1e-5, `planar: uv error ${worst}`);
  assert.ok(read(true, false).every((w) => w > 1e-3), "stickered keeps the arc-length UV");
  assert.ok(read(false, true).every((w) => w > 1e-3), "without the option the arc-length UV stays");
});

test("planarFaceUv: a cut face is planar too, so its edge stops sit where the exterior art ends (texture fraction along a shared edge)", () => {
  for (const [n, f] of [[5, 1.1], [7, 1.6]]) {
    const widths = thickOuterLayerWidths(n, f), profile = roundedProfile(widths), edge = layerEdge(widths);
    const fr = [{ id: 1, cubie: 1, p: [0, 0, (n - 1) / 2], n: [0, 0, 1], up: [0, 1, 0] }, { id: 2, cubie: 2, p: [-(n - 1) / 2, (n - 1) / 2, (n - 1) / 2], n: [0, 0, 1], up: [0, 1, 0] }];
    const root = new THREE.Group(), mat = createStickerMaterial(new THREE.Texture());
    const scene = new PhysicalCubeScene(root, fr, new Map(fr.map((s) => [s.id, mat])), createPlasticMaterial(), 1, createPresentationGeometry(n, edge), new Map(), { layers: profile, planarFaceUv: true, miterCutFaces: true, bodyColor: "#202329" });
    scene.setConstruction("stickerless");
    let checked = 0;
    root.traverse((o) => {
      if (!o.isMesh || !o.userData.sourceFaceStickerIds) return;
      const g = o.geometry; g.computeBoundingBox(); const size = g.boundingBox.getSize(new THREE.Vector3()), pos = g.getAttribute("position"), uv = g.getAttribute("uv");
      const ax = faceUvAxes(g)[0]; // +X cut face: its u or v runs along y
      for (const group of g.groups.filter((x) => x.materialIndex === 0)) for (let i = group.start; i < group.start + group.count; i++) {
        const v = g.index?.getX(i) ?? i;
        if (pos.getZ(v) < size.z / 2 - 0.2) continue; // the bevel half next to the +Z exterior face
        const q = ax.uAxis === 1 ? (ax.uSign > 0 ? uv.getX(v) : 1 - uv.getX(v)) : (ax.vSign > 0 ? uv.getY(v) : 1 - uv.getY(v));
        near(q, pos.getY(v) / size.y + 0.5, 1e-5, `N=${n} cut face texture fraction along the shared edge`); checked++;
      }
    });
    assert.ok(checked > 10, "vertices checked");
    scene.dispose();
  }
});

test("planarFaceUv: every one of the six face groups of a cut-face body is planar (UV linear in position along both tangent axes)", () => {
  const widths = thickOuterLayerWidths(7, 1.6), profile = roundedProfile(widths), edge = layerEdge(widths);
  const fr = [{ id: 1, cubie: 1, p: [-3, 3, 3], n: [0, 0, 1], up: [0, 1, 0] }, { id: 2, cubie: 2, p: [0, 0, 3], n: [0, 0, 1], up: [0, 1, 0] }];
  const root = new THREE.Group(), mat = createStickerMaterial(new THREE.Texture());
  const scene = new PhysicalCubeScene(root, fr, new Map(fr.map((s) => [s.id, mat])), createPlasticMaterial(), 1, createPresentationGeometry(7, edge), new Map(), { layers: profile, planarFaceUv: true, miterCutFaces: true, bodyColor: "#202329" });
  scene.setConstruction("stickerless");
  let bodies = 0;
  root.traverse((o) => {
    if (!o.isMesh || !o.userData.sourceFaceStickerIds) return;
    const g = o.geometry; g.computeBoundingBox(); const size = g.boundingBox.getSize(new THREE.Vector3()), pos = g.getAttribute("position"), uv = g.getAttribute("uv"), axes = faceUvAxes(g);
    for (let face = 0; face < 6; face++) {
      const a = axes[face];
      for (const group of g.groups.filter((x) => x.materialIndex === face)) for (let i = group.start; i < group.start + group.count; i++) {
        const v = g.index?.getX(i) ?? i;
        near(uv.getX(v), a.uSign * (pos.getComponent(v, a.uAxis) / size.getComponent(a.uAxis)) + 0.5, 1e-5, `face group ${face}: u linear in position`);
        near(uv.getY(v), a.vSign * (pos.getComponent(v, a.vAxis) / size.getComponent(a.vAxis)) + 0.5, 1e-5, `face group ${face}: v linear in position`);
      }
    }
    bodies++;
  });
  assert.ok(bodies >= 2, "bodies checked");
  scene.dispose();
});

test("stickerSideFor ends the sticker where the bevel starts (no margin), and the sticker radius equals the body radius from 3x3 on", () => {
  for (const [n, edge] of [[5, 5], [5, 5.2], [7, 7], [7, 8.2]]) {
    const r = bodyRadiusFor(n, edge), flat = P.bodyWidth - 2 * r;
    near(stickerSideFor(1, r), flat, 1e-12, `N=${n} edge ${edge}: flat part of the body`);
    assert.equal(stickerRadiusFor(n, edge), bodyRadiusFor(n, edge), "the corner radius of sticker and body agree (the side rule uses the body radius)");
  }
  assert.equal(stickerSideFor(1, 0.055), 0.87);
  assert.equal(stickerSideFor(1.6, 0.15), Math.min(0.87 * 1.6, 1.6 - 0.01 - 0.3));
});
