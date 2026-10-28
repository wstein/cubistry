import test from "node:test";
import assert from "node:assert/strict";
import { CounterRun } from "../src/apps/counter/run.mjs";
test("Run takes every adjacent value in either direction and stops at target", () => {
  for (const [start, target] of [
    [0, 5],
    [99, 94],
  ]) {
    const run = new CounterRun();
    run.start(start, target, 0);
    let current = start;
    assert.equal(run.next(current, false, 999), null);
    for (let second = 1; second <= 5; second++) {
      const next = run.next(current, false, second * 1000);
      assert.equal(next, current + Math.sign(target - current));
      current = next;
    }
    assert.equal(run.next(current, false, 6000), null);
    assert.equal(run.running, false);
  }
});
test("slow moves and suspended tabs never skip a required adjacent value", () => {
  const run = new CounterRun();
  run.start(0, 99, 0);
  assert.equal(run.next(0, false, 1000), 1);
  assert.equal(run.next(0, true, 100000), null);
  assert.equal(run.next(1, false, 100000), 2);
  assert.equal(run.next(2, false, 100001), null);
  run.stop();
  assert.equal(run.next(2, false, 200000), null);
});
test("start at target does nothing and a new Run replaces the captured target", () => {
  const run = new CounterRun();
  run.start(7, 7, 0);
  assert.equal(run.running, false);
  run.start(7, 3, 0);
  assert.equal(run.next(7, false, 1000), 6);
  run.start(6, 8, 1000);
  assert.equal(run.next(6, false, 2000), 7);
});
