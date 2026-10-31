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
  const target = { setContactShadow: on => calls.push(["contact", on]), setColorTemperature: on => calls.push(["color", on]) };
  const panel = new Node("details");
  const binding = bindLightingSwitches(panel, target, env);
  const boxes = panel.children.map(label => label.children[0]);
  return { env, data, calls, panel, binding, boxes, labels: panel.children };
}
const toggle = (box, value) => { box.checked = value; box.dispatchEvent(new Event("change")); };

test("lighting storage: own versioned key, defaults off, garbage falls back", () => {
  assert.deepEqual(defaultLightingOptions(), { contactShadow: false, colorTemperature: false });
  assert.notEqual(lightingStorageKey("/a"), appearanceStorageKey("/a"));
  assert(lightingStorageKey("/" + "x".repeat(500)).length < 260);
  const key = lightingStorageKey("/t"), off = defaultLightingOptions();
  const read = raw => readLightingOptions({ getItem: () => raw }, key);
  for (const raw of [null, "", "{", "null", "[]", "7", '{"version":2,"contactShadow":true}', "x".repeat(300),
      '{"version":1,"contactShadow":"yes","colorTemperature":1}']) assert.deepEqual(read(raw), off, String(raw));
  assert.deepEqual(read('{"version":1,"contactShadow":true,"colorTemperature":false}'), { contactShadow: true, colorTemperature: false });
  assert.deepEqual(read('{"version":1,"contactShadow":true,"colorTemperature":true}'), { contactShadow: true, colorTemperature: true });
  assert.deepEqual(readLightingOptions(undefined, key), off);
  assert.deepEqual(readLightingOptions({ getItem() { throw Error("denied"); } }, key), off);
});

test("lighting switches: labels, defaults applied once, round trip persistence and dispose", () => {
  const f = fixture();
  assert.deepEqual(f.labels.map(l => l.children[1]), [" Contact shadow", " Warm studio light"]);
  assert.deepEqual(f.boxes.map(b => [b.type, b.checked]), [["checkbox", false], ["checkbox", false]]);
  assert.deepEqual(f.calls, [["contact", false], ["color", false]]);
  toggle(f.boxes[0], true); toggle(f.boxes[1], true);
  assert.deepEqual(f.calls.slice(2), [["contact", true], ["color", true]]);
  assert.deepEqual(JSON.parse(f.data.get(lightingStorageKey("/t"))), { version: 1, contactShadow: true, colorTemperature: true });
  assert.equal([...f.data.keys()].length, 1, "appearance storage is not touched");
  const again = fixture(f.data.get(lightingStorageKey("/t")));
  assert.deepEqual(again.boxes.map(b => b.checked), [true, true]);
  assert.deepEqual(again.calls, [["contact", true], ["color", true]]);
  f.binding.dispose();
  assert.equal(f.panel.children.length, 0);
  toggle(f.boxes[0], false);
  assert.equal(f.calls.length, 4, "no listener remains after dispose");
});

test("storage failures never break the switches", () => {
  const f = fixture(); f.env.storage.setItem = () => { throw Error("quota"); };
  assert.doesNotThrow(() => toggle(f.boxes[0], true));
  assert.deepEqual(f.calls.at(-1), ["contact", true]);
});

test("switches drive a real studio repeatedly without leaking scene objects", () => {
  const scene = new THREE.Scene(), studio = createPresentationStudio(scene, 1, 1);
  const baseline = scene.children.length, panel = new Node("details");
  const saved = JSON.stringify({ version: 1, contactShadow: true, colorTemperature: true });
  const data = new Map([[lightingStorageKey("/t"), saved]]);
  const binding = bindLightingSwitches(panel, studio, { document: { createElement: t => new Node(t) }, pathname: "/t",
    storage: { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v) } });
  assert.equal(scene.children.length, baseline + 1, "persisted contact shadow is applied");
  const [contact, color] = panel.children.map(l => l.children[0]);
  for (let i = 0; i < 4; i++) { toggle(contact, false); toggle(contact, true); toggle(color, false); toggle(color, true); }
  assert.equal(scene.children.length, baseline + 1);
  toggle(contact, false); assert.equal(scene.children.length, baseline);
  binding.dispose(); studio.dispose();
  assert.equal(scene.children.length, 0);
});
