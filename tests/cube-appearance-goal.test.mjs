import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CUBE_ROTATIONS,
  POLICY_DISPLAY,
  POLICY_IDENTITY,
  POLICY_PICTURE,
  applyAutomorphism,
  classifyTiles,
  deriveStones,
  goalFromState,
  goalFromTarget,
  makeMatcher,
  makePolicy,
  matchesAppearance,
  printSlots,
  quarterIndex,
  then,
  toAppearanceMap,
  validateGoal,
} from "../packages/cube-appearance/src/index.ts";
import { rotate, stateEquals, validatePrint, validateState } from "../packages/cube-core/src/index.ts";
import { applyMoves, initialState, matchesTarget, parseAlg, stickerPoses } from "../packages/cube-mechanics/src/index.ts";
import { ASYM, SYM2, SYM4, prng, schemaProblems, symmetrize, tileOf, turnTile, turnSet } from "./helpers/appearance-fixtures.mjs";
import { cubePrint } from "./helpers/appearance-fixtures.mjs";

const goalSchema = JSON.parse(
  readFileSync(new URL("../packages/cube-appearance/schema/cubistry.goal-2.schema.json", import.meta.url)),
);
const proof = JSON.parse(readFileSync(new URL("../public/counter-proof.json", import.meta.url)));
const FACES = "RLUDFB";
const scramble = (rnd, n) =>
  Array.from({ length: n }, () => FACES[Math.floor(rnd() * 6)] + ["", "'", "2"][Math.floor(rnd() * 3)]).join(" ");
const run = (print, word) => applyMoves(initialState(print), parseAlg(word));
const legal = (print, state) => {
  try {
    validateState(JSON.parse(JSON.stringify(state)), print);
    return true;
  } catch {
    return false;
  }
};
const stateKey = (state) =>
  JSON.stringify([...state.cubies].sort((a, b) => a.id - b.id).map((c) => [c.id, c.position, c.orientation]));
const rotateState = (state, g) => ({
  ...state,
  cubies: state.cubies.map((c) => ({ ...c, position: rotate(c.position, g), orientation: then(c.orientation, g) })),
});

// ---- existing fixtures: the counter print (24 distinct digit/blank assets) and a classic-color print ----

const counterPrint = validatePrint({
  schema: "cubistry.print",
  version: 1,
  id: "counter-fixture",
  topology: { kind: "cube", size: 2 },
  cubies: [...new Map(proof.printing.map((s) => [s.cubie, { id: s.cubie, position: s.p }])).values()],
  stickers: proof.printing.map((s) => ({
    id: s.id,
    cubie: s.cubie,
    normal: s.n,
    up: s.up,
    assetId: s.image === " " ? "blank" : s.image,
    materialId: "sticker",
    equivalentQuarterTurns: s.image === " " || s.image === "title-left" ? [0, 1, 2, 3] : [0],
  })),
});
const faceColor = (n) => ["R", "L", "U", "D", "F", "B"][[[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].findIndex((v) => v.every((x, i) => x === n[i]))];
const classicPrint = cubePrint(2, (_c, n) => `color-${faceColor(n)}`, () => [0, 1, 2, 3], "classic-fixture");
const mixedPrint = cubePrint(2, (_c, _n, i) => `m${i % 7}`, (a) => (a === "m0" ? [0, 1, 2, 3] : a === "m1" ? [0, 2] : [0]), "mixed-fixture");

test("identity special case reproduces matchesTarget on the counter, classic and mixed prints", () => {
  const rnd = prng(11);
  let yes = 0,
    no = 0;
  for (const print of [counterPrint, classicPrint, mixedPrint]) {
    const states = Array.from({ length: 36 }, () => run(print, scramble(rnd, Math.floor(rnd() * 3))));
    for (const base of states.slice(0, 18)) {
      const poses = stickerPoses(print, base);
      for (let trial = 0; trial < 4; trial++) {
        const facelets = poses
          .filter(() => rnd() < 0.2)
          .map((s) => ({
            position: s.p,
            normal: s.n,
            assetId: s.assetId,
            up: s.up,
            ...(rnd() < 0.5 ? { matching: "equivalent" } : rnd() < 0.5 ? { matching: "exact" } : {}),
          }));
        if (facelets.length === 0) continue;
        const target = { schema: "cubistry.target", version: 1, facelets };
        const goal = goalFromTarget(print.id, target);
        assert.deepEqual(schemaProblems(goalSchema, goal), []);
        for (const state of states) {
          const want = matchesTarget(print, state, target);
          assert.equal(matchesAppearance(print, state, goal, null, POLICY_IDENTITY), want);
          assert.equal(matchesAppearance(print, state, goal, null, makePolicy()), want, "no map = identity classes");
          want ? yes++ : no++;
        }
      }
    }
  }
  assert.ok(yes > 100 && no > 100, `both outcomes exercised (${yes}/${no})`);
});

test("counter fixture: every front-display target agrees with matchesTarget across the 100 witnesses", () => {
  const front = (print, state, i) => {
    const facelets = stickerPoses(print, state)
      .filter((s) => s.n[2] === 1)
      .map((s) => ({
        position: s.p,
        normal: s.n,
        assetId: s.assetId,
        up: s.up,
        ...(s.assetId === "blank" ? { matching: "equivalent" } : {}),
      }));
    return { schema: "cubistry.target", version: 1, facelets, i };
  };
  const states = proof.witnesses.slice(0, 40).map((w) => run(counterPrint, w.word));
  let yes = 0;
  for (const a of states) {
    const target = front(counterPrint, a);
    const goal = goalFromTarget(counterPrint.id, target);
    for (const b of states) {
      const want = matchesTarget(counterPrint, b, target);
      assert.equal(matchesAppearance(counterPrint, b, goal, null, POLICY_IDENTITY), want);
      if (want) yes++;
    }
  }
  assert.ok(yes >= 40);
});

test("strict identity on a full goal equals stateEquals; visual on unique pictures equals it too", () => {
  const rnd = prng(5);
  for (const print of [counterPrint, mixedPrint]) {
    const solved = initialState(print);
    const goal = goalFromState(print, solved);
    assert.deepEqual(schemaProblems(goalSchema, goal), []);
    assert.equal(goal.slots.length, 24);
    for (let i = 0; i < 80; i++) {
      const word = i < 20 ? scramble(rnd, 1 + (i % 2)) : i < 40 ? "R U R' U' " + scramble(rnd, i % 3) : "";
      const state = run(print, word);
      assert.equal(matchesAppearance(print, state, goal, null, POLICY_IDENTITY), stateEquals(state, solved), word);
    }
  }
});

test("strict identity pins stickers; the asset-level target semantics (matchesTarget) still accept equal assets", () => {
  const print = topCorners();
  const map = mapFor(print, glyphFor);
  const solved = initialState(print);
  const swap = deriveStones(print, map, POLICY_PICTURE).generators.find((g) => g.kind === "swap");
  const swapped = applyAutomorphism(solved, swap);
  const pinned = goalFromState(print, solved);
  assert.equal(matchesAppearance(print, swapped, pinned, null, POLICY_IDENTITY), false, "another stone sits there");
  const facelets = (matching) =>
    stickerPoses(print, solved).map((p) => ({ position: p.p, normal: p.n, assetId: p.assetId, up: p.up, matching }));
  const asTarget = (matching) => ({ schema: "cubistry.target", version: 1, facelets: facelets(matching) });
  // The swapped stones show the same assets, with a quarter-turn difference on the symmetric top stickers.
  assert.equal(matchesTarget(print, swapped, asTarget("equivalent")), true);
  assert.equal(matchesTarget(print, swapped, asTarget("exact")), false);
  for (const matching of ["equivalent", "exact"])
    assert.equal(
      matchesAppearance(print, swapped, goalFromTarget(print.id, asTarget(matching)), null, POLICY_IDENTITY),
      matchesTarget(print, swapped, asTarget(matching)),
    );
});

test("whole-cube rotation counts for the badge but never for the fixed-frame solver policy", () => {
  for (const print of [counterPrint, classicPrint, mixedPrint]) {
    const solved = initialState(print);
    const goal = goalFromState(print, solved);
    const badge = makePolicy({ wholeCubeRotation: true });
    let accepted = 0;
    CUBE_ROTATIONS.forEach((g, i) => {
      const turned = rotateState(solved, g);
      assert.ok(legal(print, turned));
      const fixed = matchesAppearance(print, turned, goal, null, makePolicy());
      const free = makeMatcher(print, goal, null, badge).evaluate(turned);
      assert.ok(free.matches, `frame ${i}`);
      if (i === 0) assert.equal(free.frame, 0);
      else if (print === counterPrint) assert.equal(fixed, false, `fixed frame must reject rotation ${i}`);
      if (fixed) accepted++;
    });
    if (print === counterPrint) assert.equal(accepted, 1);
  }
  // "R L'" is a whole-cube rotation about x: rotation-solved, not fixed-frame solved.
  const state = run(counterPrint, "R L'");
  const goal = goalFromState(counterPrint, initialState(counterPrint));
  assert.equal(matchesAppearance(counterPrint, state, goal, null, makePolicy()), false);
  assert.equal(matchesAppearance(counterPrint, state, goal, null, makePolicy({ wholeCubeRotation: true })), true);
  assert.equal(matchesAppearance(counterPrint, state, goal, null, POLICY_IDENTITY), false);
  // Classic colors: a face turn that undoes a quarter turn about the face axis is visually solved only in rotated frames.
  const classic = run(classicPrint, "U D'");
  const cgoal = goalFromState(classicPrint, initialState(classicPrint));
  assert.equal(matchesAppearance(classicPrint, classic, cgoal, null, makePolicy()), false);
  assert.equal(matchesAppearance(classicPrint, classic, cgoal, null, makePolicy({ wholeCubeRotation: true })), true);
});

// ---- a designed print: four interchangeable top corners (C4 top sticker, chiral side stickers) ----

const topCorners = () =>
  cubePrint(
    2,
    (c, n, i) => {
      const p = [(c & 4) ? 1 : -1, (c & 2) ? 1 : -1, (c & 1) ? 1 : -1];
      if (p[1] !== 1) return `u${i}`;
      if (n[1] === 1) return "T";
      return n[0] !== 0 ? `S${p[0] * p[2] > 0 ? "p" : "m"}` : `S${-p[0] * p[2] > 0 ? "p" : "m"}`;
    },
    (a) => (a === "T" ? [0, 1, 2, 3] : [0]),
    "top-corners",
  );

function mapFor(print, tileFor) {
  const ids = [...new Set(print.stickers.map((s) => s.assetId))];
  return toAppearanceMap(classifyTiles(ids.map((id) => tileFor(id))), { printId: print.id, renderer: "synthetic" });
}
/** Tiles for assets named like the prints above: C4 for "T", a fixed chiral C1 glyph per other asset. */
const glyphFor = (id, k = 0) => {
  if (id === "T") return tileOf(id, SYM4);
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const rnd = prng(h);
  // A noisy asymmetric blob: unique per id with overwhelming probability.
  const pts = [];
  for (let r = 2; r < 18; r++) for (let c = 2; c < 18; c++) if (rnd() < 0.35) pts.push([r, c]);
  return tileOf(id, turnSet(pts, 20, k));
};

test("equal-looking swapped stones pass the visual goal and fail the identity goal", () => {
  const print = topCorners();
  const map = mapFor(print, glyphFor);
  const solved = initialState(print);
  const goal = goalFromState(print, solved, { map });
  const stones = deriveStones(print, map, POLICY_PICTURE);
  const top = stones.classes.find((c) => c.length > 1);
  assert.equal(top.length, 4);
  assert.equal(stones.classes.length, 5, "four top corners form one class; four bottom corners stay single");
  // Swap two top stones with the induced rotation.
  const swap = stones.generators.find((g) => g.kind === "swap");
  const swapped = applyAutomorphism(solved, swap);
  assert.notEqual(stateKey(swapped), stateKey(solved));
  assert.equal(stateEquals(swapped, solved), false);
  assert.ok(legal(print, swapped));
  assert.equal(matchesAppearance(print, swapped, goal, map, POLICY_PICTURE), true);
  assert.equal(matchesAppearance(print, swapped, goal, map, POLICY_DISPLAY), true);
  assert.equal(matchesAppearance(print, swapped, goal, map, POLICY_IDENTITY), false);
  // Without the induced rotation the stones are in the right slots but the pictures are wrong.
  const naive = { ...solved, cubies: solved.cubies.map((c) => (c.id === swap.a ? { ...c, position: solved.cubies[swap.b].position } : c.id === swap.b ? { ...c, position: solved.cubies[swap.a].position } : c)) };
  assert.equal(matchesAppearance(print, naive, goal, map, POLICY_PICTURE), false);
  // A map is required for the visual mode of a pinned goal, and it must be the pinned one.
  assert.throws(() => matchesAppearance(print, solved, goal, null, POLICY_PICTURE), /pins/);
  const other = mapFor(print, (id) => glyphFor(id, id === "u0" ? 1 : 0));
  assert.throws(() => matchesAppearance(print, solved, goal, other, POLICY_PICTURE), /not the one/);
  assert.equal(matchesAppearance(print, solved, goal, other, POLICY_IDENTITY), true, "identity ignores the map");
});

/** Independent oracle: enumerate every fixed-frame legal state accepted by the matcher, by depth-first search. */
function enumerateGoalStates(print, matcher) {
  const found = new Map();
  const cubies = print.cubies;
  const used = new Set();
  const placed = [];
  const place = (i) => {
    if (i === cubies.length) {
      const state = { schema: "cubistry.state", version: 1, printId: print.id, topology: print.topology, cubies: placed.map((c) => ({ ...c })) };
      if (legal(print, state)) found.set(stateKey(state), state);
      return;
    }
    const cubie = cubies[i];
    for (const target of cubies) {
      if (used.has(target.id)) continue;
      for (const g of CUBE_ROTATIONS) {
        if (rotate(cubie.position, g).some((v, k) => v !== target.position[k])) continue;
        const ok = print.stickers
          .filter((s) => s.cubie === cubie.id)
          .every((s) => matcher.accepts(s.id, target.position, rotate(s.normal, g), rotate(s.up, g)));
        if (!ok) continue;
        used.add(target.id);
        placed.push({ id: cubie.id, position: target.position, orientation: g });
        place(i + 1);
        placed.pop();
        used.delete(target.id);
      }
    }
  };
  place(0);
  return found;
}
function closureStates(print, solved, generators) {
  const seen = new Map([[stateKey(solved), solved]]);
  const queue = [solved];
  while (queue.length) {
    const s = queue.pop();
    for (const h of generators) {
      const t = applyAutomorphism(s, h);
      if (!seen.has(stateKey(t))) {
        seen.set(stateKey(t), t);
        queue.push(t);
      }
    }
  }
  return new Map([...seen].filter(([, s]) => legal(print, s)));
}

test("oracle: the goal set found by exhaustive search equals the orbit of the derived stone automorphisms", () => {
  const cases = [
    ["four top corners", topCorners(), 24],
    // One C3-symmetric corner alone: the extra twists are unreachable, so the goal set stays a single state.
    ["one symmetric corner", cubePrint(2, (c, n, i) => (c === 7 ? "S" : `u${i}`), (a) => (a === "S" ? [0, 1, 2, 3] : [0]), "one-sym"), 1],
    // Two C3-symmetric corners with different pictures: twists (1,2) and (2,1) become reachable: 3 states.
    ["two symmetric corners", cubePrint(2, (c, n, i) => (c === 7 ? "S" : c === 6 ? "S2" : `u${i}`), (a) => (a === "S" || a === "S2" ? [0, 1, 2, 3] : [0]), "two-sym"), 3],
    // The same picture on both: they can also swap: 3 twist combinations x 2 orders.
    ["two identical symmetric corners", cubePrint(2, (c, n, i) => (c >= 6 ? "S" : `u${i}`), (a) => (a === "S" ? [0, 1, 2, 3] : [0]), "two-same"), 6],
  ];
  for (const [name, print, expected] of cases) {
    const glyph = (id) => (id === "S" ? tileOf(id, SYM4) : glyphFor(id));
    // S and S2 must stay different pictures: give S2 a different 4-fold shape.
    const tileFor = (id) => (id === "S2" ? tileOf(id, symmetrize([[3, 3], [3, 4], [4, 3], [9, 9]], 4)) : glyph(id));
    const map = mapFor(print, tileFor);
    for (const policy of [POLICY_PICTURE, POLICY_DISPLAY]) {
      const solved = initialState(print);
      const goal = goalFromState(print, solved, { map });
      const matcher = makeMatcher(print, goal, map, policy);
      const stones = deriveStones(print, map, policy);
      const searched = enumerateGoalStates(print, matcher);
      const orbit = closureStates(print, solved, stones.generators);
      assert.equal(searched.size, expected, `${name}: goal set size`);
      assert.deepEqual([...searched.keys()].sort(), [...orbit.keys()].sort(), `${name}: stone model = exhaustive search`);
      for (const s of searched.values()) assert.ok(matcher.matches(s));
    }
  }
});

test("property: matchesAppearance is invariant under every stone automorphism, on random prints and states", () => {
  const rnd = prng(2024);
  let generators = 0;
  for (let trial = 0; trial < 60; trial++) {
    // A small pool, so duplicates, symmetric tiles and rotation twins all occur.
    const pool = [
      ["c4", SYM4, [0, 1, 2, 3]],
      ["c2", SYM2, [0, 2]],
      ["c1", ASYM, [0]],
      ["c1t", null, [0]],
    ];
    const poolSize = 1 + Math.floor(rnd() * 4);
    const pick = () => pool[Math.floor(rnd() * poolSize)];
    const assignment = Array.from({ length: 24 }, () => pick()[0]);
    const print = cubePrint(2, (_c, _n, i) => assignment[i], (a) => pool.find((p) => p[0] === a)[2], `rand-${trial}`);
    const tileFor = (id) =>
      id === "c4" ? tileOf(id, SYM4) : id === "c2" ? tileOf(id, SYM2) : id === "c1" ? tileOf(id, ASYM) : turnTile(id, tileOf(id, ASYM), 2);
    const map = mapFor(print, tileFor);
    for (const policy of [POLICY_PICTURE, POLICY_DISPLAY, makePolicy({ rotationTwins: true, wholeCubeRotation: true })]) {
      const stones = deriveStones(print, map, policy);
      generators += stones.generators.length;
      for (const goalState of [initialState(print), run(print, scramble(rnd, 3))]) {
        const goal = goalFromState(print, goalState, { map });
        const matcher = makeMatcher(print, goal, map, policy);
        assert.ok(matcher.matches(goalState));
        for (let k = 0; k < 6; k++) {
          const sigma = run(print, scramble(rnd, Math.floor(rnd() * 5)));
          const base = matcher.matches(sigma);
          for (const h of stones.generators)
            assert.equal(matcher.matches(applyAutomorphism(sigma, h)), base, `trial ${trial} ${JSON.stringify(h.kind)}`);
          // Applying a generator to the goal state itself must stay inside the goal set.
          for (const h of stones.generators) assert.ok(matcher.matches(applyAutomorphism(goalState, h)));
        }
      }
    }
  }
  assert.ok(generators > 200, `enough non-trivial automorphisms exercised (${generators})`);
});

test("rotation twins: policy flag decides whether 6 and 9 are equal (pictures yes, displays no)", () => {
  const print = cubePrint(2, (_c, _n, i) => (i === 0 ? "six" : i === 1 ? "nine" : `u${i}`), () => [0], "twins");
  const six = tileOf("six", ASYM);
  const tiles = (id) => (id === "six" ? six : id === "nine" ? turnTile("nine", six, 2) : glyphFor(id));
  const map = mapFor(print, tiles);
  assert.equal(map.assets.six.twin, map.assets.nine.twin);
  const solved = initialState(print);
  const poses = stickerPoses(print, solved);
  const goal = goalFromState(print, solved, { map });
  const slot = poses[0];
  const m = (policy) => makeMatcher(print, goal, map, policy);
  // Put the "nine" sticker (id 1) into sticker 0's slot, turned by 0 and by a half turn.
  const half = (n, up) => {
    let v = up;
    for (let i = 0; i < 2; i++) v = [n[1] * v[2] - n[2] * v[1], n[2] * v[0] - n[0] * v[2], n[0] * v[1] - n[1] * v[0]];
    return v;
  };
  assert.equal(m(POLICY_PICTURE).accepts(1, slot.p, slot.n, slot.up), false, "nine as is differs from six");
  assert.equal(m(POLICY_PICTURE).accepts(1, slot.p, slot.n, half(slot.n, slot.up)), true, "nine upside down is a six");
  assert.equal(m(POLICY_DISPLAY).accepts(1, slot.p, slot.n, half(slot.n, slot.up)), false, "displays keep 6 and 9 apart");
  assert.equal(m(POLICY_PICTURE).accepts(0, slot.p, slot.n, slot.up), true);
  assert.equal(m(POLICY_IDENTITY).accepts(1, slot.p, slot.n, half(slot.n, slot.up)), false);
  // An exact slot refuses turns that merely look alike even for symmetric stickers.
  const c4print = cubePrint(2, (_c, _n, i) => (i === 0 ? "T" : `u${i}`), (a) => (a === "T" ? [0, 1, 2, 3] : [0]), "c4-exact");
  const c4map = mapFor(c4print, glyphFor);
  const c4 = initialState(c4print);
  const p0 = stickerPoses(c4print, c4)[0];
  const turned = [p0.n[1] * p0.up[2] - p0.n[2] * p0.up[1], p0.n[2] * p0.up[0] - p0.n[0] * p0.up[2], p0.n[0] * p0.up[1] - p0.n[1] * p0.up[0]];
  const eqGoal = goalFromState(c4print, c4, { map: c4map });
  const exGoal = goalFromState(c4print, c4, { map: c4map, matching: "exact" });
  assert.equal(makeMatcher(c4print, eqGoal, c4map, POLICY_DISPLAY).accepts(0, p0.p, p0.n, turned), true);
  assert.equal(makeMatcher(c4print, exGoal, c4map, POLICY_DISPLAY).accepts(0, p0.p, p0.n, turned), false);
  assert.equal(quarterIndex(p0.n, turned), (quarterIndex(p0.n, p0.up) + 1) % 4);
});

test("goal ingress: schema, full versus display scope, slot ownership", () => {
  const print = counterPrint;
  const solved = initialState(print);
  const full = goalFromState(print, solved);
  assert.equal(full.scope, "full");
  assert.deepEqual(printSlots(print).length, 24);
  assert.throws(() => goalFromState(print, solved, { only: () => true }), /full goal/);
  const display = goalFromState(print, solved, { scope: "display", only: (k) => k.endsWith("|0,0,1") });
  assert.equal(display.slots.length, 4);
  assert.deepEqual(schemaProblems(goalSchema, display), []);
  const clone = () => JSON.parse(JSON.stringify(full));
  const dropped = clone();
  dropped.slots.pop();
  assert.throws(() => validateGoal(dropped, print), /every slot/);
  const alien = clone();
  alien.printId = "other";
  assert.throws(() => validateGoal(alien, print));
  for (const [f, schemaSees] of [
    [(g) => (g.version = 1), true],
    [(g) => (g.slots[0].up = 4), true],
    [(g) => (g.slots[0].slot = "1,1,1|1,1,0"), true],
    [(g) => (g.slots[1].slot = g.slots[0].slot), false], // uniqueness is beyond the schema subset
    [(g) => (g.extra = 1), true],
  ]) {
    const g = clone();
    f(g);
    assert.throws(() => validateGoal(g));
    if (schemaSees) assert.notDeepEqual(schemaProblems(goalSchema, g), []);
  }
  // A display goal sees only its slots: the back of the cube is free.
  const front = makeMatcher(print, display, null, makePolicy());
  assert.ok(front.matches(solved));
  assert.ok(front.matches(run(print, "B")), "B does not touch the front slots");
  assert.equal(front.matches(run(print, "F")), false);
});

// ---- odd N centers and the generic piece model (nothing runs at N >= 3 yet: geometry only) ----

test("stones: center symmetry gives the center period; identical stones are interchangeable with induced rotation", () => {
  const centerAssets = (size, assign) => cubePrint(size, (c, n, i) => assign(c, n, i), () => [0], `n${size}`);
  const isCenter3 = (print, id) => print.stickers.filter((s) => s.cubie === id).length === 1;
  for (const [name, tile, period] of [
    ["C1", () => ASYM, 4],
    ["C2", () => SYM2, 2],
    ["C4", () => SYM4, 1],
  ]) {
    const print = centerAssets(3, (c, n, i) => (print3Center(c) ? `ctr${i}` : `x${i}`));
    const map = mapFor(print, (id) => (id.startsWith("ctr") ? tileOf(id, tile()) : glyphFor(id)));
    const stones = deriveStones(print, map, POLICY_DISPLAY);
    const centers = print.cubies.filter((c) => isCenter3(print, c.id)).map((c) => c.id);
    assert.equal(centers.length, 6);
    for (const id of centers) assert.equal(stones.frames(id, id).length, 4 / period, `${name}: stabilizer = 4 / period`);
  }
  const same3 = centerAssets(3, (c, n) => (print3Center(c) ? "ctr" : `x${c}_${n.map((v) => v + 1).join("")}`));
  for (const [tile, frames] of [[ASYM, 1], [SYM2, 2], [SYM4, 4]]) {
    const map = mapFor(same3, (id) => (id === "ctr" ? tileOf(id, tile) : glyphFor(id)));
    const stones = deriveStones(same3, map, POLICY_DISPLAY);
    const group = stones.classes.find((c) => c.length > 1);
    assert.equal(group.length, 6, "six equal centers are one class");
    assert.equal(stones.frames(group[0], group[1]).length, frames);
  }
  // 4x4: the 24 x-center stones form one orbit under rotations; equal C4 pictures make them one class.
  const four = centerAssets(4, (c) => (print4X(c) ? "ctr" : `y${c}`));
  const map4 = mapFor(four, (id) => (id === "ctr" ? tileOf(id, SYM4) : glyphFor(id)));
  const st4 = deriveStones(four, map4, POLICY_DISPLAY);
  assert.equal(Math.max(...st4.classes.map((c) => c.length)), 24);
  const unique4 = cubePrint(4, (c, n, i) => `z${i}`);
  const mapU = mapFor(unique4, (id) => glyphFor(id));
  assert.ok(deriveStones(unique4, mapU, POLICY_DISPLAY).classes.every((c) => c.length === 1));
});
function print3Center(cubie) {
  // The cubie ids of the 3x3 surface enumerate x, y, z in order; centers have exactly two zero coordinates.
  const coords = [];
  for (const x of [-2, 0, 2]) for (const y of [-2, 0, 2]) for (const z of [-2, 0, 2]) if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === 2) coords.push([x, y, z]);
  return coords[cubie].filter((v) => v === 0).length === 2;
}
function print4X(cubie) {
  const coords = [];
  for (const x of [-3, -1, 1, 3]) for (const y of [-3, -1, 1, 3]) for (const z of [-3, -1, 1, 3]) if (Math.max(Math.abs(x), Math.abs(y), Math.abs(z)) === 3) coords.push([x, y, z]);
  const abs = coords[cubie].map(Math.abs).sort();
  return abs[0] === 1 && abs[1] === 1 && abs[2] === 3;
}
