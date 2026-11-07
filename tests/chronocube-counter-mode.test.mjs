import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { buildStudioManifest } from "../src/apps/chronocube/manifest.ts";
import { createStudioCounter } from "../src/apps/chronocube/counter-mode.ts";

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

test("studio counter loads design and certified route, applies the manifest and reports state", async () => {
  const states = [];
  const c = await createStudioCounter({
    base: "/",
    view,
    manifest: manifest(),
    onState: (v, b) => states.push([v, b]),
    resolveAssets,
  });
  assert.equal(c.currentValue, 0);
  assert(states.length > 0);
});

