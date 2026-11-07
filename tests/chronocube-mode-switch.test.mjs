import test from "node:test";
import assert from "node:assert/strict";
import { createModeSwitcher } from "../src/apps/chronocube/mode-switch.ts";

const deferred = () => {
  let resolve, reject;
  const promise = new Promise((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

test("a switch runs the previous mode's cleanup once and reports the new mode as current", async () => {
  const sw = createModeSwitcher();
  const log = [];
  assert.equal(await sw.switchTo(async () => () => log.push("a")), true);
  assert.equal(await sw.switchTo(async () => () => log.push("b")), true);
  assert.deepEqual(log, ["a"]);
  await sw.switchTo(async () => () => log.push("c"));
  assert.deepEqual(log, ["a", "b"]);
});

test("an init that resolves after a newer switch runs its own cleanup and does not replace the active cleanup", async () => {
  const sw = createModeSwitcher();
  const slow = deferred();
  const log = [];
  const first = sw.switchTo(() => slow.promise);
  const second = await sw.switchTo(async () => () => log.push("new"));
  assert.equal(second, true);
  slow.resolve(() => log.push("stale"));
  assert.equal(await first, false);
  assert.deepEqual(log, ["stale"]);
  await sw.switchTo(async () => () => {});
  assert.deepEqual(log, ["stale", "new"]);
});

test("an init that fails after a newer switch does not report its error", async () => {
  const errors = [];
  const sw = createModeSwitcher((err) => errors.push(err.message));
  const slow = deferred();
  const first = sw.switchTo(() => slow.promise);
  await sw.switchTo(async () => () => {});
  slow.reject(new Error("old mode failed"));
  assert.equal(await first, false);
  assert.deepEqual(errors, []);
});

test("an init that fails while current reports its error", async () => {
  const errors = [];
  const sw = createModeSwitcher((err) => errors.push(err.message));
  assert.equal(await sw.switchTo(async () => { throw new Error("boom"); }), false);
  assert.deepEqual(errors, ["boom"]);
});

test("a throwing cleanup does not stop the switch", async () => {
  const warned = [];
  const sw = createModeSwitcher(() => {}, (e) => warned.push(e.message));
  await sw.switchTo(async () => () => { throw new Error("cleanup"); });
  assert.equal(await sw.switchTo(async () => () => {}), true);
  assert.deepEqual(warned, ["cleanup"]);
});
