// SPDX-License-Identifier: AGPL-3.0-or-later
import { test, expect } from "@playwright/test";
test.use({ timezoneId: "Europe/Berlin" });

for (const outcome of ["success", "404"])
  test(`a lettering retry cannot erase or replace a fatal clock error (${outcome})`, async ({ page }) => {
    const asset = "**/assets/letters/noto-sans/words/M.svg";
    const row = page.locator('.shell-alert-row[data-kind="error"]');
    await page.addInitScript(() => {
      Date.now = () => Date.parse("2026-10-28T11:34:56Z");
    });
    await page.route(asset, (route) => route.fulfill({ status: 404, body: "Missing lettering" }));
    await page.goto("/index.html?app=clock&lettering=words-pascal");
    await expect(page.locator("#seconds-speed")).toBeEnabled({ timeout: 30000 });
    // Establish an owned lettering error before a fatal runtime error takes over.
    await page.selectOption("#clock-lettering", "words");
    await expect(page.locator("#clock-lettering")).toBeEnabled();
    await expect(row).toBeVisible();
    await expect(page.locator("#clock-lettering")).toHaveValue("words-pascal");
    await page.unroute(asset);

    let release, reached;
    const held = new Promise((resolve) => { release = resolve; });
    const requested = new Promise((resolve) => { reached = resolve; });
    await page.route(asset, async (route) => {
      const response = await route.fetch();
      reached();
      await held;
      await route.fulfill(outcome === "404" ? { status: 404, body: "Missing lettering" } : { response });
    });
    try {
      await page.selectOption("#clock-lettering", "words");
      await requested;
      await page.evaluate(async () => {
        const { clockUnits } = await import("/src/apps/clock/live-mode.mjs");
        const unit = clockUnits[0];
        const duration = unit.duration;
        unit.duration = NaN;
        // Reach the real scheduler validation and fail(), rather than writing an alert directly.
        document.dispatchEvent(new Event("visibilitychange"));
        unit.duration = duration;
      });
      await expect(row).toContainText("Invalid clock move duration");
      await expect(page.locator("#clock-status")).toHaveText("Clock stopped. Reload to recover.");
      release();
      await expect(page.locator("#clock-lettering")).toBeEnabled();
      await expect(row).toBeVisible();
      await expect(row).toContainText("Invalid clock move duration");
      await expect(page.locator("#clock-lettering")).toHaveValue(outcome === "success" ? "words" : "words-pascal");
      await page.evaluate(() => {
        Date.now = () => Date.parse("2026-10-28T11:34:58Z");
        document.dispatchEvent(new Event("visibilitychange"));
      });
      await expect(page.locator("#clock-digital")).toHaveText("12:34:56");
      await expect(page.locator("#clock-status")).toHaveText("Clock stopped. Reload to recover.");
    } finally {
      release();
    }
  });
