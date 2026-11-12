// SPDX-License-Identifier: AGPL-3.0-or-later
// Shared dock-slot controls: the chip radio group and the stop slider (src/apps/shell/choice-controls.ts).
import test from "node:test";
import assert from "node:assert/strict";
import { createChipGroup, createStopSlider } from "../src/apps/shell/choice-controls.ts";
import { FakeDocument } from "./helpers/fake-dom.mjs";

const OPTIONS = [
  { value: "open", label: "Open", symbol: "○", tone: "open" },
  { value: "running", label: "Running", symbol: "↻", tone: "running" },
  { value: "ok", label: "OK", symbol: "✓", tone: "ok" },
  { value: "error", label: "Error", symbol: "✕", tone: "error" },
  { value: "blocked", label: "Blocked", symbol: "⊘", tone: "blocked" },
];
const listen = (target, type, handler) => target.addEventListener(type, handler);

function chips(value = "open") {
  const doc = new FakeDocument();
  const calls = [];
  const g = createChipGroup(doc, listen, { id: "status-build", label: "BUILD", options: OPTIONS, value, onChange: (v) => calls.push(v) });
  const buttons = g.group.children;
  return { doc, g, calls, buttons };
}
const checked = (buttons) => buttons.filter((b) => b.getAttribute("aria-checked") === "true").map((b) => b.dataset.value);

test("chips: one radio per option with symbol and word, grouped and labeled, exactly one checked", () => {
  const { g, buttons } = chips("ok");
  assert.equal(g.group.id, "status-build");
  assert.equal(g.group.getAttribute("role"), "radiogroup");
  assert.equal(g.group.getAttribute("aria-labelledby"), "status-build-label");
  assert.equal(g.element.children[0].id, "status-build-label");
  assert.equal(g.element.children[0].textContent, "BUILD");
  assert.deepEqual(buttons.map((b) => b.dataset.value), OPTIONS.map((o) => o.value));
  for (const [i, b] of buttons.entries()) {
    assert.equal(b.tagName, "BUTTON");
    assert.equal(b.getAttribute("role"), "radio");
    assert.equal(b.getAttribute("type"), "button");
    assert.equal(b.children[0].textContent, OPTIONS[i].symbol, "symbol is visible");
    assert.equal(b.children[0].getAttribute("aria-hidden"), "true");
    assert.equal(b.children[1].textContent, OPTIONS[i].label, "word is visible");
    assert.equal(b.dataset.tone, OPTIONS[i].tone);
  }
  assert.deepEqual(checked(buttons), ["ok"]);
  assert.equal(g.group.dataset.value, "ok");
  assert.deepEqual(buttons.map((b) => b.getAttribute("tabindex")), ["-1", "-1", "0", "-1", "-1"], "roving tab stop on the checked chip");
});

test("chips: a click checks that chip, reports it once and does not report the checked chip again", () => {
  const { buttons, calls, g } = chips();
  buttons[3].click();
  assert.deepEqual(calls, ["error"]);
  assert.deepEqual(checked(buttons), ["error"]);
  assert.equal(g.group.dataset.value, "error");
  buttons[3].click();
  assert.deepEqual(calls, ["error"]);
  buttons[0].click();
  assert.deepEqual(calls, ["error", "open"]);
});

test("chips: arrow keys move checked state and focus, wrap at the ends; Home and End jump; other keys do nothing", () => {
  const { doc, buttons, calls } = chips("open");
  const key = (b, k) => {
    let prevented = false;
    b.fire("keydown", { key: k, preventDefault: () => (prevented = true) });
    return prevented;
  };
  assert.equal(key(buttons[0], "ArrowRight"), true);
  assert.deepEqual(checked(buttons), ["running"]);
  assert.equal(doc.activeElement, buttons[1]);
  key(buttons[1], "ArrowDown");
  assert.deepEqual(checked(buttons), ["ok"]);
  key(buttons[2], "ArrowLeft");
  key(buttons[1], "ArrowUp");
  assert.deepEqual(checked(buttons), ["open"]);
  key(buttons[0], "ArrowLeft");
  assert.deepEqual(checked(buttons), ["blocked"], "wraps from the first to the last");
  key(buttons[4], "ArrowRight");
  assert.deepEqual(checked(buttons), ["open"], "wraps from the last to the first");
  key(buttons[0], "End");
  assert.deepEqual(checked(buttons), ["blocked"]);
  key(buttons[4], "Home");
  assert.deepEqual(checked(buttons), ["open"]);
  assert.equal(key(buttons[0], "a"), false);
  assert.deepEqual(checked(buttons), ["open"]);
  assert.deepEqual(calls, ["running", "ok", "running", "open", "blocked", "open", "blocked", "open"]);
});

test("chips: set() repaints without reporting; an unknown value is ignored; disabling covers every chip and the group", () => {
  const { g, buttons, calls } = chips();
  g.set("blocked");
  assert.deepEqual(checked(buttons), ["blocked"]);
  assert.equal(buttons[4].getAttribute("tabindex"), "0");
  g.set("nope");
  assert.deepEqual(checked(buttons), ["blocked"]);
  assert.deepEqual(calls, []);
  g.setDisabled(true);
  assert.equal(g.group.getAttribute("aria-disabled"), "true");
  assert.ok(buttons.every((b) => b.disabled === true));
  g.setDisabled(false);
  assert.equal(g.group.getAttribute("aria-disabled"), "false");
  assert.ok(buttons.every((b) => b.disabled === false));
});

const STOPS = [2000, 1000, 500, 250, 100, 50, 10];
function slider(value = 250) {
  const doc = new FakeDocument();
  const calls = [];
  const s = createStopSlider(doc, listen, {
    id: "status-speed",
    label: "Quarter-turn time",
    stops: STOPS,
    value,
    ends: ["slow", "fast"],
    format: (ms) => `${ms} ms`,
    onChange: (ms) => calls.push(ms),
  });
  return { doc, s, calls };
}

test("slider: a range input over the seven stops, labeled, with the end words and the millisecond value", () => {
  const { s } = slider(250);
  assert.equal(s.input.tagName, "INPUT");
  assert.equal(s.input.getAttribute("type"), "range");
  assert.equal(s.input.id, "status-speed");
  assert.equal(s.input.getAttribute("min"), "0");
  assert.equal(s.input.getAttribute("max"), "6");
  assert.equal(s.input.getAttribute("step"), "1");
  const label = s.element.children[0];
  assert.equal(label.getAttribute("for"), "status-speed");
  assert.equal(label.textContent, "Quarter-turn time");
  assert.equal(s.input.value, "3");
  assert.equal(s.input.dataset.value, "250");
  assert.equal(s.input.getAttribute("aria-valuetext"), "250 ms");
  const text = s.element.descendants().filter((e) => e.tagName === "SPAN" || e.tagName === "OUTPUT").map((e) => e.textContent);
  assert.deepEqual(text, ["slow", "250 ms", "fast"]);
});

test("slider: every stop index maps to its millisecond value; slow is left, fast is right", () => {
  const { s, calls } = slider(250);
  for (const [i, ms] of STOPS.entries()) {
    s.input.value = String(i);
    s.input.fire("input");
    assert.equal(s.input.dataset.value, String(ms));
    assert.equal(s.input.getAttribute("aria-valuetext"), `${ms} ms`);
    assert.equal(s.element.descendants().find((e) => e.tagName === "OUTPUT").textContent, `${ms} ms`);
  }
  assert.deepEqual(calls, STOPS);
  s.input.fire("input");
  assert.equal(calls.length, STOPS.length, "an input event on the current stop is not reported again");
});

test("slider: set() repaints without reporting, ignores a value that is no stop; disabling reaches the input", () => {
  const { s, calls } = slider(250);
  s.set(10);
  assert.equal(s.input.value, "6");
  assert.equal(s.input.dataset.value, "10");
  s.set(123);
  assert.equal(s.input.dataset.value, "10");
  assert.deepEqual(calls, []);
  s.setDisabled(true);
  assert.equal(s.input.disabled, true);
  s.setDisabled(false);
  assert.equal(s.input.disabled, false);
});
