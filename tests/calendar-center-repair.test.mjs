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
import { appendCenterRepair } from "../src/apps/calendar/transition/planner.mjs";
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

test("transition provenance hashes match local sources while retaining historical research", () => {
  const provenance = JSON.parse(
    fs.readFileSync("src/apps/calendar/transition/provenance.json"),
  );
  for (const entry of provenance.files) {
    const actual = createHash("sha256")
      .update(
        fs.readFileSync("src/apps/calendar/transition/" + entry.localPath),
      )
      .digest("hex");
    assert.equal(actual, entry.localSHA256, entry.localPath);
    if (entry.researchSHA256 !== entry.localSHA256)
      assert.notEqual(entry.changes, "Byte-identical");
  }
  const repair = provenance.files.find(
    (e) => e.localPath === "center-corrections.json",
  );
  assert.equal(
    repair.researchSHA256,
    "e7be2e10c58737533d245d17ad7bf7a04aa0fd4d44e723f96fbf38538a4900fa",
  );
  assert.equal(
    repair.verification.researchCommit,
    "9e736592563885322451b99fb118c79889c25855",
  );
  assert.equal(
    repair.verification.sha256,
    "47d6a817c0b69ec69685df8bb92b24a46d871478aeea293cd5814cdda0cc55ff",
  );
});

test("all52 verified repair shifts preserve exact poses on156 arbitrary source states", () => {
  const d = load("de-a");
  let checked = 0;
  for (const repair of corrections.witnesses) {
    for (const family of [repair.word, ...(repair.equivalentWords ?? [])]) {
      const ts = tokens(family);
      for (let offset = 0; offset < ts.length; offset++) {
        const shifted = ts.slice(offset).concat(ts.slice(0, offset)).join(" ");
        for (const prefix of ["", "R U F'", "x z2 R2 D'"]) {
          const from = apply(d.printing, prefix),
            end = apply(from, shifted);
          assert(sameState(end, apply(from, repair.word)));
          assert(sameState(apply(end, inverse(shifted)), from));
          checked++;
        }
      }
    }
  }
  assert.equal(checked, 156);
  assert.throws(() => appendCenterRepair("R", "x F x'"), /outer-only/i);
});
test("quarter repair cyclic joins save at least one HTM for each outer prefix face", () => {
  for (const repair of corrections.witnesses.filter((r) => r.htm === 14))
    for (const face of ["U", "D", "F", "B", "R", "L"])
      for (const suffix of ["", "2", "'"]) {
        const r = appendCenterRepair(face + suffix, repair.word);
        assert(r.repairBoundarySavings >= 1);
        assert(tokens(r.word).length <= 14);
      }
  const half = corrections.witnesses.find((r) => r.htm === 12);
  assert.equal(appendCenterRepair("R", half.word).repairBoundarySavings, 0);
});
test("actual V3 worst35HTM source has exact-endpoint cyclic34HTM route and no-worse selected route", async () => {
  const f = JSON.parse(
      fs.readFileSync("tests/fixtures/calendar-cyclic-worst-context.json"),
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
    ts = tokens(f.oldWord),
    prefix = ts.slice(0, -f.repairHTM).join(" "),
    repair = ts.slice(-f.repairHTM).join(" "),
    r = appendCenterRepair(prefix, repair),
    end = apply(from, r.word);
  assert.equal(tokens(r.word).filter((t) => /^[ULFRBD]/.test(t)).length, 34);
  assert.equal(r.repairOffset, 6);
  assert.equal(r.repairBoundarySavings, 1);
  assert(sameState(end, apply(from, f.oldWord)));
  assert(matches(end, target.cells));
  const ctx = {
      design: d,
      from,
      target,
      sourceWord: f.sourceWord,
      fallbackWord: simplify(inverse(f.sourceWord) + " " + target.word),
    },
    planner = await createPlanner({ design: d }),
    word = await planner(ctx),
    refs = referencesForPlan(ctx, word);
  assert(tokens(word).filter((t) => /^[ULFRBD]/.test(t)).length <= 34);
  assert(matches(apply(from, word), target.cells));
  assert(
    sameState(apply(d.printing, refs.endReferenceWord), apply(from, word)),
  );
});

test("verified inverse-half family improves historical41HTM source to31 with identical full endpoint", () => {
  const f = JSON.parse(
      fs.readFileSync("tests/fixtures/calendar-worst-repair-context.json"),
    ),
    d = load(f.id),
    from = apply(d.printing, f.sourceWord),
    half = corrections.witnesses.find((r) => r.htm === 12),
    prefix = tokens(f.oldWord).slice(0, -f.oldRepairHTM).join(" "),
    r = appendCenterRepair(prefix, half.word, half.equivalentWords);
  assert.equal(tokens(r.word).filter((t) => /^[ULFRBD]/.test(t)).length, 31);
  assert.equal(r.repairVariant, 1);
  assert.equal(r.repairOffset, 5);
  assert.equal(r.repairBoundarySavings, 2);
  assert(sameState(apply(from, r.word), apply(from, f.oldWord)));
});
