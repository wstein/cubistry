// Browser regression tests for the H/M counter (print m3-SH). These exercise
// the application; they are not proofs of the research claims.
import { test, expect } from "@playwright/test";

/** Per-mode largest saved step, from the pinned m3-SH witness. */
const MODES = [
  ["M", 59, 3],
  ["H", 23, 4],
  ["H", 11, 4],
];
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
  await page.selectOption("#application", "hm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hm-counter",
  );
  await expect(page.locator("#application")).toBeEnabled();
  await settled(page, 0);
}
/** Front face: blank upper-left, upright letter, tens and units. */
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
      const s = poses.find(
        (p) =>
          JSON.stringify(p.p) === JSON.stringify(position) &&
          JSON.stringify(p.n) === "[0,0,1]",
      );
      return { assetId: s.assetId, up: s.assetId === "blank" ? null : s.up };
    });
  });
  expect(glyphs).toEqual(
    ["blank", letter, ...String(value).padStart(2, "0")].map((assetId) => ({
      assetId,
      up: assetId === "blank" ? null : [0, 1, 0],
    })),
  );
}
const lastMoves = async (page) =>
  Number(
    (await page.locator("#move-progress").textContent())
      .split("/")[1]
      .split("moves")[0],
  );
/** Select a unit and wait for its fresh 00 display to be installed. */
async function unit(page, letter) {
  await page.selectOption("#hsm-letter", letter);
  await expect(page.locator("#status")).toContainText(`${letter} · 00`);
  await settled(page, 0);
}
const options = (page, id) =>
  page.locator(`#${id} option`).evaluateAll((o) => o.map((e) => e.value));

test("H/M counter offers H and M with their own ranges and a blank upper-left", async ({
  page,
}) => {
  await choose(page);
  await expect(page.locator("#hsm-heading")).toHaveText("H/M Counter");
  await expect(page.locator("#hsm-lettering")).toBeHidden();
  expect(await options(page, "hsm-letter")).toEqual(["H", "M"]);
  await expect(page.locator("#hsm-letter")).toHaveValue("H");
  expect(await options(page, "hsm-range")).toEqual(["23", "11"]);
  await expect(page.locator("#status")).toContainText("H · 00");
  await physical(page, "H", 0);
  expect(
    await page.evaluate(() => [
      window.hsmPrint.id,
      window.hsmPrint.stickers.filter((s) => s.assetId === "blank").length,
    ]),
  ).toEqual(["hm_counter_m3_sh", 3]);
  await unit(page, "M");
  expect(await options(page, "hsm-range")).toEqual(["59"]);
  await physical(page, "M", 0);
  await page.screenshot({ path: "test-results/hm-M00.png" });
});

test("every H/M mode counts up and down on its period and wraps through 00", async ({
  page,
}) => {
  // Nine round trips of animated moves; allow for slow shared runners.
  test.setTimeout(90000);
  await choose(page);
  const step = async (letter, delta, value, largest) => {
    await page.locator(`[data-hsm-delta="${delta}"]`).click();
    await settled(page, value);
    await physical(page, letter, value);
    expect(await lastMoves(page)).toBeLessThanOrEqual(largest);
  };
  for (const [letter, maximum, largest] of MODES) {
    await unit(page, letter);
    await page.selectOption("#hsm-range", String(maximum));
    await settled(page, 0);
    // Up: the saved period; down: the same period run backward, inverted.
    await page.selectOption("#hsm-direction", "1");
    for (const value of [1, 2, 3]) await step(letter, 1, value, largest);
    await page.selectOption("#hsm-direction", "-1");
    for (const value of [2, 1, 0]) await step(letter, -1, value, largest);
    await step(letter, -1, maximum, largest);
    await page.selectOption("#hsm-direction", "1");
    await step(letter, 1, 0, largest);
    await expect(page.locator("#error")).toBeEmpty();
  }
});

test("Set, Reset, unit change and validation behave like the H/S/M counter", async ({
  page,
}) => {
  await choose(page);
  await unit(page, "M");
  await expect(page.locator("#rotation-speed")).toHaveValue("3");
  await page.fill("#hsm-value", "60");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#error")).toContainText("00 to 59");
  await page.fill("#hsm-value", "58");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 58);
  await physical(page, "M", 58);
  expect(await lastMoves(page)).toBeLessThanOrEqual(7);
  await page.locator('[data-hsm-delta="1"]').click();
  await settled(page, 59);
  await page.locator('[data-hsm-delta="1"]').click();
  await settled(page, 0);
  await physical(page, "M", 0);
  await page.fill("#hsm-value", "33");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 33);
  await page.locator("#hsm-reset").click();
  await settled(page, 0);
  await physical(page, "M", 0);
  // Changing the unit installs a fresh 00 display; it is not a counted step.
  await page.fill("#hsm-value", "05");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 5);
  await unit(page, "H");
  await expect(page.locator("#status")).toContainText("H · 00");
  await expect(page.locator("#rotation-speed")).toHaveValue("2");
  await physical(page, "H", 0);
  expect(await options(page, "hsm-range")).toEqual(["23", "11"]);
  // H 00–23 rejects 24; H 00–11 wraps 11 -> 00.
  await page.fill("#hsm-value", "24");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await expect(page.locator("#error")).toContainText("00 to 23");
  await page.selectOption("#hsm-range", "11");
  await page.fill("#hsm-value", "11");
  await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
  await settled(page, 11);
  await page.locator('[data-hsm-delta="1"]').click();
  await settled(page, 0);
  await physical(page, "H", 0);
  // Run counts by itself and stops on request.
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).not.toHaveAttribute("data-value", "0");
  await page.locator("#hsm-run").click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#error")).toBeEmpty();
});

test("the H/S/M counter keeps its own controls after the H/M counter", async ({
  page,
}) => {
  await choose(page);
  await page.selectOption("#application", "hsm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hsm-counter",
  );
  await settled(page, 0);
  await expect(page.locator("#hsm-heading")).toHaveText("H/S/M Counter");
  await expect(page.locator("#hsm-lettering")).toBeVisible();
  expect(await options(page, "hsm-letter")).toEqual(["H", "S", "M"]);
  expect(await options(page, "hsm-range")).toEqual(["59", "23", "11"]);
  expect(await page.evaluate(() => window.hsmPrint.id)).toBe(
    "hsm_counter_seconds_first",
  );
  await unit(page, "S");
  await physical(page, "S", 0);
  await page.selectOption("#application", "hm-counter");
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-application",
    "hm-counter",
  );
  await expect(page.locator("#status")).toContainText("H · 00");
  await settled(page, 0);
  await expect(page.locator("#hsm-letter")).toHaveValue("H");
  await physical(page, "H", 0);
});

// A failed H/M load must leave the running H/S/M counter and its controls
// exactly as they were: unit, range, lettering, heading and option lists.
for (const [name, fulfil] of [
  ["fetch failure", (route) => route.fulfill({ status: 404, body: "" })],
  [
    "hash mismatch",
    async (route) => {
      const response = await route.fetch();
      await route.fulfill({ response, body: (await response.text()) + " " });
    },
  ],
])
  test(`a failed H/M load (${name}) keeps the H/S/M selection`, async ({
    page,
  }) => {
    await page.goto("/?lettering=words");
    await expect(page.locator("#application")).toBeEnabled();
    await page.selectOption("#application", "hsm-counter");
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-application",
      "hsm-counter",
    );
    await settled(page, 0);
    await page.selectOption("#hsm-letter", "S");
    await expect(page.locator("#status")).toContainText("S · 00");
    await page.selectOption("#hsm-range", "11");
    await page.route("**/hm-counter.v1.json", fulfil);
    await page.selectOption("#application", "hm-counter");
    await expect(page.locator("#error")).not.toBeEmpty();
    await expect(page.locator("#application")).toHaveValue("hsm-counter");
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-application",
      "hsm-counter",
    );
    await expect(page.locator("#hsm-heading")).toHaveText("H/S/M Counter");
    await expect(page.locator("#hsm-lettering")).toBeVisible();
    await expect(page.locator("#hsm-lettering")).toHaveValue("words");
    expect(await options(page, "hsm-letter")).toEqual(["H", "S", "M"]);
    expect(await options(page, "hsm-range")).toEqual(["59", "23", "11"]);
    await expect(page.locator("#hsm-letter")).toHaveValue("S");
    await expect(page.locator("#hsm-range")).toHaveValue("11");
    // The old controller still counts the S unit on 00-11.
    await page.fill("#hsm-value", "11");
    await page.locator("#hsm-set-form").evaluate((f) => f.requestSubmit());
    await settled(page, 11);
    await expect(page.locator("#status")).toContainText("S · 11");
  });

test("a failed H/M unit change keeps the previous unit and range", async ({
  page,
}) => {
  await choose(page);
  await page.selectOption("#hsm-range", "11");
  await page.route("**/assets/**", (route) => route.abort());
  await page.selectOption("#hsm-letter", "M");
  await expect(page.locator("#error")).not.toBeEmpty();
  await expect(page.locator("#hsm-letter")).toHaveValue("H");
  expect(await options(page, "hsm-range")).toEqual(["23", "11"]);
  await expect(page.locator("#hsm-range")).toHaveValue("11");
  await expect(page.locator("#status")).toContainText("H · 00");
});
