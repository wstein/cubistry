import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPresentationStudio } from "../packages/cube-viewer/src/studio.ts";
import { createPresentationGeometry } from "../packages/cube-viewer/src/presentation-preset.ts";
import { PhysicalCubeScene } from "../packages/cube-viewer/src/physical-scene.ts";
import { rotatePresentation } from "../packages/cube-viewer/src/presentation-rotation.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { stickerPoses, initialState } from "@cubistry/cube-mechanics";

/** Mimics WebGLRenderer.render: matrices, Scene.onBeforeRender, then the shadow pass consumes needsUpdate. */
function rig() {
  const scene = new THREE.Scene(), presentation = new THREE.Group(); scene.add(presentation);
  const studio = createPresentationStudio(scene, 1, 1);
  const { print } = createDesign("picture"), poses = stickerPoses(print, initialState(print));
  const material = new THREE.MeshStandardMaterial();
  const cube = new PhysicalCubeScene(presentation, poses, new Map(poses.map(s => [s.id, material])), material, .5, createPresentationGeometry());
  cube.sync(poses);
  const lights = scene.children.filter(o => o.isLight && o.castShadow);
  const frame = () => {
    scene.updateMatrixWorld();
    scene.onBeforeRender();
    const rendered = lights.map(l => l.shadow.autoUpdate === false ? l.shadow.needsUpdate : true);
    for (const l of lights) l.shadow.needsUpdate = false; // WebGLShadowMap.render does this
    return rendered;
  };
  return { scene, presentation, studio, cube, poses, lights, frame };
}
const none = [false, false], both = [true, true];

test("both shadow lights use on-change updates; the first frame renders, static frames do not", () => {
  const { lights, frame, studio } = rig();
  assert.equal(lights.length, 2);
  for (const l of lights) assert.equal(l.shadow.autoUpdate, false);
  assert.deepEqual(frame(), both);
  for (let i = 0; i < 5; i++) assert.deepEqual(frame(), none);
  studio.dispose();
});

test("moving a body, a turn pivot, the presentation group or a sticker marks dirty on the next frame only", () => {
  const { scene, presentation, cube, poses, frame, studio } = rig();
  frame();
  const body = [];
  scene.traverse(o => { if (o.isMesh && o.castShadow) body.push(o); });
  assert(body.length > 20);
  body[0].position.x += .01; assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  const ids = [...new Set(poses.filter(s => s.p[1] === 1).map(s => s.cubie))];
  const turn = cube.beginTurn(ids, 1, Math.PI / 2);
  assert.deepEqual(frame(), both, "beginTurn re-parents bodies under a pivot"); assert.deepEqual(frame(), none);
  turn.update(.3); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  turn.update(.3); assert.deepEqual(frame(), none, "same progress is the same pose");
  turn.dispose(); cube.sync(poses); frame(); assert.deepEqual(frame(), none);
  rotatePresentation(presentation, .3, .2); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  presentation.scale.setScalar(1.2); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  presentation.position.y = .5; assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  const sticker = body.find(o => o.name !== "" || o.geometry.type === "ShapeGeometry") ?? body[1];
  sticker.visible = false; assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  sticker.visible = true; assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  const mesh = body[2]; mesh.geometry = new THREE.BoxGeometry(); assert.deepEqual(frame(), both);
  mesh.material = new THREE.MeshBasicMaterial(); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  studio.dispose();
});

test("construction toggle (stickerless hides inset stickers) marks dirty", () => {
  const { cube, frame, studio } = rig();
  frame();
  cube.setConstruction("stickerless"); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  cube.setConstruction("stickered"); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  studio.dispose();
});

test("fitCasters marks dirty only when the light or shadow camera inputs actually changed", () => {
  const { studio, frame, presentation } = rig();
  const centers = [new THREE.Vector3(-2.8, 0, 0), new THREE.Vector3(), new THREE.Vector3(2.8, 0, 0)];
  frame();
  studio.fitCasters(centers, 1.4, .08); assert.deepEqual(frame(), both);
  for (let i = 0; i < 3; i++) { studio.fitCasters(centers, 1.4, .08); assert.deepEqual(frame(), none, "identical fit"); }
  studio.fitCasters(centers.map(c => c.clone().setY(.5)), 1.4, .08); assert.deepEqual(frame(), both);
  studio.fitCasters(centers.map(c => c.clone().setY(.5)), 1.5, .08); assert.deepEqual(frame(), both);
  assert.deepEqual(frame(), none);
  presentation.scale.setScalar(1); assert.deepEqual(frame(), none);
  studio.dispose();
});

test("light position or target changes mark dirty", () => {
  const { lights, frame, studio } = rig();
  frame();
  lights[0].position.x += .1; assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  lights[1].target.position.x += .1; lights[1].target.updateMatrixWorld(); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  studio.dispose();
});

test("fine shadow edges (map recreated) mark dirty; unchanged setting does not", () => {
  const { studio, frame, lights } = rig();
  frame();
  studio.setFineShadowEdges(false); assert.deepEqual(frame(), none);
  studio.setFineShadowEdges(true); assert.deepEqual(frame(), both);
  assert.deepEqual(lights[0].shadow.mapSize.toArray(), [2048, 2048]); assert.deepEqual(frame(), none);
  studio.setFineShadowEdges(false); assert.deepEqual(frame(), both); assert.deepEqual(frame(), none);
  studio.dispose();
});

test("a disposed (empty) shadow map is rendered even if nothing else changed", () => {
  const { lights, frame, studio } = rig();
  lights[0].shadow.map = { dispose() {} }; frame();
  assert.deepEqual(frame(), none);
  lights[0].shadow.map = null; assert.deepEqual(frame(), both);
  studio.dispose();
});

test("contact shadow toggles do not dirty (blobs do not cast shadows)", () => {
  const { studio, frame } = rig();
  studio.setContactShadow(false); frame();
  studio.setContactShadow(true); frame();
  assert.deepEqual(frame(), none);
  studio.dispose();
});

test("dispose removes the hook and restores automatic updates; a Group studio uses beforeRender()", () => {
  const scene = new THREE.Scene(), original = scene.onBeforeRender;
  const studio = createPresentationStudio(scene, 1, 1);
  const lights = scene.children.filter(o => o.isLight && o.castShadow);
  assert.notEqual(scene.onBeforeRender, original);
  studio.dispose();
  assert.equal(scene.onBeforeRender, original);
  for (const l of lights) assert.equal(l.shadow.autoUpdate, true);
  const group = new THREE.Group(), g = createPresentationStudio(group, 1, 1);
  const gl = group.children.filter(o => o.isLight && o.castShadow);
  assert.equal(Object.hasOwn(group, "onBeforeRender"), false);
  group.updateMatrixWorld(); g.beforeRender();
  assert.deepEqual(gl.map(l => l.shadow.needsUpdate), [true, true], "first call renders");
  for (const l of gl) l.shadow.needsUpdate = false;
  group.updateMatrixWorld(); g.beforeRender();
  assert.deepEqual(gl.map(l => l.shadow.needsUpdate), [false, false]);
  const caster = new THREE.Mesh(new THREE.BoxGeometry(), new THREE.MeshBasicMaterial()); caster.castShadow = true;
  group.add(caster); group.updateMatrixWorld(); g.beforeRender();
  assert.deepEqual(gl.map(l => l.shadow.needsUpdate), [true, true], "added caster");
  for (const l of gl) l.shadow.needsUpdate = false;
  caster.position.y += 1;
  group.updateMatrixWorld(); g.beforeRender();
  assert.deepEqual(gl.map(l => l.shadow.needsUpdate), [true, true]);
  g.dispose();
});

test("an earlier Scene.onBeforeRender hook keeps running", () => {
  const scene = new THREE.Scene(); let calls = 0;
  scene.onBeforeRender = () => { calls++; };
  const studio = createPresentationStudio(scene, 1, 1);
  scene.onBeforeRender(); assert.equal(calls, 1);
  studio.dispose(); scene.onBeforeRender(); assert.equal(calls, 2);
});
