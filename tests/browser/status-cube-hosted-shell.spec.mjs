import { test, expect } from "@playwright/test";
// Host cases of the mode `ci` (shell regions, URL parameters, Nerd drawer, leaving the mode). They take a few seconds
// each and run in the fast group; the copied legacy cases are in status-cube-hosted.spec.mjs (timing group).
const chip = (page) => page.locator('[data-region="status-zone"] .shell-chip');
const readout = (page) => page.locator('[data-region="readout"] .shell-readout-value');
const primary = (page) => page.locator('[data-region="primary-action"] button');
async function ready(page) {
  await page.goto("/index.html?app=ci");
  await expect(page.locator("#status-build")).toBeEnabled();
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
}
async function exact(page, snapshot) {
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-current",
    snapshot.join(","),
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  expect(
    await page.evaluate(async (snapshot) => {
      const { statusController: c, statusDefinition: d } = await import(
        "/src/apps/status/mount.ts"
      );
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      const { matchesTarget } = await import(
        "/packages/cube-mechanics/src/index.ts"
      );
      const { displayTarget } = await import("/src/apps/status/definition.ts");
      return (
        stateEquals(c.state, c.view.presentedState) &&
        matchesTarget(d.print, c.state, displayTarget(snapshot))
      );
    }, snapshot),
  ).toBe(true);
}
test("the mode registers under ?app=ci, reports ready and keeps the shell regions in use", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "ci");
  await expect(page.locator("#studio-application")).toHaveValue("ci");
  await expect(page.locator("#studio-heading")).toHaveText("CI Quality Cube");
  await expect(chip(page)).toHaveAttribute("data-state", "done");
  await expect(primary(page)).toHaveText("Send event");
  await expect(page.locator('[data-slot="1"]')).toBeVisible();
  await expect(page.locator('[data-slot="2"]')).toBeVisible();
  for (const n of [3, 4, 5]) await expect(page.locator(`[data-slot="${n}"]`)).toBeHidden();
  await expect(readout(page)).toHaveText(["0 / 0 HTM", "0"]);
  await expect(chip(page)).toContainText("In sync · BUILD: Open · TEST: Open · ANALYZE: Open · REVIEW: Open");
  expect(errors).toEqual([]);
});

test("URL parameters speed, build, test, analyze and review set the speed and the requested snapshot", async ({ page }) => {
  await page.goto("/index.html?app=ci&speed=50&build=ok&test=error&analyze=nope");
  await expect(page.locator("#status-build")).toBeEnabled();
  await expect(page.locator("#status-speed")).toHaveValue("50");
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-current", "ok,error,open,open", { timeout: 30000 });
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-sync", "idle");
  await expect(page.locator("#status-analyze")).toHaveValue("open");
  // The category parameters are a one-time request and leave the address bar; turn follows the control, with no history entry.
  await expect(page).not.toHaveURL(/[?&](build|test|analyze|review)=/);
  await expect(page).toHaveURL(/[?&]speed=50(&|$)/);
  const entries = await page.evaluate(() => history.length);
  await page.selectOption("#status-speed", "100");
  await expect(page).toHaveURL(/[?&]speed=100(&|$)/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test("the Nerd drawer lists the recent local events", async ({ page }) => {
  await page.goto("/index.html?app=ci&nerd=1");
  await expect(page.locator("#status-build")).toBeEnabled();
  await page.selectOption("#status-event", "start");
  await primary(page).click();
  await expect(page.locator('[data-region="nerd-drawer"]')).toContainText("Recent local events");
  await expect(page.locator('[data-region="nerd-drawer"] li').last()).toHaveText("build: Start or retry");
});

test("leaving the mode while the cube moves and coming back mounts a fresh cube without errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.selectOption("#status-speed", "500");
  await page.selectOption("#status-build", "running");
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-sync", "moving");
  await page.selectOption("#studio-application", "counter");
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "counter", { timeout: 30000 });
  await expect(page.locator("#status-viewer")).toHaveCount(0);
  await expect(page.locator("#status-build")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]build=/);
  await page.selectOption("#studio-application", "ci");
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "ci", { timeout: 30000 });
  await exact(page, ["open", "open", "open", "open"]);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});
