import { test, expect } from "@playwright/test";

// Strict 6 and 9 drawn with the real Noto Sans 600 in Chromium: the ink box of the drawn glyph is measured on the canvas
// (alpha of the drawn pixels). A half-turned sticker is shown rotated by 180 degrees about the texture center, so the
// turned ink center is (size - center) and must equal the texture center as well. Other labels and legacy stay as drawn before.

const TOLERANCE = 0.5; // pixels of the 192 px texture (ink edges are quantized to whole pixels)

async function inkBoxes(page, cases) {
  await page.goto("/licenses.html");
  return page.evaluate(async (list) => {
    const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
    document.fonts.add(await face.load());
    await document.fonts.load('600 110px "Counter Sans"');
    const { drawSticker, TEXTURE } = await import("/src/apps/calendar7/sticker-art.ts");
    const out = {};
    for (const [text, profile, ink] of list) {
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = TEXTURE;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      // Transparent background: only the glyph is drawn.
      const proxy = new Proxy(ctx, {
        get(target, key) {
          if (key === "fillRect") return () => {};
          const v = target[key];
          return typeof v === "function" ? v.bind(target) : v;
        },
        set(target, key, value) {
          target[key] = value;
          return true;
        },
      });
      drawSticker(proxy, text, ink, profile);
      const data = ctx.getImageData(0, 0, TEXTURE, TEXTURE).data;
      let x0 = TEXTURE, y0 = TEXTURE, x1 = -1, y1 = -1;
      for (let y = 0; y < TEXTURE; y++)
        for (let x = 0; x < TEXTURE; x++)
          if (data[(y * TEXTURE + x) * 4 + 3] > 127) {
            x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
          }
      out[`${text}|${profile}|${ink}`] = { x0, y0, x1, y1, size: TEXTURE };
    }
    return out;
  }, cases);
}

test("strict 6 and 9: real ink centered on the sticker, upright and after a half turn", async ({ page }) => {
  const cases = [];
  for (const t of ["6", "9"]) for (const ink of ["dark", "red"]) cases.push([t, "strict", ink]);
  const boxes = await inkBoxes(page, cases);
  for (const [key, b] of Object.entries(boxes)) {
    const half = b.size / 2;
    const cy = (b.y0 + b.y1) / 2;
    const cx = (b.x0 + b.x1) / 2;
    expect(b.x1, key).toBeGreaterThan(b.x0);
    expect(Math.abs(cy - half), `${key} ink center y ${cy}`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(b.size - cy - half), `${key} turned ink center y`).toBeLessThanOrEqual(TOLERANCE);
    expect(Math.abs(cx - half), `${key} ink center x ${cx}`).toBeLessThanOrEqual(TOLERANCE);
  }
  // The pair is symmetric: the 6 and the 9 differ in height by at most one pixel, so the two readings do not drift apart.
  const six = boxes["6|strict|dark"];
  const nine = boxes["9|strict|dark"];
  expect(Math.abs(six.y0 + six.y1 - (nine.y0 + nine.y1))).toBeLessThanOrEqual(2);
});

test("legacy 6 and 9 and the other labels keep their drawing", async ({ page }) => {
  const labels = ["6", "9", "0", "1", "16", "69", "23", "MON", "FRI"];
  const cases = labels.flatMap((t) => [[t, "legacy", "dark"], [t, "strict", "dark"]]);
  const boxes = await inkBoxes(page, cases);
  for (const t of labels) {
    const legacy = boxes[`${t}|legacy|dark`];
    const strict = boxes[`${t}|strict|dark`];
    if (t === "6" || t === "9") {
      // Legacy keeps the middle baseline (ink center 91 px as before); strict is the centered one.
      expect(legacy.y0 + legacy.y1, `legacy ${t}`).toBe(182);
      expect(strict.y0 + strict.y1, `strict ${t}`).not.toBe(182);
    } else {
      expect(strict, `${t} strict equals legacy`).toEqual(legacy);
    }
  }
  expect(boxes["16|strict|dark"].y0 + boxes["16|strict|dark"].y1).toBe(186);
  expect(boxes["MON|strict|dark"].y0 + boxes["MON|strict|dark"].y1).toBe(187);
});
