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
      const casterNdc = point.clone().project(light.shadow.camera);
      assert(Math.abs(casterNdc.x) <= 1 && Math.abs(casterNdc.y) <= 1 && casterNdc.z > -1 && casterNdc.z < 1,
        "caster itself exceeds the shadow frustum");
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
  assert.equal(shadowLights.length, 2, "key plus shadow fill, never per cube");
  assert.equal(studio.floor.receiveShadow, true);
  assert(studio.floor.position.y < -Math.SQRT2);
  for (const construction of ["stickered", "stickerless"]) {
    for (const cube of cubes) cube.adapter.setConstruction(construction);
    const before = projectedShadow(scene, shadowLights[0], studio.floor.position.y);
    const fillBefore = projectedShadow(scene, shadowLights[1], studio.floor.position.y);
    const ids = poses.filter(s => s.p[1] === 1).map(s => s.cubie);
    const turn = cubes[2].adapter.beginTurn([...new Set(ids)], 1, Math.PI / 2);
    turn.update(.5);
    const during = projectedShadow(scene, shadowLights[0], studio.floor.position.y);
    assert(!before.equals(during), `${construction}: a layer must change the geometric shadow silhouette`);
    assert(!fillBefore.equals(projectedShadow(scene, shadowLights[1], studio.floor.position.y)),
      `${construction}: the shadow fill silhouette changes too`);
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
  assert(studio.floor.material.opacity > 0 && studio.floor.material.opacity < .5);
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
    const casters = scene.children.filter(object => object.isLight && object.castShadow);
    assert.equal(casters.length, 2);
    for (const [light, softness] of [[casters[0], PRESENTATION_PRESET.shadowSoftness],
                                     [casters[1], PRESENTATION_PRESET.shadowFillSoftness]]) {
      const camera = light.shadow.camera;
      assert.deepEqual(light.shadow.mapSize.toArray(), [1024, 1024]);
      assert(light.shadow.radius >= 2 && light.shadow.radius <= PRESENTATION_PRESET.shadowFillRadiusMax);
      const worldRadius = light.shadow.radius * (camera.right - camera.left) / light.shadow.mapSize.x;
      assert(Math.abs(worldRadius - softness * halfExtent) < 1e-8);
    }
    assert(casters[1].shadow.radius > casters[0].shadow.radius, "shadow fill is softer than the key");
    studio.dispose(); assert.equal(scene.children.length, 0);
  }
});

test("rotated rigid clock and active layers stay above the receiver and inside shadow coverage", async () => {
  const { clockCubeRadius, clockPresentationScale, clockWorldCenters } = await import("../src/apps/clock/framing.ts");
  const { rotatePresentation } = await import("../packages/cube-viewer/src/presentation-rotation.ts");
  const scene = new THREE.Scene(), root = new THREE.Group(); scene.add(root);
  const studio = createPresentationStudio(scene, 1, 4.3);
  const key = scene.children.find(o => o.isLight && o.castShadow);
  const { print } = createDesign("picture"), poses = stickerPoses(print, initialState(print));
  const material = new THREE.MeshStandardMaterial();
  const cubes = [-2.8, 0, 2.8].map(x => {
    const group = new THREE.Group(); group.position.x = x; root.add(group);
    const cube = new PhysicalCubeScene(group, poses, new Map(poses.map(s => [s.id, material])), material, .5, createPresentationGeometry());
    cube.sync(poses); return cube;
  });
  const turn = cubes[2].beginTurn([...new Set(poses.filter(s => s.p[0] === 1).map(s => s.cubie))], 0, Math.PI / 2);
  const centers = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  for (const yaw of [-Math.PI, -1.5, 0, 1.5, Math.PI]) for (const pitch of [-1.5, -.7, 0, .7, 1.5]) for (const progress of [0, .5, 1]) {
    turn.update(progress); rotatePresentation(root, yaw, pitch);
    root.scale.setScalar(clockPresentationScale(2.3, root.quaternion));
    clockWorldCenters(root.quaternion, root.scale.x, centers);
    studio.fitCasters(centers, clockCubeRadius * root.scale.x, .08 * root.scale.x);
    scene.updateMatrixWorld(true);
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
  assert(Math.abs((key.shadow.camera.right-key.shadow.camera.left)-(key.shadow.camera.top-key.shadow.camera.bottom))<1e-12);
  rotatePresentation(root,.2,.16);root.scale.setScalar(1);clockWorldCenters(root.quaternion,1,centers);
  studio.fitCasters(centers,clockCubeRadius,.08);
  const floorAtDefault=studio.floor.position.y, widthAtDefault=key.shadow.camera.right-key.shadow.camera.left;
  assert(floorAtDefault>-2.3 && floorAtDefault<-1.8,"cube-sized clearance, not the old -4.87 row sphere floor");
  assert(widthAtDefault<12,"tighter coverage than the old 18.3-wide shadow map");
  key.shadow.updateMatrices(key);
  const filterPadding=key.shadow.radius*widthAtDefault/1024 + widthAtDefault/1024;
  for(const center of centers){const lightPoint=center.clone().applyMatrix4(key.shadow.camera.matrixWorldInverse);
    assert(lightPoint.x-clockCubeRadius-key.shadow.camera.left>=filterPadding);
    assert(key.shadow.camera.right-lightPoint.x-clockCubeRadius>=filterPadding);
    assert(lightPoint.y-clockCubeRadius-key.shadow.camera.bottom>=filterPadding);
    assert(key.shadow.camera.top-lightPoint.y-clockCubeRadius>=filterPadding);}
  const worldSoftness=key.shadow.radius*widthAtDefault/1024;
  assert(Math.abs(worldSoftness-PRESENTATION_PRESET.shadowSoftness*clockCubeRadius/Math.sqrt(3))<1e-10);
  for(const progress of [0,.2,.5,.8,1]){turn.update(progress);studio.fitCasters(centers,clockCubeRadius,.08);
    assert.equal(studio.floor.position.y,floorAtDefault);assert.equal(key.shadow.camera.right-key.shadow.camera.left,widthAtDefault);}
  turn.dispose(); for (const cube of cubes) cube.dispose(); studio.dispose(); material.dispose();
});

test("shadow fill: opposite side, weaker, softer; both shadow cameras contain the same caster union", () => {
  const p = PRESENTATION_PRESET;
  assert.equal(p.shadowFillIntensity, 1.0);
  assert(p.shadowFillIntensity / p.keyIntensity > .3 && p.shadowFillIntensity / p.keyIntensity < .4);
  assert(p.shadowFillSoftness > p.shadowSoftness);
  assert(p.shadowFillShadowIntensity > 0 && p.shadowFillShadowIntensity < 1);
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 4.3);
  const lights = scene.children.filter(o => o.isDirectionalLight);
  assert.equal(lights.length, 4);
  assert.deepEqual(lights.filter(l => l.castShadow).map(l => l.intensity), [p.keyIntensity, p.shadowFillIntensity]);
  const [key, fill, rim] = [lights[0], lights[3], lights[2]];
  assert.deepEqual(key.position.toArray(), [3, 5, 6]);
  assert.deepEqual(lights[1].position.toArray(), [-4, 1, 2]);
  assert.deepEqual(rim.position.toArray(), [1, 3, -4]);
  assert(fill.position.x * key.position.x < 0, "shadow fill sits on the opposite side of the key");
  assert.equal(fill.shadow.intensity, p.shadowFillShadowIntensity);
  assert.equal(key.shadow.intensity, 1);
  assert.deepEqual(fill.shadow.mapSize.toArray(), [p.shadowMapSize, p.shadowMapSize]);
  for (const radius of [1, 1.7]) {
    const centers = [-2.8, 0, 2.8].map(x => new THREE.Vector3(x * radius, .3, -.4));
    const clearance = .08 * radius;
    studio.fitCasters(centers, radius * 1.1, clearance);
    scene.updateMatrixWorld(true);
    for (const light of [key, fill]) {
      light.shadow.updateMatrices(light);
      const camera = light.shadow.camera, direction = light.position.clone().normalize();
      for (const center of centers) for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
        const corner = center.clone().add(new THREE.Vector3(sx, sy, sz).multiplyScalar(radius * 1.1 / Math.sqrt(3)));
        for (const point of [corner, corner.clone().addScaledVector(direction.clone().negate(),
            (corner.y - studio.floor.position.y) / direction.y)]) {
          const ndc = point.clone().project(camera);
          assert(Math.abs(ndc.x) < 1 && Math.abs(ndc.y) < 1 && ndc.z > -1 && ndc.z < 1,
            "caster and its receiver intersection lie inside this light's frustum");
        }
      }
      assert(Math.abs((camera.right - camera.left) - (camera.top - camera.bottom)) < 1e-12);
      assert.deepEqual(light.shadow.mapSize.toArray(), [1024, 1024]);
    }
    assert(fill.shadow.radius > key.shadow.radius);
  }
  const disposed = [];
  for (const light of [key, fill]) { light.shadow.map = { dispose() { disposed.push(light); } }; }
  studio.dispose();
  assert.deepEqual(disposed, [key, fill]);
  assert.equal(scene.children.length, 0);
});
