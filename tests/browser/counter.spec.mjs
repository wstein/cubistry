import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { frontPoint } from "../helpers/front-projection.mjs";
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
async function go(page, value) {
  await page.locator("#value").fill(String(value));
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-value",
    String(value),
  );
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
test("manual steps, rapid chains, both wrap boundaries and validation preserve state", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  for (const delta of [1, 1, 10])
    await page.locator(`[data-delta="${delta}"]`).click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "12");
  await go(page, 99);
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "99");
  await page.locator("#wrap").check();
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await page.locator('[data-delta="-1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "99");
  await page.locator("#value").fill("1x");
  await page.locator("#set").click();
  await expect(page.locator("#error")).toContainText("whole number");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "99");
  await page.locator("#run").click();
  await expect(page.locator("#error")).toContainText("whole number");
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await go(page, 7);
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await expect(page.locator("#format")).not.toBeChecked();
  expect(errors).toEqual([]);
});
test("physical title pixels and upright optimized-print digits survive Set goals", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await go(page, 7);
  const first = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  await go(page, 99);
  const second = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  let changed = 0,
    total = 0;
  for (let y = 0.12; y < 0.9; y += 0.015)
    for (let x = -0.9; x < 0.9; x += 0.015) {
      const [px, py] = frontPoint(first, x, y),
        i = (py * first.width + px) * 4;
      total++;
      if (
        Math.abs(first.data[i] - second.data[i]) +
          Math.abs(first.data[i + 1] - second.data[i + 1]) +
          Math.abs(first.data[i + 2] - second.data[i + 2]) >
        25
      )
        changed++;
    }
  expect(changed / total).toBeLessThan(0.01);
  // Read the blue orientation marker from the actual projected front sticker.
  const [x, y] = frontPoint(second, 0.52, -0.52 + (0.5 - 234 / 256) * 0.87);
  const samples = [];
  for (let dy = -2; dy <= 2; dy++)
    for (let dx = -2; dx <= 2; dx++) {
      const i = ((y + dy) * second.width + x + dx) * 4;
      samples.push(
        second.data[i + 2] > second.data[i] * 1.25 &&
          second.data[i + 2] > second.data[i + 1] * 1.05,
      );
    }
  expect(samples.some(Boolean)).toBe(true);
});
test("mobile layout, chooser placement and keyboard Set remain accessible", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const chooser = await page.locator(".application-choice").boundingBox(),
    cube = await page.locator(".cube-card").boundingBox(),
    controls = await page.locator("#counter-controls").boundingBox();
  expect(chooser.y + chooser.height).toBeLessThanOrEqual(cube.y);
  expect(chooser.y + chooser.height).toBeLessThanOrEqual(controls.y);
  await expect(page.locator("#application option")).toHaveText([
    "Status Cube · Workflow monitor",
    "Calendar · Deutsch / English",
    "Live H–M–S Clock",
    "H/S/M Counter 00–59",
    "Counter 0–99",
    "60-Minute Timer",
    "5-Second Timer",
  ]);
  await expect(page.locator("#application")).toHaveValue("certified");
  await expect(page.locator("#auto,#step,#start,#pause,#front")).toHaveCount(0);
  await page.locator("#value").fill("42");
  await page.locator("#value").press("Enter");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "42");
});
