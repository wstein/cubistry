import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { PhysicalCubeScene } from "../packages/cube-viewer/src/physical-scene.ts";
import { createPresentationGeometry } from "../packages/cube-viewer/src/presentation-preset.ts";
import { DEFAULT_APPEARANCE, validateAppearance, sourceFaceColor, appearanceStorageKey, readAppearance } from "../packages/cube-viewer/src/appearance.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { initialState, stickerPoses, applyMoves, parseAlg } from "@cubistry/cube-mechanics";
import { validateDesign, apply } from "../src/apps/calendar/model.ts";

test("stickerless colors belong to immutable local face IDs through canonical loads, turns, cancellation and mode toggles", () => {
  const { print } = createDesign("classic");
  const pin = JSON.parse(readFileSync("calendar-source.json"));
  const calendar = validateDesign(JSON.parse(readFileSync("public/calendar/" + Object.keys(pin.runtime)[0])));
  for (const [source, target, spacing] of [
    [stickerPoses(print, initialState(print)), stickerPoses(print, applyMoves(initialState(print), parseAlg("R U2 F'"))), .5],
    [calendar.printing, apply(calendar.printing, "R U2 F' x"), 1],
  ]) {
    const parent = new THREE.Group(), plastic = new THREE.MeshPhysicalMaterial({ color: "#202329" });
    const texture = new THREE.Texture(), art = new THREE.MeshStandardMaterial({ map: texture });
    const colors = new Map(source.map(s => [s.id, `#${((s.id + 1) * 65537).toString(16).padStart(6, "0")}`]));
    const scene = new PhysicalCubeScene(parent, source, new Map(source.map(s => [s.id, art])), plastic,
      spacing, createPresentationGeometry(), colors);
    const snapshot = JSON.stringify({ source, target });
    scene.sync(target); scene.setConstruction("stickerless");
    let clones = new Set();
    const verify = () => {
      parent.updateMatrixWorld(true);
      let faceCount = 0, stickerCount = 0;
      parent.traverse(object => {
        if (object.userData.stickerId !== undefined) {
          stickerCount++; assert.equal(object.material.map, texture); assert.equal(object.visible, true);
        }
        const ids = object.userData.sourceFaceStickerIds;
        if (!ids) return;
        assert(Array.isArray(object.material));
        for (let index = 0; index < ids.length; index++) {
          if (ids[index] === null) continue;
          faceCount++;
          const id = ids[index], sourceFace = source.find(s => s.id === id), targetFace = target.find(s => s.id === id);
          const material = object.material[index]; clones.add(material);
          assert.equal(`#${material.color.getHexString()}`, colors.get(id));
          // Material group axis matches its original face, then follows the
          // canonical body quaternion after a nontrivial loaded pose.
          const n = new THREE.Vector3(); n.setComponent(Math.floor(index / 2), index % 2 ? -1 : 1);
          assert.deepEqual(n.toArray(), sourceFace.n);
          n.applyQuaternion(object.getWorldQuaternion(new THREE.Quaternion()));
          targetFace.n.forEach((value, axis) => assert(Math.abs(n.getComponent(axis) - value) < 1e-6));
        }
      });
      assert.equal(faceCount, source.length); assert.equal(stickerCount, source.length);
    };
    verify();
    const turn = scene.beginTurn([target[0].cubie], 0, Math.PI / 2); turn.update(.4);
    scene.setConstruction("stickered"); scene.setConstruction("stickerless");
    turn.dispose(); scene.sync(target); verify();
    assert.equal(JSON.stringify({ source, target }), snapshot);
    let disposed = 0; for (const material of clones) material.addEventListener("dispose", () => disposed++);
    scene.dispose(); assert.equal(disposed, clones.size);
    plastic.dispose(); art.dispose(); texture.dispose();
  }
});
test("face colors use explicit metadata and image-backed art is never sampled or erased", () => {
  const manifest = { images: [{ id: "color", kind: "color", color: "#ff0000" },
    { id: "text", kind: "text", documentId: "d" }, { id: "picture", kind: "image" }],
    documents: [{ id: "d", background: "#fffdf6" }] };
  assert.equal(sourceFaceColor("color", manifest, "#ffffff"), "#ff0000");
  assert.equal(sourceFaceColor("text", manifest, "#ffffff"), "#fffdf6");
  assert.equal(sourceFaceColor("picture", manifest, "#abcdef"), "#abcdef");
});
test("per-application appearance preferences are bounded, fail closed, and reset to the style default", () => {
  assert.notEqual(appearanceStorageKey("/clock.html"), appearanceStorageKey("/calendar.html"));
  assert(appearanceStorageKey("x".repeat(1000)).length < 240);
  const valid = { version: 1, construction: "stickerless", frameColor: "#1a2b3c" };
  assert.deepEqual(readAppearance({ getItem: () => JSON.stringify(valid) }, "k"),
    { construction: "stickerless", frameColor: "#1a2b3c" });
  for (const saved of ["broken", "null", '{"version":2}',
    '{"version":1,"construction":"hidden","frameColor":null}',
    '{"version":1,"construction":"stickered","frameColor":"red;script"}'])
    assert.deepEqual(readAppearance({ getItem: () => saved }, "k"), DEFAULT_APPEARANCE);
  assert.deepEqual(validateAppearance({ construction: "stickered", frameColor: null }), DEFAULT_APPEARANCE);
  assert.throws(() => validateAppearance({ construction: "stickerless", frameColor: "#abcd" }));
});
