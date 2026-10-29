import { test, expect } from "@playwright/test";

test("nested calendar presentation keeps its non-production banner and viewer inside the screen", async ({
  page,
}) => {
  await page.goto("pr-preview/pr-52/calendar.html");
  await expect(page.locator("#presentation-toggle")).toBeEnabled();
  const front = await page.locator("#calendar-front").textContent();
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await expect(page.locator("body")).toHaveAttribute(
    "data-presentation",
    "true",
  );
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
  const main = await page.locator("main").boundingBox();
  const canvas = await page.locator("#calendar-viewer canvas").boundingBox();
  expect(main.y).toBeGreaterThanOrEqual(banner.y + banner.height);
  expect(canvas.y + canvas.height).toBeLessThanOrEqual(
    await page.evaluate(() => innerHeight),
  );
  await expect(page.locator("#calendar-digital")).toBeVisible();
  await expect(page.locator("#calendar-front")).toHaveText(front);
  await expect(page.locator("canvas")).toHaveCount(1);
  await page.screenshot({
    path: "test-results/presentation-nested-preview.png",
  });
  await page
    .getByRole("button", { name: "Show controls", exact: true })
    .click();
  await expect(page.locator("#calendar-date")).toBeVisible();
});
