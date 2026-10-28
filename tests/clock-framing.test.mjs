import { test } from "node:test";
import assert from "node:assert/strict";
import { PerspectiveCamera, Vector3 } from "three";
import { clockCameraRadius, clockBounds } from "../src/apps/clock/framing.ts";
test("shared clock camera contains turn bounds at every permitted orbit extreme", () => {
  for (const aspect of [1034 / 450, 332 / 230, 0.5, 3])
    for (const yaw of [-0.5, -0.25, 0, 0.25, 0.5])
      for (const pitch of [-0.4, -0.2, 0.1, 0.2, 0.4]) {
        const radius = clockCameraRadius(aspect, yaw, pitch),
          camera = new PerspectiveCamera(28, aspect, 0.1, 100);
        camera.position.set(
          Math.sin(yaw) * Math.cos(pitch) * radius,
          Math.sin(pitch) * radius,
          Math.cos(yaw) * Math.cos(pitch) * radius,
        );
        camera.lookAt(0, 0, 0);
        camera.updateMatrixWorld();
        for (const p of clockBounds) {
          const q = new Vector3(...p).project(camera);
          assert(
            Math.abs(q.x) < 0.96 && Math.abs(q.y) < 0.96 && q.z > -1 && q.z < 1,
            JSON.stringify({ aspect, yaw, pitch, p, q }),
          );
        }
        const reported = new Vector3(3.815, -1.015, 1.015).project(camera);
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
