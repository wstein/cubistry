import { test, expect } from "@playwright/test";
for (const [design, moves, front] of [
  ["de-a", 19, "D · O · blank · blank · 2 · 9 · O · K · T"],
  ["en-3", 17, "THU · blank · blank · O · C · T · blank · 2 · 9"],
])
  test(`built calendar ${design} loads its nested solver workers beneath the deployment base`, async ({
    page,
  }) => {
    await page.addInitScript(() => {
      Date.now = () => new Date("2026-10-28T11:00:00Z").getTime();
    });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("calendar.html");
    await expect(page.locator("#calendar-design")).toBeEnabled();
    if (design === "en-3") await page.selectOption("#calendar-design", design);
    await page.fill("#calendar-date", "2026-10-29");
    await page.locator("#calendar-date").dispatchEvent("change");
    await expect(page.locator("#calendar-viewer")).toHaveAttribute(
      "aria-busy",
      "false",
      { timeout: 15000 },
    );
    await expect(page.locator("#calendar-route")).toHaveText(
      "Optimized physical route",
    );
    await expect(page.locator("#calendar-front")).toHaveText(front);
    await expect(page.locator("#calendar-moves")).toHaveText(
      `${moves} / ${moves} HTM · 0 / 0 cube rotations`,
    );
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/calendar-built-optimized-${design}.png`,
    });
  });
