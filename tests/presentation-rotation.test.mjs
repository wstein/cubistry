import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { rotatePresentation, presentationCameraRadius, cubePresentationRadius, fitPresentationCamera } from "../packages/cube-viewer/src/presentation-rotation.ts";

test("presentation rotation reproduces historical view orientation while the observer is stationary", () => {
  const root = new THREE.Group(), camera = new THREE.PerspectiveCamera(24, 1, .1, 100);
  fitPresentationCamera(camera, cubePresentationRadius(1.5));
  const position = camera.position.toArray(), quaternion = camera.quaternion.toArray();
  for (const yaw of [-Math.PI, -1, 0, .2, 1, Math.PI]) for (const pitch of [-1.5, -.4, 0, .18, 1.5]) {
    rotatePresentation(root, yaw, pitch); root.updateMatrixWorld(true);
    const oldCamera = new THREE.PerspectiveCamera(24, 1, .1, 100);
    oldCamera.position.set(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), Math.cos(yaw) * Math.cos(pitch));
    oldCamera.lookAt(0, 0, 0); oldCamera.updateMatrixWorld(true);
    for (const point of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [-.3, .7, -.8]]) {
      const actual = new THREE.Vector3(...point).applyQuaternion(root.quaternion);
      const expected = new THREE.Vector3(...point).transformDirection(oldCamera.matrixWorldInverse).multiplyScalar(Math.hypot(...point));
      assert(actual.distanceTo(expected) < 1e-12);
    }
    assert.deepEqual(camera.position.toArray(), position);
    assert.deepEqual(camera.quaternion.toArray(), quaternion);
  }
});

test("orientation-independent fitting contains single cubes and rigid clock assembly in portrait and landscape", () => {
  for (const halfExtent of [1, 1.5]) for (const aspect of [.2, .5, 1, 3]) {
    const sphere = cubePresentationRadius(halfExtent), camera = new THREE.PerspectiveCamera(24, aspect, .1, 100);
    fitPresentationCamera(camera, sphere); camera.updateMatrixWorld(true);
    const originalDistance = camera.position.length(), root = new THREE.Group();
    for (const yaw of [-3, -1, 0, 1, 3]) for (const pitch of [-1.5, -.3, 0, .9, 1.5]) {
      rotatePresentation(root, yaw, pitch);
      for (const x of [-halfExtent, halfExtent]) for (const y of [-halfExtent, halfExtent]) for (const z of [-halfExtent, halfExtent]) {
        const point = new THREE.Vector3(x, y, z).applyQuaternion(root.quaternion).project(camera);
        assert(Math.abs(point.x) < .96 && Math.abs(point.y) < .96 && Math.abs(point.z) < 1);
      }
      assert.equal(camera.position.length(), originalDistance);
    }
  }
  for (const args of [[0, 1, 24], [1, 0, 24], [1, 1, NaN], [1, 1, 180]]) assert.throws(() => presentationCameraRadius(...args));
  assert.throws(() => rotatePresentation(new THREE.Group(), NaN, 0));
});

test("production pointer routing is reversible across the click threshold and stops on release/cancel", async () => {
  const { installPresentationDrag } = await import("../packages/cube-viewer/src/presentation-input.ts");
  const { viewTurn } = await import("../packages/cube-viewer/src/orbit-input.ts");
  class Target extends EventTarget {
    captured = new Set();
    setPointerCapture(id) { this.captured.add(id); }
    hasPointerCapture(id) { return this.captured.has(id); }
    releasePointerCapture(id) { this.captured.delete(id); }
    send(type, x, y, id = 1) {
      const event = new Event(type); Object.assign(event, { pointerId: id, clientX: x, clientY: y });
      this.dispatchEvent(event);
    }
  }
  const element = new Target(), root = new THREE.Group(), camera = new THREE.PerspectiveCamera();
  fitPresentationCamera(camera, cubePresentationRadius(1));
  const cameraBefore = { position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray() };
  let yaw = .2, pitch = .1, calls = 0;
  rotatePresentation(root, yaw, pitch); const initial = root.quaternion.clone();
  const cancel = installPresentationDrag(element, (dx, dy, dt) => {
    const delta = viewTurn(dx, dy, dt); yaw -= delta.yaw; pitch += delta.pitch;
    rotatePresentation(root, yaw, pitch); calls++;
  }, 4);
  element.send("pointerdown", 100, 100); element.send("pointermove", 102, 101);
  assert.equal(calls, 0);
  element.send("pointermove", 140, 120); assert(root.quaternion.angleTo(initial) > .1);
  element.send("pointermove", 100, 100); assert(root.quaternion.angleTo(initial) < 1e-7);
  for (const terminal of ["pointerup", "pointercancel", "lostpointercapture"]) {
    element.send(terminal, 100, 100); const before = calls;
    element.send("pointermove", 200, 200); assert.equal(calls, before);
    assert.equal(element.captured.size, 0);
    element.send("pointerdown", 100, 100);
  }
  cancel(); element.send("pointermove", 300, 300);
  assert(root.quaternion.angleTo(initial) < 1e-7);
  assert.deepEqual({ position: camera.position.toArray(), quaternion: camera.quaternion.toArray(), projection: camera.projectionMatrix.toArray() }, cameraBefore);
});
