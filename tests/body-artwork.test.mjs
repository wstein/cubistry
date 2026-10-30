import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { cross, dot } from "@cubistry/cube-core";
import { orientBodyArtwork, sourceFaceIndex } from "../packages/cube-viewer/src/body-artwork.ts";
import { createPresentationGeometry, PRESENTATION_PRESET as preset } from "../packages/cube-viewer/src/presentation-preset.ts";
import { PhysicalCubeScene } from "../packages/cube-viewer/src/physical-scene.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { stickerPoses, initialState } from "@cubistry/cube-mechanics";
const axes = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
const near = (actual, expected) => assert(Math.abs(actual - expected) < 1e-6, `${actual} != ${expected}`);

test("rounded artwork preserves all six physical image orientations and all four source-up rotations with full bevel UV endpoints", () => {
  const geometry = createPresentationGeometry(), base = geometry.body;
  const material = new THREE.MeshStandardMaterial();
  const planarAndArcLength = preset.bodyWidth - 2 * preset.bodyRadius + Math.PI * preset.bodyRadius / 2;
  for (const n of axes) for (const up of axes.filter(up => dot(up, n) === 0)) {
    const mapped = orientBodyArtwork(base, [{ n, up }]), index = sourceFaceIndex(n);
    assert.deepEqual(mapped.getAttribute("position").array, base.getAttribute("position").array);
    assert.deepEqual(mapped.getAttribute("normal").array, base.getAttribute("normal").array);
    const group = mapped.groups.find(group => group.materialIndex === index), uv = mapped.getAttribute("uv");
    const us = [], vs = [];
    for (let i = group.start; i < group.start + group.count; i++) { us.push(uv.getX(i)); vs.push(uv.getY(i)); }
    near(Math.min(...us), 0); near(Math.max(...us), 1);
    near(Math.min(...vs), 0); near(Math.max(...vs), 1);
    const mesh = new THREE.Mesh(mapped, Array(6).fill(material)); mesh.updateMatrixWorld();
    const right = cross(up, n);
    // Asymmetric off-center samples distinguish every rotation and mirror,
    // including top/bottom/back faces. Expected UV uses the rounded arc length.
    for (const [x, y] of [[.2,.1],[-.2,.1],[.2,-.1],[-.2,-.1]]) {
      const origin = new THREE.Vector3(...n).multiplyScalar(.8)
        .addScaledVector(new THREE.Vector3(...right), x).addScaledVector(new THREE.Vector3(...up), y);
      const hits = new THREE.Raycaster(origin, new THREE.Vector3(...n).negate()).intersectObject(mesh);
      assert(hits.length > 0); assert.equal(hits[0].face.materialIndex, index);
      near(hits[0].uv.x, .5 + x / planarAndArcLength);
      near(hits[0].uv.y, .5 + y / planarAndArcLength);
    }
    if (mapped !== base) mapped.dispose();
  }
  for (const key of ["body", "core", "sticker"]) geometry[key].dispose(); material.dispose();
});
test("adjacent landscape tiles meet at exact original image edges around each rounded face", () => {
  const { print } = createDesign("picture"), geometry = createPresentationGeometry();
  for (const s of print.stickers) {
    const body = orientBodyArtwork(geometry.body, [{ n: s.normal, up: s.up }]);
    const group = body.groups.find(group => group.materialIndex === sourceFaceIndex(s.normal));
    const uv = body.getAttribute("uv"), values = [];
    for (let i = group.start; i < group.start + group.count; i++) values.push([uv.getX(i), uv.getY(i)]);
    const [face, row, col] = s.assetId.split("_");
    assert(["F","B","R","L","U","D"].includes(face));
    const fullU = values.map(([u]) => (Number(col) + u) / 2);
    const fullV = values.map(([,v]) => (1 - Number(row) + v) / 2);
    near(Math.min(...fullU), Number(col) / 2); near(Math.max(...fullU), (Number(col) + 1) / 2);
    near(Math.min(...fullV), (1 - Number(row)) / 2); near(Math.max(...fullV), (2 - Number(row)) / 2);
    if (body !== geometry.body) body.dispose();
  }
  for (const key of ["body", "core", "sticker"]) geometry[key].dispose();
});
test("configure-time artwork geometry variants are bounded, reused across toggles and disposed once", () => {
  const { print } = createDesign("picture");
  const source = stickerPoses(print, initialState(print)).map(s => {
    let up = s.up; for (let q = 0; q < s.cubie % 4; q++) up = cross(s.n, up);
    return { ...s, up };
  });
  const parent = new THREE.Group(), geometry = createPresentationGeometry();
  const plastic = new THREE.MeshPhysicalMaterial(), texture = new THREE.Texture();
  const art = new THREE.MeshStandardMaterial({ map: texture });
  const scene = new PhysicalCubeScene(parent, source, new Map(source.map(s => [s.id, art])), plastic,
    .5, geometry);
  scene.sync(source);
  const collect = () => {
    const geometries = new Set(); parent.traverse(o => { if (o.isMesh) geometries.add(o.geometry); }); return geometries;
  };
  const configured = collect();
  assert(configured.size <= print.cubies.length + 3);
  for (let i = 0; i < 10; i++) { scene.setConstruction("stickerless"); scene.setConstruction("stickered"); }
  assert.deepEqual(collect(), configured);
  const owned = new Set([...configured, geometry.body, geometry.core, geometry.sticker]);
  let disposed = 0, textures = 0;
  for (const item of owned) item.addEventListener("dispose", () => disposed++);
  texture.addEventListener("dispose", () => textures++);
  scene.dispose(); assert.equal(disposed, owned.size); assert.equal(textures, 0);
  art.dispose(); plastic.dispose(); texture.dispose();
});

test("rounded surface refresh follows null-to-image shader changes without taking texture ownership", () => {
  const { print } = createDesign("picture"), source = stickerPoses(print, initialState(print));
  const parent = new THREE.Group(), geometry = createPresentationGeometry();
  const plastic = new THREE.MeshPhysicalMaterial(), art = new THREE.MeshStandardMaterial({ color: "#ffffff" });
  const scene = new PhysicalCubeScene(parent, source, new Map(source.map(s => [s.id, art])), plastic,
    .5, geometry);
  scene.setConstruction("stickerless");
  const surfaces = [];
  parent.traverse(o => {
    const ids = o.userData.sourceFaceStickerIds;
    if (ids) ids.forEach((id, index) => { if (id !== null) surfaces.push(o.material[index]); });
  });
  const versions = surfaces.map(s => s.version), texture = new THREE.Texture();
  art.map = texture; art.color.set("#fedcba"); scene.refreshArtwork();
  surfaces.forEach((surface, i) => {
    assert.equal(surface.map, texture); assert.equal(surface.color.getHexString(), "fedcba");
    assert(surface.version > versions[i]);
  });
  art.map = null; scene.refreshArtwork();
  for (const surface of surfaces) assert.equal(surface.map, null);
  let disposed = 0; texture.addEventListener("dispose", () => disposed++);
  scene.dispose(); assert.equal(disposed, 0);
  art.dispose(); plastic.dispose(); texture.dispose();
});
