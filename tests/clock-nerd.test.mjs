import test from "node:test";
import assert from "node:assert/strict";
import { createShellHost } from "../src/apps/shell/slot-api.ts";
import { createClockNerd } from "../src/apps/clock/nerd.ts";
import { ClockMoveStatistics } from "../src/apps/clock/statistics.ts";
import { fakeRegions } from "./helpers/fake-dom.mjs";

// The Nerd drawer of the Live Clock (owner decision of 2026-11-08): effective values only, no controls, the
// committed-moves table with the Reset button. `nerd=1` opens it through the shell host.

function setup({ open = true } = {}) {
  const { doc, regions } = fakeRegions();
  const host = createShellHost(regions, doc, { nerdOpen: open });
  const shell = host.begin(() => true);
  const resets = [];
  const nerd = createClockNerd(doc, { onReset: () => resets.push(1) });
  shell.setNerd(nerd.spec);
  return { doc, regions, shell, nerd, resets };
}
const byId = (regions, id) => regions.nerd.descendants().find((e) => e.id === id);
const snapshot = (moves) => {
  const stats = new ClockMoveStatistics(3);
  return { stats, snap: () => stats.snapshot(), moves };
};

test("the drawer has a title, no control except Reset, and shows the effective timing per cube", () => {
  const { regions, nerd } = setup();
  nerd.setTiming(2, "Scheduled: quarter 100.0 ms · half 200.0 ms");
  assert.match(regions.nerd.children[0].textContent, /Live clock/i);
  assert.equal(byId(regions, "seconds-timing").textContent, "Scheduled: quarter 100.0 ms · half 200.0 ms");
  const controls = regions.nerd.descendants().filter((e) => ["SELECT", "INPUT", "BUTTON"].includes(e.tagName));
  assert.deepEqual(controls.map((e) => e.id), ["reset-clock-moves"]);
});

test("the table keeps the headings, the live-region markup and the ids of the Clock page; the total has no average", () => {
  const { regions } = setup();
  const heads = regions.nerd.descendants().filter((e) => e.tagName === "TH" && e.getAttribute("scope") === "col");
  assert.deepEqual(heads.map((h) => h.textContent), ["Cube", "Total HTM", "Cube rotations", "Last tick", "Max / tick", "Average / tick"]);
  const section = byId(regions, "clock-stats");
  assert.equal(section.getAttribute("role"), "status");
  assert.equal(section.getAttribute("aria-live"), "off");
  assert.equal(section.getAttribute("aria-label"), "Clock moves");
  assert.match(regions.nerd.descendants().find((e) => e.tagName === "CAPTION").textContent, /Committed moves this session/);
  for (const name of ["hours", "minutes", "seconds"])
    for (const kind of ["session-moves", "session-rotations", "last-moves", "max-moves", "mean-moves"])
      assert.ok(byId(regions, `${name}-${kind}`), `${name}-${kind}`);
  for (const kind of ["session-moves", "session-rotations", "last-moves", "max-moves"]) assert.ok(byId(regions, `total-${kind}`));
  assert.equal(byId(regions, "total-mean-moves"), undefined);
  assert.equal(byId(regions, "total-session-moves").textContent, "0");
  assert.equal(byId(regions, "seconds-last-moves").textContent, "—");
});

test("setStats writes the numbers and data-value; Reset calls the handler", () => {
  const { regions, nerd, resets } = setup();
  const fake = {
    revision: 1,
    units: [0, 1, 2].map((i) => ({ session: { htm: 5 + i, rotations: 0 }, last: i === 2 ? 3 : null, max: i === 2 ? 4 : null, changes: 1, mean: i === 2 ? 2.5 : null })),
    total: { session: { htm: 18, rotations: 0 }, last: 3, max: 4, changes: 1, mean: null },
  };
  nerd.setStats(fake);
  assert.equal(byId(regions, "seconds-session-moves").textContent, "7");
  assert.equal(byId(regions, "seconds-session-moves").dataset.value, "7");
  assert.equal(byId(regions, "seconds-mean-moves").textContent, "2.50");
  assert.equal(byId(regions, "hours-last-moves").textContent, "—");
  assert.equal(byId(regions, "hours-last-moves").dataset.value, "");
  assert.equal(byId(regions, "total-session-moves").textContent, "18");
  byId(regions, "reset-clock-moves").click();
  assert.deepEqual(resets, [1]);
});

test("a drawer opened later shows the latest values, and a closed drawer is not touched", () => {
  const { regions, nerd } = setup({ open: false });
  assert.equal(regions.nerd.children.length, 0);
  nerd.setTiming(0, "Scheduled: quarter 500.0 ms · half 1000.0 ms");
  nerd.setStats({
    revision: 2,
    units: [0, 1, 2].map(() => ({ session: { htm: 4, rotations: 0 }, last: 4, max: 4, changes: 1, mean: 4 })),
    total: { session: { htm: 12, rotations: 0 }, last: 4, max: 4, changes: 1, mean: null },
  });
  assert.equal(regions.nerd.children.length, 0);
  regions.nerdToggle.click();
  assert.equal(byId(regions, "hours-timing").textContent, "Scheduled: quarter 500.0 ms · half 1000.0 ms");
  assert.equal(byId(regions, "total-session-moves").textContent, "12");
});

test("after the drawer closes the nodes are released and later updates write nothing", () => {
  const { doc, regions, nerd } = setup();
  const node = byId(regions, "hours-timing");
  regions.nerdToggle.click();
  assert.equal(regions.nerd.children.length, 0);
  doc.drain();
  nerd.setTiming(0, "x");
  assert.deepEqual(doc.drain(), []);
  assert.equal(node.textContent, "");
});

test("the reset button can be disabled until the cubes are ready", () => {
  const { regions, nerd } = setup();
  nerd.setResetEnabled(false);
  assert.equal(byId(regions, "reset-clock-moves").disabled, true);
  nerd.setResetEnabled(true);
  assert.equal(byId(regions, "reset-clock-moves").disabled, false);
});

test("the drawer repeats no cube value as text: no per-cube state", () => {
  const { regions } = setup();
  assert.equal(regions.nerd.descendants().some((e) => /-state$/.test(e.id)), false);
});
