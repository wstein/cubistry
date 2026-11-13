// SPDX-License-Identifier: AGPL-3.0-or-later
// Calendar7 names layout, option 4 (owner decision of 2026-11-11): one glyph size per font, uniform extra tracking per tile,
// every seam between two name tiles in the middle of the gap between their letters. Real glyph metrics of all 14 shipped
// fonts (tests/calendar7-font-metrics.mjs), no mock font. Unit grid (owner decision of 2026-11-11): every name tile has one
// unit of content (the first tile sits on the corner cubie of column 1 with a white band on its left), the names sit in
// the red banner of the month row (tests/calendar7-unit-grid.test.mjs).
import { test } from "node:test";
import assert from "node:assert/strict";
import { NAME_WORDS } from "../src/apps/calendar7/layout.ts";
import { faceTransform, namePxPerUnit, tileGrid } from "../src/apps/calendar7/sticker-art.ts";
import { labelLayout, nameFaceTable, nameLabelLayout } from "../src/apps/calendar7/font-art.ts";
import { outerLayerWidth, CALENDAR7_SIZE, monthBanner, NAMES_BANNER_OVERHANG } from "../src/apps/calendar7/geometry.ts";
import { FONT_METRICS } from "./calendar7-font-metrics.mjs";

const PPU = namePxPerUnit();
const F = outerLayerWidth(CALENDAR7_SIZE);
const MONTHS = ["JANUARY", "FEBRUARY", "MARCH", "APRIL", "MAY", "JUNE", "JULY", "AUGUST", "SEPTEMBER", "OCTOBER", "NOVEMBER", "DECEMBER"];
const WEEKDAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
const IDS = Object.keys(FONT_METRICS);
const MIN_GAP = 2;
// The tiles of the month row on the unit grid: the first one is the corner cubie of column 1 (band on the left and on top),
// the others are ring cubies (band on top); every tile has one unit of content.
const BAND = F - 1;
const tileOf = (k) => (k === 0 ? { w: F, h: F, band: { l: BAND, r: 0, t: BAND, b: 0 } } : { w: 1, h: F, band: { l: 0, r: 0, t: BAND, b: 0 } });
/** Room of a tile in drawing px from the center of its unit cell: texture edge, or the edge of the red banner on a side with a band; up/down: the red banner. */
const edge = (k) => {
  const g = tileGrid(tileOf(k)), kx = faceTransform(tileOf(k)).kx, b = monthBanner();
  return { left: k === 0 ? (NAMES_BANNER_OVERHANG + 0.5) * PPU : g.cx / kx, right: (g.W - g.cx) / kx, top: b.top * PPU, bottom: -b.bottom * PPU };
};

/** Absolute x (drawing px, the first seam at 0) of every letter box of a month, per tile, plus the seam positions: every tile is one unit wide. */
function month(font, word) {
  const seams = word.slice(1).map((_, k) => k * PPU);
  const tiles = word.map((label, k) => {
    const center = (k - 0.5) * PPU;
    const boxes = nameLabelLayout(label, font, "face").map((l) => ({ ...l, x0: center + l.box.x0 - 96, x1: center + l.box.x1 - 96 }));
    return { label, center, boxes, lo: center - (k === 0 ? NAMES_BANNER_OVERHANG + 0.5 : 0.5) * PPU, hi: center + PPU / 2 }; // the banner starts 0.4 inside the cube edge
  });
  return { tiles, seams };
}
const seamGaps = (m) => m.seams.map((s, k) => { const r = Math.max(...m.tiles[k].boxes.map((b) => b.x1)), l = Math.min(...m.tiles[k + 1].boxes.map((b) => b.x0)); return { seam: s, l: r, r: l, gap: l - r, mid: (r + l) / 2 }; });
const weekdaySize = (font) => Math.max(...WEEKDAYS.map((d) => labelLayout(d, font)[0].size));

test("name layout: every seam sits in the middle of the gap, for all 12 months and all 14 fonts", () => {
  for (const id of IDS) for (const [i, word] of NAME_WORDS.entries()) {
    const m = month(FONT_METRICS[id], word);
    for (const g of seamGaps(m)) assert.ok(Math.abs(g.mid - g.seam) < 0.05, `${id} ${MONTHS[i]}: seam ${g.seam.toFixed(2)} gap middle ${g.mid.toFixed(2)}`);
  }
});

test("name layout: no glyph straddles a seam and every seam gap is open", () => {
  for (const id of IDS) for (const [i, word] of NAME_WORDS.entries()) {
    const m = month(FONT_METRICS[id], word);
    m.tiles.forEach((t) => t.boxes.forEach((b) => assert.ok(b.x0 >= t.lo - 1e-9 && b.x1 <= t.hi + 1e-9, `${id} ${MONTHS[i]} ${t.label} ${b.text} [${b.x0.toFixed(1)}, ${b.x1.toFixed(1)}] outside its tile [${t.lo.toFixed(1)}, ${t.hi.toFixed(1)}]`)));
    for (const g of seamGaps(m)) assert.ok(g.gap > MIN_GAP, `${id} ${MONTHS[i]} seam gap ${g.gap}`);
  }
});

test("name layout: the seam gap is one value per font (equal over all months and seams)", () => {
  for (const id of IDS) {
    const gaps = NAME_WORDS.flatMap((word) => seamGaps(month(FONT_METRICS[id], word)).map((g) => g.gap));
    assert.ok(Math.max(...gaps) - Math.min(...gaps) < 0.05, `${id}: seam gaps ${Math.min(...gaps)} .. ${Math.max(...gaps)}`);
    assert.ok(Math.abs(gaps[0] - nameFaceTable(FONT_METRICS[id]).seamGap) < 0.05, `${id}: table seam gap`);
  }
  const noto = nameFaceTable(FONT_METRICS.noto).seamGap;
  assert.ok(noto > 9.5 && noto < 12.5, `Noto seam gap ${noto} is about 11 px`);
});

test("name layout: nothing is clipped at the texture edge or at the edge of the red banner (bevel reach allowed, 1.5 px margin), horizontally and vertically", () => {
  for (const id of IDS) for (const word of NAME_WORDS) for (const [k, label] of word.entries()) {
    const e = edge(k);
    for (const l of nameLabelLayout(label, FONT_METRICS[id], "face")) {
      const m = nameFaceTable(FONT_METRICS[id]).seamGap / 2; // the ink of the first tile keeps half a seam gap from the red banner edge, the last 1.5 px from the texture edge
      assert.ok(l.box.x0 >= 96 - e.left + (k === 0 ? m : 1.5) - 1e-9 && l.box.x1 <= 96 + e.right - 1.5 + 1e-9, `${id} ${label} ${l.text}: x ${l.box.x0}..${l.box.x1} vs edge ${96 - e.left}..${96 + e.right}`);
      assert.ok(l.box.y0 >= 96 - e.top + 1.5 - 1e-9 && l.box.y1 <= 96 + e.bottom - 1.5 + 1e-9, `${id} ${label} ${l.text}: y ${l.box.y0}..${l.box.y1} vs banner ${96 - e.top}..${96 + e.bottom}`);
    }
  }
});

test("name layout: one glyph size per font for every name tile", () => {
  for (const id of IDS) {
    const sizes = new Set(NAME_WORDS.flat().flatMap((label) => nameLabelLayout(label, FONT_METRICS[id], "face").map((l) => l.size)));
    assert.equal(sizes.size, 1, id);
    assert.equal([...sizes][0], nameFaceTable(FONT_METRICS[id]).size, id);
  }
});

test("name layout: the month letters are at least as large as the weekday letters (Noto: larger), fonts below it are listed with their blocking tile", () => {
  const noto = nameFaceTable(FONT_METRICS.noto);
  assert.ok(noto.size > weekdaySize(FONT_METRICS.noto) + 10, `Noto month ${noto.size} vs weekday ${weekdaySize(FONT_METRICS.noto)}`);
  for (const id of IDS) {
    const t = nameFaceTable(FONT_METRICS[id]);
    assert.equal(t.weekday, weekdaySize(FONT_METRICS[id]), id);
    if (t.size >= t.weekday) assert.deepEqual(t.blocked, [], `${id}: nothing blocks`);
    else assert.ok(t.blocked.length > 0 && t.blocked.every((b) => b.label && b.months.length), `${id} is below the weekday size and says which tile blocks`);
  }
});

test("name layout: every ink gap inside a tile is at least 2 px", () => {
  for (const id of IDS) for (const word of NAME_WORDS) for (const [k, label] of word.entries()) {
    const boxes = nameLabelLayout(label, FONT_METRICS[id], "face").map((l) => l.box);
    for (let i = 1; i < boxes.length; i++) assert.ok(boxes[i].x0 - boxes[i - 1].x1 >= MIN_GAP - 1e-9, `${id} ${label} ${i}: ${boxes[i].x0 - boxes[i - 1].x1}`);
  }
});

test("name layout: the tile gaps follow the tracking (a middle tile fills its cubie between two half seam gaps)", () => {
  for (const id of IDS) {
    const t = nameFaceTable(FONT_METRICS[id]);
    if (t.blocked.length) continue;
    for (const label of ["ANU", "BRU", "TEM", "TOB", "EMB"]) {
      const b = nameLabelLayout(label, FONT_METRICS[id], "face").map((l) => l.box);
      assert.ok(Math.abs((b.at(-1).x1 - b[0].x0) - (PPU - t.seamGap)) < 0.05, `${id} ${label}`);
    }
  }
});

// Per-font result of the solver (size, seam gap, tracking range over the tiles, in drawing px at the font's size), measured
// 2026-11-11 on the unit grid with April as "AP" + "RIL" (the first tile has 1.3 units of content: the banner starts 0.5 inside
// the cube edge, its ink keeps half a seam gap from the banner edge); a change of the metrics, the geometry or the rule has to
// change this table on purpose.
const PINNED = {
"noto": { size: 96, seamGap: 10.75, tracking: [-8.3, 4.68] },
  "nunito": { size: 94.75, seamGap: 10.80, tracking: [-4.82, 3.85] },
  "nunito-sans": { size: 95, seamGap: 10.74, tracking: [-6.03, 3.64] },
  "quicksand": { size: 98.5, seamGap: 10.24, tracking: [-2.61, 2.46] },
  "nova-oval": { size: 91.25, seamGap: 12.04, tracking: [-10.76, 11.73] },
  "nova-square": { size: 95.5, seamGap: 16.33, tracking: [-10.94, 6.8] },
  "nova-mono": { size: 120, seamGap: 11.04, tracking: [-1.96, 3.68] },
  "comfortaa": { size: 86.5, seamGap: 11.50, tracking: [-3.35, 8.98] },
  "varela-round": { size: 90.25, seamGap: 12.00, tracking: [-3.09, 5.53] },
  "crete-round": { size: 91.25, seamGap: 8.02, tracking: [-1.35, 13.42] },
  "dseg14classic-bold": { size: 83.5, seamGap: 15.86, tracking: [-1.14, 0.82] },
  "dseg14classic-regular": { size: 83.5, seamGap: 15.86, tracking: [-1.14, 0.82] },
  "dseg14modern-bold": { size: 82.5, seamGap: 15.67, tracking: [0, 0.08] },
  "dseg14modern-regular": { size: 82.5, seamGap: 15.67, tracking: [0, 0.08] },
};
test("name layout: the per-font table (size, seam gap, tracking range) is pinned, no font is below its weekday size", () => {
  assert.deepEqual(Object.keys(PINNED), IDS);
  for (const id of IDS) {
    const t = nameFaceTable(FONT_METRICS[id]), tr = [...t.tiles.values()].map((x) => x.tracking), p = PINNED[id];
    assert.ok(Math.abs(t.size - p.size) < 0.01, `${id} size ${t.size}`);
    assert.ok(Math.abs(t.seamGap - p.seamGap) < 0.01, `${id} seam gap ${t.seamGap}`);
    assert.ok(Math.abs(Math.min(...tr) - p.tracking[0]) < 0.01 && Math.abs(Math.max(...tr) - p.tracking[1]) < 0.01, `${id} tracking ${Math.min(...tr)} .. ${Math.max(...tr)}`);
    assert.ok(t.size >= t.weekday, id);
  }
});

test("name layout: pairs below the 2 px floor by nature are raised to it (Noto: R-Y in ARY, L-Y in ULY)", () => {
  const noto = nameFaceTable(FONT_METRICS.noto);
  assert.deepEqual([...noto.tiles.values()].flatMap((t) => t.raised.map((p) => `${t.label}/${p}`)), ["ARY/R-Y", "ULY/L-Y"]);
  for (const [label, pair] of [["ARY", 1], ["ULY", 1]]) assert.ok(Math.abs(noto.tiles.get(label).gaps[pair] - 2) < 1e-9, `${label} gap is 2 px`);
});

test("name layout: an outer tile takes the mean tracking of the middle tiles, less only where it would leave the texture or the red banner (4 tiles, all 14 fonts)", () => {
  const limited = [];
  for (const id of IDS) {
    const tiles = [...nameFaceTable(FONT_METRICS[id]).tiles.values()];
    const middle = tiles.filter((t) => t.anchor === 0), mean = middle.reduce((s, t) => s + t.tracking, 0) / middle.length;
    for (const t of tiles.filter((x) => x.anchor !== 0 && x.label.length > 1)) { // a single letter has no gap to track
      // the first tile (anchor 1) is the corner cubie of column 1; its far edge is the edge of the red banner (the band is white), the last tile's the right texture edge
      const e = edge(t.anchor === 1 ? 0 : 2), boxes = nameLabelLayout(t.label, FONT_METRICS[id], "face").map((l) => l.box);
      const reach = t.anchor === 1 ? boxes[0].x0 - (96 - e.left + nameFaceTable(FONT_METRICS[id]).seamGap / 2) : 96 + e.right - 1.5 - boxes.at(-1).x1;
      assert.ok(t.tracking <= mean + 1e-9, `${id} ${t.label}: tracking ${t.tracking} above the mean ${mean}`);
      if (t.tracking < mean - 1e-6) { limited.push(`${id} ${t.label}`); assert.ok(Math.abs(reach) < 1e-3, `${id} ${t.label}: limited tile touches the edge margin (reach ${reach})`); }
      else assert.ok(Math.abs(t.tracking - mean) < 1e-9 && reach >= -1e-9, `${id} ${t.label}: tracking ${t.tracking} equals the mean ${mean}`);
    }
  }
  assert.deepEqual(limited.sort(), ["comfortaa UNE","nova-mono UNE","nova-mono UST","nunito-sans ARY"]);
});

// Synthetic fonts: the real font with scaled glyph metrics (w: widths, h: heights), so the branches the 14 shipped fonts never take run.
const synth = (w, h) => ({ ...FONT_METRICS.noto, glyphs: Object.fromEntries(Object.entries(FONT_METRICS.noto.glyphs).map(([c, g]) => [c, { ...g, advance: g.advance * w, left: g.left * w, right: g.right * w, top: g.top * h, bottom: g.bottom * h }])) });

test("name layout: a font whose tiles do not fit at the weekday size gets a smaller size and names the blocking tiles", () => {
  const t = nameFaceTable(synth(1.3, 1));
  assert.ok(t.size < t.weekday, `size ${t.size} below weekday ${t.weekday}`);
  assert.deepEqual(t.blocked.map((b) => b.label), ["ANU", "ARY"]);
  assert.deepEqual(t.blocked.find((b) => b.label === "ARY").months, ["JANUARY", "FEBRUARY"]);
});

test("name layout: the glyphs fit the height of the red banner (a tall font gets a smaller size)", () => {
  const font = synth(1, 4), t = nameFaceTable(font), tall = Math.max(...Object.values(font.glyphs).map((g) => g.bottom - g.top)), banner = monthBanner().height * PPU;
  assert.ok(t.size < 96 && t.blocked.length === 0, `size ${t.size}`);
  assert.ok(tall * t.size + 3 <= banner + 1e-9, `glyph height ${tall * t.size} plus the two 1.5 px margins within the banner ${banner}`);
  assert.ok(tall * 96 + 3 > banner, "the size of the shipped Noto would clip");
});

test("name layout: the month size is never below the weekday size when the weekday size fits", () => {
  const t = nameFaceTable(synth(0.9, 0.75));
  assert.equal(t.blocked.length, 0);
  assert.ok(Math.abs(t.size - t.weekday) < 1e-9 && t.size > 106.75, `size ${t.size} equals the weekday size ${t.weekday}, above the natural fill size`);
});

test("name layout: no size fits a font with huge glyphs", () => {
  assert.throws(() => nameFaceTable(synth(20, 1)), /no name size fits/);
  assert.throws(() => nameFaceTable(synth(1, 60)), /no name size fits/);
});

test("name layout: a first tile that is too wide for its room is tightened until its ink starts half a seam gap inside the red banner edge, 0.8 unit left of the cell center", () => {
  // G and V twice as wide: the three-letter first tiles AUG and NOV cannot take the mean tracking of the other tiles
  const font = { ...FONT_METRICS.noto, glyphs: Object.fromEntries(Object.entries(FONT_METRICS.noto.glyphs).map(([c, g]) => [c, "GV".includes(c) ? { ...g, advance: g.advance * 2, left: g.left * 2, right: g.right * 2 } : g])) };
  const t = nameFaceTable(font), m = t.seamGap / 2, tiles = [...t.tiles.values()], mean = tiles.find((x) => x.label === "FE").tracking;
  for (const label of ["AUG", "NOV"]) {
    const x = t.tiles.get(label), ink = [...label].reduce((s, c) => s + (font.glyphs[c].right - font.glyphs[c].left) * t.size, 0) + x.gaps.reduce((a, b) => a + b, 0);
    assert.ok(x.tracking < mean - 1, `${label}: tracking ${x.tracking} is below the mean ${mean}`);
    // the ink ends half a seam gap before the seam (cell center + 0.5 unit) and starts half a seam gap inside the banner edge (cell center - 0.8 unit)
    assert.ok(Math.abs(ink - ((0.5 + 0.8) * PPU - 2 * m)) < 1e-6, `${label}: ink ${ink} fills 1.3 units less two half seam gaps`);
  }
});
