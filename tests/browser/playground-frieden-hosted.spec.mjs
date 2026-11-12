import { test, expect } from "@playwright/test";
// The Frieden picture theme in the hosted Picture Cube (index.html?app=playground): selecting it fetches its six WebP
// faces, starts a session with them and the suitability check rates the 2x2 stickers. Kept apart from
// playground-hosted.spec.mjs, which covers the mode itself.
test("selecting Frieden loads its six WebP faces and the 2x2 stickers rate as a good fit", async ({ page }) => {
  test.slow();
  const seen = [],
    faces = [];
  page.on("pageerror", (e) => seen.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && seen.push(`console: ${m.text()}`));
  page.on("response", (r) => {
    const path = new URL(r.url()).pathname;
    if (/\/playground-frieden\/[FBRLUD]\.webp$/.test(path)) faces.push(`${path.at(-6)}:${r.status()}:${r.headers()["content-type"]}`);
  });
  await page.goto("/index.html?app=playground");
  const cube = page.locator("#playground-cube");
  await expect(cube).toHaveAttribute("data-ready", "true");
  await expect(cube).toHaveAttribute("aria-busy", "false");
  await page.locator("#pictures > summary").click();
  await expect(page.locator("#playground-design option", { hasText: "Frieden" })).toHaveAttribute("value", "frieden");
  await page.locator("#playground-design").selectOption("frieden");
  await expect(cube).toHaveAttribute("data-style", "frieden", { timeout: 60000 });
  await expect(cube).toHaveAttribute("aria-busy", "false", { timeout: 60000 });
  expect([...new Set(faces)].sort()).toEqual(["B", "D", "F", "L", "R", "U"].map((f) => `${f}:200:image/webp`));
  await expect(page.locator("#fit")).toHaveAttribute("data-light", "green", { timeout: 60000 });
  await expect(page.locator("#fit-summary")).toContainText("0 stickers flat, 0 identical groups, 0 rotation-ambiguous");
  expect(seen).toEqual([]);
});
