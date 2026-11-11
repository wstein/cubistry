// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, unit grid (owner decision of 2026-11-11): the printed content is a uniform 7 x 7 grid of unit cells
// (the size of an inner cubie). A cubie on a thick outer layer (f = 1.8) carries exactly one unit cell on its INNER side and a
// band of f - 1 on its outer side (white margin); the month row is a red banner (1.0 tall) in a white frame: 0.4 above and below,
// 0.6 from the left and right cube edges; the month name sits in
// the upper part of the banner. Everything is checked on the recorded drawing of the real print (public/calendar7/names/state.v1.json)
// and mapped to scene units, no mock geometry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { layerCenters } from "@cubistry/cube-viewer";
import { CALENDAR7_SIZE, NAMES_BOTTOM_STRIP, NAMES_MONTH_SIDE_BAND, NAMES_TOP_STRIP, NAMES_WEEKDAY_DOWN, faceBandsOf, layerWidthsFor, monthBanner, outerLayerWidth, unitGridTileOf } from "../src/apps/calendar7/geometry.ts";
import { NAMES_WHITE, SCHEMES, namesGround } from "../src/apps/calendar7/schemes.ts";
import { drawFace, namePxPerUnit, nameCenterUp, tileEdgeColors, tileGrid, tileRoles } from "../src/apps/calendar7/sticker-art.ts";
import { drawFontSticker, labelLayout, nameFaceTable, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { STICKERS } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import { FONT_METRICS } from "./calendar7-font-metrics.mjs";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} != ${b}`);
const F = outerLayerWidth(CALENDAR7_SIZE), BAND = F - 1; // derived from the profile, never a literal 0.8
const PPU = namePxPerUnit();
const PAPER_RED = SCHEMES.find((s) => s.id === "paper-red");
const WIDTHS = layerWidthsFor(CALENDAR7_SIZE), CENTERS = layerCenters(WIDTHS);
const { printing, pose } = parseState(JSON.parse(readFileSync("public/calendar7/names/state.v1.json", "utf8")));
const at = (arr, i) => [arr[3 * i], arr[3 * i + 1], arr[3 * i + 2]];

/** A 2D context that records every fillRect in final canvas pixels and every text run: `cx, cy` its origin (the ink center of a run of the font drawing) and `ax, ay` its anchor point (the center of a built-in label). */
function track(draw) {
  let m = { a: 1, d: 1, e: 0, f: 0 }; const stack = [], rects = [], texts = [], state = { font: "", fill: "" };
  const ctx = {
    set fillStyle(v) { state.fill = v; }, get fillStyle() { return state.fill; },
    set font(v) { state.font = v; }, get font() { return state.font; },
    set fontKerning(v) {}, set textAlign(v) {}, set textBaseline(v) {},
    fillRect(x, y, w, h) { rects.push({ fill: state.fill, x0: m.e + m.a * x, y0: m.f + m.d * y, x1: m.e + m.a * (x + w), y1: m.f + m.d * (y + h) }); },
    fillText(t, x, y) { texts.push({ t, cx: m.e, cy: m.f, ax: m.e + m.a * x, ay: m.f + m.d * y, fill: state.fill }); },
    measureText: (t) => ({ width: Number(state.font.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save() { stack.push({ ...m }); }, restore() { m = stack.pop(); },
    translate(x, y) { m = { ...m, e: m.e + m.a * x, f: m.f + m.d * y }; }, scale(x, y) { m = { ...m, a: m.a * x, d: m.d * y }; }, rotate() {},
  };
  draw(ctx);
  return { rects, texts };
}

/** The 49 stickers of the front face of the print, with column c and row r (0-based, c from the left, r from the top), the tile and the scene position of the cubie. */
const FRONT = [];
for (let i = 0; i < STICKERS; i++) {
  const n = at(pose.normal, i);
  if (n[2] !== 1) continue;
  const p = at(pose.pos, i), up = at(pose.up, i);
  assert.deepEqual(up, [0, 1, 0]);
  const tile = unitGridTileOf(p, n, up, WIDTHS);
  FRONT.push({ i, c: p[0] + 3, r: 3 - p[1], tile, text: printing.text[i], ink: printing.ink[i], center: { x: CENTERS[p[0] + 3], y: CENTERS[p[1] + 3] } });
}
/** Canvas pixel of a tile to scene units of the front projection (x right, y up) of the cubie's face. */
const scene = (f, px, py) => { const g = tileGrid(f.tile); return { x: f.center.x + (px - g.W / 2) / g.px, y: f.center.y - (py - g.H / 2) / g.py }; };
/** Center of a text run of a drawing: the font drawing centers each run on its origin, the built-in drawing on its anchor. */
const runAt = (name, f, t) => (name === "font" ? scene(f, t.cx, t.cy) : scene(f, t.ax, t.ay));
const cellCenter = (f) => ({ x: f.c - 3, y: 3 - f.r }); // the 7 x 7 unit grid is centered on the cube

test("the front face has 49 stickers on the 7 x 7 grid; the unit grid is 7 wide inside the 8.6 cube (two bands of f - 1)", () => {
  assert.equal(FRONT.length, 49);
  assert.deepEqual(new Set(FRONT.map((f) => `${f.c},${f.r}`)).size, 49);
  near(WIDTHS.reduce((a, b) => a + b, 0) - 2 * BAND, 7, 1e-12);
  near(BAND, 0.8, 1e-12);
});

test("faceBandsOf: the band is f - 1 on the outer side of every outer cubie (left, right, top, bottom), derived from the profile, none on inner layers; all 294 faces", () => {
  for (let i = 0; i < STICKERS; i++) {
    const p = at(pose.pos, i), n = at(pose.normal, i), up = at(pose.up, i), b = faceBandsOf(p, n, up, WIDTHS);
    const right = [up[1] * n[2] - up[2] * n[1], up[2] * n[0] - up[0] * n[2], up[0] * n[1] - up[1] * n[0]];
    const along = (v) => v[0] * p[0] + v[1] * p[1] + v[2] * p[2]; // layer coordinate in the direction of v
    assert.equal(b.l, along(right) === -3 ? BAND : 0, `sticker ${i} left`);
    assert.equal(b.r, along(right) === 3 ? BAND : 0, `sticker ${i} right`);
    assert.equal(b.b, along(up) === -3 ? BAND : 0, `sticker ${i} bottom`);
    assert.equal(b.t, along(up) === 3 ? BAND : 0, `sticker ${i} top`);
  }
  // not a literal: another profile gives another band
  const p = [-3, 3, 3], n = [0, 0, 1], up = [0, 1, 0], wide = [2.5, 1, 1, 1, 1, 1, 2.5];
  assert.deepEqual(faceBandsOf(p, n, up, wide), { l: 1.5, r: 0, t: 1.5, b: 0 });
  assert.deepEqual(faceBandsOf([3, -3, 3], n, up, wide), { l: 0, r: 1.5, t: 0, b: 1.5 });
  near(monthBanner(2.5).top, 1.5 + 0.5 - NAMES_TOP_STRIP, 1e-12);
});

test("every front tile: the unit cell is on the 7 x 7 unit grid (center and the edges beside a band), at the inner side of the cubie, all 49 faces", () => {
  for (const f of FRONT) {
    const g = tileGrid(f.tile), cell = scene(f, g.cx, g.cy), want = cellCenter(f);
    near(cell.x, want.x, 1e-9, `(${f.c},${f.r}) cell x`); near(cell.y, want.y, 1e-9, `(${f.c},${f.r}) cell y`);
    // the sides with a band end on the grid line, the other sides at the canvas (texture) edge
    const left = scene(f, g.cell.x0, 0).x, right = scene(f, g.cell.x1, 0).x, top = scene(f, 0, g.cell.y0).y, bottom = scene(f, 0, g.cell.y1).y;
    if (f.tile.band.l > 0) near(left, want.x - 0.5, 1e-9, `(${f.c},${f.r}) left edge`); else assert.equal(g.cell.x0, 0);
    if (f.tile.band.r > 0) near(right, want.x + 0.5, 1e-9, `(${f.c},${f.r}) right edge`); else assert.equal(g.cell.x1, g.W);
    if (f.tile.band.t > 0) near(top, want.y + 0.5, 1e-9, `(${f.c},${f.r}) top edge`); else assert.equal(g.cell.y0, 0);
    if (f.tile.band.b > 0) near(bottom, want.y - 0.5, 1e-9, `(${f.c},${f.r}) bottom edge`); else assert.equal(g.cell.y1, g.H);
    // the cell lies inside the cubie
    assert.ok(cell.x - 0.5 >= f.center.x - f.tile.w / 2 - 1e-9 && cell.x + 0.5 <= f.center.x + f.tile.w / 2 + 1e-9, `(${f.c},${f.r}) cell inside the cubie (x)`);
    assert.ok(cell.y - 0.5 >= f.center.y - f.tile.h / 2 - 1e-9 && cell.y + 0.5 <= f.center.y + f.tile.h / 2 + 1e-9, `(${f.c},${f.r}) cell inside the cubie (y)`);
  }
});

// The metrics file has the capitals only: the digits come from a synthetic set (0.55 em wide, 0.735 em tall) next to the real Noto capitals.
const NOTO = { ...FONT_METRICS.noto, glyphs: { ...FONT_METRICS.noto.glyphs, ...Object.fromEntries([..."0123456789"].map((d) => [d, { advance: 0.63, left: 0.04, right: 0.59, top: -0.735, bottom: 0 }])) } };
/** The two drawings of a front tile: the font drawing (Noto capitals, synthetic digits) and the built-in drawing. */
const DRAWINGS = {
  font: (f) => track((c) => drawFontSticker(c, f.text, f.ink, NOTO, PAPER_RED, "face", undefined, "names", f.tile)),
  builtin: (f) => track((c) => drawFace(c, f.text, f.ink, "strict", PAPER_RED, "names", f.tile)),
};

test("every front tile, font and built-in drawing: white margin ground, the fill (red, weekend tint, white) on the unit cell only, the month row as a banner", () => {
  for (const [name, draw] of Object.entries(DRAWINGS)) for (const f of FRONT) {
    const roles = tileRoles(PAPER_RED, f.text, f.ink, "names"), r = draw(f).rects, g = tileGrid(f.tile), tag = `${name} (${f.c},${f.r}) "${f.text}"`;
    const banner = f.r === 0; // the month row: month name and band tiles
    assert.equal(roles.cls === "month" || roles.cls === "band", banner, tag);
    if (!banner && f.tile.band.l + f.tile.band.r + f.tile.band.t + f.tile.band.b === 0) { assert.deepEqual([r[0].fill, r[0].x0, r[0].y0, r[0].x1, r[0].y1], [roles.fill, 0, 0, g.W, g.H], `${tag}: an inner tile is one fill`); continue; }
    assert.deepEqual([r[0].fill, r[0].x0, r[0].y0, r[0].x1, r[0].y1], [NAMES_WHITE, 0, 0, g.W, g.H], `${tag}: white margin on the whole tile`);
    const cell = r[1];
    assert.equal(cell.fill, roles.fill, tag);
    // in scene units
    const lt = scene(f, cell.x0, cell.y0), rb = scene(f, cell.x1, cell.y1), want = cellCenter(f);
    if (!banner) {
      if (f.tile.band.l > 0) near(lt.x, want.x - 0.5, 1e-9, `${tag} fill left`); else assert.equal(cell.x0, 0);
      if (f.tile.band.r > 0) near(rb.x, want.x + 0.5, 1e-9, `${tag} fill right`); else assert.equal(cell.x1, g.W);
      if (f.tile.band.t > 0) near(lt.y, want.y + 0.5, 1e-9, `${tag} fill top`); else assert.equal(cell.y0, 0);
      if (f.tile.band.b > 0) near(rb.y, want.y - 0.5, 1e-9, `${tag} fill bottom`); else assert.equal(cell.y1, g.H);
    } else {
      // month row: 0.4 white at the top of the cubie, banner 1.0 tall, 0.4 white below it (strips of the row: cubie top and bottom)
      near(f.center.y + F / 2 - lt.y, NAMES_TOP_STRIP, 1e-9, `${tag} top strip`);
      near(rb.y - (f.center.y - F / 2), NAMES_BOTTOM_STRIP, 1e-9, `${tag} bottom strip`);
      near(lt.y - rb.y, F - NAMES_TOP_STRIP - NAMES_BOTTOM_STRIP, 1e-9, `${tag} banner height 1.2`);
      near(lt.y - rb.y, 1.0, 1e-9, `${tag} banner height 1.0 (literal)`);
      near(lt.y, 3.9, 1e-9, `${tag} banner top`); near(rb.y, 2.9, 1e-9, `${tag} banner bottom`);
      // the banner is inset by 0.6 (NAMES_MONTH_SIDE_BAND) from the cube edges, not by the 0.8 band of the other rows
      if (f.c === 0) near(lt.x, -4.3 + NAMES_MONTH_SIDE_BAND, 1e-9, `${tag} red starts 0.6 inside the left cube edge`); if (f.c === 0) near(lt.x, -3.7, 1e-9, `${tag} red starts at x = -3.7 (literal)`); else assert.equal(cell.x0, 0);
      if (f.c === 6) near(rb.x, 4.3 - NAMES_MONTH_SIDE_BAND, 1e-9, `${tag} red ends 0.6 inside the right cube edge`); if (f.c === 6) near(rb.x, 3.7, 1e-9, `${tag} red ends at x = 3.7 (literal)`); else assert.equal(cell.x1, g.W);
    }
  }
});

test("the left and right margins: 0.8 white in every row (cube edge -4.3 .. -3.5 and 3.5 .. 4.3), 0.6 in the month row (the banner sticks out 0.2 beyond the grid)", () => {
  for (const f of FRONT.filter((x) => x.c === 0 || x.c === 6)) {
    const g = tileGrid(f.tile), cell = DRAWINGS.font(f).rects[1]; // [0] is the white ground, [1] the fill of the cell or banner
    const edge = f.c === 0 ? f.center.x - F / 2 : f.center.x + F / 2;
    const inner = f.c === 0 ? scene(f, cell.x0, 0).x : scene(f, cell.x1, 0).x;
    near(Math.abs(inner - edge), f.r === 0 ? NAMES_MONTH_SIDE_BAND : BAND, 1e-9, `row ${f.r} column ${f.c}: margin`);
    assert.equal(f.c === 0 ? g.cell.x0 > 0 : g.cell.x1 < g.W, true);
  }
});

test("digits and weekday words sit in the center of the unit cell of their tile, also on the outer cubies (font and built-in drawing)", () => {
  for (const [name, draw] of Object.entries(DRAWINGS)) for (const f of FRONT) {
    if (f.r === 0 || f.text === "" || /^[0-9]+\/[0-9]+$/.test(f.text)) continue;
    const texts = draw(f).texts, weekday = f.r === 1; // the weekday words sit NAMES_WEEKDAY_DOWN below the cell center
    assert.ok(texts.length > 0, `${name} (${f.c},${f.r}) "${f.text}" draws text`);
    const cx = texts.reduce((s, t) => s + runAt(name, f, t).x, 0) / texts.length, want = cellCenter(f);
    // the built-in drawing centers the text by the middle baseline (0.04 em lower)
    near(cx, want.x, 0.06, `${name} (${f.c},${f.r}) "${f.text}" x`); // the mean of the run centers is not the ink center of a word of unequal letters
    for (const t of texts) { const s = runAt(name, f, t); assert.ok(Math.abs(s.x - want.x) < 0.5 && Math.abs(s.y - want.y) < 0.5, `${name} (${f.c},${f.r}) "${f.text}" run inside its cell (${s.x}, ${s.y})`); }
    const cy = texts.reduce((s, t) => s + runAt(name, f, t).y, 0) / texts.length;
    if (name === "font") near(cy, want.y - (weekday ? NAMES_WEEKDAY_DOWN : 0), 0.06, `${name} (${f.c},${f.r}) "${f.text}" y`); // the built-in drawing anchors on a baseline (6 and 9)
  }
});

test("Saturday/Sunday tint: only the unit cell is tinted (column 1 and 7 included), the band stays white; the weekday line spans the unit cell width", () => {
  const tinted = FRONT.filter((f) => tileRoles(PAPER_RED, f.text, f.ink, "names").fill === PAPER_RED.weekendTint);
  assert.ok(tinted.length >= 6, `${tinted.length} tinted cells`);
  assert.ok(tinted.some((f) => f.c === 0) && tinted.some((f) => f.c === 6), "tint in column 1 and in column 7");
  for (const f of tinted.filter((x) => x.c === 0 || x.c === 6)) {
    const r = DRAWINGS.font(f).rects, g = tileGrid(f.tile);
    assert.equal(r[0].fill, NAMES_WHITE);
    assert.equal(r[1].fill, PAPER_RED.weekendTint);
    assert.ok(r[1].x1 - r[1].x0 < g.W, "the tint does not cover the band");
    near((r[1].x1 - r[1].x0) / g.px, f.c === 0 || f.c === 6 ? 1 - 0.5 * 0.0 : 1, 0.05, "the tint is about one unit wide");
  }
  // the weekday row: line over the unit cell width
  for (const f of FRONT.filter((x) => x.r === 1)) {
    const g = tileGrid(f.tile), r = DRAWINGS.font(f).rects, line = r.at(-1);
    assert.equal(line.fill, PAPER_RED.lineRow2.color, `weekday (${f.c}) has the line`);
    assert.equal(line.x0, g.cell.x0); assert.equal(line.x1, g.cell.x1);
    if (f.c === 0) assert.ok(line.x0 > 0); if (f.c === 6) assert.ok(line.x1 < g.W);
    near(scene(f, line.x1, 0).x - scene(f, line.x0, 0).x, 1, 0.05, "about a unit wide");
  }
});

test("the month name sits in the upper part of the red banner: more red above than below (2:1 of the free height) in all 14 fonts, and the name is inside the banner", () => {
  for (const [id, font] of Object.entries(FONT_METRICS)) {
    const table = nameFaceTable(font), banner = monthBanner();
    near(table.bannerHeight, 1.0, 1e-12, id);
    const tops = [], bottoms = [];
    for (const word of ["J", "ANU", "ARY", "NOV", "EMB", "DEC", "SEP", "AUG", "UST"]) for (const l of nameLabelLayout(word, font, "face")) {
      const above = (l.box.y0 - (96 - banner.top * PPU)) / PPU, below = ((96 - banner.bottom * PPU) - l.box.y1) / PPU; // units of red above and below this glyph
      assert.ok(above > 0.2 && below > 0.1, `${id} ${word} ${l.text}: red above ${above}, below ${below}`);
      assert.ok(above > below * 1.4, `${id} ${word} ${l.text}: clearly more red above (${above.toFixed(3)}) than below (${below.toFixed(3)})`);
      tops.push(l.box.y0); bottoms.push(l.box.y1);
    }
    const aboveAll = (Math.min(...tops) - (96 - banner.top * PPU)) / PPU, belowAll = ((96 - banner.bottom * PPU) - Math.max(...bottoms)) / PPU;
    near(aboveAll / belowAll, 2, 0.15, `${id}: above:below of the tallest ink over the name tiles is about 2:1 (${aboveAll.toFixed(3)} : ${belowAll.toFixed(3)})`);
    // the center line follows the formula and is one value for all tiles and months
    near(table.centerUp, nameCenterUp(Math.max(...tops.map((_, k) => bottoms[k] - tops[k])) / PPU), 0.03, id);
  }
});

test("month name on the real front: ink inside the red banner (front projection, scene units), 2:1, the red banner 0.4 inside the top and bottom of its row; font and built-in drawing", () => {
  const first = FRONT.filter((f) => f.r === 0 && f.text !== "");
  assert.ok(first.length >= 2, "a month name of at least two tiles");
  for (const [name, draw] of Object.entries(DRAWINGS)) for (const f of first) {
    const texts = draw(f).texts, y = texts.map((t) => runAt(name, f, t).y);
    for (const v of y) assert.ok(v < 3.9 && v > 2.9, `${name} ${f.text}: letter center ${v} inside the banner 2.9 .. 3.9`);
    const above = 3.9 - Math.max(...y), below = Math.min(...y) - 2.9;
    assert.ok(above > below, `${name} ${f.text}: red above ${above.toFixed(3)} vs below ${below.toFixed(3)}`);
  }
});

test("the weekday line sits at the bottom of the red banner for schemes with a line under the month row (paper-blue), the weekday line at the bottom of its flat face", () => {
  const blue = SCHEMES.find((s) => s.lineRow1);
  assert.ok(blue, "a scheme with lineRow1");
  for (const f of FRONT.filter((x) => x.r === 0 && x.text !== "")) {
    const r = track((c) => drawFontSticker(c, f.text, f.ink, NOTO, blue, "face", undefined, "names", f.tile)).rects, line = r.at(-1), g = tileGrid(f.tile);
    assert.equal(line.fill, blue.lineRow1.color);
    near(line.y1, g.banner.y1, 1e-9, "the line ends at the bottom of the banner");
    assert.equal(line.x0, g.banner.x0); assert.equal(line.x1, g.banner.x1); // the month line spans the banner (one line over the seven columns)
  }
});

test("other schemes follow the same geometry: ground is the scheme's day ground, the banner the band fill (or the day ground); every scheme, every front tile", () => {
  for (const scheme of SCHEMES) for (const f of FRONT) {
    const roles = tileRoles(scheme, f.text, f.ink, "names"), r = DRAWINGS.font(f), g = tileGrid(f.tile);
    const rects = track((c) => drawFontSticker(c, f.text, f.ink, NOTO, scheme, "face", undefined, "names", f.tile)).rects;
    if (f.tile.band.l + f.tile.band.r + f.tile.band.t + f.tile.band.b === 0) { assert.equal(rects[0].fill, roles.fill); continue; }
    assert.equal(rects[0].fill, namesGround(scheme.dayFill), `${scheme.id} (${f.c},${f.r}) ground`);
    assert.equal(rects[1].fill, roles.fill, `${scheme.id} (${f.c},${f.r}) fill`);
    if (f.r === 0) near(rects[1].y1 - rects[1].y0, 1.0 * g.py, 1e-9, `${scheme.id} banner`);
    void r;
  }
});

test("labelLayout of digits is the cell frame: the same box on every tile (no shift for a thick outer cubie)", () => {
  const box = labelLayout("28", NOTO)[0].box;
  assert.ok(Math.abs((box.x0 + box.x1) / 2 - 96) < 1e-9 && Math.abs((box.y0 + box.y1) / 2 - 96) < 1e-9);
});

/** Color of a point of a tile as drawn (painter's algorithm over the recorded fills). */
const colorAtPx = (rects, x, y) => [...rects].reverse().find((r) => x >= r.x0 && x < r.x1 && y >= r.y0 && y < r.y1)?.fill;
const stopColor = (spec, t) => (typeof spec === "string" ? spec : spec.find((s) => t <= s.to).color);

test("tileEdgeColors: along every edge of every front tile the color is the color the drawing has at that edge (red band, white strips, tint, white margins), all 10 schemes", () => {
  let samples = 0;
  for (const scheme of SCHEMES) for (const f of FRONT) {
    const ground = namesGround(scheme.dayFill), roles = tileRoles(scheme, f.text, f.ink, "names"), g = tileGrid(f.tile);
    const all = track((c) => drawFontSticker(c, f.text, f.ink, NOTO, scheme, "face", undefined, "names", f.tile)).rects;
    const rects = all; // the scheme line is the last fill: it is part of the color of the edge where it reaches it
    const edges = tileEdgeColors(roles, ground, f.tile);
    for (const edge of ["left", "right", "top", "bottom"]) {
      const spec = edges?.[edge] ?? roles.fill;
      for (let k = 1; k < 100; k++) {
        const t = k / 100, vertical = edge === "left" || edge === "right";
        if (typeof spec !== "string" && spec.some((x) => Math.abs(x.to - t) < 0.015)) continue; // the pixel of a boundary is either color
        // 1.5 px inside the edge; vertical edges run bottom to top, horizontal ones left to right
        const px = vertical ? (edge === "left" ? 1.5 : g.W - 1.5) : t * g.W, py = vertical ? (1 - t) * g.H : edge === "top" ? 1.5 : g.H - 1.5;
        assert.equal(stopColor(spec, t), colorAtPx(rects, px, py), `${scheme.id} (${f.c},${f.r}) "${f.text}" ${edge} at ${t}`);
        samples++;
      }
    }
  }
  assert.ok(samples > 100000, `${samples} samples`);
});

test("owner decisions as literals: month row banner 0.4 top strip, 0.4 bottom strip, 0.6 side band, weekday words 0.08 lower, square banner corners", async () => {
  const g = await import("../src/apps/calendar7/geometry.ts");
  assert.equal(g.NAMES_TOP_STRIP, 0.4);
  assert.equal(g.NAMES_BOTTOM_STRIP, 0.4);
  assert.equal(g.NAMES_MONTH_SIDE_BAND, 0.6);
  assert.equal(g.NAMES_WEEKDAY_DOWN, 0.08);
  assert.equal(g.NAMES_BANNER_RADIUS, 0);
});

test("weekday line: the cut faces beside every weekday tile carry the line color at the height of the line where the line reaches the tile edge (one continuous line over the seams), all schemes with a line", () => {
  let checked = 0;
  for (const scheme of SCHEMES) {
    for (const f of FRONT.filter((x) => x.r === 1)) {
      const roles = tileRoles(scheme, f.text, f.ink, "names"), g = tileGrid(f.tile), e = tileEdgeColors(roles, namesGround(scheme.dayFill), f.tile);
      if (!roles.line) continue;
      const colors = (spec) => (typeof spec === "string" ? [spec] : spec.map((x) => x.color));
      const lineAt = (spec) => typeof spec !== "string" && spec.some((x) => x.color === roles.line.color);
      if (f.c !== 0) { assert.ok(lineAt(e.left), `${scheme.id} (${f.c}) left edge has the line`); checked++; } else assert.equal(colors(e.left).includes(roles.line.color), false, "column 1: the band side is white");
      if (f.c !== 6) { assert.ok(lineAt(e.right), `${scheme.id} (${f.c}) right edge has the line`); checked++; } else assert.equal(colors(e.right).includes(roles.line.color), false, "column 7: the band side is white");
      void g;
    }
  }
  assert.ok(checked >= 5 * 8, `${checked} edges checked`);
});
