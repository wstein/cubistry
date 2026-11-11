// SPDX-License-Identifier: AGPL-3.0-or-later
// Layer-width profile of the shared cube viewer (PhysicalCubeScene option `layers`): thick outer layers [f, 1, ..., 1, f].
// Geometry (sizes, centers, cut planes), the default profile (= the historical unit pitch, exactly), the core, and the cut-face
// miter on boxes of any proportion. The Calendar7 side (textures, names layout wiring) is tests/calendar7-layer-widths.test.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  PhysicalCubeScene, cutColorAt, cutFaceEdges, faceUvAxes, layerCenters, layerEdge, layerIndexOf, layerPlanes, paintCutPattern,
  thickOuterLayerWidths, uniformLayerWidths, createPlasticMaterial, createPresentationGeometry, PRESENTATION_PRESET,
} from "@cubistry/cube-viewer";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} != ${b}`);
const GAP = 0.01;
const R = PRESENTATION_PRESET.bodyRadius;
const CASES = [[3, 1], [5, 1.2], [6, 1.5], [7, 1.8]]; // N and the outer width f (owner values; N = 6 is a proposal)

// ---- the pure profile ----
test("profile helpers: widths [f,1,...,1,f], edge (N-2)+2f, cut planes and centers, layer index of the mechanics coordinate", () => {
  for (const [n, f] of CASES) {
    const w = thickOuterLayerWidths(n, f);
    assert.equal(w.length, n);
    assert.deepEqual([w[0], w[n - 1]], [f, f]);
    assert.ok(w.slice(1, n - 1).every((x) => x === 1), "inner layers are 1");
    near(layerEdge(w), n - 2 + 2 * f, 1e-12, `edge of ${n}`);
    const planes = layerPlanes(w), centers = layerCenters(w);
    assert.equal(planes.length, n + 1);
    near(planes[0], -(n - 2 + 2 * f) / 2, 1e-12);
    near(planes[n], (n - 2 + 2 * f) / 2, 1e-12);
    w.forEach((x, i) => { near(planes[i + 1] - planes[i], x, 1e-12); near(centers[i], (planes[i] + planes[i + 1]) / 2, 1e-12); });
    for (let i = 0; i < n; i++) assert.equal(layerIndexOf(n, i - (n - 1) / 2), i);
  }
  assert.deepEqual(uniformLayerWidths(4), [1, 1, 1, 1]);
  assert.deepEqual(layerCenters([1.8, 1, 1, 1, 1, 1, 1.8]).map((x) => Math.round(x * 1e9) / 1e9), [-3.4, -2, -1, 0, 1, 2, 3.4]);
  assert.deepEqual(layerPlanes([1.8, 1, 1, 1, 1, 1, 1.8]).map((x) => Math.round(x * 1e9) / 1e9), [-4.3, -2.5, -1.5, -0.5, 0.5, 1.5, 2.5, 4.3]);
  assert.throws(() => layerIndexOf(7, 4));
  assert.throws(() => layerIndexOf(7, 0.5));
  assert.throws(() => thickOuterLayerWidths(7, 0.5));
});

// ---- scenes of a whole N-cube ----
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const upOf = (n) => (n[1] === 0 ? [0, 1, 0] : [0, 0, 1]);
/** One sticker per exposed face of every surface cubie of the N-cube (positions -(N-1)/2 .. (N-1)/2). */
function frames(n) {
  const h = (n - 1) / 2, out = [], ids = new Map();
  for (let x = -h; x <= h; x++) for (let y = -h; y <= h; y++) for (let z = -h; z <= h; z++) {
    const p = [x, y, z];
    for (const normal of NORMALS) {
      const a = normal.findIndex((c) => c !== 0);
      if (p[a] * normal[a] !== h) continue;
      const key = p.join();
      if (!ids.has(key)) ids.set(key, ids.size + 1);
      out.push({ id: out.length + 1, cubie: ids.get(key), p, n: normal, up: upOf(normal) });
    }
  }
  return out;
}
const body = (cell) => new RoundedBoxGeometry(cell[0] - GAP, cell[1] - GAP, cell[2] - GAP, 1, R);
const unitBody = () => new RoundedBoxGeometry(1 - GAP, 1 - GAP, 1 - GAP, 1, R);
function build(n, widths, extra = {}) {
  const fr = frames(n), parent = new THREE.Group();
  const geometry = { ...createPresentationGeometry(), body: unitBody() };
  const basic = new THREE.MeshStandardMaterial();
  const scene = new PhysicalCubeScene(parent, fr, new Map(fr.map((s) => [s.id, basic])), basic, 1, geometry, new Map(), widths ? { layers: { widths, body }, ...extra } : extra);
  scene.sync(fr);
  parent.updateMatrixWorld(true);
  return { scene, parent, fr };
}
const shells = (parent) => { const out = []; parent.traverse((o) => { if (o.userData.sourceFaceStickerIds) out.push(o); }); return out; };
const boxOf = (shell) => new THREE.Box3().setFromObject(shell);

for (const [n, f] of CASES) test(`${n}x${n} (f = ${f}): every cubie is a box of its layer widths minus the gap, centered in its layer; the cut planes are shared`, () => {
  const widths = thickOuterLayerWidths(n, f), planes = layerPlanes(widths), h = (n - 1) / 2;
  const { parent, fr } = build(n, widths);
  const posOf = new Map(fr.map((s) => [s.cubie, s.p]));
  const sh = shells(parent);
  assert.equal(sh.length, new Set(fr.map((s) => s.cubie)).size);
  let corners = 0, ring = 0, inner = 0;
  for (const shell of sh) {
    const box = boxOf(shell);
    const cubie = fr.find((s) => s.id === shell.userData.sourceFaceStickerIds.find((id) => id !== null)).cubie;
    const p = posOf.get(cubie);
    const outerAxes = p.filter((c) => Math.abs(c) === h).length;
    if (outerAxes === 3) corners++; else if (outerAxes === 2) ring++; else inner++;
    for (let a = 0; a < 3; a++) {
      const i = p[a] + h;
      near(box.min.getComponent(a), planes[i] + GAP / 2, 1e-6, `${n} p=${p} axis ${a} min`);
      near(box.max.getComponent(a), planes[i + 1] - GAP / 2, 1e-6, `${n} p=${p} axis ${a} max`);
      near(box.max.getComponent(a) - box.min.getComponent(a), widths[i] - GAP, 1e-6, "size");
    }
  }
  assert.ok(corners === 8 && ring > 0 && inner > 0);
  // The sum of the widths along every line of the cube is the edge: the extent of all bodies is (N - 2) + 2 f (plus the gap at the ends)
  const all = new THREE.Box3();
  for (const shell of sh) all.union(boxOf(shell));
  for (let a = 0; a < 3; a++) near(all.max.getComponent(a) - all.min.getComponent(a), n - 2 + 2 * f - GAP, 1e-6, "total edge");
});

for (const [n, f] of CASES) test(`${n}x${n}: corners are f x f x f, outer-ring pieces on a face are 1 x f, inner pieces 1 x 1 (and never f in an inner layer)`, () => {
  const widths = thickOuterLayerWidths(n, f), h = (n - 1) / 2;
  const { parent, fr } = build(n, widths);
  for (const shell of shells(parent)) {
    const box = boxOf(shell), size = [0, 1, 2].map((a) => box.max.getComponent(a) - box.min.getComponent(a) + GAP);
    const ids = shell.userData.sourceFaceStickerIds.filter((id) => id !== null);
    const p = fr.find((s) => s.id === ids[0]).p;
    p.forEach((c, a) => near(size[a], Math.abs(c) === h ? f : 1, 1e-6, `axis ${a} of ${p}`));
    // The face of a sticker: along its two tangent axes the sizes of those axes (1 x f on a ring piece, f x f on a corner)
    for (const id of ids) {
      const s = fr.find((x) => x.id === id), t = [0, 1, 2].filter((a) => a !== s.n.findIndex((c) => c !== 0));
      const dims = t.map((a) => size[a]).sort();
      if (p.filter((c) => Math.abs(c) === h).length === 3) assert.deepEqual(dims.map((x) => Math.round(x * 1e6)), [f, f].map((x) => Math.round(x * 1e6)));
    }
  }
});

test("layer planes: every layer of every axis holds exactly the bodies between its two cut planes (selection by layer coordinate = by plane)", () => {
  const widths = thickOuterLayerWidths(7, 1.8), planes = layerPlanes(widths);
  const { parent, fr } = build(7, widths);
  const posOf = new Map(fr.map((s) => [s.cubie, s.p]));
  for (const shell of shells(parent)) {
    const cubie = fr.find((s) => s.id === shell.userData.sourceFaceStickerIds.find((id) => id !== null)).cubie, box = boxOf(shell);
    for (let a = 0; a < 3; a++) {
      const center = (box.min.getComponent(a) + box.max.getComponent(a)) / 2;
      const layer = planes.findIndex((pl, i) => i < 7 && center > pl && center < planes[i + 1]);
      assert.equal(layer, posOf.get(cubie)[a] + 3, "the plane layer of the body center is its mechanics layer");
    }
  }
});

test("default profile: widths all 1 give the historical scene exactly (positions, sizes, stickers, core), for N = 3 and 7", () => {
  for (const n of [3, 7]) {
    const plain = build(n, null), uniform = build(n, uniformLayerWidths(n));
    const a = shells(plain.parent), b = shells(uniform.parent);
    assert.equal(a.length, b.length);
    a.forEach((shell, i) => {
      const x = boxOf(shell), y = boxOf(b[i]);
      for (let k = 0; k < 3; k++) { near(x.min.getComponent(k), y.min.getComponent(k), 1e-12); near(x.max.getComponent(k), y.max.getComponent(k), 1e-12); }
      assert.deepEqual(shell.parent.matrixWorld.elements, b[i].parent.matrixWorld.elements);
    });
    const stickers = (parent) => { const m = []; parent.traverse((o) => { if (o.userData.stickerId !== undefined) m.push([...o.matrixWorld.elements]); }); return m; };
    assert.deepEqual(stickers(plain.parent), stickers(uniform.parent));
  }
});

test("without the option the scene has no profile: unit pitch, centers at the layer coordinates", () => {
  const { parent, fr } = build(5, null);
  for (const shell of shells(parent)) {
    const id = shell.userData.sourceFaceStickerIds.find((x) => x !== null), p = fr.find((s) => s.id === id).p, box = boxOf(shell);
    for (let a = 0; a < 3; a++) near((box.min.getComponent(a) + box.max.getComponent(a)) / 2, p[a], 1e-9);
  }
});

test("core: centered, radius from the whole edge (N - 2) + 2 f, with the profile; unchanged without", () => {
  for (const [n, f] of CASES) {
    const fr = frames(n), parent = new THREE.Group(), widths = thickOuterLayerWidths(n, f);
    const geometry = { ...createPresentationGeometry(), body: unitBody() }, basic = new THREE.MeshStandardMaterial();
    new PhysicalCubeScene(parent, fr, new Map(fr.map((s) => [s.id, basic])), basic, 1, geometry, new Map(), { layers: { widths, body } });
    const core = parent.children.find((c) => c.userData.plasticCore);
    near(core.scale.x, ((n - 2 + 2 * f) / 2) * 0.8, 1e-9, "core radius");
    assert.deepEqual(core.position.toArray(), [0, 0, 0]);
    const plain = new THREE.Group();
    new PhysicalCubeScene(plain, fr, new Map(fr.map((s) => [s.id, basic])), basic, 1, { ...createPresentationGeometry(), body: unitBody() }, new Map());
    near(plain.children.find((c) => c.userData.plasticCore).scale.x, ((n - 1) / 2 + 0.5) * 0.8, 1e-9);
  }
});

test("sticker meshes lie on the face of their box and cover it in proportion (1 x f on a ring piece)", () => {
  const widths = thickOuterLayerWidths(7, 1.8), { parent, fr, scene } = build(7, widths);
  const s = fr.find((x) => x.p.join() === "0,3,3" && x.n.join() === "0,0,1"); // ring piece on the front face: 1 wide, 1.8 tall
  let mesh;
  parent.traverse((o) => { if (o.userData.stickerId === s.id) mesh = o; });
  near(mesh.position.z, 0.502 - 0.5 + 1.8 / 2, 1e-9);
  near(mesh.scale.x, 1, 1e-12);
  near(mesh.scale.y, 1.8, 1e-12);
  scene.dispose();
  assert.equal(parent.children.length, 0);
});

// ---- the miter on boxes of any proportion ----
const CLASSES = [];
for (const wx of [1, 1.8]) for (const wy of [1, 1.8]) for (const wz of [1, 1.8]) CLASSES.push([wx, wy, wz]);
test("miter: the uv diagonal of a square face is the body diagonal (to float32); of a rectangular face it deviates by under 0.025 uv (measured 0.0202 for 1 x 1.8) (in the flat part)", () => {
  let squares = 0, rects = 0;
  for (const cell of CLASSES) {
    const g = body(cell), pos = g.getAttribute("position"), uv = g.getAttribute("uv"), axes = faceUvAxes(g);
    for (let face = 0; face < 6; face++) {
      const group = g.groups.find((x) => x.materialIndex === face), a = face >> 1;
      const { uAxis, vAxis } = axes[face], L = (k) => cell[k] - GAP, flat = (k) => L(k) / 2 - R;
      // The flat corners of the face: where both tangent coordinates are +-flat; their uv gives the diagonal samples.
      const corner = (su, sv) => {
        for (let i = group.start; i < group.start + group.count; i++) {
          const v = g.index ? g.index.getX(i) : i;
          if (Math.abs(pos.getComponent(v, uAxis) - su * flat(uAxis)) < 1e-6 && Math.abs(pos.getComponent(v, vAxis) - sv * flat(vAxis)) < 1e-6 && Math.abs(Math.abs(pos.getComponent(v, a)) - L(a) / 2) < 1e-6) return [uv.getX(v), uv.getY(v)];
        }
        throw new Error("no corner vertex");
      };
      // Positions are measured in the axes' own signs; the uv of the four flat corners of the face
      const cs = [[1, 1], [-1, -1]].map(([su, sv]) => corner(su, sv));
      const square = Math.abs(L(uAxis) - L(vAxis)) < 1e-9;
      // The two diagonal corners (+,+) and (-,-) in position space map to uv points; the corner-to-corner line of the uv square is u = v (or u = 1 - v)
      const dev = cs.map(([u, v]) => Math.min(Math.abs(u - v), Math.abs(u - (1 - v))));
      if (square) { squares++; assert.ok(Math.max(...dev) < 1e-6, `${cell} face ${face}: square, dev ${dev}`); }
      else { rects++; assert.ok(Math.max(...dev) < 0.025, `${cell} face ${face}: rectangle, dev ${dev}`); }
    }
  }
  assert.ok(squares > 0 && rects > 0);
});

test("miter: under the profile every cut face that touches two exterior faces is f x f (square): the two exterior axes are both outer layers", () => {
  const widths = thickOuterLayerWidths(7, 1.8), { parent, fr } = build(7, widths);
  let checked = 0;
  for (const shell of shells(parent)) {
    const ids = shell.userData.sourceFaceStickerIds, box = boxOf(shell);
    const exteriorAxes = ids.map((id, i) => (id === null ? null : i >> 1)).filter((x) => x !== null);
    if (new Set(exteriorAxes).size < 2) continue;
    const size = [0, 1, 2].map((a) => box.max.getComponent(a) - box.min.getComponent(a));
    const [a, b] = [...new Set(exteriorAxes)];
    near(size[a], size[b], 1e-9, "the two exterior axes are equally thick");
    assert.ok(size[a] > 1.5);
    checked++;
  }
  assert.ok(checked > 0);
});

// ---- the miter in a scene with the profile: real vertices, real uv, real texture ----
const RED = "#e0282c", WHITE = "#fdfdfd", BODY = "#f0f0f0";
const FACE_INDEX = { "+x": 0, "-x": 1, "+y": 2, "-y": 3, "+z": 4, "-z": 5 };
const NAME = { "+x": [1, 0, 0], "-x": [-1, 0, 0], "+y": [0, 1, 0], "-y": [0, -1, 0], "+z": [0, 0, 1], "-z": [0, 0, -1] };
function miterScene(p, faces) {
  const widths = thickOuterLayerWidths(7, 1.8);
  const fr = faces.map(([name], k) => ({ id: k + 1, cubie: 1, p, n: NAME[name], up: upOf(NAME[name]) }));
  const mats = new Map(fr.map((f) => [f.id, new THREE.MeshStandardMaterial()]));
  const root = new THREE.Group();
  const geometry = { ...createPresentationGeometry(), body: unitBody() };
  const scene = new PhysicalCubeScene(root, fr, mats, createPlasticMaterial("#23272e", 0.55), 1, geometry, new Map(faces.map(([, c], k) => [k + 1, c])),
    { bodyColor: BODY, coreColor: BODY, miterCutFaces: true, layers: { widths, body } });
  scene.setConstruction("stickerless");
  const shell = root.children.find((c) => c.children[0]?.isMesh && Array.isArray(c.children[0].material)).children[0];
  return { shell, cell: p.map((c) => widths[c + 3]) };
}
/** Color of a cut face next to a neighbor face, read at a flat grid vertex on that edge (away from the corners), from the real texture. */
function colorNextTo(shell, cell, cutFace, neighbor) {
  const g = shell.geometry, pos = g.getAttribute("position"), uv = g.getAttribute("uv"), group = g.groups.find((x) => x.materialIndex === FACE_INDEX[cutFace]);
  const nAxis = FACE_INDEX[neighbor] >> 1, nSign = neighbor[0] === "+" ? 1 : -1, cutAxis = FACE_INDEX[cutFace] >> 1;
  const t = [0, 1, 2].find((a) => a !== cutAxis && a !== nAxis);
  const half = (k) => (cell[k] - GAP) / 2;
  let best = null;
  for (let i = group.start; i < group.start + group.count; i++) {
    const v = g.index ? g.index.getX(i) : i;
    if (pos.getComponent(v, nAxis) * nSign < half(nAxis) - 0.64 * R) continue;
    if (Math.abs(Math.abs(pos.getComponent(v, t)) - (half(t) - R)) > 1e-3) continue;
    best = { u: uv.getX(v), v: uv.getY(v) };
  }
  assert.ok(best, `${cutFace} next to ${neighbor}: a sample vertex`);
  const m = shell.material[FACE_INDEX[cutFace]];
  if (!m.map) return `#${m.color.getHexString()}`;
  const n = m.map.image.width, d = m.map.image.data;
  const x = Math.min(n - 1, Math.floor(best.u * n)), y = Math.min(n - 1, Math.floor(best.v * n)), i = (y * n + x) * 4;
  return `#${[0, 1, 2].map((k) => d[i + k].toString(16).padStart(2, "0")).join("")}`;
}
const close = (a, b) => [1, 3, 5].every((i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 2);
test("miter in the scene with the profile: the ring piece (1 x 1.8 x 1.8) and the corner piece (1.8 cube) split their square cut faces between the two exterior faces", () => {
  for (const [p, faces] of [[[0, 3, 3], [["+z", RED], ["+y", WHITE]]], [[-3, 3, 3], [["+z", RED], ["+y", WHITE]]], [[3, 3, 3], [["+y", WHITE], ["+z", RED]]]]) {
    const { shell, cell } = miterScene(p, faces);
    const cut = cell[0] === 1 ? "+x" : "-x"; // the face spanned by y and z (both 1.8) on the ring piece; on a corner any of them
    for (const c of [cut, "+x", "-x"]) {
      assert.ok(close(colorNextTo(shell, cell, c, "+z"), RED), `${p} ${c} next to the red face`);
      assert.ok(close(colorNextTo(shell, cell, c, "+y"), WHITE), `${p} ${c} next to the white face`);
    }
    // The face opposite the white face touches only the red one: all red.
    assert.ok(close(colorNextTo(shell, cell, "-y", "+x"), RED));
    assert.ok(close(colorNextTo(shell, cell, "-y", "-x"), RED));
  }
  // The pure rule on a rectangular box: the diagonal runs through the shared corner (1, 1) of the uv square, whatever the box.
  const two = [{ edge: "u1", color: RED }, { edge: "v1", color: WHITE }];
  assert.equal(cutColorAt(two, 0.9, 0.2), RED);
  assert.equal(cutColorAt(two, 0.2, 0.9), WHITE);
  const g = body([1, 1.8, 1.8]);
  assert.equal(cutFaceEdges(0, [null, null, WHITE, null, RED, null], faceUvAxes(g)).length, 2);
  assert.ok(paintCutPattern(two).length > 0);
});

test("disposal: every body geometry the profile factory made (one per cell size) is disposed with the scene", () => {
  const widths = thickOuterLayerWidths(7, 1.8), made = [], disposed = new Set();
  const recording = (cell) => { const g = body(cell); g.addEventListener("dispose", () => disposed.add(g)); made.push(g); return g; };
  const fr = frames(7), parent = new THREE.Group(), basic = new THREE.MeshStandardMaterial();
  const scene = new PhysicalCubeScene(parent, fr, new Map(fr.map((s) => [s.id, basic])), basic, 1, { ...createPresentationGeometry(), body: unitBody() }, new Map(), { layers: { widths, body: recording } });
  assert.equal(made.length, 7, "one geometry per cell size of a surface cubie: f or 1 in each axis, not 1 x 1 x 1");
  assert.equal(disposed.size, 0);
  scene.dispose();
  assert.equal(disposed.size, made.length, "all sized bodies are disposed");
});
