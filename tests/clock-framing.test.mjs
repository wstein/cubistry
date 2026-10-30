import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3, Group, Quaternion, Euler } from "three";
import { rotationHarness } from "./helpers/rotation-harness.mjs";
import { rotatePresentation } from "../packages/cube-viewer/src/presentation-rotation.ts";
import { clockCameraRadius, clockBounds, clockPresentationScale } from "../src/apps/clock/framing.ts";
test("stationary shared clock camera contains the rigid turn envelope at every presentation extreme", () => {
  for (const aspect of [1034 / 450, 332 / 230, 0.25, 0.5, 3])
    for (const yaw of [-Math.PI, -Math.PI / 2, -.5, 0, .5, Math.PI / 2, Math.PI])
      for (const pitch of [-Math.PI / 2 + .05, -1, -.4, .1, .4, 1, Math.PI / 2 - .05]) {
        const radius = clockCameraRadius(aspect, yaw, pitch),
          camera = new PerspectiveCamera(28, aspect, 0.1, 1000);
        const presentation = new Group();
        rotatePresentation(presentation, yaw, pitch);
        presentation.scale.setScalar(clockPresentationScale(aspect, presentation.quaternion));
        camera.position.set(0, 0, radius);
        assert.equal(radius, clockCameraRadius(aspect, 0, 0));
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        for (const p of clockBounds) {
          const q = new Vector3(...p).multiplyScalar(presentation.scale.x).applyQuaternion(presentation.quaternion).project(camera);
          assert(
            Math.abs(q.x) < 0.96 && Math.abs(q.y) < 0.96 && q.z > -1 && q.z < 1,
            JSON.stringify({ aspect, yaw, pitch, p, q }),
          );
        }
        const reported = new Vector3(3.815, -1.015, 1.015).multiplyScalar(presentation.scale.x).applyQuaternion(presentation.quaternion).project(camera);
        assert(Math.abs(reported.y) < 1);
      }
});
test("shared clock camera rejects invalid projection input", () => {
  for (const args of [
    [0, 0, 0],
    [-1, 0, 0],
    [1, NaN, 0],
    [1, 0, 0, 180],
  ])
    assert.throws(() => clockCameraRadius(...args));
});


test("legacy input bounds and shared quaternion reset preserve placement and explicit zoom", async () => {
  const { groupOrbit, groupZoom } = await import("../src/apps/clock/orbit.ts");
  const { ClockStage } = await import("../src/apps/clock/stage.ts");
  const start = { yaw: .2, pitch: .16 };
  const rear = groupOrbit(start.yaw, start.pitch, Math.PI / .004, -1000);
  assert(Math.abs(Math.abs(rear.yaw - start.yaw) - Math.PI) < 1e-8);
  assert(rear.pitch < -1.5 && rear.pitch > -Math.PI / 2);
  const top = groupOrbit(rear.yaw, rear.pitch, 0, 1000);
  assert(top.pitch > 1.5 && top.pitch < Math.PI / 2);
  const full = groupOrbit(start.yaw, start.pitch, Math.PI * 2 / .004, 0);
  assert(Math.abs(full.yaw - start.yaw) < 1e-8);
  const cubes = [{ position: [-2.8, 0, 0] }, { position: [0, 0, 0] }, { position: [2.8, 0, 0] }];
  const snapshot = structuredClone(cubes);
  const presentation = new Group(), initial = new Quaternion().setFromEuler(new Euler(.16, -.2, 0));
  const h = rotationHarness({root:presentation,initial});
  const stage = Object.assign(Object.create(ClockStage.prototype), { zoom: 1.8, cubes, presentation,
    camera: new PerspectiveCamera(28, 1, .1, 1000), rotation:h.binding });
  rotatePresentation(presentation, rear.yaw, rear.pitch);
  stage.resetCamera();
  assert(presentation.quaternion.angleTo(initial)<1e-7);
  assert.equal(stage.zoom,1.8);
  assert.equal(h.binding.controller.phase,"idle");
  h.binding.dispose();
  assert.deepEqual(cubes, snapshot);
  assert.equal(groupZoom(1, -10000), .8);
  assert.equal(groupZoom(1, 10000), 2);
  assert.throws(() => groupOrbit(NaN, 0, 0, 0));
});
