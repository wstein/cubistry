import { test, expect } from "@playwright/test";
for (const [design, moves, front, sourceIso, targetIso] of [
  [
    "de-a",
    17,
    "D · O · blank · blank · 2 · 9 · O · K · T",
    "2026-10-28",
    "2026-10-29",
  ],
  [
    "en-3",
    15,
    "THU · blank · blank · O · C · T · blank · 2 · 9",
    "2026-10-28",
    "2026-10-29",
  ],
  [
    "de-a",
    18,
    "M · I · blank · blank · 0 · 4 · N · O · V",
    "2026-11-03",
    "2026-11-04",
  ],
])
  test(`built calendar ${design} ${targetIso} loads its nested solver workers beneath the deployment base`, async ({
    page,
  }) => {
    await page.addInitScript((iso) => {
      Date.now = () => new Date(iso + "T11:00:00Z").getTime();
    }, sourceIso);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("calendar.html");
    await expect(page.locator("#calendar-design")).toBeEnabled();
    if (design === "en-3") await page.selectOption("#calendar-design", design);
    await page.fill("#calendar-date", targetIso);
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
    const moveStats = page.locator("#calendar-moves");
    await expect(moveStats).toHaveText(
      /^([1-9]\d*) \/ \1 HTM · 0 \/ 0 cube rotations$/,
    );
    const completed = Number(
      (await moveStats.textContent()).match(/^(\d+) \/ /)[1],
    );
    expect(completed).toBeGreaterThan(0);
    expect(completed).toBeLessThanOrEqual(moves);
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/calendar-built-optimized-${design}-${targetIso}.png`,
    });
  });
