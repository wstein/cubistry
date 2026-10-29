import { test, expect } from "@playwright/test";

test.use({ deviceScaleFactor: 2 });
for (const design of ["de-a", "en-3"])
  test(`the ${design} reference viewpoint stays readable and contained on desktop and mobile`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Date.now = () => Date.parse("2026-10-29T12:00:00Z");
    });
    await page.goto("/calendar.html");
    await expect(page.locator("#calendar-design")).toBeEnabled();
    if (design === "en-3") await page.selectOption("#calendar-design", design);
    const front =
      design === "de-a"
        ? "D · O · blank · blank · 2 · 9 · O · K · T"
        : "THU · blank · blank · O · C · T · blank · 2 · 9";
    await expect(page.locator("#calendar-front")).toHaveText(front);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 1000 });
      const before = await page.evaluate(async () => {
        const { calendarApp } = await import("/src/calendar.mjs");
        return calendarApp.viewer.renderer.info.render.frame;
      });
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const { calendarApp } = await import("/src/calendar.mjs");
            return calendarApp.viewer.renderer.info.render.frame;
          }),
        )
        .toBeGreaterThan(before + 1);
      const camera = await page.evaluate(async () => {
        const { calendarApp } = await import("/src/calendar.mjs");
        const v = calendarApp.viewer,
          p = v.camera.position;
        const corners = [-1.5, 1.5].flatMap((x) =>
          [-1.5, 1.5].flatMap((y) =>
            [-1.5, 1.5].map((z) =>
              p.clone().set(x, y, z).project(v.camera).toArray(),
            ),
          ),
        );
        return {
          yaw: Math.atan2(p.x, p.z),
          pitch: Math.atan2(p.y, Math.hypot(p.x, p.z)),
          contained: corners.every(
            ([x, y]) => Math.abs(x) < 0.96 && Math.abs(y) < 0.96,
          ),
          nativeWidth: v.renderer.domElement.width,
          cssWidth: v.renderer.domElement.clientWidth,
        };
      });
      expect(camera.yaw).toBeCloseTo(0.2, 5);
      expect(camera.pitch).toBeCloseTo(0.18, 5);
      expect(camera.contained).toBe(true);
      expect(camera.nativeWidth).toBe(camera.cssWidth * 2);
      expect(
        await page.locator("html").evaluate((e) => e.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page.locator("#calendar-front")).toHaveText(front);
      await expect(page.locator("canvas")).toHaveCount(1);
      await page.screenshot({
        path: `test-results/calendar-reference-${design}-${width}.png`,
        fullPage: true,
      });
    }
  });
