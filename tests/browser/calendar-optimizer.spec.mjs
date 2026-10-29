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
  // update() loads the print asynchronously; an initial aria-busy=false can
  // precede request(). Wait for the requested endpoint as well as idle.
  await expect
    .poll(
      () =>
        page.evaluate(async (date) => {
          const { calendarApp } = await import("/src/calendar.mjs");
          const c = calendarApp.controller;
          const [, month, day] = date.split("-").map(Number);
          return !c.busy && c.current.month === month && c.current.day === day;
        }, iso),
      { timeout: 15000 },
    )
    .toBe(true);
}
for (const design of ["de-a", "en-3"])
  test(`real worker shortens ${design} date changes and retains the selected print`, async ({
    page,
  }) => {
    await ready(page);
    if (design !== "de-a") await page.selectOption("#calendar-design", design);
    await expect(page.locator("#calendar-design")).toBeEnabled();
    const before = await page.evaluate(async () => {
      const { CalendarViewer } = await import("/src/apps/calendar/viewer.ts");
      const animate = CalendarViewer.prototype.animate;
      window.calendarFirstMoveTimes = [];
      CalendarViewer.prototype.animate = function (...args) {
        window.calendarFirstMoveTimes.push(performance.now());
        return animate.apply(this, args);
      };
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
      const timingStart = await page.evaluate(() => performance.now());
      await pick(page, iso);
      if (records.length === 0)
        await expect(page.locator("#calendar-route")).toHaveText(
          "Optimized physical route",
          { timeout: 15000 },
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
      const timing = await page.evaluate(
        (started) => ({
          firstMoveMs:
            window.calendarFirstMoveTimes.find((t) => t >= started) - started,
          settledMs: performance.now() - started,
        }),
        timingStart,
      );
      records.push({ iso, ...state.progress, timing });
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

test("changing a date during motion finishes one turn then replans from that exact physical pose", async ({
  page,
}) => {
  let documentNavigations = 0;
  page.on("framenavigated", (frame) => {
    if (frame === page.mainFrame()) documentNavigations++;
  });
  await ready(page);
  const documentToken = await page.evaluate(() => {
    window.calendarDocumentToken = crypto.randomUUID();
    return window.calendarDocumentToken;
  });
  await page.evaluate(async () => {
    const { CalendarViewer } = await import("/src/apps/calendar/viewer.ts");
    const { CalendarController } = await import(
      "/src/apps/calendar/controller.ts"
    );
    const { apply, sameState } = await import("/src/apps/calendar/model.ts");
    const animate = CalendarViewer.prototype.animate;
    const request = CalendarController.prototype.request;
    window.interruptedMoves = [];
    window.interruptedRequests = [];
    let first = true;
    window.interruptedPlanningStart = performance.now();
    CalendarController.prototype.request = function (target) {
      window.interruptedRequests.push(target.day);
      return request.call(this, target);
    };
    CalendarViewer.prototype.animate = async function (from, token, to) {
      if (
        !sameState(this.presentedState, from) ||
        !sameState(apply(from, token), to)
      )
        throw Error("Broken partial-route frame");
      const { calendarApp } = await import("/src/calendar.mjs");
      const day = calendarApp.controller.progress.target.day;
      if (first) {
        first = false;
        window.interruptedFirstMoveMs =
          performance.now() - window.interruptedPlanningStart;
        await new Promise((resolve) => {
          window.releaseInterruptedMove = resolve;
        });
      }
      await animate.call(this, from, token, to);
      window.interruptedMoves.push({
        day,
        token,
        from,
        to,
        valid: sameState(this.presentedState, to),
      });
    };
  });
  await page.fill("#calendar-date", "2026-10-29");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect
    .poll(() => page.evaluate(() => typeof window.releaseInterruptedMove), {
      timeout: 15000,
    })
    .toBe("function");
  for (const iso of ["2026-10-30", "2026-11-01"]) {
    await page.fill("#calendar-date", iso);
    await page.locator("#calendar-date").dispatchEvent("change");
  }
  await page.evaluate(() => window.releaseInterruptedMove());
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
    { timeout: 15000 },
  );
  const result = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    const { matches, sameState } = await import("/src/apps/calendar/model.ts");
    const c = calendarApp.controller,
      trace = window.interruptedMoves;
    return {
      valid: matches(c.physicalState, c.current.cells),
      day: c.current.day,
      month: c.current.month,
      oldMoves: trace.filter((t) => t.day === 29).length,
      discardedMoves: trace.filter((t) => t.day === 30).length,
      continuity: trace.every(
        (t, i) => t.valid && (!i || sameState(trace[i - 1].to, t.from)),
      ),
      progress: c.progress,
      firstMoveMs: window.interruptedFirstMoveMs,
      trace,
    };
  });
  expect(documentNavigations).toBe(1);
  expect(await page.evaluate(() => window.calendarDocumentToken)).toBe(
    documentToken,
  );
  expect(result.valid).toBe(true);
  expect(result.day).toBe(1);
  expect(result.month).toBe(11);
  expect(result.oldMoves).toBe(1);
  expect(result.discardedMoves).toBe(0);
  expect(result.continuity).toBe(true);
  expect(result.progress.completed).toEqual(result.progress.total);
  writeFileSync(
    "test-results/calendar-interrupted-route.json",
    JSON.stringify(result, null, 2),
  );
});
