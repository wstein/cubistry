import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CounterController,
  countHtmMoves,
} from "../src/apps/counter/controller.ts";
import { validateCounterDesign } from "../src/apps/counter/design.ts";
import { parseAlg } from "@cubistry/cube-mechanics";
const design = validateCounterDesign(
  JSON.parse(
    readFileSync(new URL("../public/counter-design.v2.json", import.meta.url)),
  ),
);
const total = (a, b) =>
  parseAlg(design.witnesses[a].word).length +
  parseAlg(design.witnesses[b].word).length;
const flush = () => new Promise((resolve) => setImmediate(resolve));
async function harness() {
  const events = [],
    pending = [];
  let presented = null,
    failAssets = false;
  const view = {
    configure(_p, state) {
      presented = state;
    },
    resetCamera() {},
    animate(p) {
      return new Promise((resolve, reject) =>
        pending.push({
          p,
          resolve() {
            presented = p.to;
            resolve();
          },
          reject,
        }),
      );
    },
  };
  const controller = new CounterController(
    view,
    design,
    (value, busy, error, progress) =>
      events.push({ value, busy, error, progress, state: controller.state }),
    async (manifest) => {
      if (failAssets) throw Error("asset failure");
      return {
        manifest,
        images: new Map(),
        materials: new Map(),
        textureOrigin: "bottom-left",
        dispose() {},
      };
    },
  );
  await controller.configure("FIXED TITLE", true, 15);
  const step = async () => {
    assert.ok(pending.length, "an actual turn must be pending");
    pending.shift().resolve();
    await flush();
  };
  const finish = async () => {
    for (let i = 0; controller.busy && i < 200; i++) await step();
    assert.equal(controller.busy, false);
  };
  return {
    controller,
    events,
    pending,
    step,
    finish,
    get presented() {
      return presented;
    },
    failAssets(value) {
      failAssets = value;
    },
  };
}
test("HTM counts R, R2 and R-prime as one legal token each", () => {
  for (const [word, count] of [
    ["R", 1],
    ["R2", 1],
    ["R'", 1],
    ["R R2 R'", 3],
    ["R2 U' F", 3],
    ["", 0],
  ])
    assert.equal(countHtmMoves(parseAlg(word)), count);
});
test("planned total precedes animation; only resolved authoritative commits advance progress", async () => {
  const h = await harness(),
    { controller: c } = h,
    source = c.state;
  c.request(42);
  const first = c.progress;
  assert.deepEqual(first, {
    completed: 0,
    total: total(15, 42),
    target: 42,
    queuedTarget: null,
    status: "playing",
  });
  assert.equal(c.state, source);
  assert.equal(h.pending.length, 1);
  await h.step();
  assert.equal(c.progress.completed, 1);
  assert.equal(c.state, h.presented);
  assert.equal(first.completed, 0);
  assert.ok(Object.isFrozen(c.progress));
  await h.finish();
  assert.equal(c.currentValue, 42);
  assert.equal(c.progress.completed, c.progress.total);
  assert.equal(c.progress.status, "completed");
  c.request(42);
  assert.equal(c.progress.total, 0);
  assert.equal(c.progress.completed, 0);
  assert.equal(h.pending.length, 0);
});
test("queued values preserve active counts and latest target starts a separate actual plan", async () => {
  const h = await harness(),
    { controller: c } = h;
  c.request(42);
  await h.step();
  c.request(43);
  c.request(44);
  assert.equal(c.progress.target, 42);
  assert.equal(c.progress.queuedTarget, 44);
  assert.equal(c.progress.completed, 1);
  assert.equal(c.progress.total, total(15, 42));
  await h.finish();
  assert.equal(c.currentValue, 44);
  const starts = h.events.filter(
    (e) => e.progress.status === "playing" && e.progress.completed === 0,
  );
  assert.deepEqual(
    starts.map((e) => e.progress.target),
    [42, 44],
  );
  assert.equal(c.progress.total, total(42, 44));
  assert.equal(c.state, h.presented);
});
test("stop-after-value discards queue, finishes a legal target and permits a correct later plan", async () => {
  const h = await harness(),
    { controller: c } = h;
  c.request(42);
  await h.step();
  c.request(99);
  assert.equal(c.stopAfterCurrent(), 42);
  assert.equal(c.progress.status, "stopping");
  assert.equal(c.progress.queuedTarget, null);
  assert.equal(c.progress.completed, 1);
  await h.finish();
  assert.equal(c.currentValue, 42);
  assert.equal(c.progress.status, "stopped");
  assert.equal(c.progress.completed, total(15, 42));
  assert.equal(c.stopAfterCurrent(), null);
  c.request(7);
  assert.equal(c.progress.total, total(42, 7));
  await h.finish();
  assert.equal(c.currentValue, 7);
});
test("reset queues behind active work; reconfiguration resets metrics only after success", async () => {
  const h = await harness(),
    { controller: c } = h;
  c.request(42);
  await h.step();
  c.request(15);
  assert.equal(c.progress.target, 42);
  assert.equal(c.progress.completed, 1);
  assert.equal(c.progress.queuedTarget, 15);
  await assert.rejects(c.configure("OTHER", true), /Wait/);
  await h.finish();
  assert.equal(c.currentValue, 15);
  assert.equal(c.progress.total, total(42, 15));
  const old = c.progress,
    state = c.state;
  h.failAssets(true);
  await assert.rejects(c.configure("OTHER", false), /asset failure/);
  assert.equal(c.progress, old);
  assert.equal(c.state, state);
  h.failAssets(false);
  await c.configure("NEW TITLE", false, 7);
  assert.deepEqual(c.progress, {
    completed: 0,
    total: 0,
    target: 7,
    queuedTarget: null,
    status: "idle",
  });
  assert.equal(c.currentValue, 7);
});
test("an interrupted rejected turn is not counted or mislabeled complete", async () => {
  const h = await harness(),
    { controller: c } = h;
  c.request(42);
  await h.step();
  const committed = c.state;
  h.pending.shift().reject(Error("render interrupted"));
  await flush();
  assert.equal(c.state, committed);
  assert.equal(c.progress.completed, 1);
  assert.equal(c.progress.total, total(15, 42));
  assert.equal(c.progress.status, "failed");
  assert.equal(c.busy, false);
  assert.match(h.events.at(-1).error.message, /interrupted/);
  assert.equal(h.events.at(-1).busy, false);
  await c.configure("RECOVER", true, 15);
  assert.equal(c.progress.completed, 0);
  assert.equal(c.progress.total, 0);
});
