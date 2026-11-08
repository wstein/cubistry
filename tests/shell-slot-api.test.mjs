import test from "node:test";
import assert from "node:assert/strict";
import { createShellHost, createInertShell, SLOT_NUMBERS, SLOT_ROLES, STATUS_STATES } from "../src/apps/shell/slot-api.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// The mode-facing shell API (src/apps/shell/slot-api.ts), run against the small DOM stand-in in helpers/fake-dom.mjs.

const setup = () => {
  const { doc, regions } = fakeRegions();
  const host = createShellHost(regions, doc);
  let live = true;
  const shell = host.begin(() => live);
  return { doc, regions, host, shell, stale: () => (live = false) };
};
const fieldset = (doc, text) => {
  const e = doc.createElement("div");
  e.textContent = text;
  return e;
};

test("the five slots are named after the design: Action, Value, Mode, Motion, Print & appearance", () => {
  assert.deepEqual([...SLOT_NUMBERS], [1, 2, 3, 4, 5]);
  assert.deepEqual(Object.values(SLOT_ROLES), ["Action", "Value", "Mode", "Motion", "Print & appearance"]);
});

test("a filled slot is shown as a labeled group with its label as heading; empty slots stay hidden", () => {
  const { doc, regions, shell } = setup();
  shell.setSlot(2, { label: "Value", element: fieldset(doc, "x") });
  const s = regions.slots[2];
  assert.equal(s.hidden, false);
  assert.equal(s.getAttribute("role"), "group");
  const heading = s.children[0];
  assert.equal(heading.tagName, "H2");
  assert.equal(heading.textContent, "Value");
  assert.ok(heading.id);
  assert.equal(s.getAttribute("aria-labelledby"), heading.id);
  assert.equal(s.children[1].children[0].textContent, "x");
  for (const n of [1, 3, 4, 5]) {
    assert.equal(regions.slots[n].hidden, true, `slot ${n} stays hidden`);
    assert.equal(regions.slots[n].children.length, 0);
  }
});

test("slot headings get distinct ids so that every group has its own label", () => {
  const { doc, regions, shell } = setup();
  for (const n of SLOT_NUMBERS) shell.setSlot(n, { label: SLOT_ROLES[n], element: fieldset(doc, String(n)) });
  const ids = SLOT_NUMBERS.map((n) => regions.slots[n].children[0].id);
  assert.equal(new Set(ids).size, 5);
});

test("slots keep the fixed markup order 1 to 5 and the API sets no tabindex, so tab order equals slot order", () => {
  const { doc, regions, shell } = setup();
  for (const n of [5, 1, 3]) shell.setSlot(n, { label: "L" + n, element: fieldset(doc, "") });
  for (const n of SLOT_NUMBERS) {
    const slot = regions.slots[n];
    assert.equal(slot.dataset.slot, String(n));
    assert.equal(slot.hasAttribute("tabindex"), false);
    assert.ok(![slot, ...slot.descendants()].some((e) => e.hasAttribute("tabindex")));
  }
});

test("render mode gives the slot body to the mode and runs its cleanup when the slot changes or clears", () => {
  const { regions, shell } = setup();
  const log = [];
  shell.setSlot(1, { label: "Action", render: (body) => (log.push(["render", body.tagName]), () => log.push("cleanup1")) });
  assert.deepEqual(log, [["render", "DIV"]]);
  shell.setSlot(1, { label: "Action", render: () => () => log.push("cleanup2") });
  assert.deepEqual(log.slice(1), ["cleanup1"]);
  shell.clearSlot(1);
  assert.deepEqual(log.slice(2), ["cleanup2"]);
  assert.equal(regions.slots[1].hidden, true);
  assert.equal(regions.slots[1].children.length, 0);
  assert.equal(regions.slots[1].hasAttribute("aria-labelledby"), false);
  assert.equal(regions.slots[1].hasAttribute("role"), false);
});

test("setSlot rejects a bad slot number, an empty label and a spec with both or neither of element and render", () => {
  const { doc, shell } = setup();
  const el = fieldset(doc, "");
  assert.throws(() => shell.setSlot(0, { label: "A", element: el }), RangeError);
  assert.throws(() => shell.setSlot(6, { label: "A", element: el }), RangeError);
  assert.throws(() => shell.setSlot(1.5, { label: "A", element: el }), RangeError);
  assert.throws(() => shell.setSlot(1, { label: "", element: el }), TypeError);
  assert.throws(() => shell.setSlot(1, { label: "A" }), TypeError);
  assert.throws(() => shell.setSlot(1, { label: "A", element: el, render: () => {} }), TypeError);
});

test("clearSlots empties and hides every slot and runs every render cleanup once", () => {
  const { doc, regions, shell } = setup();
  let cleaned = 0;
  shell.setSlot(1, { label: "A", render: () => () => cleaned++ });
  shell.setSlot(4, { label: "B", element: fieldset(doc, "") });
  shell.clearSlots();
  assert.equal(cleaned, 1);
  for (const n of SLOT_NUMBERS) assert.equal(regions.slots[n].hidden, true);
  shell.clearSlots();
  assert.equal(cleaned, 1);
});

test("starting the next mode removes all content of the previous one, including the status, readout and nerd content", () => {
  const { doc, regions, host, shell } = setup();
  shell.setSlot(2, { label: "Value", element: fieldset(doc, "") });
  shell.setPrimaryAction({ label: "Run", onClick: () => {} });
  shell.setStatus("moving");
  shell.setReadout([{ role: "Seconds", value: "5" }]);
  shell.setNerd({ title: "Nerd", render: () => {} });
  shell.setHint("Not at the front");
  shell.setReferenceView(() => {});
  host.begin(() => true);
  assert.equal(regions.slots[2].hidden, true);
  assert.equal(regions.primary.hidden, true);
  assert.equal(regions.primary.children.length, 0);
  assert.equal(regions.status.children.length, 0);
  assert.equal(regions.readout.hidden, true);
  assert.equal(regions.nerd.hidden, true);
  assert.equal(regions.nerdToggle.hidden, true);
  assert.equal(regions.hints.hidden, true);
  assert.equal(regions.reference.hidden, true);
});

test("a mode that was switched away from cannot write: every setter is ignored", () => {
  const { doc, regions, host, shell: old } = setup();
  const next = host.begin(() => true);
  next.setSlot(1, { label: "New", element: fieldset(doc, "new") });
  next.setStatus("done", "New done");
  const oldElement = fieldset(doc, "old");
  doc.drain();
  old.setSlot(1, { label: "Old", element: oldElement });
  old.setSlot(2, { label: "Old", render: () => assert.fail("a stale render must not run") });
  old.clearSlots();
  old.setStatus("error", "Old failed");
  old.setPrimaryAction({ label: "Old", onClick: () => {} });
  old.setReadout([{ role: "Old", value: "1" }]);
  old.updateReadout(0, "2");
  old.setNerd({ title: "Old", render: () => assert.fail("a stale nerd render must not run") });
  old.setHint("old");
  old.setReferenceView(() => {});
  old.clearPrimaryAction();
  assert.deepEqual(doc.drain(), [], "the stale mode wrote nothing");
  assert.equal(regions.slots[1].children[0].textContent, "New");
  assert.equal(regions.status.children[0].textContent, "New done");
});

test("the isCurrent guard of the router stops a mode that is superseded during its async init", async () => {
  const { doc, regions, host } = setup();
  let current = true;
  const shell = host.begin(() => current);
  const init = (async () => {
    await Promise.resolve();
    current = false; // the router started the next switch while this init awaited
    shell.setSlot(3, { label: "Mode", element: fieldset(doc, "late") });
    shell.setStatus("ready");
  })();
  await init;
  assert.equal(regions.slots[3].hidden, true);
  assert.equal(regions.status.children.length, 0);
});

test("disposing a stale shell does not clear the content of the mode that replaced it", () => {
  const { doc, regions, host, shell: old } = setup();
  const next = host.begin(() => true);
  next.setSlot(1, { label: "New", element: fieldset(doc, "new") });
  old.dispose();
  assert.equal(regions.slots[1].hidden, false);
  assert.equal(regions.slots[1].children[0].textContent, "New");
});

test("begin also disposes the previous shell, so its listeners go even when no cleanup ran", () => {
  const { doc, host, shell: old } = setup();
  const target = doc.createElement("button");
  let calls = 0;
  old.listen(target, "click", () => calls++);
  let ended = 0;
  old.onDispose(() => ended++);
  host.begin(() => true);
  assert.equal(target.listenerCount("click"), 0);
  assert.equal(ended, 1);
  old.listen(target, "click", () => calls++);
  assert.equal(target.listenerCount("click"), 0, "a disposed shell registers nothing");
});

test("reset disposes the running shell and empties the regions", () => {
  const { doc, regions, host, shell } = setup();
  shell.setSlot(1, { label: "A", element: fieldset(doc, "") });
  host.reset();
  assert.equal(regions.slots[1].hidden, true);
  const late = fieldset(doc, "");
  doc.drain();
  shell.setSlot(1, { label: "B", element: late });
  assert.deepEqual(doc.drain(), []);
});

test("dispose clears the shell's own content, is idempotent and ends all writes", () => {
  const { doc, regions, shell } = setup();
  shell.setSlot(1, { label: "A", element: fieldset(doc, "") });
  shell.setStatus("ready");
  shell.dispose();
  shell.dispose();
  assert.equal(regions.slots[1].hidden, true);
  assert.equal(regions.status.children.length, 0);
  const late = fieldset(doc, "");
  doc.drain();
  shell.setSlot(1, { label: "B", element: late });
  assert.deepEqual(doc.drain(), []);
});

test("listen adds the listener and removes it on dispose; a stale callback never runs", () => {
  const { doc, shell, stale } = setup();
  const target = doc.createElement("button");
  let calls = 0;
  shell.listen(target, "click", () => calls++);
  target.click();
  assert.equal(calls, 1);
  stale();
  target.click();
  assert.equal(calls, 1, "the isCurrent guard blocks a stale handler");
  shell.dispose();
  assert.equal(target.listenerCount("click"), 0);
});

test("onDispose callbacks run once on dispose, in reverse order of registration", () => {
  const { shell } = setup();
  const log = [];
  shell.onDispose(() => log.push("a"));
  shell.onDispose(() => log.push("b"));
  shell.dispose();
  shell.dispose();
  assert.deepEqual(log, ["b", "a"]);
});

test("the primary action is one button; its click is guarded and removed on clear", () => {
  const { regions, shell, stale } = setup();
  let clicks = 0;
  const handle = shell.setPrimaryAction({ label: "Run", onClick: () => clicks++ });
  const button = regions.primary.children[0];
  assert.equal(regions.primary.hidden, false);
  assert.equal(button.tagName, "BUTTON");
  assert.equal(button.getAttribute("type"), "button");
  assert.equal(button.textContent, "Run");
  button.click();
  assert.equal(clicks, 1);
  handle.update({ label: "Stop" });
  assert.equal(button.textContent, "Stop");
  handle.update({ disabled: true });
  assert.equal(button.getAttribute("disabled"), "");
  handle.update({ disabled: false });
  assert.equal(button.hasAttribute("disabled"), false);
  shell.setPrimaryAction({ label: "Again", onClick: () => clicks++ });
  assert.equal(regions.primary.children.length, 1, "a second call replaces the button");
  assert.equal(button.listenerCount("click"), 0, "the replaced button lost its listener");
  const second = regions.primary.children[0];
  stale();
  second.click();
  assert.equal(clicks, 1, "a stale mode's primary action does nothing");
});

test("clearPrimaryAction hides the region and drops the button", () => {
  const { regions, shell } = setup();
  shell.setPrimaryAction({ label: "Run", onClick: () => {} });
  shell.clearPrimaryAction();
  assert.equal(regions.primary.hidden, true);
  assert.equal(regions.primary.children.length, 0);
});

test("the status is a single chip carrying the state; the design's seven states are supported", () => {
  assert.deepEqual([...STATUS_STATES], ["ready", "moving", "sync", "paused", "done", "warn", "error"]);
  const { regions, shell } = setup();
  for (const state of STATUS_STATES) {
    shell.setStatus(state);
    assert.equal(regions.status.children.length, 1);
    const chip = regions.status.children[0];
    assert.equal(chip.dataset.state, state);
    assert.ok(chip.textContent.length > 0, "the state is always written as text, never color alone");
  }
  shell.setStatus("paused", "Stopped at 5");
  assert.equal(regions.status.children[0].textContent, "Stopped at 5");
});

test("setStatus with the same state and text writes nothing, so a per-frame caller cannot flood the live region", () => {
  const { doc, regions, shell } = setup();
  shell.setStatus("moving", "Moving");
  doc.drain();
  for (let i = 0; i < 1000; i++) shell.setStatus("moving", "Moving");
  assert.deepEqual(doc.drain(), []);
  shell.setStatus("done", "Done");
  assert.ok(doc.drain().length > 0);
  assert.equal(regions.status.children.length, 1);
});

test("setStatus rejects an unknown state", () => {
  const { shell } = setup();
  assert.throws(() => shell.setStatus("busy"), TypeError);
});

test("the readout is plain text without live-region semantics and updates only changed values", () => {
  const { doc, regions, shell } = setup();
  shell.setReadout([{ role: "Hours", value: "12" }, { role: "Minutes", value: "30" }]);
  assert.equal(regions.readout.hidden, false);
  for (const e of [regions.readout, ...regions.readout.descendants()]) {
    assert.notEqual(e.tagName, "OUTPUT", "output has an implicit live region");
    assert.equal(e.hasAttribute("aria-live"), false);
    assert.equal(e.hasAttribute("role"), false);
  }
  assert.match(regions.readout.textContent, /Hours/);
  doc.drain();
  shell.updateReadout(1, "30");
  assert.deepEqual(doc.drain(), [], "an unchanged value is not written");
  shell.updateReadout(1, "31");
  assert.match(regions.readout.textContent, /31/);
  assert.doesNotMatch(regions.readout.textContent, /30/);
  assert.equal(doc.drain().length, 1);
  shell.updateReadout(7, "x");
  shell.clearReadout();
  assert.equal(regions.readout.hidden, true);
});

test("the nerd drawer stays hidden until the Nerd button is pressed; the toggle appears only with nerd content", () => {
  const { regions, shell } = setup();
  assert.equal(regions.nerdToggle.hidden, true);
  const log = [];
  shell.setNerd({ title: "Timing", render: (body) => (log.push("render"), body.textContent = "table", () => log.push("cleanup")) });
  assert.equal(regions.nerdToggle.hidden, false);
  assert.equal(regions.nerd.hidden, true, "hidden by default");
  assert.deepEqual(log, [], "a hidden drawer renders nothing");
  assert.equal(regions.nerdToggle.getAttribute("aria-pressed"), "false");
  regions.nerdToggle.click();
  assert.equal(regions.nerd.hidden, false);
  assert.equal(regions.nerdToggle.getAttribute("aria-pressed"), "true");
  assert.equal(regions.nerd.children[0].textContent, "Timing");
  assert.equal(regions.nerd.children[0].tagName, "H2");
  assert.equal(regions.nerd.textContent.includes("table"), true);
  assert.deepEqual(log, ["render"]);
  regions.nerdToggle.click();
  assert.equal(regions.nerd.hidden, true);
  assert.deepEqual(log, ["render", "cleanup"]);
  assert.equal(regions.nerd.children.length, 0);
});

test("refreshNerd re-renders only while the drawer is open", () => {
  const { regions, shell } = setup();
  let renders = 0;
  shell.setNerd({ title: "T", render: () => void renders++ });
  shell.refreshNerd();
  assert.equal(renders, 0);
  regions.nerdToggle.click();
  assert.equal(renders, 1);
  shell.refreshNerd();
  assert.equal(renders, 2);
});

test("the open state of the drawer follows the user across a mode switch; new content renders into the open drawer", () => {
  const { regions, host, shell } = setup();
  shell.setNerd({ title: "One", render: () => {} });
  regions.nerdToggle.click();
  const next = host.begin(() => true);
  assert.equal(regions.nerd.hidden, true, "no content, no drawer");
  assert.equal(regions.nerdToggle.hidden, true);
  next.setNerd({ title: "Two", render: () => {} });
  assert.equal(regions.nerd.hidden, false);
  assert.equal(regions.nerd.children[0].textContent, "Two");
});

test("the nerd toggle of a switched-away mode is inert and the host listener is not duplicated by begin", () => {
  const { regions, host } = setup();
  host.begin(() => true);
  host.begin(() => true);
  assert.equal(regions.nerdToggle.listenerCount("click"), 1);
  host.destroy();
  assert.equal(regions.nerdToggle.listenerCount("click"), 0);
});

test("hint and reference view hooks show only while set", () => {
  const { regions, shell, stale } = setup();
  shell.setHint("The view is not at the front.");
  assert.equal(regions.hints.hidden, false);
  assert.match(regions.hints.textContent, /not at the front/);
  shell.setHint(null);
  assert.equal(regions.hints.hidden, true);
  let calls = 0;
  shell.setReferenceView(() => calls++);
  assert.equal(regions.reference.hidden, false);
  regions.reference.click();
  assert.equal(calls, 1);
  stale();
  regions.reference.click();
  assert.equal(calls, 1);
  shell.setReferenceView(null);
});

test("the inert shell accepts every call and does nothing, so a mode runs without a host", () => {
  const shell = createInertShell();
  shell.setSlot(1, { label: "A", render: () => {} });
  shell.clearSlots();
  assert.equal(typeof shell.setPrimaryAction({ label: "A", onClick: () => {} }).update, "function");
  shell.setStatus("ready");
  shell.setReadout([]);
  shell.setNerd({ title: "A", render: () => {} });
  shell.dispose();
});

test("refreshNerd keeps the focused control and the scroll position of the open drawer", () => {
  const { doc, regions, shell } = setup();
  let rows = 3;
  shell.setNerd({
    title: "Timing",
    render: (body) => {
      const list = doc.createElement("div");
      list.append(doc.createElement("button"), doc.createElement("button"));
      body.append(list, ...Array.from({ length: rows }, () => doc.createElement("p")));
    },
  });
  regions.nerdToggle.click();
  const second = regions.nerd.children[1].children[0].children[1];
  second.focus();
  regions.nerd.scrollTop = 120;
  rows = 4;
  shell.refreshNerd();
  const again = regions.nerd.children[1].children[0].children[1];
  assert.notEqual(again, second, "the content is rendered anew");
  assert.equal(doc.activeElement, again, "focus returns to the same control");
  assert.equal(regions.nerd.scrollTop, 120);
});

test("refreshNerd leaves focus outside the drawer alone and does not steal it", () => {
  const { doc, regions, shell } = setup();
  shell.setNerd({ title: "T", render: (body) => body.append(doc.createElement("button")) });
  regions.nerdToggle.click();
  regions.nerdToggle.focus();
  shell.refreshNerd();
  assert.equal(doc.activeElement, regions.nerdToggle);
});

test("opening the drawer does not move focus into it", () => {
  const { doc, regions, shell } = setup();
  shell.setNerd({ title: "T", render: (body) => body.append(doc.createElement("button")) });
  regions.nerdToggle.focus();
  regions.nerdToggle.click();
  assert.equal(doc.activeElement, regions.nerdToggle);
});
