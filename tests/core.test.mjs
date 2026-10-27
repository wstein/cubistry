import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  validatePrint,
  validateState,
  deepFreeze,
} from "../packages/cube-core/src/index.ts";
import {
  initialState,
  applyMoves,
  applyMove,
  parseMove,
  parseAlg,
  stickerPoses,
  ROTATIONS,
  rotate,
  eq,
} from "../packages/cube-mechanics/src/index.ts";
import * as Legacy from "../src/cube.mjs";
const proof = JSON.parse(
  readFileSync(new URL("../public/counter-proof.json", import.meta.url)),
);
const source = validatePrint({
  schema: "cubistry.print",
  version: 1,
  id: "test",
  topology: { kind: "cube", size: 2 },
  cubies: [
    ...new Map(
      proof.printing.map((s) => [s.cubie, { id: s.cubie, position: s.p }]),
    ).values(),
  ],
  stickers: proof.printing.map((s) => ({
    id: s.id,
    cubie: s.cubie,
    normal: s.n,
    up: s.up,
    assetId: s.image === " " ? "blank" : s.image,
    materialId: "sticker",
    equivalentQuarterTurns: [0],
  })),
});
test("typed canonical corner states and explicit v1 facelet adapter agree for all 100 witnesses", () => {
  for (const w of proof.witnesses) {
    const state = applyMoves(initialState(source), parseAlg(w.word));
    validateState(state, source);
    const faces = stickerPoses(source, state),
      old = Legacy.apply(proof.printing, w.word);
    for (const s of faces) {
      assert.deepEqual(s.p, old[s.id].p);
      assert.deepEqual(s.n, old[s.id].n);
      assert.deepEqual(s.up, old[s.id].up);
    }
  }
});
test("core state and immutable print survive legal move round trips without mutations", () => {
  const state = initialState(source),
    snapshot = JSON.stringify({ state, source });
  assert.ok(Object.isFrozen(source.stickers[0]));
  assert.ok(Object.isFrozen(state.cubies[0].orientation));
  assert.throws(() => {
    source.stickers[0].assetId = "other";
  });
  for (const face of "RLUDFB") {
    let s = state;
    for (let i = 0; i < 4; i++) s = applyMove(s, parseMove(face));
    assert.deepEqual(s, state);
  }
  assert.equal(JSON.stringify({ state, source }), snapshot);
});
test("unsupported wire versions, sizes, moves, overlapping cubies and a single twist are rejected", () => {
  for (const patch of [
    { schema: "other" },
    { version: 999 },
    { topology: { kind: "cube", size: 5 } },
  ])
    assert.throws(() => validatePrint({ ...source, ...patch }));
  for (const move of ["Rw", "M", "x", "R3", "R2'", ""])
    assert.throws(() => parseMove(move));
  const state = initialState(source);
  const duplicate = structuredClone(state);
  duplicate.cubies[1].position = duplicate.cubies[0].position;
  assert.throws(() => validateState(duplicate, source));
  const twisted = structuredClone(state),
    p = source.cubies[0].position;
  twisted.cubies[0].orientation = ROTATIONS.find(
    (r) => eq(rotate(p, r), p) && !eq(r[0], [1, 0, 0]),
  );
  assert.throws(() => validateState(twisted, source), /twist/);
});
test("sticker references remain numeric and optical symmetries are C4 subgroups", () => {
  const bad = structuredClone(source);
  bad.stickers[0].cubie = String(bad.stickers[0].cubie);
  assert.throws(() => validatePrint(bad), /integer/);
  for (const turns of [
    [0, 1],
    [0, 3],
    [0, 1, 2],
  ]) {
    const p = structuredClone(source);
    p.stickers[0].equivalentQuarterTurns = turns;
    assert.throws(() => validatePrint(p), /symmetry/);
  }
  for (const turns of [[0], [0, 2], [0, 1, 2, 3]]) {
    const p = structuredClone(source);
    p.stickers[0].equivalentQuarterTurns = turns;
    assert.doesNotThrow(() => validatePrint(p));
  }
});
test("cross-language state JSON ordering is irrelevant but changed transitions still fail", async () => {
  const { validatePresentation } = await import("@cubistry/cube-mechanics");
  const from = initialState(source),
    move = parseMove("R"),
    to = applyMove(from, move);
  const reordered = {
    cubies: [...to.cubies]
      .reverse()
      .map((c) => ({
        orientation: c.orientation,
        position: c.position,
        id: c.id,
      })),
    topology: { size: 2, kind: "cube" },
    printId: to.printId,
    version: 1,
    schema: "cubistry.state",
  };
  assert.doesNotThrow(() =>
    validatePresentation({ from, to: reordered, move }, source),
  );
  assert.deepEqual(validateState(reordered, source), to);
  assert.throws(
    () =>
      validatePresentation(
        { from, to: applyMove(from, parseMove("U")), move },
        source,
      ),
    /legal state transition/,
  );
});
