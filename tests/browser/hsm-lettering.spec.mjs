import { test, expect } from "@playwright/test";
async function capture(page) {
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const configure = CubeViewer.prototype.configure;
    CubeViewer.prototype.configure = function (print, state, assets) {
      configure.call(this, print, state, assets);
      window.letteringView = this;
      window.letteringPrint = print;
      window.letteringState = state;
      window.letteringAssets = assets;
    };
  });
}
async function bounds(page, letter) {
  return page.evaluate((letter) => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const ctx = c.getContext("2d");
    ctx.translate(0, 256);
    ctx.scale(1, -1);
    ctx.drawImage(window.letteringAssets.images.get(letter), 0, 0);
    const d = ctx.getImageData(0, 0, 256, 256).data;
    let minY = 256,
      maxY = -1,
      ink = 0;
    for (let y = 0; y < 256; y++)
      for (let x = 0; x < 256; x++) {
        const i = (y * 256 + x) * 4;
        if (d[i] < 180 && d[i + 3] > 200) {
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
          ink++;
        }
      }
    return { minY, maxY, ink };
  }, letter);
}
test("word print replaces large unit symbols and keeps the counter value", async ({
  page,
}) => {
  await page.goto("/?application=hsm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await page.selectOption("#hsm-letter", "M");
  await expect(page.locator("#hsm-letter")).toBeEnabled();
  await page.fill("#hsm-value", "33");
  await page.locator("#hsm-set-form button").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "33");
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  await page.locator("#rotation-speed").fill("5");
  await capture(page);
  await page.selectOption("#hsm-lettering", "words");
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "33");
  await expect(page.locator("#rotation-speed")).toHaveValue("5");
  await expect(page.locator("#error")).toBeEmpty();
  expect(await page.evaluate(() => window.letteringPrint.id)).toBe(
    "hsm_counter_seconds_first_words",
  );
  for (const letter of ["M", "H", "S"]) {
    if (letter !== "M") {
      await page.selectOption("#hsm-letter", letter);
      await expect(page.locator("#hsm-letter")).toBeEnabled();
    }
    const b = await bounds(page, letter);
    // Raster top of the ascender/x-height ink at font size 80.64.
    const top = { H: 171, M: 171, S: 187 }[letter];
    expect(b.minY).toBeGreaterThanOrEqual(top - 3);
    expect(b.minY).toBeLessThanOrEqual(top + 3);
    expect(b.maxY).toBeLessThanOrEqual(236);
    expect(b.ink).toBeGreaterThan(50);
    expect(
      await page.evaluate(
        async ({ letter, value }) => {
          const { matchesTarget } = await import(
            "/packages/cube-mechanics/src/index.ts"
          );
          const { hsmTarget } = await import("/src/apps/hsm/design.ts");
          return matchesTarget(
            window.letteringPrint,
            window.letteringState,
            hsmTarget(letter, value),
          );
        },
        { letter, value: letter === "M" ? 33 : 0 },
      ),
    ).toBe(true);
    if (letter === "M") {
      await expect
        .poll(() =>
          page.evaluate(() => window.letteringView.renderer.info.render.frame),
        )
        .toBeGreaterThan(2);
      await page.screenshot({
        path: "test-results/hsm-word-min33.png",
        fullPage: true,
      });
    }
  }
  await page.selectOption("#hsm-lettering", "symbols");
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  expect((await bounds(page, "S")).minY).toBeLessThan(100);
});
test("the shared live clock offers bottom-only words and retains preferred speeds", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Date.now = () => Date.parse("2026-10-28T11:34:56Z");
  });
  await page.goto("/clock.html?lettering=words");
  await expect(page.locator("#clock-lettering")).toBeEnabled();
  await expect(page.locator("canvas")).toHaveCount(1);
  expect(
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      return clockUnits.map((u) => u.controller.view.presentedPrint.id);
    }),
  ).toEqual(Array(3).fill("hsm_counter_seconds_first_words"));
  await page.selectOption("#hours-speed", "250");
  await expect
    .poll(() =>
      page.evaluate(async () => {
        const { clockStage } = await import("/src/clock.mjs");
        return clockStage.renderer.info.render.frame;
      }),
    )
    .toBeGreaterThan(2);
  await page.screenshot({
    path: "test-results/live-clock-words.png",
    fullPage: true,
  });
  await page.selectOption("#clock-lettering", "symbols");
  await expect(page.locator("#clock-lettering")).toBeEnabled();
  await expect(page.locator("#hours-speed")).toHaveValue("250");
  await expect(page.locator("#minutes-speed")).toHaveValue("250");
  await expect(page.locator("#seconds-speed")).toHaveValue("100");
  expect(
    await page.evaluate(async () => {
      const { clockUnits } = await import("/src/clock.mjs");
      return clockUnits.map((u) => u.controller.view.presentedPrint.id);
    }),
  ).toEqual(Array(3).fill("hsm_counter_seconds_first"));
});
test("an invalid word asset leaves the existing fixed print and value usable", async ({
  page,
}) => {
  await page.goto("/?application=hsm-counter");
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await page.fill("#hsm-value", "33");
  await page.locator("#hsm-set-form button").click();
  await expect(page.locator("#hsm-lettering")).toBeEnabled();
  await page.route("**/assets/hsm/words/M.svg", async (route) => {
    const response = await route.fetch();
    await route.fulfill({ response, body: (await response.text()) + " " });
  });
  await page.selectOption("#hsm-lettering", "words");
  await expect(page.locator("#error")).not.toHaveText("");
  await expect(page.locator("#hsm-lettering")).toHaveValue("symbols");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "33");
  await expect(page.locator("#hsm-run")).toBeEnabled();
});
