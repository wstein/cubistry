import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { mountTenthControls, TENTH_STEP_INTERVALS } from "../src/apps/chronocube/tenth-controls.ts";
import { createShellHost, SLOT_ROLES } from "../src/apps/shell/slot-api.ts";
import { slotsOf, MIGRATION } from "../src/apps/shell/slot-map.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// The 1/10-Second Counter is the reference user of the ModeShell API: its controls live in the dock slots.

const rig = () => {
  const { doc, regions } = fakeRegions();
  const host = createShellHost(regions, doc);
  const shell = host.begin(() => true);
  const calls = [];
  const handlers = {
    set: (v) => calls.push(["set", v]),
    step: (n) => calls.push(["step", n]),
    setStepInterval: (ms) => calls.push(["interval", ms]),
  };
  mountTenthControls(shell, doc, handlers);
  const body = (n) => regions.slots[n].children[1];
  const all = (n) => regions.slots[n].descendants();
  return { doc, regions, host, shell, calls, body, all };
};

test("the controls fill the slots the design gives the 1/10-Second Counter and leave the others hidden", () => {
  const { regions } = rig();
  const filled = [1, 2, 3, 4, 5].filter((n) => !regions.slots[n].hidden);
  assert.deepEqual(filled, slotsOf("tenth"));
  assert.equal(regions.slots[5].hidden, true, "no print and appearance entry for this mode");
  assert.deepEqual(filled.map((n) => regions.slots[n].children[0].textContent), ["Step", "Value", "Direction", "Step speed"]);
  for (const n of filled) assert.equal(regions.slots[n].dataset.role, SLOT_ROLES[n]);
});

test("the tenth mode is marked migrated in the inventory", () => {
  assert.equal(MIGRATION.tenth, "migrated");
});

test("value buttons 0 to 9 set the digit", () => {
  const { all, calls } = rig();
  const buttons = all(2).filter((e) => e.tagName === "BUTTON");
  assert.deepEqual(buttons.map((b) => b.textContent), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  buttons[7].click();
  assert.deepEqual(calls, [["set", 7]]);
});

test("the step buttons move five steps back or forth, following the direction setting", () => {
  const { all, calls } = rig();
  const [minus, plus] = all(1).filter((e) => e.tagName === "BUTTON");
  assert.deepEqual([minus.textContent, plus.textContent], ["-5 Steps", "+5 Steps"]);
  plus.click();
  minus.click();
  const direction = all(3).find((e) => e.tagName === "SELECT");
  assert.deepEqual([...direction.children.map((o) => [o.getAttribute("value"), o.textContent])], [["1", "Forward (+1)"], ["-1", "Reverse (-1)"]]);
  direction.value = "-1";
  direction.fire("change");
  plus.click();
  minus.click();
  assert.deepEqual(calls, [["step", 5], ["step", -5], ["step", -5], ["step", 5]]);
});

test("the step speed select offers the four intervals, defaults to 250 ms and reports the chosen number", () => {
  const { all, calls } = rig();
  const speed = all(4).find((e) => e.tagName === "SELECT");
  assert.deepEqual(speed.children.map((o) => o.getAttribute("value")), TENTH_STEP_INTERVALS.map(String));
  assert.deepEqual([...TENTH_STEP_INTERVALS], [50, 100, 250, 500]);
  assert.equal(speed.value, "250");
  speed.value = "250";
  speed.fire("change");
  assert.deepEqual(calls, [["interval", 250]]);
});

test("each select has a label that points at it", () => {
  const { all } = rig();
  for (const n of [3, 4]) {
    const elements = all(n);
    const select = elements.find((e) => e.tagName === "SELECT");
    const label = elements.find((e) => e.tagName === "LABEL");
    assert.ok(select.id);
    assert.equal(label.getAttribute("for"), select.id);
  }
});

test("a mode switch removes the controls and their listeners; a stale click does nothing", () => {
  const { regions, host, all, calls } = rig();
  const buttons = [1, 2].flatMap((n) => all(n).filter((e) => e.tagName === "BUTTON"));
  const selects = [3, 4].flatMap((n) => all(n).filter((e) => e.tagName === "SELECT"));
  host.begin(() => true);
  for (const n of [1, 2, 3, 4]) assert.equal(regions.slots[n].hidden, true);
  for (const b of buttons) assert.equal(b.listenerCount("click"), 0);
  for (const s of selects) assert.equal(s.listenerCount("change"), 0);
  buttons[0].click();
  assert.deepEqual(calls, []);
});

test("initTenthMode takes the shell, mounts the slot controls and no longer renders the HUD", () => {
  const source = readFileSync("src/chronocube.mjs", "utf8");
  const start = source.indexOf("async function initTenthMode(");
  const body = source.slice(start, source.indexOf("\n}\n", start));
  assert.match(body.split("{")[0], /\(isCurrent, shell\)/);
  assert.match(body, /mountTenthControls\(shell,/);
  assert.doesNotMatch(body, /renderStudioHud|studio-controls|tenth-quick-btn|tenth-speed-select|tenth-direction-toggle/);
  assert.match(source, /tenth: \(isCurrent, _params, shell\) => initTenthMode\(isCurrent, shell\)/);
});

test("the HUD-era styles of the old tenth controls are gone from the studio stylesheet", () => {
  assert.doesNotMatch(readFileSync("src/chronocube.css", "utf8"), /tenth-(quick|step-actions|toggle-row)/);
});
