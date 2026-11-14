// SPDX-License-Identifier: AGPL-3.0-or-later
// Picture mode of the shared viewer: three valid looks (stickered per sticker, stickered projected, stickerless always
// projected). The menu is two checkboxes, Stickerless and Projected (checked and disabled while Stickerless is checked);
// migration of stored settings and links.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_PICTURE_MODE, PICTURE_MODES, PICTURES_PARAM, PROJECTED_HELP, parsePictureMode, effectivePictureMode,
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
  assert.equal(PROJECTED_HELP, "Image projected across each face; only stickers carry it.");
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

test("migration table: a stickerless cube is always projected, a stickered cube keeps its explicit per-sticker choice", () => {
  const rows = [ // [construction, url, stored, effective]
    ["stickered", undefined, undefined, "projected"],
    ["stickered", undefined, "projected", "projected"],
    ["stickered", undefined, "per-sticker", "per-sticker"],
    ["stickered", "per-sticker", undefined, "per-sticker"],
    ["stickered", "projected", "per-sticker", "projected"],
    ["stickerless", undefined, undefined, "projected"],
    ["stickerless", undefined, "per-sticker", "projected"],
    ["stickerless", "per-sticker", undefined, "projected"],
    ["stickerless", "per-sticker", "per-sticker", "projected"],
  ];
  for (const [construction, url, stored, expected] of rows)
    assert.equal(effectivePictureMode({ construction, url, stored }), expected, JSON.stringify([construction, url, stored]));
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

test("the menu: two checkboxes, Stickerless and Projected; no Construction or Picture mapping select", () => withGlobals(memory(), () => {
  const host = new Element("div"), seen = [];
  const controls = installAppearanceControls(host, value => seen.push(value));
  const all = walk(host);
  assert.equal(all.filter(node => node.tagName === "select").length, 0, "no select: the two choices are checkboxes");
  const boxes = all.filter(node => node.tagName === "input" && node.type === "checkbox");
  const stickerless = boxes.find(node => node.attributes["aria-label"] === "Stickerless");
  const projected = boxes.find(node => node.attributes["aria-label"] === "Projected");
  assert(stickerless && projected && stickerless !== projected);
  assert.equal(stickerless.checked, false, "default: stickered");
  assert.equal(projected.checked, true, "default: projected");
  assert.equal(projected.disabled, false);
  // hidden until a picture cube gives the viewer face images
  const wrap = all.find(node => node.className === "cube-appearance-pictures");
  assert.equal(wrap.style.display, "none");
  controls.setPictureChoice({ available: true, mode: "projected" });
  assert.equal(wrap.style.display, "");
  assert.equal(projected.checked, true);
  const help = all.find(node => node.className === "cube-appearance-picture-hint");
  assert.equal(help.textContent, "Image projected across each face; only stickers carry it.");
  controls.setPictureChoice({ available: true, mode: "per-sticker" });
  assert.equal(projected.checked, false);
  assert.equal(projected.disabled, false);
  controls.setPictureChoice({ available: false, mode: "projected" });
  assert.equal(wrap.style.display, "none");
}));

test("Stickerless checked: Projected is checked and disabled; unchecked again: Projected is the explicit choice, enabled", () => withGlobals(memory(), () => {
  const host = new Element("div"), seen = [];
  const controls = installAppearanceControls(host, value => seen.push(value));
  const boxes = walk(host).filter(node => node.tagName === "input" && node.type === "checkbox");
  const stickerless = boxes.find(node => node.attributes["aria-label"] === "Stickerless");
  const projected = boxes.find(node => node.attributes["aria-label"] === "Projected");
  controls.setPictureChoice({ available: true, mode: "per-sticker" });
  assert.equal(projected.checked, false);
  stickerless.checked = true; stickerless.listeners.change();
  assert.equal(seen.at(-1).construction, "stickerless");
  assert.equal(projected.checked, true, "stickerless is always projected");
  assert.equal(projected.disabled, true, "and the choice is locked");
  controls.setPictureChoice({ available: true, mode: "projected" }); // the viewer reports the effective mode
  assert.equal(projected.checked, true); assert.equal(projected.disabled, true);
  stickerless.checked = false; stickerless.listeners.change();
  assert.equal(seen.at(-1).construction, "stickered");
  assert.equal(projected.disabled, false);
  assert.equal(projected.checked, true, "the viewer shows the effective mode again");
  projected.checked = false; projected.listeners.change();
  assert.equal(seen.at(-1).pictureMode, "per-sticker");
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
    const pictures = walk(host).find(node => node.tagName === "input" && node.attributes["aria-label"] === "Projected");
    pictures.checked = false; pictures.listeners.change();
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
