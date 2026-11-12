import { test, expect } from "@playwright/test";
// The built host serves the Frieden faces under the project base: the theme URLs are absolute in the registry and
// only the loader's base path puts them under /cubistry/.
test("built playground mode loads the Frieden WebP faces under the project base", async ({ page }) => {
  test.slow();
  const errors = [],
    faces = new Set();
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`);
    const path = new URL(r.url()).pathname;
    if (/playground-frieden\/[FBRLUD]\.webp$/.test(path)) faces.add(`${path}:${r.status()}`);
  });
  await page.goto("./index.html?app=playground");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-ready", "true");
  await page.locator("#playground-design").selectOption("frieden");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-style", "frieden", { timeout: 60000 });
  await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  expect([...faces].sort()).toEqual(["B", "D", "F", "L", "R", "U"].map((f) => `/cubistry/playground-frieden/${f}.webp:200`));
  expect(errors).toEqual([]);
});
