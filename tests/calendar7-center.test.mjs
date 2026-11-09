// SPDX-License-Identifier: AGPL-3.0-or-later
// English 7x7 calendar cube: the strict 6 and 9 are centered exactly (they are shown rotated by 180 degrees when the
// strict rule turns them). Deterministic, no DOM; the real glyph ink is measured in tests/browser/calendar7-center.spec.mjs.
import { test } from "node:test";
import assert from "node:assert/strict";
import { TEXTURE, baseFontSize, drawSticker, halfTurnDigitPlacement, isHalfTurnDigit } from "../src/apps/calendar7/sticker-art.ts";

function drawRun(text, profile) {
  const calls = { baselines: [], texts: [], fonts: [], aligns: [] };
  const ctx = {
    set fillStyle(_) {},
    set font(v) {
      calls.fonts.push(v);
    },
    set textAlign(v) {
      calls.aligns.push(v);
    },
    set textBaseline(v) {
      calls.baselines.push(v);
    },
    fillRect() {},
    fillText: (t, x, y) => calls.texts.push([t, x, y]),
    measureText: (t) => ({ width: Number(calls.fonts.at(-1).match(/(\d+(?:\.\d+)?)px/)[1]) * 0.6 * t.length }),
  };
  drawSticker(ctx, text, "dark", profile);
  return calls;
}
const sizeOf = (c) => Number(c.fonts.at(-1).match(/^600 (\d+)px/)[1]);

test("strict 6 and 9: the model ink box is centered on the sticker, also after a half turn", () => {
  for (const t of ["6", "9"]) {
    const c = drawRun(t, "strict");
    const size = sizeOf(c);
    assert.equal(size, baseFontSize(1));
    assert.deepEqual(c.baselines.slice(-1), ["alphabetic"], `${t} baseline`);
    assert.deepEqual(c.aligns.slice(-1), ["center"]);
    const [, x, baseline] = c.texts[0];
    const at = halfTurnDigitPlacement(t, size);
    assert.deepEqual([x, baseline], [at.x, at.baseline]);
    // Model ink box (real glyph extents), then the same box after a half turn about the sticker center.
    const cy = (at.box.y0 + at.box.y1) / 2;
    const cx = (at.box.x0 + at.box.x1) / 2;
    assert.ok(Math.abs(cy - TEXTURE / 2) < 1e-9, `${t} ink center y ${cy}`);
    assert.ok(Math.abs(cx - TEXTURE / 2) < 1e-9, `${t} ink center x ${cx}`);
    assert.ok(Math.abs(TEXTURE - cy - TEXTURE / 2) < 1e-9, `${t} turned ink center y`);
    assert.ok(at.box.y0 >= 12 && TEXTURE - at.box.y1 >= 12 && at.box.x0 >= 12 && TEXTURE - at.box.x1 >= 12, `${t} margins`);
  }
  assert.throws(() => halfTurnDigitPlacement("7", 140));
});

test("the exact centering is only for single 6 and 9 in the strict profile", () => {
  assert.equal(isHalfTurnDigit("6", "strict"), true);
  assert.equal(isHalfTurnDigit("9", "strict"), true);
  for (const t of ["0", "1", "8", "16", "69", "96", "23/30", "MON", "O", ""]) assert.equal(isHalfTurnDigit(t, "strict"), false, t);
  assert.equal(isHalfTurnDigit("6", "legacy"), false);
  // Legacy and every other label keep the old drawing: middle baseline, 4 percent of the font size below the center.
  for (const [t, p] of [["6", "legacy"], ["9", "legacy"], ["16", "strict"], ["69", "strict"], ["28", "legacy"], ["MON", "strict"], ["0", "strict"], ["7", "strict"]]) {
    const c = drawRun(t, p);
    assert.deepEqual(c.baselines, ["middle"], `${t} ${p}`);
    assert.deepEqual(c.texts, [[t, TEXTURE / 2, TEXTURE / 2 + sizeOf(c) * 0.04]], `${t} ${p}`);
  }
});

test("inherited object keys are not half-turn digits: they throw like any unknown glyph, not NaN", () => {
  for (const t of ["toString", "constructor", "__proto__", "hasOwnProperty", "valueOf"]) {
    assert.equal(isHalfTurnDigit(t, "strict"), false, t);
    assert.throws(() => halfTurnDigitPlacement(t, 140), /not a half-turn digit/, t);
  }
});
