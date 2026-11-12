import { test, expect } from "@playwright/test";
// The Picture Cube is the host mode index.html?app=playground. The legacy panel ids became the mode's ids
// (#playground-*), the status text is the shell chip, Exact/Rotation are readout values, the primary action is
// "Solve exact target" and the move list is in the Nerd drawer (nerd=1 opens it).
const chip = (page) => page.locator('[data-region="status-zone"] .shell-chip');
const readout = (page, index) => page.locator('[data-region="readout"] .shell-readout-value').nth(index);
const solve = (page) => page.locator('[data-region="primary-action"] button');
const moves = (page) => page.locator('[data-region="nerd-drawer"] ol[aria-label="Committed moves"] li');
const ready = async (page, search = "?app=playground&nerd=1") => {
  await page.goto(`/index.html${search}`);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-ready", "true");
  await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("canvas")).toHaveCount(1);
};
const idle = async (page) =>
  await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "false");
const word = async (page, text) => {
  await page.locator("#playground-notation").fill(text);
  await page.locator("#playground-notation").press("Enter");
  await idle(page);
};
test("keyboard manual turns, invalid words, seeded scramble history roundtrip and exact solve in every design", async ({
  page,
}) => {
  // The loop below runs one full session per design; "pastel" made it three (912e48ac).
  test.slow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await word(page, "R L'");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "false");
  await expect(page.locator("#playground-cube")).toHaveAttribute(
    "data-equivalent",
    "true",
  );
  await solve(page).click();
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  for (const style of ["picture", "pastel", "classic"]) {
    await page.locator("#playground-design").selectOption(style);
    await idle(page);
    await expect(moves(page)).toHaveCount(0);
    await page.locator("#playground-notation").fill("Rw U");
    await page.locator("#playground-notation").press("Enter");
    await expect(chip(page)).toContainText("Invalid");
    await expect(moves(page)).toHaveCount(0);
    await page.locator("#studio-heading").click();
    await page.keyboard.press("r");
    await idle(page);
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", "1");
    await page.getByRole("button", { name: "Turn U2", exact: true }).focus();
    await page.keyboard.press("Enter");
    await idle(page);
    await page.locator("#playground-undo").click();
    await idle(page);
    await page.locator("#playground-redo").click();
    await idle(page);
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", "2");
    await page.locator("#playground-new-session").click();
    await idle(page);
    await page.locator("#playground-seed").fill("0");
    await page.locator("#playground-count").fill("5");
    await page.locator("#playground-scramble").click();
    await idle(page);
    const history = await moves(page).allTextContents();
    for (let i = 0; i < 5; i++) {
      await page.locator("#playground-undo").click();
      await idle(page);
    }
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
    for (let i = 0; i < 5; i++) {
      await page.locator("#playground-redo").click();
      await idle(page);
    }
    await expect(moves(page)).toHaveText(history);
    await solve(page).click();
    await idle(page);
    await expect(page.locator("#playground-cube")).toHaveAttribute(
      "data-solver",
      "Verified",
    );
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  }
  expect(errors).toEqual([]);
});
test("cancel and Solve replace a moving word after its active legal turn; design change creates a session", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.locator("#playground-speed").fill("500");
  await page.locator("#playground-count").fill("100");
  await page.locator("#playground-scramble").click();
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-turning", "true");
  await expect(page.locator("#playground-apply")).toBeDisabled();
  await expect(page.locator("#playground-undo")).toBeDisabled();
  await page.locator("#playground-cancel").click();
  await idle(page);
  await expect(moves(page)).toHaveCount(1);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", "1");
  await page.locator("#playground-scramble").click();
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-turning", "true");
  await solve(page).click();
  await page.locator("#playground-speed").fill("10");
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  await page.locator("#playground-speed").fill("500");
  await page.locator("#playground-scramble").click();
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-turning", "true");
  await page.locator("#playground-design").selectOption("classic");
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-style", "classic");
  await expect(moves(page)).toHaveCount(0);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  await expect(page.locator("canvas")).toHaveCount(1);
});
test("every picture theme loads on demand and starts a fresh session", async ({
  page,
}) => {
  test.slow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(r.url());
  });
  await ready(page);
  const themes = (
    await page.locator("#playground-design option").evaluateAll((os) => os.filter((o) => !o.disabled).map((o) => o.value))
  ).filter((v) => !["classic", "picture", "pastel"].includes(v)); // "upload" stays disabled until pictures are added
  for (const theme of themes) {
    await page.locator("#playground-design").selectOption(theme);
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-style", theme, {
      timeout: 30000,
    });
    await idle(page);
    await expect(moves(page)).toHaveCount(0);
    await word(page, "R U");
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "false");
    await solve(page).click();
    await idle(page);
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
    await expect(page.locator("canvas")).toHaveCount(1);
  }
  expect(errors).toEqual([]);
});
test("a pending theme load is fetched once and blocks moves on the old puzzle until it settles", async ({
  page,
}) => {
  test.slow();
  await ready(page);
  const themes = (
    await page.locator("#playground-design option").evaluateAll((os) => os.map((o) => o.value))
  ).filter((v) => !["classic", "picture", "pastel"].includes(v));
  if (!themes.length) return; // no registered theme: nothing to load
  const theme = themes[0];
  let release;
  const gate = new Promise((resolve) => (release = resolve)),
    counts = {};
  await page.route(`**/playground-${theme}/*.svg`, async (route) => {
    const path = new URL(route.request().url()).pathname;
    counts[path] = (counts[path] ?? 0) + 1;
    await gate;
    await route.continue();
  });
  await word(page, "R U");
  await page.locator("#playground-design").selectOption(theme);
  await expect(chip(page)).toContainText("Loading");
  await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#playground-design")).toHaveValue(theme);
  for (const id of ["#playground-apply", "#playground-notation", "#playground-undo", "#playground-redo", "#playground-scramble", "#playground-new-session"])
    await expect(page.locator(id)).toBeDisabled();
  await expect(solve(page)).toBeDisabled();
  await expect(page.getByRole("button", { name: "Turn R", exact: true })).toBeDisabled();
  await page.locator("#studio-heading").click();
  await page.keyboard.press("r");
  await expect(moves(page)).toHaveCount(2);
  // Choosing another design cancels the pending one; choosing the theme again must not fetch it twice.
  await page.locator("#playground-design").selectOption("picture");
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-style", "picture");
  await page.locator("#playground-design").selectOption(theme);
  await expect(chip(page)).toContainText("Loading");
  release();
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-style", theme, { timeout: 30000 });
  await idle(page);
  await expect(moves(page)).toHaveCount(0);
  await expect(page.locator("#playground-apply")).toBeEnabled();
  expect(Object.keys(counts)).toHaveLength(6);
  expect(Object.values(counts)).toEqual([1, 1, 1, 1, 1, 1]);
});
test("corrupt solver table fails explicitly without moving or changing history", async ({
  page,
}) => {
  await page.route("**/optimal-2x2*.bin*", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/octet-stream",
      body: Buffer.alloc(1837112),
    }),
  );
  await ready(page);
  await word(page, "R U");
  await solve(page).click();
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-solver", "Unavailable"); // hash failures are recoverable (docs/PLAYGROUND_SOLVER_TABLE.md)
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", "2");
  await expect(moves(page)).toHaveCount(2);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "false");
  await expect(chip(page)).toContainText("SHA-256");
});
for (const mobile of [false, true])
  test(`DPR2 ${mobile ? "mobile" : "desktop"} canvas fits viewport, camera changes only view, resources load`, async ({
    browser,
  }, testInfo) => {
    test.slow(); // the DPR2 screenshot took 17 s on a healthy CI runner and 30 s on a slow one (4 s locally)
    const context = await browser.newContext({
        viewport: mobile
          ? { width: 390, height: 844 }
          : { width: 1280, height: 1000 },
        deviceScaleFactor: 2,
        reducedMotion: "reduce",
      }),
      page = await context.newPage(),
      errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(r.url());
    });
    await ready(page);
    await page.locator("#playground-cube canvas").scrollIntoViewIfNeeded();
    const host = await page.locator("#playground-cube").boundingBox(),
      canvas = await page.locator("#playground-cube canvas").boundingBox();
    expect(canvas.width).toBeCloseTo(host.width, 0);
    expect(canvas.height).toBeCloseTo(host.height, 0);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.mouse.move(host.x + host.width / 2, host.y + host.height / 2);
    await page.mouse.down();
    await page.mouse.move(
      host.x + host.width * 0.7,
      host.y + host.height * 0.3,
      { steps: 8 },
    );
    await page.mouse.up();
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
    await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", "0");
    await page.locator("#playground-reset-view").click();
    await page.screenshot({
      path: testInfo.outputPath(
        `playground-${mobile ? "mobile" : "desktop"}.png`,
      ),
      fullPage: true,
    });
    expect(errors).toEqual([]);
    await context.close();
  });

test("obsolete solver load cannot play after a new session; viewer failure freezes uncommitted history", async ({
  page,
}) => {
  let release;
  const blocked = new Promise((resolve) => (release = resolve));
  let requested = false;
  await page.route("**/optimal-2x2*.bin*", async (route) => {
    requested = true;
    await blocked;
    await route.continue();
  });
  await ready(page);
  await word(page, "R U");
  await solve(page).click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-solver", "Loading");
  await page.locator("#playground-design").selectOption("classic");
  await idle(page);
  await word(page, "F");
  release();
  await expect(chip(page)).toContainText("Manual");
  // Load the same authenticated table for a fresh request: the obsolete request
  // must not animate its old source while this request solves the actual pose.
  await solve(page).click();
  await idle(page);
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-exact", "true");
  expect((await moves(page).allTextContents())[0]).toBe("F");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    CubeViewer.prototype.animate = async () => {
      throw Error("Injected rendering failure");
    };
  });
  const cursor = await page.locator("#playground-cube").getAttribute("data-cursor");
  await page.getByRole("button", { name: "Turn R", exact: true }).click();
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-frozen", "true");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-cursor", cursor);
  await expect(chip(page)).toContainText("Reload");
  await expect(readout(page, 2)).toHaveText("Unknown");
  await expect(readout(page, 3)).toHaveText("Unknown");
  await expect(solve(page)).toBeDisabled();
});

test("untrusted picture assets fail startup explicitly without a canvas or enabled turns", async ({
  page,
}) => {
  await page.route("**/playground/F_0_0.svg", (route) =>
    route.fulfill({
      status: 200,
      contentType: "image/svg+xml",
      body: '<svg xmlns="http://www.w3.org/2000/svg"><script/></svg>',
    }),
  );
  await page.goto("/index.html?app=playground");
  await expect(chip(page)).toContainText("Unable to start");
  await expect(page.locator("#playground-cube")).toHaveAttribute("aria-busy", "false");
  await expect(readout(page, 2)).toHaveText("Unavailable");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("#playground-apply")).toBeDisabled();
});

test("the size control offers 2 to 7, plays 2x2 only and keeps size= honest", async ({
  page,
}) => {
  await ready(page);
  await expect(page.locator("#studio-heading")).toHaveText("Picture Cube");
  await expect(page).toHaveTitle(/Picture Cube/);
  const radios = page.locator("#playground-size-control [role=radio]");
  await expect(radios).toHaveText(["2×2", "3×3", "4×4", "5×5", "6×6", "7×7"]);
  await expect(radios.nth(0)).toBeEnabled();
  await expect(radios.nth(0)).toHaveAttribute("aria-checked", "true");
  for (const i of [1, 2, 3, 4, 5]) await expect(radios.nth(i)).toBeDisabled();
  await expect(page.locator("#playground-size-note")).toContainText("Sizes 3 to 7 are not playable yet");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-size", "2");
  await radios.nth(0).click();
  expect(new URL(page.url()).searchParams.get("size")).toBe("2");
  // A valid size the engine cannot turn: the 2x2 stays, the page says why.
  await ready(page, "?app=playground&size=5");
  await expect(page.locator("#playground-cube")).toHaveAttribute("data-size", "2");
  await expect(page.locator("#playground-size-note")).toContainText("5×5 is not playable yet");
  await expect(page.locator("#playground-size-control [aria-checked=true]")).toHaveText("2×2");
  // An invalid value falls back with a note.
  await ready(page, "?app=playground&size=9");
  await expect(page.locator("#playground-size-note")).toContainText("size= must be a whole number from 2 to 7");
});
