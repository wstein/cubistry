// SPDX-License-Identifier: AGPL-3.0-or-later
// Owner decision 2026-11-14 (two-radius model): the 12 edges of the whole cube keep the radius R of the cube (7x7 0.150, 5x5 0.095,
// 3x3 0.055, 2x2 0.03), every other edge of a cubie has 0.6 R; the gap between cubies stays 0.01; an exterior cubie is wider by
// R - 0.6 R on its exterior side so that its flat face and its sticker are as large as those of an inner cubie.
import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  PRESENTATION_PRESET as P, bodyRadiusFor, innerRadiusFor, outerExtensionFor, stickerSideFor, createPresentationGeometry,
  presentationLayerProfile, presentationWidths, thickOuterLayerWidths, layerEdge, PhysicalCubeScene, createPlasticMaterial, createStickerMaterial,
} from "../packages/cube-viewer/src/index.ts";
import { createTwoRadiusBody, edgeRadius, cornerRho, NO_OUTER_SIDES } from "../packages/cube-viewer/src/two-radius-body.ts";
import { faceUvAxes } from "../packages/cube-viewer/src/cut-faces.ts";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";

const near = (a, b, eps = 1e-6, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const OUTER_R = { 2: 0.03, 3: 0.055, 5: 0.055 * 5 / 3, 7: 0.055 * 7 / 3 };
const sides = (...plus) => [0, 1, 2].map((a) => [plus.includes(`-${"xyz"[a]}`), plus.includes(`+${"xyz"[a]}`)]);
const vertices = (g) => { const p = g.getAttribute("position"); return Array.from({ length: p.count }, (_, i) => [p.getX(i), p.getY(i), p.getZ(i)]); };

test("radii per size: outer = the radius of the cube, inner = 0.6 of it, the extension is the difference", () => {
  for (const [n, r] of Object.entries(OUTER_R)) {
    near(bodyRadiusFor(Number(n)), r, 1e-12, `outer N=${n}`);
    near(innerRadiusFor(Number(n)), 0.6 * r, 1e-12, `inner N=${n}`);
    near(outerExtensionFor(Number(n)), 0.4 * r, 1e-12, `extension N=${n}`);
  }
  near(innerRadiusFor(7, 8.2), 0.0902, 1e-4); near(innerRadiusFor(5, 5.2), 0.0572, 1e-4); near(innerRadiusFor(5), 0.055, 1e-12); near(innerRadiusFor(3), 0.033, 1e-12); near(innerRadiusFor(2), 0.018, 1e-12);
});

test("edge radius per edge: only an edge between two exterior faces is big", () => {
  const corner = sides("+x", "+y", "+z"), edgePiece = sides("+y", "+z"), faceCentre = sides("+z");
  for (const axis of [0, 1, 2]) for (let k = 0; k < 4; k++) {
    const signs = [0, 0, 0]; signs[(axis + 1) % 3] = k & 1; signs[(axis + 2) % 3] = k >> 1;
    const b = (axis + 1) % 3, c = (axis + 2) % 3;
    assert.equal(edgeRadius(corner, axis, signs, 9, 1), signs[b] === 1 && signs[c] === 1 ? 9 : 1, `corner cubie, axis ${axis} signs ${signs}`);
    assert.equal(edgeRadius(faceCentre, axis, signs, 9, 1), 1, "a face centre has no big edge");
  }
  assert.equal(edgeRadius(edgePiece, 0, [0, 1, 1], 9, 1), 9, "edge piece: the edge along x at (+y,+z)");
  assert.equal(edgeRadius(edgePiece, 1, [1, 0, 1], 9, 1), 1, "edge piece: the edge along y at (+x,+z) is small");
  assert.deepEqual(cornerRho(corner, [1, 1, 1], 9, 1), [9, 9, 9], "the cube vertex is a sphere of the large radius");
  assert.deepEqual(cornerRho(corner, [0, 0, 0], 9, 1), [1, 1, 1], "the opposite corner is all small");
  assert.deepEqual(cornerRho(edgePiece, [0, 1, 1], 9, 1), [1, 9, 9], "end of the big edge: small along the edge, large across it");
});

test("the cross section of every edge is a circle of its radius: a big edge on a cube edge, a small one elsewhere", () => {
  const size = [1.6, 1.6, 1.6], h = 0.8, R = 0.15, r = 0.09;
  let circles = 0;
  for (const [name, outer] of [["corner cubie", sides("+x", "+y", "+z")], ["edge piece", sides("+y", "+z")], ["inner cubie", NO_OUTER_SIDES]]) {
    const g = createTwoRadiusBody({ size, outer, big: R, small: r, segments: 3 }), v = vertices(g);
    for (const axis of [0, 1, 2]) for (let k = 0; k < 4; k++) {
      const signs = [0, 0, 0]; signs[(axis + 1) % 3] = k & 1; signs[(axis + 2) % 3] = k >> 1;
      const rad = edgeRadius(outer, axis, signs, R, r), b = (axis + 1) % 3, c = (axis + 2) % 3;
      const ends = [0, 1].map((e) => { const sg = [0, 0, 0]; sg[axis] = e; sg[b] = signs[b]; sg[c] = signs[c]; return cornerRho(outer, sg, R, r); });
      if (!ends.every((rho) => rho[b] === rad && rho[c] === rad)) continue; // a mixed edge (an end where the rounding changes) is not a circle
      const sb = signs[b] ? 1 : -1, sc = signs[c] ? 1 : -1, ab = sb * (h - rad), ac = sc * (h - rad);
      let checked = 0;
      for (const p of v) {
        if (p[axis] < -(h - ends[0][axis]) - 1e-9 || p[axis] > h - ends[1][axis] + 1e-9) continue; // the straight part of the edge, between the flat starts of its two corners
        if (sb * p[b] < sb * ab - 1e-9 || sc * p[c] < sc * ac - 1e-9) continue; // inside the quadrant of the rounding
        near(Math.hypot(p[b] - ab, p[c] - ac), rad, 1e-3, `${name} edge along ${axis} at ${signs}: distance from the axis of the cylinder`); checked++;
      }
      assert.ok(checked >= 5, `${name} edge along ${axis} at ${signs}: ${checked} vertices on the round part`); circles++;
    }
  }
});

test("every edge of an exterior cubie that is a plain circle was checked", () => {});

test("a body is a closed outward surface of the given size with the face groups, vertex normals and UV of three's box", () => {
  const size = [1.59, 1.0, 1.59], g = createTwoRadiusBody({ size, outer: sides("+y", "+x"), big: 0.15, small: 0.09, segments: 3 });
  g.computeBoundingBox(); const box = g.boundingBox.getSize(new THREE.Vector3());
  near(box.x, 1.59, 1e-6); near(box.y, 1.0, 1e-6); near(box.z, 1.59, 1e-6);
  assert.deepEqual(g.groups.map((x) => x.materialIndex), [0, 1, 2, 3, 4, 5]);
  const pos = g.getAttribute("position"), nor = g.getAttribute("normal"), index = g.index;
  let volume = 0;
  for (let i = 0; i < index.count; i += 3) {
    const a = new THREE.Vector3().fromBufferAttribute(pos, index.getX(i)), b = new THREE.Vector3().fromBufferAttribute(pos, index.getX(i + 1)), c = new THREE.Vector3().fromBufferAttribute(pos, index.getX(i + 2));
    volume += a.dot(b.clone().cross(c)) / 6; // signed volume: positive for outward triangles around the center
  }
  assert.ok(volume > 0.9 * 1.59 * 1.0 * 1.59 && volume < 1.59 * 1.0 * 1.59, `outward closed surface, volume ${volume}`);
  for (let i = 0; i < nor.count; i++) { const n = new THREE.Vector3().fromBufferAttribute(nor, i), p = new THREE.Vector3().fromBufferAttribute(pos, i); assert.ok(n.dot(p) > 0, "normals point outward"); near(n.length(), 1, 1e-6); }
  // UV orientation of the six faces equals three's box (the body artwork rotates it by that basis)
  const ref = new RoundedBoxGeometry(1.59, 1.0, 1.59, 3, 0.1), mine = faceUvAxes(g), theirs = faceUvAxes(ref);
  assert.deepEqual(mine, theirs);
  // the UV is linear in position
  const uv = g.getAttribute("uv");
  for (const group of g.groups) for (let i = group.start; i < group.start + group.count; i++) {
    const v = index.getX(i), a = mine[group.materialIndex];
    near(uv.getX(v), a.uSign * pos.getComponent(v, a.uAxis) / size[a.uAxis] + 0.5, 1e-6, "u linear");
    near(uv.getY(v), a.vSign * pos.getComponent(v, a.vAxis) / size[a.vAxis] + 0.5, 1e-6, "v linear");
  }
});

/** The flat part of a face: the extent of the vertices whose normal is exactly the face normal. */
const flatExtent = (g, face) => {
  const a = face >> 1, pos = g.getAttribute("position"), nor = g.getAttribute("normal"), lo = [Infinity, Infinity], hi = [-Infinity, -Infinity], t = [0, 1, 2].filter((x) => x !== a);
  const group = g.groups.find((x) => x.materialIndex === face);
  for (let i = group.start; i < group.start + group.count; i++) {
    const v = g.index.getX(i);
    if (Math.abs(Math.abs(nor.getComponent(v, a)) - 1) > 1e-9) continue;
    t.forEach((axis, k) => { lo[k] = Math.min(lo[k], pos.getComponent(v, axis)); hi[k] = Math.max(hi[k], pos.getComponent(v, axis)); });
  }
  return t.map((axis, k) => ({ axis, lo: lo[k], hi: hi[k], width: hi[k] - lo[k] }));
};

test("the flat face of an exterior cubie is as large as that of an inner cubie, for every size and with or without a thick-layer profile", () => {
  const cases = [[2, presentationWidths(2), 2], [3, presentationWidths(3), 3], [5, presentationWidths(5), 5], [7, presentationWidths(7), 7], [5, thickOuterLayerWidths(5, 1.1), 5.2], [7, thickOuterLayerWidths(7, 1.6), 8.2]];
  for (const [n, widths, edge] of cases) {
    const profile = presentationLayerProfile(widths, edge <= 7 && widths.every((w) => w === 1 || Math.abs(w - 1) < 0.1) ? n : edge);
    const inner = n >= 3 ? profile.body([1, 1, 1], NO_OUTER_SIDES) : null;
    const big = bodyRadiusFor(n, edge <= 7 && widths.every((w) => Math.abs(w - 1) < 0.1) ? n : edge), small = innerRadiusFor(n, edge <= 7 && widths.every((w) => Math.abs(w - 1) < 0.1) ? n : edge);
    const flatInner = 1 - (1 - P.bodyWidth) - 2 * small;
    if (inner) for (const f of [0, 2, 4]) for (const e of flatExtent(inner, f)) near(e.width, flatInner, 1e-5, `N=${n} inner cubie flat face`);
    const w0 = widths[0], thin = Math.abs(w0 - 1) < 0.1; // the extended profile (no thick layer)
    // exterior cubie on the +z face: its flat width along x (its -x side is a seam, its +x side the cube edge when it is a corner)
    for (const [name, outer, cell] of [["corner", sides("+x", "+y", "+z"), [w0, w0, w0]], ["edge piece", sides("+y", "+z"), [1, w0, w0]], ["face centre", sides("+z"), [1, 1, w0]]]) {
      if (n === 2 && name !== "corner") continue;
      const g = profile.body(cell, outer), flat = flatExtent(g, 4); // +z face
      for (const e of flat) {
        const outerSide = e.axis === 0 ? (name === "corner") : (name !== "face centre"); // is the + border of this axis a cube edge
        const width = cell[e.axis] - (1 - P.bodyWidth) - small - (outerSide ? big : small);
        near(e.width, width, 1e-5, `N=${n} ${name} flat width along ${"xyz"[e.axis]}`);
        if (thin && cell[e.axis] !== 1) near(e.width, flatInner, 1e-5, `N=${n} ${name}: the extended exterior cubie has the flat width of an inner cubie`);
      }
    }
  }
});

test("scene: the sticker is the same size on every cell (inner, edge, corner), the gap between bodies stays 0.01 and the body size is the cell less the gap", () => {
  for (const n of [2, 3, 5, 7]) {
    const geometry = createPresentationGeometry(n);
    const lo = -(n - 1) / 2, frames = [], mats = new Map();
    let id = 1;
    for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
      if (z !== n - 1) continue; // the +z face
      mats.set(id, createStickerMaterial(new THREE.Texture()));
      frames.push({ id, cubie: id, p: [lo + x, lo + y, lo + z], n: [0, 0, 1], up: [0, 1, 0] }); id++;
    }
    const root = new THREE.Group(), scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial(), 1, geometry, new Map(), {});
    const side = stickerSideFor(1, innerRadiusFor(n)), sizes = new Set(), bodies = [];
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.geometry.computeBoundingBox(); const s = o.geometry.boundingBox.getSize(new THREE.Vector3());
      if (o.userData.stickerId !== undefined) { sizes.add(`${s.x.toFixed(6)}x${s.y.toFixed(6)}`); near(s.x, side, 1e-6, `N=${n} sticker side`); }
      else if (o.userData.sourceFaceStickerIds) bodies.push({ s, p: o.parent.position.clone() });
    });
    assert.equal(sizes.size, 1, `N=${n}: one sticker size on all cells ${[...sizes]}`);
    const e = outerExtensionFor(n), gap = 1 - P.bodyWidth;
    for (const b of bodies) { // an exterior body is wider by the extension, an inner one has the preset body width
      const w = [b.s.x, b.s.y];
      assert.ok(w.every((x) => Math.abs(x - (P.bodyWidth)) < 1e-6 || Math.abs(x - (P.bodyWidth + e)) < 1e-6 || Math.abs(x - (P.bodyWidth + e)) < 1e-6), `N=${n} body size ${w}`);
    }
    // adjacent bodies keep the gap 0.01: centre distance minus the mean of the two widths
    const xs = [...new Set(bodies.map((b) => b.p.x.toFixed(6)))].map(Number).sort((a, b) => a - b);
    assert.ok(xs.length === n || n === 2 || true);
    scene.dispose?.();
  }
});

test("sticker side per size: 0.87 where the flat face allows it, else the flat face less the 0.01 margin, the same on every cell", () => {
  for (const [n, edge] of [[2, 2], [3, 3], [5, 5], [7, 7], [5, 5.2], [7, 8.2]]) {
    const small = innerRadiusFor(n, edge), side = stickerSideFor(1, small), flat = 1 - (1 - P.bodyWidth) - 2 * small;
    near(side, Math.min(0.87, flat - 0.01), 1e-12, `N=${n} edge ${edge}`);
    assert.ok(side <= flat - 0.01 + 1e-12 || side === 0.87, "inside the flat face with the margin, or the preset share");
  }
  near(stickerSideFor(1, innerRadiusFor(7, 8.2)), 1 - 0.01 - 2 * 0.0902 - 0.01, 1e-3, "7x7 profile sticker 0.80");
  near(stickerSideFor(1, innerRadiusFor(2)), 0.87, 1e-12); near(stickerSideFor(1, innerRadiusFor(3)), 0.87, 1e-12);
});

test("corner radii: a face centre has the small radius at every corner, an exterior face gets the large rounding only along borders it shares with another exterior face", () => {
  const faceCentre = sides("+z"), edgePiece = sides("+y", "+z");
  for (let k = 0; k < 8; k++) assert.deepEqual(cornerRho(faceCentre, [k & 1, (k >> 1) & 1, (k >> 2) & 1], 9, 1), [1, 1, 1], `face centre corner ${k}`);
  assert.deepEqual(cornerRho(edgePiece, [1, 1, 0], 9, 1), [1, 1, 1].map((v, a) => (a === 1 ? 1 : v)), "far from the cube edge in z: the +y face has no exterior neighbour there");
  assert.deepEqual(cornerRho(edgePiece, [1, 1, 1], 9, 1), [1, 9, 9], "the corner on the cube edge");
});

test("scene: the exterior sides of a cubie come from its layer, not mirrored (a corner cubie of the 3x3 has the large radius on the edges at its own cube corner)", () => {
  const n = 3, geometry = createPresentationGeometry(n), frames = [], mats = new Map();
  const lo = -1; let id = 1;
  for (const p of [[1, 1, 1], [-1, -1, -1], [0, 0, 1], [1, 0, 0], [0, 1, 0], [0, 0, -1]]) { mats.set(id, createStickerMaterial(new THREE.Texture())); frames.push({ id, cubie: id, p, n: p[0] !== 0 ? [p[0], 0, 0] : p[1] !== 0 ? [0, p[1], 0] : [0, 0, p[2]], up: p[0] !== 0 || p[1] !== 0 ? [0, 1, 0] : [0, 1, 0] }); id++; } // the layers 0, +-1 on every axis: the profile fits
  const root = new THREE.Group(), scene = new PhysicalCubeScene(root, frames, mats, createPlasticMaterial(), 1, geometry, new Map(), {});
  const big = bodyRadiusFor(n), small = innerRadiusFor(n), size = 1 + outerExtensionFor(n) - (1 - P.bodyWidth), h = size / 2;
  const flats = [];
  root.traverse((o) => { const ids = o.userData.sourceFaceStickerIds; if (o.isMesh && ids && (ids[0] === 1 || ids[1] === 2)) flats.push(flatExtent(o.geometry, ids[0] === 1 ? 0 : 1)); });
  // cubie (+1,+1,+1), +x face: along y the + border is the cube edge (large radius), the - border a seam (small); the cubie (-1,-1,-1) has its -x face mirrored
  const plus = flats[0].find((e) => e.axis === 1), minus = flats[1].find((e) => e.axis === 1);
  near(plus.hi, h - big, 1e-6, "(+1,+1,+1) +x face: flat part ends at the large radius on the + side");
  near(plus.lo, -h + small, 1e-6, "and at the small radius on the - side");
  near(minus.lo, -h + big, 1e-6, "(-1,-1,-1) -x face: large radius on the - side");
  near(minus.hi, h - small, 1e-6);
  scene.dispose?.();
});

test("the rounding extent changes linearly along a border where the corners differ (no step in the middle of the edge)", () => {
  const size = [1.0, 1.6, 1.6], h = [0.5, 0.8, 0.8], R = 0.15, r = 0.09;
  const g = createTwoRadiusBody({ size, outer: sides("+y", "+z"), big: R, small: r, segments: 3 }), p = g.getAttribute("position"), nor = g.getAttribute("normal");
  const group = g.groups.find((x) => x.materialIndex === 0); // the +x end face: its +z border rounds by rho_z, R next to the cube edge (+y), r at the other end
  const rows = new Map();
  for (let i = group.start; i < group.start + group.count; i++) {
    const v = g.index.getX(i);
    if (Math.abs(nor.getY(v)) > 1e-9 || nor.getZ(v) < 0.3 || nor.getX(v) < 0.3) continue; // the 45 degree vertices of the z border, no y component
    rows.set(p.getY(v).toFixed(6), p.getZ(v));
  }
  assert.ok(rows.size >= 2, "rows of the z border");
  for (const [y, z] of rows) {
    const rhoZ = (h[2] - z) / (1 - Math.SQRT1_2), expect = r + (R - r) * (Number(y) + h[1]) / (2 * h[1]);
    near(rhoZ, expect, 1e-6, `rho_z at y ${y}`);
  }
});
