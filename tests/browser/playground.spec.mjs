import { test, expect } from "@playwright/test";
const ready = async (page) => {
  await page.goto("/playground.html");
  await expect(page.locator("#cube")).toHaveAttribute("data-ready", "true");
};
const idle = async (page) =>
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
const word = async (page, text) => {
  await page.locator("#notation").fill(text);
  await page.locator("#notation").press("Enter");
  await idle(page);
};
test("keyboard manual turns, invalid words, seeded scramble history roundtrip and exact solve in both designs", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await expect(page.locator("canvas")).toHaveCount(1);
  await word(page, "R L'");
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "false");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-equivalent",
    "true",
  );
  await page.locator("#solve").click();
  await idle(page);
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  for (const style of ["picture", "classic"]) {
    await page.locator("#design").selectOption(style);
    await idle(page);
    await expect(page.locator("#history li")).toHaveCount(0);
    await page.locator("#notation").fill("Rw U");
    await page.locator("#notation").press("Enter");
    await expect(page.locator("#status")).toContainText("Invalid");
    await expect(page.locator("#history li")).toHaveCount(0);
    await page.locator("h1").click();
    await page.keyboard.press("r");
    await idle(page);
    await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "1");
    await page.getByRole("button", { name: "Turn U2", exact: true }).focus();
    await page.keyboard.press("Enter");
    await idle(page);
    await page.locator("#undo").click();
    await idle(page);
    await page.locator("#redo").click();
    await idle(page);
    await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "2");
    await page.locator("#new-session").click();
    await idle(page);
    await page.locator("#seed").fill("0");
    await page.locator("#count").fill("5");
    await page.locator("#scramble").click();
    await idle(page);
    const history = await page.locator("#history li").allTextContents();
    for (let i = 0; i < 5; i++) {
      await page.locator("#undo").click();
      await idle(page);
    }
    await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
    for (let i = 0; i < 5; i++) {
      await page.locator("#redo").click();
      await idle(page);
    }
    await expect(page.locator("#history li")).toHaveText(history);
    await page.locator("#solve").click();
    await idle(page);
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-solver",
      "Verified",
    );
    await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  }
  expect(errors).toEqual([]);
});
test("cancel and Solve replace a moving word after its active legal turn; design change creates a session", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.locator("#speed").fill("500");
  await page.locator("#count").fill("100");
  await page.locator("#scramble").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-turning", "true");
  await expect(page.locator("#apply")).toBeDisabled();
  await expect(page.locator("#undo")).toBeDisabled();
  await page.locator("#cancel").click();
  await idle(page);
  await expect(page.locator("#history li")).toHaveCount(1);
  await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "1");
  await page.locator("#scramble").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-turning", "true");
  await page.locator("#solve").click();
  await page.locator("#speed").fill("10");
  await idle(page);
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-solver",
    "Verified",
  );
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  await page.locator("#speed").fill("500");
  await page.locator("#scramble").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-turning", "true");
  await page.locator("#design").selectOption("classic");
  await idle(page);
  await expect(page.locator("#cube")).toHaveAttribute("data-style", "classic");
  await expect(page.locator("#history li")).toHaveCount(0);
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  await expect(page.locator("canvas")).toHaveCount(1);
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
  await page.locator("#solve").click();
  await idle(page);
  await expect(page.locator("#cube")).toHaveAttribute("data-solver", "Unavailable"); // hash failures are recoverable (docs/PLAYGROUND_SOLVER_TABLE.md)
  await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "2");
  await expect(page.locator("#history li")).toHaveCount(2);
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "false");
  await expect(page.locator("#status")).toContainText("SHA-256");
});
for (const mobile of [false, true])
  test(`DPR2 ${mobile ? "mobile" : "desktop"} canvas fits viewport, camera changes only view, resources load`, async ({
    browser,
  }, testInfo) => {
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
    await page.locator("#cube canvas").scrollIntoViewIfNeeded();
    const host = await page.locator("#cube").boundingBox(),
      canvas = await page.locator("#cube canvas").boundingBox();
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
    await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
    await expect(page.locator("#cube")).toHaveAttribute("data-cursor", "0");
    await page.locator("#camera").click();
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
  await page.locator("#solve").click();
  await expect.poll(() => requested).toBe(true);
  await expect(page.locator("#cube")).toHaveAttribute("data-solver", "Loading");
  await page.locator("#design").selectOption("classic");
  await idle(page);
  await word(page, "F");
  release();
  await expect(page.locator("#status")).toContainText("Manual");
  // Load the same authenticated table for a fresh request: the obsolete request
  // must not animate its old source while this request solves the actual pose.
  await page.locator("#solve").click();
  await idle(page);
  await expect(page.locator("#cube")).toHaveAttribute("data-exact", "true");
  expect((await page.locator("#history li").allTextContents())[0]).toBe("F");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    CubeViewer.prototype.animate = async () => {
      throw Error("Injected rendering failure");
    };
  });
  const cursor = await page.locator("#cube").getAttribute("data-cursor");
  await page.getByRole("button", { name: "Turn R", exact: true }).click();
  await expect(page.locator("#cube")).toHaveAttribute("data-frozen", "true");
  await expect(page.locator("#cube")).toHaveAttribute("data-cursor", cursor);
  await expect(page.locator("#status")).toContainText("Reload");
  await expect(page.locator("#exact")).toHaveText("Unknown");
  await expect(page.locator("#equivalent")).toHaveText("Unknown");
  await expect(page.locator("#solve")).toBeDisabled();
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
  await page.goto("/playground.html");
  await expect(page.locator("#status")).toContainText("Unable to start");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#exact")).toHaveText("Unavailable");
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.locator("#apply")).toBeDisabled();
});
