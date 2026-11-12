// SPDX-License-Identifier: AGPL-3.0-or-later
// revealPlayback sizes the cube scene on a phone-height stage. Fake DOM, numbers chosen so each term matters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { revealPlayback } from "../src/apps/calendar7/playback-visibility.ts";

// line 20, padding 0, panel 140 high with a 40 high word: overhead 100.
// room = (clientHeight - 32) - 100 - 2 * 20 - 0 = clientHeight - 172.
function run({ clientHeight, sticky, pickerHeight = 50, margins = 10, sceneHeight = 400 }) {
  const rect = (height, top = 0) => () => ({ height, top, bottom: top + height });
  const sets = [];
  const port = { clientHeight, scrollTop: 0, style: { setProperty: (k, v) => sets.push([k, v]), removeProperty() {} }, getBoundingClientRect: rect(clientHeight) };
  const picker = { getBoundingClientRect: rect(pickerHeight) };
  const root = { querySelector: (s) => (s === ".c7-date-choice" ? picker : null) };
  const scene = { closest: (s) => (s === ".shell-stage" ? port : null), getBoundingClientRect: rect(sceneHeight) };
  const panel = { closest: (s) => (s === ".c7-root" ? root : null), getBoundingClientRect: rect(140, 500) };
  const word = { style: { removeProperty() {} }, getBoundingClientRect: rect(40) };
  const styles = new Map([
    [word, { paddingTop: "0px", paddingBottom: "0px", lineHeight: "20px", maxHeight: "224px" }],
    [picker, { marginTop: `${margins}px`, marginBottom: "0px" }],
    [scene, { position: sticky ? "sticky" : "relative" }],
  ]);
  const saved = globalThis.getComputedStyle;
  globalThis.getComputedStyle = (el) => styles.get(el);
  try { revealPlayback(scene, panel, word); } finally { globalThis.getComputedStyle = saved; }
  return sets.filter(([k]) => k === "--c7-playback-scene-height").map(([, v]) => v).at(-1);
}

test("a short phone stage gives the cube at least 72px when the picker block is large", () => {
  // pickerBlock 60, room -50: floor is max(72, 120 - 60) = 72.
  assert.equal(run({ clientHeight: 122 }), "72px");
});
test("the picker row lowers the 120px floor by its own height down to 72px", () => {
  // pickerBlock 20, room -50: floor is max(72, 120 - 20) = 100.
  assert.equal(run({ clientHeight: 122, pickerHeight: 20, margins: 0 }), "100px");
});
test("a tall stage gives the cube its height minus the picker block", () => {
  // pickerBlock 60, scene 400, room 828: min(400 - 60, 828) = 340.
  assert.equal(run({ clientHeight: 1000 }), "340px");
});
test("a stage that fits part of the cube is limited by the remaining room", () => {
  // pickerBlock 60, scene 400, room 200: min(340, 200) = 200.
  assert.equal(run({ clientHeight: 372 }), "200px");
});
test("a sticky scene ignores the picker block and keeps the 120px floor", () => {
  assert.equal(run({ clientHeight: 122, sticky: true }), "120px");
  assert.equal(run({ clientHeight: 1000, sticky: true }), "400px");
});
