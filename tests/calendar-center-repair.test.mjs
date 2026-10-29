import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createHash } from "node:crypto";
import {
  createPlanner,
  referencesForPlan,
} from "../src/apps/calendar/center-planner.mjs";
import {
  apply,
  validateDesign,
  findTarget,
  civilDate,
  inverse,
  simplify,
  sameState,
  matches,
  tokens,
} from "../src/apps/calendar/model.ts";
const corrections = JSON.parse(
  fs.readFileSync("src/apps/calendar/transition/center-corrections.json"),
);
const load = (id) =>
  validateDesign(JSON.parse(fs.readFileSync(`public/calendar/${id}.json`)));
const center = (s) => s.p.filter(Boolean).length === 1;
test("short visible-center repair witnesses restore every noncenter frame and requested orientation", () => {
  for (const id of ["de-a", "en-3-zero", "en-3-unpadded"]) {
    const d = load(id);
    for (const w of corrections.witnesses) {
      assert.equal(tokens(w.word).length, w.htm);
      assert.equal(w.htm, w.frontCenterFinalUp[1] === -1 ? 12 : 14);
      const end = apply(d.printing, w.word);
      for (const s of d.printing.filter((s) => !center(s)))
        assert.deepEqual(
          end.find((t) => t.id === s.id),
          s,
        );
      const front = end.find(
        (s) => s.p.join() === "0,0,1" && s.n.join() === "0,0,1",
      );
      assert.deepEqual(front.up, w.frontCenterFinalUp);
      assert(sameState(apply(end, inverse(w.word)), d.printing));
    }
  }
});
test("actual captured41HTM source has a checked32HTM repair substitution and a no-worse planned route", async () => {
  const f = JSON.parse(
      fs.readFileSync("tests/fixtures/calendar-worst-repair-context.json"),
    ),
    d = load(f.id);
  assert.equal(
    createHash("sha256")
      .update(fs.readFileSync(`public/calendar/${f.id}.json`))
      .digest("hex"),
    f.printingSHA256,
  );
  assert.equal(
    createHash("sha256").update(f.sourceWord).digest("hex"),
    f.sourceReferenceSHA256,
  );
  const from = apply(d.printing, f.sourceWord),
    target = findTarget(d, civilDate(f.toISO)),
    oldEnd = apply(from, f.oldWord);
  assert(matches(from, findTarget(d, civilDate(f.fromISO)).cells));
  assert(matches(oldEnd, target.cells));
  const constructed = simplify(
    tokens(f.oldWord).slice(0, -f.oldRepairHTM).join(" ") +
      " " +
      f.shortHalfRepair,
  );
  assert.equal(
    tokens(constructed).filter((t) => /^[ULFRBD]/.test(t)).length,
    32,
  );
  assert(sameState(apply(from, constructed), oldEnd));
  const ctx = {
    design: d,
    from,
    target,
    sourceWord: f.sourceWord,
    fallbackWord: simplify(inverse(f.sourceWord) + " " + target.word),
  };
  const planner = await createPlanner({ design: d }),
    word = await planner(ctx),
    end = apply(from, word);
  assert(tokens(word).filter((t) => /^[ULFRBD]/.test(t)).length <= 32);
  assert(matches(end, target.cells));
  const refs = referencesForPlan(ctx, word);
  assert(sameState(apply(d.printing, refs.fromReferenceWord), from));
  assert(sameState(apply(d.printing, refs.endReferenceWord), end));
});
