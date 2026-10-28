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
  await page.setViewportSize({ width: 390, height: 844 });
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
