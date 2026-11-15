// The calendar's runtime planner: front-goal solver in a worker, queue and deadline of CalendarOptimizer,
// every route verified by the controller. The old cubing.js planner is not part of the calendar runtime.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { CalendarController } from "../src/apps/calendar/controller.ts";
import {
  CalendarOptimizer,
  DEFAULT_SOLVER_TIMEOUT_MS,
} from "../src/apps/calendar/optimizer.ts";
import {
  FRONT_LIMITS,
  planCalendarRoute,
} from "../src/apps/calendar/front-planner.ts";
import {
  apply,
  civilDate,
  findTarget,
  matches,
  shiftDate,
  simplify,
  tokens,
  validateDesign,
} from "../src/apps/calendar/model.ts";

const load = (id) =>
  validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`)));
const settled = (c) =>
  new Promise((resolve, reject) => {
    const start = Date.now();
    const timer = setInterval(() => {
      if (!c.busy) (clearInterval(timer), resolve());
      else if (Date.now() - start > 20000)
        (clearInterval(timer), reject(Error("Controller did not settle")));
    }, 1);
  });

test("limits are table 3000 ms, search 4000 ms, 5e6 nodes; deadline stays 8000 ms", () => {
  assert.deepEqual(
    { ...FRONT_LIMITS },
    { tableMs: 3000, searchMs: 4000, maxNodes: 5_000_000 },
  );
  assert.equal(DEFAULT_SOLVER_TIMEOUT_MS, 8000);
});

test("the planner passes the limits to the solver and returns the baseline word on a budget answer", () => {
  const design = load("de-a"),
    a = findTarget(design, civilDate("2027-01-01")),
    b = findTarget(design, civilDate("2027-01-02"));
  const requests = [];
  for (const status of [
    "searchBudget",
    "tableBudget",
    "noRoute",
    "cancelled",
  ]) {
    const reply = planCalendarRoute(
      {
        design,
        from: apply(design.printing, a.word),
        target: b,
        sourceWord: a.word,
        fallbackWord: "R U R'",
      },
      (request) => (
        requests.push(request),
        {
          version: 1,
          status,
          nodes: 1,
          permille: 1,
          reason: "x",
          stage: "search",
        }
      ),
    );
    assert.equal(reply.word, "R U R'");
    assert.equal(reply.diagnostics.solverStatus, status);
  }
  for (const r of requests)
    assert.equal(
      r.tableMs === 3000 && r.searchMs === 4000 && r.maxNodes === 5_000_000,
      true,
    );
});

test("a real solve returns a route that shows the target", () => {
  for (const id of ["de-a", "en-3-zero"]) {
    const design = load(id),
      a = findTarget(design, civilDate("2027-01-01")),
      b = findTarget(design, civilDate("2027-01-02")),
      from = apply(design.printing, a.word);
    const reply = planCalendarRoute({
      design,
      from,
      target: b,
      sourceWord: a.word,
      fallbackWord: "",
    });
    assert.equal(reply.diagnostics.solverStatus, "solved");
    assert.equal(reply.diagnostics.backendUsed, "front");
    assert.ok(matches(apply(from, reply.word), b.cells), id);
    assert.ok(tokens(reply.word).length < 16);
  }
});

test("optimizer with the front planner as its worker: queue, supersede, cancel by terminate", async () => {
  const design = load("de-a"),
    a = findTarget(design, civilDate("2027-01-01")),
    from = apply(design.printing, a.word);
  const workers = [];
  const make = () => {
    const w = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      dead: false,
      postMessage(m) {
        const { word, diagnostics } = planCalendarRoute(m.context);
        setImmediate(
          () =>
            !w.dead && w.onmessage({ data: { id: m.id, word, diagnostics } }),
        );
      },
      terminate() {
        w.dead = true;
      },
    };
    workers.push(w);
    return w;
  };
  const optimizer = new CalendarOptimizer(make);
  const t1 = findTarget(design, civilDate("2027-01-02")),
    t2 = findTarget(design, civilDate("2027-01-03")),
    t3 = findTarget(design, civilDate("2027-01-04"));
  const ctx = (target) => ({
    design,
    from,
    target,
    sourceWord: a.word,
    fallbackWord: "R",
  });
  const first = optimizer.plan(ctx(t1));
  const second = optimizer.plan(ctx(t2));
  const third = optimizer.plan(ctx(t3));
  await assert.rejects(second, /superseded/);
  assert.ok(matches(apply(from, await first), t1.cells));
  assert.ok(matches(apply(from, await third), t3.cells));
  assert.equal(optimizer.solverStatus, "solved");
  const fourth = optimizer.plan(ctx(t1));
  const fifth = optimizer.plan(ctx(t2));
  optimizer.plan.cancelPlanning();
  await assert.rejects(fifth, /superseded/);
  await fourth.catch(() => {});
  assert.ok(
    workers.some((w) => w.dead),
    "cancel terminates the worker",
  );
  optimizer.dispose();
});

test("the browser worker is the front worker and the calendar runtime has no cubing.js", () => {
  assert.match(
    readFileSync("src/apps/calendar/optimizer.ts", "utf8"),
    /new URL\("\.\/front-worker\.ts", import\.meta\.url\)/,
  );
  for (const f of [
    "front-worker.ts",
    "front-planner.ts",
    "front-goal.ts",
    "optimizer.ts",
    "controller.ts",
    "mount.ts",
    "browser-env.ts",
  ]) {
    const text = readFileSync(`src/apps/calendar/${f}`, "utf8");
    assert.doesNotMatch(
      text,
      /from "cubing|import\("cubing|center-planner|transition\/planner/,
      f,
    );
  }
});

for (const id of ["de-a", "en-3-zero"])
  test(`controller chain on ${id}: every route is verified, none falls back, the reference word grows (no compaction)`, async () => {
    const design = load(id);
    let date = civilDate("2027-01-01");
    const initial = findTarget(design, date);
    let pose;
    const planner = (ctx) => planCalendarRoute(ctx).word;
    assert.equal(planner.compactReference, undefined);
    const c = new CalendarController(
      design,
      initial,
      {
        configure(_d, s) {
          pose = s;
        },
        async animate(from, token, to) {
          assert.deepEqual(apply(from, token), to);
          pose = to;
        },
      },
      (_t, _b, e) => assert.ifError(e),
      planner,
    );
    const start = c.referenceMoveCount;
    for (let i = 0; i < 20; i++) {
      date = shiftDate(date, 1);
      const target = findTarget(design, date);
      c.request(target);
      await settled(c);
      assert.ok(matches(pose, target.cells), date.iso);
      assert.equal(c.progress.route, "optimized", date.iso);
      assert.ok(
        c.progress.total.htm <= 12,
        `${date.iso} htm ${c.progress.total.htm}`,
      );
      assert.ok(c.progress.total.rotations <= 2);
    }
    // documented policy: the executed word is the reference, about 9 tokens per click
    assert.ok(
      c.referenceMoveCount > start + 100,
      `reference ${c.referenceMoveCount}`,
    );
    assert.deepEqual(apply(design.printing, c.sourceReferenceWord), pose);
  });
