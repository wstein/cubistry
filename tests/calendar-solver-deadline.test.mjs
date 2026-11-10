import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as optimizerModule from "../src/apps/calendar/optimizer.ts";

const { CalendarOptimizer, solverTimeoutMs } = optimizerModule;
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
async function slowSolve(t, optimizer, worker, finalAfterMs) {
  // Attach the handler first: a rejection must fail this test, not the process.
  const result = optimizer.plan(context).then(
    (word) => word,
    (error) => `rejected: ${error.message}`,
  );
  const { id } = worker.messages[0];
  worker.onmessage({ data: { id, interimWord: "interim" } });
  t.mock.timers.tick(finalAfterMs);
  await flush();
  // A deadline has already terminated the worker and ignores this reply.
  worker.onmessage({
    data: { id, word: "final", diagnostics: { solverStatus: "solved" } },
  });
  return result;
}

test("the default solver deadline stays 8000 ms", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  assert.equal(optimizerModule.DEFAULT_SOLVER_TIMEOUT_MS, 8000);
  const worker = fakeWorker();
  const optimizer = new CalendarOptimizer(() => worker);
  assert.equal(await slowSolve(t, optimizer, worker, 7999), "final");
  const late = fakeWorker();
  const second = new CalendarOptimizer(() => late);
  assert.equal(await slowSolve(t, second, late, 8000), "interim");
  assert.equal(second.solverStatus, "deadline");
  assert.equal(late.dead, true);
  optimizer.dispose();
  second.dispose();
});

test("a configured larger deadline lets a slow solve finish instead of retaining the interim route", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const worker = fakeWorker();
  const optimizer = new CalendarOptimizer(
    () => worker,
    optimizerModule.solverTimeoutMs(30000),
  );
  assert.equal(await slowSolve(t, optimizer, worker, 9000), "final");
  assert.equal(optimizer.solverStatus, "solved");
  assert.notEqual(worker.dead, true);
  optimizer.dispose();
});

test("a configured deadline still ends a stalled solve with the interim route", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const worker = fakeWorker();
  const optimizer = new CalendarOptimizer(
    () => worker,
    optimizerModule.solverTimeoutMs(30000),
  );
  assert.equal(await slowSolve(t, optimizer, worker, 30000), "interim");
  assert.equal(optimizer.solverStatus, "deadline");
  optimizer.dispose();
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

test("the Pages spec sets the same hook to a finite deadline below its busy wait", () => {
  const spec = readFileSync(
    new URL("./pages/calendar.spec.mjs", import.meta.url),
    "utf8",
  );
  const page = readFileSync(
    new URL("../src/calendar.mjs", import.meta.url),
    "utf8",
  );
  const hook = page.match(/window\.(__calendarSolverTimeoutMs)/)?.[1];
  assert.ok(hook, "calendar.mjs reads the hook");
  const set = [...spec.matchAll(/window\.(\w+)\s*=\s*([\d_]+)\s*;/g)].filter(
    (m) => m[1] === hook,
  );
  assert.equal(set.length, 1, `spec sets window.${hook} exactly once`);
  const deadline = Number(set[0][2].replaceAll("_", ""));
  const busy = Number(
    spec.match(/"aria-busy",\s*"false",\s*\{\s*timeout:\s*(\d+)/)?.[1],
  );
  assert.ok(busy > 0, "spec has a busy wait");
  assert.equal(solverTimeoutMs(deadline), deadline, "deadline is accepted");
  assert.ok(deadline > 8000, "deadline exceeds the default");
  assert.ok(deadline < busy, "deadline stays below the busy wait");
  assert.match(spec, /toBeLessThanOrEqual\(\s*moves,?\s*\)/);
});
