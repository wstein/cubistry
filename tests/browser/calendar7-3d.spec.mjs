import { test, expect } from "@playwright/test";

// English 7x7 calendar mode, stage 2 (research candidate, not certified): the 3D cube and the animated step between
// adjacent months. The project config emulates prefers-reduced-motion: reduce, so the animation tests switch it off per
// page. A step is played only for a few moves (software GL draws a frame in 100 to 200 ms); "Skip to end" finishes it.
// The page publishes the SHA-256 digest of the pose the cube shows (data-c7-digest, computed in the page) and the
// test compares it with the stored hash of the node in graph.v1.json.

const ROOT = "#calendar7-root";
const watch = (page) => {
  const seen = [];
  page.on("pageerror", (e) => seen.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") seen.push(`console.error: ${m.text()}`);
  });
  return seen;
};
const graph = async (page) => (await (await page.request.get("/calendar7/graph.v1.json")).json()).nodes;
const idle = (page, month) => expect(page.locator(`${ROOT}[data-c7-state="idle"][data-c7-month="${month}"]`)).toHaveCount(1, { timeout: 30000 });

test("the 3D cube shows the month of the URL in the pose of the stored node", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2028&month=3");
  await idle(page, "2028-03");
  const canvas = page.locator("#studio-scene canvas");
  await expect(canvas).toBeVisible();
  const box = await canvas.boundingBox();
  expect(box.width).toBeGreaterThan(200);
  expect(box.height).toBeGreaterThan(200);
  await expect(canvas).toHaveAttribute("aria-label", /7x7 calendar cube showing March 2028/);
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[2].hash);
  await expect(page.locator(".c7-month")).toHaveText("March 2028");
  expect(seen).toEqual([]);
});

test("under reduced motion a step jumps: no animation, the state still equals the stored node", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  await expect(page.locator('[data-c7="note"]')).toBeVisible();
  await expect(page.locator('[data-c7="play"]')).toBeDisabled();
  await page.locator('a[data-nav="next"]').click();
  await idle(page, "2028-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await page.locator('a[data-nav="previous"]').click();
  await idle(page, "2028-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[0].hash);
  expect(seen).toEqual([]);
});

test("a step plays move by move; pause, play, speed and skip to the end reach the stored state, both ways", async ({ page }) => {
  test.slow();
  const seen = watch(page);
  const nodes = await graph(page);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  await expect(page.locator('[data-c7="note"]')).toBeHidden();
  const progress = page.locator('[data-c7="progress"]');
  await page.locator('a[data-nav="next"]').click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await expect(progress).toHaveText(/^Turning to February 2028: move \d+ of 138$/);
  // The heading, sheet and live region already name the new month; the digest is that of the pose being turned only at the end.
  await expect(page.locator(".c7-month")).toHaveText("February 2028");
  await page.locator('[data-c7="speed"]').selectOption("16");
  await page.locator('[data-c7="play"]').click(); // Pause
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "paused");
  await expect(page.locator('[data-c7="play"]')).toHaveText("Play");
  await expect(progress).toContainText("(paused)");
  await page.waitForTimeout(800); // the move in flight finishes first
  const frozen = await progress.textContent();
  await page.waitForTimeout(600);
  expect(await progress.textContent()).toBe(frozen);
  await page.locator('[data-c7="play"]').click(); // Play
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await expect(page.locator(".c7-live")).toContainText("The cube has turned to February 2028");
  // Backward: the inverse of the previous edge; and Next during the step ends it at once.
  await page.locator('a[data-nav="previous"]').click();
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-state", "playing");
  await page.locator('a[data-nav="next"]').click(); // back to February 2028 while January 2028 is still being turned to
  await expect(progress).toHaveText(/^Turning to February 2028/);
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-02");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[1].hash);
  await page.locator('a[data-nav="previous"]').click();
  await page.locator('[data-c7="skip"]').click();
  await idle(page, "2028-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[0].hash);
  expect(seen).toEqual([]);
});

test("the chain ends: the last month steps back, the first has no previous step", async ({ page }) => {
  const seen = watch(page);
  const nodes = await graph(page);
  await page.goto("/index.html?app=calendar7&year=2076&month=1");
  await idle(page, "2076-01");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[576].hash);
  await expect(page.locator('a[data-nav="next"]')).toHaveCount(0);
  await page.locator('a[data-nav="previous"]').click();
  await idle(page, "2075-12");
  await expect(page.locator(ROOT)).toHaveAttribute("data-c7-digest", nodes[575].hash);
  expect(seen).toEqual([]);
});

test("a month outside the chain hides the cube; leaving the mode releases the scene", async ({ page }) => {
  const seen = watch(page);
  await page.goto("/index.html?app=calendar7&year=2020&month=5");
  await expect(page.locator(".c7-unavailable")).toBeVisible();
  await expect(page.locator("#studio-scene")).toBeHidden();
  await page.locator('a[data-nav="start"]').click();
  await idle(page, "2028-01");
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("#studio-scene canvas")).toHaveCount(1);
  await page.evaluate(() => {
    const select = document.getElementById("studio-application");
    select.value = "counter";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", "counter", { timeout: 30000 });
  await expect(page.locator("#studio-scene")).toBeVisible();
  await expect(page.locator("#studio-scene")).not.toHaveAttribute("hidden", /.*/);
  await expect(page.locator(".c7-root")).toHaveCount(0);
  expect(seen).toEqual([]);
});

test("at 375 px the page scrolls instead of clipping and the controls are reachable by keyboard", async ({ page }) => {
  const seen = watch(page);
  await page.setViewportSize({ width: 375, height: 800 });
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/index.html?app=calendar7&year=2028&month=1");
  await idle(page, "2028-01");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  const stageOverflow = await page.evaluate(() => {
    const s = document.getElementById("studio-stage");
    return { sw: s.scrollWidth - s.clientWidth, canScroll: getComputedStyle(s).overflowY === "auto" };
  });
  expect(stageOverflow.sw).toBeLessThanOrEqual(0);
  expect(stageOverflow.canScroll).toBe(true);
  for (const name of ["speed", "reset"]) {
    await page.locator(`[data-c7="${name}"]`).focus();
    await expect(page.locator(`[data-c7="${name}"]`)).toBeFocused();
  }
  await page.locator('[data-c7="reset"]').press("Enter");
  expect(seen).toEqual([]);
});
