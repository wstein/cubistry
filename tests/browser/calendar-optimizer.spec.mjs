import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
async function ready(page) {
  await page.addInitScript(() => {
    Date.now = () => new Date("2026-10-28T11:00:00Z").getTime();
  });
  await page.goto("/calendar.html");
  await expect(page.locator("#calendar-design")).toBeEnabled();
}
async function pick(page, iso) {
  await page.fill("#calendar-date", iso);
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 15000 },
  );
}
for (const design of ["de-a", "en-3"])
  test(`real worker shortens ${design} date changes and retains the selected print`, async ({
    page,
  }) => {
    await ready(page);
    if (design !== "de-a") await page.selectOption("#calendar-design", design);
    await expect(page.locator("#calendar-design")).toBeEnabled();
    const before = await page.evaluate(async () => {
      const { calendarApp } = await import("/src/calendar.mjs");
      return calendarApp.controller.design.printing;
    });
    const records = [];
    for (const iso of [
      "2026-10-29",
      "2026-10-30",
      "2026-10-29",
      "2026-10-28",
    ]) {
      await pick(page, iso);
      if (records.length === 0)
        await expect(page.locator("#calendar-route")).toHaveText(
          "Optimized physical route",
        );
      else
        await expect(page.locator("#calendar-route")).toHaveText(
          /Optimized physical route|Verified baseline route/,
        );
      const state = await page.evaluate(async () => {
        const { calendarApp } = await import("/src/calendar.mjs");
        const { matches } = await import("/src/apps/calendar/model.ts");
        const c = calendarApp.controller;
        return {
          progress: c.progress,
          printing: c.design.printing,
          cells: c.current.cells,
          valid: matches(c.physicalState, c.current.cells),
        };
      });
      expect(state.valid).toBe(true);
      expect(state.printing).toEqual(before);
      expect(state.progress.completed).toEqual(state.progress.total);
      if (records.length === 0)
        expect(
          state.progress.total.htm + state.progress.total.rotations,
        ).toBeLessThanOrEqual(22);
      if (design === "de-a")
        expect(state.cells.slice(6)).toEqual(["O", "K", "T"]);
      records.push({ iso, ...state.progress });
    }
    writeFileSync(
      `test-results/calendar-optimized-${design}.json`,
      JSON.stringify(records, null, 2),
    );
    await page.screenshot({
      path: `test-results/calendar-optimized-${design}.png`,
    });
  });
test("a persisted pagehide does not disable optimized planning after restoration", async ({
  page,
}) => {
  await ready(page);
  await pick(page, "2026-10-29");
  await page.evaluate(() => {
    dispatchEvent(new PageTransitionEvent("pagehide", { persisted: true }));
    dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true }));
  });
  await pick(page, "2026-10-30");
  await expect(page.locator("#calendar-route")).toHaveText(
    "Optimized physical route",
  );
});
test("a blocked worker visibly uses the verified baseline rather than claiming optimization", async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.Worker = class {
      constructor() {
        throw Error("Blocked for fallback regression");
      }
    };
  });
  await ready(page);
  await pick(page, "2026-10-29");
  await expect(page.locator("#calendar-route")).toContainText(
    "Verified baseline route",
  );
  const result = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    const { matches } = await import("/src/apps/calendar/model.ts");
    const c = calendarApp.controller;
    return {
      route: c.progress.route,
      total: c.progress.total,
      valid: matches(c.physicalState, c.current.cells),
    };
  });
  expect(result).toEqual({
    route: "fallback",
    total: { htm: 79, rotations: 0 },
    valid: true,
  });
});
