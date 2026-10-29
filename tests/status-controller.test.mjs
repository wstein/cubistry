import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { stateEquals } from "@cubistry/cube-core";
import {
  applyMoves,
  initialState,
  matchesTarget,
  serializeMove,
  validatePresentation,
} from "@cubistry/cube-mechanics";
import { StatusController } from "../src/apps/status/controller.ts";
import {
  StatusWorkflow,
  validateStatusDefinition,
} from "../src/apps/status/definition.ts";
const definition = validateStatusDefinition(
  JSON.parse(readFileSync("src/apps/status/definition.json")),
);
import { QualityPolicy } from "../src/apps/status/policy.ts";
import { displayTarget, valueSnapshot } from "../src/apps/status/definition.ts";
const policy = new QualityPolicy(
  definition,
  readFileSync("public/assets/quality/distances.u8"),
);
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture({
  loadError = false,
  configureError = false,
  policyError = false,
} = {}) {
  let pose,
    printing,
    configurations = 0,
    disposed = 0;
  const pending = [],
    committed = [],
    errors = [],
    notices = [];
  const view = {
    configure(print, state) {
      if (configureError) throw Error("Synthetic viewer configuration failure");
      printing = print;
      pose = state;
      configurations++;
    },
    resetCamera() {},
    animate(p) {
      validatePresentation(p, printing);
      assert(stateEquals(pose, p.from));
      return new Promise((resolve, reject) =>
        pending.push({
          p,
          resolve() {
            pose = p.to;
            committed.push(p);
            resolve();
          },
          reject,
        }),
      );
    },
  };
  const controller = new StatusController(
    view,
    definition,
    (value, busy, error, progress) => {
      if (error) errors.push(error);
      notices.push({ value, busy, progress });
    },
    async (manifest, prints) => {
      assert.equal(manifest, definition.assets);
      assert.equal(prints[0], definition.print);
      if (loadError) throw Error("Synthetic asset integrity failure");
      return {
        manifest,
        textureOrigin: "bottom-left",
        images: new Map(),
        materials: new Map(),
        dispose() {
          disposed++;
        },
      };
    },
    async () => {
      if (policyError) throw Error("Synthetic certificate integrity failure");
      return policy;
    },
  );
  return {
    controller,
    pending,
    committed,
    errors,
    notices,
    get pose() {
      return pose;
    },
    get configurations() {
      return configurations;
    },
    get disposed() {
      return disposed;
    },
    async step() {
      assert.equal(pending.length, 1);
      pending.shift().resolve();
      await flush();
      assert(stateEquals(controller.state, pose));
    },
    async finish() {
      for (let n = 0; controller.busy && n < 40; n++) await this.step();
      assert.equal(controller.busy, false);
      assert.notEqual(controller.progress.status, "failed");
    },
  };
}

test("all625 controller requests retain immutable print and assets with exact shared playback", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  assert.deepEqual(c.currentStatus, definition.initial);
  for (const target of definition.targets) {
    c.requestStatus(target.states);
    await f.finish();
    assert.deepEqual(c.currentStatus, target.states);
    assert(matchesTarget(definition.print, c.state, target.target));
    assert.equal(c.progress.sessionTotal, f.committed.length);
  }
  assert.equal(f.configurations, 1);
  assert.deepEqual(f.errors, []);
  c.dispose();
  assert.equal(f.disposed, 1);
});
test("rapid events commit one legal turn then replan latest snapshot from its actual pose", async () => {
  const f = fixture(),
    c = f.controller,
    w = new StatusWorkflow(definition);
  await c.configure();
  for (const step of definition.demonstration) {
    w.dispatch(step.category, step.event);
    c.requestStatus(w.requested);
  }
  assert.deepEqual(w.requested, ["ok", "ok", "ok", "ok"]);
  assert.deepEqual(c.currentStatus, definition.initial);
  assert.equal(f.committed.length, 0);
  const first = f.pending[0].p;
  await f.step();
  assert(stateEquals(c.state, first.to));
  assert.equal(c.progress.target, 312);
  assert(c.progress.total <= 7);
  await f.finish();
  assert.deepEqual(c.currentStatus, w.requested);
  assert(matchesTarget(definition.print, c.state, displayTarget(w.requested)));
  assert.equal(c.progress.sessionTotal, f.committed.length);
});
test("returning to last completed snapshot repairs interrupted intermediate pose", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  c.requestStatus(["running", "open", "open", "open"]);
  c.requestStatus(definition.initial);
  await f.step();
  assert.equal(c.busy, true);
  assert.deepEqual(c.currentStatus, definition.initial);
  assert(c.progress.total <= 7);
  await f.finish();
  assert(
    matchesTarget(definition.print, c.state, displayTarget(definition.initial)),
  );
});
test("finish active snapshot drops queued target and completes its full endpoint", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  const active = ["running", "open", "open", "open"];
  c.requestStatus(active);
  c.requestStatus(["error", "blocked", "ok", "running"]);
  assert.equal(c.stopAfterCurrent(), 125);
  await f.finish();
  assert.deepEqual(c.currentStatus, active);
  assert.equal(c.progress.status, "stopped");
  assert(matchesTarget(definition.print, c.state, displayTarget(active)));
});
test("animation failure freezes committed full pose, progress and requests until reload", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  c.requestStatus(["running", "open", "open", "open"]);
  await f.step();
  const retained = c.state;
  f.pending.shift().reject(Error("Synthetic interrupted animation"));
  await flush();
  assert.equal(c.busy, false);
  assert.equal(c.progress.status, "failed");
  assert.equal(c.progress.sessionTotal, 1);
  assert(stateEquals(c.state, retained));
  assert.throws(() => c.requestStatus(["ok", "ok", "ok", "ok"]), /Reload/);
  assert.equal(f.configurations, 1);
  assert.equal(f.errors.length, 1);
  c.dispose();
  assert.equal(f.disposed, 1);
});
test("certificate, asset and installation failures never claim configuration and dispose owned resources", async () => {
  for (const options of [
    { loadError: true },
    { configureError: true },
    { policyError: true },
  ]) {
    const f = fixture(options),
      c = f.controller;
    await assert.rejects(c.configure(), /Synthetic/);
    assert.equal(c.state, null);
    assert.equal(c.busy, false);
    assert.equal(f.configurations, 0);
    assert.equal(f.disposed, options.configureError ? 1 : 0);
    assert.throws(
      () => c.requestStatus(["ok", "ok", "ok", "ok"]),
      /not configured/,
    );
  }
});
