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

test("box edges are inclusive and the threshold is a strict greater-than", () => {
  const a = image(8, 8), b = image(8, 8);
  paint(b, 5, 5, [190, 200, 200]);
  paint(b, 6, 5, [189, 200, 200]);
  assert.deepEqual(countChangedPixels(a, b, box), { changed: 1, outside: 1 });
});

test("a size mismatch throws", () => {
  assert.throws(() => countChangedPixels(image(2, 2), image(3, 2), box), /size mismatch/);
});

test("every hidden HUD selector exists in counter.html, its styles or the viewer", () => {
  const sources = ["counter.html", "src/style.css", "packages/cube-viewer/src/appearance.ts"]
    .map((f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8")).join("\n");
  const selectors = [...HIDE_HUD_LAYERS_STYLE.matchAll(/^([^\s{]+) \{/gm)].map((m) => m[1]);
  assert.ok(selectors.length >= 6);
  for (const s of selectors) {
    const name = s.slice(1);
    assert.ok(new RegExp(`${s[0] === "#" ? 'id="' : "[\\s\"'.]"}${name}[\\s"'{,.:]`).test(sources), s);
  }
  assert.doesNotMatch(HIDE_HUD_LAYERS_STYLE, /#cube|canvas|display\s*:/);
});
