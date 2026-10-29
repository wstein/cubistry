import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { setImmediate as immediate } from "node:timers/promises";
import { centerKernelReference } from "@puzlwerk/solver-3x3-picture";
import { CalendarController } from "../src/apps/calendar/controller.ts";
import { CalendarOptimizer } from "../src/apps/calendar/optimizer.ts";
import {
  apply,
  civilDate,
  findTarget,
  sourcePose,
  inverse,
  simplify,
  tokens,
  matches,
  sameState,
  validateDesign,
} from "../src/apps/calendar/model.ts";
import {
  tryCenterAware,
  referencesForPlan,
  pictureRequest,
} from "../src/apps/calendar/center-planner.mjs";
const load = (id) =>
  validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`)));
const settled = async (c) => {
  const start = performance.now();
  while (c.busy) {
    assert(performance.now() - start < 60000);
    await immediate();
  }
};
const context = (design, target, word) => ({
  design,
  target,
  from: apply(design.printing, word),
  sourceWord: word,
  fallbackWord: simplify(inverse(word) + " " + target.word),
});

test("goal-relative center conversion solves rotated, nonzero printed targets without changing images", () => {
  for (const id of ["de-a", "en-3-zero", "en-3-unpadded"]) {
    const design = load(id);
    for (const iso of [
      "2026-01-03",
      "2026-02-28",
      "2026-07-11",
      "2026-12-31",
    ]) {
      const target = findTarget(design, civilDate(iso)),
        ctx = context(design, target, target.word + " R U F' x"),
        request = pictureRequest(ctx);
      assert(request.alignment);
      assert.equal(request.symmetry.filter((x) => x === 4).length, 1);
      const result = tryCenterAware(ctx, ctx.fallbackWord + " R L R' L'", {
        threshold: 0,
        maximumDepth: 6,
        maximumNodes: 200000,
      });
      assert.equal(result.method, "center-aware", JSON.stringify(result));
      assert(tokens(result.word).length <= 4);
      assert(matches(apply(ctx.from, result.word), target.cells));
      assert.deepEqual(
        apply(ctx.from, result.word).map((s) => s.image),
        design.printing.map((s) => s.image),
      );
    }
  }
});

test("actual printed goal avoids the posthoc center repair and improves the recorded German fixture", () => {
  const design = load("de-a"),
    a = findTarget(design, civilDate("2026-10-28")),
    b = findTarget(design, civilDate("2026-10-29"));
  const ctx = context(design, b, a.word),
    result = tryCenterAware(ctx, "D2 F2 L2 D F2 D R2 U2 B2 U' B2 U2 B' U' B' U R' U R'", { threshold: 0 });
  assert.equal(result.method, "center-aware");
  assert.equal(tokens(result.word).length, 18);
  const references = referencesForPlan(ctx, result.word);
  assert(
    sameState(apply(design.printing, references.fromReferenceWord), ctx.from),
  );
  assert(
    sameState(
      apply(design.printing, references.endReferenceWord),
      apply(ctx.from, result.word),
    ),
  );
});

test("one thousand noncanonical transitions keep an exact bounded source reference", async () => {
  const design = load("de-a"),
    a = findTarget(design, civilDate("2026-10-28")),
    b = findTarget(design, civilDate("2026-10-29"));
  const forward = "U R2 U2 B U' B' R' U2 R U' R2 F2 U' R2 U' R2 U F2",
    hidden = centerKernelReference([2, 0, 0, 0, 0, 0]).moves.join(" ");
  let first = true,
    entry,
    pose,
    maximum = 0;
  const planner = (ctx) => {
    const direction = ctx.target === b ? forward : inverse(forward),
      word = direction + " " + (first ? hidden : "R L R' L'");
    first = false;
    const refs = referencesForPlan(ctx, word);
    entry = { ...refs, from: ctx.from, end: apply(ctx.from, word) };
    return word;
  };
  planner.compactReference = ({ state, referenceWord }) =>
    entry && sameState(state, entry.from)
      ? entry.fromReferenceWord
      : entry && sameState(state, entry.end)
        ? entry.endReferenceWord
        : referenceWord;
  const c = new CalendarController(
    design,
    a,
    {
      configure(_d, state) {
        pose = state;
      },
      async animate(from, token, to) {
        assert(sameState(from, pose));
        assert(sameState(apply(from, token), to));
        pose = to;
      },
    },
    (_t, _b, e) => assert.ifError(e),
    planner,
  );
  for (let i = 0; i < 1000; i++) {
    const target = i % 2 === 0 ? b : a;
    c.request(target);
    await settled(c);
    assert(matches(pose, target.cells));
    maximum = Math.max(maximum, c.referenceMoveCount);
    assert(c.referenceMoveCount < 400);
    if (i % 100 === 0)
      assert(sameState(apply(design.printing, c.sourceReferenceWord), pose));
  }
  assert(
    !sameState(pose, sourcePose(design, a)),
    "Hidden U-center difference must not be reset",
  );
  assert(maximum > 0);
  assert(sameState(apply(design.printing, c.sourceReferenceWord), pose));
});

test("a canonical-looking but wrong hidden-center reference is never adopted", async () => {
  const design = load("de-a"),
    a = findTarget(design, civilDate("2026-10-28")),
    b = findTarget(design, civilDate("2026-10-29"));
  const planner = () => "U R2 U2 B U' B' R' U2 R U' R2 F2 U' R2 U' R2 U F2";
  planner.compactReference = () => b.word;
  const c = new CalendarController(
    design,
    a,
    { configure() {}, async animate() {} },
    (_t, _b, e) => assert.ifError(e),
    planner,
  );
  c.request(b);
  await settled(c);
  assert.notEqual(c.sourceReferenceWord, b.word);
  assert(
    sameState(apply(design.printing, c.sourceReferenceWord), c.physicalState),
  );
});

test("a center-search deadline preserves the already computed direct candidate", async () => {
  let worker;
  const p = new CalendarOptimizer(
    () =>
      (worker = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage(message) {
          setTimeout(
            () =>
              worker.onmessage({ data: { id: message.id, interimWord: "R" } }),
            0,
          );
        },
        terminate() {
          this.dead = true;
        },
      }),
    20,
  );
  const result = await p.plan({
    design: {},
    from: [],
    target: {},
    sourceWord: "",
    fallbackWord: "R U",
  });
  assert.equal(result, "R");
  assert.equal(worker.dead, true);
  assert.equal(p.diagnostics.solverStatus, "deadline");
  p.dispose();
});

test("superseding a target terminates obsolete planning and starts a fresh worker immediately", async () => {
  const workers = [];
  const optimizer = new CalendarOptimizer(() => {
    const worker = {
      onmessage: null, onerror: null, onmessageerror: null,
      postMessage(message) { this.message = message; },
      terminate() { this.dead = true; },
    };
    workers.push(worker);
    return worker;
  }, 8000);
  const context = { design: {}, from: [], target: {}, sourceWord: "", fallbackWord: "R" };
  const obsolete = optimizer.plan(context);
  const rejection = assert.rejects(obsolete, /superseded/);
  optimizer.plan.cancelPlanning();
  await rejection;
  assert.equal(workers[0].dead, true);
  const fresh = optimizer.plan(context);
  assert.equal(workers.length, 2);
  workers[0].onmessage({data: {id: workers[0].message.id, word: "U"}});
  workers[1].onmessage({data: {id: workers[1].message.id, word: "R"}});
  assert.equal(await fresh, "R");
  optimizer.dispose();
});

test("bounded search and a route that cannot be shortened retain the checked direct word", () => {
  const design = load("de-a"), target = findTarget(design, civilDate("2026-10-29"));
  const ctx = context(design, target, target.word + " R");
  const result = tryCenterAware(ctx, "R'", {threshold: 0, maximumNodes: 1});
  assert.equal(result.word, "R'");
  assert.equal(result.method, "direct");
  assert(matches(apply(ctx.from, result.word), target.cells));
});
