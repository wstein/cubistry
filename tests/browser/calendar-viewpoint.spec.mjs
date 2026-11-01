import { test, expect } from "@playwright/test";
import { until } from "../helpers/settle.mjs";

test.use({ deviceScaleFactor: 2 });
for (const design of ["de-a", "en-3"])
  test(`the ${design} reference viewpoint stays readable and contained on desktop and mobile`, async ({
    page,
  }) => {
    test.setTimeout(120000);
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
      const frame = () =>
        page.evaluate(async () => {
          const { calendarApp } = await import("/src/calendar.mjs");
          return calendarApp.viewer.renderer.info.render.frame;
        });
      const before = await frame();
      // Software GL at a 2x device scale renders slowly; one CI run saw a single
      // frame in the default 5 s. The requirement (more than one new frame) is
      // unchanged; only the real-time budget is explicit and the failure reports
      // the frame counts. The 30 s budget is six times the default.
      await until(page, `more than one new frame after ${before} at ${width}px`, frame, {
        accept: (value) => value > before + 1,
        timeout: 30000,
      });
      const camera = await page.evaluate(async () => {
        const { calendarApp } = await import("/src/calendar.mjs");
        const v = calendarApp.viewer,
          p = v.camera.position;
        const corners = [-1.5, 1.5].flatMap((x) =>
          [-1.5, 1.5].flatMap((y) =>
            [-1.5, 1.5].map((z) =>
              p.clone().set(x, y, z).applyMatrix4(v.presentation.matrixWorld).project(v.camera).toArray(),
            ),
          ),
        );
        return {
          yaw: -v.presentation.rotation.y,
          pitch: v.presentation.rotation.x,
          cameraPosition: p.toArray(),
          contained: corners.every(
            ([x, y]) => Math.abs(x) < 0.96 && Math.abs(y) < 0.96,
          ),
          nativeWidth: v.renderer.domElement.width,
          cssWidth: v.renderer.domElement.clientWidth,
        };
      });
      expect(camera.yaw).toBeCloseTo(0.2, 5);
      expect(camera.pitch).toBeCloseTo(0.18, 5);
      expect(camera.cameraPosition.slice(0, 2)).toEqual([0, 0]);
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
