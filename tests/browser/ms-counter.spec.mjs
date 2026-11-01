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
    window.msTurns = [];
    CubeViewer.prototype.configure = function (print, state, assets) {
      window.msPrint = print;
      window.msState = state;
      return configure.call(this, print, state, assets);
    };
    CubeViewer.prototype.animate = async function (presentation, timing) {
      await animate.call(this, presentation, timing);
      window.msState = presentation.to;
      window.msTurns.push(presentation.move);
    };
  });
  await page.selectOption("#application", "ms-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "ms-counter",
  );
  await expect(page.locator("#application")).toBeEnabled();
  await settled(page, 0);
  // Fastest rotation keeps the period walks short.
  await page.locator("#rotation-speed").fill("6");
}
/** The pinned runtime as the page fetches it. */
const runtime = (page) =>
  page.evaluate(async () => (await fetch("/ms-counter.v1.json")).json());
async function physical(page, letter, value) {
  const glyphs = await page.evaluate(async () => {
    const { stickerPoses } =
      await import("/packages/cube-mechanics/src/index.ts");
    const poses = stickerPoses(window.msPrint, window.msState);
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
      return {
        assetId: sticker.assetId,
        up: sticker.assetId === "blank" ? null : sticker.up,
      };
    });
  });
  expect(glyphs).toEqual(
    ["blank", letter, ...String(value).padStart(2, "0")].map((assetId) => ({
      assetId,
      up: assetId === "blank" ? null : [0, 1, 0],
    })),
  );
}
/** Turns played since the last call, in research notation. */
const turns = async (page) =>
  page.evaluate(async () => {
    const { serializeMove } =
      await import("/packages/cube-mechanics/src/index.ts");
    const out = window.msTurns.map((m) => serializeMove(m)).join(" ");
    window.msTurns = [];
    return out;
  });
const inverse = (word) =>
  word
    .split(" ")
    .reverse()
    .map((m) => (m.endsWith("'") ? m[0] : m.endsWith("2") ? m : m + "'"))
    .join(" ");
const progressTotal = async (page) =>
  Number(
    (await page.locator("#move-progress").textContent())
      .split("/")[1]
      .split("moves")[0],
  );

test("M/S counter plays the saved research steps and their exact inverses", async ({
  page,
}) => {
  test.setTimeout(120000);
  await choose(page);
  const data = await runtime(page);
  await expect(page.locator("#error")).toBeEmpty();
  // One print (S3): no print chooser.
  await expect(page.locator("#ms-print")).toHaveCount(0);
  await expect(page.locator("#ms-controls")).not.toContainText("M3");
  await expect(page.locator("#status")).toContainText("M · 00");
  await expect(page.locator("#ms-period")).toHaveText(
    "S3 · M period: 1 lap, 177 moves, at most 4 per step",
  );
  await physical(page, "M", 0);
  expect(
    await page.evaluate(
      () => window.msPrint.stickers.filter((s) => s.assetId === "blank").length,
    ),
  ).toBe(3);
  await turns(page);
  for (const letter of ["M", "S", "M"]) {
    await page.selectOption("#ms-letter", letter);
    await settled(page, 0);
    // Changing the unit applies its default speed; keep the fastest stop.
    await page.locator("#rotation-speed").fill("6");
    await expect(page.locator("#status")).toContainText(`${letter} · 00`);
    const words = data.print.runs.find((r) => r.letter === letter).words;
    await turns(page);
    // Up three steps, then down three: the words, then the words inverted.
    for (let v = 1; v <= 3; v++) {
      await page.locator('[data-ms-delta="1"]').click();
      await settled(page, v);
      await physical(page, letter, v);
      expect(await turns(page)).toBe(words[v - 1]);
      expect(await progressTotal(page)).toBeLessThanOrEqual(4);
    }
    for (let v = 2; v >= 0; v--) {
      await page.locator('[data-ms-delta="-1"]').click();
      await settled(page, v);
      await physical(page, letter, v);
      expect(await turns(page)).toBe(inverse(words[v]));
    }
    // The 00 -> 59 wrap down is the last word inverted, and back up.
    await page.locator('[data-ms-delta="-1"]').click();
    await settled(page, 59);
    await physical(page, letter, 59);
    expect(await turns(page)).toBe(inverse(words.at(-1)));
    await page.locator('[data-ms-delta="1"]').click();
    await settled(page, 0);
    expect(await turns(page)).toBe(words.at(-1));
    await expect(page.locator("#error")).toBeEmpty();
  }
});

test("S3 seconds run over two laps and Set walks the saved steps", async ({
  page,
}) => {
  test.setTimeout(180000);
  await choose(page);
  const data = await runtime(page);
  await page.selectOption("#ms-letter", "S");
  await settled(page, 0);
  await page.locator("#rotation-speed").fill("6");
  await expect(page.locator("#ms-period")).toHaveText(
    "S3 · S period: 2 laps, 324 moves, at most 3 per step · lap 1 of 2",
  );
  const words = data.print.runs[1].words;
  await page.fill("#ms-value", "59");
  await page.locator("#ms-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 59);
  await physical(page, "S", 59);
  // Set 59 from 00 walks one step down: the last word of lap 2, inverted,
  // which lands on lap 2.
  expect(await turns(page)).toBe(inverse(words[119]));
  await expect(page.locator("#ms-period")).toContainText("lap 2 of 2");
  // Lap 2's 59 -> 00 step closes the period onto lap 1.
  await page.locator('[data-ms-delta="1"]').click();
  await settled(page, 0);
  expect(await turns(page)).toBe(words[119]);
  await expect(page.locator("#ms-period")).toContainText("lap 1 of 2");
  // Count up through lap 1 into lap 2: 00 .. 59 then 00 with lap 1's words.
  for (let v = 1; v <= 60; v++) {
    await page.locator('[data-ms-delta="1"]').click();
    await settled(page, v % 60);
    expect(await turns(page)).toBe(words[v - 1]);
  }
  await physical(page, "S", 0);
  await expect(page.locator("#ms-period")).toContainText("lap 2 of 2");
  await page.locator('[data-ms-delta="1"]').click();
  await settled(page, 1);
  expect(await turns(page)).toBe(words[60]);
  // A longer Set walks the saved steps; every turn is counted.
  await page.fill("#ms-value", "30");
  await page.locator("#ms-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 30);
  await physical(page, "S", 30);
  const walked = await turns(page);
  expect(walked.split(" ").length).toBe(await progressTotal(page));
  // Input validation keeps the display.
  await page.fill("#ms-value", "60");
  await page.locator("#ms-set-form").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#error")).toContainText("00 to 59");
  await settled(page, 30);
});

test("M/S run stops after the current step and the other apps stay intact", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await choose(page);
  expect(
    await page.locator("html").evaluate((e) => e.scrollWidth),
  ).toBeLessThanOrEqual(390);
  await page.screenshot({ path: "test-results/ms-mobile.png" });
  await page.locator("#ms-run").click();
  await expect(page.locator("#cube")).not.toHaveAttribute("data-value", "0");
  await page.locator("#ms-run").click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  const stopped = await page.locator("#cube").getAttribute("data-value");
  await page.waitForTimeout(1200);
  await settled(page, stopped);
  await page.selectOption("#ms-direction", "-1");
  await page.locator("#ms-run").click();
  await expect(page.locator("#cube")).not.toHaveAttribute(
    "data-value",
    stopped,
  );
  await page.locator("#ms-run").click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.selectOption("#application", "certified");
  await settled(page, 0);
  await expect(page.locator("#ms-controls")).toBeHidden();
  await page.selectOption("#application", "ms-counter");
  await settled(page, 0);
  await expect(page.locator("#ms-controls")).toBeVisible();
  await page.goto("/?application=ms-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "ms-counter",
  );
  await settled(page, 0);
});
