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

test("shadow fill: 25 degrees beside the key, weaker, softer; both shadow cameras contain the same caster union", () => {
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
  assert.deepEqual(key.position.toArray(), [1.5, 7, 3], "steeper key (was [3, 5, 6])");
  const elevation = light => THREE.MathUtils.radToDeg(Math.asin(light.position.y / light.position.length()));
  assert(elevation(key) >= 55, `key elevation ${elevation(key)} must be at least 55 degrees (was 40.2)`);
  assert.deepEqual(lights[1].position.toArray(), [-4, 1, 2]);
  assert.deepEqual(rim.position.toArray(), [1, 3, -4]);
  const azimuth = light => Math.atan2(light.position.x, light.position.z);
  const offset = THREE.MathUtils.radToDeg(azimuth(key) - azimuth(fill));
  assert(Math.abs(offset - p.shadowFillAzimuthDegrees) < 1e-6, `fill azimuth offset ${offset}`);
  assert.equal(p.shadowFillAzimuthDegrees, 25);
  assert(fill.position.x < key.position.x, "shadow fill moves toward smaller x");
  assert(Math.abs(fill.position.length() - key.position.length()) < 1e-9, "key distance is kept");
  assert(Math.abs(elevation(fill) - elevation(key)) < 1e-9, "elevation delta is 0");
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

test("contact shadow: on by default; off frees everything, on re-creates it, repeatedly without leaks", () => {
  const p = PRESENTATION_PRESET;
  assert.equal(p.contactShadowDefault, true);
  assert.equal(p.contactShadowScale, 2.2);
  const contactPlanes = scene => scene.children.filter(o => o.name === "studio-contact-shadow");
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1, undefined, 1.5);
  assert.equal(contactPlanes(scene).length, 1, "default on");
  studio.setContactShadow(false);
  const baseline = scene.children.length;
  assert.equal(contactPlanes(scene).length, 0);
  studio.setContactShadow(false);
  assert.equal(scene.children.length, baseline, "switching off while off is a no-op");
  const disposed = { geometry: 0, material: 0, texture: 0 };
  for (let round = 0; round < 3; round++) {
    studio.setContactShadow(true);
    const planes = contactPlanes(scene);
    assert.equal(planes.length, 1);
    const [plane] = planes;
    assert.equal(plane.castShadow, false); assert.equal(plane.receiveShadow, false);
    assert(Math.abs(plane.position.y - (studio.floor.position.y + p.contactShadowLift)) < 1e-12);
    assert.equal(plane.material.transparent, true); assert.equal(plane.material.depthWrite, false);
    assert.equal(plane.scale.x, 1.5 * p.contactShadowScale);
    assert.equal(plane.material.color.getHexString(), "302b26");
    plane.geometry.addEventListener("dispose", () => disposed.geometry++);
    plane.material.addEventListener("dispose", () => disposed.material++);
    plane.material.map.addEventListener("dispose", () => disposed.texture++);
    const alpha = plane.material.map.image.data, n = plane.material.map.image.width;
    assert.equal(alpha[3], 0, "rim is transparent"); assert(alpha[((n / 2) * n + n / 2) * 4 + 3] > 240, "center is dense");
    studio.setContactShadow(true);
    assert.equal(scene.children.length, baseline + 1);
    studio.setContactShadow(false);
    assert.equal(scene.children.length, baseline);
  }
  assert.deepEqual(disposed, { geometry: 3, material: 3, texture: 3 });
  studio.setContactShadow(true);
  const centers = [-2.8, 0, 2.8].map(x => new THREE.Vector3(x, .5, .25));
  studio.fitCasters(centers, 1.4, .08);
  const planes = contactPlanes(scene);
  assert.equal(planes.length, 3);
  planes.forEach((plane, i) => {
    assert.equal(plane.position.x, centers[i].x); assert.equal(plane.position.z, .25);
    assert(Math.abs(plane.position.y - (studio.floor.position.y + p.contactShadowLift)) < 1e-12);
    assert(plane.position.y < centers[i].y - 1.4, "plane sits below the cube");
  });
  studio.fitCasters(centers.slice(0, 1), 1.4, .08);
  assert.equal(contactPlanes(scene).length, 1);
  studio.dispose();
  assert.equal(scene.children.length, 0);
});

test("contact shadow size: from the fitted radius, capped by the nearest neighbor so blobs never overlap", () => {
  const p = PRESENTATION_PRESET;
  assert.equal(p.contactShadowSpacingLimit, 1.0);
  const planes = scene => scene.children.filter(o => o.name === "studio-contact-shadow");
  const fit = (centers, radius) => {
    const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1, undefined, 1.5);
    studio.fitCasters(centers, radius, .08);
    const found = planes(scene).map(m => ({ x: m.position.x, z: m.position.z, side: m.scale.x }));
    studio.dispose();
    return found;
  };
  // One cube: no neighbor, so only the fitted radius counts (a different radius gives a different size).
  assert.equal(fit([new THREE.Vector3(0, .5, 0)], 1.4)[0].side, 1.4 * p.contactShadowScale);
  assert.equal(fit([new THREE.Vector3(0, .5, 0)], 2.0)[0].side, 2.0 * p.contactShadowScale);
  // Far apart: the cap does not bite, the fitted radius decides.
  const far = fit([-10, 0, 10].map(x => new THREE.Vector3(x, .5, 0)), 1.4);
  far.forEach(b => assert.equal(b.side, 1.4 * p.contactShadowScale));
  // Clock-like spacing 2.8 with radius 1.4 (uncapped side 3.08): capped to the spacing, no overlap.
  const clock = fit([-2.8, 0, 2.8].map(x => new THREE.Vector3(x, .5, .25)), 1.4);
  assert.equal(clock.length, 3);
  clock.forEach(b => assert(Math.abs(b.side - 2.8 * p.contactShadowSpacingLimit) < 1e-12, `side ${b.side}`));
  for (let i = 0; i < clock.length - 1; i++)
    assert(Math.hypot(clock[i + 1].x - clock[i].x, clock[i + 1].z - clock[i].z) >= (clock[i].side + clock[i + 1].side) / 2 - 1e-12,
      "neighboring blobs must not overlap");
  // Uneven spacing: every blob uses the SMALLEST neighbor distance.
  const uneven = fit([new THREE.Vector3(-6, .5, 0), new THREE.Vector3(0, .5, 0), new THREE.Vector3(2, .5, 0)], 1.4);
  uneven.forEach(b => assert(Math.abs(b.side - 2) < 1e-12, `side ${b.side}`));
});

test("fine shadow edges: opt-in 2048 maps, smaller world penumbra, old maps disposed, fit uses the current map size", () => {
  const p = PRESENTATION_PRESET;
  assert.deepEqual([p.fineShadowEdgesDefault, p.fineShadowMapSize, p.fineShadowSoftnessScale], [false, 2048, .65]);
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1);
  const [key, fill] = scene.children.filter(o => o.isDirectionalLight && o.castShadow);
  const world = light => light.shadow.radius * (light.shadow.camera.right - light.shadow.camera.left) / light.shadow.mapSize.x;
  const sizes = () => [key, fill].map(l => l.shadow.mapSize.toArray());
  assert.deepEqual(sizes(), [[1024, 1024], [1024, 1024]], "default off");
  const base = [key, fill].map(world);
  // A wide clock-like union keeps every radius clear of the texel caps.
  const centers = [-2.8, 0, 2.8].map(x => new THREE.Vector3(x, 0, 0));
  studio.fitCasters(centers, 1.4, .08);
  const fittedBase = [key, fill].map(world);
  const disposedMaps = [];
  const fakeMaps = () => [key, fill].map(light => { light.shadow.map = { dispose() { disposedMaps.push(light); } }; });
  for (let round = 0; round < 3; round++) {
    fakeMaps();
    studio.setFineShadowEdges(true);
    assert.deepEqual(sizes(), [[2048, 2048], [2048, 2048]]);
    assert.deepEqual(disposedMaps.splice(0), [key, fill], "old shadow maps are disposed");
    assert.equal(key.shadow.map, null); assert.equal(fill.shadow.map, null);
    const fine = [key, fill].map(world);
    fine.forEach((w, i) => assert(Math.abs(w - fittedBase[i] * p.fineShadowSoftnessScale) < 1e-9, `world penumbra scaled ${w}`));
    // fitCasters (clock: every frame) keeps using the current map size.
    studio.fitCasters(centers, 1.4, .08);
    assert.deepEqual(sizes(), [[2048, 2048], [2048, 2048]]);
    [key, fill].map(world).forEach((w, i) => assert(Math.abs(w - fine[i]) < 1e-9, "fit radius uses the 2048 map"));
    studio.setFineShadowEdges(true);
    assert.equal(disposedMaps.length, 0, "no-op while already on");
    fakeMaps();
    studio.setFineShadowEdges(false);
    assert.deepEqual(sizes(), [[1024, 1024], [1024, 1024]]);
    assert.deepEqual(disposedMaps.splice(0), [key, fill]);
    [key, fill].map(world).forEach((w, i) => assert(Math.abs(w - fittedBase[i]) < 1e-9, "off restores the penumbra"));
  }
  // Before any fit (single-cube viewers never call fitCasters) the switch itself rescales the radius.
  const scene2 = new THREE.Scene(), studio2 = createPresentationStudio(scene2, 1, 1);
  const [k2] = scene2.children.filter(o => o.isDirectionalLight && o.castShadow);
  studio2.setFineShadowEdges(true);
  assert(Math.abs(world(k2) - base[0] * p.fineShadowSoftnessScale) < 1e-9);
  assert(world(k2) < base[0]);
    studio2.dispose(); studio.dispose();
  assert.equal(scene.children.length, 0);
});

test("color temperature: default off keeps every light white; on tints lights only", () => {
  const p = PRESENTATION_PRESET;
  assert.equal(p.colorTemperatureDefault, false);
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1);
  const lights = scene.children.filter(o => o.isLight);
  const material = new THREE.MeshStandardMaterial({ color: "#12ab34" });
  const sticker = new THREE.Mesh(new THREE.BufferGeometry(), material); scene.add(sticker);
  const hex = () => lights.map(l => l.color.getHexString());
  const hemisphereGround = lights.find(o => o.isHemisphereLight).groundColor.getHexString();
  assert.deepEqual(hex(), lights.map(() => "ffffff"), "off: exactly white");
  const [key, fill, rim, shadowFill] = scene.children.filter(o => o.isDirectionalLight);
  for (let round = 0; round < 3; round++) {
    studio.setColorTemperature(true);
    assert.equal(key.color.getHexString(), "fff3e3");
    assert.equal(fill.color.getHexString(), "eaf1ff");
    assert.equal(shadowFill.color.getHexString(), "eaf1ff");
    assert.equal(rim.color.getHexString(), "ffffff");
    assert.equal(lights.filter(l => l.color.getHexString() !== "ffffff").length, 3);
    assert.equal(material.color.getHexString(), "12ab34", "material colors are never touched");
    assert.equal(studio.floor.material.color.getHexString(), "302b26");
    assert.equal(lights.find(o => o.isHemisphereLight).groundColor.getHexString(), hemisphereGround);
    studio.setColorTemperature(false);
    assert.deepEqual(hex(), lights.map(() => "ffffff"), "off again: exactly white");
  }
  studio.dispose(); material.dispose();
});
