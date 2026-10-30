import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPresentationStudio, STUDIO_BACKGROUND } from "../packages/cube-viewer/src/studio.ts";
import { createPresentationGeometry, PRESENTATION_PRESET } from "../packages/cube-viewer/src/presentation-preset.ts";
import { PhysicalCubeScene } from "../packages/cube-viewer/src/physical-scene.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { stickerPoses, initialState } from "@cubistry/cube-mechanics";

function projectedShadow(scene, light, floorY) {
  scene.updateMatrixWorld(true);
  light.shadow.updateMatrices(light);
  const direction = light.target.getWorldPosition(new THREE.Vector3())
    .sub(light.getWorldPosition(new THREE.Vector3())).normalize();
  const bounds = new THREE.Box2();
  scene.traverse(object => {
    if (!object.isMesh || !object.castShadow || !object.visible) return;
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld);
      point.addScaledVector(direction, (floorY - point.y) / direction.y);
      const ndc = point.clone().project(light.shadow.camera);
      assert(Math.abs(ndc.x) <= 1 && Math.abs(ndc.y) <= 1 && ndc.z > -1 && ndc.z < 1,
        "shadow receiver projection exceeds the shared key's bounded frustum");
      bounds.expandByPoint(new THREE.Vector2(point.x, point.z));
    }
  });
  return bounds;
}
test("one studio rig casts actual moving three-cube geometry onto a bounded soft-shadow receiver", () => {
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 4.3);
  const { print } = createDesign("picture"), poses = stickerPoses(print, initialState(print));
  const material = new THREE.MeshStandardMaterial();
  const cubes = [-2.8, 0, 2.8].map(x => {
    const group = new THREE.Group(); group.position.x = x; scene.add(group);
    const adapter = new PhysicalCubeScene(group, poses,
      new Map(poses.map(s => [s.id, material])), material, .5, createPresentationGeometry());
    adapter.sync(poses); return { adapter, group };
  });
  const shadowLights = scene.children.filter(object => object.isLight && object.castShadow);
  assert.equal(shadowLights.length, 1);
  assert.equal(studio.floor.receiveShadow, true);
  assert(studio.floor.position.y < -Math.SQRT2);
  for (const construction of ["stickered", "stickerless"]) {
    for (const cube of cubes) cube.adapter.setConstruction(construction);
    const before = projectedShadow(scene, shadowLights[0], studio.floor.position.y);
    const ids = poses.filter(s => s.p[1] === 1).map(s => s.cubie);
    const turn = cubes[2].adapter.beginTurn([...new Set(ids)], 1, Math.PI / 2);
    turn.update(.5);
    const during = projectedShadow(scene, shadowLights[0], studio.floor.position.y);
    assert(!before.equals(during), `${construction}: a layer must change the geometric shadow silhouette`);
    turn.dispose(); cubes[2].adapter.sync(poses);
    assert(projectedShadow(scene, shadowLights[0], studio.floor.position.y).equals(before));
  }
  let geometries = 0, materials = 0;
  studio.floor.geometry.addEventListener("dispose", () => geometries++);
  studio.floor.material.addEventListener("dispose", () => materials++);
  for (const cube of cubes) { cube.adapter.dispose(); cube.group.removeFromParent(); }
  studio.dispose(); material.dispose();
  assert.deepEqual([geometries, materials, scene.children.length], [1, 1, 0]);
});
test("studio ground does not occlude below-floor orbit and backdrop remains warm/responsive", () => {
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1.5);
  assert.equal(studio.floor.material.isShadowMaterial, true);
  assert.equal(studio.floor.material.transparent, true);
  assert.equal(studio.floor.material.depthWrite, false);
  assert.equal(studio.floor.material.opacity, PRESENTATION_PRESET.shadowOpacity);
  assert(studio.floor.material.opacity > 0 && studio.floor.material.opacity < .35);
  assert.equal(studio.floor.position.y, -Math.SQRT2 * 1.5 - .08);
  scene.updateMatrixWorld(true);
  const below = new THREE.Raycaster(new THREE.Vector3(0, -10, 0), new THREE.Vector3(0, 1, 0));
  assert.equal(below.intersectObject(studio.floor).length, 0);
  const above = new THREE.Raycaster(new THREE.Vector3(0, 10, 0), new THREE.Vector3(0, -1, 0));
  assert(above.intersectObject(studio.floor).length > 0);
  assert.match(STUDIO_BACKGROUND, /radial-gradient/);
  assert.match(STUDIO_BACKGROUND, /linear-gradient/);
  studio.dispose();
});


test("fixed-budget shadow filtering preserves world-space softness for single and grouped cubes", () => {
  for (const [halfExtent, horizontalExtent] of [[1, 1], [1, 4.3], [1.5, 1.5]]) {
    const scene = new THREE.Scene(), studio = createPresentationStudio(scene, halfExtent, horizontalExtent);
    const keys = scene.children.filter(object => object.isLight && object.castShadow);
    assert.equal(keys.length, 1);
    const key = keys[0], camera = key.shadow.camera;
    assert.deepEqual(key.shadow.mapSize.toArray(), [1024, 1024]);
    assert(key.shadow.radius >= 2 && key.shadow.radius <= 24);
    const worldRadius = key.shadow.radius * (camera.right - camera.left) / key.shadow.mapSize.x;
    assert(Math.abs(worldRadius - PRESENTATION_PRESET.shadowSoftness * halfExtent) < 1e-8);
    studio.dispose(); assert.equal(scene.children.length, 0);
  }
});

test("rotated rigid clock and active layers stay above the receiver and inside shadow coverage", async () => {
  const { clockPresentationRadius } = await import("../src/apps/clock/framing.ts");
  const { rotatePresentation } = await import("../packages/cube-viewer/src/presentation-rotation.ts");
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const studio = createPresentationStudio(scene, 1, 4.3, undefined, clockPresentationRadius);
  const key = scene.children.find(o => o.isLight && o.castShadow);
  const { print } = createDesign("picture"), poses = stickerPoses(print, initialState(print));
  const material = new THREE.MeshStandardMaterial();
  const cubes = [-2.8, 0, 2.8].map(x => {
    const group = new THREE.Group(); group.position.x = x; root.add(group);
    const cube = new PhysicalCubeScene(group, poses, new Map(poses.map(s => [s.id, material])), material, .5, createPresentationGeometry());
    cube.sync(poses); return cube;
  });
  const turn = cubes[2].beginTurn([...new Set(poses.filter(s => s.p[0] === 1).map(s => s.cubie))], 0, Math.PI / 2);
  for (const yaw of [-Math.PI, -1.5, 0, 1.5, Math.PI]) for (const pitch of [-1.5, -.7, 0, .7, 1.5]) for (const progress of [0, .5, 1]) {
    turn.update(progress); rotatePresentation(root, yaw, pitch); scene.updateMatrixWorld(true);
    root.traverse(o => {
      if (!o.isMesh) return;
      const p = o.geometry.getAttribute("position");
      for (let i = 0; i < p.count; i++) {
        const world = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld);
        assert(world.y > studio.floor.position.y, "the complete rotated assembly must clear the receiving plane");
      }
    });
    projectedShadow(scene, key, studio.floor.position.y);
  }
  assert.deepEqual(key.shadow.mapSize.toArray(), [1024, 1024]);
  turn.dispose(); for (const cube of cubes) cube.dispose(); studio.dispose(); material.dispose();
});
