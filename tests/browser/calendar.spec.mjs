import { test, expect } from "@playwright/test";
test.use({ timezoneId: "Europe/Berlin" });
async function ready(page, time = "2026-01-03T11:00:00Z") {
  await page.clock.install({ time: new Date(time) });
  await page.clock.pauseAt(new Date(time));
  await page.goto("/calendar.html");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  await page.clock.runFor(100);
}
async function physical(page) {
  return page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    const { front, matches } = await import("/src/apps/calendar/model.ts");
    const c = calendarApp.controller;
    return {
      cells: front(c.physicalState).map((s) => s.image),
      valid: matches(c.physicalState, c.current.cells),
      bodies: new Set(c.physicalState.map((s) => s.cubie)).size,
      stickers: c.physicalState.length,
      busy: c.busy,
    };
  });
}
test("German A shows a physical weekday/day/month and renders responsively", async ({
  page,
}) => {
  await ready(page, "2024-02-29T11:00:00Z");
  expect(await physical(page)).toEqual({
    cells: ["D", "O", "", "", "2", "9", "F", "E", "B"],
    valid: true,
    bodies: 26,
    stickers: 54,
    busy: false,
  });
  await expect(page.locator("#calendar-digital")).toContainText("2024");
  await expect(page.locator("#calendar-padding-label")).toBeHidden();
  await page.screenshot({
    path: "test-results/calendar-de-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.runFor(100);
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({
    path: "test-results/calendar-de-mobile.png",
    fullPage: true,
  });
});
test("English 3 keeps the day adjacent and removes the zero with legal moves", async ({
  page,
}) => {
  await ready(page);
  await page.selectOption("#calendar-design", "en-3");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  expect((await physical(page)).cells).toEqual([
    "SAT",
    "",
    "",
    "J",
    "A",
    "N",
    "",
    "0",
    "3",
  ]);
  const source = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    return calendarApp.controller.design.printing;
  });
  await page.uncheck("#calendar-padding");
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect((await physical(page)).cells).toEqual([
    "SAT",
    "",
    "",
    "J",
    "A",
    "N",
    "",
    "",
    "3",
  ]);
  expect(
    await page.evaluate(async () => {
      const { calendarApp } = await import("/src/calendar.mjs");
      return calendarApp.controller.design.printing;
    }),
  ).toEqual(source);
  await page.clock.runFor(100);
  await page.screenshot({
    path: "test-results/calendar-en-desktop.png",
    fullPage: true,
  });
});
test("live date crosses leap-day midnight and inspection validates Gregorian dates", async ({
  page,
}) => {
  await ready(page, "2024-02-28T22:59:59Z");
  await page.clock.runFor(1100);
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect((await physical(page)).cells).toEqual([
    "D",
    "O",
    "",
    "",
    "2",
    "9",
    "F",
    "E",
    "B",
  ]);
  await page.fill("#calendar-date", "");
  await page.click("#calendar-set");
  await expect(page.locator("#calendar-error")).toContainText(
    "Use YYYY-MM-DD",
  );
  await page.fill("#calendar-date", "2000-02-29");
  await page.click("#calendar-set");
  await expect(page.locator("#calendar-state")).toHaveText("Selected date");
  expect((await physical(page)).cells).toEqual([
    "D",
    "I",
    "",
    "",
    "2",
    "9",
    "F",
    "E",
    "B",
  ]);
  await page.click("#calendar-live");
  await expect(page.locator("#calendar-state")).toHaveText("Live · local date");
  expect((await physical(page)).cells[0]).toBe("D");
  expect((await physical(page)).cells[1]).toBe("O");
});
test("real 3 by 3 animation preserves every legal intermediate pose", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/calendar.html");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  await page.selectOption("#calendar-speed", "10");
  await page.evaluate(async () => {
    const { CalendarViewer } = await import("/src/apps/calendar/viewer.ts");
    const { apply, sameState } = await import("/src/apps/calendar/model.ts");
    const animate = CalendarViewer.prototype.animate;
    window.calendarMoves = [];
    CalendarViewer.prototype.animate = async function (from, token, to) {
      if (
        !sameState(this.presentedState, from) ||
        !sameState(apply(from, token), to)
      )
        throw Error("Invalid actual physical move");
      await animate.call(this, from, token, to);
      window.calendarMoves.push({
        token,
        ok: sameState(this.presentedState, to),
      });
    };
  });
  await page.fill("#calendar-date", "2000-02-29");
  await page.click("#calendar-set");
  await expect(page.locator("#calendar-state")).toHaveText("Selected date");
  expect((await physical(page)).valid).toBe(true);
  const trace = await page.evaluate(() => window.calendarMoves);
  expect(trace.length).toBeGreaterThan(0);
  expect(trace.every((m) => m.ok)).toBe(true);
});
test("calendar rejects altered runtime and retains navigation", async ({
  page,
}) => {
  await page.route("**/calendar/de-a.json", async (route) => {
    const r = await route.fetch();
    await route.fulfill({
      response: r,
      body: (await r.text()).replace("MON", "XYZ") + " ",
    });
  });
  await page.goto("/calendar.html");
  await expect(page.locator("#calendar-error")).toHaveText(
    "Calendar integrity mismatch",
  );
  await expect(page.locator("#calendar-design")).toBeDisabled();
  await page.selectOption("#calendar-application", "clock.html");
  await expect(page).toHaveURL(/clock.html$/);
});
