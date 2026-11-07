import test from "node:test";
import assert from "node:assert/strict";
import { applyDuration } from "../src/apps/chronocube/duration-form.ts";
import { parseMsDuration } from "../src/apps/timer/clock.ts";

// Like MsTimer.set: not async, and parseMsDuration throws synchronously on a bad duration.
// The real MsTimer.set returns a promise only after it parsed; model that exactly.
const syncTimer = { set: (text) => (parseMsDuration(text, 35999), Promise.resolve()) };

test("a valid duration reports done", async () => {
  const log = [];
  applyDuration(syncTimer, "05:00", () => log.push("done"), (m) => log.push(m));
  await new Promise((r) => setImmediate(r));
  assert.deepEqual(log, ["done"]);
});

test("a duration over the maximum (60:00) reports its message and does not throw", async () => {
  const log = [];
  assert.doesNotThrow(() =>
    applyDuration(syncTimer, "60:00", () => log.push("done"), (m) => log.push(m)),
  );
  await new Promise((r) => setImmediate(r));
  assert.equal(log.length, 1);
  assert.match(log[0], /Duration must be 00:00\.0/);
});

test("malformed text reports the format message", async () => {
  const log = [];
  assert.doesNotThrow(() => applyDuration(syncTimer, "abc", () => log.push("done"), (m) => log.push(m)));
  await new Promise((r) => setImmediate(r));
  assert.match(log[0], /Enter MM:SS/);
});
