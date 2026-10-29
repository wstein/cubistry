import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { fetchBounded } from "../packages/cube-assets/src/index.ts";

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
