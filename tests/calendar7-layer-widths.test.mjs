// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout with thick outer layers (owner decision 2026-11-10, A+B): the f table, the physical edge and the
// gap, the tile of every face (1.6 x 1.6 corners, 1 x 1.6 ring pieces, 1 x 1 inner), the art drawn per tile at 192 px per unit
// (letters on the uniform 1/3-unit pitch, centered in the taller tile, the weekday line across the whole tile), and the layer
// turns on the real print. The viewer wiring (profile on for the names layout only) is tests/browser/calendar7-names-mode.spec.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import * as THREE from "three";
import { RoundedBoxGeometry } from "three/addons/geometries/RoundedBoxGeometry.js";
import { PhysicalCubeScene, PRESENTATION_PRESET, createPlasticMaterial, createPresentationGeometry, thickOuterLayerWidths } from "@cubistry/cube-viewer";
import {
  BODY_RADIUS, CALENDAR7_SIZE, CUBE_EDGE_MM_7X7, INNER_CUBIE_EDGE_MM, NAMES_CUBE_EDGE, NAMES_FACE_PX_PER_UNIT, NAMES_GAP, NAMES_GAP_MM,
  OUTER_LAYER_WIDTH, bodyWidthFor, faceFlatShare, facePixelsPerUnit, faceTileOf, halfEdgeOf, layerWidthsFor, layerWidthsOf, namesBodySize, outerLayerWidth,
} from "../src/apps/calendar7/geometry.ts";
import { NAME_WORDS, nameAnchor, nameSlotOffset, nameTileShift } from "../src/apps/calendar7/layout.ts";
import { FACE_SCALE, TEXTURE, drawFace, faceTransform, lineRect, nameLetterX, tileCanvasSize } from "../src/apps/calendar7/sticker-art.ts";
import { drawFontSticker, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { SCHEMES } from "../src/apps/calendar7/schemes.ts";
import { STICKERS, applyMoves } from "../src/apps/calendar7/engine.ts";
import { parseState } from "../src/apps/calendar7/graph.ts";
import { layerProfileFor } from "../src/apps/calendar7/viewer.ts";

const near = (a, b, eps = 1e-9, what = "") => assert.ok(Math.abs(a - b) <= eps, `${what} ${a} != ${b}`);
const F = 1.6;
const PAPER_RED = SCHEMES.find((s) => s.id === "paper-red");

// ---- the table, the edge and the gap ----
test("outer layer widths: the one table (N = 2, 3, 4: 1; N = 5: 1.1; N = 6: 1.3; N = 7: 1.6, owner decision 2026-11-11) and the widths [f, 1, ..., 1, f]", () => {
  assert.deepEqual({ ...OUTER_LAYER_WIDTH }, { 2: 1, 3: 1, 4: 1, 5: 1.1, 6: 1.3, 7: 1.6 });
  for (let n = 2; n <= 7; n++) assert.deepEqual(layerWidthsFor(n), thickOuterLayerWidths(n, outerLayerWidth(n)), `N = ${n}`);
  assert.deepEqual(layerWidthsFor(7), [1.6, 1, 1, 1, 1, 1, 1.6]);
  assert.deepEqual(layerWidthsFor(3), [1, 1, 1]);
  assert.throws(() => outerLayerWidth(8));
  assert.equal(CALENDAR7_SIZE, 7);
  assert.equal(BODY_RADIUS, PRESENTATION_PRESET.bodyRadius);
});
test("names layout: edge (N - 2) + 2 f = 8.2 units = 66.5 mm, inner cubie 8.1098 mm, gap 0.01 mm = 0.0012331 units; the standard layout has no profile and the 3.5 half edge", () => {
  near(NAMES_CUBE_EDGE, 8.2, 1e-12);
  assert.equal(CUBE_EDGE_MM_7X7, 66.5);
  near(INNER_CUBIE_EDGE_MM, 66.5 / 8.2, 1e-12);
  near(INNER_CUBIE_EDGE_MM, 8.1098, 1e-4);
  assert.equal(NAMES_GAP_MM, 0.01);
  near(NAMES_GAP, 0.01 / (66.5 / 8.2), 1e-15);
  near(NAMES_GAP, 0.0012331, 1e-7);
  assert.deepEqual(layerWidthsOf("names"), [1.6, 1, 1, 1, 1, 1, 1.6]);
  assert.equal(layerWidthsOf("standard"), null);
  assert.equal(halfEdgeOf("standard"), 3.5);
  near(halfEdgeOf("names"), 4.1, 1e-12);
  assert.equal(bodyWidthFor("standard"), 0.99);
  near(bodyWidthFor("names"), 1 - NAMES_GAP, 1e-15);
  const [x, y, z] = namesBodySize([1.6, 1, 1.6]);
  near(x, 1.6 - NAMES_GAP, 1e-15); near(y, 1 - NAMES_GAP, 1e-15); near(z, x, 1e-15);
});

// ---- the tile of a face ----
test("faceTileOf: corner 1.6 x 1.6, ring piece on a face 1 x 1.6 (width along sticker right, height along up), inner 1 x 1, from any face", () => {
  const FRONT = { n: [0, 0, 1], up: [0, 1, 0] }, TOP = { n: [0, 1, 0], up: [0, 0, -1] }, RIGHT = { n: [1, 0, 0], up: [0, 1, 0] };
  const w = layerWidthsFor(7);
  const tile = (p, f) => faceTileOf(p, f.n, f.up, w);
  assert.deepEqual(tile([-3, 3, 3], FRONT), { w: F, h: F }, "front corner");
  assert.deepEqual(tile([0, 3, 3], FRONT), { w: 1, h: F }, "row 1 ring piece: 1 wide, 1.6 tall");
  assert.deepEqual(tile([3, 1, 3], FRONT), { w: F, h: 1 }, "column 7 ring piece: 1.6 wide, 1 tall");
  assert.deepEqual(tile([1, -1, 3], FRONT), { w: 1, h: 1 }, "inner");
  assert.deepEqual(tile([0, 3, 3], TOP), { w: 1, h: F }, "the same piece on its top face: right = x (1), up = -z (outer layer 1.6)");
  assert.deepEqual(tile([3, 0, 3], RIGHT), { w: F, h: 1 }, "right face: right = -z (outer), up = y (inner)");
  assert.throws(() => faceTileOf([4, 0, 0], FRONT.n, FRONT.up, w));
});
test("nameAnchor: the first tile of a word is anchored right, the last left, the middle (and none) at the center; it follows the width of a thick tile", () => {
  for (const word of NAME_WORDS) word.forEach((tile, k) => assert.equal(nameAnchor(tile), k === 0 ? 1 : k === word.length - 1 ? -1 : 0, `${word} ${tile}`));
  assert.equal(nameTileShift("SEP", 1), 0);
  near(nameTileShift("SEP", F), 0.3, 1e-12);
  near(nameTileShift("ARY", F), -0.3, 1e-12);
  assert.equal(nameTileShift("EMB", F), 0);
  assert.equal(nameTileShift("", F), 0);
});

// ---- pixels per unit on the real body geometry, rectangular faces included ----
test("facePixelsPerUnit / faceFlatShare match the real body geometry for every tile size (uv extent of the flat part, both axes)", () => {
  for (const wx of [1, 1.2, 1.5, 1.8]) for (const wy of [1, 1.8]) {
    const [sx, sy] = [wx - NAMES_GAP, wy - NAMES_GAP];
    const g = new RoundedBoxGeometry(sx, sy, sx, 1, PRESENTATION_PRESET.bodyRadius);
    const pos = g.getAttribute("position"), uv = g.getAttribute("uv"), nor = g.getAttribute("normal");
    // front face (+z): u along x, v along y
    const flat = { u0: Infinity, u1: -Infinity, x0: Infinity, x1: -Infinity, v0: Infinity, v1: -Infinity, y0: Infinity, y1: -Infinity };
    for (let i = 0; i < pos.count; i++) if (Math.abs(nor.getZ(i) - 1) < 1e-6 && Math.abs(pos.getZ(i) - sx / 2) < 1e-6) {
      flat.u0 = Math.min(flat.u0, uv.getX(i)); flat.u1 = Math.max(flat.u1, uv.getX(i)); flat.x0 = Math.min(flat.x0, pos.getX(i)); flat.x1 = Math.max(flat.x1, pos.getX(i));
      flat.v0 = Math.min(flat.v0, uv.getY(i)); flat.v1 = Math.max(flat.v1, uv.getY(i)); flat.y0 = Math.min(flat.y0, pos.getY(i)); flat.y1 = Math.max(flat.y1, pos.getY(i));
    }
    const [W, H] = tileCanvasSize({ w: wx, h: wy });
    // The geometry's own flat extent (the vertices on the face plane): pixels over the full uv range (1) vs the flat part
    const flatW = flat.x1 - flat.x0, flatH = flat.y1 - flat.y0;
    near(W * (flat.u1 - flat.u0) / flatW, facePixelsPerUnit(wx, W), 0.05, `px/unit x of ${wx}`);
    near(H * (flat.v1 - flat.v0) / flatH, facePixelsPerUnit(wy, H), 0.05, `px/unit y of ${wy}`);
    near(flat.u1 - flat.u0, faceFlatShare(wx), 1e-6, `flat share x of ${wx}`);
    near(flat.v1 - flat.v0, faceFlatShare(wy), 1e-6, `flat share y of ${wy}`);
  }
  near(NAMES_FACE_PX_PER_UNIT, facePixelsPerUnit(1, 192), 1e-12);
});

// ---- the art per tile ----
/** A 2D context that applies translate and scale to what it records (the final canvas pixel of every fillRect and fillText). */
function track(draw) {
  let m = { a: 1, d: 1, e: 0, f: 0 }; const stack = [], rects = [], texts = [], state = { font: "", fill: "" };
  const ctx = {
    set fillStyle(v) { state.fill = v; }, get fillStyle() { return state.fill; },
    set font(v) { state.font = v; }, get font() { return state.font; },
    set fontKerning(v) {}, set textAlign(v) {}, set textBaseline(v) {},
    fillRect(x, y, w, h) { rects.push({ fill: state.fill, x: m.e + m.a * x, y: m.f + m.d * y, w: m.a * w, h: m.d * h }); },
    fillText(t, x, y) { texts.push({ t, x: m.e + m.a * x, y: m.f + m.d * y, fill: state.fill }); },
    measureText: (t) => ({ width: Number(state.font.match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
    save() { stack.push({ ...m }); }, restore() { m = stack.pop(); },
    translate(x, y) { m = { ...m, e: m.e + m.a * x, f: m.f + m.d * y }; }, scale(x, y) { m = { ...m, a: m.a * x, d: m.d * y }; }, rotate() { throw new Error("no rotation expected"); },
  };
  draw(ctx);
  return { rects, texts };
}
const glyphs = Object.fromEntries([..."0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"].map((c) => {
  const w = c === "M" || c === "W" ? 0.86 : c === "I" || c === "J" ? 0.24 : 0.55;
  return [c, { advance: w + 0.08, left: 0.04, right: 0.04 + w, top: -0.714, bottom: 0 }];
}));
const font = { style: { id: "test", weight: 600, master: "6" }, family: "test", glyphs, dateSize: 100 };
const TILES = { corner: { w: F, h: F }, ring: { w: 1, h: F }, side: { w: F, h: 1 }, inner: { w: 1, h: 1 } };

test("texture sizes: 192 px per unit of width, a (192 w) x (192 h) canvas per tile (corner, ring, side, inner); no tile is the historical 192 x 192", () => {
  assert.deepEqual(tileCanvasSize(), [192, 192]);
  assert.deepEqual(tileCanvasSize(TILES.inner), [192, 192]);
  assert.deepEqual(tileCanvasSize(TILES.corner), [307, 307]);
  assert.deepEqual(tileCanvasSize(TILES.ring), [192, 307]);
  assert.deepEqual(tileCanvasSize(TILES.side), [307, 192]);
  for (const [name, tile] of Object.entries(TILES)) {
    const [W, H] = tileCanvasSize(tile);
    const face = track((c) => drawFace(c, "28", "red", "strict", PAPER_RED, "names", tile));
    assert.deepEqual([face.rects[0].x, face.rects[0].y, face.rects[0].w, face.rects[0].h], [0, 0, W, H], `${name}: the ground covers the whole canvas`);
    const font2 = track((c) => drawFontSticker(c, "28", "red", font, PAPER_RED, "face", undefined, "names", tile));
    assert.deepEqual([font2.rects[0].x, font2.rects[0].y, font2.rects[0].w, font2.rects[0].h], [0, 0, W, H]);
  }
});

test("a 1 x 1 tile draws what the no-tile drawing draws; the standard layout and the sheet ignore the tile", () => {
  // The no-tile drawing paints the ground a second time over the scaled sticker square (same color); a tile of the names layout does not: those repaints are not compared.
  const strip = (r) => JSON.stringify({ ...r, rects: r.rects.filter((x, i) => i === 0 || x.fill !== r.rects[0].fill) }, (k, v) => (typeof v === "number" ? Math.round(v) : v)); // whole pixels: the flat share of the real 1 x 1 face (0.9112) differs from the old constant FACE_FLAT (0.9106) by 0.08 px
  for (const [text, ink] of [["28", "red"], ["", "blank"]]) { // not a month tile (its banner is tests/calendar7-unit-grid.test.mjs) and not a weekday word (it sits NAMES_WEEKDAY_DOWN lower on a tile): its banner (strips, name in the upper part) is tests/calendar7-unit-grid.test.mjs
    assert.equal(strip(track((c) => drawFace(c, text, ink, "strict", PAPER_RED, "names", TILES.inner))), strip(track((c) => drawFace(c, text, ink, "strict", PAPER_RED, "names"))));
    assert.equal(strip(track((c) => drawFace(c, text, ink, "strict", PAPER_RED, "standard", TILES.corner))), strip(track((c) => drawFace(c, text, ink, "strict", PAPER_RED, "standard"))));
    assert.equal(strip(track((c) => drawFontSticker(c, text, ink, font, PAPER_RED, "sticker", undefined, "names", TILES.corner))), strip(track((c) => drawFontSticker(c, text, ink, font, PAPER_RED, "sticker", undefined, "names"))));
  }
  const t = faceTransform();
  assert.deepEqual([t.cx, t.cy, t.kx, t.ky], [96, 96, FACE_SCALE, FACE_SCALE]);
  const u = faceTransform(TILES.inner);
  near(u.kx, FACE_SCALE, 1e-9); near(u.cx, 96, 1e-12);
});

test("the weekday line spans the full width of every tile, 1.5 times as thick, at the bottom edge of the flat part of the tile", () => {
  const line = { px: 3, color: "#1558d8" };
  for (const [name, tile] of Object.entries(TILES)) {
    const [W, H] = tileCanvasSize(tile), r = lineRect(line, "names", true, tile);
    assert.equal(r.x, 0, name); assert.equal(r.w, W, name);
    near(r.h, 3 * 4 * 1.5, 1e-12);
    near(r.y + r.h, H * (1 + faceFlatShare(tile.h)) / 2, 1e-9, `${name}: bottom of the flat face`);
    assert.ok(r.y + r.h < H && r.y > H / 2);
  }
  // drawn through drawFace of a weekday tile: the last rect is the line
  const w = track((c) => drawFace(c, "MON", "weekday", "strict", PAPER_RED, "names", TILES.side));
  const last = w.rects[w.rects.length - 1];
  assert.equal(last.w, 307);
  assert.equal(last.x, 0);
  // The sheet and the 1x1 default are unchanged
  assert.deepEqual(lineRect(line, "names", true), { x: 0, y: 192 * (1 + 0.9106) / 2 - 12 * 1.5, w: 192, h: 18 });
});

/** On the one slot grid: letters of a word over its tiles placed in a row (column 1 is a corner of width f with a band on the left, the others width 1). */
function letterCenters(word, draw) {
  const widths = word.map((_, k) => (k === 0 ? F : 1));
  const centers = [];
  let at = 0; // the left edge of the tile in units
  word.forEach((tile, k) => {
    const w = widths[k], t = { w, h: F, band: { l: k === 0 ? F - 1 : 0, r: 0, t: F - 1, b: 0 } }, [W] = tileCanvasSize(t), ppx = facePixelsPerUnit(w, W);
    for (const x of draw(tile, t)) centers.push(at + w / 2 + (x - W / 2) / ppx);
    at += w;
  });
  return centers;
}
test("names letters keep the uniform 1/3-unit pitch over a word whose first tile is a corner of width 1.6 (its unit cell on the right, right-flush against its right edge), also across the tile boundaries", () => {
  for (const word of NAME_WORDS) {
    if (word.length < 2) continue;
    for (const draw of [
      (tile, t) => track((c) => drawFace(c, tile, "month", "strict", PAPER_RED, "names", t)).texts.map((x) => x.x),
    ]) {
      const xs = letterCenters(word, draw);
      for (let i = 1; i < xs.length; i++) near(xs[i] - xs[i - 1], 1 / 3, 0.004, `${word} letter ${i}`);
    }
  }
  // The same on the unit pitch: the corner tile "MA" of MARCH ends 1/6 before the shared edge, "RCH" starts 1/6 after it.
  const [ma, rch] = [nameLetterX("MA", 1, true), nameLetterX("RCH", 0, true)];
  near((ma - 96) / (NAMES_FACE_PX_PER_UNIT / FACE_SCALE), nameSlotOffset("MA", 1), 1e-9); // in the frame of the unit cell: no shift for the thick tile (the band is beside the cell)
  assert.ok(rch < 96);
});

test("letter and digit size in px per unit are the same in every tile (within 1.2 %, the arc-length mapping of a larger face)", () => {
  const size = (tile) => { const f = faceTransform(tile); return [f.kx, f.ky]; };
  const [innerX, innerY] = size(TILES.inner);
  for (const tile of [TILES.corner, TILES.ring, TILES.side]) {
    const [kx, ky] = size(tile), [W, H] = tileCanvasSize(tile);
    // final pixels per unit of the drawing are k * px/unit(1 x 1) / FACE_SCALE; that is the pixels per unit of the real face
    near(kx / FACE_SCALE * NAMES_FACE_PX_PER_UNIT, facePixelsPerUnit(tile.w, W), 1e-9);
    near(ky / FACE_SCALE * NAMES_FACE_PX_PER_UNIT, facePixelsPerUnit(tile.h, H), 1e-9);
    assert.ok(Math.abs(kx / innerX - 1) < 0.012 && Math.abs(ky / innerY - 1) < 0.012);
  }
});

// ---- layer turns on the real print: pivot rotation = engine pose, with the profile ----
const json = (p) => JSON.parse(readFileSync(p, "utf8"));
const { printing, pose: root } = parseState(json("public/calendar7/names/state.v1.json"));
const frames = (pose) => Array.from({ length: STICKERS }, (_, i) => ({ id: i + 1, cubie: printing.piece[i], p: [...pose.pos.slice(3 * i, 3 * i + 3)], n: [...pose.normal.slice(3 * i, 3 * i + 3)], up: [...pose.up.slice(3 * i, 3 * i + 3)] }));
test("names print on the profile: every layer turn (21 generators x 3 exponents, from a mixed pose) ends on the engine pose; the profile is symmetric so thick bodies stay in their layers", () => {
  const widths = layerWidthsFor(7), parent = new THREE.Group(), basic = new THREE.MeshStandardMaterial();
  const geometry = { ...createPresentationGeometry(), body: new RoundedBoxGeometry(1 - NAMES_GAP, 1 - NAMES_GAP, 1 - NAMES_GAP, 1, BODY_RADIUS) };
  const body = (cell) => new RoundedBoxGeometry(...namesBodySize(cell), 1, BODY_RADIUS);
  const scene = new PhysicalCubeScene(parent, frames(root), new Map(Array.from({ length: STICKERS }, (_, i) => [i + 1, basic])), createPlasticMaterial(), 1, geometry, new Map(), { layers: { widths, body } });
  const snapshot = () => { parent.updateMatrixWorld(true); const out = new Map(); parent.traverse((o) => { const s = o.children.find((c) => c.userData.stickerId !== undefined); if (s) out.set(s.userData.stickerId, o.matrixWorld.elements.slice()); }); return out; };
  const same = (a, b) => a.size === b.size && [...a].every(([id, e]) => e.every((x, k) => Math.abs(x - b.get(id)[k]) < 1e-6));
  // a mixed start: a few moves from the root
  let start = root;
  for (const m of [[1, 1], [10, -1], [18, 2], [5, 1], [12, 1]]) start = applyMoves(start, [m]);
  let n = 0;
  for (let g = 1; g <= 21; g++) for (const q of [1, -1, 2]) {
    scene.sync(frames(start));
    const axis = Math.floor((g - 1) / 7), layer = [-3, -2, -1, 1, 2, 3, 99][(g - 1) % 7], whole = layer === 99;
    const pieces = new Set();
    for (let i = 0; i < STICKERS; i++) if (whole || start.pos[3 * i + axis] === layer) pieces.add(printing.piece[i]);
    const turn = scene.beginTurn([...pieces], axis, (q * Math.PI) / 2);
    turn.update(1);
    const atEnd = snapshot();
    turn.dispose();
    scene.sync(frames(applyMoves(start, [[g, q]])));
    assert.ok(same(atEnd, snapshot()), `generator ${g} quarter ${q}`);
    n++;
  }
  assert.equal(n, 63);
});

test("viewer profile: the bevel radius is the preset 0.055 on a body of every size (not scaled with the cubie)", () => {
  const profile = layerProfileFor("names");
  assert.deepEqual(profile.widths, layerWidthsFor(7));
  assert.equal(layerProfileFor("standard"), undefined);
  for (const cell of [[1, 1, 1], [1.8, 1, 1], [1, 1.8, 1.8], [1.8, 1.8, 1.8]]) {
    const g = profile.body(cell), p = g.parameters;
    assert.equal(p.radius, PRESENTATION_PRESET.bodyRadius, `radius of ${cell}`);
    near(p.width, cell[0] - NAMES_GAP, 1e-12); near(p.height, cell[1] - NAMES_GAP, 1e-12); near(p.depth, cell[2] - NAMES_GAP, 1e-12);
    g.computeBoundingBox();
    const box = g.boundingBox;
    near(box.max.x - box.min.x, cell[0] - NAMES_GAP, 1e-6);
  }
});
