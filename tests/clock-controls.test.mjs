import test from "node:test";
import assert from "node:assert/strict";
import { createShellHost } from "../src/apps/shell/slot-api.ts";
import { mountClockControls } from "../src/apps/clock/controls.ts";
import { CLOCK_SPEED_CHOICES_MS } from "../src/apps/clock/params.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// The Live Clock fills dock slot 2 (time zone), slot 4 (move time per cube) and slot 5 (label style) of the design's
// slot map through ModeShell (owner decision of 2026-11-08: the speed selects go to slot 4).

function setup(options = {}) {
  const { doc, regions } = fakeRegions();
  const host = createShellHost(regions, doc);
  const shell = host.begin(() => true);
  const calls = [];
  const controls = mountClockControls(shell, doc, {
    zone: "Europe/Berlin",
    speeds: [500, 250, 100],
    lettering: "words-pascal",
    onSpeed: (index, ms) => calls.push(["speed", index, ms]),
    onLettering: (value) => calls.push(["lettering", value]),
    ...options,
  });
  return { doc, regions, shell, calls, controls };
}
const byId = (regions, id) => Object.values(regions.slots).flatMap((s) => s.descendants()).find((e) => e.id === id);

test("slots 2, 4 and 5 are filled with the design's roles; slots 1 and 3 stay hidden", () => {
  const { regions } = setup();
  const label = (n) => regions.slots[n].children[0]?.textContent;
  assert.equal(label(2), "Time zone");
  assert.equal(label(4), "Move time, per cube");
  assert.equal(label(5), "Label style");
  for (const n of [2, 4, 5]) assert.equal(regions.slots[n].hidden, false);
  for (const n of [1, 3]) assert.equal(regions.slots[n].hidden, true);
});

test("the time zone is read-only text", () => {
  const { regions } = setup();
  const zone = byId(regions, "clock-zone");
  assert.equal(zone.textContent, "Europe/Berlin");
  assert.equal(zone.tagName, "SPAN", "plain text must not acquire the implicit status role of output");
  assert.notEqual(zone.tagName, "SELECT");
  assert.notEqual(zone.tagName, "INPUT");
});

test("slot 4 has one select per cube with the seven stops, the chosen value and a label that names the cube", () => {
  const { regions } = setup({ speeds: [250, 100, 50] });
  const expected = { hours: "250", minutes: "100", seconds: "50" };
  for (const [name, value] of Object.entries(expected)) {
    const select = byId(regions, name + "-speed");
    assert.equal(select.tagName, "SELECT");
    assert.equal(select.value, value);
    assert.deepEqual(select.children.map((o) => Number(o.getAttribute("value"))), [...CLOCK_SPEED_CHOICES_MS]);
    const label = regions.slots[4].find((e) => e.tagName === "LABEL" && e.getAttribute("for") === name + "-speed");
    assert.match(label.textContent, new RegExp(name, "i"));
  }
});

test("the controls start disabled and open together with setEnabled(true)", () => {
  const { regions, controls } = setup();
  const ids = ["hours-speed", "minutes-speed", "seconds-speed", "clock-lettering"];
  for (const id of ids) assert.equal(byId(regions, id).disabled, true, id);
  controls.setEnabled(true);
  for (const id of ids) assert.equal(byId(regions, id).disabled, false, id);
  controls.setEnabled(false);
  assert.equal(byId(regions, "seconds-speed").disabled, true);
});

test("changing a select reports the cube index with the milliseconds, or the lettering", () => {
  const { regions, calls } = setup();
  const seconds = byId(regions, "seconds-speed");
  seconds.value = "2000";
  seconds.fire("change");
  const hours = byId(regions, "hours-speed");
  hours.value = "10";
  hours.fire("change");
  const lettering = byId(regions, "clock-lettering");
  lettering.value = "symbols";
  lettering.fire("change");
  assert.deepEqual(calls, [["speed", 2, 2000], ["speed", 0, 10], ["lettering", "symbols"]]);
});

test("the lettering select offers the three sticker sets and shows the current one", () => {
  const { regions, controls } = setup({ lettering: "words" });
  const select = byId(regions, "clock-lettering");
  assert.deepEqual(select.children.map((o) => o.getAttribute("value")), ["symbols", "words-pascal", "words"]);
  assert.equal(select.value, "words");
  controls.setLettering("symbols");
  assert.equal(select.value, "symbols");
});

test("the listeners end with the mode and the controls add no tabindex and no live region", () => {
  const { regions, shell, controls } = setup();
  const select = byId(regions, "clock-lettering");
  assert.equal(select.listenerCount("change"), 1);
  shell.dispose();
  assert.equal(select.listenerCount("change"), 0);
  void controls;
  const { regions: fresh } = setup();
  const all = Object.values(fresh.slots).flatMap((s) => [s, ...s.descendants()]);
  assert.equal(all.some((e) => e.hasAttribute("tabindex") || e.hasAttribute("aria-live")), false);
});
