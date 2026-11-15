// Adapter of the 3x3 calendar for the front-goal solver (@puzlwerk/solver-3x3-front):
// goal, pose normalizer and route mapper, checked against the app's own predicate and move engine.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { solveFront3x3 } from "@puzlwerk/solver-3x3-front";
import {
  apply,
  civilDate,
  findTarget,
  inverse,
  matches,
  shiftDate,
  tokens,
  validateDesign,
} from "../src/apps/calendar/model.ts";
import { countCalendarMoves } from "../src/apps/calendar/controller.ts";
import {
  buildFrontGoal,
  goalAccepts,
  goalAcceptsAnyRotation,
  normalizePose,
  planFrontRoute,
  routeInAppFrame,
} from "../src/apps/calendar/front-goal.ts";

const PRINTS = ["de-a", "de-a-unpadded", "en-3-zero", "en-3-unpadded"];
// sha256 of the print files that every case below starts from; B changes none of them.
const PRINT_HASH = {
  "de-a": "1f5ecf89f4127ac1dd27e662c51193ca7d24677ba49abbca2737e306dc9cef56",
  "de-a-unpadded":
    "bdddb4b11135602b8de3b3b527a1b3a6b2843ee66573e2860aca35e5097d3f29",
  "en-3-zero":
    "cb6a556d02f03806b1742bf7720216222934bc0652dd4ace12dcd97de876da0c",
  "en-3-unpadded":
    "156e6b4d642f9737ee03597bf84a940b3d36f0271c46345bac4083eb99a36022",
};
const RESEARCH = "research/calendar-3x3-front-goal";
const designs = new Map(
  PRINTS.map((id) => [
    id,
    validateDesign(JSON.parse(readFileSync(`public/calendar/${id}.json`))),
  ]),
);
const lines = (file) =>
  readFileSync(file, "utf8")
    .split("\n")
    .filter((l) => l && !l.startsWith("#") && !l.startsWith("print\t"));
const parseAccepted = (text) =>
  text.split(" ").map((g) => g.split(",").map(Number));

// The app pose before step n of the recorded app chain (route words as the app executed them).
function chainPose(id, step) {
  const design = designs.get(id);
  const init = readFileSync(`${RESEARCH}/data/initial-${id}.tsv`, "utf8")
    .trim()
    .split("\t");
  const rows = lines(`${RESEARCH}/data/app-chain-${id}.tsv`).map((l) =>
    l.split("\t"),
  );
  let pose = apply(design.printing, init[2]);
  for (let i = 0; i < step - 1; i++) pose = apply(pose, rows[i][6]);
  return { pose, date: rows[step - 1][1] };
}

const CASES = lines("tests/fixtures/front_goal_calendar.tsv").map((l) => {
  const [print, step, date, htm, cells, facelets, twists, accepted] =
    l.split("\t");
  return {
    print,
    step: Number(step),
    date,
    expectedHtm: Number(htm),
    cells: cells.split("|"),
    facelets,
    twists: twists.split(",").map(Number),
    accepted: parseAccepted(accepted),
  };
});

/**
 * Every check of one case, as a list of named failures. `mutate` perturbs one
 * step so that the mutation tests below can name the check that must fail.
 */
function runCase(c, mutate = {}) {
  const failures = [];
  const design = designs.get(c.print);
  const { pose, date } = chainPose(c.print, c.step);
  if (date !== c.date) failures.push("fixture-date");
  const target = findTarget(design, civilDate(c.date));
  const goal = { ...buildFrontGoal(design.printing, target.cells) };
  if (mutate.goal) Object.assign(goal, mutate.goal(goal));
  if (JSON.stringify(goal.accepted) !== JSON.stringify(c.accepted))
    failures.push("accepted-lists");
  if (goal.centerUp !== (c.cells[4] !== "")) failures.push("center-up");
  const np = normalizePose(design.printing, pose);
  if (np.facelets !== c.facelets || np.twists.join() !== c.twists.join())
    failures.push("pose-normalizer");
  const result = solveFront3x3({
    facelets: np.facelets,
    centerTwists: [...np.twists],
    accepted: goal.accepted.map((l) => [...l]),
    centerUp: goal.centerUp,
  });
  if (result.status !== "ok") return [...failures, "solver-" + result.status];
  if (result.moves.length !== c.expectedHtm) failures.push("optimal-htm");
  let word;
  try {
    word = routeInAppFrame(
      pose,
      mutate.normalizer ? mutate.normalizer(np.normalizer) : np.normalizer,
      mutate.moves ? mutate.moves(result.moves) : result.moves.join(" "),
      mutate.rotation ? mutate.rotation(result.rotation) : result.rotation,
    );
  } catch (e) {
    return [...failures, "route-replay"];
  }
  if (!matches(apply(pose, word), target.cells)) failures.push("route-matches");
  const counts = countCalendarMoves(word);
  if (counts.htm !== result.moves.length) failures.push("move-count");
  if (counts.rotations > 2) failures.push("rotation-tokens");
  return failures;
}

test("the print files are the pinned ones", () => {
  for (const id of PRINTS)
    assert.equal(
      createHash("sha256")
        .update(readFileSync(`public/calendar/${id}.json`))
        .digest("hex"),
      PRINT_HASH[id],
      id,
    );
});

test("accepted lists equal matches() on the 504 predicate cases and any-rotation is no stricter", () => {
  const rows = lines(`${RESEARCH}/fixtures/predicate-cases.tsv`).map((l) =>
    l.split("\t"),
  );
  assert.equal(rows.length, 504);
  let positive = 0;
  for (const [print, expected, cells, word] of rows) {
    const design = designs.get(print);
    const state = apply(design.printing, word);
    const goal = buildFrontGoal(design.printing, cells.split("|"));
    const want = matches(state, cells.split("|"));
    assert.equal(want, expected === "1", `${print} ${word}`);
    assert.equal(
      goalAccepts(design.printing, state, goal),
      want,
      `${print} ${cells} ${word}`,
    );
    if (want) assert.ok(goalAcceptsAnyRotation(design.printing, state, goal));
    positive += want ? 1 : 0;
  }
  assert.ok(positive > 50 && positive < 504, `positive ${positive}`);
});

test("the 80 fixture cases: goal, normalizer, optimal route, replay and counts", () => {
  assert.equal(CASES.length, 80);
  for (const c of CASES)
    assert.deepEqual(runCase(c), [], `${c.print} step ${c.step}`);
});

test("chained routes of 20 days on each of the 4 prints all replay to the target", () => {
  let routes = 0,
    rotations = 0;
  for (const id of PRINTS) {
    const design = designs.get(id);
    const init = readFileSync(`${RESEARCH}/data/initial-${id}.tsv`, "utf8")
      .trim()
      .split("\t");
    let pose = apply(design.printing, init[2]);
    let date = civilDate(init[0]);
    for (let day = 0; day < 20; day++) {
      date = shiftDate(date, 1);
      const target = findTarget(design, date);
      const plan = planFrontRoute(design.printing, pose, target, solveFront3x3);
      assert.equal(plan.status, "ok", `${id} ${date.iso}`);
      pose = apply(pose, plan.word);
      assert.ok(matches(pose, target.cells), `${id} ${date.iso} ${plan.word}`);
      const counts = countCalendarMoves(plan.word);
      assert.ok(counts.rotations <= 2);
      rotations += counts.rotations;
      routes++;
    }
  }
  assert.equal(routes, 80);
  assert.ok(rotations > 0, "some routes end with a whole-cube rotation");
});

// Each mutation breaks exactly one step of the adapter; the named check must report it.
const SAMPLE = CASES.filter((c) => c.step % 4 === 1);
const mustFail = (mutate, check) => {
  const hits = SAMPLE.filter((c) => runCase(c, mutate).includes(check));
  assert.ok(hits.length > 0, `no sample case reports ${check}`);
  return hits.length;
};

test("mutation: a truncated accepted list is caught by the accepted-list check", () => {
  mustFail(
    {
      goal: (g) => ({
        accepted: g.accepted.map((l, i) => (i === 0 ? l.slice(0, -1) : l)),
      }),
    },
    "accepted-lists",
  );
});
test("mutation: swapped accepted lists of two positions are caught", () => {
  mustFail(
    {
      goal: (g) => {
        const accepted = g.accepted.map((l) => [...l]);
        [accepted[0], accepted[2]] = [accepted[2], accepted[0]];
        return { accepted };
      },
    },
    "accepted-lists",
  );
});
test("mutation: centerUp dropped is caught", () => {
  const hits = CASES.filter((c) =>
    runCase(c, { goal: () => ({ centerUp: false }) }).includes("center-up"),
  );
  assert.ok(hits.length > 0);
});
test("mutation: a wrong conjugation direction is caught by the route replay or the target check", () => {
  const n = SAMPLE.filter((c) => {
    const r = runCase(c, { normalizer: (w) => (w ? inverse(w) : "x") });
    return r.includes("route-replay") || r.includes("route-matches");
  }).length;
  assert.ok(n > 0);
});
test("mutation: a wrong final-rotation order is caught", () => {
  const n = CASES.filter((c) => {
    const r = runCase(c, { rotation: (w) => tokens(w).reverse().join(" ") });
    return r.includes("route-replay") || r.includes("route-matches");
  }).length;
  assert.ok(n > 0);
});
test("mutation: a dropped last move is caught by the target check", () => {
  mustFail({ moves: (m) => m.slice(0, -1).join(" ") }, "route-matches");
});
