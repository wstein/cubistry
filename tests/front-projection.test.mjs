import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { frontPoint, frontStickerPoint } from "./helpers/front-projection.mjs";
import { createDesign } from "../src/apps/playground/model.ts";
import { initialState, stickerPoses } from "@cubistry/cube-mechanics";
import { PhysicalCubeScene, createPresentationGeometry, rotatePresentation, cubePresentationRadius, fitPresentationCamera } from "@cubistry/cube-viewer";

test("existing image probes project actual printed-plane geometry and immutable artwork coordinates", () => {
  const { print } = createDesign("picture"), poses = stickerPoses(print, initialState(print));
  const root = new THREE.Group(), geometry = createPresentationGeometry(), material = new THREE.MeshStandardMaterial();
  const cube = new PhysicalCubeScene(root, poses, new Map(poses.map(p => [p.id, material])), material, .5, geometry);
  cube.sync(poses); rotatePresentation(root, Math.PI / 18, 7 * Math.PI / 180); root.updateMatrixWorld(true);
  geometry.sticker.computeBoundingBox();
  const box = geometry.sticker.boundingBox, printed = new Map();
  root.traverse(o => { if (o.userData.stickerId !== undefined) printed.set(o.userData.stickerId, o); });
  for (const image of [{ width: 1200, height: 600 }, { width: 350, height: 500 }, { width: 700, height: 700 }]) {
    const camera = new THREE.PerspectiveCamera(18, image.width / image.height, .1, 100);
    fitPresentationCamera(camera, cubePresentationRadius(1)); camera.updateMatrixWorld(true);
    for (const pose of poses.filter(p => p.n[2] === 1)) {
      const mesh = printed.get(pose.id), centerX = pose.p[0] * .5, centerY = pose.p[1] * .5;
      // Segment centers and the low orientation marker used by existing image assertions.
      for (const [px, py] of [[128, 48], [192, 84], [64, 168], [128, 208], [128, 234], [24, 74]]) {
        const local = new THREE.Vector3(
          THREE.MathUtils.lerp(box.min.x, box.max.x, px / 256),
          THREE.MathUtils.lerp(box.max.y, box.min.y, py / 256), 0);
        const world = local.applyMatrix4(mesh.matrixWorld), projected = world.clone().project(camera);
        const expected = [Math.round((projected.x + 1) * image.width / 2), Math.round((1 - projected.y) * image.height / 2)];
        assert.deepEqual(frontStickerPoint(image, centerX, centerY, px, py), expected);
        const canonical = root.worldToLocal(world.clone());
        assert(Math.abs(canonical.z - 1.002) < 1e-8, "sample depth must match the actual front printed plane");
        assert.deepEqual(frontPoint(image, canonical.x, canonical.y), expected);
      }
    }
  }
  cube.dispose(); material.dispose();
});
