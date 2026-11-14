// SPDX-License-Identifier: AGPL-3.0-or-later
// CubeViewer and the picture mode: Projected is the default for a design that has whole face images, Per sticker stays
// selectable, an explicit URL or stored choice is honored, a menu choice beats the URL. A shared viewport needs no WebGL.
import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { CubeViewer } from "@cubistry/cube-viewer";
import { createDesign } from "../src/apps/playground/model.ts";

const FACES = ["U", "R", "F", "D", "L", "B"];
function viewer() {
  return new CubeViewer({}, { renderer: {}, scene: new THREE.Group(), camera: new THREE.PerspectiveCamera(), position: [0, 0, 0] });
}
function assetsOf(design, withFaces) {
  const images = new Map(design.assets.images.map((a) => [a.id, { width: 4, height: 4 }]));
  if (withFaces) for (const f of FACES) images.set(`face_${f}`, { width: 8, height: 8 });
  return { textureOrigin: "bottom-left", manifest: design.assets, images, materials: new Map(design.assets.materials.map((m) => [m.id, m])), dispose() {} };
}
const stickerMaterials = (v) => { const out = new Map(); v.presentation.traverse((o) => { if (o.userData.stickerId !== undefined) out.set(o.userData.stickerId, o.material); }); return out; };

test("a design with whole face images shows Projected by default; Per sticker restores the tile materials", () => {
  const d = createDesign("picture"), v = viewer();
  v.configure(d.print, d.target, assetsOf(d, true));
  assert.equal(v.picturesAvailable, true);
  assert.equal(v.pictureMode, "projected");
  const projected = stickerMaterials(v);
  for (const m of projected.values()) assert.ok(m.map.repeat.x < 1 && m.map.repeat.x > 0.3, "a window of the face image, not a tile");
  const tileMaps = new Set([...projected.values()].map((m) => m.map.source));
  assert.ok(tileMaps.size <= 6, "at most the six face images are sources");
  v.setAppearance({ construction: "stickered", frameColor: null, pictureMode: "per-sticker" });
  assert.equal(v.pictureMode, "per-sticker");
  for (const m of stickerMaterials(v).values()) assert.equal(m.map.repeat.x, 1, "the tile texture of the sticker itself");
  v.setAppearance({ construction: "stickered", frameColor: null });
  assert.equal(v.pictureMode, "projected", "no explicit choice: the default");
  v.destroy();
});

test("a design without whole face images (colors, tiles only) keeps the tile mapping and offers no Pictures choice", () => {
  const d = createDesign("classic"), v = viewer();
  v.configure(d.print, d.target, assetsOf(d, false));
  assert.equal(v.picturesAvailable, false);
  for (const m of stickerMaterials(v).values()) assert.equal(m.map.repeat.x, 1);
  v.destroy();
});

test("URL: an explicit mode is honored before any stored choice; a menu choice afterwards beats the URL", () => {
  const d = createDesign("picture"), v = viewer();
  v.setAppearance({ construction: "stickered", frameColor: null, pictureMode: "projected" }); // stored explicit choice
  v.configure(d.print, d.target, assetsOf(d, true));
  v.setPictureModeFromUrl("per-sticker");
  assert.equal(v.pictureMode, "per-sticker", "URL wins over the stored choice");
  for (const m of stickerMaterials(v).values()) assert.equal(m.map.repeat.x, 1);
  v.setAppearance({ construction: "stickered", frameColor: null, pictureMode: "projected" }, true);
  assert.equal(v.pictureMode, "projected", "the menu is a newer choice than the URL");
  v.setPictureModeFromUrl(undefined);
  assert.equal(v.pictureMode, "projected");
  v.destroy();
});

test("a stored Per sticker choice stays after a new design is loaded; the construction change keeps the mode", () => {
  const d = createDesign("picture"), v = viewer();
  v.setAppearance({ construction: "stickered", frameColor: null, pictureMode: "per-sticker" });
  v.configure(d.print, d.target, assetsOf(d, true));
  assert.equal(v.pictureMode, "per-sticker");
  v.setAppearance({ construction: "stickerless", frameColor: null, pictureMode: "per-sticker" });
  assert.equal(v.pictureMode, "per-sticker");
  const e = createDesign("pastel");
  v.configure(e.print, e.target, assetsOf(e, true));
  assert.equal(v.pictureMode, "per-sticker");
  v.destroy();
});

test("Projected and the construction: stickerless works with both picture modes", () => {
  const d = createDesign("picture"), v = viewer();
  v.configure(d.print, d.target, assetsOf(d, true));
  v.setAppearance({ construction: "stickerless", frameColor: null });
  assert.equal(v.pictureMode, "projected");
  v.setAppearance({ construction: "stickerless", frameColor: null, pictureMode: "per-sticker" });
  v.setAppearance({ construction: "stickered", frameColor: null });
  assert.equal(v.pictureMode, "projected");
  v.destroy();
});
