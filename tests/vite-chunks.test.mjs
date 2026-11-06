import test from "node:test";
import assert from "node:assert/strict";
import config from "../vite.config.mjs";

// Vite 8 (Rolldown) accepts only the function form of output.manualChunks.
const manualChunks = config.build.rollupOptions.output.manualChunks;

test("build manualChunks is a function (Rolldown rejects the object form)", () => {
  assert.equal(typeof manualChunks, "function");
});

test("build manualChunks puts the three package in the three chunk", () => {
  assert.equal(manualChunks("/repo/node_modules/three/build/three.module.js"), "three");
  assert.equal(manualChunks("/repo/node_modules/three/src/core/Object3D.js"), "three");
});

test("build manualChunks leaves other modules to the default split", () => {
  assert.equal(manualChunks("/repo/node_modules/cubing/dist/index.js"), undefined);
  assert.equal(manualChunks("/repo/node_modules/three-mesh-bvh/index.js"), undefined);
  assert.equal(manualChunks("/repo/src/main.ts"), undefined);
});
