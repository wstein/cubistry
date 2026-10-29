import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  ASSET_LIMITS,
  fetchBounded,
} from "../packages/cube-assets/src/index.ts";

const hex = (s) => createHash("sha256").update(s).digest("hex");
const OLD = "<svg>old</svg>",
  NEW = "<svg>new</svg>";

// Fake fetch that models the HTTP cache: a default-cache request returns the
// stale entry until a "reload" request refreshes it from the network.
function install({ cached, network }) {
  const calls = [];
  let entry = cached;
  globalThis.fetch = async (url, init) => {
    calls.push(init.cache ?? "default");
    if (init.cache === "reload") entry = network;
    const body = new TextEncoder().encode(entry);
    return new Response(body, {
      status: 200,
      headers: { "content-type": "image/svg+xml" },
    });
  };
  return calls;
}
const run = (expected, budget = { bytes: 0 }) =>
  fetchBounded("/assets/hsm/words/H.svg", expected, "svg", budget);
const realFetch = globalThis.fetch;
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("a matching first response is used without a reload", async () => {
  const calls = install({ cached: NEW, network: NEW });
  assert.equal(new TextDecoder().decode(await run(hex(NEW))), NEW);
  assert.deepEqual(calls, ["default"]);
});

test("a stale cached asset is recovered with exactly one reload", async () => {
  const calls = install({ cached: OLD, network: NEW });
  const budget = { bytes: 0 };
  assert.equal(new TextDecoder().decode(await run(hex(NEW), budget)), NEW);
  assert.deepEqual(calls, ["default", "reload"]);
  // The rejected stale bytes are not charged to the load budget.
  assert.equal(budget.bytes, NEW.length);
});

test("bytes that never match fail closed after a single retry", async () => {
  const calls = install({ cached: OLD, network: OLD });
  await assert.rejects(run(hex(NEW)), /Asset integrity check failed/);
  assert.deepEqual(calls, ["default", "reload"]);
});

test("non-integrity failures are not retried", async () => {
  let n = 0;
  globalThis.fetch = async () => (n++, new Response("", { status: 404 }));
  await assert.rejects(run(hex(NEW)), /Asset could not be loaded/);
  assert.equal(n, 1);
});

test("network errors, aborts and byte-limit violations are not retried", async () => {
  let n = 0;
  globalThis.fetch = async () => {
    n++;
    throw new TypeError("network down");
  };
  await assert.rejects(run(hex(NEW)), /network down/);
  assert.equal(n, 1);

  n = 0;
  globalThis.fetch = async (url, init) => {
    n++;
    init.signal?.throwIfAborted();
    return new Response(NEW, { headers: { "content-type": "image/svg+xml" } });
  };
  await assert.rejects(
    fetchBounded(
      "/assets/hsm/words/H.svg",
      hex(NEW),
      "svg",
      { bytes: 0 },
      AbortSignal.abort(),
    ),
    { name: "AbortError" },
  );
  assert.equal(n, 1);

  // A stale entry that would push the load over the total budget fails closed
  // on the limit itself; the reload never gets a chance to bypass the cap.
  n = 0;
  const calls = install({ cached: OLD, network: NEW });
  const full = { bytes: ASSET_LIMITS.totalBytes - OLD.length + 1 };
  await assert.rejects(run(hex(NEW), full), /Asset byte limit exceeded/);
  assert.deepEqual(calls, ["default"]);
});

test("the reload is still charged against the total budget", async () => {
  const calls = install({ cached: OLD, network: NEW + " ".repeat(8) });
  const budget = { bytes: ASSET_LIMITS.totalBytes - OLD.length };
  await assert.rejects(
    run(hex(NEW + " ".repeat(8)), budget),
    /Asset byte limit exceeded/,
  );
  assert.deepEqual(calls, ["default", "reload"]);
});
