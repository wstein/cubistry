import { test, expect } from "@playwright/test";

// The 1/10-Second Counter fills the dock slots through the ModeShell API (src/apps/shell/slot-api.ts); a mode that has
// not migrated leaves them hidden. Reads DOM state only: no moves are awaited.

const LOAD_MS = 30000;
const ready = (page, id) => expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", id, { timeout: LOAD_MS });

test.beforeEach(() => {
  test.slow();
});

test("tenth: slots 1 to 4 are labeled groups in order, slot 5 stays hidden, the legacy controls are empty", async ({ page }) => {
  await page.goto("/index.html?app=tenth");
  await ready(page, "tenth");
  for (const [n, name] of [[1, "Step"], [2, "Value"], [3, "Direction"], [4, "Step speed"]]) {
    await expect(page.locator(`[data-slot="${n}"]`), `slot ${n}`).toBeVisible();
    await expect(page.getByRole("group", { name, exact: true })).toHaveCount(1);
  }
  await expect(page.locator('[data-slot="5"]')).toBeHidden();
  await expect(page.locator("#studio-controls")).toBeEmpty();
  await expect(page.locator("#tenth-step-plus5")).toBeVisible();
  await expect(page.locator("#tenth-speed-select")).toHaveAttribute("data-value", "250");
  await page.locator("#tenth-speed-select").focus();
  await page.keyboard.press("ArrowRight");
  await expect(page.locator("#tenth-speed-select")).toHaveAttribute("data-value", "100");
  await expect(page.locator('[data-region="nerd-drawer"]')).toBeHidden();
  await expect(page.locator("#nerd-toggle")).toBeHidden();
});

test("tenth to counter: the slots of the left mode are gone", async ({ page }) => {
  await page.goto("/index.html?app=tenth");
  await ready(page, "tenth");
  await page.selectOption("#studio-application", "counter");
  await ready(page, "counter");
  for (const n of [1, 2, 3, 4, 5]) await expect(page.locator(`[data-slot="${n}"]`), `slot ${n}`).toBeHidden();
  await expect(page.locator("#tenth-step-plus5")).toHaveCount(0);
});
