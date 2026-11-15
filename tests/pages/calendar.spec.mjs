import { test, expect } from "@playwright/test";
// HTM cap per step: the front-goal solver's measured maximum over 1460 steps (4 prints, 2027) is 11 HTM, so 12 leaves one move of margin.
// It also ends a route with 0 to 2 whole-cube rotation tokens, counted apart from HTM.
const MOVE_CAP = 12;
for (const [design, front, sourceIso, targetIso] of [
  [
    "de-a",
    "D · O · blank · blank · 2 · 9 · O · K · T",
    "2026-10-28",
    "2026-10-29",
  ],
  [
    "en-3",
    "THU · blank · blank · O · C · T · blank · 2 · 9",
    "2026-10-28",
    "2026-10-29",
  ],
  [
    "de-a",
    "M · I · blank · blank · 0 · 4 · N · O · V",
    "2026-11-03",
    "2026-11-04",
  ],
])
  test(`built calendar mode ${design} ${targetIso} plans its route with the front-goal worker beneath the deployment base`, async ({
    page,
  }) => {
    await page.addInitScript((iso) => {
      Date.now = () => new Date(iso + "T11:00:00Z").getTime();
      // Slow runners must finish the solve; the move limit below stays.
      // Kept below the 15 s busy wait so a deadline still releases the page.
      window.__calendarSolverTimeoutMs = 13000;
    }, sourceIso);
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto("index.html?app=calendar");
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
      /^([1-9]\d*) \/ \1 HTM · ([0-2]) \/ \2 cube rotations$/,
    );
    const completed = Number(
      (await moveStats.textContent()).match(/^(\d+) \/ /)[1],
    );
    const solverStatus = await moveStats.getAttribute("data-solver-status");
    console.log(
      `calendar ${design} ${targetIso}: solverStatus=${solverStatus} moves=${completed}`,
    );
    expect(completed).toBeGreaterThan(0);
    expect(completed, `solverStatus=${solverStatus}`).toBeLessThanOrEqual(
      MOVE_CAP,
    );
    expect(solverStatus).toBe("solved");
    expect(errors).toEqual([]);
    await page.screenshot({
      path: `test-results/calendar-built-optimized-${design}-${targetIso}.png`,
    });
  });
