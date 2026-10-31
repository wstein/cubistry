import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import {
  presentationEffects, configurePresentationRenderer,
  LOW_EFFECTS_STORAGE_KEY, lowEffectsPixelRatio,
} from "../packages/cube-viewer/src/presentation-preset.ts";

const storageWith = value => ({ getItem: key => (key === LOW_EFFECTS_STORAGE_KEY ? value : null) });
const PRODUCTION = { shadows: true, pixelRatio: null };

function withDevicePixelRatio(value, body) {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "devicePixelRatio");
  Object.defineProperty(globalThis, "devicePixelRatio", { value, configurable: true });
  try { return body(); } finally {
    if (previous) Object.defineProperty(globalThis, "devicePixelRatio", previous);
    else delete globalThis.devicePixelRatio;
  }
}
function fakeRenderer() {
  const r = { shadowMap: {}, ratio: undefined, setPixelRatio(v) { r.ratio = v; } };
  return r;
}

test("the flag key and forced ratio are the documented constants", () => {
  assert.equal(LOW_EFFECTS_STORAGE_KEY, "cubistry-lowfx");
  assert.equal(lowEffectsPixelRatio, 0.5);
});

test("presentationEffects parses the opt-in flag and defaults to production", () => {
  assert.deepEqual(presentationEffects(storageWith(null)), PRODUCTION);
  assert.deepEqual(presentationEffects(undefined), PRODUCTION);
  assert.deepEqual(presentationEffects(null), PRODUCTION);
  assert.deepEqual(presentationEffects(storageWith("shadows")), { shadows: false, pixelRatio: null });
  assert.deepEqual(presentationEffects(storageWith("1")), { shadows: false, pixelRatio: lowEffectsPixelRatio });
  for (const garbage of ["", "0", "true", "SHADOWS", " 1", "shadows ", "2"])
    assert.deepEqual(presentationEffects(storageWith(garbage)), PRODUCTION, JSON.stringify(garbage));
  const throwing = { getItem() { throw new DOMException("denied", "SecurityError"); } };
  assert.deepEqual(presentationEffects(throwing), PRODUCTION);
});

test("only the exact flag key is read", () => {
  const asked = [];
  presentationEffects({ getItem: key => { asked.push(key); return "1"; } });
  assert.deepEqual(asked, ["cubistry-lowfx"]);
  assert.deepEqual(presentationEffects({ getItem: key => (key === "other" ? "1" : null) }), PRODUCTION);
});

test("configurePresentationRenderer keeps production behavior without the flag", () => {
  for (const [dpr, expected] of [[3, 2], [1.5, 1.5], [1, 1]])
    withDevicePixelRatio(dpr, () => {
      for (const storage of [undefined, null, storageWith(null), storageWith("bogus"),
        { getItem() { throw new Error("private mode"); } }]) {
        const renderer = fakeRenderer();
        configurePresentationRenderer(renderer, storage === undefined ? null : storage);
        assert.equal(renderer.ratio, expected);
        assert.equal(renderer.shadowMap.enabled, true);
        assert.equal(renderer.shadowMap.type, THREE.PCFShadowMap);
        assert.equal(renderer.outputColorSpace, THREE.SRGBColorSpace);
        assert.equal(renderer.toneMapping, THREE.NeutralToneMapping);
        assert.equal(renderer.toneMappingExposure, 1);
      }
    });
});

test('"shadows" disables only the shadow map and keeps the device pixel ratio', () => {
  withDevicePixelRatio(3, () => {
    const renderer = fakeRenderer();
    configurePresentationRenderer(renderer, storageWith("shadows"));
    assert.equal(renderer.shadowMap.enabled, false);
    assert.equal(renderer.ratio, 2);
    assert.equal(renderer.toneMapping, THREE.NeutralToneMapping);
    assert.equal(renderer.shadowMap.type, THREE.PCFShadowMap);
  });
});

test('"1" disables the shadow map and forces lowEffectsPixelRatio regardless of the device', () => {
  for (const dpr of [1, 2, 3])
    withDevicePixelRatio(dpr, () => {
      const renderer = fakeRenderer();
      configurePresentationRenderer(renderer, storageWith("1"));
      assert.equal(renderer.shadowMap.enabled, false);
      assert.equal(renderer.ratio, lowEffectsPixelRatio);
      assert.equal(renderer.shadowMap.type, THREE.PCFShadowMap);
    });
});

test("without a storage argument or a global localStorage the default is production", () => {
  assert.equal(typeof globalThis.localStorage === "undefined" || globalThis.localStorage.getItem("cubistry-lowfx") === null, true);
  withDevicePixelRatio(2, () => {
    const renderer = fakeRenderer();
    configurePresentationRenderer(renderer);
    assert.equal(renderer.shadowMap.enabled, true);
    assert.equal(renderer.ratio, 2);
  });
});
