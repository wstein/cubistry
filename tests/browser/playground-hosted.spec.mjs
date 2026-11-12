import { test, expect } from "@playwright/test";
// The Picture Cube as a mode of the host (index.html?app=playground). The old page /playground.html keeps its own spec
// (playground.spec.mjs) unchanged until the page is retired; these cases cover what the mount adds: the dock slots,
// the lifecycle on an app switch and the address bar.
const cube = (page) => page.locator("#playground-cube");
async function ready(page, search = "?app=playground") {
  await page.goto(`/index.html${search}`);
  await expect(cube(page)).toHaveAttribute("data-ready", "true");
  await expect(cube(page)).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("canvas")).toHaveCount(1);
}
function watch(page) {
  const seen = [];
  page.on("pageerror", (e) => seen.push(`pageerror: ${e.message}`));
  page.on("console", (m) => m.type() === "error" && seen.push(`console: ${m.text()}`));
  return seen;
}

test("the mode mounts with its dock slots, the size control and the pictures region", async ({ page }) => {
  const seen = watch(page);
  await ready(page);
  await expect(page.locator("#studio-heading")).toHaveText("Picture Cube");
  const slots = page.locator('[data-region="dock"] [data-slot]');
  await expect(page.locator('[data-slot="2"] button[data-move]')).toHaveCount(18);
  await expect(page.locator("#playground-size-2")).toBeEnabled();
  await expect(page.locator("#playground-size-3")).toBeDisabled();
  await expect(page.locator("#playground-pictures")).toBeVisible();
  await expect(slots.first()).toBeVisible();
  await expect(page.locator('[data-region="primary-action"] button')).toHaveText("Solve exact target");
  expect(seen).toEqual([]);
});

test("scramble, undo, redo and the exact solve reach Solved", async ({ page }) => {
  const seen = watch(page);
  await ready(page);
  await page.locator("#playground-seed").fill("7");
  await page.locator("#playground-count").fill("3");
  await page.locator("#playground-scramble").click();
  await expect(cube(page)).toHaveAttribute("data-cursor", "3");
  await expect(cube(page)).toHaveAttribute("data-turning", "false");
  await expect(cube(page)).toHaveAttribute("data-exact", "false");
  await page.locator("#playground-undo").click();
  await expect(cube(page)).toHaveAttribute("data-cursor", "2");
  await expect(cube(page)).toHaveAttribute("data-turning", "false");
  await page.locator("#playground-redo").click();
  await expect(cube(page)).toHaveAttribute("data-cursor", "3");
  await expect(cube(page)).toHaveAttribute("data-turning", "false");
  await page.locator('[data-region="primary-action"] button').click();
  await expect(cube(page)).toHaveAttribute("data-exact", "true", { timeout: 25000 });
  await expect(cube(page)).toHaveAttribute("data-solver", "Verified");
  expect(seen).toEqual([]);
});

test("leaving the mode removes the cube and its key handler; coming back mounts a fresh one", async ({ page }) => {
  const seen = watch(page);
  await ready(page);
  await page.locator("#studio-application").selectOption("counter");
  await expect(page.locator("#playground-cube")).toHaveCount(0);
  await page.keyboard.press("r");
  await page.locator("#studio-application").selectOption("playground");
  await expect(cube(page)).toHaveAttribute("data-ready", "true");
  await expect(cube(page)).toHaveAttribute("data-cursor", "0");
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(seen).toEqual([]);
});

test("a size change replaces the history entry; Back and Forward move between the apps", async ({ page }) => {
  const seen = watch(page);
  await ready(page, "?app=playground&size=3");
  await expect(page.locator("#playground-size-note")).toContainText("3×3 is not playable yet");
  await expect(cube(page)).toHaveAttribute("data-size", "2");
  const before = await page.evaluate(() => history.length);
  await page.locator("#playground-size-2").click();
  expect(await page.evaluate(() => history.length)).toBe(before);
  expect(new URL(page.url()).searchParams.get("size")).toBe("2");
  await page.locator("#studio-application").selectOption("counter");
  await expect(page.locator("#playground-cube")).toHaveCount(0);
  expect(new URL(page.url()).searchParams.has("size")).toBe(false);
  await page.goBack();
  await expect(cube(page)).toHaveAttribute("data-ready", "true");
  expect(new URL(page.url()).searchParams.get("app")).toBe("playground");
  await page.goForward();
  await expect(page.locator("#playground-cube")).toHaveCount(0);
  expect(seen).toEqual([]);
});
