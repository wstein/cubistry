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
const flush = () => new Promise((resolve) => setImmediate(resolve));
function fixture({ loadError = false, configureError = false } = {}) {
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
      assert(
        stateEquals(
          applyMoves(
            initialState(definition.print),
            controller.sourceReference,
          ),
          pose,
        ),
      );
    },
    async finish() {
      for (let n = 0; controller.busy && n < 40; n++) await this.step();
      assert.equal(controller.busy, false);
      assert.notEqual(controller.progress.status, "failed");
    },
  };
}

test("all status transitions retain one immutable print and report only committed moves", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  assert.equal(c.currentStatus, "idle");
  for (const from of definition.statuses) {
    for (const to of definition.statuses) {
      c.requestStatus(from.id);
      await f.finish();
      c.requestStatus(to.id);
      await f.finish();
      assert.equal(c.currentStatus, to.id);
      assert(stateEquals(c.state, to.state));
      assert(matchesTarget(definition.print, c.state, to.target));
      assert.equal(c.progress.sessionTotal, f.committed.length);
      assert(c.sourceReference.length <= 4);
    }
  }
  assert.equal(
    f.configurations,
    1,
    "Events must not replace the print or installed assets",
  );
  assert.deepEqual(f.errors, []);
  c.dispose();
  assert.equal(f.disposed, 1);
});

test("rapid declarative events supersede after one legal turn and replan from its committed pose", async () => {
  const f = fixture(),
    c = f.controller,
    workflow = new StatusWorkflow(definition);
  await c.configure();
  for (const event of definition.demonstration) {
    workflow.dispatch(event);
    c.requestStatus(workflow.requested);
  }
  assert.equal(workflow.requested, "done");
  assert.equal(c.currentStatus, "idle");
  assert.equal(f.committed.length, 0);
  const first = f.pending[0].p;
  await f.step();
  assert(stateEquals(c.state, first.to));
  assert.equal(
    c.progress.target,
    definition.statuses.findIndex((s) => s.id === "done"),
  );
  assert.equal(
    serializeMove(f.pending[0].p.move),
    "U'",
    "Obsolete opposite-layer D' must never begin",
  );
  await f.finish();
  assert.equal(c.currentStatus, "done");
  assert(
    stateEquals(
      c.state,
      definition.statuses.find((s) => s.id === "done").state,
    ),
  );
  assert(
    !f.notices.some((n) => n.value === 1 && n.progress.status === "completed"),
  );
  assert.equal(c.progress.sessionTotal, f.committed.length);
});

test("returning to the last displayed state still repairs an interrupted partial cube", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  c.requestStatus("coding");
  c.requestStatus("idle");
  await f.step();
  assert.equal(c.currentStatus, "idle");
  assert.equal(c.busy, true);
  assert(!stateEquals(c.state, definition.statuses[0].state));
  await f.finish();
  assert.equal(f.committed.length, 2);
  assert(stateEquals(c.state, definition.statuses[0].state));
  assert.equal(c.currentStatus, "idle");
});

test("finish-active discards the queued target while completing a full requested display", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  c.requestStatus("coding");
  c.requestStatus("done");
  assert.equal(c.stopAfterCurrent(), 2);
  await f.finish();
  assert.equal(c.currentStatus, "coding");
  assert.equal(c.progress.status, "stopped");
  assert.equal(f.committed.length, 2);
});

test("animation failure freezes the last committed pose and does not invent a turn or auto-reset", async () => {
  const f = fixture(),
    c = f.controller;
  await c.configure();
  c.requestStatus("coding");
  await f.step();
  const retained = c.state,
    reference = c.sourceReference;
  f.pending.shift().reject(Error("Synthetic interrupted animation"));
  await flush();
  assert.equal(c.busy, false);
  assert.equal(c.progress.status, "failed");
  assert.equal(c.progress.sessionTotal, 1);
  assert.equal(f.committed.length, 1);
  assert(stateEquals(c.state, retained));
  assert.deepEqual(c.sourceReference, reference);
  assert.equal(c.currentStatus, "idle");
  assert.throws(() => c.requestStatus("done"), /Reload/);
  assert.equal(f.configurations, 1);
  assert.equal(f.errors.length, 1);
});

test("failed asset load or viewer installation leaves no falsely configured state and releases owned images", async () => {
  for (const options of [{ loadError: true }, { configureError: true }]) {
    const f = fixture(options),
      c = f.controller;
    await assert.rejects(c.configure(), /Synthetic/);
    assert.equal(c.state, null);
    assert.equal(c.busy, false);
    assert.equal(f.configurations, 0);
    assert.equal(f.disposed, options.configureError ? 1 : 0);
    assert.throws(() => c.requestStatus("done"), /not configured/);
  }
});
