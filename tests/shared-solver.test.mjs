import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  initialState,
  applyMoves,
  parseAlg,
} from "@cubistry/cube-mechanics";
import { stateEquals } from "@cubistry/cube-core";
import { createCounterSolver } from "../src/adapters/puzlwerk-2x2.ts";
import { TABLE_URL } from "@puzlwerk/solver-2x2";
import { prepareTestSolver } from "./helpers/shared-solver.mjs";
const raw = readFileSync(
  new URL("../public/counter-design.v2.json", import.meta.url),
);
const design = JSON.parse(raw),
  pin = JSON.parse(
    readFileSync(new URL("../puzlwerk-source.json", import.meta.url)),
  );
const word = (moves) =>
  moves
    .map((m) => m.face + (m.turns === 2 ? "2" : m.turns === -1 ? "'" : ""))
    .join(" ");
test("shared exactPhysical solves 42→43 in 10 HTM and closes full physical chains independently", async () => {
  const cases = [];
  for (const padded of [true, false]) {
    const print = design.prints[padded ? "padded" : "unpadded"],
      solver = await prepareTestSolver(print);
    const target = (value) =>
      applyMoves(
        initialState(print),
        parseAlg(design.witnesses[value].word),
      );
    let current = target(42),
      value = 42;
    const start = current;
    for (const next of [43, 7, 42]) {
      const moves = solver.solve(current, target(next));
      if (value === 42 && next === 43) {
        assert.equal(moves.length, 10);
        assert.equal(word(moves), "U R' U' F2 R2 U R F' U F'");
      }
      current = applyMoves(current, moves);
      assert.ok(stateEquals(current, target(next)));
      cases.push({
        padded,
        from: value,
        to: next,
        word: word(moves),
        cubies: current.cubies,
        chain: String(padded),
      });
      value = next;
    }
    assert.ok(stateEquals(current, start));
    assert.equal(solver.solve(current, current).length, 0);
  }
  const evidence = {
    designSHA256: createHash("sha256").update(raw).digest("hex"),
    providerCommit: pin.commit,
    cases,
  };
  const check = JSON.parse(
    execFileSync("python3", ["tests/shared_solver_replay.py"], {
      input: JSON.stringify(evidence),
      encoding: "utf8",
    }),
  );
  assert.equal(check.status, "PASS");
  assert.equal(check.cases, 6);
  const damaged = structuredClone(evidence);
  damaged.cases[0].cubies[0].orientation[0] = [0, 0, 0];
  assert.throws(() =>
    execFileSync("python3", ["tests/shared_solver_replay.py"], {
      input: JSON.stringify(damaged),
      stdio: ["pipe", "pipe", "pipe"],
    }),
  );
});

test("shared table corruption is rejected without a witness fallback", async () => {
  const bytes = Uint8Array.from(readFileSync(TABLE_URL));
  bytes[100] ^= 1;
  await assert.rejects(
    createCounterSolver(design.prints.padded, async () => bytes),
    /SHA-256/,
  );
});
