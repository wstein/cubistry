// SPDX-License-Identifier: AGPL-3.0-or-later
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseState } from '../src/apps/calendar7/graph.ts';
import { NAME_WORDS, printNameWords, nameAnchor } from '../src/apps/calendar7/layout.ts';
import { nameFaceTable, nameLabelLayout } from '../src/apps/calendar7/font-art.ts';
import { namesCells, previewForDate, stateForDate } from '../src/apps/calendar7/anydate.ts';
import { anyDateModel } from '../src/apps/calendar7/anydate-view.ts';
import { frontFailures } from '../src/apps/calendar7/display.ts';
import { nameGrid } from '../src/apps/calendar7/sticker-art.ts';
import { FONT_METRICS } from './calendar7-font-metrics.mjs';
const start = parseState(JSON.parse(readFileSync('public/calendar7/names-demo/state.v1.json', 'utf8')));
const words = printNameWords(start.printing);

test('physical month vocabulary covers every printed label and preserves whole month names', () => {
  assert.deepEqual(words.map(w => w.join('')), NAME_WORDS.map(w => w.join('')));
  const labels = new Set(start.printing.text.filter((_, i) => start.printing.ink[i] === 'month'));
  assert.deepEqual(new Set(words.flat()), labels);
  for (const font of Object.values(FONT_METRICS)) {
    const face = nameFaceTable(font, undefined, words);
    for (const label of labels) {
      assert.ok(face.tiles.has(label), `${font.family}: ${label} missing from physical fit`);
      const parts = nameLabelLayout(label, font, 'face', words);
      assert.ok(parts.every(p => p.size === face.size && p.y < 96), `${label}: sheet fallback on cubie face`);
      assert.equal(face.tiles.get(label).anchor, nameAnchor(label, words));
    }
  }
  assert.deepEqual(words[3], ['APR', 'IL']);
  assert.deepEqual(NAME_WORDS[3], ['AP', 'RIL']);
  assert.equal(nameAnchor('APR', words), 1);
  assert.equal(nameAnchor('IL', words), -1);
  assert.ok(nameGrid('IL', true, 1, words)[0].x < nameGrid('IL', true, 1)[0].x);
});

test('off-chain April targets use the same physical month labels as playback', () => {
  const target = namesCells(2099, 4, words);
  assert.deepEqual(target.slice(0, 2).map(c => c.text), words[3]);
  const preview = previewForDate(start, 2099, 4);
  const state = stateForDate(preview, 2099, 4);
  assert.ok(frontFailures(start.printing, state.pose, target).every(f => f.row !== 1), "stale month targets create false first-row mismatches");
  const display = anyDateModel({ kind: "month", ym: { year: 2099, month: 4 } }, stateForDate(preview, 2099, 4), { year: 2026, month: 11 }, {}, words);
  assert.deepEqual(display.cells.slice(0, 2).map(c => c.text), words[3]);
});

test('ambiguous physical vocabularies fail instead of guessing a month split', () => {
  const text = [...start.printing.text, 'AP', 'RIL'];
  const ink = [...start.printing.ink, 'month', 'month'];
  assert.throws(() => printNameWords({ text, ink }), /ambiguous physical month vocabulary: APRIL/);
});
