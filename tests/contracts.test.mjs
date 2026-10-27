import { prepareTestSolver } from "./helpers/shared-solver.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { CounterController } from "../src/apps/counter/controller.ts";
import { validateAssets, safeAssetPath } from "@cubistry/cube-assets";
import { validateState } from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  parseAlg,
  validatePresentation,
} from "@cubistry/cube-mechanics";
const raw = JSON.parse(
    readFileSync(new URL("../public/counter-design.v2.json", import.meta.url)),
  ),
  design = validateCounterDesign(raw);
test("versioned ingress rejects unsupported tags, values and unresolved image references", () => {
  for (const [field, value] of [
    ["schema", "other"],
    ["version", 999],
    ["puzzle", "5x5x5"],
  ])
    assert.throws(
      () => validateCounterDesign({ ...raw, [field]: value }),
      /Unsupported/,
    );
  const broken = structuredClone(raw);
  broken.prints.padded.stickers[0].assetId = "missing";
  assert.throws(() => validateCounterDesign(broken), /reference|Unresolved/);
  const badGoal = structuredClone(raw);
  badGoal.witnesses[0].value = 99;
  assert.throws(() => validateCounterDesign(badGoal));
});
test("asset references never coerce numbers or format arrays into valid strings", () => {
  const a = structuredClone(raw.assets);
  a.fonts[0].id = "0";
  a.documents[0].fontId = 0;
  assert.throws(() => validateAssets(a));
  const b = structuredClone(raw.assets);
  b.documents[0].id = "0";
  b.images.find((i) => i.kind === "text").documentId = 0;
  assert.throws(() => validateAssets(b));
  const c = structuredClone(raw.assets);
  c.images.find((i) => i.kind === "image").format = ["svg"];
  assert.throws(() => validateAssets(c));
});
test("asset metadata enforces same-origin paths, integrity, crop, fonts and material bounds", () => {
  for (const path of [
    "https://evil.test/0.svg",
    "//evil.test/0.svg",
    "/assets/../0.svg",
    "/assets/%2e%2e/0.svg",
    "data:image/svg+xml,hi",
    "/a.svg?x=1",
  ])
    assert.throws(() => safeAssetPath(path));
  for (const change of [
    (a) => (a.images.find((i) => i.kind === "image").sha256 = "bad"),
    (a) => (a.images.find((i) => i.kind === "text").crop = [0, 0, 999, 999]),
    (a) => (a.documents[0].fontId = "missing"),
    (a) => (a.materials[0].roughness = Infinity),
    (a) => a.images.push(a.images[0]),
  ]) {
    const bad = structuredClone(raw.assets);
    change(bad);
    assert.throws(() => validateAssets(bad));
  }
});
test("canonical JSON roundtrip preserves full cubie orientations and immutable source image references", () => {
  const p = design.prints.padded,
    s = applyMoves(initialState(p), parseAlg(design.witnesses[37].word));
  const decoded = validateState(JSON.parse(JSON.stringify(s)), p);
  assert.deepEqual(decoded, s);
  assert.equal(decoded.printId, p.id);
  assert.ok(Object.isFrozen(decoded.cubies));
});
test("counter adapter consumes one core state while a generic view only receives legal presentations", async () => {
  let presented, print, resolveFinal;
  const final = new Promise((r) => (resolveFinal = r));
  const view = {
    configure(p, s) {
      print = p;
      presented = s;
    },
    async animate(p) {
      validatePresentation(p, print);
      assert.equal(p.from, presented);
      presented = p.to;
    },
    resetCamera() {},
  };
  const controller = new CounterController(
    view,
    design,
    (value, busy, error) => {
      if (error) throw error;
      if (value === 17 && !busy) resolveFinal();
    },
    async (manifest, prints) => ({
      manifest: validateAssets(manifest, prints),
      images: new Map(),
      materials: new Map(),
      dispose() {},
    }),
    prepareTestSolver,
  );
  await controller.configure("A fixed title", true, 15);
  controller.request(99);
  controller.request(0);
  controller.request(17);
  await Promise.race([
    final,
    new Promise((_, r) => setTimeout(() => r(Error("Queue timed out")), 2000)),
  ]);
  assert.equal(controller.state, presented);
  assert.equal(controller.currentValue, 17);
  assert.equal(controller.config.label, "A fixed title");
  assert.ok(Object.isFrozen(controller.state));
});
test("lossless generic design/state JSON retains immutable images and frames", async () => {
  const { serializeDesignState, parseDesignState } = await import(
    "@cubistry/cube-assets"
  );
  const print = design.prints.unpadded,
    state = applyMoves(initialState(print), parseAlg(design.witnesses[7].word));
  const decoded = await parseDesignState(
    serializeDesignState(print, state, design.assets),
  );
  assert.deepEqual(decoded.state, state);
  assert.deepEqual(decoded.print, print);
  assert.deepEqual(decoded.assets, design.assets);
  await assert.rejects(
    parseDesignState('{"schema":"cubistry.design-state","version":99}'),
  );
});

test("configurable title identities remain linked to complementary document crops", () => {
  for (const mutate of [
    d=>{for(const id of ['title-left','title-right'])d.assets.images[d.assets.images.findIndex(i=>i.id===id)]={id,kind:'color',color:'#ffffff'};},
    d=>{d.assets.documents.push({...d.assets.documents[0],id:'other-title'});d.assets.images.find(i=>i.id==='title-left').documentId='other-title';},
    d=>{d.assets.images.find(i=>i.id==='title-right').crop=[0,0,256,256];},
    d=>{d.assets.images.find(i=>i.id==='title-left').crop=[0,0,128,256];},
  ]) {const broken=structuredClone(raw);mutate(broken);assert.throws(()=>validateCounterDesign(broken),/title/);}
});
