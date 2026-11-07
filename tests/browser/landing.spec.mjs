import { test, expect } from "@playwright/test";

// Landing page of index.html (stage 3 of knowledge/plans/unified-application.md). Expected ids in catalog order.
const APPS = ["ms-timer"];
const CUBES = ["hm-clock", "tenth", "counter", "timer", "five-second-timer", "hsm-counter", "ms-counter", "hm-one-cube"];

test.beforeEach(() => {
  test.slow();
});

test("the root URL shows the landing page without a redirect", async ({ page }) => {
  await page.goto("/");
  await expect(page).not.toHaveURL(/clock\.html/);
  await expect(page.locator("#shell")).toHaveAttribute("data-view", "landing");
  await expect(page.locator("#landing")).toBeVisible();
  await expect(page.locator("#studio-scene")).toBeHidden();
  await expect(page.locator("#landing-open-clock")).toHaveText("Open Live Clock");
  await expect(page.locator(".landing-hero output")).toHaveCount(0);
});

test("every tile and the hero button link to index.html?app=<id>, and no link targets an application page", async ({ page }) => {
  await page.goto("/");
  const tiles = await page.locator(".landing-tile").evaluateAll((as) => as.map((a) => a.getAttribute("href")));
  expect(tiles).toEqual([...APPS, ...CUBES].map((id) => `index.html?app=${id}`));
  await expect(page.locator("#landing-open-clock")).toHaveAttribute("href", "index.html?app=clock");
  const pages = await page.locator("#shell a[href]").evaluateAll((as) =>
    as.map((a) => a.getAttribute("href")).filter((h) => /\.html/.test(h) && !/^https?:/.test(h)),
  );
  for (const href of pages) expect(href).toMatch(/^(index|licenses|print)\.html(\?|$)/);
});

test("a tile opens its mode in the same document", async ({ page }) => {
  await page.goto("/");
  await page.locator('.landing-tile[data-app="counter"]').click();
  await expect(page).toHaveURL(/[?&]app=counter(&|$)/);
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "counter", { timeout: 30000 });
  await expect(page.locator("#landing")).toBeHidden();
});

test("an unknown app id shows the landing page", async ({ page }) => {
  await page.goto("/index.html?app=nope");
  await expect(page.locator("#shell")).toHaveAttribute("data-view", "landing");
});
