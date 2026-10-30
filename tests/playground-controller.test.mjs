import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { TABLE_URL } from "@puzlwerk/solver-2x2";
import { stateEquals, validateState } from "@cubistry/cube-core";
import { applyMoves, parseAlg, stickerPoses } from "@cubistry/cube-mechanics";
import { createDesign, fullGoal } from "../src/apps/playground/model.ts";
import { PlaygroundController } from "../src/apps/playground/controller.ts";
import {
  PlaygroundError,
  createPlaygroundSolver,
  tableLoader,
  solverFailure,
} from "../src/apps/playground/solver.ts";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const tick = () => new Promise((r) => setImmediate(r));
async function idle(c) {
  for (let i = 0; i < 200 && c.snapshot.busy; i++) await tick();
  assert.equal(c.snapshot.busy, false);
}
function fixture({ gate = false, factory = prepareTestSolver } = {}) {
  const design = createDesign("picture"),
    assets = {},
    pending = [];
  const viewer = {
    presentedState: null,
    configure(p, s) {
      this.presentedState = s;
    },
    animate(p) {
      if (!gate) {
        this.presentedState = p.to;
        return Promise.resolve();
      }
      return new Promise((resolve, reject) =>
        pending.push({
          p,
          resolve: () => {
            this.presentedState = this.badEndpoint ? design.target : p.to;
            resolve();
          },
          reject,
        }),
      );
    },
  };
  const snapshots = [];
  let c;
  c = new PlaygroundController(
    viewer,
    { design, assets },
    () => {
      const s = c.snapshot;
      validateState(s.state, createDesign(s.style).print);
      snapshots.push(s);
    },
    factory,
  );
  return { c, viewer, pending, design, assets, snapshots };
}
test("manual + seeded scramble undo/redo exact roundtrip, branch truncation, invalid input unchanged", async () => {
  const { c, design, snapshots } = fixture();
  for (const word of ["x", "Rw", "R U ???", "M", "r", "R2x", ""]) {
    assert.equal(c.manual(word), false);
    assert.equal(c.snapshot.cursor, 0);
  }
  c.manual("R U2 L' B D F2");
  await idle(c);
  const six = c.snapshot.state;
  c.scramble(0, 15);
  await idle(c);
  const end = c.snapshot.state;
  assert.equal(c.snapshot.cursor, 21);
  assert.equal(c.snapshot.turns, 21);
  for (let i = 0; i < 21; i++) {
    assert.equal(c.undo(), true);
    await idle(c);
  }
  assert.ok(fullGoal(design, c.snapshot.state));
  for (let i = 0; i < 21; i++) {
    c.redo();
    await idle(c);
    if (i === 5) assert.ok(stateEquals(c.snapshot.state, six));
  }
  assert.ok(stateEquals(c.snapshot.state, end));
  c.undo();
  await idle(c);
  c.manual("R");
  await idle(c);
  assert.equal(c.redo(), false);
  assert.equal(c.snapshot.history.length, 21);
  for (const s of snapshots) {
    assert.equal(stickerPoses(design.print, s.state).length, 24);
    assert.ok(s.cursor <= s.history.length);
  }
});
test("preemption finishes only the active turn, rejects busy input, records completed prefix", async () => {
  const { c, pending, design } = fixture({ gate: true });
  c.scramble(0, 20);
  assert.equal(pending.length, 1);
  assert.equal(c.snapshot.cursor, 0);
  assert.equal(c.manual("U"), false);
  assert.equal(c.undo(), false);
  assert.equal(c.redo(), false);
  const active = pending.shift();
  c.cancel();
  assert.equal(c.snapshot.cursor, 0);
  active.resolve();
  await idle(c);
  assert.equal(c.snapshot.cursor, 1);
  assert.ok(stateEquals(c.snapshot.state, active.p.to));
  c.scramble(9, 20);
  const old = pending.shift();
  c.scramble(7, 1);
  old.resolve();
  await tick();
  assert.equal(c.snapshot.cursor, 2);
  assert.equal(pending.length, 1);
  pending.shift().resolve();
  await idle(c);
  assert.equal(c.snapshot.cursor, 3);
  assert.equal(c.snapshot.history.at(-1).source, "Scramble 7/1");
  assert.ok(!fullGoal(design, c.snapshot.state));
});
test("Solve preempts an old path and replays from the actual committed source", async () => {
  const { c, pending, design } = fixture({ gate: true });
  c.scramble(0, 20);
  const active = pending.shift();
  c.solve();
  active.resolve();
  for (let i = 0; i < 200 && c.snapshot.solverStatus !== "Verified"; i++) {
    while (pending.length) pending.shift().resolve();
    await tick();
  }
  assert.equal(c.snapshot.solverStatus, "Verified");
  assert.ok(fullGoal(design, c.snapshot.state));
  assert.equal(c.snapshot.history[0].source, "Scramble 0/20");
  assert.equal(
    c.snapshot.history.filter((e) => e.source === "Scramble 0/20").length,
    1,
  );
});
test("stale asynchronous solver load cannot animate after cancel, manual mutation or new design", async () => {
  for (const action of ["manual", "design", "cancel"]) {
    let resolve;
    const ready = new Promise((r) => (resolve = r));
    const { c, pending, design, assets } = fixture({
      gate: true,
      factory: () => ready,
    });
    c.solve();
    assert.equal(c.snapshot.solverStatus, "Loading");
    c.cancel();
    if (action === "manual") {
      c.manual("R");
      pending.shift().resolve();
      await idle(c);
    }
    if (action === "design")
      c.newSession({ design: createDesign("classic"), assets });
    const source = c.snapshot.state;
    resolve(await prepareTestSolver(design.print));
    await tick();
    await tick();
    assert.equal(pending.length, 0);
    assert.ok(stateEquals(c.snapshot.state, source));
    assert.notEqual(c.snapshot.solverStatus, "Playing");
  }
});
test("design switch settles active turn, creates a new print/session, clears old history", async () => {
  const { c, pending, assets } = fixture({ gate: true });
  c.manual("R U B");
  const active = pending.shift();
  const previous = c.snapshot.state;
  c.newSession({ design: createDesign("classic"), assets });
  assert.ok(stateEquals(c.snapshot.state, previous));
  active.resolve();
  await idle(c);
  assert.equal(c.snapshot.style, "classic");
  assert.equal(c.snapshot.history.length, 0);
  assert.equal(c.snapshot.exact, true);
  assert.equal(pending.length, 0);
});
test("viewer rejection or incorrect endpoint freezes without committing the failed turn", async () => {
  for (const mismatch of [false, true]) {
    const { c, pending, viewer, design } = fixture({ gate: true });
    c.manual("R U");
    const turn = pending.shift();
    if (mismatch) {
      viewer.badEndpoint = true;
      turn.resolve();
    } else turn.reject(Error("GPU failure"));
    await tick();
    assert.equal(c.snapshot.frozen, true);
    assert.equal(c.snapshot.cursor, 0);
    assert.ok(fullGoal(design, c.snapshot.state));
    assert.equal(c.snapshot.history.length, 0);
    assert.equal(c.manual("R"), false);
    c.solve();
    assert.equal(pending.length, 0);
    assert.match(c.snapshot.message, /Reload/);
  }
});
test("independent replay rejects wrong/illegal provider results before any playback", async () => {
  for (const moves of [
    [],
    [{ face: "R", turns: 1 }],
    [{ face: "x", turns: 1 }],
    [{ face: "R", turns: 3 }],
  ]) {
    const { c, design } = fixture({
      factory: async () => ({ solve: () => moves }),
    });
    c.manual("U");
    await idle(c);
    const source = c.snapshot.state;
    c.solve();
    await idle(c);
    assert.equal(c.snapshot.solverStatus, "Invalid");
    assert.ok(stateEquals(c.snapshot.state, source));
    assert.equal(c.snapshot.cursor, 1);
    assert.ok(!fullGoal(design, c.snapshot.state));
  }
});
test("explicit Unsupported/NoPath/Invalid/Timeout/unavailable errors preserve state", async () => {
  for (const code of [
    "Unsupported",
    "NoPath",
    "Invalid",
    "Timeout",
    "Unavailable",
  ]) {
    const { c } = fixture({
      factory: async () => {
        throw new PlaygroundError(code, "injected");
      },
    });
    c.manual("R");
    await idle(c);
    const source = c.snapshot.state;
    c.solve();
    await idle(c);
    assert.equal(c.snapshot.solverStatus, code);
    assert.ok(stateEquals(source, c.snapshot.state));
    assert.equal(c.snapshot.cursor, 1);
  }
  await assert.rejects(
    createPlaygroundSolver({ topology: { size: 3 } }),
    (e) => e.code === "Unsupported",
  );
  assert.equal(
    solverFailure(new DOMException("timed out", "TimeoutError")).code,
    "Timeout",
  );
});
test("bounded cached table loader rejects oversized/truncated/http failures and retries", async () => {
  const expected = 1837112;
  for (const response of [
    () => new Response(new Uint8Array(expected + 1)),
    () => new Response(new Uint8Array(5)),
    () => new Response("", { status: 404 }),
    () => new Response("", { headers: { "content-length": "999999999" } }),
  ]) {
    let calls = 0;
    const load = tableLoader(async () => {
      calls++;
      return response();
    });
    await assert.rejects(load());
    await assert.rejects(load());
    assert.equal(calls, 2);
  }
  let calls = 0;
  const load = tableLoader(async () => {
    calls++;
    return new Response(readFileSync(TABLE_URL));
  });
  assert.equal((await load()).length, expected);
  await load();
  assert.equal(calls, 1);
  const timeout = tableLoader(async () => {
    throw new DOMException("deadline", "TimeoutError");
  });
  await assert.rejects(timeout(), (e) => solverFailure(e).code === "Timeout");
});
