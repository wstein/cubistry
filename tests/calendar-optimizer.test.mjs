import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { KPattern } from "cubing/kpuzzle";
import { puzzles } from "cubing/puzzles";
import { experimentalSolve3x3x3IgnoringCenters as solve } from "cubing/search";
import { createTransitionOptimizer } from "../src/apps/calendar/transition/planner.mjs";
import { CalendarOptimizer } from "../src/apps/calendar/optimizer.ts";
import { CalendarController } from "../src/apps/calendar/controller.ts";
import {
  apply,
  civilDate,
  findTarget,
  inverse,
  matches,
  sameState,
  simplify,
  tokens,
  validateDesign,
} from "../src/apps/calendar/model.ts";
const corrections = JSON.parse(
  readFileSync("src/apps/calendar/transition/center-corrections.json"),
).witnesses;
const load = (id) =>
  validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`)));
const settled = (c) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (!c.busy) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > 10000) {
        clearInterval(timer);
        reject(Error("Controller did not settle"));
      }
    }, 1);
  });

test("direct relative routes shorten German and English dates while preserving actual hidden frames", async () => {
  const kpuzzle = await puzzles["3x3x3"].kpuzzle();
  for (const id of ["de-a", "en-3-zero", "en-3-unpadded"]) {
    const design = load(id),
      initial = findTarget(design, civilDate("2026-10-28"));
    const optimizer = createTransitionOptimizer({
      printing: design.printing,
      kpuzzle,
      KPattern,
      solve,
      corrections,
    });
    let pose,
      committed = 0;
    const c = new CalendarController(
      design,
      initial,
      {
        configure(_d, state) {
          pose = state;
        },
        async animate(from, token, to) {
          assert(sameState(pose, from));
          assert(sameState(apply(from, token), to));
          pose = to;
          committed++;
        },
      },
      (_target, _busy, error) => {
        assert.ifError(error);
      },
      async (context) => {
        const result = await optimizer.plan(
          context.from,
          context.target,
          context.fallbackWord,
          { maxAttempts: 6, timeBudgetMs: 1500 },
        );
        assert(
          tokens(result.word).length < tokens(context.fallbackWord).length,
        );
        return result.word;
      },
    );
    const baseline = tokens(
      simplify(
        inverse(initial.word) +
          " " +
          findTarget(design, civilDate("2026-10-29")).word,
      ),
    ).length;
    assert.equal(baseline, id === "de-a" ? 79 : 77);
    for (const iso of [
      "2026-10-29",
      "2026-10-30",
      "2026-10-29",
      "2026-07-11",
    ]) {
      const target = findTarget(design, civilDate(iso));
      c.request(target);
      await settled(c);
      assert(matches(pose, target.cells));
      assert(sameState(pose, c.physicalState));
      assert.equal(c.progress.route, "optimized");
      assert.deepEqual(c.progress.completed, c.progress.total);
      if (
        iso === "2026-10-29" &&
        committed === c.progress.total.htm + c.progress.total.rotations
      )
        assert(c.progress.total.htm + c.progress.total.rotations <= 22);
    }
  }
});

function worker() {
  return {
    onmessage: null,
    onerror: null,
    onmessageerror: null,
    messages: [],
    dead: false,
    postMessage(value) {
      this.messages.push(value);
    },
    terminate() {
      this.dead = true;
    },
    reply(word) {
      this.onmessage({ data: { id: this.messages.at(-1).id, word } });
    },
  };
}
const context = {
  design: {},
  from: [],
  target: {},
  sourceWord: "",
  fallbackWord: "R U",
};
test("worker deadline terminates stalled solver and later requests get a fresh worker", async () => {
  const instances = [];
  const p = new CalendarOptimizer(() => {
    const w = worker();
    instances.push(w);
    return w;
  }, 15);
  await assert.rejects(p.plan(context), /deadline/);
  assert.equal(instances[0].dead, true);
  const next = p.plan(context);
  instances[0].onerror({});
  instances[0].onmessageerror({});
  instances[1].reply("R");
  assert.equal(await next, "R");
  p.dispose();
  assert.equal(instances[1].dead, true);
});
test("worker queue keeps one solve and the latest pending request; stale messages cannot resolve it", async () => {
  const w = worker(),
    p = new CalendarOptimizer(() => w, 1000);
  const a = p.plan(context),
    b = p.plan(context),
    canceled = assert.rejects(b, /superseded/),
    c = p.plan(context);
  assert.equal(w.messages.length, 1);
  w.reply("R");
  assert.equal(await a, "R");
  await canceled;
  assert.equal(w.messages.length, 2);
  w.onmessage({ data: { id: 1, word: "B" } });
  w.reply("U");
  assert.equal(await c, "U");
  p.dispose();
  await assert.rejects(p.plan(context), /disposed/);
});
test("worker failure falls back to verified physical playback without disabling the controller", async () => {
  const d = load("de-a"),
    initial = findTarget(d, civilDate("2026-10-28"));
  const p = new CalendarOptimizer(() => {
    throw Error("Worker blocked");
  });
  const c = new CalendarController(
    d,
    initial,
    { configure() {}, async animate() {} },
    (_t, _b, e) => assert.ifError(e),
    p.plan,
  );
  c.request(findTarget(d, civilDate("2026-10-29")));
  await settled(c);
  assert.equal(c.progress.route, "fallback");
  assert.equal(c.progress.total.htm, 79);
  assert(matches(c.physicalState, c.current.cells));
  p.dispose();
});
