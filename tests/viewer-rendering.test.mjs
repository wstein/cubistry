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
    scene, presentation: scene, renderer, shared: true, busy: false, destroyed: false,
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

test("presentation reset preserves zoom, scramble, artwork and a live legal layer animation", async () => {
  const { rotatePresentation } = await import("../packages/cube-viewer/src/presentation-rotation.ts");
  const { stickerPoses, applyMoves, parseAlg } = await import("@cubistry/cube-mechanics");
  const design = createDesign("picture"), scrambled = applyMoves(initialState(design.print), parseAlg("R U2 F' L D"));
  const h = fixture(design, scrambled);
  // Exercise the standalone reset method on real configured geometry without WebGL.
  h.viewer.shared = false; h.viewer.camera = new THREE.PerspectiveCamera(18, 1, .1, 100);
  h.viewer.camera.position.set(0, 0, 19); h.viewer.camera.lookAt(0, 0, 0);
  h.viewer.radius = 14; h.viewer.yaw = -2; h.viewer.pitch = .8;
  rotatePresentation(h.scene, h.viewer.yaw, h.viewer.pitch);
  const physicalBefore = JSON.stringify({ print: h.viewer.presentedPrint, state: h.viewer.presentedState });
  const cameraBefore = { p: h.viewer.camera.position.toArray(), q: h.viewer.camera.quaternion.toArray() };
  const event = presentMove(scrambled, parseMove("R")), frames = [];
  const oldRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = cb => (frames.push(cb), frames.length);
  try {
    await withMotion(false, async () => {
      const animation = h.viewer.animate(event);
      assert(h.viewer.animating);
      const bodies = new Set(h.viewer.cube.bodies.values());
      const pivot = h.scene.children.find(o => !bodies.has(o));
      // A turn pivot and all its printed surfaces live inside the presentation parent.
      assert(pivot);
      assert.equal(pivot.parent, h.viewer.presentation);
      assert.equal(pivot.children.length, 4);
      h.viewer.resetCamera();
      assert.equal(h.viewer.radius, 14);
      assert.equal(JSON.stringify({ print: h.viewer.presentedPrint, state: h.viewer.presentedState }), physicalBefore);
      assert.deepEqual({ p: h.viewer.camera.position.toArray(), q: h.viewer.camera.quaternion.toArray() }, cameraBefore);
      rotatePresentation(h.scene, 1.4, -.9);
      frames.shift()(performance.now() + 40);
      const during = h.scene.quaternion.clone();
      frames.shift()?.(performance.now() + 200);
      await animation;
      assert(h.scene.quaternion.angleTo(during) < 1e-7, "a legal turn must not reset presentation orientation");
    });
    assert(stateEquals(h.viewer.presentedState, event.to));
    h.scene.updateMatrixWorld(true);
    const poses = stickerPoses(design.print, event.to), stickers = new Map();
    h.scene.traverse(o => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
    for (const pose of poses) {
      const object = stickers.get(pose.id), q = object.getWorldQuaternion(new THREE.Quaternion());
      const expectedNormal = new THREE.Vector3(...pose.n).applyQuaternion(h.scene.quaternion);
      const expectedUp = new THREE.Vector3(...pose.up).applyQuaternion(h.scene.quaternion);
      assert(new THREE.Vector3(0, 0, 1).applyQuaternion(q).distanceTo(expectedNormal) < 1e-6);
      assert(new THREE.Vector3(0, 1, 0).applyQuaternion(q).distanceTo(expectedUp) < 1e-6);
    }
  } finally {
    if (oldRAF) globalThis.requestAnimationFrame = oldRAF; else delete globalThis.requestAnimationFrame;
    h.viewer.shared = true; h.viewer.destroy();
  }
});

test("Calendar presentation reset and active 3x3 layer turns preserve every immutable print frame", async () => {
  const { CalendarViewer } = await import("../src/apps/calendar/viewer.ts");
  const { apply, validateDesign, sameState } = await import("../src/apps/calendar/model.ts");
  const { PhysicalCubeScene, createPresentationGeometry, rotatePresentation } = await import("@cubistry/cube-viewer");
  const pin = JSON.parse(readFileSync("calendar-source.json"));
  const design = validateDesign(JSON.parse(readFileSync("public/calendar/" + Object.keys(pin.runtime)[0])));
  const from = apply(design.printing, "R U' F2"), to = apply(from, "L");
  const root = new THREE.Group(), material = new THREE.MeshStandardMaterial();
  const cube = new PhysicalCubeScene(root, design.printing, new Map(design.printing.map(s => [s.id, material])), material, 1, createPresentationGeometry());
  cube.sync(from);
  const camera = new THREE.PerspectiveCamera(24, .5, .1, 100); camera.position.z = 30;
  const viewer = Object.assign(Object.create(CalendarViewer.prototype), {
    current: from, cube, presentation: root, camera, busy: false, duration: 100, yaw: 2, pitch: 1,
  });
  const initial = JSON.stringify({ print: design.printing, state: from });
  const frames = [], oldRAF = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = cb => (frames.push(cb), frames.length);
  try {
    await withMotion(false, async () => {
      const motion = viewer.animate(from, "L", to);
      viewer.resetReferenceView();
      assert.equal(JSON.stringify({ print: design.printing, state: viewer.presentedState }), initial);
      assert.deepEqual(camera.position.toArray(), [0, 0, 30]);
      rotatePresentation(root, -2.4, 1.1);
      frames.shift()(performance.now() + 50);
      const intermediate = root.quaternion.clone();
      frames.shift()?.(performance.now() + 200);
      await motion;
      assert(root.quaternion.angleTo(intermediate) < 1e-7);
    });
    assert(sameState(viewer.presentedState, to));
    root.updateMatrixWorld(true);
    const stickers = new Map(); root.traverse(o => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
    for (const pose of to) {
      const q = stickers.get(pose.id).getWorldQuaternion(new THREE.Quaternion());
      assert(new THREE.Vector3(0, 0, 1).applyQuaternion(q).distanceTo(new THREE.Vector3(...pose.n).applyQuaternion(root.quaternion)) < 1e-6);
      assert(new THREE.Vector3(0, 1, 0).applyQuaternion(q).distanceTo(new THREE.Vector3(...pose.up).applyQuaternion(root.quaternion)) < 1e-6);
    }
  } finally {
    if (oldRAF) globalThis.requestAnimationFrame = oldRAF; else delete globalThis.requestAnimationFrame;
    cube.dispose(); material.dispose();
  }
});

test("presentation rotations leave exact-target solver inputs, output and full-state replay unchanged", async () => {
  const { prepareTestSolver } = await import("./helpers/shared-solver.mjs");
  const { applyMoves, parseAlg } = await import("@cubistry/cube-mechanics");
  const { rotatePresentation } = await import("@cubistry/cube-viewer");
  const design = createDesign("picture"), target = initialState(design.print);
  const state = applyMoves(target, parseAlg("R U2 F' L D")), solver = await prepareTestSolver(design.print);
  const h = fixture(design, state), before = JSON.stringify({ print: design.print, state, target });
  const first = solver.solve(state, target);
  for (let i = 0; i < 1000; i++) rotatePresentation(h.scene, Math.sin(i) * Math.PI, Math.cos(i) * 1.5);
  assert.deepEqual(solver.solve(state, target), first);
  assert(stateEquals(applyMoves(state, first), target));
  assert.equal(JSON.stringify({ print: design.print, state, target }), before);
  assert(stateEquals(h.viewer.presentedState, state));
  h.viewer.destroy();
});

test("real shared viewport construction rotates all three placements rigidly about their common center", async () => {
  const { ClockStage } = await import("../src/apps/clock/stage.ts");
  const { rotatePresentation } = await import("@cubistry/cube-viewer");
  const scene = new THREE.Scene(), presentation = new THREE.Group(); scene.add(presentation);
  const camera = new THREE.PerspectiveCamera(), renderer = {};
  const stage = Object.assign(Object.create(ClockStage.prototype), {
    scene, presentation, camera, renderer, cubes: [], appearanceControls: { setDefaultColor() {} },
    appearance: { construction: "stickered", frameColor: null },
  });
  const cubes = [0, 1, 2].map(i => stage.createCube({}, i));
  assert.equal(scene.children.length, 1);
  assert.equal(presentation.children.length, 3);
  for (const cube of cubes) {
    assert.equal(cube.scene.parent, presentation); assert.equal(cube.presentation, cube.scene);
    assert.equal(cube.camera, camera); assert.equal(cube.renderer, renderer);
    assert.deepEqual(cube.scene.quaternion.toArray(), [0, 0, 0, 1]);
  }
  for (const [yaw, pitch] of [[0, 0], [Math.PI, 0], [-Math.PI / 2, 1.4], [1.2, -.9]]) {
    rotatePresentation(presentation, yaw, pitch); scene.updateMatrixWorld(true);
    const centers = cubes.map(c => c.scene.getWorldPosition(new THREE.Vector3()));
    assert(centers[1].length() < 1e-12);
    assert(Math.abs(centers[0].distanceTo(centers[2]) - 5.6) < 1e-12);
    assert(centers[0].clone().add(centers[2]).length() < 1e-12);
    centers.forEach((point, i) => {
      assert(point.distanceTo(new THREE.Vector3((i - 1) * 2.8, 0, 0).applyQuaternion(presentation.quaternion)) < 1e-12);
      assert.deepEqual(cubes[i].scene.position.toArray(), [(i - 1) * 2.8, 0, 0]);
    });
  }
  cubes.forEach(c => c.destroy()); assert.equal(presentation.children.length, 0);
});
