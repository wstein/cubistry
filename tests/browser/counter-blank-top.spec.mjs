// Browser regressions for the blank-top Counter variant. They drive the real
// page and viewer and compare executed turns with the pinned research words.
// These are app regression tests, NOT proofs.
import { frontStickerPoint } from "../helpers/front-projection.mjs";
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { readFileSync } from "node:fs";

const active = ["abcdef", "bc", "abdeg", "abcdg", "bcfg", "acdfg", "acdefg", "abc", "abcdefg", "abcdfg"];
const routes = Object.fromEntries(
  ["lz", "nz"].map((mode) => [
    mode,
    readFileSync(`data/counter/blank-top/routes-${mode}.tsv`, "utf8")
      .trim()
      .split("\n")
      .slice(1)
      .map((line) => line.split("\t"))
      .map(([, , , , increment, , , decrement]) => ({ increment, decrement })),
  ]),
);
/** Rendered segments of one front cell; centerY -0.5 is the lower row. */
function rendered(image, centerX, centerY = -0.5) {
  const blue = ([r, g, b]) => b > r * 1.25 && b > g * 1.05;
  const sample = (px, py) => {
    const [x, y] = frontStickerPoint(image, centerX, centerY, px, py),
      colors = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const at = ((y + dy) * image.width + x + dx) * 4;
        colors.push([...image.data.slice(at, at + 3)]);
      }
    return colors.some(blue);
  };
  const centers = [[128, 48], [192, 84], [192, 168], [128, 208], [64, 168], [64, 84], [128, 128]];
  return {
    segments: centers.map((p, i) => (sample(...p) ? "abcdefg"[i] : "")).join(""),
    baseline: sample(128, 234),
  };
}
const token = (p) => p.move.face + (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : "");
async function chooseBlankTop(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#counter-print")).toHaveValue("titled");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate;
    window.executed = [];
    CubeViewer.prototype.animate = async function (p) {
      await animate.call(this, p);
      window.executed.push(p);
    };
  });
  await page.locator("#counter-print").selectOption("blank-top");
  await expect(page.locator("#status")).toContainText("Blank-top print");
  await expect(page.locator("#counter-print")).toBeEnabled();
  await expect(page.locator("#session-moves")).toHaveText("0");
  await expect(page.locator("#mode-switch")).toBeVisible();
}
const executed = (page) => page.evaluate(() => window.executed.length);
const words = (page, from) =>
  page.evaluate((from) => window.executed.slice(from), from).then((m) => m.map(token).join(" "));
const settle = async (page, value) => {
  await expect(page.locator("#cube")).toHaveAttribute("data-value", String(value));
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
};
const go = async (page, value) => {
  await page.locator("#value").fill(String(value));
  await page.locator("#set").click();
  await settle(page, value);
};
async function expectFront(page, top, tens, units) {
  const img = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  for (const center of [-0.5, 0.5]) expect(rendered(img, center, 0.5).segments).toBe(top);
  const cells = [
    [tens, -0.5],
    [units, 0.5],
  ];
  for (const [digit, center] of cells) {
    const actual = rendered(img, center);
    if (digit === null) expect(actual.segments).toBe("");
    else {
      expect(actual.segments).toBe(active[digit]);
      expect(actual.baseline).toBe(true);
    }
  }
}

for (const [mode, lap] of [
  ["lz", 278],
  ["nz", 270],
])
  test(`blank-top ${mode.toUpperCase()} counts a full lap through the wrap edge in ${lap} HTM`, async ({ page }) => {
    test.setTimeout(180000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await chooseBlankTop(page);
    await page.locator("#wrap").check();
    if (mode === "nz") {
      await page.locator("#format").uncheck();
      await settle(page, 0);
      await expect(page.locator("#setup-moves")).toHaveText("6");
    }
    await expect(page.locator("#session-moves")).toHaveText("0");
    let offset = await executed(page);
    for (let step = 1; step <= 100; step++) {
      await page.locator('[data-delta="1"]').click();
      await settle(page, step % 100);
      expect(await words(page, offset)).toBe(routes[mode][step - 1].increment);
      offset = await executed(page);
      if (step === 7) await expectFront(page, "", mode === "nz" ? null : 0, 7);
      if (step === 42) await expectFront(page, "", 4, 2);
    }
    await expect(page.locator("#session-moves")).toHaveText(String(lap));
    await expectFront(page, "", mode === "nz" ? null : 0, 0);
    // Down through the wrap edge: the exact research decrement word.
    await page.locator('[data-delta="-1"]').click();
    await settle(page, 99);
    expect(await words(page, offset)).toBe(routes[mode][99].decrement);
    expect(errors).toEqual([]);
  });

test("Leading Zero switches the physical mode at 0 with 6 setup moves outside the session count", async ({ page }) => {
  test.setTimeout(90000);
  await chooseBlankTop(page);
  await expect(page.locator("#format")).toBeChecked();
  await expect(page.locator("#format")).toBeEnabled();
  await page.locator('[data-delta="1"]').click();
  await settle(page, 1);
  // Between 1 and 30 the two modes hold different hidden states: no switch.
  await expect(page.locator("#format")).toBeDisabled();
  await page.locator('[data-delta="-1"]').click();
  await settle(page, 0);
  const session = await page.locator("#session-moves").textContent();
  const before = await executed(page);
  await page.locator("#format").uncheck();
  await expect(page.locator("#status")).toContainText("no leading zero (NZ)");
  await settle(page, 0);
  expect(await words(page, before)).toBe("L' U B' U L2 U");
  await expect(page.locator("#session-moves")).toHaveText(session);
  await expect(page.locator("#setup-moves")).toHaveText("6");
  await expectFront(page, "", null, 0);
  // At 31..99 both modes share the cube state: switching plays no turn.
  await go(page, 45);
  const at45 = await executed(page);
  await page.locator("#format").check();
  await expect(page.locator("#status")).toContainText("leading zero (LZ)");
  expect(await executed(page)).toBe(at45);
  await expect(page.locator("#setup-moves")).toHaveText("6");
  // The variant and mode survive a reload; the titled print is still available.
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#counter-print")).toHaveValue("blank-top");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "45");
  await expect(page.locator("#format")).toBeChecked();
  await page.locator("#counter-print").selectOption("titled");
  await expect(page.locator("#status")).toContainText("COUNTER title print installed at 45");
  await expect(page.locator("#mode-switch")).toBeHidden();
  await expect(page.locator("#format-note")).toContainText("only the leading 0");
});

test("arbitrary jumps on the blank-top print return to canonical states and resume stored steps", async ({ page }) => {
  await chooseBlankTop(page);
  await page.locator("#format").uncheck();
  await settle(page, 0);
  await go(page, 63);
  await go(page, 4);
  await expectFront(page, "", null, 4);
  const before = await executed(page);
  await page.locator('[data-delta="1"]').click();
  await settle(page, 5);
  expect(await words(page, before)).toBe(routes.nz[4].increment);
});
