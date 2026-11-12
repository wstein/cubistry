// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { Calendar7Viewer, faceFills } from '../src/apps/calendar7/viewer.ts';
import { drawWrongCell, wrongCellRect } from '../src/apps/calendar7/sticker-art.ts';
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
    assert.ok(!overlay.some(call => ['fillRect', 'fillText', 'strokeRect'].includes(call[0])), 'only translucent hatch strokes may be added');
    assert.ok(normal.log.some(call => call[0] === 'fillText'), 'the actual wrong numeral remains visible');
  }
});

test('mismatches preserve original role colors on mitered cut faces', () => {
  for (const id of ['paper-red', 'dracula']) {
    const scheme = withBannerStyle(schemeById(id), 'theme');
    assert.deepEqual(faceFills(start.printing, scheme, 'names', new Set([0, 6, 48, 217])), faceFills(start.printing, scheme, 'names'));
  }
});

test('font and scheme redraws repaint the whole-face hatch on the stored art', () => {
  const { canvas, log } = record(), tile = { w: 1.8, h: 1.8, band: { l: .8, r: 0, t: 0, b: .8 } };
  const viewer = {
    destroyed: false, font: null, scheme: withBannerStyle(schemeById('paper-red'), 'theme'),
    baseScheme: schemeById('paper-red'), bannerStyle: 'theme', layout: 'names', surface: 'face', nameWords: words,
    printing: start.printing, pose: start.pose, applyBodyColor() {},
    art: [{ canvas, texture: {}, text: '25', ink: 'red', tile, wrong: true }],
    draw: Calendar7Viewer.prototype.draw, redrawScheme: Calendar7Viewer.prototype.redrawScheme,
  };
  const r = wrongCellRect(canvas.width, canvas.height, tile);
  const expected = ['rect', r.x, r.y, r.w, r.h];
  Calendar7Viewer.prototype.setBannerStyle.call(viewer, 'boxed');
  assert.deepEqual(log.filter(call => call[0] === 'rect').at(-1), expected, 'scheme redraw repaints the face hatch');
  log.length = 0;
  Calendar7Viewer.prototype.setFont.call(viewer, fontFixture);
  assert.deepEqual(log.filter(call => call[0] === 'rect').at(-1), expected, 'font redraw repaints the face hatch');
});

test('paired strokes resolve at the measured 56-pixel face scale', () => {
  const widths = [], ctx = new Proxy({}, { get: () => () => {}, set: (target, key, value) => { if (key === 'lineWidth') widths.push(value); return true; } });
  for (const size of [192, 346]) {
    widths.length = 0;drawWrongCell(ctx, size, size);
    assert.equal(widths.length, 4, 'hatch pair and strike pair');
    const [halo, dark] = widths;
    assert.ok(dark * 56 / size >= 1, 'the dark hatch must resolve beyond a subpixel stroke');
    assert.ok(halo >= dark + 2, 'the light stroke needs a resolved edge on dark surfaces');
  }
});
