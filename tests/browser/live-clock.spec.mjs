import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
test.use({ timezoneId: "Europe/Berlin" });
async function ready(page, time) {
  await page.clock.install({ time: new Date(time) });
  await page.clock.pauseAt(new Date(time));
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
}
async function physical(page) {
  return page.evaluate(async () => {
    const { clockUnits } = await import("/src/clock.mjs");
    const { validateHsmDesign, hsmTarget } = await import(
      "/src/apps/hsm/design.ts"
    );
    const { matchesTarget } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const d = validateHsmDesign(
      await (await fetch("/hsm-counter.v2.json")).json(),
    );
    return clockUnits.map((u, i) => ({
      value: u.controller.currentValue,
      valid: matchesTarget(
        d.print,
        u.controller.state,
        hsmTarget(["H", "M", "S"][i], u.controller.currentValue),
      ),
    }));
  });
}
test("live H M S clock initializes from one local instant with real blanks and independent speeds", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  await expect(page.locator("#clock-digital")).toHaveText("12:34:56");
  await expect(page.locator("#clock-zone")).toHaveText("Europe/Berlin");
  for (const [name, value, speed] of [
    ["hours", 12, "500"],
    ["minutes", 34, "250"],
    ["seconds", 56, "100"],
  ]) {
    await expect(page.locator("#clock-" + name)).toHaveAttribute(
      "data-value",
      String(value),
    );
    await expect(page.locator("#" + name + "-speed")).toHaveValue(speed);
  }
  expect(await physical(page)).toEqual([
    { value: 12, valid: true },
    { value: 34, valid: true },
    { value: 56, valid: true },
  ]);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(async () => {
      const { clockUnits, clockStage } = await import("/src/clock.mjs");
      const cubes = clockStage.scene.children.filter((o) => o.type === "Group");
      return {
        roots: cubes.length,
        positions: cubes.map((c) => c.position.x),
        renderers: clockUnits.every(
          (u) => u.controller.view.renderer === clockStage.renderer,
        ),
        cameras: clockUnits.every(
          (u) => u.controller.view.camera === clockStage.camera,
        ),
        groups: clockUnits.every(
          (u) => u.controller.view.scene.parent === clockStage.scene,
        ),
        bodies: cubes.map((c) => c.children.length),
      };
    }),
  ).toEqual({
    roots: 3,
    positions: [-2.8, 0, 2.8],
    renderers: true,
    cameras: true,
    groups: true,
    bodies: [8, 8, 8],
  });
  await page.clock.runFor(100);
  const canvas = page.locator("#clock-scene canvas"),
    box = await canvas.boundingBox();
  const before = await page.evaluate(async () => {
    const { clockStage } = await import("/src/clock.mjs");
    return clockStage.camera.position.toArray();
  });
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 25, box.y + box.height / 2 + 8);
  await page.mouse.up();
  await page.clock.runFor(50);
  expect(
    await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      return clockStage.camera.position.toArray();
    }),
  ).not.toEqual(before);
  expect((await physical(page)).every((u) => u.valid)).toBe(true);
  await page.screenshot({
    path: "test-results/live-clock-shared-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/live-clock-mobile.png",
    fullPage: true,
  });
});
test("midnight wrap schedules all three final turns to the same target instant", async ({
  page,
}) => {
  await ready(page, "2026-12-31T22:59:56Z");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate;
    window.clockEndpoints = [];
    CubeViewer.prototype.animate = async function (p, timing) {
      const end = timing?.();
      await animate.call(this, p, timing);
      if (end)
        window.clockEndpoints.push({
          unit: this.host.dataset.unit,
          endAt: end.endAt,
          settled: performance.now(),
        });
    };
  });
  await page.clock.runFor(4050);
  await expect(page.locator("#clock-digital")).toHaveText("00:00:00");
  expect(await physical(page)).toEqual([
    { value: 0, valid: true },
    { value: 0, valid: true },
    { value: 0, valid: true },
  ]);
  const final = await page.evaluate(() =>
    ["H", "M", "S"].map((unit) =>
      window.clockEndpoints.filter((e) => e.unit === unit).at(-1),
    ),
  );
  expect(final.every(Boolean)).toBe(true);
  expect(new Set(final.map((e) => e.endAt)).size).toBe(1);
  for (const e of final)
    expect(Math.abs(e.settled - e.endAt)).toBeLessThanOrEqual(30);
});
test("returning from suspension synchronizes to live seconds without a missed-tick backlog", async ({
  page,
}) => {
  await ready(page, "2026-10-28T11:34:56Z");
  await page.clock.fastForward(30000);
  await page.clock.runFor(100);
  await expect(page.locator("#clock-digital")).toHaveText("12:35:26");
  const values = await physical(page);
  expect(values.every((v) => v.valid)).toBe(true);
  expect(values[2].value).toBe(26);
  await page.selectOption(
    "#clock-application",
    "index.html?application=hsm-counter",
  );
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
});
test("real animation ends all three midnight sequences at the shared live deadline", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    const start = performance.now(),
      epoch = Date.parse("2026-12-31T22:59:54Z");
    Date.now = () => epoch + performance.now() - start;
  });
  await page.goto("/clock.html");
  await expect(page.locator("#seconds-speed")).toBeEnabled();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate;
    window.realClockEndpoints = [];
    window.realClockMoves = [];
    CubeViewer.prototype.animate = async function (p, timing) {
      const endpoint = timing?.();
      await animate.call(this, p, timing);
      window.realClockMoves.push({
        unit: this.host.dataset.unit,
        presentation: p,
      });
      if (endpoint)
        window.realClockEndpoints.push({
          unit: this.host.dataset.unit,
          endAt: endpoint.endAt,
          settled: performance.now(),
          state: p.to,
        });
    };
  });
  await expect(page.locator("#clock-digital")).toHaveText("00:00:00", {
    timeout: 12000,
  });
  await expect
    .poll(() =>
      page.evaluate(() =>
        ["H", "M", "S"].every((unit) =>
          window.realClockEndpoints.some((e) => e.unit === unit),
        ),
      ),
    )
    .toBe(true);
  const endpoints = await page.evaluate(() =>
    ["H", "M", "S"].map((unit) =>
      window.realClockEndpoints.filter((e) => e.unit === unit).at(-1),
    ),
  );
  expect(endpoints.every(Boolean)).toBe(true);
  expect(new Set(endpoints.map((e) => e.endAt)).size).toBe(1);
  for (const e of endpoints)
    expect(Math.abs(e.settled - e.endAt)).toBeLessThanOrEqual(150);
  // Inspect the exact committed endpoint, not a later instant when S may already
  // be moving toward01. The digital clock remains live throughout that motion.
  const proof = await page.evaluate(async () => {
    const { validateHsmDesign, hsmTarget } = await import(
      "/src/apps/hsm/design.ts"
    );
    const { matchesTarget } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const design = validateHsmDesign(
      await (await fetch("/hsm-counter.v2.json")).json(),
    );
    const endpoints = ["H", "M", "S"].map((unit) =>
      window.realClockEndpoints.filter((e) => e.unit === unit).at(-1),
    );
    return {
      print: design.print,
      endpoints,
      moves: window.realClockMoves,
      valid: endpoints.every((e) =>
        matchesTarget(design.print, e.state, hsmTarget(e.unit, 0)),
      ),
    };
  });
  expect(proof.valid).toBe(true);
  writeFileSync(
    "test-results/live-clock-real-endpoints.json",
    JSON.stringify(proof),
  );
});
test.describe("high-density shared clock viewport", () => {
  test.use({ deviceScaleFactor: 2 });
  test("one canvas fits all three cubes without overflowing into controls", async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Date.now = () => Date.parse("2026-10-28T11:34:56Z");
    });
    await page.goto("/clock.html");
    await expect(page.locator("#seconds-speed")).toBeEnabled();
    for (const viewport of [
      { width: 1440, height: 1000 },
      { width: 390, height: 844 },
    ]) {
      const previous = await page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        return clockStage.renderer.info.render.frame;
      });
      await page.setViewportSize(viewport);
      await expect
        .poll(() =>
          page.evaluate(async (previous) => {
            const { clockStage } = await import("/src/clock.mjs");
            return (
              clockStage.renderer.info.render.frame > previous + 2 &&
              clockStage.renderer.domElement.width ===
                Math.floor(
                  document.getElementById("clock-scene").clientWidth *
                    clockStage.renderer.getPixelRatio(),
                )
            );
          }, previous),
        )
        .toBe(true);
      await expect(page.locator("canvas")).toHaveCount(1);
      const host = await page.locator("#clock-scene").boundingBox(),
        canvas = await page.locator("#clock-scene canvas").boundingBox(),
        controls = await page.locator(".clock-cubes").boundingBox();
      expect(Math.abs(host.width - canvas.width)).toBeLessThan(1);
      expect(Math.abs(host.height - canvas.height)).toBeLessThan(1);
      expect(canvas.y + canvas.height).toBeLessThanOrEqual(controls.y + 1);
      expect(
        await page.locator("html").evaluate((e) => e.scrollWidth),
      ).toBeLessThanOrEqual(viewport.width);
      const points = await page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        clockStage.camera.updateMatrixWorld();
        return clockStage.scene.children
          .filter((o) => o.type === "Group")
          .flatMap((root) =>
            [-1.1, 1.1].flatMap((x) =>
              [-1.1, 1.1].flatMap((y) =>
                [-1.1, 1.1].map((z) =>
                  root.position
                    .clone()
                    .set(x, y, z)
                    .add(root.position)
                    .project(clockStage.camera)
                    .toArray(),
                ),
              ),
            ),
          );
      });
      expect(
        points.every(
          (p) =>
            Math.abs(p[0]) < 0.95 &&
            Math.abs(p[1]) < 0.95 &&
            p[2] > -1 &&
            p[2] < 1,
        ),
      ).toBe(true);
      await page.screenshot({
        path: `test-results/live-clock-shared-dpr2-${viewport.width}.png`,
        fullPage: true,
      });
    }
  });
});
