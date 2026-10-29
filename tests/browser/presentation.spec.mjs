import { test, expect } from "@playwright/test";

async function ready(page, path) {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-29T04:35:42Z");
  });
  await page.goto(path);
  await expect(page.locator("#presentation-toggle")).toBeEnabled();
}
async function clockState(page) {
  return page.evaluate(async () => {
    const { clockUnits } = await import("/src/clock.mjs");
    return clockUnits.map((u) => u.controller.state);
  });
}
async function frame(page, app) {
  const before = await page.evaluate(async (app) => {
    const renderer =
      app === "clock"
        ? (await import("/src/clock.mjs")).clockStage.renderer
        : (await import("/src/calendar.mjs")).calendarApp.viewer.renderer;
    return renderer.info.render.frame;
  }, app);
  await expect
    .poll(async () =>
      page.evaluate(async (app) => {
        const renderer =
          app === "clock"
            ? (await import("/src/clock.mjs")).clockStage.renderer
            : (await import("/src/calendar.mjs")).calendarApp.viewer.renderer;
        return renderer.info.render.frame;
      }, app),
    )
    .toBeGreaterThan(before + 1);
}

for (const lettering of ["symbols", "words"])
  test(`native fullscreen presents the ${lettering} clock and restores controls without changing physical poses`, async ({
    page,
  }) => {
    await ready(page, `/clock.html?lettering=${lettering}`);
    const before = await clockState(page);
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "true",
    );
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await expect(page.locator("#clock-digital")).toBeVisible();
    await expect(page.locator("#clock-status")).toBeVisible();
    await expect(page.locator("#seconds-speed")).not.toBeVisible();
    await expect(page.locator("header")).not.toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    const canvas = page.locator("#clock-scene canvas");
    const box = await canvas.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      box.x + box.width / 2 + 30,
      box.y + box.height / 2 + 20,
    );
    await page.mouse.up();
    await page.getByRole("button", { name: "Reference view" }).click();
    await frame(page, "clock");
    const view = await page.evaluate(async () => {
      const { clockStage } = await import("/src/clock.mjs");
      const p = clockStage.camera.position;
      return [Math.atan2(p.x, p.z), Math.atan2(p.y, Math.hypot(p.x, p.z))];
    });
    expect(view[0]).toBeCloseTo(0.2, 5);
    expect(view[1]).toBeCloseTo(0.16, 5);
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await frame(page, "clock");
      expect(
        await page.locator("html").evaluate((e) => e.scrollWidth),
      ).toBeLessThanOrEqual(width);
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
      await page.screenshot({
        path: `test-results/presentation-clock-${lettering}-${width}.png`,
      });
    }
    expect(await clockState(page)).toEqual(before);
    await page
      .getByRole("button", { name: "Show controls", exact: true })
      .click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "false",
    );
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    await expect(page.locator("#seconds-speed")).toBeVisible();
    expect(await clockState(page)).toEqual(before);
  });

for (const mode of ["unsupported", "rejected"])
  test(`calendar presentation remains usable when fullscreen is ${mode}`, async ({
    page,
  }) => {
    await page.addInitScript((mode) => {
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
        configurable: true,
        value:
          mode === "unsupported"
            ? undefined
            : () => Promise.reject(Error("Rejected for test")),
      });
    }, mode);
    await ready(page, "/calendar.html");
    await page.selectOption("#calendar-design", "en-3");
    await expect(page.locator("#calendar-front")).toContainText("THU");
    const before = await page.locator("#calendar-front").textContent();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "true",
    );
    await expect(page.locator("#presentation-feedback")).toContainText(
      "Fullscreen is unavailable",
    );
    await expect(page.locator("#calendar-digital")).toBeVisible();
    await expect(page.locator("#calendar-date")).not.toBeVisible();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await frame(page, "calendar");
      expect(
        await page.locator("html").evaluate((e) => e.scrollWidth),
      ).toBeLessThanOrEqual(width);
      await expect(page.locator("#calendar-front")).toHaveText(before);
      await page.screenshot({
        path: `test-results/presentation-calendar-en-${mode}-${width}.png`,
      });
    }
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "false",
    );
    await expect(page.locator("#calendar-date")).toBeVisible();
    await expect(page.locator("#presentation-toggle")).toBeFocused();
    await expect(page.locator("#calendar-front")).toHaveText(before);
  });

test("calendar physical motion continues through presentation and reference-view reset", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(Error("Layout-only test"));
  });
  await ready(page, "/calendar.html");
  await page.selectOption("#calendar-speed", "10");
  await page.evaluate(async () => {
    const { CalendarViewer } = await import("/src/apps/calendar/viewer.ts");
    const animate = CalendarViewer.prototype.animate;
    let first = true;
    CalendarViewer.prototype.animate = async function (...args) {
      if (first) {
        first = false;
        await new Promise(
          (resolve) => (window.releasePresentationTurn = resolve),
        );
      }
      return animate.apply(this, args);
    };
  });
  await page.fill("#calendar-date", "2026-11-01");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect
    .poll(() => page.evaluate(() => typeof window.releasePresentationTurn))
    .toBe("function");
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await page.getByRole("button", { name: "Reference view" }).click();
  await page.evaluate(() => window.releasePresentationTurn());
  await expect(page.locator("#calendar-front")).toHaveText(
    "S · O · blank · blank · 0 · 1 · N · O · V",
    { timeout: 15000 },
  );
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  const valid = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    const { matches, sameState } = await import("/src/apps/calendar/model.ts");
    const c = calendarApp.controller;
    return (
      matches(c.physicalState, c.current.cells) &&
      sameState(c.physicalState, calendarApp.viewer.presentedState)
    );
  });
  expect(valid).toBe(true);
  await expect(page.locator("#calendar-state")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(1);
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await frame(page, "calendar");
    await page.screenshot({
      path: `test-results/presentation-calendar-de-${width}.png`,
    });
  }
  await page
    .getByRole("button", { name: "Show controls", exact: true })
    .click();
  await expect(page.locator("#calendar-date")).toHaveValue("2026-11-01");
});

test("leaving presentation while a fullscreen request is pending cannot reenter it later", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      new Promise((resolve) => (window.completeFullscreenRequest = resolve));
  });
  await ready(page, "/clock.html");
  await page.getByRole("button", { name: "Present", exact: true }).click();
  await page
    .getByRole("button", { name: "Show controls", exact: true })
    .click();
  await page.evaluate(() => window.completeFullscreenRequest());
  await expect(page.locator("body")).toHaveAttribute(
    "data-presentation",
    "false",
  );
  await expect(page.locator("#seconds-speed")).toBeVisible();
});

for (const latest of ["resolved", "rejected"])
  test(`an old fullscreen completion respects a newer ${latest} presentation request`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.fullscreenRequests = [];
      window.fullscreenExits = 0;
      window.testFullscreen = null;
      Object.defineProperty(document, "fullscreenElement", {
        configurable: true,
        get: () => window.testFullscreen,
      });
      HTMLElement.prototype.requestFullscreen = () =>
        new Promise((resolve, reject) =>
          window.fullscreenRequests.push({ resolve, reject }),
        );
      document.exitFullscreen = async () => {
        window.fullscreenExits++;
        window.testFullscreen = null;
        document.dispatchEvent(new Event("fullscreenchange"));
      };
    });
    await ready(page, "/clock.html");
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page
      .getByRole("button", { name: "Show controls", exact: true })
      .click();
    await page.getByRole("button", { name: "Present", exact: true }).click();
    await page.evaluate((latest) => {
      if (latest === "resolved") {
        window.testFullscreen = document.documentElement;
        window.fullscreenRequests[1].resolve();
      } else
        window.fullscreenRequests[1].reject(
          Error("Rejected for latest request"),
        );
    }, latest);
    await page.evaluate(() => {
      window.testFullscreen = document.documentElement;
      window.fullscreenRequests[0].resolve();
    });
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "true",
    );
    expect(await page.evaluate(() => window.fullscreenExits)).toBe(0);
    await page
      .getByRole("button", { name: "Show controls", exact: true })
      .click();
    await expect(page.locator("body")).toHaveAttribute(
      "data-presentation",
      "false",
    );
    expect(await page.evaluate(() => window.fullscreenExits)).toBe(1);
  });
