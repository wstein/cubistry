import { test, expect } from "@playwright/test";
import { chipOf, choose, setSpeed, SPEED_STOPS } from "../helpers/status-chips.mjs";
// Host cases of the mode `ci` (shell regions, URL parameters, Nerd drawer, leaving the mode). They take a few seconds
// each and run in the fast group; the copied legacy cases are in status-cube-hosted.spec.mjs (timing group).
const chip = (page) => page.locator('[data-region="status-zone"] .shell-chip');
const readout = (page) => page.locator('[data-region="readout"] .shell-readout-value');
const primary = (page) => page.locator('[data-region="primary-action"] button');
async function ready(page) {
  await page.goto("/index.html?app=ci");
  await expect(page.locator("#status-build-open")).toBeEnabled();
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
  await expect(page.locator("#status-build-open")).toBeEnabled();
  await expect(page.locator("#status-speed")).toHaveAttribute("data-value", "50");
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-current", "ok,error,open,open", { timeout: 30000 });
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-sync", "idle");
  await expect(page.locator("#status-analyze")).toHaveAttribute("data-value", "open");
  await expect(chipOf(page, "build", "ok")).toHaveAttribute("aria-checked", "true");
  await expect(chipOf(page, "test", "error")).toHaveAttribute("aria-checked", "true");
  // The category parameters are a one-time request and leave the address bar; speed follows the control, with no history entry.
  await expect(page).not.toHaveURL(/[?&](build|test|analyze|review)=/);
  await expect(page).toHaveURL(/[?&]speed=50(&|$)/);
  const entries = await page.evaluate(() => history.length);
  await setSpeed(page, 100);
  await expect(page).toHaveURL(/[?&]speed=100(&|$)/);
  expect(await page.evaluate(() => history.length)).toBe(entries);
});

test("the Nerd drawer lists the recent local events", async ({ page }) => {
  await page.goto("/index.html?app=ci&nerd=1");
  await expect(page.locator("#status-build-open")).toBeEnabled();
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
  await setSpeed(page, 500);
  await choose(page, "build", "running");
  await expect(page.locator("#status-viewer")).toHaveAttribute("data-sync", "moving");
  await page.selectOption("#studio-application", "counter");
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "counter", { timeout: 30000 });
  await expect(page.locator("#status-viewer")).toHaveCount(0);
  await expect(page.locator("#status-build")).toHaveCount(0);
  await expect(page.locator("#status-speed")).toHaveCount(0);
  await expect(page).not.toHaveURL(/[?&]build=/);
  await page.selectOption("#studio-application", "ci");
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "ci", { timeout: 30000 });
  await exact(page, ["open", "open", "open", "open"]);
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(errors).toEqual([]);
});

const categories = ["build", "test", "analyze", "review"];
const states = ["open", "running", "ok", "error", "blocked"];

test("every category is a radio group with five chips that show symbol and word, and a click or an arrow key chooses one", async ({ page }) => {
  await ready(page);
  for (const category of categories) {
    const group = page.locator(`#status-${category}`);
    await expect(group).toHaveAttribute("role", "radiogroup");
    await expect(group.getByRole("radio")).toHaveCount(5);
    await expect(group.getByRole("radio", { name: "Running" })).toBeVisible();
    for (const state of states) {
      const symbol = chipOf(page, category, state).locator(".shell-choice-symbol");
      expect((await symbol.textContent()).trim().length).toBeGreaterThan(0);
    }
  }
  await expect(chipOf(page, "build", "open")).toHaveAttribute("aria-checked", "true");
  await choose(page, "test", "error");
  await exact(page, ["open", "error", "open", "open"]);
  await expect(chipOf(page, "test", "error")).toHaveAttribute("aria-checked", "true");
  await expect(chipOf(page, "test", "open")).toHaveAttribute("aria-checked", "false");
  await expect(page.locator("#status-test")).toHaveAttribute("data-value", "error");
  await expect(page.locator("#status-build")).toHaveAttribute("data-value", "open");
  // Arrow keys move through the group like native radios and select; only the checked chip is in the tab order.
  await expect(chipOf(page, "test", "open")).toHaveAttribute("tabindex", "-1");
  await chipOf(page, "test", "error").focus();
  await page.keyboard.press("ArrowRight");
  await expect(chipOf(page, "test", "blocked")).toBeFocused();
  await exact(page, ["open", "blocked", "open", "open"]);
  await page.keyboard.press("ArrowRight");
  await expect(chipOf(page, "test", "open")).toBeFocused();
  await page.keyboard.press("ArrowLeft");
  await expect(chipOf(page, "test", "blocked")).toBeFocused();
  await exact(page, ["open", "blocked", "open", "open"]);
});

test("the quick choices set all four categories like manual choices", async ({ page }) => {
  await ready(page);
  await page.locator("#status-preset-ok").click();
  await exact(page, ["ok", "ok", "ok", "ok"]);
  await page.locator("#status-preset-test-fails").click();
  await exact(page, ["ok", "error", "blocked", "open"]);
  for (const [category, state] of [["build", "ok"], ["test", "error"], ["analyze", "blocked"], ["review", "open"]])
    await expect(chipOf(page, category, state)).toHaveAttribute("aria-checked", "true");
  await page.locator("#status-preset-open").click();
  await exact(page, ["open", "open", "open", "open"]);
  await expect(page.locator("#status-preset-open")).toHaveText("All open");
  await expect(page.locator("#status-preset-ok")).toHaveText("All ok");
  await expect(page.locator("#status-preset-test-fails")).toHaveText("Test fails");
});

test("the speed slider has the seven stops, arrow keys move one stop and the address bar follows", async ({ page }) => {
  await ready(page);
  const slider = page.locator("#status-speed");
  await expect(slider).toHaveAttribute("type", "range");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", String(SPEED_STOPS.length - 1));
  await expect(slider).toHaveAttribute("data-value", "250");
  await expect(page.locator("#status-speed-value")).toHaveText("250 ms");
  await expect(page.locator("#status-speed ~ .shell-stop-ends")).toContainText("slow");
  await expect(page.locator("#status-speed ~ .shell-stop-ends")).toContainText("fast");
  await slider.focus();
  await page.keyboard.press("ArrowRight");
  await expect(slider).toHaveAttribute("data-value", "100");
  await expect(page).toHaveURL(/[?&]speed=100(&|$)/);
  await page.keyboard.press("ArrowLeft");
  await page.keyboard.press("ArrowLeft");
  await expect(slider).toHaveAttribute("data-value", "500");
  for (const ms of SPEED_STOPS) {
    await setSpeed(page, ms);
    await expect(slider).toHaveAttribute("data-value", String(ms));
    await expect(page.locator("#status-speed-value")).toHaveText(`${ms} ms`);
    if (ms === 250) await expect(page).not.toHaveURL(/[?&]speed=/);
    else await expect(page).toHaveURL(new RegExp(`[?&]speed=${ms}(&|$)`));
  }
});

test("at 390 px the Workflow slot needs no horizontal scroll and every chip is at least 44 px", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: "reduce" });
  const page = await context.newPage();
  try {
    await ready(page);
    const slot = page.locator('[data-slot="2"]');
    await slot.scrollIntoViewIfNeeded();
    const m = await page.evaluate(() => {
      const boxes = [...document.querySelectorAll(".shell-choice, #status-preset-open, #status-preset-ok, #status-preset-test-fails")].map((e) => {
        const r = e.getBoundingClientRect();
        return { id: e.id, w: r.width, h: r.height, left: r.left, right: r.right };
      });
      const slotEl = document.querySelector('[data-slot="2"]');
      return { boxes, page: document.documentElement.scrollWidth, view: innerWidth, slotScroll: slotEl.scrollWidth, slotClient: slotEl.clientWidth };
    });
    expect(m.boxes.length).toBe(23);
    expect(m.page).toBeLessThanOrEqual(m.view);
    expect(m.slotScroll).toBeLessThanOrEqual(m.slotClient);
    for (const b of m.boxes) {
      expect(b.h, b.id).toBeGreaterThanOrEqual(44);
      expect(b.w, b.id).toBeGreaterThanOrEqual(44);
      expect(b.left, b.id).toBeGreaterThanOrEqual(0);
      expect(b.right, b.id).toBeLessThanOrEqual(m.view);
    }
    await page.screenshot({ path: "test-results/status-chips-390.png", fullPage: true });
  } finally {
    await context.close();
  }
});
