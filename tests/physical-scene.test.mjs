import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { PhysicalCubeScene } from "../packages/cube-viewer/src/physical-scene.ts";
import { createPresentationGeometry } from "../packages/cube-viewer/src/presentation-preset.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { stickerPoses, initialState, presentMove, parseMove, FACE_LAYERS } from "@cubistry/cube-mechanics";
import { apply, moveInfo, validateDesign } from "../src/apps/calendar/model.ts";
const near = (a, b) => {
  assert.equal(a.length, b.length);
  a.forEach((x, i) => assert(Math.abs(x - b[i]) < 1e-6, `${a} != ${b}`));
};
function fixture(printed, spacing) {
  const parent = new THREE.Group();
  const geometry = createPresentationGeometry();
  const material = new THREE.MeshStandardMaterial();
  const adapter = new PhysicalCubeScene(parent, printed,
    new Map(printed.map(s => [s.id, material])), material, spacing, geometry);
  const verify = poses => {
    parent.updateMatrixWorld(true);
    const stickers = new Map();
    parent.traverse(o => { if (o.userData.stickerId !== undefined) stickers.set(o.userData.stickerId, o); });
    assert.equal(stickers.size, printed.length);
    for (const pose of poses) {
      const sticker = stickers.get(pose.id);
      const q = sticker.getWorldQuaternion(new THREE.Quaternion())
        .premultiply(parent.getWorldQuaternion(new THREE.Quaternion()).invert());
      near(new THREE.Vector3(0, 0, 1).applyQuaternion(q).toArray(), pose.n);
      near(new THREE.Vector3(0, 1, 0).applyQuaternion(q).toArray(), pose.up);
      near(parent.worldToLocal(sticker.getWorldPosition(new THREE.Vector3())).toArray(),
        pose.p.map((x, i) => x * spacing + pose.n[i] * geometry.stickerOffset));
    }
  };
  return { parent, adapter, verify, geometry, material };
}
test("size-2 adapter preserves every immutable sticker frame at legal move endpoints", () => {
  const { print } = createDesign("picture");
  let state = initialState(print);
  const h = fixture(stickerPoses(print, state), .5);
  h.adapter.sync(stickerPoses(print, state));
  h.verify(stickerPoses(print, state));
  for (const token of ["R", "U'", "F2", "L", "D2", "B'", "R2", "U", "F'"]) {
    const event = presentMove(state, parseMove(token));
    const [axis, layer, direction] = FACE_LAYERS[event.move.face];
    const ids = state.cubies.filter(c => c.position[axis] === layer).map(c => c.id);
    const turn = h.adapter.beginTurn(ids, axis, direction * event.move.turns * Math.PI / 2);
    turn.update(1);
    h.verify(stickerPoses(print, event.to));
    turn.dispose();
    state = event.to;
    h.adapter.sync(stickerPoses(print, state));
    h.verify(stickerPoses(print, state));
  }
  h.adapter.dispose(); h.material.dispose();
  assert.equal(h.parent.children.length, 0);
});
test("inherited size-3 calendar frames, center orientation and whole-cube turns use the same adapter", () => {
  const pin = JSON.parse(readFileSync("calendar-source.json"));
  const design = validateDesign(JSON.parse(readFileSync("public/calendar/" + Object.keys(pin.runtime)[0])));
  let state = design.printing;
  const h = fixture(state, 1);
  h.adapter.sync(state); h.verify(state);
  for (const token of ["R", "U'", "F2", "L", "D2", "B'", "x", "y'", "z2"]) {
    const { axis, layer, turns } = moveInfo(token);
    const ids = [...new Set(state.filter(s => layer === null || s.p[axis] === layer).map(s => s.cubie))];
    const target = apply(state, token);
    const turn = h.adapter.beginTurn(ids, axis, turns * Math.PI / 2);
    turn.update(1); h.verify(target); turn.dispose();
    h.adapter.sync(target); h.verify(target); state = target;
  }
  h.adapter.dispose(); h.material.dispose();
});
test("canceling a render-only turn restores the supplied authoritative frame and disposes shared geometry once", () => {
  const { print } = createDesign("picture");
  const poses = stickerPoses(print, initialState(print));
  const h = fixture(poses, .5);
  h.adapter.sync(poses);
  const turn = h.adapter.beginTurn([0, 1], 0, Math.PI / 2);
  turn.update(.37); turn.dispose(); h.adapter.sync(poses); h.verify(poses);
  assert.equal(h.parent.children.length, print.cubies.length);
  let bodies = 0, stickers = 0, materials = 0;
  h.geometry.body.addEventListener("dispose", () => bodies++);
  h.geometry.sticker.addEventListener("dispose", () => stickers++);
  h.material.addEventListener("dispose", () => materials++);
  h.adapter.dispose();
  assert.deepEqual([bodies, stickers, materials], [1, 1, 0]);
  h.material.dispose();
});

test("shared clock placements and camera-space transforms stay outside physical frame mapping", () => {
  const { print } = createDesign("picture");
  const poses = stickerPoses(print, initialState(print));
  const stage = new THREE.Scene();
  const cubes = [-2.8, 0, 2.8].map(x => {
    const h = fixture(poses, .5);
    h.parent.position.set(x, 0, 0);
    h.parent.rotation.set(.16, .2, 0);
    stage.add(h.parent);
    h.adapter.sync(poses);
    return h;
  });
  stage.updateMatrixWorld(true);
  for (const h of cubes) h.verify(poses);
  const turn = cubes[1].adapter.beginTurn([0, 1], 1, Math.PI / 2);
  turn.update(.5);
  cubes[0].verify(poses); cubes[2].verify(poses);
  turn.dispose(); cubes[1].adapter.sync(poses);
  for (const h of cubes) h.verify(poses);
  cubes[1].adapter.dispose();
  assert.equal(cubes[0].parent.children.length, 8);
  assert.equal(cubes[2].parent.children.length, 8);
  for (const h of cubes) { if (h !== cubes[1]) h.adapter.dispose(); h.material.dispose(); }
});

test("compact size-2/size-3 seams have opaque plastic coverage at frontal and slight-angle junction rays", () => {
  const { print } = createDesign("picture");
  const pin = JSON.parse(readFileSync("calendar-source.json"));
  const calendar = validateDesign(JSON.parse(readFileSync("public/calendar/" + Object.keys(pin.runtime)[0])));
  for (const [poses, spacing, joints] of [
    [stickerPoses(print, initialState(print)), .5, [0]],
    [calendar.printing, 1, [-.5, .5]],
  ]) {
    const h = fixture(poses, spacing);
    h.adapter.sync(poses); h.parent.updateMatrixWorld(true);
    for (const x of joints) for (const y of joints)
      for (const [dx, dy] of [[0, 0], [.02, .01], [-.02, -.01]]) {
        const direction = new THREE.Vector3(dx, dy, -1).normalize();
        const ray = new THREE.Raycaster(new THREE.Vector3(x - dx * 10, y - dy * 10, 10), direction);
        assert(ray.intersectObject(h.parent, true).length > 0, `open junction at ${x},${y}`);
      }
    h.parent.traverse(object => {
      if (!object.userData.plasticCore) return;
      object.geometry.computeBoundingBox();
      const bounds = object.geometry.boundingBox.clone().applyMatrix4(object.matrix);
      for (const bound of [...bounds.min, ...bounds.max]) assert(Math.abs(bound) <= .500001);
      // The sealing core stays below every exterior printed surface.
      const body = object.parent;
      for (const sticker of body.children.filter(child => child.userData.stickerId !== undefined)) {
        const source = poses.find(pose => pose.id === sticker.userData.stickerId);
        for (let axis = 0; axis < 3; axis++) {
          if (source.n[axis] === 1) assert(bounds.max.getComponent(axis) <= .430001);
          if (source.n[axis] === -1) assert(bounds.min.getComponent(axis) >= -.430001);
        }
      }
    });
    h.adapter.dispose(); h.material.dispose();
  }
});
