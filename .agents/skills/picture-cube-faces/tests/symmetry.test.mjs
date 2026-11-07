import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { classifyTiles, summarize, appearanceOf } from "../src/symmetry.mjs";
import { classifyTiles as packageClassify, LOOSE_THRESHOLDS } from "../../../../packages/cube-appearance/src/index.ts";

const n = 40;
const make = (fn) => { const d = new Uint8ClampedArray(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = fn(x + 0.5, y + 0.5); d.set([v, v, v, 255], (y * n + x) * 4); } return d; };
const inside = (x, y, x0, y0, x1, y1) => x >= x0 && x < x1 && y >= y0 && y < y1;
const disc = make((x, y) => (Math.hypot(x - 20, y - 20) < 12 ? 40 : 220)); // 4-fold
const bar = make((x, y) => (inside(x, y, 4, 17, 36, 23) ? 40 : 220)); // 2-fold
const corner = make((x, y) => (inside(x, y, 3, 3, 17, 12) ? 40 : 220)); // none
const turn = (d, k) => { // turn a picture by k quarter turns (clockwise)
  let cur = d;
  for (let i = 0; i < k; i++) { const e = new Uint8ClampedArray(cur.length); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) e.set(cur.subarray(((n - 1 - x) * n + y) * 4, ((n - 1 - x) * n + y) * 4 + 4), (y * n + x) * 4); cur = e; }
  return cur;
};
const shifted = (d, dx) => make((x, y) => { const sx = Math.min(n - 1, Math.max(0, Math.round(x - 0.5 - dx))); return d[(Math.floor(y) * n + sx) * 4]; });
const flat = make(() => 200);

test("symmetry order: 4-fold, 2-fold, none", () => {
  const c = classifyTiles([{ id: "U_0_0", px: disc }, { id: "U_0_1", px: bar }, { id: "U_1_0", px: corner }], { probe: n });
  assert.deepEqual(c.tiles.map((t) => [t.id, t.symmetry, t.equivalentTurns]), [["U_0_0", "4-fold", 4], ["U_0_1", "2-fold", 2], ["U_1_0", "none", 1]]);
  assert.deepEqual(c.counts.symmetry, { none: 1, twoFold: 1, fourFold: 1 });
});

test("identical and rotation-twin groups are found by distance, not by exact pixels", () => {
  const noisy = Uint8ClampedArray.from(corner); for (let i = 0; i < 30; i++) noisy[(i * 53 % (n * n)) * 4] += 6; // sub-threshold noise
  const near = shifted(corner, 0.4); // a fraction of a pixel of drift
  const c = classifyTiles([
    { id: "F_0_0", px: corner }, { id: "F_0_1", px: noisy }, { id: "F_1_0", px: near },
    { id: "L_0_0", px: turn(corner, 1) }, { id: "R_0_0", px: turn(corner, 2) }, { id: "B_0_0", px: bar },
  ], { probe: n });
  assert.equal(c.identicalGroups.length, 1);
  assert.ok(c.identicalGroups[0].includes("F_0_0") && c.identicalGroups[0].includes("F_0_1"));
  assert.equal(c.rotationTwinGroups.length, 1);
  assert.deepEqual(c.rotationTwinGroups[0].filter((x) => x === "L_0_0" || x === "R_0_0").sort(), ["L_0_0", "R_0_0"]);
  assert.ok(!c.identicalGroups.flat().includes("B_0_0") && !c.rotationTwinGroups.flat().includes("B_0_0"));
  // an exact 4-fold copy is a duplicate, never a twin
  const d = classifyTiles([{ id: "F_0_0", px: disc }, { id: "F_0_1", px: Uint8ClampedArray.from(disc) }], { probe: n });
  assert.equal(d.counts.identicalGroups, 1);
  assert.equal(d.counts.rotationTwinGroups, 0);
});

test("odd N reports center stickers; symmetric centers need no orientation; even N reports none", () => {
  const tiles = ["U", "L", "F", "R", "B", "D"].map((f, i) => ({ id: `${f}_1_1`, px: [disc, bar, corner, disc, corner, bar][i] }));
  const c = classifyTiles(tiles, { n: 3, probe: n });
  assert.deepEqual(c.centers.map((x) => [x.face, x.symmetry, x.orientationNeeded]), [["U", "4-fold", false], ["L", "2-fold", false], ["F", "none", true], ["R", "4-fold", false], ["B", "none", true], ["D", "2-fold", false]]);
  assert.match(summarize(c), /centers: 4 of 6 need no orientation/);
  assert.deepEqual(classifyTiles([{ id: "F_1_1", px: disc }], { n: 4, probe: n }).centers, []);
});

test("flat stickers are listed and the JSON shape is stable", () => {
  const c = classifyTiles([{ id: "F_0_0", px: flat }, { id: "F_0_1", px: bar }], { n: 2, probe: n });
  assert.deepEqual(c.lackDetail, ["F_0_0"]);
  assert.deepEqual(Object.keys(c), ["version", "n", "stickers", "probe", "thresholds", "tiles", "counts", "lackDetail", "identicalGroups", "rotationTwinGroups", "centers"]);
  assert.deepEqual(Object.keys(c.counts), ["stickers", "symmetry", "lackDetail", "identicalGroups", "identicalTiles", "rotationTwinGroups", "rotationTwinTiles"]);
  assert.deepEqual(Object.keys(c.tiles[0]), ["id", "symmetry", "equivalentTurns", "detail", "rotDiff"]);
  assert.deepEqual(Object.keys(c.tiles[0].rotDiff), ["r90", "r180", "r270"]);
  assert.equal(c.version, 1);
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c);
});

test("the skill classifier is the package: same groups, orders and offsets, no second implementation", () => {
  const tiles = [
    { id: "F_0_0", px: corner }, { id: "F_0_1", px: Uint8ClampedArray.from(corner) }, { id: "L_0_0", px: turn(corner, 1) },
    { id: "B_0_0", px: bar }, { id: "U_0_0", px: disc },
  ];
  // The adapter hands the tiles to the package (downsampled by 2 for speed and antialiasing) ...
  const half = (d) => { const m = n / 2, e = new Uint8ClampedArray(m * m * 4); for (let y = 0; y < m; y++) for (let x = 0; x < m; x++) for (let ch = 0; ch < 4; ch++) { let s = 0; for (let j = 0; j < 2; j++) for (let i = 0; i < 2; i++) s += d[((2 * y + j) * n + 2 * x + i) * 4 + ch]; e[(y * m + x) * 4 + ch] = Math.round(s / 4); } return e; };
  const direct = packageClassify(tiles.map((t) => ({ id: t.id, side: n / 2, data: half(t.px) })));
  const viaSkill = appearanceOf(tiles, { probe: n });
  assert.deepEqual(JSON.parse(JSON.stringify(viaSkill)), JSON.parse(JSON.stringify(direct)));
  // ... and the version-1 JSON is derived from the package result at the loose level.
  const c = classifyTiles(tiles, { n: 2, probe: n });
  assert.deepEqual(c.identicalGroups, direct.loose.identical.filter((g) => g.members.length > 1).map((g) => [...g.members].sort()));
  assert.deepEqual(c.rotationTwinGroups, direct.loose.twins.filter((g) => g.identical.length > 1).map((g) => g.members.map((m) => m.id).sort()));
  assert.deepEqual(c.tiles.map((t) => t.equivalentTurns), tiles.map((t) => direct.tiles.find((x) => x.id === t.id).order.loose));
  assert.equal(c.thresholds.symmetry, LOOSE_THRESHOLDS.share);
  // The module carries no pixel comparison of its own.
  const src = readFileSync(new URL("../src/symmetry.mjs", import.meta.url), "utf8");
  assert.match(src, /packages\/cube-appearance\/src\/index\.ts/);
  assert.ok(!/Sets|union\(|pixelDistance|rotationDiffs/.test(src));
});

test("no transitive merge: A~B and B~C do not pull in C when A and C differ (complete linkage)", () => {
  // Three bars whose widths step by 5 px (1.9 percent of the area per step, limit 3 percent): neighbors match, the ends do not.
  const step = (w) => make((x, y) => (inside(x, y, 4, 17, 4 + w, 23) ? 40 : 220));
  const a = step(16), b = step(21), cc = step(26);
  const tiles = [{ id: "F_0_0", px: a }, { id: "F_0_1", px: b }, { id: "F_1_0", px: cc }];
  const loose = { share: 0.03 };
  const direct = appearanceOf(tiles, { probe: n, tol: loose.share });
  const groups = direct.loose.identical.map((g) => g.members.length);
  assert.ok(Math.max(...groups) < 3, JSON.stringify(direct.loose.identical));
});
