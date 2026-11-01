// Clock stage row of two or three cubes: the validated count, the row
// centers, and the framing helpers. Three cubes must stay exactly the
// historical H–M–S row; two cubes are a symmetric row with the same spacing.
import { test } from "node:test";
import assert from "node:assert/strict";
import { Quaternion, Euler, Vector3, PerspectiveCamera } from "three";
import {
  clockBounds,
  clockBoundsFor,
  clockCameraRadius,
  clockCenters,
  clockCentersFor,
  clockCubeCount,
  clockCubeRadius,
  clockCubeSpacing,
  clockDefaultQuaternion,
  clockPresentationScale,
  clockRequiredDistance,
  clockRowExtent,
  clockWorldCenters,
} from "../src/apps/clock/framing.ts";

const rejected = [0, 1, 4, 2.5, -2, NaN, Infinity, "3", "2", null, undefined, [3], 3n];

test("the cube count is exactly 2 or 3; every other value is rejected explicitly", () => {
  assert.equal(clockCubeCount(2), 2);
  assert.equal(clockCubeCount(3), 3);
  for (const count of rejected) {
    assert.throws(() => clockCubeCount(count), /two or three cubes/, String(count));
    assert.throws(() => clockCentersFor(count), /two or three cubes/, String(count));
  }
});

test("three cubes keep today's row constants; two cubes form a symmetric row at the same spacing", () => {
  // n = 3 is the historical constant itself, not merely an equal copy.
  assert.equal(clockCentersFor(3), clockCenters);
  assert.deepEqual([...clockCenters], [-2.8, 0, 2.8]);
  assert.equal(clockCubeSpacing, 2.8);
  assert.equal(clockRowExtent(), 2.8);
  assert.equal(clockRowExtent(clockCentersFor(3)), 2.8);
  // The formula (index - (n - 1) / 2) * spacing reproduces the three-cube row.
  assert.deepEqual(
    [0, 1, 2].map((i) => (i - 1) * clockCubeSpacing),
    [...clockCenters],
  );
  assert.deepEqual([...clockCentersFor(2)], [-1.4, 1.4]);
  assert.equal(clockCentersFor(2)[1] - clockCentersFor(2)[0], clockCubeSpacing);
  assert.equal(clockRowExtent(clockCentersFor(2)), 1.4);
  // Bounds: the historical export is the three-cube sampling.
  assert.deepEqual(clockBoundsFor(clockCenters), clockBounds);
  assert.equal(clockBounds.length, 300);
  assert.equal(clockBoundsFor(clockCentersFor(2)).length, 200);
});

test("the default framing equals explicit three-cube framing bit for bit", () => {
  const three = clockCentersFor(3);
  for (const aspect of [0.001, 0.25, 0.5, 1, 2.3, 3])
    for (const fov of [20, 28, 60]) {
      assert.equal(clockCameraRadius(aspect, 0, 0, fov), clockCameraRadius(aspect, 0, 0, fov, three));
      for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.7)
        for (let pitch = -1.5; pitch <= 1.5; pitch += 0.6) {
          const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, 0.3));
          assert.equal(clockRequiredDistance(aspect, q, fov), clockRequiredDistance(aspect, q, fov, three));
          assert.equal(clockPresentationScale(aspect, q, fov), clockPresentationScale(aspect, q, fov, three));
          const a = [new Vector3(), new Vector3(), new Vector3()],
            b = [new Vector3(), new Vector3(), new Vector3()];
          clockWorldCenters(q, 0.7, a);
          clockWorldCenters(q, 0.7, b, three);
          assert.deepEqual(a.map((v) => v.toArray()), b.map((v) => v.toArray()));
        }
    }
});

test("a two-cube row fits every rotated legal-turn sphere and frames closer than three cubes", () => {
  const two = clockCentersFor(2);
  for (const aspect of [0.25, 0.5, 1, 1.5, 2.3, 3]) {
    const distance = clockCameraRadius(aspect, 0, 0, 28, two);
    assert(distance < clockCameraRadius(aspect), `${aspect}: two cubes need less distance`);
    assert.equal(clockPresentationScale(aspect, clockDefaultQuaternion, 28, two), 1);
    const camera = new PerspectiveCamera(28, aspect, 0.1, 1000);
    camera.position.z = distance;
    camera.updateMatrixWorld();
    for (let yaw = -Math.PI; yaw <= Math.PI; yaw += 0.4)
      for (let pitch = -Math.PI; pitch <= Math.PI; pitch += 0.5) {
        const q = new Quaternion().setFromEuler(new Euler(pitch, yaw, 0.3));
        const scale = clockPresentationScale(aspect, q, 28, two);
        assert(scale > 0 && scale <= 1);
        const centers = [new Vector3(), new Vector3()];
        clockWorldCenters(q, scale, centers, two);
        assert(Math.abs(centers[0].distanceTo(centers[1]) / scale - 2.8) < 1e-12);
        assert(centers[0].clone().add(centers[1]).length() < 1e-12, "symmetric about the origin");
        for (const c of centers)
          for (let i = 0; i < 100; i++) {
            const a = i * 2.399963229728653, z = 1 - 2 * (i + 0.5) / 100, r = Math.sqrt(1 - z * z);
            const p = new Vector3(r * Math.cos(a), r * Math.sin(a), z)
              .multiplyScalar(clockCubeRadius * scale).add(c).project(camera);
            assert(Math.abs(p.x) <= 0.941 && Math.abs(p.y) <= 0.941 && p.z > -1 && p.z < 1);
          }
      }
  }
});

test("framing helpers reject invalid center rows and short outputs", () => {
  for (const centers of [[], [NaN], [0, Infinity]]) {
    assert.throws(() => clockRequiredDistance(1, clockDefaultQuaternion, 28, centers));
    assert.throws(() => clockBoundsFor(centers));
  }
  assert.throws(() => clockWorldCenters(clockDefaultQuaternion, 1, [new Vector3()], clockCentersFor(2)));
  assert.throws(() => clockWorldCenters(clockDefaultQuaternion, 1, [new Vector3(), new Vector3()]));
});
