import test from "node:test";
import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import {
  EXACT_THRESHOLDS,
  LOOSE_THRESHOLDS,
  STRICT_THRESHOLDS,
  analyzeCenters,
  appearanceSha256,
  canonicalJson,
  centerTileIds,
  classifyTiles,
  sha256Bytes,
  toAppearanceMap,
  validateAppearanceMap,
} from "../packages/cube-appearance/src/index.ts";
import { ASYM, SIDE, SYM1, SYM2, SYM4, flip, prng, schemaProblems, spare, tileOf, turnTile } from "./helpers/appearance-fixtures.mjs";

const mapSchema = JSON.parse(
  readFileSync(new URL("../packages/cube-appearance/schema/cubistry.appearance-2.schema.json", import.meta.url)),
);
const group = (level, id) => level.identical.find((g) => g.members.includes(id));
const twin = (level, id) => level.twins.find((g) => g.members.some((m) => m.id === id));

test("sha256 matches node:crypto for every padding boundary and canonical JSON is order independent", () => {
  for (const n of [...Array.from({ length: 140 }, (_, i) => i), 1000, 4096]) {
    const bytes = randomBytes(n);
    assert.equal(sha256Bytes(bytes), createHash("sha256").update(bytes).digest("hex"), `length ${n}`);
  }
  assert.equal(canonicalJson({ b: [1, { z: 1, a: undefined, y: 2 }], a: "x" }), '{"a":"x","b":[1,{"y":2,"z":1}]}');
  assert.throws(() => canonicalJson({ a: NaN }));
});

test("per-sticker symmetry is none, 2-fold or 4-fold (order 1, 2, 4; period 4, 2, 1)", () => {
  const c = classifyTiles([tileOf("a", SYM1), tileOf("b", SYM2), tileOf("c", SYM4)]);
  const order = Object.fromEntries(c.tiles.map((t) => [t.id, t.order.strict]));
  assert.deepEqual(order, { a: 1, b: 2, c: 4 });
  const centers = analyzeCenters(c, ["a", "b", "c"]);
  assert.deepEqual(
    centers.map((x) => [x.period, x.orientationNeeded, x.orientationExact]),
    [
      [4, true, true],
      [2, true, false],
      [1, false, false],
    ],
  );
  assert.deepEqual(centerTileIds(3), ["U_1_1", "R_1_1", "F_1_1", "D_1_1", "L_1_1", "B_1_1"]);
  assert.throws(() => centerTileIds(4));
});

test("symmetry flips between strict and loose near the threshold, and the 3 diffs are recorded", () => {
  // One stray pixel in a 4-fold tile changes two positions under a quarter turn: 2/400 = 0.005, still strict-4.
  const one = classifyTiles([flip(tileOf("t", SYM4), spare(1))]);
  assert.equal(one.tiles[0].order.strict, 4);
  assert.ok(Math.abs(one.tiles[0].rotDiff.strict[0] - 0.005) < 1e-12);
  // Two stray pixels: 4/400 = 0.01 > strict 0.005 but within loose 0.03.
  const two = classifyTiles([flip(tileOf("t", SYM4), spare(2))]);
  assert.equal(two.tiles[0].order.strict, 1);
  assert.equal(two.tiles[0].order.loose, 4);
});

test("identical groups: exact hash groups, near-threshold merge, strict versus loose", () => {
  const base = tileOf("a", ASYM);
  const set = [base, { ...tileOf("b", ASYM) }, flip(tileOf("c", ASYM), spare(2)), flip(tileOf("d", ASYM), spare(3, 10))];
  const c = classifyTiles(set);
  assert.deepEqual(c.exactGroups, [["a", "b"]]);
  // 2 px = 0.005 <= strict; d is 3 px from a (0.0075) and 5 px from c. Complete linkage keeps d out of {a,b,c}.
  assert.deepEqual(group(c.strict, "a").members, ["a", "b", "c"]);
  assert.deepEqual(group(c.strict, "d").members, ["d"]);
  // Loose (0.03 = 12 px) accepts all four.
  assert.deepEqual(group(c.loose, "d").members, ["a", "b", "c", "d"]);
  // Vector themes: exact equality only.
  const v = classifyTiles(set, { strict: EXACT_THRESHOLDS });
  assert.deepEqual(group(v.strict, "a").members, ["a", "b"]);
  assert.deepEqual(group(v.strict, "c").members, ["c"]);
  assert.deepEqual(STRICT_THRESHOLDS, { pixelTolerance: 16, share: 0.005 });
  assert.deepEqual(LOOSE_THRESHOLDS, { pixelTolerance: 24, share: 0.03 });
});

test("rotation twins carry the quarter-turn offset", () => {
  for (const [name, shape, offsets] of [
    ["none", SYM1, [0, 1, 2, 3]],
    ["2-fold", SYM2, [0, 1]],
  ]) {
    for (const k of offsets) {
      const a = tileOf("a", shape);
      const b = turnTile("b", a, k);
      const c = classifyTiles([a, b]);
      const t = twin(c.strict, "a");
      const expectIdentical = k % (name === "none" ? 4 : 2) === 0;
      assert.equal(c.strict.identical.length, expectIdentical ? 1 : 2, `${name} ${k}`);
      assert.deepEqual(t.members.map((m) => m.id), ["a", "b"], `${name} ${k}`);
      assert.equal(t.members[0].turn, 0);
      assert.equal(t.members[1].turn, k % (4 / t.order), `${name} k=${k}`);
      assert.equal(t.order, name === "none" ? 1 : 2);
    }
  }
  // The 6/9 case: a glyph and its half turn are twins with offset 2 and different identical classes.
  const six = tileOf("six", ASYM);
  const c = classifyTiles([six, turnTile("nine", six, 2)]);
  assert.notEqual(group(c.strict, "six").id, group(c.strict, "nine").id);
  // The representative is the smallest id ("nine"); six is nine turned by 2.
  assert.deepEqual(twin(c.strict, "nine").members, [
    { id: "nine", turn: 0 },
    { id: "six", turn: 2 },
  ]);
});

test("twin offset near the threshold: two stray pixels still twin, three do not", () => {
  const a = tileOf("a", ASYM);
  const near = classifyTiles([a, flip(turnTile("b", a, 1), spare(2))]);
  assert.equal(twin(near.strict, "a").members.length, 2);
  assert.equal(twin(near.strict, "a").members[1].turn, 1);
  const far = classifyTiles([a, flip(turnTile("b", a, 1), spare(3))]);
  assert.equal(twin(far.strict, "a").members.length, 1);
  assert.equal(twin(far.loose, "a").members.length, 2);
});

test("complete linkage never merges transitively", () => {
  const a = tileOf("a", ASYM),
    b = flip(tileOf("b", ASYM), spare(2)),
    c = flip(b, spare(2, 2));
  const cc = { ...c, id: "c" };
  const r = classifyTiles([a, b, cc]);
  // a~b (2 px), b~c (2 px), a vs c = 4 px = 0.01 > 0.005: single linkage would merge all three.
  for (const g of r.strict.identical) assert.ok(!(g.members.includes("a") && g.members.includes("c")), "a and c merged");
  assert.equal(r.strict.identical.length, 2);
  // Ties go to the lowest indexes, so the result is deterministic.
  assert.deepEqual(r.strict.identical.map((g) => g.members), [["a", "b"], ["c"]]);
});

function pairShare(a, b, k, tol) {
  // Independent recomputation: turn a by k, then count differing pixels.
  const ta = turnTile("x", a, k);
  let d = 0;
  for (let i = 0; i < a.side * a.side; i++) {
    const o = i * 4;
    if (Math.max(...[0, 1, 2].map((c) => Math.abs(ta.data[o + c] - b.data[o + c]))) > tol) d++;
  }
  return d / (a.side * a.side);
}

test("property: groups are complete-linkage, twins are consistent, output ignores input order", () => {
  const rnd = prng(7);
  const bases = [SYM1, SYM2, SYM4, ASYM.map(([r, c]) => [c, r]), ASYM.slice(0, 9)];
  for (let round = 0; round < 12; round++) {
    const tiles = Array.from({ length: 10 }, (_, i) => {
      let t = tileOf(`t${i}`, bases[Math.floor(rnd() * bases.length)]);
      t = turnTile(t.id, t, Math.floor(rnd() * 4));
      return flip(t, spare(Math.floor(rnd() * 5), Math.floor(rnd() * 3)));
    });
    const byId = new Map(tiles.map((t) => [t.id, t]));
    const c = classifyTiles(tiles);
    const shuffled = [...tiles].sort(() => rnd() - 0.5);
    assert.deepEqual(classifyTiles(shuffled), c, "input order must not matter");
    for (const level of ["strict", "loose"]) {
      const th = c[level].thresholds;
      const lim = th.share + 1e-12;
      for (const g of c[level].identical)
        for (const x of g.members)
          for (const y of g.members)
            assert.ok(pairShare(byId.get(x), byId.get(y), 0, th.pixelTolerance) <= lim, `identical ${x} ${y}`);
      for (const g of c[level].twins)
        for (const x of g.members)
          for (const y of g.members) {
            // y is x turned by (turn_y - turn_x) modulo the period: the best of the equivalent turns must fit.
            const period = 4 / g.order;
            const want = (y.turn - x.turn + 4) % 4;
            const fits = [0, 1, 2, 3].filter((k) => (k - want) % period === 0);
            const best = Math.min(...fits.map((k) => pairShare(byId.get(x.id), byId.get(y.id), k, th.pixelTolerance)));
            assert.ok(best <= lim + 1e-12, `twin ${x.id} ${y.id} at ${level}`);
          }
      // The groups partition the tiles; twin groups are unions of identical groups.
      assert.equal(c[level].identical.flatMap((g) => g.members).length, tiles.length);
      for (const g of c[level].twins)
        assert.deepEqual([...g.members.map((m) => m.id)].sort(), g.identical.flatMap((i) => c[level].identical.find((v) => v.id === i).members).sort());
    }
  }
});

test("appearance map: schema, canonical hash, strict ingress, frozen", () => {
  const six = tileOf("six", ASYM);
  const c = classifyTiles([six, turnTile("nine", six, 2), tileOf("star", SYM4), tileOf("star2", SYM4)]);
  const map = toAppearanceMap(c, { printId: "demo", renderer: "synthetic" });
  assert.deepEqual(schemaProblems(mapSchema, JSON.parse(JSON.stringify(map))), []);
  assert.equal(map.version, 2);
  assert.equal(map.classifier.level, "strict");
  assert.equal(map.assets.six.twin, map.assets.nine.twin);
  assert.notEqual(map.assets.six.identical, map.assets.nine.identical);
  assert.equal(map.assets.star.identical, map.assets.star2.identical);
  assert.equal(map.classes[map.assets.star.twin].order, 4);
  assert.ok(Object.isFrozen(map) && Object.isFrozen(map.assets.six));
  const sha = appearanceSha256(map);
  assert.match(sha, /^[0-9a-f]{64}$/);
  assert.equal(appearanceSha256(validateAppearanceMap(JSON.parse(JSON.stringify(map)))), sha, "JSON round trip");
  assert.equal(appearanceSha256(toAppearanceMap(c, { printId: "demo", renderer: "synthetic" })), sha, "deterministic");
  assert.notEqual(appearanceSha256(toAppearanceMap(c, { printId: "demo", renderer: "synthetic", level: "loose" })), sha);
  // Cross-references and the turn-versus-order bound are beyond JSON Schema: only the validator sees them.
  const bad = (f, schemaSees = true) => {
    const m = JSON.parse(JSON.stringify(map));
    f(m);
    assert.throws(() => validateAppearanceMap(m));
    if (schemaSees) assert.notDeepEqual(schemaProblems(mapSchema, m), []);
  };
  bad((m) => (m.version = 3));
  bad((m) => (m.extra = 1));
  bad((m) => (m.assets.six.turn = 4));
  bad((m) => (m.assets.star.turn = 1), false); // order 4 admits only turn 0
  bad((m) => (m.assets.six.twin = "t99"), false);
  bad((m) => (m.classes[m.assets.six.twin].order = 3));
  bad((m) => (m.classifier.inputSha256 = "abc"));
  bad((m) => delete m.classifier.renderer);
});

test("golden: canonical hash of a fixed tiny map is stable across releases", () => {
  const map = validateAppearanceMap({
    schema: "cubistry.appearance",
    version: 2,
    printId: "golden",
    classifier: {
      module: "@cubistry/cube-appearance",
      version: 1,
      level: "strict",
      thresholds: { pixelTolerance: 16, share: 0.005 },
      sample: 20,
      renderer: "synthetic",
      inputSha256: "0".repeat(64),
    },
    classes: { i0: { order: 1 }, t0: { order: 1 } },
    assets: { a: { identical: "i0", twin: "t0", turn: 0 } },
  });
  assert.equal(
    canonicalJson(map),
    '{"assets":{"a":{"identical":"i0","turn":0,"twin":"t0"}},"classes":{"i0":{"order":1},"t0":{"order":1}},"classifier":{"inputSha256":"0000000000000000000000000000000000000000000000000000000000000000","level":"strict","module":"@cubistry/cube-appearance","renderer":"synthetic","sample":20,"thresholds":{"pixelTolerance":16,"share":0.005},"version":1},"printId":"golden","schema":"cubistry.appearance","version":2}',
  );
  assert.equal(appearanceSha256(map), createHash("sha256").update(canonicalJson(map)).digest("hex"));
});

test("classifier input is validated", () => {
  assert.throws(() => classifyTiles([]));
  assert.throws(() => classifyTiles([tileOf("a", ASYM), tileOf("a", SYM2)]), /Duplicate/);
  assert.throws(() => classifyTiles([tileOf("a", ASYM), tileOf("b", ASYM, 10)]), /same side/);
  assert.throws(() => classifyTiles([{ id: "a", side: 4, data: new Uint8Array(3) }]));
  assert.equal(SIDE, 20);
});
