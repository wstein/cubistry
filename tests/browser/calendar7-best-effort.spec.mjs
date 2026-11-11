// SPDX-License-Identifier: AGPL-3.0-or-later
// Best effort for the month the print cannot show exactly (February with 28 days from a Sunday: 2026, 2037, 2043, ...): the cube
// shows the best state, the one wrong cell is drawn on its cubie's face as a grey hatched field with a strike-through and a red
// frame crossed out. The scene is WebGL, so the spec reads the projected position of the cell from `data-c7-wrong` on the canvas
// (the viewer publishes it with every drawn frame, with the cosine of the viewing angle) and samples the pixels of the screenshot there, from three views.
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";

const ROOT = "#calendar7-root";
const SHOTS = process.env.C7_SHOTS ?? "";
const MIN_COS = 0.35; // cosine of the angle between the face normal and the line of sight: a cell seen more edge-on is skipped (about 70 degrees)
const at = (page, month) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", month, { timeout: 30000 });
const idle = (page) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "idle", { timeout: 30000 });
const canvas = (page) => page.locator("#studio-scene canvas");
const open = async (page, year, scheme = "paper-red") => {
  await page.goto(`/index.html?app=calendar7&layout=names&year=${year}&month=2&scheme=${scheme}`);
  await at(page, `${year}-02`);
  await idle(page);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "best-effort");
  await expect.poll(async () => (await canvas(page).getAttribute("data-c7-wrong")) !== null, { timeout: 30000 }).toBe(true);
};
const wrongCell = async (page) => JSON.parse(await canvas(page).getAttribute("data-c7-wrong"))[0];
const drag = async (page, dx, dy) => {
  const box = await canvas(page).boundingBox();
  const x = box.x + box.width / 2, y = box.y + box.height * 0.85; // below the cube: the drag starts on the empty scene
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
  await page.waitForTimeout(600);
};
const luminance = ([r, g, b]) => {
  const f = (v) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
/** Pixel classes in the disc of radius `0.62 r` around the projected cell of a screenshot of the canvas. */
async function sample(page, cell) {
  const png = PNG.sync.read(await canvas(page).screenshot());
  const scale = png.width / (await canvas(page).evaluate((el) => el.clientWidth));
  const out = { grey: 0, red: 0, dark: 0, total: 0, greys: [], reds: [], darks: [] };
  const R = cell.r * 0.62 * scale;
  for (let y = Math.max(0, Math.floor(cell.y * scale - R)); y < Math.min(png.height, cell.y * scale + R); y++)
    for (let x = Math.max(0, Math.floor(cell.x * scale - R)); x < Math.min(png.width, cell.x * scale + R); x++) {
      if ((x - cell.x * scale) ** 2 + (y - cell.y * scale) ** 2 > R * R) continue;
      const i = (y * png.width + x) * 4;
      const [r, g, b] = [png.data[i], png.data[i + 1], png.data[i + 2]];
      out.total++;
      if (r > 170 && g < 70 && b < 80) { out.red++; out.reds.push([r, g, b]); }
      else if (Math.max(r, g, b) < 75) { out.dark++; out.darks.push([r, g, b]); }
      else if (Math.abs(r - g) < 16 && Math.abs(g - b) < 16 && r > 110 && r < 235) { out.grey++; out.greys.push([r, g, b]); }
    }
  return out;
}
test("February 2037 and 2043 show the same best-effort cube; the page has one sentence, no table and no technical text", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await open(page, 2037);
  const digest = await page.locator(ROOT).getAttribute("data-c7-digest");
  await expect(page.locator("[data-c7-best-effort]")).toHaveText("Not exactly possible with this print: cell bottom right (row 7, column 7) differs.");
  const box = await page.locator("[data-c7-sheet-hidden]").boundingBox();
  expect(box.width).toBeLessThanOrEqual(1); // visually hidden: a 1 px clipped box, still in the accessibility tree
  expect(box.height).toBeLessThanOrEqual(1);
  await expect(page.locator("[data-c7-sheet-hidden] .c7-sheet")).toHaveCount(1); // kept for screen readers
  await expect(page.locator("[data-c7-sheet-hidden] .c7-sheet")).toHaveAttribute("aria-label", "7x7 calendar sheet, February 2037");
  const text = await page.locator("body").innerText();
  for (const word of ["scan-fixed", "corner demand", "Julia", "NOMATCH", "No state for this date"]) expect(text).not.toContain(word);
  expect(await page.locator("[data-c7-sheet-hidden] .c7-sheet tr:first-child td .c7-cell-text").allTextContents()).toEqual(["FE", "BRU", "ARY", "", "", "", ""]);
  await open(page, 2043);
  expect(await page.locator(ROOT).getAttribute("data-c7-digest")).toBe(digest); // one configuration, one state
  expect(errors).toEqual([]);
});

for (const scheme of ["paper-red", "dracula"])
  test(`${scheme}: the wrong cell is a grey hatched field with a dark strike-through and a red frame, seen from three views`, async ({ page }) => {
    await open(page, 2037, scheme);
    const views = [];
    for (const [dx, dy] of [[0, 0], [-90, 20], [60, -30], [-120, -60]]) {
      if (dx || dy) await drag(page, dx, dy);
      const cell = await wrongCell(page);
      if (!cell.facing || cell.cos < MIN_COS || cell.x < 0 || cell.y < 0) continue; // an edge-on cell has no pixels to sample
      const s = await sample(page, cell);
      views.push({ cell, s });
      if (SHOTS) await page.screenshot({ path: `${SHOTS}/sample-${scheme}-view${views.length}.png` });
      expect(s.total).toBeGreaterThan(200);
      expect(s.grey / s.total, `grey field (${JSON.stringify(cell)})`).toBeGreaterThan(0.05);
      expect(s.red / s.total, "red frame").toBeGreaterThan(0.02);
      expect(s.dark / s.total, "strike-through").toBeGreaterThan(0.008);
      const field = luminance(s.greys[Math.floor(s.greys.length / 2)]);
      const mean = (list) => list.reduce((a, c) => a.map((v, k) => v + c[k] / list.length), [0, 0, 0]);
      // Legible in a dark scheme as well: the marks (dark hatching and strike-through, red frame) stand out from the grey field in the rendered pixels.
      expect(contrast(field, luminance(mean(s.darks))), `${scheme}: hatch and strike-through against the field`).toBeGreaterThan(2.5);
      expect(contrast(field, luminance(mean(s.reds))), `${scheme}: red frame against the field`).toBeGreaterThan(1.5);
    }
    expect(views.length, "the cell was seen head-on or from the side in three views").toBeGreaterThanOrEqual(3);
  });

test("an exact month shows no hatched cell and publishes none; going from best effort to an exact month removes it", async ({ page }) => {
  await open(page, 2037);
  await page.getByLabel("Year").fill("2024");
  await page.getByLabel("Month").selectOption("2");
  await page.getByRole("button", { name: "Show" }).click();
  await at(page, "2024-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(canvas(page)).not.toHaveAttribute("data-c7-wrong", /.+/);
  await expect(page.locator("[data-c7-best-effort]")).toHaveCount(0);
  await expect(page.locator(".c7-sheet")).toBeVisible();
});
