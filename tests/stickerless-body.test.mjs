import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { createPresentationGeometry } from "../packages/cube-viewer/src/presentation-preset.ts";
import { PhysicalCubeScene, DEFAULT_CORE_COLOR } from "../packages/cube-viewer/src/physical-scene.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { stickerPoses, initialState } from "@cubistry/cube-mechanics";

const hex = material => `#${material.color.getHexString()}`;
function build(options, plasticColor = "#00ffaa") {
  const { print } = createDesign("picture");
  const source = stickerPoses(print, initialState(print));
  const parent = new THREE.Group();
  const plastic = new THREE.MeshPhysicalMaterial({ color: plasticColor }), art = new THREE.MeshStandardMaterial();
  // Distinct, explicit color per source face.
  const colors = new Map(source.map(s => [s.id, `#${((s.id + 1) * 65537).toString(16).padStart(6, "0")}`]));
  const scene = new PhysicalCubeScene(parent, source, new Map(source.map(s => [s.id, art])), plastic,
    .5, createPresentationGeometry(), colors, options);
  scene.setConstruction("stickerless");
  return { scene, parent, source, colors, plastic };
}
const shells = parent => { const list = []; parent.traverse(o => { if (o.userData.sourceFaceStickerIds) list.push(o); }); return list; };

test("stickerless cut faces follow a bordering exterior face, never the frame color", () => {
  const { parent, colors, plastic } = build({});
  for (const shell of shells(parent)) {
    const ids = shell.userData.sourceFaceStickerIds, exterior = ids.map((id, i) => id === null ? null : i).filter(i => i !== null);
    for (let index = 0; index < 6; index++) {
      if (ids[index] !== null) continue;
      const color = hex(shell.material[index]);
      assert.notEqual(color, hex(plastic));
      const allowed = exterior.filter(i => (i >> 1) !== (index >> 1)).map(i => colors.get(ids[i]));
      const fallback = exterior.map(i => colors.get(ids[i]));
      assert((allowed.length ? allowed : fallback).includes(color), `${color} not from a bordering face`);
    }
  }
});

test("explicit body color overrides every cut face and is validated", () => {
  const { parent } = build({ bodyColor: "#fffdf6" });
  for (const shell of shells(parent))
    shell.userData.sourceFaceStickerIds.forEach((id, i) => { if (id === null) assert.equal(hex(shell.material[i]), "#fffdf6"); });
  assert.throws(() => build({ bodyColor: "red" }), /Invalid body color/);
  assert.throws(() => build({ coreColor: "#12" }), /Invalid core color/);
});

test("stickerless core defaults to dark gray, is configurable, and stickered keeps the frame color", () => {
  const { scene, parent, plastic } = build({});
  const cores = []; parent.traverse(o => { if (o.userData.plasticCore) cores.push(o); });
  assert(cores.length > 0);
  for (const core of cores) assert.equal(hex(core.material), DEFAULT_CORE_COLOR);
  scene.setCoreColor("#445566");
  for (const core of cores) assert.equal(hex(core.material), "#445566");
  scene.setConstruction("stickered");
  for (const core of cores) assert.equal(core.material, plastic);
  assert.throws(() => scene.setCoreColor("nope"), /Invalid core color/);
});

test("cut materials are shared per color and disposed with the scene", () => {
  const { scene, parent } = build({ bodyColor: "#fffdf6" });
  const used = new Set(); for (const shell of shells(parent)) shell.material.forEach(m => used.add(m));
  const cut = [...used].filter(m => hex(m) === "#fffdf6");
  assert.equal(cut.length, 1);
  let disposed = 0; cut[0].addEventListener("dispose", () => disposed++);
  scene.dispose(); assert.equal(disposed, 1);
});
