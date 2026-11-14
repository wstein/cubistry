// SPDX-License-Identifier: AGPL-3.0-or-later
// Picture mode of the shared viewer: "Projected" is the default, "Per sticker" (the tile-per-sticker mapping) stays
// selectable; migration of stored settings and links; the menu under Pictures (not a Construction entry).
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PICTURE_MODE, PICTURE_MODES, PICTURES_PARAM, PICTURE_MODE_HELP, parsePictureMode, effectivePictureMode,
} from "../packages/cube-viewer/src/picture-mode.ts";
import {
  DEFAULT_APPEARANCE, validateAppearance, readAppearance, installAppearanceControls,
} from "../packages/cube-viewer/src/appearance.ts";

class Element {
  constructor(tagName) { this.tagName = tagName; this.style = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.className = ""; this.value = ""; }
  append(...children) { for (const child of children) { if (typeof child !== "string") child.parent = this; this.children.push(child); } }
  insertBefore(node, ref) { node.parent = this; const at = this.children.indexOf(ref); this.children.splice(at < 0 ? this.children.length : at, 0, node); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
const walk = (node, out = []) => { out.push(node); if (typeof node !== "string") for (const child of node.children ?? []) walk(child, out); return out; };
function withGlobals(storage, run) {
  const names = ["document", "location", "localStorage"];
  const originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const globals = { document: { createElement: tag => new Element(tag) }, location: { pathname: "/pictures.html" }, localStorage: storage };
  for (const name of names) Object.defineProperty(globalThis, name, { value: globals[name], configurable: true });
  try { return run(); } finally {
    names.forEach((name, index) => { if (originals[index]) Object.defineProperty(globalThis, name, originals[index]); else delete globalThis[name]; });
  }
}
const memory = (initial = null) => { const box = { value: initial, writes: [] }; return { box, getItem: () => box.value, setItem: (_k, v) => { box.value = v; box.writes.push(v); } }; };

test("the default is Projected; both modes are known; the old mode is Per sticker", () => {
  assert.equal(DEFAULT_PICTURE_MODE, "projected");
  assert.deepEqual([...PICTURE_MODES].sort(), ["per-sticker", "projected"]);
  assert.equal(PICTURES_PARAM, "pictures");
  assert.equal(PICTURE_MODE_HELP.projected, "Image projected across each face; only stickers carry it.");
});

test("parsePictureMode accepts exactly the two ids (case-insensitive) and nothing else", () => {
  assert.equal(parsePictureMode("projected"), "projected");
  assert.equal(parsePictureMode("Per-Sticker"), "per-sticker");
  for (const bad of ["", "tiles", "stickered", null, undefined, 3, "per sticker"]) assert.equal(parsePictureMode(bad), undefined, String(bad));
});

test("migration: no explicit choice gives Projected; an explicit URL or stored choice stays; the URL wins over the stored one", () => {
  assert.equal(effectivePictureMode({}), "projected");
  assert.equal(effectivePictureMode({ stored: "per-sticker" }), "per-sticker");
  assert.equal(effectivePictureMode({ url: "per-sticker" }), "per-sticker");
  assert.equal(effectivePictureMode({ stored: "projected" }), "projected");
  assert.equal(effectivePictureMode({ url: "projected", stored: "per-sticker" }), "projected");
  assert.equal(effectivePictureMode({ url: "per-sticker", stored: "projected" }), "per-sticker");
});

test("stored settings: version 1 without a picture mode is no explicit choice (Projected); a stored choice is kept; garbage is dropped", () => {
  const old = { version: 1, construction: "stickerless", frameColor: "#1a2b3c" };
  const a = readAppearance({ getItem: () => JSON.stringify(old) }, "k");
  assert.deepEqual(a, { construction: "stickerless", frameColor: "#1a2b3c" }, "old links and settings keep their exact value");
  assert.equal(effectivePictureMode({ stored: a.pictureMode }), "projected");
  const b = readAppearance({ getItem: () => JSON.stringify({ ...old, pictureMode: "per-sticker" }) }, "k");
  assert.equal(b.pictureMode, "per-sticker");
  assert.equal(effectivePictureMode({ stored: b.pictureMode }), "per-sticker");
  const c = readAppearance({ getItem: () => JSON.stringify({ ...old, pictureMode: "tiles" }) }, "k");
  assert.equal("pictureMode" in c, false, "an unknown stored value is no choice");
  assert.deepEqual(readAppearance({ getItem: () => "null" }, "k"), DEFAULT_APPEARANCE);
  assert.throws(() => validateAppearance({ construction: "stickered", frameColor: null, pictureMode: "tiles" }));
  assert.equal(validateAppearance({ construction: "stickered", frameColor: null, pictureMode: "per-sticker" }).pictureMode, "per-sticker");
  assert.equal("pictureMode" in validateAppearance({ construction: "stickered", frameColor: null }), false);
});

test("the menu: Pictures is a separate control with Projected and Per sticker; Construction keeps Stickered and Stickerless only", () => withGlobals(memory(), () => {
  const host = new Element("div"), seen = [];
  const controls = installAppearanceControls(host, value => seen.push(value));
  const selects = walk(host).filter(node => node.tagName === "select");
  const construction = selects.find(node => node.attributes["aria-label"] === "Cube construction");
  const pictures = selects.find(node => node.attributes["aria-label"] === "Picture mapping");
  assert(construction && pictures && construction !== pictures);
  assert.deepEqual(construction.children.map(o => o.value), ["stickered", "stickerless"]);
  assert.deepEqual(pictures.children.map(o => [o.value, o.textContent]), [["projected", "Projected"], ["per-sticker", "Per sticker"]]);
  const group = pictures.parent.parent ?? pictures.parent;
  assert(walk(group).some(node => node.textContent === "Pictures " || node.textContent === "Pictures"), "labelled Pictures");
  // hidden until a picture cube gives the viewer face images
  const wrap = walk(host).find(node => node.className === "cube-appearance-pictures");
  assert.equal(wrap.style.display, "none");
  controls.setPictureChoice({ available: true, mode: "projected" });
  assert.equal(wrap.style.display, "");
  assert.equal(pictures.value, "projected");
  const help = walk(host).find(node => node.className === "cube-appearance-picture-hint");
  assert.equal(help.textContent, "Image projected across each face; only stickers carry it.");
  controls.setPictureChoice({ available: true, mode: "per-sticker" });
  assert.equal(pictures.value, "per-sticker");
  assert.notEqual(help.textContent, PICTURE_MODE_HELP.projected);
  controls.setPictureChoice({ available: false, mode: "projected" });
  assert.equal(wrap.style.display, "none");
}));

test("choosing a picture mode is an explicit choice: reported and stored; the other settings are kept; nothing is stored before", () => {
  const storage = memory();
  withGlobals(storage, () => {
    const host = new Element("div"), seen = [], seenInfo = [];
    const controls = installAppearanceControls(host, (value, info) => { seen.push(value); seenInfo.push(info); });
    assert.equal(storage.box.writes.length, 0, "installing never stores a picture mode");
    assert.equal("pictureMode" in seen.at(-1), false);
    controls.setPictureChoice({ available: true, mode: "projected" });
    assert.equal(storage.box.writes.length, 0, "showing the effective mode is not a choice");
    const pictures = walk(host).find(node => node.tagName === "select" && node.attributes["aria-label"] === "Picture mapping");
    pictures.value = "per-sticker"; pictures.listeners.change();
    assert.equal(seen.at(-1).pictureMode, "per-sticker");
    assert.deepEqual(seenInfo.at(-1), { pictureChosen: true }, "reported as a menu choice");
    assert.equal(JSON.parse(storage.box.value).pictureMode, "per-sticker");
    assert.equal(JSON.parse(storage.box.value).construction, "stickered");
  });
  // a later install reads the explicit choice back
  withGlobals(storage, () => {
    const seen = [];
    installAppearanceControls(new Element("div"), value => seen.push(value));
    assert.equal(seen.at(-1).pictureMode, "per-sticker");
  });
});
