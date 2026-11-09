// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
test("the shared clock stays framed at simultaneous yaw and pitch extremes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-28T11:34:56Z");
  });
  await page.goto("/index.html?app=clock");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  const canvas = page.locator("#studio-scene canvas");
  for (const [dx, dy] of [
    [200, 200],
    [-200, 200],
    [200, -200],
    [-200, -200],
  ]) {
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/apps/clock/live-mode.mjs");
      clockUnits[0].controller.view.resetCamera();
    });
    const box = await canvas.boundingBox(),
      x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + dx, y + dy);
    await page.mouse.up();
    const before = await page.evaluate(async () => {
      const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
      return clockStage.renderer.info.render.frame;
    });
    await expect
      .poll(() =>
        page.evaluate(async (before) => {
          const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
          return clockStage.renderer.info.render.frame > before + 1;
        }, before),
      )
      .toBe(true);
    const points = await page.evaluate(async () => {
      const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
      const { clockBounds } = await import("/src/apps/clock/framing.ts");
      return clockBounds.map((p) =>
        clockStage.camera.position
          .clone()
          .set(...p)
          .applyMatrix4(clockStage.presentation.matrixWorld)
          .project(clockStage.camera)
          .toArray(),
      );
    });
    expect(
      points.every((p) => Math.abs(p[0]) < 0.96 && Math.abs(p[1]) < 0.96),
    ).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(1);
  }
});

test("the reference top-right viewpoint resets and fits the shared row on desktop and mobile", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-29T04:35:42Z");
  });
  await page.goto("/index.html?app=clock&lettering=words");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/apps/clock/live-mode.mjs");
      clockUnits[0].controller.view.resetCamera();
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
          return (
            clockStage.renderer.domElement.width ===
            Math.round(
              clockStage.renderer.domElement.clientWidth *
                clockStage.renderer.getPixelRatio(),
            )
          );
        }),
      )
      .toBe(true);
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
          return -clockStage.presentation.rotation.y;
        }),
      )
      .toBeCloseTo(0.2, 5);
    const frame = await page.evaluate(async () => {
      const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
      return clockStage.renderer.info.render.frame;
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
          return clockStage.renderer.info.render.frame;
        }),
      )
      .toBeGreaterThan(frame + 1);
    const fit = await page.evaluate(async () => {
      const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
      const { clockBounds } = await import("/src/apps/clock/framing.ts");
      return clockBounds.every((p) => {
        const q = clockStage.camera.position
          .clone()
          .set(...p)
          .applyMatrix4(clockStage.presentation.matrixWorld)
          .project(clockStage.camera);
        return Math.abs(q.x) < 0.96 && Math.abs(q.y) < 0.96;
      });
    });
    expect(fit).toBe(true);
    await expect(page.locator("canvas")).toHaveCount(1);
    await page.screenshot({
      path: `test-results/live-clock-reference-${width}.png`,
      fullPage: true,
    });
  }
});

for (const [path, selector, delayed, cold = false] of [
  ["/counter.html", "#application", false],
  ["/ms-timer.html", "#ms-timer-application", false],
  ["/counter.html", "#application", true],
  ["/counter.html", "#application", false, true],
]) {
  test(`the legacy chooser on ${path} opens the unified Live Clock${delayed ? " during delayed document navigation" : ""}${cold ? " after a cold design load" : ""}`, async ({ page }) => {
    if (cold) await page.route("**/counter-design.v2.json", async (route) => {
      // Hold the real boot dependency beyond the old five-second chooser wait.
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.continue();
    });
    if (delayed) await page.route("**/index.html?app=clock", async (route) => {
      // Model a document navigation that exceeds the URL assertion budget but
      // remains within the existing Clock readiness budget.
      await new Promise((resolve) => setTimeout(resolve, 6000));
      await route.continue();
    });
    await page.goto(path);
    // The chooser stays disabled through the verified design's async cold load
    // (#368). Use the existing 30-second startup budget, not the URL budget.
    // Mode-ready and the original final-URL assertion still prove navigation.
    await expect(page.locator(selector)).toBeEnabled({ timeout: 30000 });
    const clock = page.locator(selector).getByRole("option", { name: "Live H–M–S Clock", exact: true });
    await expect(clock).toHaveAttribute("value", "index.html?app=clock");
    await page.selectOption(selector, "index.html?app=clock");
    // The readiness budget includes document navigation and Clock initialization.
    // Check the final URL after that milestone, retaining its five-second budget.
    await expect(page.locator("#seconds-speed")).toBeEnabled({ timeout: 30000 });
    await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "clock");
    await expect(page).toHaveURL(/index\.html\?app=clock$/);
  });
}
