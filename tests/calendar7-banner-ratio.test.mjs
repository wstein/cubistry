// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, the month banner defined by three ratios of the outer cubie width W (= the layer profile factor f,
// 1.8 for the 7x7): banner height H = 5/9 W, bottom gap b = 2/9 W, end piece p = 13/18 W (the width of the start and end piece
// of the banner inside the outer cubie). At f = 1.8 they give the geometry of the first accepted design (H = 1.0, b = 0.4, top
// gap 0.4, side band 0.5, p = 1.3); at other f they scale with f while the content stays on the uniform unit grid.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CALENDAR7_SIZE, NAMES_BANNER_BOTTOM_GAP_RATIO, NAMES_BANNER_END_PIECE_RATIO, NAMES_BANNER_HEIGHT_RATIO, bannerOf, layerWidthsFor, monthBanner, outerLayerWidth, unitGridTileOf } from "../src/apps/calendar7/geometry.ts";
import { SCHEMES, namesGround } from "../src/apps/calendar7/schemes.ts";
import { nameCenterUp, tileEdgeColors, tileGrid, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { nameFaceTable } from "../src/apps/calendar7/font-art.ts";
import { STICKERS } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import { FONT_METRICS } from "./calendar7-font-metrics.mjs";

const round = (v) => (typeof v === "number" ? Math.round(v * 1e9) / 1e9 + 0 : Array.isArray(v) ? v.map(round) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, round(x)])) : v);
const sha = (v) => createHash("sha256").update(JSON.stringify(round(v))).digest("hex");
const { printing, pose } = parseState(JSON.parse(readFileSync("public/calendar7/names/state.v1.json", "utf8")));
const WIDTHS = layerWidthsFor(CALENDAR7_SIZE);
const at = (arr, i) => [arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]];

/** The numbers of the table of every shipped font: size, seam gap, tracking per tile, center line, banner height. */
const tableDump = () => Object.entries(FONT_METRICS).map(([id, font]) => {
  const t = nameFaceTable(font);
  return { id, size: t.size, weekday: t.weekday, seamGap: t.seamGap, centerUp: t.centerUp, bannerHeight: t.bannerHeight, m: t.m, tiles: [...t.tiles.values()].map((x) => ({ label: x.label, anchor: x.anchor, tracking: x.tracking, gaps: x.gaps })) };
});
/** The grid rectangles and the cut-face edge colors of the 294 tiles of the print in the 10 schemes. */
const tileDump = () => {
  const out = [];
  for (let i = 0; i < STICKERS; i++) {
    const tile = unitGridTileOf(at(pose.pos, i), at(pose.normal, i), at(pose.up, i), WIDTHS), g = tileGrid(tile);
    for (const scheme of SCHEMES) out.push({ i, scheme: scheme.id, g, edges: tileEdgeColors(tileRoles(scheme, printing.text[i], printing.ink[i], "names"), namesGround(scheme.dayFill), tile) });
  }
  return out;
};

// Digests taken at the head 72e44d0b (margins as absolute constants: top 0.4, bottom 0.4, side 0.5, radius 0.3).
const PINS = { table: "a7e43093e437a385c76b485a79ad1b2437b9f7f792cb843b9448abed857e93e0", tiles: "e12f85796b086640d133fe3bca215b90aca233b311a20cb599c24dba03b645fa" };

test("at f = 1.8 the banner defined by the three ratios reproduces the geometry of the accepted design exactly (14-font table, grid rectangles and cut-face edge colors of all 294 tiles in all 10 schemes)", () => {
  assert.equal(outerLayerWidth(CALENDAR7_SIZE), 1.8);
  assert.equal(sha(tableDump()), PINS.table);
  assert.equal(sha(tileDump()), PINS.tiles);
});

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const FACTORS = [1.5, 1.6, 1.8, 2.1];

test("the three ratios are the single constants and the margins derive from them: H = 5/9 W, b = 2/9 W, top gap = W - H - b, p = 13/18 W, band to the cube edge = W - p", () => {
  assert.equal(NAMES_BANNER_HEIGHT_RATIO, 5 / 9);
  assert.equal(NAMES_BANNER_BOTTOM_GAP_RATIO, 2 / 9);
  assert.equal(NAMES_BANNER_END_PIECE_RATIO, 13 / 18);
  for (const w of FACTORS) {
    const b = bannerOf(w);
    near(b.height, w * 5 / 9, 1e-12, `H at ${w}`); near(b.bottomGap, w * 2 / 9, 1e-12, `b at ${w}`);
    near(b.topGap, w - b.height - b.bottomGap, 1e-12, `top gap at ${w}`); near(b.endPiece, w * 13 / 18, 1e-12, `p at ${w}`);
    near(b.sideBand, w - b.endPiece, 1e-12, `side band at ${w}`); near(b.radius, 0.3 * b.height, 1e-12, `radius at ${w}`);
    near(b.sideBand + 5 + 2 * b.endPiece + b.sideBand, 5 + 2 * w, 1e-12, `the banner spans 2 p + 5 cells inside the cube edge at ${w}`);
  }
});

test("scaling: at the profile factors 1.5, 1.6, 1.8 and 2.1 the banner height, the gaps and the end pieces scale with f while the content stays on the uniform unit grid (a cell is one unit)", () => {
  for (const w of FACTORS) {
    const first = { w, h: w, band: { l: w - 1, r: 0, t: w - 1, b: 0 } }, middle = { w: 1, h: w, band: { l: 0, r: 0, t: w - 1, b: 0 } }, last = { w, h: w, band: { l: 0, r: w - 1, t: w - 1, b: 0 } };
    const B = bannerOf(w);
    for (const [name, tile] of [["first", first], ["middle", middle], ["last", last]]) {
      const g = tileGrid(tile, w);
      near((g.banner.y1 - g.banner.y0) / g.py, B.height, 1e-9, `${name} at ${w}: banner height`);
      near((g.banner.y0 - (g.H / 2 - w / 2 * g.py)) / g.py, B.topGap, 1e-9, `${name} at ${w}: top gap (from the flat edge of the face)`);
      near(((g.H / 2 + w / 2 * g.py) - g.banner.y1) / g.py, B.bottomGap, 1e-9, `${name} at ${w}: bottom gap (from the flat edge of the face)`);
      near((g.cell.x1 - g.cell.x0) / g.px, 1, 0.03, `${name} at ${w}: the unit cell is one unit wide (the texture edge reaches into the bevel: 3%)`);
      near((g.cell.y1 - g.cell.y0) / g.py, 1, 0.03, `${name} at ${w}: the unit cell is one unit tall (3%)`);
    }
    const g1 = tileGrid(first, w);
    near((g1.banner.x0 - (g1.W / 2 - w / 2 * g1.px)) / g1.px, B.sideBand, 1e-9, `first at ${w}: band between the cube edge and the banner = W - p`);
    const m = monthBanner(w);
    near(m.height, B.height, 1e-12, `monthBanner height at ${w}`);
    near(nameCenterUp(0.7, 0.3, w), (m.top + m.bottom) / 2, 1e-12, `centered name at ${w}`);
  }
});

test("scaling: the font table at f = 1.5, 1.6, 1.8, 2.1 keeps every rule (no blocked tile, size at least the weekday size); the glyph size does not depend on f, the center line follows the banner", () => {
  for (const [id, font] of Object.entries(FONT_METRICS)) {
    const base = nameFaceTable(font, 1.8);
    for (const w of FACTORS) {
      const t = nameFaceTable(font, w);
      assert.equal(t.blocked.length, 0, `${id} at ${w}: blocked ${t.blocked.map((x) => x.label)}`);
      assert.ok(t.size >= t.weekday, `${id} at ${w}: size ${t.size} below the weekday size ${t.weekday}`);
      assert.equal(t.size, base.size, `${id} at ${w}: size`);
      near(t.bannerHeight, w * 5 / 9, 1e-9, `${id} at ${w}: banner height`);
      near(t.centerUp, bannerOf(w).bottomGap + bannerOf(w).height / 2 - 0.5, 1e-3, `${id} at ${w}: the name is centered in the banner`);
    }
  }
});

test("scaling: the room of the first name tile is the end piece p = 13/18 W less half a cell (no separate formula): a wide synthetic font that fits the first tile at f = 1.8 and 2.1 cannot at f = 1.5", () => {
  const synth = (w) => ({ ...FONT_METRICS.noto, glyphs: Object.fromEntries(Object.entries(FONT_METRICS.noto.glyphs).map(([c, g]) => [c, { ...g, advance: g.advance * w, left: g.left * w, right: g.right * w }])) });
  const font = synth(1.3);
  assert.deepEqual(nameFaceTable(font, 1.8).blocked.map((b) => b.label), ["ANU", "ARY"]);
  assert.deepEqual(nameFaceTable(font, 2.1).blocked.map((b) => b.label), ["ANU", "ARY"]);
  assert.deepEqual(nameFaceTable(font, 1.5).blocked.map((b) => b.label), ["ANU", "ARY", "NOV"]);
});
