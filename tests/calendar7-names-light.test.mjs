// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, global light (owner decision 2026-11-15, option A): no light, material or weight per face. One rig for every
// face (names-light.ts), one material (roughness 0.65, clearcoat 0.01), the exposure stays the one global scalar (names-exposure.ts).
// The measured look (bevel depth, side chroma, highlight, hue) is tests/browser/calendar7-names-global-light.spec.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import * as THREE from "three";
import { PRESENTATION_PRESET, addPresentationLighting } from "@cubistry/cube-viewer";
import { collectLights, irradianceOf, namesExposure } from "../src/apps/calendar7/names-exposure.ts";
import { NAMES_CLEARCOAT, NAMES_ROUGHNESS, plasticityParts } from "../src/apps/calendar7/names-plasticity.ts";
import { NAMES_AMBIENT_INTENSITY, NAMES_HEMISPHERE_INTENSITY, NAMES_KEY, NAMES_RAKING, NamesLighting, findStudioLights } from "../src/apps/calendar7/names-light.ts";

const SRC = new URL("../src/apps/calendar7/", import.meta.url);
const read = (name) => fs.readFileSync(new URL(name, SRC), "utf8");
const studioScene = () => { const scene = new THREE.Scene(); addPresentationLighting(scene); return scene; };
const dirs = (scene) => { const out = []; scene.traverse((o) => { if (o.isDirectionalLight) out.push(o); }); return out; };
const direction = (p) => new THREE.Vector3(...p).normalize();

test("no per-face light: the face light module, its shader patch, uniform and weight hook are gone from the app", () => {
  assert.equal(fs.existsSync(new URL("names-face-light.ts", SRC)), false, "names-face-light.ts is deleted");
  const viewer = read("viewer.ts");
  for (const word of ["faceLight", "FaceLight", "DirectionalShare", "directionalShare", "c7FaceLight", "onBeforeCompile"]) assert.equal(viewer.includes(word), false, `viewer.ts has no ${word}`);
  for (const name of fs.readdirSync(SRC)) if (name.endsWith(".ts") && name !== "names-tone.ts") { // only the tone mapping chunk (names-tone.ts) is patched, and it is not per face
    assert.equal(/onBeforeCompile|ShaderChunk\.lights_fragment|names-face-light/.test(read(name)), false, `${name} patches no light chunk and does not import the face light`);
  }
});

test("rig: the studio lights are set to the global values of the names layout, the raking light is added without a shadow, and apply(false) restores the studio exactly", () => {
  assert.deepEqual(NAMES_KEY, { position: [1, 2.5, 6.5], intensity: 2.4 });
  assert.equal(NAMES_HEMISPHERE_INTENSITY, 0);
  assert.equal(NAMES_AMBIENT_INTENSITY, 0.8);
  assert.deepEqual(NAMES_RAKING, { position: [-8, 1.5, 1.5], intensity: 0.9 });
  const scene = studioScene(), studio = findStudioLights(scene), before = collectLights(scene);
  assert.deepEqual(studio.key.position.toArray(), [...PRESENTATION_PRESET.keyPosition], "the key found is the studio's shadow key");
  const keyP = studio.key.position.toArray(), keyI = studio.key.intensity, hemi = studio.hemisphere.intensity, amb = studio.ambient.intensity;
  const rig = new NamesLighting(scene);
  assert.equal(rig.active, false);
  assert.deepEqual(collectLights(scene), before, "constructing the rig leaves the studio's light alone (the raking light is hidden)");
  rig.apply(true);
  assert.equal(rig.active, true);
  assert.deepEqual(studio.key.position.toArray(), [1, 2.5, 6.5]);
  assert.equal(studio.key.intensity, 2.4);
  assert.equal(studio.hemisphere.intensity, 0);
  assert.equal(studio.ambient.intensity, 0.8);
  const raking = dirs(scene).find((l) => l.name === "names-raking-light");
  assert.ok(raking && raking.visible && raking.intensity === 0.9 && raking.castShadow === false);
  assert.deepEqual(raking.position.toArray(), [-8, 1.5, 1.5]);
  const lit = collectLights(scene);
  assert.equal(lit.directionals.length, before.directionals.length + 1, "exactly one more directional light, global");
  assert.ok(lit.directionals.some((d) => d.to.distanceTo(direction([-8, 1.5, 1.5])) < 1e-9 && Math.abs(d.amount - 0.9) < 1e-9));
  assert.equal(lit.ambient, 0.8);
  assert.equal(dirs(scene).filter((l) => l.castShadow).length, 2, "still only the key and the shadow fill cast a shadow");
  rig.apply(false);
  assert.deepEqual(studio.key.position.toArray(), keyP);
  assert.equal(studio.key.intensity, keyI);
  assert.equal(studio.hemisphere.intensity, hemi);
  assert.equal(studio.ambient.intensity, amb);
  assert.equal(raking.visible, false);
  assert.deepEqual(collectLights(scene), before, "the standard layout has the studio's own light again");
  rig.apply(true); rig.dispose();
  assert.equal(dirs(scene).some((l) => l.name === "names-raking-light"), false, "dispose removes the raking light");
  assert.equal(studio.key.intensity, keyI);
});

test("rig: the light is global, the same value for every face normal (a face is lit by its normal only, no per-face term)", () => {
  const scene = studioScene(), rig = new NamesLighting(scene);
  rig.apply(true);
  const lighting = collectLights(scene);
  // Every directional light of the rig is a plain direction and an amount: no per-face weight exists in the light description.
  for (const d of lighting.directionals) assert.deepEqual(Object.keys(d).sort(), ["amount", "to"]);
  const front = new THREE.Vector3(0, 0, 1), top = new THREE.Vector3(0, 1, 0), e = (n) => irradianceOf(lighting, n);
  // The key stands low and frontal: the top face is not the brightest face by a large factor (the old studio gave it 2.1 times the front face).
  assert.ok(e(top) / e(front) < 1.6 && e(top) / e(front) > 0.5, `top / front irradiance ${e(top) / e(front)}`);
});

test("rig: the exposure stays one global scalar from the faces that look at the camera (it follows the rig, not a face)", () => {
  const scene = studioScene(), cam = new THREE.PerspectiveCamera(24, 1, 0.1, 200); cam.position.set(0, 0, 20);
  const studio = namesExposure(scene, new THREE.Quaternion(), cam);
  const rig = new NamesLighting(scene); rig.apply(true);
  const names = namesExposure(scene, new THREE.Quaternion(), cam);
  assert.ok(names > 0 && Math.abs(names - studio) > 0.05, `the rig changes the exposure (${studio} to ${names}): it is calibrated on the new lights`);
  assert.ok(Math.abs(names - Math.PI / irradianceOf(collectLights(scene), new THREE.Vector3(0, 0, 1))) < 1e-12, "exposure = pi / irradiance of the face that looks at the camera");
  rig.apply(false);
  assert.ok(Math.abs(namesExposure(scene, new THREE.Quaternion(), cam) - studio) < 1e-12, "the studio's exposure is restored");
});

test("material: one roughness and one clearcoat for every cube material of the names layout, at any plasticity; no clearcoat of exactly 0", () => {
  assert.equal(NAMES_ROUGHNESS, 0.65);
  assert.equal(NAMES_CLEARCOAT, 0.01);
  assert.ok(NAMES_CLEARCOAT > 0, "exactly 0 changes the shader program and crashed headless Chromium");
  for (const p of [0, 0.3, 0.6, 1]) assert.equal("clearcoat" in plasticityParts(p) || "roughness" in plasticityParts(p), false, `plasticity ${p} has no per-face or per-plasticity roughness or clearcoat`);
  const viewer = read("viewer.ts");
  assert.ok(/roughness = NAMES_ROUGHNESS/.test(viewer) && /clearcoat = NAMES_CLEARCOAT/.test(viewer), "the viewer sets both on every material of the names layout");
});
