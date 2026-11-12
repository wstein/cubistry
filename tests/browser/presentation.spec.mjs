import { test, expect } from "@playwright/test";

async function ready(page, path) {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-29T04:35:42Z");
  });
  await page.goto(path);
  // Every mode of the unified view has one Present button (#presentation-btn).
  if (path.includes("app=clock")) await expect(page.locator("#seconds-speed")).toBeEnabled({ timeout: 30000 });
  else await expect(page.locator("#calendar-design")).toBeEnabled({ timeout: 30000 });
  await expect(page.locator("#presentation-btn")).toBeEnabled();
}
async function clockState(page) {
  return page.evaluate(async () => {
    const { clockUnits } = await import("/src/apps/clock/live-mode.mjs");
    return clockUnits.map((u) => u.controller.state);
  });
}
async function frame(page, app) {
  const before = await page.evaluate(async (app) => {
    const renderer =
      app === "clock"
        ? (await import("/src/apps/clock/live-mode.mjs")).clockStage.renderer
        : window.__calendarViewer.renderer;
    return renderer.info.render.frame;
  }, app);
  await expect
    .poll(async () =>
      page.evaluate(async (app) => {
        const renderer =
          app === "clock"
            ? (await import("/src/apps/clock/live-mode.mjs")).clockStage.renderer
            : window.__calendarViewer.renderer;
        return renderer.info.render.frame;
      }, app),
    )
    .toBeGreaterThan(before + 1);
}

async function expectClockFitsPresentation(page, lettering, width) {
  await frame(page, "clock");
  expect(await page.locator("html").evaluate((e) => e.scrollWidth)).toBeLessThanOrEqual(
    width,
  );
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
  await page.screenshot({
    path: `test-results/presentation-clock-${lettering}-${width}.png`,
  });
}

for (const lettering of ["symbols", "words"])
  test(`native fullscreen presents the ${lettering} clock and restores controls without changing physical poses`, async ({
    page,
  }) => {
    await ready(page, `/index.html?app=clock&lettering=${lettering}`);
    const before = await clockState(page);
    await page.locator("#presentation-btn").click();
    await expect(page.locator("body")).toHaveClass(/presentation-mode/);
    await expect
      .poll(() => page.evaluate(() => Boolean(document.fullscreenElement)))
      .toBe(true);
    await expect(page.locator("#clock-digital")).toBeVisible();
    await expect(page.locator("#clock-status")).toBeVisible();
    await expect(page.locator("#clock-lettering")).not.toBeVisible();
    await expect(page.locator("header")).not.toBeVisible();
    await expect(page.locator("canvas")).toHaveCount(1);
    const canvas = page.locator("#studio-scene canvas");
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
      const { clockStage } = await import("/src/apps/clock/live-mode.mjs");
      const r = clockStage.presentation.rotation;
      return [-r.y, r.x];
    });
    expect(view[0]).toBeCloseTo(0.2, 5);
    expect(view[1]).toBeCloseTo(0.16, 5);
    // The window cannot be resized while it is natively fullscreen (Chromium
    // rejects Browser.setWindowBounds), so this test checks the fit at the
    // fullscreen size; the 1440 px and 390 px widths run in the next test
    // without native fullscreen.
    const width = await page.evaluate(() => window.innerWidth);
    await expectClockFitsPresentation(page, lettering, width);
    expect(await clockState(page)).toEqual(before);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
    await expect
      .poll(() => page.evaluate(() => document.fullscreenElement === null))
      .toBe(true);
    await expect(page.locator("#clock-lettering")).toBeVisible();
    expect(await clockState(page)).toEqual(before);
  });

for (const lettering of ["symbols", "words"])
  test(`presented ${lettering} clock fits the viewport at desktop and mobile widths`, async ({
    page,
  }) => {
    // Without native fullscreen the window can be resized (see above).
    await page.addInitScript(() => {
      Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
        configurable: true,
        value: undefined,
      });
    });
    await ready(page, `/index.html?app=clock&lettering=${lettering}`);
    const before = await clockState(page);
    await page.locator("#presentation-btn").click();
    await expect(page.locator("body")).toHaveClass(/presentation-mode/);
    await page.getByRole("button", { name: "Reference view" }).click();
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      await expectClockFitsPresentation(page, lettering, width);
    }
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
    await ready(page, "/index.html?app=calendar");
    await page.selectOption("#calendar-design", "en-3");
    await expect(page.locator("#calendar-front")).toContainText("THU");
    const before = await page.locator("#calendar-front").textContent();
    await page.locator("#presentation-btn").click();
    await expect(page.locator("body")).toHaveClass(/presentation-mode/);
    await expect(page.locator("#calendar-digital")).toBeVisible();
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
    await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
    await expect(page.locator("#calendar-date")).toBeVisible();
    await expect(page.locator("#calendar-front")).toHaveText(before);
  });

test("calendar physical motion continues through presentation", async ({
  page,
}) => {
  // In CI run 42363500526 (trace of the failed test) no assertion failed: the
  // 30 s default expired inside the second screenshot, 5.1 s after it began.
  // The planning gate took 5.2 s, the first-turn wait 6.4 s and the first
  // screenshot 5.4 s under SwiftShader; passing runs take 15 to 23 s.
  // Budget: 3x the slowest passing run.
  test.setTimeout(90000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      Promise.reject(Error("Layout-only test"));
  });
  await ready(page, "/index.html?app=calendar");
  await page.selectOption("#calendar-speed", "10");
  await page.evaluate(async () => {
    window.presentationProgress = () => window.__calendarController.progress;
    // Hold planning independently of animation so this test cannot confuse
    // the valid solver planning phase with a missing first physical turn.
    const postMessage = Worker.prototype.postMessage;
    let firstPlan = true;
    Worker.prototype.postMessage = function (...args) {
      if (firstPlan && args[0]?.context?.design?.id === "de-a") {
        firstPlan = false;
        window.releasePresentationPlan = () => postMessage.apply(this, args);
        return;
      }
      return postMessage.apply(this, args);
    };
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
    .poll(() => page.evaluate(() => typeof window.releasePresentationPlan))
    .toBe("function");
  expect(
    await page.evaluate(() => window.presentationProgress().planning),
  ).toBe(true);
  expect(
    await page.evaluate(() => typeof window.releasePresentationTurn),
  ).toBe("undefined");
  await page.evaluate(() => window.releasePresentationPlan());
  // The optimizer may legitimately plan for up to eight seconds. Wait for
  // this request's planning phase within the existing test budget, then apply
  // the ordinary first-turn assertion. Do not impose a five-second solve SLA.
  await page.waitForFunction(() => {
    const progress = window.presentationProgress();
    return (
      progress.target?.weekday === 6 &&
      progress.target.day === 1 &&
      progress.target.month === 11 &&
      !progress.planning
    );
  });
  await expect
    .poll(() => page.evaluate(() => typeof window.releasePresentationTurn))
    .toBe("function");
  await page.locator("#presentation-btn").click();
  await expect(page.locator("body")).toHaveClass(/presentation-mode/);
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
    const { matches, sameState } = await import("/src/apps/calendar/model.ts");
    const c = window.__calendarController;
    return (
      matches(c.physicalState, c.current.cells) &&
      sameState(c.physicalState, window.__calendarViewer.presentedState)
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
  await page.keyboard.press("Escape");
  await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
  await expect(page.locator("#calendar-date")).toHaveValue("2026-11-01");
});

test("leaving presentation while a fullscreen request is pending cannot reenter it later", async ({
  page,
}) => {
  await page.addInitScript(() => {
    HTMLElement.prototype.requestFullscreen = () =>
      new Promise((resolve) => (window.completeFullscreenRequest = resolve));
  });
  await ready(page, "/index.html?app=clock");
  await page.locator("#presentation-btn").click();
  await page.keyboard.press("Escape");
  await page.evaluate(() => window.completeFullscreenRequest());
  await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
  await expect(page.locator("#clock-lettering")).toBeVisible();
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
    await ready(page, "/index.html?app=clock");
    await page.locator("#presentation-btn").click();
    await page.keyboard.press("Escape");
    await page.locator("#presentation-btn").click();
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
    await expect(page.locator("body")).toHaveClass(/presentation-mode/);
    expect(await page.evaluate(() => window.fullscreenExits)).toBe(0);
    await page.keyboard.press("Escape");
    await expect(page.locator("body")).not.toHaveClass(/presentation-mode/);
    expect(await page.evaluate(() => window.fullscreenExits)).toBe(1);
  });
