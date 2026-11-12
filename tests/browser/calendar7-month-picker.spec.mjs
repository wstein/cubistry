// SPDX-License-Identifier: AGPL-3.0-or-later
// Persistent month picker. Locators use exact names so they do not collide with the any-date
// form's Year and Month labels or with the Banner style choice.
import { test, expect } from "@playwright/test";

const ROOT = "#calendar7-root";
const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const trigger = (page) => page.getByRole("button", { name: /^Choose month and year:/ });
const dialog = (page) => page.getByRole("dialog", { name: "Choose calendar month", exact: true });
const at = (page, date) => expect(page.locator(ROOT)).toHaveAttribute("data-c7-month", date, { timeout: 30000 });
async function open(page, query = "year=2026&month=11") {
  await page.goto(`/index.html?app=calendar7&${query}`);
  await expect(trigger(page)).toBeVisible({ timeout: 30000 });
}
async function years(page) {
  await trigger(page).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
}

test("month selection commits instantly and preserves the persistent trigger and unrelated URL settings", async ({ page }) => {
  await open(page, "year=2026&month=11&scheme=paper-blue&font=nunito&banner=boxed&extra=keep");
  await trigger(page).evaluate((el) => { window.originalMonthTrigger = el; });
  await trigger(page).click();
  const grid = page.getByRole("grid", { name: "Months in 2026", exact: true });
  await expect(grid.getByRole("gridcell")).toHaveCount(12);
  await expect(grid.getByRole("row")).toHaveCount(4);
  await expect(page.getByRole("button", { name: "Show", exact: true })).toHaveCount(0);
  await grid.getByRole("gridcell", { name: "December 2026", exact: true }).click();
  await at(page, "2026-12");
  await expect(dialog(page)).toHaveCount(0);
  await expect(trigger(page)).toBeFocused();
  expect(await trigger(page).evaluate((el) => el === window.originalMonthTrigger)).toBe(true);
  const q = new URL(page.url()).searchParams;
  for (const [key, value] of Object.entries({ app: "calendar7", year: "2026", month: "12", scheme: "paper-blue", font: "nunito", banner: "boxed", extra: "keep" })) expect(q.get(key)).toBe(value);
});

test("year browsing reaches years 1 and 9999 and rejects invalid edits without navigating", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await open(page);
  await at(page, "2026-11");
  await years(page);
  await expect(page.getByRole("navigation", { name: "Decades", exact: true })).toBeVisible();
  const jump = page.getByRole("spinbutton", { name: "Jump to year", exact: true });
  for (const value of ["0", "10000", ""]) {
    await jump.fill(value);
    await jump.press("Enter");
    await expect(jump).toHaveAttribute("aria-invalid", "true");
    await at(page, "2026-11");
  }
  // A click after editing the year must survive its blur/change event without losing the selected cell.
  await jump.fill("2037");
  await page.getByRole("gridcell", { name: "2037", exact: true }).click();
  await expect(page.getByRole("grid", { name: "Months in 2037", exact: true })).toBeVisible();
  await at(page, "2026-11");
  await page.getByRole("gridcell", { name: "January 2037", exact: true }).click();
  await at(page, "2037-01");
  // The chain ends in January 2036: later months show a display-only preview (kind "state"), not a chain month ("off").
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await expect(page.locator("[data-c7-any-range]")).toContainText("Display only: no move sequence for this date");
  await trigger(page).click();
  await page.getByRole("button", { name: "Choose year", exact: true }).click();
  await jump.fill("1");
  await jump.press("Enter");
  await page.getByRole("gridcell", { name: "1", exact: true }).click();
  await page.getByRole("gridcell", { name: "January 1", exact: true }).click();
  await at(page, "1-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await trigger(page).click();
  await expect(page.getByRole("button", { name: "Previous year", exact: true })).toBeDisabled();
  await page.keyboard.press("Escape");
  await years(page);
  await jump.fill("9999");
  await jump.press("Enter");
  await page.getByRole("gridcell", { name: "9999", exact: true }).click();
  await page.getByRole("gridcell", { name: "December 9999", exact: true }).click();
  await at(page, "9999-12");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-any", "state");
  await trigger(page).click();
  await expect(page.getByRole("button", { name: "Next year", exact: true })).toBeDisabled();
  expect(errors).toEqual([]);
});

test("keyboard navigation, Escape, and outside focus close the picker without an unintended date", async ({ page }) => {
  await open(page);
  await at(page, "2026-11");
  await trigger(page).click();
  const november = page.getByRole("gridcell", { name: "November 2026", exact: true });
  await november.focus();
  await november.press("ArrowRight");
  await expect(page.getByRole("gridcell", { name: "December 2026", exact: true })).toBeFocused();
  await page.keyboard.press("Home");
  await expect(page.getByRole("gridcell", { name: "January 2026", exact: true })).toBeFocused();
  await page.keyboard.press("End");
  await expect(page.getByRole("gridcell", { name: "December 2026", exact: true })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(trigger(page)).toBeFocused();
  await at(page, "2026-11");
  await trigger(page).click();
  // Banner style sits to the right of the popup on a wide row. Its name does not contain "Month".
  const banner = page.getByRole("combobox", { name: "Banner style", exact: true });
  await banner.click();
  await expect(dialog(page)).toHaveCount(0);
  await expect(banner).toBeFocused();
  await at(page, "2026-11");
});

test("Today commits the local current month and restores trigger focus", async ({ page }) => {
  await page.clock.setFixedTime(new Date("2026-11-11T15:00:00Z"));
  await open(page, "year=2026&month=12");
  await at(page, "2026-12");
  await trigger(page).click();
  await page.getByRole("button", { name: "Today", exact: true }).click();
  await at(page, "2026-11");
  await expect(trigger(page)).toBeFocused();
  await expect(dialog(page)).toHaveCount(0);
});

test("the month and decade views fit a narrow viewport with usable targets", async ({ page }) => {
  for (const width of [320, 360, 390]) {
    await page.setViewportSize({ width, height: 780 });
    await open(page);
    await trigger(page).click();
    for (const yearView of [false, true]) {
      if (yearView) await page.getByRole("button", { name: "Choose year", exact: true }).click();
      const box = await dialog(page).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
      const cells = await dialog(page).getByRole("gridcell").all();
      for (const cell of cells) {
        const rect = await cell.boundingBox();
        expect(rect.width).toBeGreaterThanOrEqual(44);
        expect(rect.height).toBeGreaterThanOrEqual(44);
      }
      if (yearView) {
        const rail = await page.getByRole("navigation", { name: "Decades", exact: true }).boundingBox();
        const grid = await page.getByRole("grid", { name: "Years 2020 to 2029", exact: true }).boundingBox();
        expect(rail.x + rail.width).toBeLessThanOrEqual(grid.x + 1);
      }
    }
  }
});
