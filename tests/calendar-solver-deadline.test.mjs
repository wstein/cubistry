import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as optimizerModule from "../src/apps/calendar/optimizer.ts";

const { CalendarOptimizer } = optimizerModule;
const context = {
  design: {},
  from: [],
  target: {},
  sourceWord: "",
  fallbackWord: "R U",
};
const fakeWorker = () => ({
  onmessage: null,
  onerror: null,
  onmessageerror: null,
  messages: [],
  postMessage(message) {
    this.messages.push(message);
  },
  terminate() {
    this.dead = true;
  },
});
const flush = () => new Promise((resolve) => setImmediate(resolve));

/** Interim route at once, final route after `finalAfterMs` of fake time. */
async function slowSolve(optimizer, worker, finalAfterMs) {
  const result = optimizer.plan(context);
  const { id } = worker.messages[0];
  worker.onmessage({ data: { id, interimWord: "interim" } });
  mock.timers.tick(finalAfterMs);
  await flush();
  // A deadline has already terminated the worker and ignores this reply.
  worker.onmessage({
    data: { id, word: "final", diagnostics: { solverStatus: "solved" } },
  });
  return result;
}

test("the default solver deadline stays 8000 ms", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    assert.equal(optimizerModule.DEFAULT_SOLVER_TIMEOUT_MS, 8000);
    const worker = fakeWorker();
    const optimizer = new CalendarOptimizer(() => worker);
    assert.equal(await slowSolve(optimizer, worker, 7999), "final");
    const late = fakeWorker();
    const second = new CalendarOptimizer(() => late);
    assert.equal(await slowSolve(second, late, 8000), "interim");
    assert.equal(second.solverStatus, "deadline");
    assert.equal(late.dead, true);
    optimizer.dispose();
    second.dispose();
  } finally {
    mock.timers.reset();
  }
});

test("a configured larger deadline lets a slow solve finish instead of retaining the interim route", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const worker = fakeWorker();
    const optimizer = new CalendarOptimizer(
      () => worker,
      optimizerModule.solverTimeoutMs(30000),
    );
    assert.equal(await slowSolve(optimizer, worker, 9000), "final");
    assert.equal(optimizer.solverStatus, "solved");
    assert.notEqual(worker.dead, true);
    optimizer.dispose();
  } finally {
    mock.timers.reset();
  }
});

test("a configured deadline still ends a stalled solve with the interim route", async () => {
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    const worker = fakeWorker();
    const optimizer = new CalendarOptimizer(
      () => worker,
      optimizerModule.solverTimeoutMs(30000),
    );
    assert.equal(await slowSolve(optimizer, worker, 30000), "interim");
    assert.equal(optimizer.solverStatus, "deadline");
    optimizer.dispose();
  } finally {
    mock.timers.reset();
  }
});

test("solverTimeoutMs accepts only a finite positive number and otherwise yields the default", () => {
  const { solverTimeoutMs } = optimizerModule;
  assert.equal(solverTimeoutMs(30000), 30000);
  // setTimeout overflows above 2^31 - 1 ms and would fire after about 1 ms.
  assert.equal(solverTimeoutMs(2 ** 31 - 1), 2 ** 31 - 1);
  for (const value of [2 ** 31, 3e9])
    assert.equal(solverTimeoutMs(value), 8000, String(value));
  for (const value of [
    undefined,
    null,
    0,
    -1,
    Number.NaN,
    Infinity,
    "30000",
    {},
  ])
    assert.equal(solverTimeoutMs(value), 8000, String(value));
});

test("the calendar page takes the deadline from an internal test hook, not from the URL", () => {
  const source = readFileSync(
    new URL("../src/calendar.mjs", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /new CalendarOptimizer\(\s*undefined,\s*solverTimeoutMs\(window\.__calendarSolverTimeoutMs\),?\s*\)/,
  );
  assert.doesNotMatch(source, /params\.get\(["']solver/i);
});
