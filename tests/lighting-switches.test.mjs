import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { bindLightingSwitches, lightingStorageKey, readLightingOptions, defaultLightingOptions } from "../packages/cube-viewer/src/lighting-switches.ts";
import { appearanceStorageKey } from "../packages/cube-viewer/src/appearance.ts";
import { createPresentationStudio } from "../packages/cube-viewer/src/studio.ts";

class Node extends EventTarget {
  constructor(tag) { super(); this.tagName = tag; this.children = []; this.style = {}; this.checked = false; }
  append(...values) { for (const v of values) { if (typeof v !== "string") v.parent = this; this.children.push(v); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(x => x !== this); }
}
function fixture(saved) {
  const data = new Map(); if (saved !== undefined) data.set(lightingStorageKey("/t"), saved);
  const env = { document: { createElement: tag => new Node(tag) }, pathname: "/t",
    storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) } };
  const calls = [];
  const target = { setContactShadow: on => calls.push(["contact", on]), setColorTemperature: on => calls.push(["color", on]),
    setFineShadowEdges: on => calls.push(["fine", on]) };
  const panel = new Node("details");
  const binding = bindLightingSwitches(panel, target, env);
  const boxes = panel.children.map(label => label.children[0]);
  return { env, data, calls, panel, binding, boxes, labels: panel.children };
}
const toggle = (box, value) => { box.checked = value; box.dispatchEvent(new Event("change")); };

test("lighting storage: own versioned key, defaults, garbage falls back", () => {
  assert.deepEqual(defaultLightingOptions(), { contactShadow: true, colorTemperature: false, fineShadowEdges: false });
  assert.notEqual(lightingStorageKey("/a"), appearanceStorageKey("/a"));
  assert(lightingStorageKey("/" + "x".repeat(500)).length < 260);
  const key = lightingStorageKey("/t"), off = defaultLightingOptions();
  const read = raw => readLightingOptions({ getItem: () => raw }, key);
  for (const raw of [null, "", "{", "null", "[]", "7", '{"version":2,"contactShadow":true}', "x".repeat(300),
      '{"version":1,"contactShadow":"yes","colorTemperature":1,"fineShadowEdges":"x"}']) assert.deepEqual(read(raw), off, String(raw));
  // Objects stored before fineShadowEdges existed still load; a stored choice overrides the default.
  assert.deepEqual(read('{"version":1,"contactShadow":false,"colorTemperature":false}'), { contactShadow: false, colorTemperature: false, fineShadowEdges: false });
  assert.deepEqual(read('{"version":1,"contactShadow":true,"colorTemperature":true}'), { contactShadow: true, colorTemperature: true, fineShadowEdges: false });
  assert.deepEqual(read('{"version":1,"contactShadow":false,"colorTemperature":false,"fineShadowEdges":true}'), { contactShadow: false, colorTemperature: false, fineShadowEdges: true });
  assert.deepEqual(read('{"version":1,"fineShadowEdges":true}'), { contactShadow: true, colorTemperature: false, fineShadowEdges: true });
  assert.deepEqual(readLightingOptions(undefined, key), off);
  assert.deepEqual(readLightingOptions({ getItem() { throw Error("denied"); } }, key), off);
});

test("lighting switches: three labels, defaults applied once, independent persistence and dispose", () => {
  const f = fixture();
  assert.deepEqual(f.labels.map(l => l.children[1]), [" Contact shadow", " Warm studio light", " Fine shadow edges"]);
  assert.deepEqual(f.boxes.map(b => [b.type, b.checked]), [["checkbox", true], ["checkbox", false], ["checkbox", false]]);
  assert.deepEqual(f.calls, [["contact", true], ["color", false], ["fine", false]]);
  const stored = () => JSON.parse(f.data.get(lightingStorageKey("/t")));
  toggle(f.boxes[0], false);
  assert.deepEqual(stored(), { version: 1, contactShadow: false, colorTemperature: false, fineShadowEdges: false });
  toggle(f.boxes[1], true);
  assert.deepEqual(stored(), { version: 1, contactShadow: false, colorTemperature: true, fineShadowEdges: false });
  toggle(f.boxes[2], true);
  assert.deepEqual(stored(), { version: 1, contactShadow: false, colorTemperature: true, fineShadowEdges: true });
  assert.deepEqual(f.calls.slice(3), [["contact", false], ["color", true], ["fine", true]]);
  assert.equal([...f.data.keys()].length, 1, "appearance storage is not touched");
  assert(f.data.get(lightingStorageKey("/t")).length < 256);
  const again = fixture(f.data.get(lightingStorageKey("/t")));
  assert.deepEqual(again.boxes.map(b => b.checked), [false, true, true]);
  assert.deepEqual(again.calls, [["contact", false], ["color", true], ["fine", true]]);
  const old = fixture(JSON.stringify({ version: 1, contactShadow: true, colorTemperature: true }));
  assert.deepEqual(old.boxes.map(b => b.checked), [true, true, false]);
  f.binding.dispose();
  assert.equal(f.panel.children.length, 0);
  toggle(f.boxes[0], true);
  assert.equal(f.calls.length, 6, "no listener remains after dispose");
});

test("storage failures never break the switches", () => {
  const f = fixture(); f.env.storage.setItem = () => { throw Error("quota"); };
  assert.doesNotThrow(() => toggle(f.boxes[0], false));
  assert.deepEqual(f.calls.at(-1), ["contact", false]);
});

test("switches drive a real studio repeatedly without leaking scene objects", () => {
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1);
  const panel = new Node("details");
  const saved = JSON.stringify({ version: 1, contactShadow: false, colorTemperature: true, fineShadowEdges: true });
  const data = new Map([[lightingStorageKey("/t"), saved]]);
  const baseline = scene.children.length - 1; // the default contact plane is replaced by the stored choice
  const binding = bindLightingSwitches(panel, studio, { document: { createElement: t => new Node(t) }, pathname: "/t",
    storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) } });
  assert.equal(scene.children.length, baseline, "stored contact-shadow choice overrides the default");
  const casters = scene.children.filter(o => o.isDirectionalLight && o.castShadow);
  assert.deepEqual(casters.map(l => l.shadow.mapSize.x), [2048, 2048], "persisted fine edges applied");
  const [contact, color, fine] = panel.children.map(l => l.children[0]);
  for (let i = 0; i < 4; i++) {
    toggle(contact, true); toggle(contact, false); toggle(color, false); toggle(color, true); toggle(fine, false); toggle(fine, true);
  }
  assert.equal(scene.children.length, baseline);
  toggle(contact, true); assert.equal(scene.children.length, baseline + 1);
  toggle(fine, false); assert.deepEqual(casters.map(l => l.shadow.mapSize.x), [1024, 1024]);
  binding.dispose(); studio.dispose();
  assert.equal(scene.children.length, 0);
});
