import test from "node:test";
import assert from "node:assert/strict";
import { timerMotion } from "../src/apps/timer/status.ts";

test("timer movement status compares the logical target to the active transition, not animation activity", () => {
  for (const [physical, logical, busy, activeTarget, expected] of [
    [90, 90, false, 90, "idle"],
    [90, 89, true, 89, "moving"],
    [89, 90, true, 90, "moving"],
    [90, 88, true, 89, "synchronizing"],
    [89, 91, true, 90, "synchronizing"],
    [90, 88, false, 90, "synchronizing"],
    [89, 88, true, 88, "moving"],
    [88, 88, false, 88, "idle"],
    [90, 90, true, 89, "synchronizing"],
    [90, 89, true, null, "moving"],
  ]) {
    assert.equal(timerMotion({ physical, logical, busy, activeTarget }), expected);
  }
});
