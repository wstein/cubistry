import { test } from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Euler, Vector3, PerspectiveCamera } from "three";
import {
  clockCenters, clockCentersFor, clockBoundsFor, clockBounds, clockCubeRadius, clockCameraRadius,
  clockPresentationScale, clockWorldCenters, assertClockCubeCount,
} from "../src/apps/clock/framing.ts";

// Values recorded from the fixed three-cube implementation before the cube count was a parameter.
const OLD_RADIUS = [[.5, 38.86350174564888], [1, 19.85617158355676], [2.3, 9.293898788312758], [3, 8.525451665878252]];
const OLD_SCALE = [[.5, 1], [1, 1], [2.3, 0.538199912044688], [3, 0.49369994673138734]];
const pose = new Quaternion().setFromEuler(new Euler(.5, 1.1, .3));

test("three cubes keep exactly the old centers, camera radius and presentation scale", () => {
  assert.deepEqual([...clockCenters], [-2.8, 0, 2.8]);
  assert.deepEqual(clockCentersFor(3), [-2.8, 0, 2.8]);
  for (const [aspect, radius] of OLD_RADIUS) {
    assert.equal(clockCameraRadius(aspect), radius);
    assert.equal(clockCameraRadius(aspect, 0, 0, 28, 3), radius);
  }
  for (const [aspect, scale] of OLD_SCALE) {
    assert.equal(clockPresentationScale(aspect, pose), scale);
    assert.equal(clockPresentationScale(aspect, pose, 28, 3), scale);
  }
  assert.equal(clockBounds.length, 300);
  assert.deepEqual(clockBoundsFor(3), clockBounds);
  assert.deepEqual(clockBounds[0], [-2.55541982970813, 0, 1.7164450297926814]);
  assert.deepEqual(clockBounds[250], [4.2133906952378375, 1.0040065449563067, -0.017337828583764474]);
});

test("two cubes are centered symmetrically with the same 2.8 spacing", () => {
  assert.deepEqual(clockCentersFor(2), [-1.4, 1.4]);
  assert.equal(clockCentersFor(2)[1] - clockCentersFor(2)[0], 2.8);
  assert.equal(clockBoundsFor(2).length, 200);
});

test("two-cube framing uses the same margin logic and is never wider than three cubes", () => {
  for (const aspect of [.25, .5, 1, 2.3, 3]) {
    assert(clockCameraRadius(aspect, 0, 0, 28, 2) <= clockCameraRadius(aspect, 0, 0, 28, 3));
    const camera = new PerspectiveCamera(28, aspect, .1, 1000);
    camera.position.z = clockCameraRadius(aspect, 0, 0, 28, 2);
    camera.updateMatrixWorld();
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += .4) for (let pitch = -Math.PI; pitch <= Math.PI; pitch += .6) {
      const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, .3));
      const scale = clockPresentationScale(aspect, q, 28, 2);
      assert(scale > 0 && scale <= 1);
      const centers = [new Vector3(), new Vector3()];
      clockWorldCenters(q, scale, centers, 2);
      assert(Math.abs(centers[0].distanceTo(centers[1]) / scale - 2.8) < 1e-12);
      for (const c of centers) for (let i = 0; i < 100; i++) {
        const a = i * 2.399963229728653, z = 1 - 2 * (i + .5) / 100, r = Math.sqrt(1 - z * z);
        const p = new Vector3(r * Math.cos(a), r * Math.sin(a), z).multiplyScalar(clockCubeRadius * scale).add(c).project(camera);
        assert(Math.abs(p.x) <= .941 && Math.abs(p.y) <= .941 && p.z > -1 && p.z < 1);
      }
    }
  }
});

test("only two or three cubes are accepted", () => {
  assert.doesNotThrow(() => assertClockCubeCount(2));
  assert.doesNotThrow(() => assertClockCubeCount(3));
  for (const bad of [0, 1, 4, -1, 2.5, NaN, Infinity, "3", null]) {
    assert.throws(() => assertClockCubeCount(bad), /two or three/);
    assert.throws(() => clockCentersFor(bad), /two or three/);
    assert.throws(() => clockCameraRadius(1, 0, 0, 28, bad), /two or three/);
  }
});

test("the stage rejects an unsupported cube count before touching WebGL", async () => {
  const { ClockStage } = await import("../src/apps/clock/stage.ts");
  assert.throws(() => new ClockStage({}, 4), /two or three/);
  assert.throws(() => new ClockStage({}, 1), /two or three/);
});
