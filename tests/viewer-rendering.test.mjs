import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { readFileSync } from "node:fs";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { validateCertifiedCounter } from "../src/apps/counter/certified.ts";
import { overriddenSticker } from "../packages/cube-viewer/src/facelet-image.ts";
import { CubeViewer } from "@cubistry/cube-viewer";
import { createDesign } from "../src/apps/playground/model.ts";
import { initialState, presentMove, parseMove } from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";

// Exercise real configure/animate/destroy methods without a browser or WebGL.
// The shared viewport owns the renderer; these methods need only a Three scene.
function fixture(design = createDesign("picture"), state = initialState(design.print)) {
  const stage = new THREE.Scene(), scene = new THREE.Group();
  scene.position.set(2.8, 0, 0); stage.add(scene);
  const renderer = { dispose() { throw Error("shared renderer ownership violated"); } };
  const viewer = Object.assign(Object.create(CubeViewer.prototype), {
    scene, renderer, shared: true, busy: false, destroyed: false,
    materials: [], textures: [], stickerMaterials: new Map(),
    animationSpeed: 1, durationUnit: "move",
  });
  const assets = { textureOrigin: "bottom-left",
    images: new Map(design.assets.images.map(image => [image.id, { width: 64, height: 64 }])),
    materials: new Map(design.assets.materials.map(material => [material.id, material])) };
  viewer.configure(design.print, state, assets);
  return { viewer, design, state, assets, scene, stage };
}
async function withMotion(reduced, action) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "matchMedia");
  Object.defineProperty(globalThis, "matchMedia", {
    value: () => ({ matches: reduced }), configurable: true,
  });
  try { await action(); }
  finally {
    if (previous) Object.defineProperty(globalThis, "matchMedia", previous);
    else delete globalThis.matchMedia;
  }
}
test("reconfiguration disposes old shared geometry, materials and images without losing stage placement", () => {
  const h = fixture(), geometries = new Set(), materials = new Set(), textures = new Set();
  h.scene.traverse(object => {
    if (object.isMesh) {
      geometries.add(object.geometry); materials.add(object.material);
      if (object.material.map) textures.add(object.material.map);
    }
  });
  assert.equal(geometries.size, 3);
  let disposedGeometry = 0, disposedMaterial = 0, disposedTexture = 0;
  for (const geometry of geometries) geometry.addEventListener("dispose", () => disposedGeometry++);
  for (const material of materials) material.addEventListener("dispose", () => disposedMaterial++);
  for (const texture of textures) texture.addEventListener("dispose", () => disposedTexture++);
  h.viewer.configure(h.design.print, h.state, h.assets);
  assert.equal(disposedGeometry, geometries.size);
  assert.equal(disposedMaterial, materials.size);
  assert.equal(disposedTexture, textures.size);
  assert.deepEqual(h.scene.position.toArray(), [2.8, 0, 0]);
  assert.equal(h.scene.children.length, 8);
  h.viewer.destroy(); h.viewer.destroy();
  assert.equal(h.stage.children.length, 0);
});
test("timing rejection restores authoritative presentation and allows the next legal move", async () => {
  await withMotion(false, async () => {
    const h = fixture(), event = presentMove(h.state, parseMove("R"));
    await assert.rejects(h.viewer.animate(event, () => { throw Error("timing failure"); }), /timing failure/);
    assert.equal(h.viewer.animating, false);
    assert(stateEquals(h.viewer.presentedState, h.state));
    assert.equal(h.scene.children.length, 8);
    // No pending RAF is scheduled when the timing source rejects on entry.
    await withMotion(true, async () => { await h.viewer.animate(event); });
    assert(stateEquals(h.viewer.presentedState, event.to));
    assert.equal(h.viewer.animating, false);
    h.viewer.destroy();
  });
});
test("reduced motion still commits exactly the caller-validated legal endpoint", async () => {
  await withMotion(true, async () => {
    const h = fixture(), event = presentMove(h.state, parseMove("U2"));
    await h.viewer.animate(event);
    assert(stateEquals(h.viewer.presentedState, event.to));
    assert.equal(h.scene.children.length, 8);
    await assert.rejects(h.viewer.animate(event), /out of sync/);
    assert(stateEquals(h.viewer.presentedState, event.to));
    h.viewer.destroy();
  });
});


test("Stickerless rounded surfaces follow the existing leading-zero image override through turns, reset and construction toggles", async () => {
  const design = validateCounterDesign(JSON.parse(readFileSync("public/counter-design.v2.json")));
  const route = validateCertifiedCounter(JSON.parse(readFileSync("public/counter-certified.v1.json")), design);
  const h = fixture({ print: route.print, assets: design.assets }, route.states[0]);
  const before = JSON.stringify({ print: route.print, state: route.states[0] });
  const rule = { position: [-1, -1, 1], normal: [0, 0, 1], sourceAssetId: "0", replacementAssetId: "blank" };
  const verify = active => {
    const selected = overriddenSticker(route.print, h.viewer.presentedState, active);
    const surfaces = new Map(), overlays = new Map();
    h.scene.traverse(object => {
      const ids = object.userData.sourceFaceStickerIds;
      if (ids) ids.forEach((id, index) => { if (id !== null) surfaces.set(id, object.material[index]); });
      if (object.userData.stickerId !== undefined) overlays.set(object.userData.stickerId, object);
    });
    for (const s of route.print.stickers) {
      const expected = h.viewer.imageMaps.get(s.id === selected ? "blank" : s.assetId);
      assert.equal(surfaces.get(s.id).map, expected);
      assert.equal(overlays.get(s.id).material.map, expected);
      assert.equal(overlays.get(s.id).visible, false);
    }
  };
  h.viewer.setAppearance({ construction: "stickerless", frameColor: "#00aabb" });
  verify(null); h.viewer.setFaceletImageOverride(rule); verify(rule);
  const event = presentMove(h.viewer.presentedState, parseMove("L"));
  await withMotion(false, async () => {
    await assert.rejects(h.viewer.animate(event, () => {
      h.viewer.setFaceletImageOverride(null); verify(null);
      h.viewer.setFaceletImageOverride(rule); verify(rule);
      throw Error("interrupted after image refresh");
    }), /interrupted after image refresh/);
  });
  assert(stateEquals(h.viewer.presentedState, route.states[0])); verify(rule);
  h.viewer.setAppearance({ construction: "stickered", frameColor: "#00aabb" });
  h.viewer.setFaceletImageOverride(null);
  h.viewer.setAppearance({ construction: "stickerless", frameColor: "#00aabb" }); verify(null);
  h.viewer.setFaceletImageOverride(rule);
  await withMotion(true, async () => { await h.viewer.animate(event); }); verify(rule);
  h.viewer.setFaceletImageOverride(null); verify(null);
  assert.equal(JSON.stringify({ print: route.print, state: route.states[0] }), before);
  h.viewer.destroy();
});
