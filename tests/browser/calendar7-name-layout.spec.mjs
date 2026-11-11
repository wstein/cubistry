// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";

// Names layout, one size per font with per-tile tracking: every shipped font is rendered with its real glyphs on the canvas of
// each name tile of the 3D face and the ink is measured in the pixels (not from the metrics): nothing touches the texture edge,
// and every seam between two tiles lies in the middle of the measured ink gap.
test("names layout: every shipped font renders its 12 month names on the 3D face without clipping, seams in the gap middles, month size at least the weekday size", async ({ page }) => {
  test.setTimeout(240000);
  await page.goto("/licenses.html");
  const rows = await page.evaluate(async () => {
    const { FONT_STYLES, loadCalendarFont } = await import("/src/apps/calendar7/fonts.ts");
    const { drawFontSticker, labelLayout, nameFaceTable } = await import("/src/apps/calendar7/font-art.ts");
    const { NAME_WORDS } = await import("/src/apps/calendar7/layout.ts");
    const { SCHEMES } = await import("/src/apps/calendar7/schemes.ts");
    const { faceTransform, namePxPerUnit, tileCanvasSize, tileGrid, tileRoles } = await import("/src/apps/calendar7/sticker-art.ts");
    const { CALENDAR7_SIZE, outerLayerWidth } = await import("/src/apps/calendar7/geometry.ts");
    const scheme = SCHEMES.find((s) => s.id === "paper-red"), F = outerLayerWidth(CALENDAR7_SIZE), ppu = namePxPerUnit();
    const out = [];
    for (const style of FONT_STYLES) {
      const font = await loadCalendarFont(style.id, "/");
      const table = nameFaceTable(font);
      const weekday = Math.max(...["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"].map((d) => labelLayout(d, font)[0].size));
      let touching = 0, worstSeam = 0, minSeamGap = Infinity, maxSeamGap = 0, tiles = 0;
      for (const word of NAME_WORDS) {
        const seams = [0];
        for (let k = 1; k < word.length - 1; k++) seams.push(seams[k - 1] + ppu);
        const ink = [];
        word.forEach((label, k) => {
          const w = k === 0 ? F : 1, tile = k === 0 ? { w, h: F, band: { l: F - 1, r: 0, t: F - 1, b: 0 } } : { w, h: F, band: { l: 0, r: 0, t: F - 1, b: 0 } }, [W, H] = tileCanvasSize(tile), { kx } = faceTransform(tile);
          const c = document.createElement("canvas");
          c.width = W; c.height = H;
          const ctx = c.getContext("2d", { willReadFrequently: true });
          drawFontSticker(ctx, label, "month", font, scheme, "face", undefined, "names", tile);
          const fill = [1, 3, 5].map((i) => parseInt(tileRoles(scheme, label, "month", "names").fill.slice(i, i + 2), 16));
          const data = ctx.getImageData(0, 0, W, H).data, g = tileGrid(tile), bx0 = Math.ceil(g.banner.x0), bx1 = Math.floor(g.banner.x1), by0 = Math.ceil(g.banner.y0), by1 = Math.floor(g.banner.y1);
          let x0 = W, x1 = -1; // the ink is looked for inside the banner (the white margin around it is the ground)
          for (let y = by0; y < by1; y++) for (let x = bx0; x < bx1; x++) {
            const i = (y * W + x) * 4;
            if (fill.some((v, j) => Math.abs(data[i + j] - v) > 40)) {
              x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1);
              if (x === bx0 && k === 0 || x === bx1 - 1 && k === word.length - 1 || y === by0 || y === by1 - 1) touching++; // at the banner edge (a seam is a tile edge inside the banner: the ink gap check covers it)
            }
          }
          const center = k === 0 ? -w * ppu / 2 : seams[k - 1] + w * ppu / 2;
          ink.push({ l: center + (x0 - W / 2) / kx, r: center + (x1 - W / 2) / kx });
          tiles++;
        });
        for (let k = 0; k < seams.length; k++) {
          const gap = ink[k + 1].l - ink[k].r;
          worstSeam = Math.max(worstSeam, Math.abs((ink[k].r + ink[k + 1].l) / 2 - seams[k]));
          minSeamGap = Math.min(minSeamGap, gap); maxSeamGap = Math.max(maxSeamGap, gap);
        }
      }
      out.push({ id: style.id, size: table.size, weekday, blocked: table.blocked.length, seamGap: table.seamGap, touching, worstSeam, minSeamGap, maxSeamGap, tiles });
    }
    return out;
  });
  expect(rows.length).toBe(14);
  for (const r of rows) {
    expect(r.size, `${r.id} month size vs weekday ${r.weekday}`).toBeGreaterThanOrEqual(r.weekday);
    expect(r.blocked, r.id).toBe(0);
    expect(r.touching, `${r.id}: ink pixels on the texture edge`).toBe(0);
    expect(r.worstSeam, `${r.id}: seam vs measured gap middle (px)`).toBeLessThan(1.5);
    // Round letters render a little narrower than their metric box and the ink threshold costs a pixel: the measured gap is 0 to 5 px larger.
    expect(r.minSeamGap - r.seamGap, `${r.id} min`).toBeGreaterThan(-2);
    expect(r.maxSeamGap - r.seamGap, `${r.id} max`).toBeLessThan(5);
  }
});
