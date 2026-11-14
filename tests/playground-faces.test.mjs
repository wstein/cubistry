// SPDX-License-Identifier: AGPL-3.0-or-later
// The whole face images of the designs (Projected picture mode): hashes match the committed files, every picture design
// offers them, the manifest passes the asset validator, and the two loads are merged and released together.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { validateAssets } from "@cubistry/cube-assets";
import { faceImageAssetId, FACE_KEYS } from "@cubistry/cube-viewer";
import { pictureFaces, pastelFaces } from "../src/apps/playground/face-sets.ts";
import { faceImageManifest, withFaceImages, loadDesignAssets } from "../src/apps/playground/face-images.ts";
import { createDesign } from "../src/apps/playground/model.ts";
import { THEMES } from "../src/apps/playground/themes.ts";

test("the whole faces of picture and pastel are the committed files (hash, format, size)", () => {
  for (const faces of [pictureFaces, pastelFaces]) for (const key of FACE_KEYS) {
    const bytes = readFileSync(`public${faces[key].url}`);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), faces[key].sha256, faces[key].url);
    assert.equal(faces[key].format, "svg");
    assert.match(bytes.toString(), new RegExp(`width="${faces[key].size}"`));
  }
});

test("every picture design carries its six whole faces; the classic colors have none", () => {
  assert.equal(createDesign("classic").faces, undefined);
  for (const style of ["picture", "pastel", ...THEMES.map((t) => t.id)]) {
    const d = createDesign(style);
    assert.deepEqual(Object.keys(d.faces).sort(), ["B", "D", "F", "L", "R", "U"], style);
  }
  assert.equal(createDesign("picture").faces, pictureFaces);
  assert.equal(createDesign("bremen").faces, THEMES.find((t) => t.id === "bremen").faces);
});

test("the face manifest has the six ids face_U..face_B, no crops, and passes the asset validator", () => {
  const manifest = faceImageManifest(createDesign("bremen").faces);
  assert.deepEqual(manifest.images.map((i) => i.id).sort(), FACE_KEYS.map(faceImageAssetId).sort());
  assert.ok(manifest.images.every((i) => i.kind === "image" && !("crop" in i)));
  assert.equal(validateAssets(manifest, []).images.length, 6);
});

const fakeLoaded = (ids, log, name) => ({
  textureOrigin: "bottom-left", manifest: {}, images: new Map(ids.map((id) => [id, { id }])), materials: new Map(),
  dispose: () => log.push(`dispose ${name}`),
});
test("loadDesignAssets: tiles first, then the faces with their own load; the result holds both and releases both once", async () => {
  const log = [], d = createDesign("picture"), caches = new Set();
  const load = async (manifest, prints, signal, base, local, bytes) => {
    assert.ok(bytes instanceof Map, "all loads of a design share one bytes cache");
    caches.add(bytes);
    log.push([manifest.images[0].id, prints.length, base, local]);
    return manifest.images[0].id.startsWith("face_") ? fakeLoaded([manifest.images[0].id], log, "faces " + manifest.images[0].id) : fakeLoaded(["F_0_0"], log, "tiles");
  };
  const assets = await loadDesignAssets(load, d, "/b/", "LOCAL");
  assert.deepEqual(log, [["F_0_0", 1, "/b/", "LOCAL"], ...FACE_KEYS.map((k) => [`face_${k}`, 0, "/b/", "LOCAL"])], "tiles, then one load per face; the faces carry no print");
  assert.ok(assets.images.has("F_0_0") && FACE_KEYS.every((k) => assets.images.has(faceImageAssetId(k))));
  assert.equal(caches.size, 1, "one cache object for the seven loads");
  assets.dispose();
  assert.deepEqual(log.slice(7), ["dispose tiles", ...FACE_KEYS.map((k) => `dispose faces face_${k}`)]);
});

test("loadDesignAssets: a design without faces is one load; a failing face load releases the tiles", async () => {
  const log = [];
  const tiles = fakeLoaded(["F"], log, "tiles");
  assert.equal(await loadDesignAssets(async () => tiles, createDesign("classic"), "/"), tiles);
  let calls = 0;
  await assert.rejects(loadDesignAssets(async () => { if (calls++) throw Error("faces failed"); return tiles; }, createDesign("picture"), "/"), /faces failed/);
  assert.deepEqual(log, ["dispose tiles"]);
});

test("withFaceImages keeps the tile manifest and materials", () => {
  const tiles = fakeLoaded(["F_0_0"], [], "t"), faces = fakeLoaded(["face_U"], [], "f");
  const merged = withFaceImages(tiles, faces);
  assert.equal(merged.manifest, tiles.manifest); assert.equal(merged.materials, tiles.materials); assert.equal(merged.textureOrigin, "bottom-left");
  assert.deepEqual([...merged.images.keys()], ["F_0_0", "face_U"]);
});

test("the face images load one file per call: the asset loader counts a whole image twice, so six 1024 px faces in one call exceed 8388608 decoded pixels", async () => {
  const set = Object.fromEntries(FACE_KEYS.map((k) => [k, { url: `/x/${k}.webp`, format: "webp", sha256: "0".repeat(64), size: 1024 }]));
  const design = { assets: { images: [{ id: "F_0_0" }] }, print: {}, faces: set };
  const BUDGET = 8388608, calls = [];
  const load = async (manifest) => {
    const ids = manifest.images.map((i) => i.id);
    calls.push(ids);
    if (!ids.some((id) => id.startsWith("face_"))) return fakeLoaded(["F_0_0"], [], "tiles");
    const pixels = ids.length * 2 * 1024 * 1024; // decode reserve plus the bitmap reserve, per whole image
    assert.ok(pixels <= BUDGET, `a call of ${ids.length} faces needs ${pixels} pixels`);
    return fakeLoaded(ids, [], "faces");
  };
  const assets = await loadDesignAssets(load, design, "/");
  assert.equal(calls.filter((c) => c[0].startsWith("face_")).length, 6, "six face loads");
  assert.ok(FACE_KEYS.every((k) => assets.images.has(faceImageAssetId(k))));
});

test("loadDesignAssets: a failure in the middle of the face loads releases the tiles and the faces loaded so far", async () => {
  const log = []; let calls = 0;
  const load = async (manifest) => {
    if (++calls === 1) return fakeLoaded(["F_0_0"], log, "tiles");
    if (calls === 4) throw Error("third face failed");
    return fakeLoaded([manifest.images[0].id], log, manifest.images[0].id);
  };
  await assert.rejects(loadDesignAssets(load, createDesign("picture"), "/"), /third face failed/);
  assert.equal(log.length, 3);
  assert.ok(log.includes("dispose tiles"));
});
