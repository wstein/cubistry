import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CalendarController } from "../src/apps/calendar/controller.ts";
import { createPlanner } from "../src/apps/calendar/center-planner.mjs";
import {
  civilDate,
  findTarget,
  matches,
  shiftDate,
  validateDesign,
} from "../src/apps/calendar/model.ts";

const load = (id) =>
  validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`)));
const designs = { padded: load("de-a"), unpadded: load("de-a-unpadded") };
const settled = (c) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (!c.busy) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > 120000) {
        clearInterval(timer);
        reject(Error("Controller did not settle"));
      }
    }, 2);
  });
const port = { configure() {}, async animate() {} };
/** One headless route as the app plans it: canonical source pose of the first date, then request the target. */
async function route(fromDesign, fromIso, toDesign, toIso, options) {
  const planner = await createPlanner({ design: fromDesign, options });
  const c = new CalendarController(
    fromDesign,
    findTarget(fromDesign, civilDate(fromIso)),
    port,
    (_t, _b, error) => assert.ifError(error),
    planner,
  );
  const target = findTarget(toDesign, civilDate(toIso));
  const started = performance.now();
  c.request(target);
  await settled(c);
  assert(matches(c.physicalState, target.cells));
  const { htm, rotations } = c.progress.total;
  return { htm, rotations, ms: performance.now() - started, planner };
}

test("the default center-aware node limit is 1,000,000 per attempt", async () => {
  const { planner } = await route(
    designs.unpadded,
    "2027-03-03",
    designs.padded,
    "2027-03-03",
  );
  assert.equal(planner.metadata.maximumNodes, 1000000);
  assert.equal(planner.metadata.maximumTotalNodes, 2000000);
  assert.equal(planner.metadata.maximumDepth, 24);
  assert(
    planner.lastDiagnostics.attempts.every((a) => a.maximumNodes === 1000000),
  );
});

// Measured with the 100000 node limit: 34, 32 and 33 HTM (statuses "unknown", center repair of 14 HTM appended).
test("leading-zero toggle to the padded print stays within the measured bounds", async () => {
  for (const [iso, bound] of [
    ["2027-03-03", 25],
    ["2027-03-01", 24],
    ["2027-06-02", 24],
  ]) {
    const r = await route(designs.unpadded, iso, designs.padded, iso);
    assert(r.htm <= bound, `${iso}: ${r.htm} HTM, bound ${bound}`);
    assert.equal(r.rotations, 1, iso);
    assert.equal(
      r.planner.lastDiagnostics.attempts[0].status,
      "solved",
      `${iso} first attempt`,
    );
  }
});

test("ordinary day steps are not longer than with the previous limit", async () => {
  let before = 0,
    after = 0;
  let date = civilDate("2027-02-28");
  for (let i = 0; i < 10; i++) {
    const next = shiftDate(date, 1);
    const old = await route(designs.padded, date.iso, designs.padded, next.iso, {
      maximumNodes: 100000,
    });
    const now = await route(designs.padded, date.iso, designs.padded, next.iso);
    assert(
      now.htm + now.rotations <= old.htm + old.rotations,
      `${date.iso} -> ${next.iso}: ${now.htm}+${now.rotations} vs ${old.htm}+${old.rotations}`,
    );
    before += old.htm + old.rotations;
    after += now.htm + now.rotations;
    date = next;
  }
  assert(after <= before, `${after} vs ${before}`);
});

test("worst single solve time in Node over the pinned toggles is below one second", async () => {
  let worst = 0;
  for (const iso of ["2027-03-03", "2027-03-01", "2027-06-02"]) {
    const r = await route(designs.unpadded, iso, designs.padded, iso);
    worst = Math.max(worst, r.ms);
  }
  console.log(`worst planning time ${Math.round(worst)} ms`);
  assert(worst < 1000, `${worst} ms`);
});
