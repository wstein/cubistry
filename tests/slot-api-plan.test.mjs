import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MIGRATION, slotsOf } from "../src/apps/shell/slot-map.ts";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";

// The slot inventory in the unified-application plan must match src/apps/shell/slot-map.ts: one row per registered
// mode with the slots the design fills and the migration status.

const plan = readFileSync("knowledge/plans/unified-application.md", "utf8");
const section = plan.split("\n### Slot inventory")[1]?.split("\n## ")[0] ?? "";
const rows = new Map(
  [...section.matchAll(/^\| `([a-z0-9-]+)` \| ([^|]+) \| (pending|migrated) \|$/gm)].map((m) => [m[1], { slots: m[2].trim(), status: m[3] }]),
);
const compact = (slots) => (slots.length === 0 ? "none" : slots.join(", "));

test("the plan has a Slot inventory section with one row per registered mode", () => {
  assert.ok(section.length > 0, "section found");
  assert.deepEqual([...rows.keys()].sort(), MODE_CATALOG.map((m) => m.id).sort());
});

test("each row lists the slots of the design and the migration status of the code", () => {
  for (const [id, row] of rows) {
    assert.equal(row.slots, compact(slotsOf(id)), `${id}: slots`);
    assert.equal(row.status, MIGRATION[id], `${id}: status`);
  }
});

test("the plan records the owner decision to build the slot API first and names the open questions", () => {
  assert.match(plan, /^18\. \*\*Slot API first/m);
  assert.match(section, /Open questions for the owner/);
});
