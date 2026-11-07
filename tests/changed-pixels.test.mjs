import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { countChangedPixels, HIDE_HUD_LAYERS_STYLE } from "./helpers/changed-pixels.mjs";

const image = (w, h, fill = [200, 200, 200]) => ({
  width: w,
  height: h,
  data: Uint8Array.from({ length: w * h * 4 }, (_, i) => (i % 4 === 3 ? 255 : fill[i % 4])),
});
const paint = (img, x, y, rgb) => rgb.forEach((v, c) => (img.data[(y * img.width + x) * 4 + c] = v));
const box = { minX: 2, maxX: 5, minY: 2, maxY: 5 };

test("a change inside the box counts as changed and not outside", () => {
  const a = image(8, 8), b = image(8, 8);
  paint(b, 3, 3, [0, 0, 0]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 1, outside: 0 });
});

test("a change outside the box counts as outside (mutation: a sticker or HUD pixel changes)", () => {
  const a = image(8, 8), b = image(8, 8);
  paint(b, 3, 3, [0, 0, 0]);
  paint(b, 0, 7, [0, 0, 0]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 2, outside: 1 });
});

test("all four box edges are inclusive; pixels one step beyond them are outside", () => {
  const a = image(8, 8), b = image(8, 8);
  for (const [x, y] of [[2, 2], [5, 2], [2, 5], [5, 5]]) paint(b, x, y, [189, 200, 200]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 4, outside: 0 });
  for (const [x, y] of [[1, 3], [6, 3], [3, 1], [3, 6]]) paint(b, x, y, [189, 200, 200]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 8, outside: 4 });
});

test("the threshold is a strict greater-than of the summed RGB difference", () => {
  const a = image(8, 8), b = image(8, 8);
  paint(b, 3, 3, [190, 200, 200]);
  paint(b, 4, 4, [195, 195, 200]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 0, outside: 0 });
  paint(b, 4, 4, [195, 194, 200]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 1, outside: 0 });
});

test("a difference in only one channel counts (each of R, G, B)", () => {
  for (const c of [0, 1, 2]) {
    const a = image(8, 8), b = image(8, 8), rgb = [200, 200, 200];
    rgb[c] = 150;
    paint(b, 7, 7, rgb);
    assert.deepEqual(countChangedPixels(a, b, box), { changed: 1, outside: 1 }, `channel ${c}`);
  }
});

test("a size mismatch throws", () => {
  assert.throws(() => countChangedPixels(image(2, 2), image(3, 2), box), /size mismatch/);
});

test("every hidden HUD selector exists in counter.html, its styles or the viewer", () => {
  const sources = ["counter.html", "src/style.css", "packages/cube-viewer/src/appearance.ts"]
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
  const selectors = [...HIDE_HUD_LAYERS_STYLE.matchAll(/^([^\s{]+) \{/gm)].map((m) => m[1]);
  assert.ok(selectors.length >= 5);
  for (const s of selectors) {
    const name = s.slice(1);
    assert.ok(new RegExp(`${s[0] === "#" ? 'id="' : "[\\s\"'.]"}${name}[\\s"'{,.:]`).test(sources), s);
  }
  assert.doesNotMatch(HIDE_HUD_LAYERS_STYLE, /#cube|canvas|display\s*:/);
});
