import test from "node:test";
import assert from "node:assert/strict";
import { GitHub } from "../scripts/pages/api.mjs";

const realFetch = globalThis.fetch;
// Replays `steps` (a status code or an Error per call) and records calls.
function mock(steps) {
  const calls = [];
  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), method: options.method ?? "GET" });
    const step = steps[calls.length - 1];
    if (step instanceof Error) throw step;
    if (step === undefined) throw Error("Unexpected extra fetch");
    return new Response(step === 204 ? null : JSON.stringify({ ok: true }), {
      status: step,
    });
  };
  return calls;
}
function client() {
  const delays = [];
  const api = new GitHub("unit-test-only", {
    sleep: async (ms) => void delays.push(ms),
  });
  return { api, delays };
}
test.afterEach(() => {
  globalThis.fetch = realFetch;
});

test("GET retries a transient 504 and then succeeds", async () => {
  const calls = mock([504, 200]);
  const { api, delays } = client();
  assert.deepEqual(await api.request("contents/x"), { ok: true });
  assert.equal(calls.length, 2);
  assert.equal(delays.length, 1);
});
test("GET retries 502, 503 and network errors", async () => {
  for (const first of [502, 503, new TypeError("fetch failed")]) {
    const calls = mock([first, 200]);
    assert.deepEqual(await client().api.request("contents/x"), { ok: true });
    assert.equal(calls.length, 2);
  }
});
test("three 504 in a row fail with the original message", async () => {
  const calls = mock([504, 504, 504]);
  const { api, delays } = client();
  await assert.rejects(api.request("contents/pr-preview/pr-104?ref=gh-pages"), {
    message: "GitHub API 504: contents/pr-preview/pr-104",
  });
  assert.equal(calls.length, 3);
  assert.ok(delays.every((ms) => ms > 0));
  assert.ok(delays.reduce((a, b) => a + b, 0) < 60000);
});
test("repeated network errors fail with the original error", async () => {
  const calls = mock([1, 2, 3].map(() => new TypeError("fetch failed")));
  await assert.rejects(client().api.request("pages"), {
    message: "fetch failed",
  });
  assert.equal(calls.length, 3);
});
test("404 returns null and is not retried", async () => {
  const calls = mock([404]);
  assert.equal(await client().api.request("contents/x"), null);
  assert.equal(calls.length, 1);
});
test("other 4xx fail at once without retry", async () => {
  for (const status of [400, 401, 403, 422, 429]) {
    const calls = mock([status]);
    await assert.rejects(client().api.request("pages"), {
      message: `GitHub API ${status}: pages`,
    });
    assert.equal(calls.length, 1);
  }
});
test("writes are not retried", async () => {
  for (const method of ["POST", "PUT", "DELETE", "PATCH"]) {
    for (const first of [504, new TypeError("fetch failed")]) {
      const calls = mock([first, 200]);
      await assert.rejects(
        client().api.request("issues/1/comments", { method }),
      );
      assert.equal(calls.length, 1, `${method} ${first}`);
    }
  }
});
