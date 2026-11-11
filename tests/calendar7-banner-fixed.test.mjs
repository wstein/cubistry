// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, the month banner in FIXED unit-grid coordinates (cube center origin, cell pitch 1), independent of the
// outer layer factor f (1.8 for the 7x7): banner y 2.9 .. 3.9 (height 1.0, its bottom 0.4 above the lower edge of the top cell
// row 2.5 .. 3.5), x -3.8 .. 3.8 (0.3 beyond the cell grid edges at +-3.5), corner radius 0.3. Like the digits and lines, the
// print is the same at every f; when the outer cubie is too small the art continues beyond the face and is clipped at its edge.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { CALENDAR7_SIZE, NAMES_BANNER_BOTTOM_OFFSET, NAMES_BANNER_HEIGHT, NAMES_BANNER_OVERHANG, NAMES_BANNER_RADIUS, layerWidthsFor, monthBanner, outerLayerWidth, unitGridTileOf } from "../src/apps/calendar7/geometry.ts";
import { SCHEMES, namesGround } from "../src/apps/calendar7/schemes.ts";
import { lineRect, nameCenterUp, tileEdgeColors, tileGrid, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
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

// Digests taken at the head 72e44d0b (accepted design: banner 1.0 tall at y 2.9 .. 3.9, x -3.8 .. 3.8, radius 0.3, f = 1.8).
const PINS = { table: "a7e43093e437a385c76b485a79ad1b2437b9f7f792cb843b9448abed857e93e0", tiles: "e12f85796b086640d133fe3bca215b90aca233b311a20cb599c24dba03b645fa" };

test("at f = 1.8 the banner defined by its absolute unit-grid constants reproduces the geometry of the accepted design exactly (14-font table, grid rectangles and cut-face edge colors of all 294 tiles in all 10 schemes)", () => {
  assert.equal(outerLayerWidth(CALENDAR7_SIZE), 1.8);
  assert.equal(sha(tableDump()), PINS.table);
  assert.equal(sha(tileDump()), PINS.tiles);
});

const near = (a, b, eps, what) => assert.ok(Math.abs(a - b) <= eps, `${what}: ${a} != ${b}`);
const FACTORS = [1.2, 1.5, 1.6, 1.8, 2.1];
const PAPER_BLUE = SCHEMES.find((s) => s.lineRow1);
/** The first month row tile of every column at the outer factor f: the corner tile (column 1), the five middle tiles, the corner tile (column 7). */
const rowTiles = (f) => Array.from({ length: 7 }, (_, c) => ({ c, tile: { w: c === 0 || c === 6 ? f : 1, h: f, band: { l: c === 0 ? f - 1 : 0, r: c === 6 ? f - 1 : 0, t: f - 1, b: 0 } } }));
/** A canvas rectangle of a tile in unit-grid coordinates (cube center origin; the cell of column c, row 0 is centered on (c - 3, 3)). */
const grid = (g, c, r, x0, y0, x1, y1) => ({ x0: c - 3 + (x0 - g.cx) / g.px, x1: c - 3 + (x1 - g.cx) / g.px, top: 3 - r - (y0 - g.cy) / g.py, bottom: 3 - r - (y1 - g.cy) / g.py });

test("the banner constants are named absolute unit-grid values (one change each) and the month banner follows them", () => {
  assert.equal(NAMES_BANNER_HEIGHT, 1.0);
  assert.equal(NAMES_BANNER_BOTTOM_OFFSET, 0.4);
  assert.equal(NAMES_BANNER_OVERHANG, 0.3);
  assert.equal(NAMES_BANNER_RADIUS, 0.3);
  const m = monthBanner();
  near(m.height, 1.0, 1e-12, "height"); near(m.bottom, 0.4 - 0.5, 1e-12, "bottom relative to the cell center"); near(m.top, 0.9, 1e-12, "top relative to the cell center");
});

test("invariance: at f = 1.2, 1.5, 1.6, 1.8 and 2.1 the banner rectangle of the month row is the same in unit-grid coordinates (y 2.9 .. 3.9, x -3.8 .. 3.8, the join edges of the tiles in between)", () => {
  for (const f of FACTORS) for (const { c, tile } of rowTiles(f)) {
    const g = tileGrid(tile, f), r = grid(g, c, 0, g.banner.x0, g.banner.y0, g.banner.x1, g.banner.y1);
    near(r.top, 3.9, 1e-9, `f ${f} column ${c}: banner top`); near(r.bottom, 2.9, 1e-9, `f ${f} column ${c}: banner bottom`);
    if (c === 0) near(r.x0, -3.8, 1e-9, `f ${f}: banner left end`);
    if (c === 6) near(r.x1, 3.8, 1e-9, `f ${f}: banner right end`);
    if (c > 0 && c < 6) { near(r.x0, c - 3 - (g.cx) / g.px + g.cx / g.px - (g.W / 2) / g.px, 1e-9, `f ${f} column ${c}: middle tile starts at its texture edge`); }
    const cell = grid(g, c, 0, g.cell.x0, g.cell.y0, g.cell.x1, g.cell.y1);
    near(cell.top - cell.bottom, 1, 0.03, `f ${f} column ${c}: the cell is one unit tall`);
    near(cell.bottom, 2.5, 0.02, `f ${f} column ${c}: the cell row ends at 2.5`);
  }
});

test("invariance: the weekday line and the month line are at the same unit-grid positions at every f; the font table is the same at every f down to 1.5", () => {
  const line = { color: "#1558d8", px: 3 };
  const at = (f, c, r, banner) => { const tile = r === 0 ? rowTiles(f)[c].tile : { w: c === 0 || c === 6 ? f : 1, h: 1, band: { l: c === 0 ? f - 1 : 0, r: c === 6 ? f - 1 : 0, t: 0, b: 0 } }, g = tileGrid(tile, f), l = lineRect(line, "names", true, tile, banner, f); return grid(g, c, r, l.x, l.y, l.x + l.w, l.y + l.h); };
  for (const c of [0, 3, 6]) for (const [r, banner] of [[0, true], [1, false]]) {
    const base = at(1.8, c, r, banner);
    for (const f of FACTORS) { const l = at(f, c, r, banner); for (const k of ["x0", "x1", "top", "bottom"]) near(l[k], base[k], 2e-3, `f ${f} column ${c} row ${r}: line ${k}`); }
  }
  for (const [id, font] of Object.entries(FONT_METRICS)) {
    const base = JSON.stringify(round(nameFaceTable(font, 1.8)));
    for (const f of [1.5, 1.6, 2.1]) assert.equal(JSON.stringify(round(nameFaceTable(font, f))), base, `${id}: the table at f ${f} equals the table at 1.8`);
  }
});

test("invariance: the cut-face edge colors of all seven columns and all four edges follow the unit-grid banner at every f (red exactly where the edge runs inside x -3.8 .. 3.8, y 2.9 .. 3.9)", () => {
  const roles = tileRoles(SCHEMES[0], "", "band", "names"), ground = namesGround(SCHEMES[0].dayFill), red = SCHEMES[0].bandFill;
  const colorAt = (edge, t) => (typeof edge === "string" ? edge : (edge.find((s) => t <= s.to + 1e-12) ?? edge[edge.length - 1]).color);
  const inside = (v, lo, hi) => (v > lo + 1e-3 && v < hi - 1e-3 ? true : v < lo - 1e-3 || v > hi + 1e-3 ? false : null); // null: on the boundary, not compared
  let compared = 0;
  for (const f of [1.2, 1.4, 1.5, 1.6, 1.8, 2.1]) for (const { c, tile } of rowTiles(f)) {
    const e = tileEdgeColors(roles, ground, tile, f), g = tileGrid(tile, f), at = (x, y) => grid(g, c, 0, x, y, x, y);
    for (let k = 1; k < 100; k++) {
      const t = k / 100;
      // side edges run bottom to top (t from the bottom), top and bottom edges left to right
      const probes = [
        ["left", at(0, g.H * (1 - t)), (p) => [inside(p.x0, -3.8, 3.8), inside(p.top, 2.9, 3.9)]],
        ["right", at(g.W, g.H * (1 - t)), (p) => [inside(p.x0, -3.8, 3.8), inside(p.top, 2.9, 3.9)]],
        ["top", at(g.W * t, 0), (p) => [inside(p.x0, -3.8, 3.8), inside(p.top, 2.9, 3.9)]],
        ["bottom", at(g.W * t, g.H), (p) => [inside(p.x0, -3.8, 3.8), inside(p.top, 2.9, 3.9)]],
      ];
      for (const [edge, p, test] of probes) {
        const [ix, iy] = test(p);
        if (ix === null || iy === null) continue;
        compared++;
        assert.equal(colorAt(e[edge], t), ix && iy ? red : ground, `f ${f} column ${c} ${edge} edge at ${t}: unit-grid (${p.x0.toFixed(3)}, ${p.top.toFixed(3)})`);
      }
    }
  }
  assert.ok(compared > 3000, `compared ${compared} edge positions`);
});

test("invariance: a banner tile that is not in the thick month row keeps the banner 0.4 unit from its top and bottom edge at every f", () => {
  for (const f of [1.2, 1.5, 1.8, 2.1]) for (const tile of [{ w: 1, h: 1 }, { w: f, h: 1, band: { l: f - 1, r: 0, t: 0, b: 0 } }]) {
    const g = tileGrid(tile, f);
    near(g.banner.y0 / g.py, 0.4, 0.02, `f ${f}: banner top margin`); near((g.H - g.banner.y1) / g.py, 0.4, 0.02, `f ${f}: banner bottom margin`);
  }
});

test("clipping at f = 1.2: the banner extends beyond the outer cubie face (top for f < 1.4, side for f < 1.3), is clipped at the texture edge and the cut faces keep its color along the clipped edge; at f = 1.8 the edges are white", () => {
  const roles = tileRoles(SCHEMES[0], "", "band", "names"), ground = namesGround(SCHEMES[0].dayFill), red = SCHEMES[0].bandFill;
  for (const [f, clipped] of [[1.2, true], [1.3, true], [1.32, true], [1.4, true], [1.42, false], [1.8, false]]) {
    const tile = rowTiles(f)[0].tile, g = tileGrid(tile, f), e = tileEdgeColors(roles, ground, tile, f);
    const top = g.banner.y0 < -1e-6, side = g.banner.x0 < -1e-6;
    // the thresholds are about 1.3 (side) and 1.4 (top); the bevel mapping of the face moves them by about 0.01
    assert.equal(top, f <= 1.4, `f ${f}: top clipped`);
    assert.equal(side, f <= 1.3, `f ${f}: side clipped`);
    if (side) assert.ok(Array.isArray(e.left) && e.left.some((s) => s.color === red), `f ${f}: the left cut face carries the red of the clipped banner`);
    else assert.equal(e.left, ground, `f ${f}: the left edge is the white margin`);
    if (top) assert.ok(Array.isArray(e.top) ? e.top.some((s) => s.color === red) : e.top === red, `f ${f}: the top cut face carries the red of the clipped banner`);
    else assert.equal(e.top, ground, `f ${f}: the top edge is the white margin`);
    void clipped;
  }
});

test("font table at f = 1.2 and 1.6: no blocked tile, sizes and tracking range pinned as literals, equal to the table at 1.8 (the first-tile room of the 0.8 unit stays within the texture edge)", () => {
  const PIN = { noto: [96, -8.28, 4.68], nunito: [94.75, -4.82, 3.85], "nunito-sans": [95, -6.02, 3.64], quicksand: [98.5, -2.61, 2.47], "nova-oval": [91.25, -10.75, 11.73], "nova-square": [95.5, -10.92, 6.81], "nova-mono": [120, -1.95, 3.69], comfortaa: [86.5, -3.34, 8.99], "varela-round": [90.25, -3.08, 5.54], "crete-round": [91.25, -1.35, 13.42], "dseg14classic-bold": [83.5, -1.14, 0.82], "dseg14classic-regular": [83.5, -1.14, 0.82], "dseg14modern-bold": [82.5, 0, 0.09], "dseg14modern-regular": [82.5, 0, 0.09] };
  for (const f of [1.2, 1.6, 1.8]) for (const [id, font] of Object.entries(FONT_METRICS)) {
    const t = nameFaceTable(font, f), tr = [...t.tiles.values()].map((x) => x.tracking), [size, lo, hi] = PIN[id];
    assert.equal(t.blocked.length, 0, `${id} f ${f}: no blocked tile`);
    assert.equal(t.size, size, `${id} f ${f}: size`);
    near(Math.min(...tr), lo, 0.006, `${id} f ${f}: min tracking`); near(Math.max(...tr), hi, 0.006, `${id} f ${f}: max tracking`);
  }
});
