import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SLOT_MAP, MIGRATION, NO_DESIGN_ROW, ACCEPTED_DEVIATIONS, slotsOf } from "../src/apps/shell/slot-map.ts";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { SLOT_NUMBERS } from "../src/apps/shell/slot-api.ts";

// The inventory of dock slots per mode (src/apps/shell/slot-map.ts) mirrors the slot map table of the design
// (docs/design/README.md). A mode is "pending" until it fills its slots through the ModeShell API.

const readme = readFileSync("docs/design/README.md", "utf8");
const designRows = (() => {
  const lines = readme.split("\n");
  const head = lines.findIndex((l) => /^\| App \| 1 Action \|/.test(l));
  assert.ok(head >= 0, "slot map table found in the design README");
  const rows = [];
  for (const line of lines.slice(head + 2)) {
    if (!line.startsWith("|")) break;
    const cells = line.split("|").slice(1, -1).map((c) => c.trim());
    rows.push({ app: cells[0], slots: cells.slice(1).map((c) => (c === "—" ? null : c)) });
  }
  return rows;
})();

test("the inventory has one row per row of the design's slot map, with the same slot contents", () => {
  assert.equal(designRows.length, 11);
  assert.deepEqual(
    SLOT_MAP.map((r) => ({ app: r.designRow, slots: [...r.slots] })),
    designRows,
  );
});

test("every registered mode has exactly one row or is listed as a mode without a design row", () => {
  const catalog = MODE_CATALOG.map((m) => m.id);
  const seen = SLOT_MAP.flatMap((r) => r.modes);
  assert.equal(new Set(seen).size, seen.length, "no id twice");
  for (const id of catalog) assert.ok(seen.includes(id) !== NO_DESIGN_ROW.includes(id), `${id}: a row xor listed without one`);
  assert.deepEqual(NO_DESIGN_ROW, ["calendar7"], "the 7x7 Calendar is a research candidate that the design does not cover");
  for (const row of SLOT_MAP) {
    for (const id of row.modes) {
      assert.equal(catalog.includes(id), row.registered, `${id}: registered flag`);
    }
  }
  assert.deepEqual(
    SLOT_MAP.filter((r) => !r.registered).flatMap((r) => r.modes),
    ["calendar", "playground"],
  );
});

test("slotsOf lists the filled slot numbers of a mode and rejects an unknown id", () => {
  assert.deepEqual(slotsOf("clock"), [1, 2, 3, 4, 5]);
  assert.deepEqual(slotsOf("tenth"), [1, 2, 3, 4]);
  assert.deepEqual(slotsOf("five-second-timer"), [1, 2, 3, 4]);
  assert.deepEqual(slotsOf("ci"), [1, 2]);
  assert.deepEqual(slotsOf("calendar7"), [], "no dock content in the design");
  assert.throws(() => slotsOf("nope"), /unknown mode/);
  for (const row of SLOT_MAP) assert.ok(slotsOf(row.modes[0]).every((n) => SLOT_NUMBERS.includes(n)));
});

test("migration status: every registered mode is listed; only the 1/10-Second Counter and the CI Quality Cube have been migrated", () => {
  assert.deepEqual(Object.keys(MIGRATION).sort(), MODE_CATALOG.map((m) => m.id).sort());
  for (const status of Object.values(MIGRATION)) assert.ok(["pending", "migrated"].includes(status));
  const migrated = Object.entries(MIGRATION).filter(([, s]) => s === "migrated").map(([id]) => id);
  assert.deepEqual(migrated, ["tenth", "ci"]);
});

test("accepted deviations: the 1/10-Second Counter maps Step, Value, Direction, Step speed instead of the design row (owner decision 5, 2026-11-08)", () => {
  assert.deepEqual(Object.keys(ACCEPTED_DEVIATIONS).sort(), ["ci", "tenth"]);
  const design = SLOT_MAP.find((r) => r.modes.includes("tenth"));
  const actual = ACCEPTED_DEVIATIONS.tenth;
  assert.deepEqual([...actual.slots], ["Step", "Value", "Direction", "Step speed", null]);
  assert.notDeepEqual([...actual.slots], [...design.slots], "a deviation differs from the design");
  assert.deepEqual(actual.omitted, ["Run / Stop", "Stop after", "Wrap"]);
  for (const label of actual.slots.filter(Boolean)) {
    assert.ok(readFileSync("src/apps/chronocube/tenth-controls.ts", "utf8").includes(`label: "${label}"`), `${label} is a slot label of the mode`);
  }
  // The filled slot numbers agree with what the design row would fill, so slotsOf stays correct for the mode.
  assert.deepEqual(slotsOf("tenth"), actual.slots.flatMap((l, i) => (l ? [i + 1] : [])));
  const plan = readFileSync("knowledge/plans/unified-application.md", "utf8");
  assert.match(plan, /`tenth` fills slots 1 to 4 with Step, Value, Direction and Step speed/);
  assert.match(plan, /Run \/ Stop, Stop after and Wrap, which this mode does not have\. This deviation is accepted/);
});

test("accepted deviations: the CI Quality Cube uses Simulated events and Workflow (owner decision 2026-11-12)", () => {
  const design = SLOT_MAP.find((r) => r.modes.includes("ci"));
  const actual = ACCEPTED_DEVIATIONS.ci;
  assert.deepEqual([...actual.slots], ["Simulated events", "Workflow", null, null, null]);
  assert.notDeepEqual([...actual.slots], [...design.slots], "a deviation differs from the design");
  assert.deepEqual(actual.omitted, ["Refresh status", "Workflow list"]);
  assert.match(actual.decision, /2026-11-12/);
  assert.deepEqual(slotsOf("ci"), [1, 2]);
  const mount = readFileSync("src/apps/status/mount.ts", "utf8");
  for (const label of actual.slots.filter(Boolean)) {
    assert.ok(mount.includes(`label: "${label}"`), `${label} is a slot label of the mode`);
  }
  assert.doesNotMatch(mount, /shell\.setSlot\([345],/);
  const plan = readFileSync("knowledge/plans/unified-application.md", "utf8");
  assert.match(plan, /labels them "Simulated events" and "Workflow"/);
  assert.match(plan, /This deviation is accepted \(owner decision 2026-11-12/);
});
