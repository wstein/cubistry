import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  PRESENTATION_PRESET as preset, createPresentationGeometry,
  createPlasticMaterial, createStickerMaterial, presentationPixelRatio,
  configurePresentationRenderer, addPresentationLighting,
} from "../packages/cube-viewer/src/presentation-preset.ts";

test("presentation geometry fits existing turn envelopes with bounded triangles and smooth bevel normals", () => {
  const { body, core, sticker, stickerOffset } = createPresentationGeometry();
  body.computeBoundingBox(); sticker.computeBoundingBox();
  const bodyWidth = body.boundingBox.getSize(new THREE.Vector3());
  for (const value of bodyWidth) assert(Math.abs(value - preset.bodyWidth) < 1e-6);
  assert(stickerOffset > preset.bodyWidth / 2);
  assert(preset.stickerWidth < preset.bodyWidth - preset.bodyRadius * 2);
  for (const spacing of [1, .5 * 2])
    assert(Math.abs(spacing - preset.bodyWidth - .01) < 1e-8);
  const normals = body.getAttribute("normal");
  let beveled = false;
  for (let i = 0; i < normals.count; i++) {
    const n = new THREE.Vector3().fromBufferAttribute(normals, i);
    assert(Math.abs(n.length() - 1) < 1e-6);
    if (n.toArray().filter(x => Math.abs(x) > .01).length > 1) beveled = true;
  }
  assert(beveled);
  const triangles = geometry => (geometry.index?.count ?? geometry.getAttribute("position").count) / 3;
  assert(triangles(body) <= 600);
  assert(triangles(sticker) <= 40);
  // Same two geometries serve 8/26 bodies; the three-cube clock has 24 bodies.
  assert(triangles(body) * 26 + triangles(sticker) * 54 < 18000);
  body.dispose(); core?.dispose(); sticker.dispose();
});
test("rounded stickers retain the original affine UV frame and physical print-up", () => {
  const { body, core, sticker } = createPresentationGeometry();
  const positions = sticker.getAttribute("position"), uv = sticker.getAttribute("uv");
  let minU = 1, maxU = 0, minV = 1, maxV = 0;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i), v = uv.getY(i);
    assert(Math.abs(u - (positions.getX(i) / preset.stickerWidth + .5)) < 1e-6);
    assert(Math.abs(v - (positions.getY(i) / preset.stickerWidth + .5)) < 1e-6);
    assert(u >= -1e-6 && u <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6);
    minU = Math.min(minU, u); maxU = Math.max(maxU, u);
    minV = Math.min(minV, v); maxV = Math.max(maxV, v);
  }
  assert.deepEqual([minU, maxU, minV, maxV], [0, 1, 0, 1]);
  body.dispose(); core?.dispose(); sticker.dispose();
});
test("materials retain supplied artwork/color/roughness with bounded nonmetallic highlights", () => {
  const texture = new THREE.Texture();
  const sticker = createStickerMaterial(texture, "#ffcc88", .71);
  const plastic = createPlasticMaterial("#102030", .53);
  assert.equal(sticker.map, texture);
  assert.equal(sticker.color.getHexString(), "ffcc88");
  assert.equal(sticker.roughness, .71);
  assert.equal(plastic.roughness, .53);
  assert.equal(plastic.color.getHexString(), "102030");
  for (const material of [sticker, plastic]) {
    assert.equal(material.metalness, 0);
    assert(material.clearcoat > 0 && material.clearcoat < .25);
    material.dispose();
  }
  texture.dispose();
});
test("scene owner installs one bounded lighting rig and renderer caps high DPI", () => {
  const scene = new THREE.Scene();
  addPresentationLighting(scene);
  assert.equal(scene.children.length, 5);
  assert.equal(scene.children.filter(o => o.isDirectionalLight).length, 3);
  assert.equal(scene.children.filter(o => o.castShadow).length, 1);
  const key = scene.children.find(o => o.castShadow);
  assert.deepEqual(key.shadow.mapSize.toArray(), [1024, 1024]);
  for (const [input, expected] of [[1, 1], [1.5, 1.5], [3, 2], [NaN, 1], [0, 1]])
    assert.equal(presentationPixelRatio(input), expected);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "devicePixelRatio");
  Object.defineProperty(globalThis, "devicePixelRatio", { value: 3, configurable: true });
  try {
    let ratio;
    const renderer = { shadowMap: {}, setPixelRatio(value) { ratio = value; } };
    configurePresentationRenderer(renderer);
    assert.equal(ratio, 2);
    assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
    assert.equal(renderer.toneMapping, THREE.NeutralToneMapping);
  } finally {
    if (previous) Object.defineProperty(globalThis, "devicePixelRatio", previous);
    else delete globalThis.devicePixelRatio;
  }
});
