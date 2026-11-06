import test from "node:test";
import assert from "node:assert/strict";
import { EDGES, FACE_NAMES, SIDES_CHECK, assertSupportedN, edgePixelPair, edgeSegments, parseNSpec, parseTileId, stickerCount, tileIds } from "./helpers.mjs";
import { findForbidden, styleAudit, checkSizes, checkTileFormat, faceRoot } from "../src/rules.mjs";
import { stripDiffs, edgeStats, seamVerdict } from "../src/seams.mjs";

test("supported sizes are 2..7 and sticker counts follow 6*N*N", () => {
  for (const n of [2, 3, 4, 5, 6, 7]) assert.equal(assertSupportedN(n), n);
  for (const n of [1, 8, 2.5, "3"]) assert.throws(() => assertSupportedN(n));
  assert.deepEqual([2, 3, 4, 5, 6, 7].map(stickerCount), [24, 54, 96, 150, 216, 294]);
  assert.equal(tileIds(7).length, 294);
  assert.deepEqual(parseTileId("F_3_6"), { face: "F", r: 3, c: 6 });
  assert.equal(parseTileId("X_0_0"), null);
});

test("parseNSpec: --n, --n-range and the 2..7 default", () => {
  assert.deepEqual(parseNSpec(undefined, undefined), [2, 3, 4, 5, 6, 7]);
  assert.deepEqual(parseNSpec("4", undefined), [4]);
  assert.deepEqual(parseNSpec(undefined, "3-5"), [3, 4, 5]);
  assert.deepEqual(parseNSpec(undefined, "2..3"), [2, 3]);
  assert.throws(() => parseNSpec(undefined, "5-3"));
  assert.throws(() => parseNSpec(undefined, "2-9"));
  assert.throws(() => parseNSpec(undefined, "x"));
});

test("the 12 edges use every side of every face exactly once", () => {
  assert.equal(EDGES.length, 12);
  const used = EDGES.flatMap((e) => [e.a.join("."), e.b.join(".")]);
  assert.equal(new Set(used).size, 24);
  for (const f of FACE_NAMES) for (const s of SIDES_CHECK) assert.ok(used.includes(`${f}.${s}`), `${f}.${s}`);
});

test("edge pixel pairs: corners meet and reversed edges run backwards", () => {
  const S = 10, byName = Object.fromEntries(EDGES.map((e) => [e.name, e]));
  assert.deepEqual(edgePixelPair(byName["L|F"], 3, S), [[9, 3], [0, 3]]);
  assert.deepEqual(edgePixelPair(byName["U|F"], 3, S), [[3, 9], [3, 0]]);
  assert.deepEqual(edgePixelPair(byName["U|R"], 0, S), [[9, 0], [9, 0]]); // U top-right corner meets R top-right corner
  assert.deepEqual(edgePixelPair(byName["U|B"], 2, S), [[2, 0], [7, 0]]);
  assert.deepEqual(edgePixelPair(byName["D|L"], 0, S), [[0, 0], [9, 9]]);
});

test("edge segments split S into N sticker segments", () => {
  assert.deepEqual(edgeSegments(420, 7).map(([a, b]) => b - a), Array(7).fill(60));
  assert.deepEqual(edgeSegments(10, 2), [[0, 5], [5, 10]]);
});

test("forbidden constructs are found", () => {
  const bad = '<svg><defs><linearGradient id="g"/><clipPath id="c"/><filter id="f"/></defs><text>x</text><image href="a.png"/><rect fill="url(#g)"/><script>1</script></svg>';
  const ids = findForbidden(bad).map((h) => h.id);
  for (const id of ["gradient", "clipPath", "filter", "text", "image", "href", "url()", "script"]) assert.ok(ids.includes(id), id);
  assert.deepEqual(findForbidden('<svg><rect fill="#fff" stroke="#000" stroke-width="3"/><path d="M0 0L1 1"/></svg>'), []);
  assert.deepEqual(findForbidden("<svg><g transform=\"rotate(3)\"/><textual/></svg>").map((h) => h.id), []);
});

test("style audit counts non-white stroke colors and weights", () => {
  const a = styleAudit('<path stroke="#4a3a38" stroke-width="3"/><path stroke="#fff" stroke-width="6"/><path stroke="none"/><path stroke="#123456" stroke-width="2"/>');
  assert.deepEqual(a.strokeColors.sort(), ["#123456", "#4a3a38"]);
  assert.deepEqual(a.strokeWidths, ["2", "3", "6"]);
});

test("size budget: warn thresholds per kind", () => {
  const r = checkSizes([
    { file: "F.svg", bytes: 150 * 1024, kind: "face" },
    { file: "B.svg", bytes: 201 * 1024, kind: "face" },
    { file: "F_0_0.svg", bytes: 31 * 1024, kind: "tile" },
    { file: "F_0_1.svg", bytes: 30 * 1024, kind: "tile" },
  ]);
  assert.deepEqual(r.over.map((x) => x.file), ["B.svg", "F_0_0.svg"]);
  assert.equal(r.ok, false);
  assert.equal(checkSizes([{ file: "x", bytes: 90 * 1024, kind: "tile" }], { tileKB: 100, faceKB: 100 }).ok, true);
});

test("tile format: width/height and viewBox crop", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="120 60 60 60"></svg>';
  assert.deepEqual(checkTileFormat(ok, { r: 1, c: 2, tile: 60 }), []);
  assert.equal(checkTileFormat(ok, { r: 2, c: 1, tile: 60 }).length, 1);
  assert.equal(checkTileFormat(ok.replace('width="60"', 'width="61"'), { r: 1, c: 2, tile: 60 }).length, 1);
  assert.deepEqual(faceRoot('<svg width="420" height="420" viewBox="0 0 420 420">'), { width: 420, height: 420, viewBox: "0 0 420 420" });
});

test("seam math: strips, reversal, verdict", () => {
  const a = [10, 10, 10, 20, 20, 20, 30, 30, 30], b = [30, 30, 30, 20, 20, 20, 10, 10, 10];
  assert.deepEqual(stripDiffs(a, b, true), [0, 0, 0]);
  assert.deepEqual(stripDiffs(a, b, false), [20, 0, 20]);
  assert.throws(() => stripDiffs(a, [1, 2, 3]));
  const st = edgeStats([0, 0, 4, 4], 2);
  assert.equal(st.mean, 2);
  assert.deepEqual(st.segmentMeans, [0, 4]);
  assert.equal(st.worstSegment, 4);
  assert.equal(seamVerdict(st), true);
  assert.equal(seamVerdict(edgeStats([5, 5, 5, 5], 2)), false);
  assert.equal(seamVerdict(edgeStats([0, 0, 0, 40], 2), { meanLimit: 20, bigShare: 0.1 }), false);
});
