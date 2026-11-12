import { test, expect } from "@playwright/test";

test("nested calendar presentation keeps its non-production banner and viewer inside the screen", async ({
  page,
}) => {
  await page.goto("pr-preview/pr-52/index.html?app=calendar");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  await expect(page.locator("#presentation-btn")).toBeEnabled();
  const front = await page.locator("#calendar-front").textContent();
  await page.locator("#presentation-btn").click();
  await expect(page.locator("body")).toHaveClass(/presentation-mode/);
  await expect
    .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
    .toBe(true);

  await expect
    .poll(() =>
      page
        .locator("#calendar-viewer canvas")
        .evaluate((e) => e.getBoundingClientRect().bottom <= innerHeight),
    )
    .toBe(true);
  await expect(page.locator("body > aside")).toContainText("PR #52");
  const banner = await page.locator("body > aside").boundingBox();
  const shell = await page.locator("#shell").boundingBox();
  const canvas = await page.locator("#calendar-viewer canvas").boundingBox();
  expect(shell.y).toBeGreaterThanOrEqual(banner.y + banner.height);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight),
  );
  await expect(page.locator("#calendar-digital")).toBeVisible();
  await expect(page.locator("#calendar-front")).toHaveText(front);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/presentation-nested-preview.png",
  });
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
  await expect(page.locator("#calendar-date")).toBeVisible();
});
