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
