import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadHsmDesign } from "../src/apps/hsm/design.ts";
import { loadHmDesign } from "../src/apps/hm/variant.ts";
import { loadMsDesign } from "../src/apps/ms/design.ts";
import { buildStudioManifest } from "../src/apps/chronocube/manifest.ts";
import { createStudioHsmController } from "../src/apps/chronocube/hsm-mode.ts";
import hsmPin from "../hsm-source.json" with { type: "json" };
import hmPin from "../hm-source.json" with { type: "json" };
import msPin from "../ms-source.json" with { type: "json" };

// Serve the files under public/ the way the deployed site does.
const realFetch = globalThis.fetch;
globalThis.fetch = async (url) => {
  const name = String(url).replace(/^.*\//, "");
  try {
    return new Response(readFileSync(`public/${name}`), {
      headers: { "content-type": "application/json" },
    });
  } catch {
    return new Response("", { status: 404 });
  }
};
test.after(() => {
  globalThis.fetch = realFetch;
});

const view = { configure() {}, resetCamera() {}, async animate() {} };
const seen = [];
const resolveAssets = async (manifest) => {
  seen.push(manifest);
  return { dispose() {} };
};
// Mirrors buildManifest() in src/chronocube.mjs after ensureProof(): studio manifest plus the counter design's assets.
const assets = JSON.parse(readFileSync("public/counter-design.v2.json")).assets;
const manifest = () =>
  buildStudioManifest("dseg7", "off", "same", "words-pascal", assets?.images ?? [], assets?.fonts ?? [], assets?.documents ?? [], assets?.materials ?? []);
const settle = async (c) => {
  for (let i = 0; c.busy && i < 2000; i++) await new Promise((r) => setImmediate(r));
  assert.equal(c.busy, false);
};

test("studio clock units: every H/M/S cube gets its own letter and loads its design", async () => {
  const design = await loadHsmDesign("/", hsmPin.runtimeSHA256);
  for (const letter of ["H", "M", "S"]) {
    const c = createStudioHsmController(view, design, manifest(), letter, () => {}, resolveAssets);
    assert.equal(c.letter, letter);
    await c.configure(7);
    assert.equal(c.currentValue, 7);
  }
});

test("studio single H/M/S counter reports state through onState", async () => {
  const design = await loadHsmDesign("/", hsmPin.runtimeSHA256);
  const states = [];
  const c = createStudioHsmController(view, design, manifest(), "M", (v, b) => states.push([v, b]), resolveAssets);
  await c.configure(0);
  c.request(1);
  await settle(c);
  assert.equal(c.currentValue, 1);
  assert(states.length > 0);
});

test("studio H/M variant loads with the hm design", async () => {
  const design = await loadHmDesign("/", hmPin.runtimeSHA256);
  const { createStudioSingleController } = await import("../src/apps/chronocube/hsm-mode.ts");
  for (const [letter, value] of [["H", 22], ["M", 41]]) {
    const c = createStudioSingleController("hm", view, design, manifest(), letter, () => {}, resolveAssets);
    await c.configure(value);
    assert.equal(c.currentValue, value);
  }
});

test("studio M/S single counter runs on MsController with the ms design", async () => {
  const { createStudioSingleController } = await import("../src/apps/chronocube/hsm-mode.ts");
  const design = await loadMsDesign("/", msPin.runtimeSHA256);
  for (const letter of ["M", "S"]) {
    const states = [];
    const c = createStudioSingleController("ms", view, design, manifest(), letter, (v, b) => states.push([v, b]), resolveAssets);
    await c.configure(5);
    assert.equal(c.currentValue, 5);
    assert(states.length > 0);
  }
});

test("studio hours cube counts 00-23: the range is applied before configure", async () => {
  const design = await loadHsmDesign("/", hsmPin.runtimeSHA256);
  const c = createStudioHsmController(view, design, manifest(), "H", () => {}, resolveAssets, 23);
  await c.configure(22);
  c.request(0);
  await settle(c);
  assert.equal(c.currentValue, 0);
});
