import { test, expect } from "@playwright/test";
import { writeFileSync } from "node:fs";
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
async function artFits(page) {
  const bad = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    const { stickerArt } = await import("/src/apps/calendar/artwork.ts");
    const ctx = document.createElement("canvas").getContext("2d");
    return calendarApp.controller.design.printing
      .filter((s) => {
        ctx.font = `${stickerArt(s).weight} ${stickerArt(s).size}px "Counter Sans"`;
        const m = ctx.measureText(s.image);
        return (
          m.width > 228 ||
          m.actualBoundingBoxAscent + m.actualBoundingBoxDescent > 228
        );
      })
      .map((s) => s.image);
  });
  expect(bad).toEqual([]);
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
  await artFits(page);
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
  await artFits(page);
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
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-error")).toContainText("Use YYYY-MM-DD");
  await page.fill("#calendar-date", "2000-02-29");
  await page.locator("#calendar-date").dispatchEvent("change");
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
        from,
        token,
        to,
        ok: sameState(this.presentedState, to),
      });
    };
  });
  await page.fill("#calendar-date", "2000-02-29");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-state")).toHaveText("Selected date", {
    timeout: 15000,
  });
  expect((await physical(page)).valid).toBe(true);
  const trace = await page.evaluate(() => window.calendarMoves);
  expect(trace.length).toBeGreaterThan(0);
  expect(trace.every((m) => m.ok)).toBe(true);
  const evidence = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    return {
      printing: calendarApp.controller.design.printing,
      moves: window.calendarMoves,
      target: calendarApp.controller.current,
    };
  });
  writeFileSync(
    "test-results/calendar-physical-trace.json",
    JSON.stringify(evidence),
  );
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
test("selecting today refreshes Live and Inspecting status without moving stickers", async ({
  page,
}) => {
  await ready(page);
  await expect(
    page.getByRole("button", { name: "Today", exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Show date", exact: true }),
  ).toHaveCount(0);
  const before = await physical(page);
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-state")).toHaveText("Selected date");
  await expect(page.locator("#calendar-zone")).toHaveText(
    "Europe/Berlin · Inspecting",
  );
  await expect(page.locator("#calendar-live")).toHaveAttribute(
    "aria-pressed",
    "false",
  );
  expect(await physical(page)).toEqual(before);
  await page.click("#calendar-live");
  await expect(page.locator("#calendar-state")).toHaveText("Live · local date");
  await expect(page.locator("#calendar-zone")).toHaveText(
    "Europe/Berlin · Live",
  );
  await expect(page.locator("#calendar-live")).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  expect(await physical(page)).toEqual(before);
});
test.describe("high-density calendar framing", () => {
  test.use({ deviceScaleFactor: 2 });
  test("German and English cubes stay inside the viewport and clear of date controls", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.addInitScript(() => {
      const epoch = Date.parse("2026-11-07T11:00:00Z");
      Date.now = () => epoch;
    });
    await page.goto("/calendar.html");
    await expect(page.locator("#calendar-design")).toBeEnabled();
    await page.locator("#calendar-date").dispatchEvent("change");
    for (const design of ["de-a", "en-3"]) {
      await page.selectOption("#calendar-design", design);
      await expect(page.locator("#calendar-design")).toBeEnabled();
      if (design === "en-3") {
        await page.uncheck("#calendar-padding");
        await expect(page.locator("#calendar-viewer")).toHaveAttribute(
          "aria-busy",
          "false",
          { timeout: 15000 },
        );
        await expect
          .poll(
            async () => {
              const actual = await physical(page);
              return actual.busy ? null : actual.cells;
            },
            { timeout: 15000 },
          )
          .toEqual(["SAT", "", "", "N", "O", "V", "", "", "7"]);
      }
      for (const viewport of [
        { width: 1440, height: 1100 },
        { width: 390, height: 844 },
      ]) {
        const previousFrame = await page.evaluate(async () => {
          const { calendarApp } = await import("/src/calendar.mjs");
          return calendarApp.viewer.renderer.info.render.frame;
        });
        await page.setViewportSize(viewport);
        await page.locator("#calendar-viewer").scrollIntoViewIfNeeded();
        await expect
          .poll(
            async () =>
              page.evaluate(async () => {
                const { calendarApp } = await import("/src/calendar.mjs");
                return calendarApp.viewer.renderer.info.render.frame;
              }),
            { timeout: 15000 },
          )
          .toBeGreaterThan(previousFrame + 1);
        await expect(page.locator("#calendar-viewer canvas")).toHaveCount(1);
        const host = await page.locator("#calendar-viewer").boundingBox(),
          canvas = await page.locator("#calendar-viewer canvas").boundingBox(),
          controls = await page.locator(".calendar-controls").boundingBox();
        expect(Math.abs(canvas.width - host.width)).toBeLessThan(1);
        expect(Math.abs(canvas.height - host.height)).toBeLessThan(1);
        expect(canvas.x).toBeGreaterThanOrEqual(host.x);
        expect(canvas.y).toBeGreaterThanOrEqual(host.y);
        expect(canvas.x + canvas.width).toBeLessThanOrEqual(
          host.x + host.width + 1,
        );
        expect(canvas.y + canvas.height).toBeLessThanOrEqual(
          host.y + host.height + 1,
        );
        expect(
          canvas.x + canvas.width <= controls.x ||
            controls.y + controls.height <= canvas.y,
        ).toBe(true);
        expect(
          await page.locator("html").evaluate((e) => e.scrollWidth),
        ).toBeLessThanOrEqual(viewport.width);
        const framing = await page.evaluate(async () => {
          const { calendarApp } = await import("/src/calendar.mjs");
          const viewer = calendarApp.viewer;
          viewer.camera.updateMatrixWorld();
          const projected = [-1.55, 1.55].flatMap((x) =>
            [-1.55, 1.55].flatMap((y) =>
              [-1.55, 1.55].map((z) =>
                viewer.camera.position
                  .clone()
                  .set(x, y, z)
                  .project(viewer.camera)
                  .toArray(),
              ),
            ),
          );
          return { projected, distance: viewer.camera.position.length() };
        });
        expect(framing.distance).toBeGreaterThan(12);
        expect(
          framing.projected.every(
            (p) =>
              Math.abs(p[0]) < 0.9 &&
              Math.abs(p[1]) < 0.9 &&
              p[2] > -1 &&
              p[2] < 1,
          ),
        ).toBe(true);
        expect((await physical(page)).valid).toBe(true);
        await page.screenshot({
          path: `test-results/calendar-framing-${design}-${viewport.width}-dpr2.png`,
          fullPage: true,
        });
      }
    }
  });
});
test("English Saturday and both Sunday source stickers stay permanently red and extra-bold", async ({
  page,
}) => {
  await ready(page, "2026-11-07T11:00:00Z");
  await page.selectOption("#calendar-design", "en-3");
  await expect(page.locator("#calendar-design")).toBeEnabled();
  const seen = [];
  for (const [iso, image] of [
    ["2026-11-07", "SAT"],
    ["2026-11-08", "SUN"],
    ["2026-11-01", "SUN"],
    ["2026-11-09", "MON"],
  ]) {
    await page.fill("#calendar-date", iso);
    await page.locator("#calendar-date").dispatchEvent("change");
    await expect(page.locator("#calendar-viewer")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const actual = await page.evaluate(async () => {
      const { calendarApp } = await import("/src/calendar.mjs");
      const { front } = await import("/src/apps/calendar/model.ts");
      const sticker = front(calendarApp.controller.physicalState)[0];
      let texture;
      calendarApp.viewer.scene.traverse((mesh) => {
        if (mesh.userData.stickerId === sticker.id)
          texture = mesh.material.map.image.getContext("2d");
      });
      const permanent = [];
      calendarApp.viewer.scene.traverse((mesh) => {
        if ([20, 33, 40].includes(mesh.userData.stickerId)) {
          const ctx = mesh.material.map.image.getContext("2d");
          permanent.push({
            id: mesh.userData.stickerId,
            font: ctx.font,
            color: ctx.fillStyle,
          });
        }
      });
      return {
        id: sticker.id,
        image: sticker.image,
        font: texture.font,
        color: texture.fillStyle,
        permanent,
      };
    });
    expect(actual.image).toBe(image);
    const weekend = image !== "MON";
    expect(actual.font).toContain(weekend ? "800" : "600");
    expect(actual.color).toBe(weekend ? "#ba302c" : "#25343e");
    expect(actual.permanent.map((s) => s.id).sort((a, b) => a - b)).toEqual([
      20, 33, 40,
    ]);
    expect(
      actual.permanent.every(
        (s) => s.font.includes("800") && s.color === "#ba302c",
      ),
    ).toBe(true);
    if (weekend) seen.push(actual.id);
  }
  expect([...new Set(seen)].sort((a, b) => a - b)).toEqual([20, 33, 40]);
});
test("date picking starts legal motion immediately and day buttons preserve latest intent and counts", async ({
  page,
}) => {
  await ready(page, "2024-02-28T11:00:00Z");
  await page.evaluate(async () => {
    const { CalendarViewer } = await import("/src/apps/calendar/viewer.ts");
    const animate = CalendarViewer.prototype.animate;
    window.dateMoveTrace = [];
    let first = true;
    CalendarViewer.prototype.animate = async function (from, token, to) {
      if (first) {
        first = false;
        await new Promise((resolve) => (window.releaseCalendarMove = resolve));
      }
      await animate.call(this, from, token, to);
      window.dateMoveTrace.push(token);
    };
  });
  await page.fill("#calendar-date", "2024-02-29");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "true",
  );
  await expect(page.locator("#calendar-estimates")).toContainText(
    "after motion",
  );
  await expect(page.locator("#calendar-moves")).not.toHaveText(
    "0 / 0 HTM · 0 / 0 cube rotations",
  );
  await expect
    .poll(() => page.evaluate(() => typeof window.releaseCalendarMove))
    .toBe("function");
  await page.click("#calendar-increment");
  await page.click("#calendar-increment");
  await page.click("#calendar-decrement");
  await expect(page.locator("#calendar-date")).toHaveValue("2024-03-01");
  await expect(page.locator("#calendar-queue")).toContainText("queued");
  await page.evaluate(() => window.releaseCalendarMove());
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  expect((await physical(page)).cells).toEqual([
    "F",
    "R",
    "",
    "",
    "0",
    "1",
    "M",
    "Ä",
    "R",
  ]);
  const state = await page.evaluate(async () => {
    const { calendarApp } = await import("/src/calendar.mjs");
    return { p: calendarApp.controller.progress, trace: window.dateMoveTrace };
  });
  expect(state.p.completed).toEqual(state.p.total);
  expect(state.trace.length).toBeGreaterThan(0);
  await expect(page.locator("#calendar-estimates")).toContainText("−1 day:");
  await expect(page.locator("#calendar-estimates")).toContainText("+1 day:");
  const before = await physical(page);
  await page.fill("#calendar-date", "");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-error")).toContainText("Use YYYY-MM-DD");
  expect(await physical(page)).toEqual(before);
  await page.fill("#calendar-date", "0001-01-01");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("#calendar-decrement")).toBeDisabled();
  await page.fill("#calendar-date", "9999-12-31");
  await page.locator("#calendar-date").dispatchEvent("change");
  await expect(page.locator("#calendar-viewer")).toHaveAttribute(
    "aria-busy",
    "false",
  );
  await expect(page.locator("#calendar-increment")).toBeDisabled();
});
