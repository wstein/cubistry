import { test, expect } from "@playwright/test";

test("licenses page scrolls to its last section on desktop and mobile", async ({ page }) => {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 390, height: 800 }]) {
    await page.setViewportSize(viewport);
    await page.goto("/licenses.html");
    await page.mouse.move(viewport.width / 2, viewport.height / 2);
    await page.mouse.wheel(0, 100000);
    await expect
      .poll(() => page.evaluate(() => Math.round(scrollY)))
      .toBeGreaterThan(300);
    const reachedEnd = await page.evaluate(
      () => Math.abs(scrollY + innerHeight - document.documentElement.scrollHeight) <= 2,
    );
    expect(reachedEnd).toBe(true);
  }
});
