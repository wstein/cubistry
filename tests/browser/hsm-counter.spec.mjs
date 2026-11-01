import { test, expect } from "@playwright/test";
async function settled(page, value) {
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-value",
    String(value),
  );
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
async function choose(page) {
  await page.goto("/");
  await expect(page.locator("#application")).toBeEnabled();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const configure = CubeViewer.prototype.configure;
    const animate = CubeViewer.prototype.animate;
    CubeViewer.prototype.configure = function (print, state, assets) {
      window.hsmPrint = print;
      window.hsmState = state;
      return configure.call(this, print, state, assets);
    };
    CubeViewer.prototype.animate = async function (presentation, timing) {
      await animate.call(this, presentation, timing);
      window.hsmState = presentation.to;
    };
  });
  await page.selectOption("#application", "hsm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
  await expect(page.locator("#application")).toBeEnabled();
  await settled(page, 0);
}
async function physical(page, letter, value) {
  const glyphs = await page.evaluate(async () => {
    const { stickerPoses } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const poses = stickerPoses(window.hsmPrint, window.hsmState);
    return [
      [-1, 1, 1],
      [1, 1, 1],
      [-1, -1, 1],
      [1, -1, 1],
    ].map((position) => {
      const sticker = poses.find(
        (p) =>
          JSON.stringify(p.p) === JSON.stringify(position) &&
          JSON.stringify(p.n) === "[0,0,1]",
      );
      return { assetId: sticker.assetId, up: sticker.up };
    });
  });
  expect(glyphs).toEqual(
    ["blank", letter, ...String(value).padStart(2, "0")].map((assetId) => ({
      assetId,
      up: [0, 1, 0],
    })),
  );
}
test("all nine HSM variants wrap both ways within six moves and render fixed glyphs", async ({
  page,
}) => {
  await choose(page);
  for (const letter of ["H", "S", "M"]) {
    await page.selectOption("#hsm-letter", letter);
    await settled(page, 0);
    await expect(page.locator("#status")).toContainText(`${letter} · 00`);
    await expect(page.locator("#rotation-speed")).toHaveValue("4");
    await expect(page.locator("#error")).toBeEmpty();
    for (const maximum of [59, 23, 11]) {
      await page.selectOption("#hsm-range", String(maximum));
      await page.fill("#hsm-value", String(maximum));
      await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
      await settled(page, maximum);
      await physical(page, letter, maximum);
      await page.locator('[data-hsm-delta="1"]').click();
      await settled(page, 0);
      await physical(page, letter, 0);
      expect(
        Number(
          (await page.locator("#move-progress").textContent())
            .split("/")[1]
            .split("moves")[0],
        ),
      ).toBeLessThanOrEqual(6);
      await page.locator('[data-hsm-delta="-1"]').click();
      await settled(page, maximum);
      await physical(page, letter, maximum);
    }
    await page.locator("#hsm-reset").click();
    await settled(page, 0);
    await expect(page.locator("#status")).toContainText(`${letter} · 00`);
  }
});
test("HSM run stop resume, validation, mobile and existing application state remain intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page);
  await page.screenshot({ path: "test-results/hsm-mobile.png" });
  // Default rotation time for every unit is 100 ms (stop index 4).
  await expect(page.locator("#rotation-speed")).toHaveValue("4");
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.fill("#hsm-value", "60");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#error")).toContainText("00 to 59");
  await settled(page, 0);
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).not.toHaveAttribute("data-value", "0");
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  const stopped = await page.locator("#cube").getAttribute("data-value");
  await page.waitForTimeout(1200);
  await settled(page, stopped);
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).not.toHaveAttribute(
    "data-value",
    stopped,
  );
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.selectOption("#application", "certified");
  await settled(page, 0);
  await page.fill("#value", "42");
  await page.locator("#set").click();
  await settled(page, 42);
  await page.selectOption("#application", "hsm-counter");
  await settled(page, 0);
  await page.selectOption("#application", "certified");
  await settled(page, 42);
  await page.selectOption("#application", "five-second-timer");
  await settled(page, "30:00");
});
test("M33 has a physical unprinted upper-left corner", async ({ page }) => {
  await choose(page);
  await page.selectOption("#hsm-letter", "M");
  await expect(page.locator("#status")).toContainText("M · 00");
  await page.fill("#hsm-value", "33");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 33);
  await physical(page, "M", 33);
  expect(
    await page.evaluate(
      () =>
        window.hsmPrint.stickers.filter((s) => s.assetId === "blank").length,
    ),
  ).toBe(3);
  await page.screenshot({ path: "test-results/hsm-blank-M33.png" });
});
test("single HSM counter defaults to 100 ms for H, M and S and stays freely adjustable", async ({
  page,
}) => {
  const defaults = {
    H: ["4", "100 ms"],
    M: ["4", "100 ms"],
    S: ["4", "100 ms"],
  };
  const slider = page.locator("#rotation-speed");
  await choose(page);
  // Opening the counter applies the default of the initially selected unit.
  await expect(page.locator("#hsm-letter")).toHaveValue("H");
  await expect(slider).toHaveValue(defaults.H[0]);
  await expect(slider).toHaveAttribute("aria-valuetext", /^100 ms/);
  // Changing the unit resets the slider to that unit's default.
  for (const letter of ["M", "S", "H", "M"]) {
    // A non-default stop first, so that only the reset on the unit switch can bring the slider back to "4".
    await slider.fill("2");
    await expect(slider).toHaveValue("2");
    await page.selectOption("#hsm-letter", letter);
    // The default is applied after the asynchronous reconfiguration; every default is "4", so the slider value
    // alone cannot show that it ran. The status line is updated right after it.
    await expect(page.locator("#status")).toContainText(letter + " · 00");
    await settled(page, 0);
    await expect(slider).toHaveValue(defaults[letter][0]);
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      new RegExp("^" + defaults[letter][1]),
    );
  }
  // The slider stays freely adjustable on every stop and is not re-forced.
  for (const stop of ["0", "6", "2"]) {
    await slider.fill(stop);
    await expect(slider).toHaveValue(stop);
    await settled(page, 0);
    await expect(slider).toHaveValue(stop);
  }
  // Re-opening the counter from another application applies the default again.
  await page.selectOption("#application", "certified");
  await settled(page, 0);
  await page.selectOption("#application", "hsm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
  await settled(page, 0);
  const letter = await page.locator("#hsm-letter").inputValue();
  await expect(slider).toHaveValue(defaults[letter][0]);
});
