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
  const log = [], d = createDesign("picture");
  const load = async (manifest, prints, signal, base, local) => {
    log.push([manifest.images[0].id, prints.length, base, local]);
    return manifest.images[0].id.startsWith("face_") ? fakeLoaded(FACE_KEYS.map(faceImageAssetId), log, "faces") : fakeLoaded(["F_0_0"], log, "tiles");
  };
  const assets = await loadDesignAssets(load, d, "/b/", "LOCAL");
  assert.deepEqual(log, [["F_0_0", 1, "/b/", "LOCAL"], ["face_U", 0, "/b/", "LOCAL"]], "two loads; the faces carry no print");
  assert.ok(assets.images.has("F_0_0") && FACE_KEYS.every((k) => assets.images.has(faceImageAssetId(k))));
  assets.dispose();
  assert.deepEqual(log.slice(2), ["dispose tiles", "dispose faces"]);
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
