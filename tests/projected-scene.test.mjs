// SPDX-License-Identifier: AGPL-3.0-or-later
// PhysicalCubeScene.setPictureProjection: the Projected picture mode on the physical scene. One texture per face, a UV window
// per sticker (a texture transform, no prerendered tiles), the image reaches the face edge (no margin, no mask), the image stays on its sticker when
// layers turn, stickered and stickerless constructions, uniform and layer-width profiles. No WebGL is needed.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import {
  PhysicalCubeScene, createPresentationGeometry, thickOuterLayerWidths, layerCenters,
} from "@cubistry/cube-viewer";
import { PROJECTED_FACES, FACE_KEYS } from "../packages/cube-viewer/src/projected-uv.ts";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const NORMALS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
const faceOf = (n) => FACE_KEYS.find((k) => PROJECTED_FACES[k].normal.every((c, i) => c === n[i]));

/** Sticker frames of the n-cube with the cube model's face frames (up of U is -z, of D is +z). */
function frames(n, double = false) {
  const h = (n - 1) / 2, k = double ? 2 : 1, out = [], ids = new Map();
  for (let x = -h; x <= h; x++) for (let y = -h; y <= h; y++) for (let z = -h; z <= h; z++) {
    const p = [x * k, y * k, z * k];
    for (const normal of NORMALS) {
      const a = normal.findIndex((c) => c !== 0);
      if (p[a] * normal[a] !== h * k) continue;
      const key = p.join();
      if (!ids.has(key)) ids.set(key, ids.size + 1);
      out.push({ id: out.length + 1, cubie: ids.get(key), p, n: normal, up: PROJECTED_FACES[faceOf(normal)].up });
    }
  }
  return out;
}
const GAP = 0.01;
const unitBody = () => new RoundedBoxGeometry(1 - GAP, 1 - GAP, 1 - GAP, 1, 0.055);
const profileBody = (cell) => new RoundedBoxGeometry(cell[0] - GAP, cell[1] - GAP, cell[2] - GAP, 1, 0.055);

function faceTextures() {
  const faces = new Map();
  for (const k of FACE_KEYS) {
    const t = new THREE.Texture({ width: 8, height: 8 }); t.flipY = false; t.version = 1; faces.set(k, t);
  }
  return faces;
}
function build(n, { widths, double = false, plastic = new THREE.MeshPhysicalMaterial({ color: "#1b2431" }), colors } = {}) {
  const fr = frames(n, double), parent = new THREE.Group();
  const geometry = { ...createPresentationGeometry(double ? 2 : undefined), body: unitBody() };
  const originals = new Map(fr.map((s) => { const m = new THREE.MeshPhysicalMaterial({ color: "#ffffff" }); m.map = new THREE.Texture({ width: 2, height: 2 }); return [s.id, m]; }));
  const scene = new PhysicalCubeScene(parent, fr, originals, plastic, double ? 0.5 : 1, geometry, colors ?? new Map(fr.map((s) => [s.id, "#fffdf6"])),
    widths ? { layers: { widths, body: profileBody } } : {});
  scene.sync(fr); parent.updateMatrixWorld(true);
  const stickers = new Map(); parent.traverse((o) => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
  return { scene, parent, fr, originals, stickers, plastic };
}
const centersOf = (n, widths) => layerCenters(widths ?? Array(n).fill(1));

test("projected stickers: one clone of the face texture per sticker, sharing the face's image; the window is the sticker's own", () => {
  for (const [n, double] of [[2, false], [2, true], [3, false], [5, false], [7, false]]) {
    const { scene, fr, stickers, originals } = build(n, { double }), faces = faceTextures(), k = double ? 2 : 1;
    scene.setPictureProjection({ faces });
    const widths = Array(n).fill(1), IMG = n, c = centersOf(n, widths), h = (n - 1) / 2;
    for (const s of fr) {
      const mesh = stickers.get(s.id), map = mesh.material.map, face = faceOf(s.n), { up } = PROJECTED_FACES[face];
      assert.notEqual(mesh.material, originals.get(s.id), "a projected material replaces the tile material");
      assert.equal(map.source, faces.get(face).source, `${n} sticker ${s.id}: the face's own image, no per-sticker bitmap`);
      assert.notEqual(map, faces.get(face), "a clone carries the sticker's transform; the shared face texture is untouched");
      const right = [up[1] * s.n[2] - up[2] * s.n[1], up[2] * s.n[0] - up[0] * s.n[2], up[0] * s.n[1] - up[1] * s.n[0]];
      const w = s.p.map((v) => Math.round(v / k + h)); // layer index along each world axis
      const world = w.map((i) => c[i]);
      const cRight = world[0] * right[0] + world[1] * right[1] + world[2] * right[2];
      const cUp = world[0] * up[0] + world[1] * up[1] + world[2] * up[2];
      near(map.repeat.x, 0.87 / IMG, 1e-12, "repeat x"); near(map.repeat.y, 0.87 / IMG, 1e-12, "repeat y");
      near(map.offset.x, (cRight - 0.435) / IMG + 0.5, 1e-9, `${n} ${face} offset x`);
      near(map.offset.y, (cUp - 0.435) / IMG + 0.5, 1e-9, `${n} ${face} offset y`);
    }
    // the six face textures are the only images: every clone points at one of them
    const sources = new Set(FACE_KEYS.map((k) => faces.get(k).source));
    for (const mesh of stickers.values()) assert.ok(sources.has(mesh.material.map.source));
    scene.dispose();
  }
});

test("the image stays on the sticker when layers turn: windows and materials do not change; stickers move with their bodies", () => {
  const { scene, fr, stickers, parent } = build(3), faces = faceTextures();
  scene.setPictureProjection({ faces });
  const before = new Map([...stickers].map(([id, m]) => [id, [m.material, m.material.map.offset.toArray(), m.material.map.repeat.toArray()]]));
  const moved = fr.filter((s) => s.p[0] === 1).map((s) => s.cubie);
  const turn = scene.beginTurn([...new Set(moved)], 0, Math.PI / 2); turn.update(1); turn.dispose();
  // pose after R: rotate the frames about x like the mechanics would, then sync
  const rot = (v) => [v[0], -v[2], v[1]];
  const after = fr.map((s) => (s.p[0] === 1 ? { ...s, p: rot(s.p), n: rot(s.n), up: rot(s.up) } : s));
  scene.sync(after); parent.updateMatrixWorld(true);
  for (const [id, m] of stickers) {
    assert.equal(m.material, before.get(id)[0]); assert.deepEqual(m.material.map.offset.toArray(), before.get(id)[1]); assert.deepEqual(m.material.map.repeat.toArray(), before.get(id)[2]);
  }
  const s = after.find((x) => x.p[0] === 1 && x.n[0] !== 1);
  const mesh = stickers.get(s.id), w = new THREE.Vector3(); mesh.getWorldPosition(w);
  near(w.x, 1, 1e-9, "a sticker of the turned layer is still on the turned layer");
  scene.dispose();
});

test("only stickers carry the image: bodies keep the plastic; projected stickers are white and unmasked (the outline is the sticker geometry)", () => {
  const plastic = new THREE.MeshPhysicalMaterial({ color: "#1b2431" });
  const { scene, parent, stickers, originals } = build(3, { plastic }), faces = faceTextures();
  for (const m of originals.values()) m.color.set("#fffdf6");
  scene.setPictureProjection({ faces });
  parent.traverse((o) => { if (o.userData.sourceFaceStickerIds) assert.equal(o.material, plastic, "stickered: the body is plain plastic"); });
  for (const mesh of stickers.values()) {
    const material = mesh.material, shader = { uniforms: {}, fragmentShader: "void main(){\n#include <map_fragment>\n}" };
    assert.equal(material.color.getHexString(), "ffffff", "a white sticker: the image is not tinted");
    material.onBeforeCompile(shader, null);
    assert.equal(shader.fragmentShader, "void main(){\n#include <map_fragment>\n}", "no rectangular mask or plastic mix in the shader");
    assert.equal(shader.uniforms.projectedOutside, undefined, "no outside color");
  }
  scene.dispose();
});

test("no margin: every point of every sticker and body face samples inside the image (texture coordinates within 0..1)", () => {
  for (const [n, widths] of [[2, undefined], [3, undefined], [7, undefined], [7, thickOuterLayerWidths(7, 1.8)]]) {
    const { scene, parent, fr, stickers } = build(n, widths ? { widths } : {}), faces = faceTextures();
    scene.setConstruction("stickerless");
    scene.setPictureProjection({ faces });
    const inside = (map, what) => {
      for (const [u, v] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        const tu = map.offset.x + map.repeat.x * u, tv = map.offset.y + map.repeat.y * v;
        assert.ok(tu >= -1e-12 && tu <= 1 + 1e-12 && tv >= -1e-12 && tv <= 1 + 1e-12, `${what} corner ${u},${v}: ${tu},${tv}`);
      }
    };
    for (const s of fr) inside(stickers.get(s.id).material.map, `${n} sticker ${s.id}`);
    let bodies = 0;
    parent.traverse((o) => { const ids = o.userData.sourceFaceStickerIds; if (ids) ids.forEach((id, i) => { if (id !== null) { bodies++; inside(o.material[i].map, `${n} body ${id}`); } }); });
    assert.equal(bodies, fr.length);
    scene.dispose();
  }
});

test("switching back to Per sticker restores the tile materials exactly and releases the clones; switching again works", () => {
  const { scene, stickers, originals, fr } = build(3), faces = faceTextures();
  scene.setPictureProjection({ faces });
  const clones = [...stickers.values()].map((m) => m.material.map);
  let disposed = 0; for (const t of clones) t.addEventListener("dispose", () => disposed++);
  scene.setPictureProjection(null);
  for (const s of fr) assert.equal(stickers.get(s.id).material, originals.get(s.id));
  assert.equal(disposed, clones.length, "clones are released");
  for (const t of faces.values()) assert.equal(t.version, 1, "the shared face textures are not re-uploaded");
  scene.setPictureProjection({ faces });
  assert.notEqual(stickers.get(fr[0].id).material, originals.get(fr[0].id));
  scene.dispose();
});

test("stickerless: the exterior body faces carry the same window; the body is white with the image (no mask)", () => {
  const colors = new Map(); const { scene, parent, fr } = build(3, { colors });
  scene.setConstruction("stickerless");
  const faces = faceTextures(); scene.setPictureProjection({ faces });
  let count = 0;
  parent.traverse((o) => {
    const ids = o.userData.sourceFaceStickerIds; if (!ids) return;
    ids.forEach((id, index) => {
      if (id === null) return;
      count++;
      const s = fr.find((x) => x.id === id), map = o.material[index].map, face = faceOf(s.n);
      assert.equal(map.source, faces.get(face).source);
      near(map.repeat.x, 0.99 / 3, 1e-12, "body share 0.99 over the same image");
      assert.equal(o.material[index].color.getHexString(), "ffffff", "the body face is white under the image");
      assert.equal(o.material[index].onBeforeCompile.toString().includes("projectedIn"), false, "no mask patch");
    });
  });
  assert.equal(count, fr.length);
  scene.setPictureProjection(null);
  parent.traverse((o) => { const ids = o.userData.sourceFaceStickerIds; if (ids) ids.forEach((id, index) => { if (id !== null) assert.notEqual(o.material[index].map?.source, faces.get("F").source); }); });
  scene.dispose();
});

test("layer-width profile: windows follow the real cell centers and widths; face extent is the summed widths", () => {
  for (const [n, f] of [[5, 1.2], [7, 1.8]]) {
    const widths = thickOuterLayerWidths(n, f), c = layerCenters(widths);
    const { scene, fr, stickers } = build(n, { widths }), faces = faceTextures();
    scene.setPictureProjection({ faces });
    const IMG = widths.reduce((a, b) => a + b, 0), h = (n - 1) / 2;
    for (const s of fr) {
      const map = stickers.get(s.id).material.map, face = faceOf(s.n), { up } = PROJECTED_FACES[face];
      const right = [up[1] * s.n[2] - up[2] * s.n[1], up[2] * s.n[0] - up[0] * s.n[2], up[0] * s.n[1] - up[1] * s.n[0]];
      const idx = s.p.map((v) => v + h), world = idx.map((i) => c[i]);
      const ax = (d) => d.findIndex((v) => v !== 0);
      const wR = widths[idx[ax(right)]], wU = widths[idx[ax(up)]];
      const cRight = world[0] * right[0] + world[1] * right[1] + world[2] * right[2], cUp = world[0] * up[0] + world[1] * up[1] + world[2] * up[2];
      near(map.repeat.x, 0.87 * wR / IMG, 1e-12, `${n} repeat x`); near(map.repeat.y, 0.87 * wU / IMG, 1e-12, `${n} repeat y`);
      near(map.offset.x, (cRight - 0.87 * wR / 2) / IMG + 0.5, 1e-9, `${n} offset x`);
      near(map.offset.y, (cUp - 0.87 * wU / 2) / IMG + 0.5, 1e-9, `${n} offset y`);
    }
    scene.dispose();
  }
});

test("a frame that is not the cube model's face frame is refused; a missing face texture is refused", () => {
  const { scene, fr } = build(2, { double: true }), faces = faceTextures();
  assert.equal(fr.length, 24);
  faces.delete("U");
  assert.throws(() => scene.setPictureProjection({ faces }), /face image/i);
  const bad = build(3);
  const fr2 = frames(3).map((s) => (s.n[1] === 1 ? { ...s, up: [0, 0, 1] } : s));
  const parent = new THREE.Group(), geometry = { ...createPresentationGeometry(), body: unitBody() };
  const m = new THREE.MeshStandardMaterial();
  const odd = new PhysicalCubeScene(parent, fr2, new Map(fr2.map((s) => [s.id, m])), m, 1, geometry);
  assert.throws(() => odd.setPictureProjection({ faces: faceTextures() }), /face frame/i);
  bad.scene.dispose(); odd.dispose(); scene.dispose();
});

test("round trip in the stickerless construction: after Per sticker the body faces have their own color and map back, no stale white", () => {
  const { scene, parent, originals } = build(2, { colors: new Map(frames(2).map((s) => [s.id, "#336699"])) });
  for (const m of originals.values()) m.map = null; // plain colored stickers: the body color is the face color
  scene.setConstruction("stickerless");
  const read = () => { const out = []; parent.traverse((o) => { const ids = o.userData.sourceFaceStickerIds; if (ids) ids.forEach((id, i) => { if (id !== null) out.push([o.material[i].color.getHexString(), o.material[i].map?.source?.uuid ?? null]); }); }); return out; };
  const before = read();
  scene.setPictureProjection({ faces: faceTextures() });
  scene.setPictureProjection(null);
  assert.equal(before.length, 24); assert.equal(before[0][0], "336699");
  assert.deepEqual(read(), before);
  scene.dispose();
});
