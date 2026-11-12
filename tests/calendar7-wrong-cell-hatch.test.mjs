// SPDX-License-Identifier: AGPL-3.0-or-later
// The differing cell carries translucent hatching over its whole flat face (owner decision, marker design #412 cut B).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { drawWrongCell, wrongCellRect, HATCH_LINES, WRONG_CELL } from '../src/apps/calendar7/sticker-art.ts';
import { faceFlatShare } from '../src/apps/calendar7/geometry.ts';

const TILES = [[192, 192, undefined], [192, 346, { w: 1, h: 1.8 }], [346, 346, { w: 1.8, h: 1.8 }]];
const alpha = (color) => Number(/^rgba\(\d+,\s*\d+,\s*\d+,\s*([\d.]+)\)$/.exec(color)?.[1] ?? 1);

// Records the strokes in order: [{ style, width, segments: [[x0, y0, x1, y1], ...] }], plus every other call.
function run(w, h, tile) {
  const strokes = [], other = [], clips = [];
  let style, width, path = [], cur = null, rect = null;
  const ctx = {
    set strokeStyle(v) { style = v; }, set lineWidth(v) { width = v; }, set lineCap(v) { }, set fillStyle(v) { other.push('fillStyle'); },
    save() { }, restore() { }, beginPath() { path = []; },
    moveTo(x, y) { cur = [x, y]; }, lineTo(x, y) { path.push([...cur, x, y]); cur = [x, y]; },
    stroke() { strokes.push({ style, width, segments: path }); },
    rect(x, y, rw, rh) { rect = { x, y, w: rw, h: rh }; }, clip() { clips.push(rect); },
    fillRect() { other.push('fillRect'); }, strokeRect() { other.push('strokeRect'); }, fillText() { other.push('fillText'); },
  };
  drawWrongCell(ctx, w, h, tile);
  return { strokes, other, clips };
}
// The part of the segment inside the clip rectangle, as [x0, y0, x1, y1], or null when it lies outside.
function clipped(seg, r) {
  let [x0, y0, x1, y1] = seg, t0 = 0, t1 = 1;
  const dx = x1 - x0, dy = y1 - y0;
  for (const [p, q] of [[-dx, x0 - r.x], [dx, r.x + r.w - x0], [-dy, y0 - r.y], [dy, r.y + r.h - y0]]) {
    if (p === 0) { if (q < 0) return null; continue; }
    const t = q / p;
    if (p < 0) { if (t > t1) return null; t0 = Math.max(t0, t); } else { if (t < t0) return null; t1 = Math.min(t1, t); }
  }
  return [x0 + t0 * dx, y0 + t0 * dy, x0 + t1 * dx, y0 + t1 * dy];
}
const distance = (px, py, [x0, y0, x1, y1]) => {
  const dx = x1 - x0, dy = y1 - y0, t = Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - (x0 + t * dx), py - (y0 + t * dy));
};

test('the hatch is clipped to the whole flat face, not to a strip', () => {
  for (const [w, h, tile] of TILES) {
    const { clips } = run(w, h, tile), r = wrongCellRect(w, h, tile);
    assert.deepEqual(clips, [r]);
    assert.ok(Math.abs(r.w - w * faceFlatShare(tile?.w ?? 1)) < 1e-9 && Math.abs(r.h - h * faceFlatShare(tile?.h ?? 1)) < 1e-9, 'the flat face of the tile');
    assert.ok(r.h > h * 0.7 && r.w > w * 0.7, 'covers the tile, not one tenth of it');
  }
});

test('every part of the tile lies within one hatch pitch of a hatch line', () => {
  for (const [w, h, tile] of TILES) {
    const { strokes, clips } = run(w, h, tile), r = clips[0], step = Math.min(w, h) / HATCH_LINES;
    const lines = strokes[0].segments.map((s) => clipped(s, r)).filter((l) => l && (l[0] !== l[2] || l[1] !== l[3]));
    for (let i = 0; i < 12; i++) for (let j = 0; j < 12; j++) {
      const x = r.x + (i + 0.5) * r.w / 12, y = r.y + (j + 0.5) * r.h / 12;
      assert.ok(Math.min(...lines.map((l) => distance(x, y, l))) <= step / 2 + 1e-9, `${w}x${h}: cell ${i},${j} is hatched`);
    }
  }
});

test('line width and density scale with the tile size', () => {
  const small = run(192, 192).strokes, big = run(346, 346, { w: 1.8, h: 1.8 }).strokes;
  assert.ok(big[1].width > small[1].width && big[0].width > small[0].width, 'wider lines on the larger tile');
  assert.ok(Math.abs(big[0].segments.length - small[0].segments.length) <= 6, 'the same number of lines per tile at any size');
});

test('only transparent strokes are drawn: no fill, no text, no frame', () => {
  for (const [w, h, tile] of TILES) assert.deepEqual(run(w, h, tile).other, []);
});

test('light halo and dark hatch are both translucent and share the same lines', () => {
  const { strokes } = run(346, 346, { w: 1.8, h: 1.8 });
  assert.equal(strokes[0].style, WRONG_CELL.halo);
  assert.equal(strokes[1].style, WRONG_CELL.hatch);
  assert.ok(alpha(WRONG_CELL.halo) < 1 && alpha(WRONG_CELL.hatch) < 1, 'neither stroke is opaque');
  assert.deepEqual(strokes[0].segments, strokes[1].segments);
  assert.ok(strokes[0].width >= strokes[1].width + 2, 'the halo edge stays resolved on dark schemes');
});

test('hatching leaves most of the central half of the flat face unpainted (a density measure, not the label itself)', () => {
  for (const [w, h, tile] of TILES) {
    const { strokes, clips } = run(w, h, tile), r = clips[0];
    const lines = strokes[0].segments.map((s) => clipped(s, r)).filter((l) => l && (l[0] !== l[2] || l[1] !== l[3])), half = strokes[0].width / 2;
    let free = 0, n = 0;
    for (let i = 0; i < 40; i++) for (let j = 0; j < 40; j++) {
      const x = r.x + r.w * (0.25 + 0.5 * (i + 0.5) / 40), y = r.y + r.h * (0.25 + 0.5 * (j + 0.5) / 40);
      n++; if (lines.every((l) => distance(x, y, l) > half)) free++;
    }
    assert.ok(free / n >= 0.4, `${w}x${h}: at least 40 percent of the central half stays unpainted (${(free / n).toFixed(2)})`);
  }
});

test('a strike-through crosses the whole face in red, drawn with its own halo', () => {
  const { strokes, clips } = run(346, 346, { w: 1.8, h: 1.8 }), r = clips[0];
  assert.equal(strokes.length, 4, 'hatch halo, hatch, strike halo, strike');
  assert.equal(strokes[3].style, WRONG_CELL.strike);
  assert.equal(strokes[2].style, WRONG_CELL.halo);
  assert.ok(alpha(WRONG_CELL.strike) < 1, "the red strike-through is translucent");
  assert.ok(strokes[2].width > strokes[3].width);
  const [x0, y0, x1, y1] = strokes[3].segments[0];
  assert.ok(Math.abs(Math.abs(x1 - x0) - r.w) < 1e-9 && Math.abs(Math.abs(y1 - y0) - r.h) < 1e-9, 'corner to corner of the flat face');
});
