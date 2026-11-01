// M/S Timer (stack PR 3): two cubes, minutes left and seconds right, one time
// 00:00-59:59. Short, state-based assertions only: the millisecond deadline
// guarantees are covered by the deterministic virtual-clock tests
// (tests/ms-timer.test.mjs), the physical feel is not claimed here. Explicit
// timeouts scale with the CI group (tests/helpers/timeout-scale.mjs).
import { test, expect } from "@playwright/test";
import { scaled } from "../helpers/timeout-scale.mjs";

const display = (page) => page.locator("#ms-timer-display");
const readout = (page) => page.locator("#timer-logical");
const shown = (page, value) =>
  expect(display(page)).toHaveAttribute("data-value", value, {
    timeout: scaled(30000),
  });
const idle = (page) =>
  expect(display(page)).toHaveAttribute("aria-busy", "false", {
    timeout: scaled(30000),
  });

async function open(page) {
  await page.goto("/?application=ms-timer");
  await expect(page).toHaveURL(/ms-timer\.html$/, { timeout: scaled(30000) });
  await expect(page.locator("#timer-start")).toBeEnabled({
    timeout: scaled(60000),
  });
  await shown(page, "15:00");
  // The shortest preferred turn keeps the Set and mode walks short; the
  // scheduler fits the turns of each second into its budget either way.
  await page.locator("#rotation-speed").fill("6");
}

test("the chooser offers the M/S Timer and the page shows two cubes, minutes left and seconds right", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await expect(
    page.locator("#application option", { hasText: "M/S Timer" }),
  ).toHaveCount(1);
  await page.selectOption("#application", "ms-timer");
  await expect(page).toHaveURL(/ms-timer\.html$/, { timeout: scaled(30000) });
  await expect(page.locator("#timer-start")).toBeEnabled({
    timeout: scaled(60000),
  });
  await expect(page.locator("#ms-timer-application")).toHaveValue(
    "ms-timer.html",
  );
  await expect(page.locator("#ms-timer-application option")).toContainText([
    "Live H–M–S Clock",
    "M/S Counter 00–59",
    "60-Minute Timer",
    "5-Second Timer",
    "M/S Timer",
  ]);
  // One stage with both cubes, the minutes cube left of the seconds cube.
  await expect(page.locator("#ms-timer-scene canvas")).toHaveCount(1);
  await expect(page.locator("#ms-timer-scene canvas")).toHaveAttribute(
    "aria-label",
    /Two physical cubes/,
  );
  const minutes = await page.locator("#ms-minutes").boundingBox(),
    seconds = await page.locator("#ms-seconds").boundingBox();
  expect(minutes.x).toBeLessThan(seconds.x);
  await expect(page.locator("#ms-minutes")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#ms-seconds")).toHaveAttribute("data-value", "0");
  const settled = await page.evaluate(async () => {
    const { msTimer } = await import("/src/ms-timer.mjs");
    return [msTimer.pair.major.state, msTimer.pair.minor.state].map(Boolean);
  });
  expect(settled).toEqual([true, true]);
  await expect(readout(page)).toHaveText("15:00");
  await expect(page.locator("#timer-mode")).toHaveValue("countdown");
  await expect(page.locator("#timer-speed")).toHaveCount(0);
  await expect(page.locator("#timer-speed-note")).toHaveText(
    "Timer speed: 1× (fixed)",
  );
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  await expect(page.locator("#speed-label")).toContainText("100 ms");
  // The seconds cube's second lap is internal and never shown.
  await expect(page.locator("main")).not.toContainText(/\blap\b/i);
});

test("Countdown 00:03 runs down to 00:00 and stops there", async ({ page }) => {
  await open(page);
  await page.fill("#timer-duration", "00:03");
  await page.locator("#timer-duration").press("Enter");
  await shown(page, "00:03");
  await idle(page);
  await expect(readout(page)).toHaveText("00:03");
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toHaveText("Pause");
  await expect(page.locator("#status")).toHaveText("Countdown · Complete", {
    timeout: scaled(30000),
  });
  await shown(page, "00:00");
  await idle(page);
  await expect(readout(page)).toHaveText("00:00");
  await expect(page.locator("#ms-minutes")).toHaveAttribute("data-value", "0");
  await expect(page.locator("#ms-seconds")).toHaveAttribute("data-value", "0");
  await expect(page.locator("#timer-start")).toBeDisabled();
  // It does not continue past the end.
  await page.waitForTimeout(scaled(1500));
  await expect(display(page)).toHaveAttribute("data-value", "00:00");
  await expect(page.locator("#error")).toHaveText("");
  // Reset returns to the configured duration.
  await page.locator("#timer-reset").click();
  await shown(page, "00:03");
  await expect(readout(page)).toHaveText("00:03");
});

test("Stopwatch starts at 00:00, pauses without losing time, resumes and resets", async ({
  page,
}) => {
  await open(page);
  await page.selectOption("#timer-mode", "stopwatch");
  await shown(page, "00:00");
  await idle(page);
  await expect(readout(page)).toHaveText("00:00");
  await expect(page.locator("#timer-duration-setting")).toBeHidden();
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toHaveText("Pause");
  await expect(readout(page)).not.toHaveText("00:00", {
    timeout: scaled(30000),
  });
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toHaveText("Resume");
  const frozen = await readout(page).textContent();
  await page.waitForTimeout(scaled(1500));
  await expect(readout(page)).toHaveText(frozen);
  await idle(page);
  await shown(page, frozen);
  await page.locator("#timer-start").click();
  await expect(page.locator("#timer-start")).toHaveText("Pause");
  await expect(readout(page)).not.toHaveText(frozen, {
    timeout: scaled(30000),
  });
  await page.locator("#timer-start").click();
  await page.locator("#timer-reset").click();
  await expect(readout(page)).toHaveText("00:00");
  await shown(page, "00:00");
  await idle(page);
  await expect(page.locator("#timer-start")).toHaveText("Start");
  await expect(page.locator("#error")).toHaveText("");
});

test("invalid Set input is rejected and the timer keeps its duration", async ({
  page,
}) => {
  await open(page);
  for (const bad of ["60:00", "15:60", "1500", "15:00.5"]) {
    await page.fill("#timer-duration", bad);
    await page.locator("#timer-duration").press("Enter");
    await expect(page.locator("#error")).not.toHaveText("");
    await expect(readout(page)).toHaveText("15:00");
  }
  await expect(display(page)).toHaveAttribute("data-value", "15:00");
});

test("the other applications keep their entries and still open", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await expect(page.locator("#application option")).toHaveText([
    "Picture Puzzle Playground",
    "CI Quality Cube · Workflow monitor",
    "Calendar · Deutsch / English",
    "Live H–M–S Clock",
    "H/M/S Counter 00–59",
    "M/S Counter 00–59",
    "H/M One-Cube Counter",
    "Counter 0–99",
    "60-Minute Timer",
    "5-Second Timer",
    "M/S Timer",
  ]);
  await page.selectOption("#application", "ms-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "ms-counter",
  );
});
