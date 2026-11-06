import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readdirSync, existsSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { createBelt } from "../src/belt.mjs";
import { upBorders, downBorders, borderGrid } from "../src/updown.mjs";
import { buildGrid, cellsPerFace } from "../src/grid.mjs";
import { gridToRects, compactSvg, cropRects } from "../src/compact.mjs";
import { detailShare, rotationDiffs } from "../src/metrics.mjs";
import { classifyTiles } from "../src/symmetry.mjs";
import { auditSvg } from "../src/svgcheck.mjs";
import { demoTheme } from "../examples/demo-theme.mjs";
import { archiveCurrent, nextVersion } from "../src/versions.mjs";
import { glyphPath, GLYPHS } from "../src/glyphs.mjs";
import { defineTheme } from "../src/theme.mjs";
import { validateConcept, seamReport, heroWarnings } from "../src/sketch.mjs";
import { groupVariants, badGroups, ratingTableMd, parseRatings } from "../src/variants.mjs";
import { parseHex } from "../src/color.mjs";

const belt = createBelt({
  sky: [[[0, "#f7c5d6"], [1, "#fde7c6"]], [[0, "#a9d4f2"], [1, "#e2f2fb"]], [[0, "#e9a9c5"], [1, "#fbd1a8"]], [[0, "#5a5fa8"], [1, "#a9a3d6"]]],
  ground: Array(4).fill([[0, "#bfe0b0"], [1, "#9cc08a"]]),
  horizon: (u) => 0.74 + 0.02 * Math.sin(u * Math.PI),
});

test("belt wraps: B continues into L and faces share their edge columns", () => {
  for (const v of [0, 0.3, 0.8, 1]) assert.deepEqual(belt.rgbAt(0, v), belt.rgbAt(4, v));
  const M = 24;
  const g = Object.fromEntries(["L", "F", "R", "B"].map((f) => [f, belt.grid(f, M)]));
  const pairs = [["L", "F"], ["F", "R"], ["R", "B"], ["B", "L"]];
  for (const [a, b] of pairs) for (let j = 0; j < M; j++) assert.equal(g[a].colors[j][M - 1], g[b].colors[j][0], `${a}|${b} row ${j}`);
});

test("Up/Down borders equal the neighbors' top/bottom rows (all 8 edges, by construction)", () => {
  const M = 24, U = borderGrid(upBorders(belt), M), D = borderGrid(downBorders(belt), M);
  const F = belt.grid("F", M).colors, L = belt.grid("L", M).colors, R = belt.grid("R", M).colors, B = belt.grid("B", M).colors;
  for (let i = 0; i < M; i++) {
    assert.equal(U.colors[M - 1][i], F[0][i], "U|F");
    assert.equal(U.colors[i][0], L[0][i], "U|L");
    assert.equal(U.colors[i][M - 1], R[0][M - 1 - i], "U|R");
    assert.equal(U.colors[0][i], B[0][M - 1 - i], "U|B");
    assert.equal(D.colors[0][i], F[M - 1][i], "D|F");
    assert.equal(D.colors[i][0], L[M - 1][M - 1 - i], "D|L");
    assert.equal(D.colors[i][M - 1], R[M - 1][i], "D|R");
    assert.equal(D.colors[M - 1][i], B[M - 1][M - 1 - i], "D|B");
  }
});

test("cell grid: M cells, whole cells per face", () => {
  assert.equal(cellsPerFace(420, 7), 60);
  const gr = buildGrid(4, (s, t) => [s * 255, t * 255, 0], 1);
  assert.equal(gr.colors[0][0], "#000000");
  assert.equal(gr.colors[3][3], "#ffff00");
});

test("gridToRects is lossless", () => {
  const colors = ["#111111", "#222222", "#333333"];
  const M = 9, grid = { M, colors: Array.from({ length: M }, (_, j) => Array.from({ length: M }, (_, i) => colors[(i > 3 ? 1 : 0) + (j > 5 && i < 7 ? 1 : 0)])) };
  const rects = gridToRects(grid, 90);
  const back = Array.from({ length: M }, () => Array(M).fill(null));
  for (const r of rects) for (let j = r.y / 10; j < (r.y + r.h) / 10; j++) for (let i = r.x / 10; i < (r.x + r.w) / 10; i++) {
    assert.equal(back[j][i], null, "no overlap");
    back[j][i] = r.fill;
  }
  assert.deepEqual(back, grid.colors);
  assert.ok(rects.length < M * M);
  assert.deepEqual(cropRects(rects, [0, 0, 10, 10]).length > 0, true);
});

test("compactSvg merges touching equal rects and never merges shapes that differ", () => {
  const same = '<svg><rect x="0" y="0" width="5" height="5" fill="#fff"/> <rect x="5" y="0" width="5" height="5" fill="#fff"/><rect x="0" y="5" width="10" height="5" fill="#fff"/></svg>';
  assert.equal(compactSvg(same), '<svg><rect x="0" y="0" width="10" height="10" fill="#fff"/></svg>');
  const differs = '<svg><rect x="0" y="0" width="5" height="5" fill="#fff"/><rect x="5" y="0" width="5" height="5" fill="#eee"/></svg>';
  assert.equal(compactSvg(differs), differs);
  const rounded = '<rect x="0" y="0" width="5" height="5" rx="2" fill="#fff"/><rect x="5" y="0" width="5" height="5" rx="2" fill="#fff"/>';
  assert.equal(compactSvg(rounded), rounded);
  const gap = '<rect x="0" y="0" width="5" height="5" fill="#fff"/><rect x="6" y="0" width="5" height="5" fill="#fff"/>';
  assert.equal(compactSvg(gap), gap);
});

test("compactSvg is lossless: skips merging when an attribute is not double-quoted, keeps precision", () => {
  const single = '<rect x="0" y="0" width="5" height="5" fill=\'red\'/><rect x="5" y="0" width="5" height="5" fill=\'blue\'/>';
  assert.equal(compactSvg(single), single);
  const stroke = '<rect x="0" y="0" width="5" height="5" fill="#fff" stroke=\'#000\'/><rect x="5" y="0" width="5" height="5" fill="#fff" stroke=\'#000\'/>';
  assert.equal(compactSvg(stroke), stroke);
  assert.equal(compactSvg('<rect x="0.12345" y="0" width="1" height="1" fill="#fff"/>'), '<rect x="0.12345" y="0" width="1" height="1" fill="#fff"/>');
  const prec = compactSvg('<rect x="0.12345" y="0" width="0.25" height="1" fill="#fff"/><rect x="0.37345" y="0" width="0.25" height="1" fill="#fff"/>');
  assert.equal(prec, '<rect x="0.12345" y="0" width="0.5" height="1" fill="#fff"/>');
});

test("belt: a non-periodic horizon function is reported, a periodic one is not", () => {
  const keys = Array(4).fill([[0, "#aaccee"], [1, "#eeeeff"]]);
  const mk = (horizon) => createBelt({ sky: keys, ground: keys, horizon });
  assert.deepEqual(mk((u) => 0.5 + 0.1 * u).warnings.length, 1);
  assert.match(mk((u) => 0.5 + 0.1 * u).warnings[0], /not periodic/);
  assert.deepEqual(mk((u) => 0.74 + 0.02 * Math.sin(u * Math.PI)).warnings, []);
  assert.deepEqual(mk(0.7).warnings, []);
});

test("library output passes the app's SVG allowlist (faces, tiles, net) and has no shape-rendering", () => {
  const dir = mkdtempSync(`${tmpdir()}/cube-a-`);
  demoTheme({ size: 420 }).build(dir, { previewN: [3] });
  for (const f of readdirSync(dir).filter((x) => x.endsWith(".svg"))) {
    const text = readFileSync(`${dir}/${f}`, "utf8");
    assert.deepEqual(auditSvg(text, f === "net.svg" ? { dimensions: false, size: false } : {}), [], f);
    assert.ok(!text.includes("shape-rendering"), f);
  }
  for (const f of readdirSync(`${dir}/tiles/n3`)) assert.deepEqual(auditSvg(readFileSync(`${dir}/tiles/n3/${f}`, "utf8")), [], f);
  const draw = () => "";
  const small = defineTheme({ name: "s", size: 320, belt, faces: { L: draw, F: draw, R: draw, B: draw, U: draw, D: draw } });
  assert.throws(() => small.build(mkdtempSync(`${tmpdir()}/cube-a-`), { previewN: [3] }), /not divisible/);
  const big = defineTheme({ name: "b", size: 1100, belt, faces: { L: draw, F: draw, R: draw, B: draw, U: draw, D: draw } });
  assert.throws(() => big.build(mkdtempSync(`${tmpdir()}/cube-a-`)), /1 to 1024/);
});

test("tile metrics: flat tile lacks detail, symmetric tile has a symmetry class, twins and identical are grouped", () => {
  const n = 8, make = (fn) => { const d = new Uint8ClampedArray(n * n * 4); for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) { const v = fn(x, y); d.set([v, v, v, 255], (y * n + x) * 4); } return d; };
  const flat = make(() => 200), corner = make((x, y) => (x < 3 && y < 3 ? 0 : 200)), disc = make((x, y) => (Math.hypot(x - 3.5, y - 3.5) < 2.5 ? 0 : 200)), turned = make((x, y) => (x > 4 && y < 3 ? 0 : 200));
  assert.equal(detailShare(flat, n), 0);
  assert.ok(detailShare(corner, n) > 0.1);
  assert.equal(Math.min(...rotationDiffs(disc, n)) < 0.03, true);
  assert.ok(Math.min(...rotationDiffs(corner, n)) > 0.1);
  const c = classifyTiles([{ id: "F_0_0", px: flat }, { id: "F_0_1", px: corner }, { id: "F_1_0", px: corner }, { id: "F_1_1", px: turned }, { id: "U_0_0", px: disc }], { probe: n });
  assert.deepEqual(c.lackDetail, ["F_0_0"]);
  assert.equal(c.tiles.find((t) => t.id === "U_0_0").symmetry, "4-fold");
  assert.equal(c.tiles.find((t) => t.id === "F_0_1").symmetry, "none");
  assert.deepEqual(c.identicalGroups, [["F_0_1", "F_1_0"]]);
  assert.ok(c.rotationTwinGroups.flat().includes("F_1_1"));
});

test("version archive: rebuild in place keeps v1, v2", () => {
  const dir = mkdtempSync(`${tmpdir()}/cube-v-`);
  assert.equal(archiveCurrent(dir), null);
  assert.equal(nextVersion(dir), 1);
  writeFileSync(`${dir}/F.svg`, "<svg/>");
  assert.equal(archiveCurrent(dir), `${dir}/v1`);
  writeFileSync(`${dir}/F.svg`, "<svg>2</svg>");
  assert.equal(archiveCurrent(dir), `${dir}/v2`);
  assert.equal(readFileSync(`${dir}/v1/F.svg`, "utf8"), "<svg/>");
  assert.deepEqual(readdirSync(dir).sort(), ["F.svg", "v1", "v2"]);
});

test("glyphs: paths only, unknown glyph throws", () => {
  assert.equal(Object.keys(GLYPHS).length, 36);
  assert.match(glyphPath("A1", 50, 50, 100, 100, 6), /^M[\d. ]+/);
  assert.throws(() => glyphPath("#", 0, 0, 10, 10, 2));
});

test("defineTheme builds six faces + net, no tiles unless previewN, tiles are viewBox crops", () => {
  const dir = mkdtempSync(`${tmpdir()}/cube-t-`);
  const draw = () => "<circle cx=\"210\" cy=\"210\" r=\"90\" fill=\"#fff\"/>";
  const theme = defineTheme({ name: "t", size: 420, belt, faces: { L: draw, F: draw, R: draw, B: draw, U: draw, D: draw } });
  const rep = theme.build(dir, { previewN: [3] });
  assert.deepEqual(readdirSync(dir).filter((f) => /^[ULFRBD]\.svg$/.test(f)).sort(), ["B.svg", "D.svg", "F.svg", "L.svg", "R.svg", "U.svg"]);
  assert.ok(existsSync(`${dir}/net.svg`) && existsSync(`${dir}/build-report.json`));
  assert.equal(readdirSync(`${dir}/tiles/n3`).length, 54);
  assert.match(readFileSync(`${dir}/tiles/n3/F_1_2.svg`, "utf8"), /width="140" height="140" viewBox="280 140 140 140"/);
  assert.equal(rep.tilePreviews[0].count, 54);
  const plain = mkdtempSync(`${tmpdir()}/cube-t-`);
  theme.build(plain);
  assert.equal(existsSync(`${plain}/tiles`), false);
  assert.throws(() => defineTheme({ name: "x", faces: {} }).build(plain));
});

test("sketch: edge-color report finds a mismatch and hero share warnings", () => {
  const face = (sky, ground, edges) => ({ hero: "H", heroColor: "#dddddd", sky, ground, edges });
  const c = { theme: "t", faces: {
    L: face(["#000000", "#101010"], "#202020", { left: "#808080", right: "#909090" }),
    F: face(["#000000", "#101010"], "#202020", { left: "#909090", right: "#a0a0a0" }),
    R: face(["#000000", "#101010"], "#202020", { left: "#a0a0a0", right: "#b0b0b0" }),
    B: face(["#000000", "#101010"], "#202020", { left: "#b0b0b0", right: "#808080" }),
    U: { hero: "S", heroShare: 0.7 }, D: { hero: "D" },
  } };
  assert.deepEqual(validateConcept(c), []);
  const rep = seamReport(c, 10);
  assert.equal(rep.length, 12);
  assert.ok(rep.every((r) => r.pass));
  c.faces.F.edges.left = "#ffffff";
  assert.deepEqual(seamReport(c, 10).filter((r) => !r.pass).map((r) => r.edge), ["L|F"]);
  assert.equal(heroWarnings(c).length, 1);
  assert.ok(validateConcept({ faces: {} }).length >= 6);
  assert.deepEqual(parseHex("#0a0b0c"), [10, 11, 12]);
});

test("variants: two per question, rating table round trip", () => {
  assert.deepEqual(groupVariants(["b-a", "b-b", "u-a", "v1", "x"]), { b: ["b-a", "b-b"], u: ["u-a"] });
  assert.deepEqual(badGroups(["b-a", "b-b", "u-a"]), [{ group: "u", count: 1 }]);
  const md = ratingTableMd(["b-a", "b-b"]).replace("| b-a |  |  |  |  |  |", "| b-a | 4 | 5 | 3 | 2 | 4 |");
  assert.deepEqual(parseRatings(md), [{ variant: "b-a", legibility: 4, story: 5, charm: 3, calm: 2, overall: 4 }]);
});
