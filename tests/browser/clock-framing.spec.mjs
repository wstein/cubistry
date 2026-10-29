import { test, expect } from "@playwright/test";
test("the shared clock stays framed at simultaneous yaw and pitch extremes", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-28T11:34:56Z");
  });
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  const canvas = page.locator("#clock-scene canvas");
  for (const [dx, dy] of [
    [200, 200],
    [-200, 200],
    [200, -200],
    [-200, -200],
  ]) {
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
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
      const { clockStage } = await import("/src/clock.mjs");
      return clockStage.renderer.info.render.frame;
    });
    await expect
      .poll(() =>
        page.evaluate(async (before) => {
          const { clockStage } = await import("/src/clock.mjs");
          return clockStage.renderer.info.render.frame > before + 1;
        }, before),
      )
      .toBe(true);
    const points = await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      const { clockBounds } = await import("/src/apps/clock/framing.ts");
      return clockBounds.map((p) =>
        clockStage.camera.position
          .clone()
          .set(...p)
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
  await page.goto("/clock.html?lettering=words");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      clockUnits[0].controller.view.resetCamera();
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { clockStage } = await import("/src/clock.mjs");
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
          const { clockStage } = await import("/src/clock.mjs");
          return Math.atan2(
            clockStage.camera.position.x,
            clockStage.camera.position.z,
          );
        }),
      )
      .toBeCloseTo(0.2, 5);
    const frame = await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      return clockStage.renderer.info.render.frame;
    });
    await expect
      .poll(async () =>
        page.evaluate(async () => {
          const { clockStage } = await import("/src/clock.mjs");
          return clockStage.renderer.info.render.frame;
        }),
      )
      .toBeGreaterThan(frame + 1);
    const fit = await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      const { clockBounds } = await import("/src/apps/clock/framing.ts");
      return clockBounds.every((p) => {
        const q = clockStage.camera.position
          .clone()
          .set(...p)
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
