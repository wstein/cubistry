import test from "node:test";
import assert from "node:assert/strict";
import { createPresentationGate } from "../src/apps/shared/presentation-gate.ts";

// The Present button of the unified view keeps the fullscreen rules of the Clock page (installPresentation): a request
// that completes after the viewer left, or after a newer request, must neither re-enter nor leave a stray fullscreen.

function fakeEnv({ canRequest = true } = {}) {
  const root = { name: "html" };
  const env = {
    full: null,
    requests: [],
    exits: 0,
    root: () => root,
    fullscreenElement: () => env.full,
    canRequest: () => canRequest,
    request: () => new Promise((resolve, reject) => env.requests.push({ resolve, reject })),
    exit: async () => {
      env.exits++;
      env.full = null;
    },
  };
  return { env, root };
}
function gateWith(options) {
  const { env, root } = fakeEnv(options);
  const changes = [];
  const gate = createPresentationGate(env, (active) => changes.push(active));
  return { env, root, gate, changes };
}

test("entering requests fullscreen and reports the mode at once", async () => {
  const { env, root, gate, changes } = gateWith();
  const entering = gate.enter();
  assert.equal(gate.active, true);
  assert.deepEqual(changes, [true]);
  env.full = root;
  env.requests[0].resolve();
  await entering;
  await gate.leave();
  assert.equal(env.exits, 1, "the fullscreen the gate opened is closed again");
  assert.deepEqual(changes, [true, false]);
});

test("without the Fullscreen API the presentation still works", async () => {
  const { env, gate } = gateWith({ canRequest: false });
  await gate.enter();
  assert.equal(gate.active, true);
  assert.equal(env.requests.length, 0);
  await gate.leave();
  assert.equal(gate.active, false);
  assert.equal(env.exits, 0);
});

test("a rejected request keeps the presentation open", async () => {
  const { env, gate } = gateWith();
  const entering = gate.enter();
  env.requests[0].reject(new Error("denied"));
  await entering;
  assert.equal(gate.active, true);
  await gate.leave();
  assert.equal(env.exits, 0, "nothing was opened, nothing is closed");
});

test("fullscreen the page did not open is left alone when the presentation ends", async () => {
  const { env, root, gate } = gateWith();
  env.full = root;
  await gate.enter();
  assert.equal(env.requests.length, 0, "already fullscreen: no second request");
  await gate.leave();
  assert.equal(env.exits, 0);
});

test("leaving while the request is pending cannot reenter fullscreen later", async () => {
  const { env, root, gate, changes } = gateWith();
  const entering = gate.enter();
  await gate.leave();
  env.full = root;
  env.requests[0].resolve();
  await entering;
  assert.equal(gate.active, false);
  assert.equal(env.exits, 1, "the late fullscreen is closed");
  assert.deepEqual(changes, [true, false]);
});

for (const latest of ["resolved", "rejected"])
  test(`an old completion respects a newer ${latest} request`, async () => {
    const { env, root, gate } = gateWith();
    const first = gate.enter();
    await gate.leave();
    const second = gate.enter();
    if (latest === "resolved") {
      env.full = root;
      env.requests[1].resolve();
    } else env.requests[1].reject(new Error("Rejected for latest request"));
    await second;
    env.full = root;
    env.requests[0].resolve();
    await first;
    assert.equal(gate.active, true);
    assert.equal(env.exits, 0);
    await gate.leave();
    assert.equal(gate.active, false);
    assert.equal(env.exits, 1);
  });

test("leaving fullscreen from the browser ends the presentation once, after the page had seen it", () => {
  const { env, root, gate, changes } = gateWith();
  void gate.enter();
  gate.nativeChange();
  assert.deepEqual(changes, [true], "no fullscreen yet: nothing to end");
  env.full = root;
  gate.nativeChange();
  env.full = null;
  gate.nativeChange();
  assert.equal(gate.active, false);
  assert.deepEqual(changes, [true, false]);
  gate.nativeChange();
  assert.deepEqual(changes, [true, false], "inactive: ignored");
});

test("leaving twice reports the end once", async () => {
  const { gate, changes } = gateWith({ canRequest: false });
  await gate.enter();
  await gate.leave();
  await gate.leave();
  assert.deepEqual(changes, [true, false]);
});
