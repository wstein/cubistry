import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { SAMPLE, COARSE, analyzeStickers, describeSuitability, measureRgba, symmetryOf } from "../src/apps/playground/suitability.ts";
import { LOOSE_THRESHOLDS, classifyTiles, detailOf, tileHash, toRgb } from "../packages/cube-appearance/src/index.ts";

const N = SAMPLE;
// A sticker from a function (x, y) -> [r, g, b].
const tile = (fn) => {
  const d = new Uint8ClampedArray(N * N * 4);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) d.set([...fn(x, y), 255], (y * N + x) * 4);
  return d;
};
const rot = (d, quarter) => {
  const out = new Uint8ClampedArray(d.length);
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      let u = x, v = y;
      for (let q = 0; q < quarter; q++) [u, v] = [N - 1 - v, u];
      out.set(d.subarray((y * N + x) * 4, (y * N + x) * 4 + 4), (v * N + u) * 4);
    }
  return out;
};
const flat = (c = [200, 200, 200]) => tile(() => c);
// Asymmetric picture: a distinct color per quadrant plus a stripe, seeded so tiles differ. The stripe width steps by
// 6 px per seed: with a step of 3 px, seeds 0 and 3 differ in under 3 percent of the 20 px block-average pixels and the
// loose level (rightly) groups them as identical.
const asym = (seed = 0) => tile((x, y) => {
  const base = [[250, 30, 30], [30, 250, 30], [30, 30, 250], [240, 240, 30]][(x < N / 2 ? 0 : 1) + (y < N / 2 ? 0 : 2)];
  return x < 14 + seed * 6 && y < 40 ? [0, 0, 0] : base.map((c, i) => (i === seed % 3 ? 255 - c : c));
});
// 180-degree symmetric: checker of two halves; 90-degree symmetric: four-fold rosette.
const sym2 = tile((x, y) => ((x < N / 2) === (y < N / 2) ? [20, 20, 220] : [230, 230, 20]));
const sym4 = tile((x, y) => (Math.hypot(x - 39.5, y - 39.5) < 20 ? [200, 20, 20] : [240, 240, 240]));

test("measureRgba: detail, rotation differences and hash", () => {
  const f = measureRgba(flat());
  assert.equal(f.detail, 0);
  assert.equal(f.minRot, 0);
  const a = measureRgba(asym());
  assert.ok(a.detail > 0.08 && a.minRot > 0.03);
  assert.equal(measureRgba(asym()).hash, a.hash);
  assert.notEqual(measureRgba(asym(1)).hash, a.hash);
});

test("rotational symmetry classes: none, 2-fold (180) and 4-fold (90)", () => {
  assert.equal(symmetryOf(measureRgba(asym())), 1);
  assert.equal(symmetryOf(measureRgba(sym2)), 2);
  assert.equal(symmetryOf(measureRgba(sym4)), 4);
  assert.equal(symmetryOf(measureRgba(flat())), 4);
});

test("a set of distinct detailed stickers is a green light", () => {
  const r = analyzeStickers(Array.from({ length: 6 }, (_, i) => ({ id: `F_0_${i}`, data: asym(i) })), 2);
  assert.equal(r.light, "green");
  assert.equal(r.problems.length, 0);
  assert.equal(describeSuitability(r), "0 stickers flat, 0 identical groups, 0 rotation-ambiguous");
});

test("flat, identical, symmetric and turned-copy stickers are found, grouped and counted", () => {
  const stickers = [
    { id: "F_0_0", data: asym(0) },
    { id: "F_0_1", data: flat() },
    { id: "F_1_0", data: flat() }, // flat and identical to F_0_1
    { id: "B_0_0", data: sym2 },
    { id: "B_0_1", data: sym4 },
    { id: "R_0_0", data: asym(1) },
    { id: "R_0_1", data: rot(asym(1), 1) }, // a quarter-turned copy of R_0_0
    { id: "L_0_0", data: asym(2) },
    { id: "L_0_1", data: asym(2) }, // exact copy
    { id: "U_0_0", data: rot(asym(0), 2) }, // half-turned copy of F_0_0
  ];
  const r = analyzeStickers(stickers, 3);
  assert.deepEqual(r.flat, ["F_0_1", "F_1_0"]);
  assert.deepEqual(r.identicalGroups.map((g) => [...g].sort()), [["F_0_1", "F_1_0"], ["L_0_0", "L_0_1"]]);
  assert.deepEqual(r.symmetric2, ["B_0_0"]);
  assert.deepEqual(r.symmetric4.filter((id) => !r.flat.includes(id)), ["B_0_1"]);
  const twins = r.twinGroups.map((g) => [...g].sort());
  assert.ok(twins.some((g) => g.join() === "F_0_0,U_0_0"), JSON.stringify(twins));
  assert.ok(twins.some((g) => g.join() === "R_0_0,R_0_1"), JSON.stringify(twins));
  // ambiguous: symmetric or turned-copy stickers that are not just flat
  assert.deepEqual([...r.ambiguous].sort(), ["B_0_0", "B_0_1", "F_0_0", "R_0_0", "R_0_1", "U_0_0"]);
  assert.equal(describeSuitability(r), "2 stickers flat, 2 identical groups, 6 rotation-ambiguous");
  const byId = Object.fromEntries(r.problems.map((p) => [p.id, p.kinds]));
  assert.deepEqual(byId.F_0_1, ["flat", "identical"]);
  assert.ok(byId.B_0_0.includes("symmetric2") && byId.B_0_1.includes("symmetric4"));
  assert.ok(byId.R_0_1.includes("twin"));
  assert.equal(r.total, 10);
  // Ambiguity is information: only the 2 flat stickers (20 percent) count for the light.
  assert.equal(r.light, "yellow");
  assert.deepEqual({ ...r.symmetry }, { none: 6, twoFold: 1, fourFold: 1 });
});

test("traffic light: only flat stickers and flat faces are real problems; ambiguity never turns it red", () => {
  const good = Array.from({ length: 8 }, (_, i) => ({ id: `F_0_${i}`, data: asym(i) }));
  const yellow = analyzeStickers([...good.slice(0, 6), { id: "B_0_0", data: flat() }, { id: "B_0_1", data: asym(7) }], 2);
  assert.equal(yellow.light, "yellow");
  // Identical, symmetric and turned stickers everywhere: all of them ambiguous, none flat: still green.
  const ambiguous = [
    ...Array.from({ length: 4 }, (_, i) => ({ id: `F_0_${i}`, data: asym(1) })), // four identical copies
    { id: "B_0_0", data: sym2 }, { id: "B_0_1", data: sym4 },
    { id: "R_0_0", data: asym(2) }, { id: "R_0_1", data: rot(asym(2), 1) },
  ];
  const calm = analyzeStickers(ambiguous, 2);
  assert.equal(calm.light, "green");
  assert.ok(calm.ambiguous.length / calm.total >= 0.25, "most stickers are ambiguous");
  assert.deepEqual(calm.flat, []);
  // More than a quarter of the stickers flat: red.
  const red = analyzeStickers([...good.slice(0, 5), ...[0, 1, 2].map((i) => ({ id: `B_0_${i}`, data: flat([i * 50, 9, 9]) }))], 2);
  assert.equal(red.light, "red");
  // A whole flat face is red even when it is a small share of the stickers.
  const manyDetailed = Array.from({ length: 30 }, (_, i) => ({ id: `F_${Math.floor(i / 6)}_${i % 6}`, data: asym(i) }));
  const faceFlat = analyzeStickers([...manyDetailed, { id: "U_0_0", data: flat() }, { id: "U_0_1", data: flat([1, 2, 3]) }], 2);
  assert.deepEqual(faceFlat.flatFaces, ["U"]);
  assert.equal(faceFlat.light, "red");
});

test("the check script and the display share one definition", async () => {
  const { readFileSync } = await import("node:fs");
  const script = readFileSync(new URL("../scripts/check-pastel-garden-tiles.mjs", import.meta.url), "utf8");
  assert.match(script, /from "\.\.\/src\/apps\/playground\/suitability\.ts"/);
  assert.ok(!/const MIN_DETAIL =/.test(script));
});

test("the display calls the shared classifier at its loose level (one implementation, D3 and D8)", () => {
  const src = readFileSync(new URL("../src/apps/playground/suitability.ts", import.meta.url), "utf8");
  assert.match(src, /from "@cubistry\/cube-appearance"/);
  assert.ok(!/PIXEL_TOLERANCE|twinDiff|rotCoarse|imul/.test(src), "no pixel comparison of its own");
  // measureRgba is the package's tile report plus its hash and detail.
  const d = asym(2);
  const m = measureRgba(d);
  const tile = { id: "sticker", side: N, data: d };
  const report = classifyTiles([tile]).tiles[0];
  assert.deepEqual([...m.rotations], [...report.rotDiff.loose]);
  assert.equal(m.detail, detailOf(toRgb(tile)));
  assert.equal(m.hash, tileHash(toRgb(tile)));
  // The groups of analyzeStickers are the package's loose groups of the coarse copies.
  const stickers = [
    { id: "F_0_0", data: asym(1) }, { id: "F_0_1", data: asym(1) }, { id: "F_1_0", data: asym(2) }, { id: "F_1_1", data: rot(asym(2), 2) },
    { id: "B_0_0", data: sym2 }, { id: "B_0_1", data: sym4 },
  ];
  const coarse = (d) => {
    const k = N / COARSE, out = new Uint8ClampedArray(COARSE * COARSE * 4);
    for (let y = 0; y < COARSE; y++) for (let x = 0; x < COARSE; x++) for (let c = 0; c < 4; c++) {
      let sum = 0;
      for (let j = 0; j < k; j++) for (let i = 0; i < k; i++) sum += d[((y * k + j) * N + x * k + i) * 4 + c];
      out[(y * COARSE + x) * 4 + c] = sum / (k * k);
    }
    return out;
  };
  const c = classifyTiles(stickers.map((s) => ({ id: s.id, side: COARSE, data: coarse(s.data) })));
  const r = analyzeStickers(stickers, 2);
  assert.deepEqual(r.identicalGroups.map((g) => [...g]), c.loose.identical.filter((g) => g.members.length > 1).map((g) => [...g.members]));
  assert.deepEqual(r.twinGroups.map((g) => [...g]), c.loose.twins.filter((g) => g.identical.length > 1).map((g) => g.members.map((x) => x.id)));
  // Symmetry is measured on the full 80 px sticker with the package's primitives, groups on the coarse copy.
  assert.deepEqual(r.symmetric4, stickers.filter((s) => symmetryOf(measureRgba(s.data)) === 4).map((s) => s.id));
  assert.deepEqual(r.symmetric2, stickers.filter((s) => symmetryOf(measureRgba(s.data)) === 2).map((s) => s.id));
  assert.deepEqual(r.symmetric2, ["B_0_0"]);
  assert.deepEqual(r.symmetric4, ["B_0_1"]);
  assert.equal(LOOSE_THRESHOLDS.share, 0.03);
});

test("near copies within the loose tolerance count as identical, and the light stays green (D9)", () => {
  const tweak = Uint8ClampedArray.from(asym(1));
  for (let i = 0; i < 20; i++) tweak[(i * 331 % (N * N)) * 4] = 0; // a few stray pixels, far below the 3 percent share
  const r = analyzeStickers([{ id: "F_0_0", data: asym(1) }, { id: "F_0_1", data: tweak }, { id: "F_1_0", data: asym(2) }], 2);
  assert.deepEqual(r.identicalGroups.map((g) => [...g]), [["F_0_0", "F_0_1"]]);
  assert.equal(r.light, "green"); // identical, symmetric and turned stickers are information, never red
});

test("groups and symmetry come from the loose level, not the strict one", () => {
  // An 8 x 8 px patch is 1 percent of the sticker: within the loose share (3 percent), over the strict one (0.5 percent).
  const patch = (d) => { const e = Uint8ClampedArray.from(d); for (let y = 60; y < 68; y++) for (let x = 60; x < 68; x++) e.set([0, 0, 0, 255], (y * N + x) * 4); return e; };
  const r = analyzeStickers([{ id: "F_0_0", data: sym4 }, { id: "F_0_1", data: patch(sym4) }, { id: "F_1_0", data: asym(1) }], 2);
  assert.deepEqual(r.identicalGroups.map((g) => [...g]), [["F_0_0", "F_0_1"]]);
  const tw = analyzeStickers([{ id: "F_0_0", data: asym(1) }, { id: "F_0_1", data: patch(rot(asym(1), 1)) }], 2);
  assert.deepEqual(tw.twinGroups.map((g) => [...g]), [["F_0_0", "F_0_1"]]); // a turned near copy: twin at the loose level only
  assert.deepEqual(r.symmetric4, ["F_0_0", "F_0_1"]); // the patched rosette still counts as 4-fold (about 2 percent)
  assert.equal(symmetryOf(measureRgba(patch(sym4))), 4);
  assert.equal(classifyTiles([{ id: "x", side: N, data: patch(sym4) }]).strict.identical[0].order, 1); // strict would say none
  assert.equal(classifyTiles([{ id: "a", side: N, data: asym(1) }, { id: "b", side: N, data: patch(rot(asym(1), 1)) }]).strict.twins.filter((g) => g.identical.length > 1).length, 0);
});

test("the pixel tolerance is the loose 24, not the strict 16", () => {
  // A rosette whose left half is 20 levels darker in red: within 24 for every rotation, over 16.
  const shaded = tile((x, y) => (Math.hypot(x - 39.5, y - 39.5) < 20 ? [200 - (x < 40 ? 20 : 0), 20, 20] : [240, 240, 240]));
  assert.equal(symmetryOf(measureRgba(shaded)), 4);
  assert.deepEqual(analyzeStickers([{ id: "F_0_0", data: shaded }], 2).symmetric4, ["F_0_0"]);
});
