// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Calendar7Viewer, faceFills } from '../src/apps/calendar7/viewer.ts';
import { drawWrongCell, wrongStripRect, wrongStripEdge } from '../src/apps/calendar7/sticker-art.ts';
import { faceFlatShare } from '../src/apps/calendar7/geometry.ts';
import { printNameWords } from '../src/apps/calendar7/layout.ts';
import { parseState } from '../src/apps/calendar7/graph.ts';
import { schemeById, withBannerStyle } from '../src/apps/calendar7/schemes.ts';
import { FONT_METRICS } from './calendar7-font-metrics.mjs';
const start = parseState(JSON.parse(readFileSync('public/calendar7/names-demo/state.v1.json', 'utf8')));
const words = printNameWords(start.printing);
// The recorder tests dispatch and preservation, not digit geometry.
const fontFixture = { ...FONT_METRICS.noto, glyphs: { ...FONT_METRICS.noto.glyphs, 2: FONT_METRICS.noto.glyphs.H, 5: FONT_METRICS.noto.glyphs.H } };
const record = () => {
  const log = [];
  const ctx = new Proxy({ measureText: text => ({ width: text.length * 40 }) }, {
    get: (target, key) => key in target ? target[key] : (...args) => log.push([key, ...args]),
    set: (target, key, value) => { target[key] = value; log.push(['set', key, value]); return true; },
  });
  return { log, canvas: { width: 346, height: 346, getContext: () => ctx } };
};

test('mismatch overlay preserves the entire original drawing before hatching in either font path', () => {
  for (const id of ['paper-red', 'dracula']) for (const font of [null, fontFixture]) {
    const viewer = { font, scheme: withBannerStyle(schemeById(id), 'theme'), surface: 'face', layout: 'names', nameWords: words };
    const tile = { w: 1.8, h: 1.8, band: { l: .8, r: 0, t: 0, b: .8 } };
    const normal = record(), marked = record();
    Calendar7Viewer.prototype.draw.call(viewer, normal.canvas, '25', 'red', tile, false);
    Calendar7Viewer.prototype.draw.call(viewer, marked.canvas, '25', 'red', tile, true);
    assert.deepEqual(marked.log.slice(0, normal.log.length), normal.log, `${id}: original artwork must be drawn unchanged`);
    const overlay = marked.log.slice(normal.log.length);
    assert.ok(overlay.some(call => call[0] === 'stroke'), 'overlay cannot be absent');
    assert.ok(!overlay.some(call => ['fillRect', 'fillText', 'strokeRect'].includes(call[0])), 'only transparent hatch strokes may be added');
    assert.ok(normal.log.some(call => call[0] === 'fillText'), 'the actual wrong numeral remains visible');
  }
});

test('strip height follows the real flat face and ends before its bevel', () => {
  for (const tile of [{ w: 1, h: 1 }, { w: 1, h: 1.8 }, { w: 1.8, h: 1.8 }]) {
    const w = Math.round(tile.w * 192), h = Math.round(tile.h * 192), r = wrongStripRect(w, h, tile);
    const flat = h * faceFlatShare(tile.h);
    assert.ok(Math.abs(r.h / flat - .1) < 1e-12);
    assert.ok(Math.abs(r.y + r.h - (h + flat) / 2) < 1e-10);
    assert.ok(r.y > h * .8, 'a small strip cannot cover the numeral');
  }
});

test('mismatches preserve original role colors on mitered cut faces', () => {
  for (const id of ['paper-red', 'dracula']) {
    const scheme = withBannerStyle(schemeById(id), 'theme');
    assert.deepEqual(faceFills(start.printing, scheme, 'names', new Set([0, 6, 48, 217])), faceFills(start.printing, scheme, 'names'));
  }
});

test('the annotation stays on the calendar bottom for four physical sticker rotations', () => {
  for (const tile of [{ w: 1, h: 1 }, { w: 1, h: 1.8 }, { w: 1.8, h: 1.8 }]) {
    const w = Math.round(tile.w * 192), h = Math.round(tile.h * 192);
    for (const [angle, edge] of ['bottom', 'left', 'top', 'right'].entries()) {
      const r = wrongStripRect(w, h, tile, edge);
      const x = ((r.x + r.w / 2) / w - .5) * tile.w;
      const y = (.5 - (r.y + r.h / 2) / h) * tile.h;
      const [frontX, frontY] = [[x, y], [-y, x], [-x, -y], [y, -x]][angle];
      assert.ok(Math.abs(frontX) < 1e-12 && frontY < 0, `${edge}: marker must be centered on calendar bottom`);
      const thickness = angle % 2 ? r.w / w / faceFlatShare(tile.w) : r.h / h / faceFlatShare(tile.h);
      assert.ok(Math.abs(thickness - .1) < 1e-12, `${edge}: exactly the lower tenth in the display frame`);
    }
  }
});

test('front up vectors choose the annotation edge without rotating the original artwork', () => {
  for (const [up, edge] of [[[0,1,0],'bottom'],[[-1,0,0],'left'],[[0,-1,0],'top'],[[1,0,0],'right']])
    assert.equal(wrongStripEdge(up),edge);
  assert.throws(() => wrongStripEdge([0,0,1]), /no front image orientation/);
});

test('font and scheme redraws retain the annotation edge on the stored art', () => {
  const { canvas, log } = record(), tile = { w: 1.8, h: 1.8, band: { l: .8, r: 0, t: 0, b: .8 } };
  const viewer = {
    destroyed: false, font: null, scheme: withBannerStyle(schemeById('paper-red'), 'theme'),
    baseScheme: schemeById('paper-red'), bannerStyle: 'theme', layout: 'names', surface: 'face', nameWords: words,
    printing: start.printing, pose: start.pose, applyBodyColor() {},
    art: [{ canvas, texture: {}, text: '25', ink: 'red', tile, wrong: true, wrongEdge: 'left' }],
    draw: Calendar7Viewer.prototype.draw, redrawScheme: Calendar7Viewer.prototype.redrawScheme,
  };
  const r = wrongStripRect(canvas.width, canvas.height, tile, 'left');
  const expected = ['rect', r.x, r.y, r.w, r.h];
  Calendar7Viewer.prototype.setBannerStyle.call(viewer, 'boxed');
  assert.deepEqual(log.filter(call => call[0] === 'rect').at(-1), expected, 'scheme redraw cannot restore intrinsic bottom');
  log.length = 0;
  Calendar7Viewer.prototype.setFont.call(viewer, fontFixture);
  assert.deepEqual(log.filter(call => call[0] === 'rect').at(-1), expected, 'font redraw cannot restore intrinsic bottom');
});

test('paired strokes resolve at the measured 56-pixel face scale', () => {
  const widths = [], ctx = new Proxy({}, { get: () => () => {}, set: (target, key, value) => { if (key === 'lineWidth') widths.push(value); return true; } });
  for (const size of [192, 346]) {
    widths.length = 0;drawWrongCell(ctx, size, size);
    assert.equal(widths.length, 2);
    const [halo, dark] = widths;
    assert.ok(dark * 56 / size >= 1, 'the dark hatch must resolve beyond a subpixel stroke');
    assert.ok(halo >= dark + 2, 'the light stroke needs a resolved edge on dark surfaces');
  }
});
