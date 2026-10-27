import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createCubing2x2Adapter } from "../src/adapters/cubing-2x2.ts";
import {
  acceptanceFixture,
  GOAL_VALUES,
  START_WORD,
} from "../src/dev/acceptance-fixture.ts";
import { stateEquals } from "@cubistry/cube-core";
import {
  applyMoves,
  parseAlg,
  inverseMoves,
  matchesTarget,
} from "@cubistry/cube-mechanics";
import { targetFor } from "../src/apps/counter/design.ts";
import { createHash } from "node:crypto";
test("existing cubing solver computes fresh start-to-goal paths and independent Python verifies them", async () => {
  const raw = readFileSync(
      new URL("../public/counter-design.v2.json", import.meta.url),
    ),
    fixture = acceptanceFixture(JSON.parse(raw)),
    adapter = await createCubing2x2Adapter(),
    cases = [];
  for (const value of GOAL_VALUES) {
    const result = await adapter.solveBetween(
        fixture.print,
        fixture.start,
        fixture.goal(value),
      ),
      moves = parseAlg(result.word),
      state = applyMoves(fixture.start, moves);
    assert.equal(result.solverInvocations, 2);
    assert.equal(result.backend.optimality, "unknown");
    assert.ok(stateEquals(state, fixture.goal(value)));
    assert.ok(matchesTarget(fixture.print, state, targetFor(value, true)));
    assert.ok(
      stateEquals(applyMoves(state, inverseMoves(moves)), fixture.start),
    );
    cases.push({ value, ...result });
  }
  const directory = mkdtempSync(join(tmpdir(), "cubistry-live-"));
  try {
    const path = join(directory, "fresh.json");
    writeFileSync(
      path,
      JSON.stringify({
        schema: "cubistry.live-solver-evidence",
        version: 1,
        puzzle: "2x2x2",
        startWord: START_WORD,
        designSHA256: createHash("sha256").update(raw).digest("hex"),
        cases,
      }),
    );
    const independent = JSON.parse(
      execFileSync(
        "python3",
        ["research/m1-acceptance/verify_live_solver.py", path],
        { encoding: "utf8" },
      ),
    );
    assert.equal(independent.status, "PASS");
    assert.equal(independent.fullPhysicalTargets, 5);
    assert.equal(independent.exactInverseRestorations, 5);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
