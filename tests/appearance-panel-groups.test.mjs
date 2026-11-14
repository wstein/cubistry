import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Group } from "three";
import { installAppearanceControls } from "../packages/cube-viewer/src/appearance.ts";
import { bindLightingSwitches } from "../packages/cube-viewer/src/lighting-switches.ts";
import { rotationHarness } from "./helpers/rotation-harness.mjs";

// Grouping of the Appearance panel: Construction and Rotation are always shown, the rest sits under "More";
// long hints are short hints plus a visible "i" button. The behavior of the settings is covered elsewhere
// (appearance, lighting-switches and rotation-binding tests).

class Element {
  constructor(tagName) { this.tagName = tagName; this.style = {}; this.children = []; this.listeners = {}; this.attributes = {}; this.className = ""; }
  append(...children) { for (const child of children) { if (typeof child !== "string") child.parent = this; this.children.push(child); } }
  insertBefore(node, ref) { node.parent = this; const at = this.children.indexOf(ref); this.children.splice(at < 0 ? this.children.length : at, 0, node); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  addEventListener(type, callback) { this.listeners[type] = callback; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}
const walk = (node, out = []) => { out.push(node); if (typeof node !== "string") for (const child of node.children ?? []) walk(child, out); return out; };
const textOf = node => typeof node === "string" ? node : (node.textContent ?? "") + (node.children ?? []).map(textOf).join("");

function withGlobals(run) {
  const names = ["document", "location", "localStorage"];
  const originals = names.map(name => Object.getOwnPropertyDescriptor(globalThis, name));
  const globals = { document: { createElement: tag => new Element(tag) }, location: { pathname: "/groups.html" },
    localStorage: { getItem: () => null, setItem() {} } };
  for (const name of names) Object.defineProperty(globalThis, name, { value: globals[name], configurable: true });
  try { return run(); } finally {
    names.forEach((name, index) => { if (originals[index]) Object.defineProperty(globalThis, name, originals[index]); else delete globalThis[name]; });
  }
}

test("Frame color, Style default and the lighting switches sit under a More disclosure; Stickerless stays outside", () => withGlobals(() => {
  const host = new Element("div"), controls = installAppearanceControls(host, () => {});
  const all = walk(host), more = all.find(node => node.className === "cube-appearance-more");
  assert(more, "a More container exists");
  assert.equal(more.tagName, "details", "native disclosure: keyboard accessible without extra script");
  assert.equal(textOf(more.children[0]), "More");
  assert.equal(more.children[0].tagName, "summary");
  const inMore = walk(more);
  assert(inMore.some(node => textOf(node).includes("Frame color")), "Frame color is under More");
  assert(inMore.some(node => node.tagName === "button" && node.textContent === "Style default"), "Style default is under More");
  const construction = all.find(node => node.tagName === "input" && node.attributes["aria-label"] === "Stickerless");
  assert(construction && !inMore.includes(construction), "Stickerless is not under More");
  // Late additions: lighting rows (marked) go under More, other nodes (Rotation) go before it.
  const section = more.parent, rotation = new Element("label"), row = new Element("label");
  row.className = "cube-appearance-more-item";
  controls.panel.append(rotation, row);
  assert(walk(more).includes(row), "marked lighting rows join More");
  assert(section.children.indexOf(rotation) < section.children.indexOf(more), "Rotation precedes More in DOM order");
}));

test("the lighting switches mark their rows for the More group", () => {
  const rows = [], panel = { append: (...r) => rows.push(...r) };
  const doc = { createElement: tag => new Element(tag) };
  bindLightingSwitches(panel, { setContactShadow() {}, setColorTemperature() {}, setFineShadowEdges() {} },
    { document: doc, pathname: "/t", storage: { getItem: () => null, setItem() {} } });
  assert.equal(rows.length, 3);
  assert(rows.every(row => row.className === "cube-appearance-more-item"));
});

test("long hints are short hints; the full text sits behind a visible, labeled i button that is hidden until asked", () => withGlobals(() => {
  const source = readFileSync("packages/cube-viewer/src/appearance.ts", "utf8");
  assert(!source.includes("Printed artwork is retained in both constructions."), "old long construction hint is gone");
  const host = new Element("div"); installAppearanceControls(host, () => {});
  const hint = walk(host).find(node => node.className === "cube-appearance-hint");
  assert(hint && textOf(hint).length <= 40, "short construction hint");

  const h = rotationHarness({ mode: "smart" });
  const row = h.panel.children.find(node => node.className === "cube-appearance-hint-row");
  const info = row?.children.find(node => node.className === "cube-appearance-info");
  const short = row?.children.find(node => node.className === "cube-appearance-hint");
  assert(info && short, "rotation has an info button and a short hint");
  assert.equal(info.tagName, "button");
  assert.equal(info.attributes["aria-label"], "About view rotation");
  assert.equal(info.attributes["aria-controls"], h.note.id);
  assert.equal(info.attributes["aria-expanded"], "false");
  assert.equal(h.note.hidden, true, "long text is collapsed by default");
  assert.match(h.note.textContent, /short wait/, "the full text stays in the note");
  assert(short.textContent.length <= 40);
  info.dispatchEvent(new Event("click"));
  assert.equal(h.note.hidden, false); assert.equal(info.attributes["aria-expanded"], "true");
  info.dispatchEvent(new Event("click"));
  assert.equal(h.note.hidden, true); assert.equal(info.attributes["aria-expanded"], "false");
  h.select.value = "free"; h.select.dispatchEvent(new Event("change"));
  assert.match(short.textContent, /No automatic return/);
  h.binding.dispose();
  assert(!h.panel.children.includes(row), "dispose removes the added nodes");
}));

test("sticker font fields land under More; the Stickers & Type / 3D & Viewport tabs are gone", () => withGlobals(() => {
  const source = readFileSync("packages/cube-viewer/src/appearance.ts", "utf8");
  assert(!source.includes("Stickers & Type") && !source.includes("3D & Viewport"));
  const host = new Element("div"), controls = installAppearanceControls(host, () => {});
  const fields = new Element("div"); fields.className = "studio-appearance-fields"; fields.textContent = "Display font";
  controls.panel.append(fields);
  const more = walk(host).find(node => node.className === "cube-appearance-more");
  assert(walk(more).includes(fields), "sticker fields are under More");
  assert(!walk(host).some(node => String(node.className).includes("cube-appearance-tab")), "no tab bar");
}));

test("rotation DOM order is reading order: control, hint with i button, then the collapsed details", () => {
  const h = rotationHarness({ mode: "smart" });
  const at = node => h.panel.children.indexOf(node);
  const row = h.panel.children.find(node => node.className === "cube-appearance-hint-row");
  assert(at(h.panel.children.find(node => node.tagName === "label")) < at(row));
  assert(at(row) < at(h.note), "the note follows the i button that controls it");
});

test("the counter spec counts disclosure blocks other than the Appearance panel and its More group", () => {
  assert.match(readFileSync("tests/browser/cube-first-ui.spec.mjs", "utf8"), /details:not\(\.cube-appearance\):not\(\.cube-appearance-more\)/);
});
