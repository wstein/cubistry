import { test, expect } from "@playwright/test";

// Smoke test for the ten Chronocube Studio modes (src/chronocube.mjs, MODES and switchMode). Per mode it asserts the
// observable load signals only: no text in #studio-error (switchMode writes "Failed to load mode <id>: ..." there),
// no uncaught page error, no console.error, and a canvas with a non-zero box in #studio-scene. The canvas is
// mounted when an init function starts, before its designs and controllers load, so it is no ready signal. Ready
// is the test hook #shell[data-mode-ready=<id>], which switchMode sets after the init function resolved and
// removes at every switch. A switch is only triggered after the previous mode is ready: switchMode has no
// generation guard (#267), so a switch during init lets the old init write into the new mode.

// Same order and ids as the <option> values of #studio-application that are not page links (chronocube.html);
// the first test compares this list with the page.
const MODES = ["clock", "ms-timer", "hm-clock", "tenth", "counter", "timer", "five-second-timer", "hsm-counter", "ms-counter", "hm-one-cube"];

// Console errors a mode is known to log on the current code. Everything else fails. An entry is the exact
// message fragment and the issue that tracks the defect; remove it when the issue is fixed.
const KNOWN_ERRORS = {
  // initHmClockMode passes 2 units to LiveClockScheduler.tick, which demands 3; draw() catches and logs the
  // error every 100 ms. The mode still renders. Tracked in wstein/cubistry#265.
  "hm-clock": ["Invalid live clock snapshot"],
};

// On the CI runners (software GL, shared CPU) a step takes 4 to 9 times its local time, so the ready wait is 30 s
// (it includes ensureProof and the design fetches), and a test gets the slow limit (3 x 30 s). The
// all-modes test loads ten modes in one session and gets an explicit limit of 10 x 30 s.
const LOAD_MS = 30000;
const SETTLE_MS = 1500;

const watch = (page) => {
  const seen = { pageErrors: [], consoleErrors: [] };
  page.on("pageerror", (e) => seen.pageErrors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") seen.consoleErrors.push(m.text());
  });
  return seen;
};

const assertLoaded = async (page, seen, id) => {
  await expect(page.locator("#shell")).toHaveAttribute("data-mode-ready", id, { timeout: LOAD_MS });
  await expect(page.locator("#studio-application")).toHaveValue(id);
  const canvas = page.locator("#studio-scene canvas").first();
  await expect(canvas).toBeVisible();
  await page.waitForTimeout(SETTLE_MS);
  const box = await canvas.boundingBox();
  expect(box, `${id}: canvas box`).not.toBeNull();
  expect(box.width, `${id}: canvas width`).toBeGreaterThan(0);
  expect(box.height, `${id}: canvas height`).toBeGreaterThan(0);
  await expect(page.locator("#studio-error"), `${id}: studio error`).toHaveText("");
  expect(seen.pageErrors, `${id}: uncaught page errors`).toEqual([]);
  const known = KNOWN_ERRORS[id] ?? [];
  const unexpected = seen.consoleErrors.filter((t) => !known.some((k) => t.includes(k)));
  expect(unexpected, `${id}: console errors`).toEqual([]);
};

test.beforeEach(() => {
  test.slow();
});

test("the mode list matches the studio select", async ({ page }) => {
  await page.goto("/chronocube.html");
  const values = await page.locator("#studio-application option").evaluateAll((os) => os.map((o) => o.value));
  expect(values.filter((v) => !v.endsWith(".html"))).toEqual(MODES);
});

for (const id of MODES) {
  test(`mode ${id} loads without errors`, async ({ page }) => {
    const seen = watch(page);
    await page.goto(`/chronocube.html?mode=${id}`);
    await assertLoaded(page, seen, id);
  });
}

test("switching through all modes in one session loads each without errors", async ({ page }) => {
  test.setTimeout(10 * 30000);
  const seen = watch(page);
  await page.goto(`/chronocube.html?mode=${MODES[0]}`);
  await assertLoaded(page, seen, MODES[0]);
  for (const id of MODES.slice(1)) {
    seen.pageErrors.length = 0;
    seen.consoleErrors.length = 0;
    await page.selectOption("#studio-application", id);
    await expect(page).toHaveURL(new RegExp(`[?&]mode=${id}(&|$)`));
    await assertLoaded(page, seen, id);
  }
});
