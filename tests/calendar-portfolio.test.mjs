import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  tryCenterPortfolio,
  tryCenterAware,
  referencesForPlan,
} from "../src/apps/calendar/center-planner.mjs";
import { CalendarOptimizer } from "../src/apps/calendar/optimizer.ts";
import {
  apply,
  validateDesign,
  findTarget,
  civilDate,
  inverse,
  simplify,
  tokens,
  sameState,
  matches,
} from "../src/apps/calendar/model.ts";
const fixture = JSON.parse(
  fs.readFileSync("tests/fixtures/calendar-portfolio-contexts.json"),
);
const load = (id) =>
  validateDesign(JSON.parse(fs.readFileSync(`public/calendar/${id}.json`)));
const context = (design, target, sourceWord) => ({
  design,
  target,
  sourceWord,
  from: apply(design.printing, sourceWord),
  fallbackWord: simplify(inverse(sourceWord) + " " + target.word),
});
test("bounded portfolio improves all recorded November actual poses without relaxing hidden state", () => {
  for (const row of fixture.contexts) {
    assert.equal(
      createHash("sha256")
        .update(fs.readFileSync(`public/calendar/${row.id}.json`))
        .digest("hex"),
      fixture.printingSHA256[row.id],
    );
    const design = load(row.id),
      target = findTarget(design, civilDate("2026-11-04")),
      ctx = context(design, target, row.sourceWord),
      interims = [];
    const result = tryCenterPortfolio(ctx, row.directWord, {}, (r) =>
      interims.push(r),
    );
    assert(
      tokens(result.word).length <= row.expectedMoves,
      JSON.stringify(row),
    );
    assert.equal(result.maximumTotalNodes, 200000);
    assert(result.attempts.length <= 2);
    assert(result.attempts.every((a) => a.maximumNodes === 100000));
    assert.equal(interims.length, 1);
    assert(tokens(result.word).length <= tokens(interims[0].word).length);
    const refs = referencesForPlan(ctx, result.word),
      end = apply(ctx.from, result.word);
    assert(matches(end, target.cells));
    assert(sameState(apply(design.printing, refs.fromReferenceWord), ctx.from));
    assert(sameState(apply(design.printing, refs.endReferenceWord), end));
  }
});
test("an unknown shorter search retains the successful default route and emits it first", () => {
  const design = load("de-a"),
    target = findTarget(design, civilDate("2026-10-29")),
    sourceWord = target.word + " R",
    ctx = context(design, target, sourceWord);
  const direct = "R' R L R' L'",
    interims = [];
  const result = tryCenterPortfolio(ctx, direct, { threshold: 0 }, (r) =>
    interims.push(r),
  );
  assert.equal(result.attempts[0].status, "solved");
  assert.equal(result.attempts[1].status, "unknown");
  assert.equal(tokens(result.word).length, 1);
  assert.equal(result.word, interims[0].word);
  assert(matches(apply(ctx.from, result.word), target.cells));
});
test("deadline preserves an interim center-aware candidate and its backend truth", async () => {
  const row = fixture.contexts[0],
    design = load(row.id),
    target = findTarget(design, civilDate("2026-11-04")),
    ctx = context(design, target, row.sourceWord);
  const first = tryCenterAware(ctx, row.directWord),
    references = referencesForPlan(ctx, first.word);
  let worker;
  const optimizer = new CalendarOptimizer(
    () =>
      (worker = {
        onmessage: null,
        onerror: null,
        onmessageerror: null,
        postMessage({ id }) {
          queueMicrotask(() =>
            this.onmessage({
              data: {
                id,
                interimWord: first.word,
                references,
                diagnostics: {
                  backendUsed: "center-aware",
                  solverStatus: "solved",
                  chosenMoves: tokens(first.word).length,
                  maximumTotalNodes: 200000,
                },
              },
            }),
          );
        },
        terminate() {
          this.dead = true;
        },
      }),
    15,
  );
  assert.equal(await optimizer.plan(ctx), first.word);
  const end = apply(ctx.from, first.word),
    compact = optimizer.plan.compactReference({
      design,
      state: end,
      target,
      referenceWord: ctx.sourceWord + " " + first.word,
    });
  assert(sameState(apply(design.printing, compact), end));

  assert.equal(optimizer.diagnostics.backendUsed, "center-aware");
  assert.equal(optimizer.diagnostics.retainedCandidateStatus, "solved");
  assert.equal(optimizer.diagnostics.solverStatus, "deadline");
  assert.equal(worker.dead, true);
  optimizer.dispose();
});

test("the short native cap counts outer turns separately from global alignment", () => {
  const row = fixture.contexts[0],
    design = load(row.id),
    target = findTarget(design, civilDate("2026-11-04")),
    ctx = context(design, target, row.sourceWord + " x");
  const r = tryCenterPortfolio(ctx, "x' " + row.directWord);
  assert.equal(r.attempts[1].maximumDepth, 18);
  assert.equal(tokens(r.word).filter((t) => /^[ULFRBD]/.test(t)).length, 18);
  assert.equal(tokens(r.word).filter((t) => /^[xyz]/.test(t)).length, 1);
  const refs = referencesForPlan(ctx, r.word);
  assert(
    sameState(
      apply(design.printing, refs.endReferenceWord),
      apply(ctx.from, r.word),
    ),
  );
});
