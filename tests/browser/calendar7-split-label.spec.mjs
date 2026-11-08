import { test, expect } from "@playwright/test";

// Strict-profile split labels (23/30, 24/31) drawn with the real Noto Sans 600 font in Chromium: the real ink of the
// big first number and of the small second number is measured on the canvas (alpha of the drawn pixels), so the
// font's true glyph shapes decide, not the geometry model of tests/calendar7-strict-profile.test.mjs.
// Thresholds: ink gap of at least 12 px (0.0625 of the 192 px texture) and ink margins of at least 10 px to the edge.

const MIN_GAP = 12;
const MIN_MARGIN = 10;

for (const label of ["23/30", "24/31"]) {
  test(`strict split label ${label}: real ink gap and margins`, async ({ page }) => {
    await page.goto("/licenses.html");
    const result = await page.evaluate(async (text) => {
      const face = new FontFace("Counter Sans", "url(/fonts/noto-sans-latin-600.woff2)", { weight: "600" });
      document.fonts.add(await face.load());
      await document.fonts.load('600 110px "Counter Sans"');
      const { drawSticker, TEXTURE } = await import("/src/apps/calendar7/sticker-art.ts");
      const size = TEXTURE;
      // Draws only the run number `only` of the real drawSticker call on a transparent canvas and returns its ink box.
      const ink = (only) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        let run = 0;
        const proxy = new Proxy(ctx, {
          get(target, key) {
            if (key === "fillRect") return () => {};
            if (key === "fillText") return (...args) => (run++ === only ? target.fillText(...args) : undefined);
            const v = target[key];
            return typeof v === "function" ? v.bind(target) : v;
          },
          set(target, key, value) {
            target[key] = value;
            return true;
          },
        });
        drawSticker(proxy, text, "dark", "strict");
        const data = ctx.getImageData(0, 0, size, size).data;
        let x0 = size, y0 = size, x1 = -1, y1 = -1;
        for (let y = 0; y < size; y++)
          for (let x = 0; x < size; x++)
            if (data[(y * size + x) * 4 + 3] > 127) {
              x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x + 1); y1 = Math.max(y1, y + 1);
            }
        return { x0, y0, x1, y1, runs: run };
      };
      return { first: ink(0), second: ink(1), size };
    }, label);
    const { first, second, size } = result;
    expect(first.runs).toBe(2); // exactly two runs: no slash
    expect(first.x1).toBeGreaterThan(first.x0);
    expect(second.x1).toBeGreaterThan(second.x0);
    const gap = Math.hypot(
      Math.max(first.x0 - second.x1, 0, second.x0 - first.x1),
      Math.max(first.y0 - second.y1, 0, second.y0 - first.y1),
    );
    expect(gap, `ink gap ${gap.toFixed(1)} px`).toBeGreaterThanOrEqual(MIN_GAP);
    // Big number: lifted, ink centered about 18 px above the texture center; margins to the edges.
    expect(Math.abs((first.y0 + first.y1) / 2 - (size / 2 - 18))).toBeLessThanOrEqual(3);
    for (const m of [first.x0, first.y0, size - first.x1]) expect(m).toBeGreaterThanOrEqual(MIN_MARGIN);
    // Small number: lower right, margins to the right and bottom edge.
    for (const m of [size - second.x1, size - second.y1, second.x0, second.y0]) expect(m).toBeGreaterThanOrEqual(MIN_MARGIN);
    expect(second.y1 - second.y0).toBeLessThan((first.y1 - first.y0) * 0.6);
  });
}
