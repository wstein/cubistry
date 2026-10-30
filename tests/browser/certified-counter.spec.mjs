import { frontStickerPoint } from "../helpers/front-projection.mjs";
import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
const active = [
  "abcdef",
  "bc",
  "abdeg",
  "abcdg",
  "bcfg",
  "acdfg",
  "acdefg",
  "abc",
  "abcdefg",
  "abcdfg",
];
function renderedDigit(image, centerX) {
  const blue = ([r, g, b]) => b > r * 1.25 && b > g * 1.05;
  const sample = (px, py) => {
    const [x, y] = frontStickerPoint(image, centerX, -.5, px, py),
      colors = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const at = ((y + dy) * image.width + x + dx) * 4;
        colors.push([...image.data.slice(at, at + 3)]);
      }
    return colors.some(blue);
  };
  const centers = [
    [128, 48],
    [192, 84],
    [192, 168],
    [128, 208],
    [64, 168],
    [64, 84],
    [128, 128],
  ];
  return {
    segments: centers
      .map((p, i) => (sample(...p) ? "abcdefg"[i] : ""))
      .join(""),
    uprightBaseline: sample(128, 234),
  };
}

async function chooseCertified(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate;
    window.executed = [];
    CubeViewer.prototype.animate = async function (p) {
      if (!window.configuredPrint) {
        window.configuredPrint = this.presentedPrint;
        window.configuredStart = p.from;
      }
      await animate.call(this, p);
      window.executed.push(p);
    };
  });
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#format").check();
  await expect(page.locator("#application")).toBeEnabled();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
}
const go = async (page, value) => {
  await page.locator("#value").fill(String(value));
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-value",
    String(value),
  );
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
};
for (const leadingZero of [true, false])
  test(`optimized permanent print executes all 99 adjacent transitions with exactly 339 committed HTM (leading zero ${leadingZero})`, async ({
    page,
  }, testInfo) => {
    test.setTimeout(120000);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await chooseCertified(page);
    if (!leadingZero) await page.locator("#format").uncheck();
    await expect(page.locator("#session-moves")).toHaveText("0");
    const transitions = [];
    let offset = 0;
    for (let value = 1; value <= 99; value++) {
      await page.locator('[data-delta="1"]').click();
      await expect(page.locator("#cube")).toHaveAttribute(
        "data-value",
        String(value),
      );
      await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
      const moves = await page.evaluate(
        (offset) => window.executed.slice(offset),
        offset,
      );
      expect(moves.length).toBeGreaterThan(0);
      expect(moves.length).toBeLessThanOrEqual(5);
      offset += moves.length;
      transitions.push({
        value,
        word: moves
          .map(
            (p) =>
              p.move.face +
              (p.move.turns === 2 ? "2" : p.move.turns === -1 ? "'" : ""),
          )
          .join(" "),
        state: moves.at(-1).to,
      });
      if ([42, 99].includes(value)) {
        const img = PNG.sync.read(
          await page.locator("#cube canvas").screenshot(),
        );
        for (const [digit, center] of [
          [Math.floor(value / 10), -0.5],
          [value % 10, 0.5],
        ]) {
          const actual = renderedDigit(img, center);
          expect(actual.segments).toBe(active[digit]);
          expect(actual.uprightBaseline).toBe(true);
        }
      }
    }
    expect(offset).toBe(339);
    await expect(page.locator("#session-moves")).toHaveText("339");
    const initial = await page.evaluate(() => ({
      print: window.configuredPrint,
      start: window.configuredStart,
    }));
    expect(initial.print).toBeDefined();
    expect(initial.start).toBeDefined();
    const evidencePath = testInfo.outputPath("certified-browser-commits.json");
    writeFileSync(evidencePath, JSON.stringify({ ...initial, transitions }));
    const verified = JSON.parse(
      execFileSync(
        "python3",
        ["research/certified-counter/verify.py", evidencePath],
        { encoding: "utf8" },
      ),
    );
    expect(verified.actualCommittedHTM).toBe(339);
    await page.screenshot({
      path: testInfo.outputPath("certified-99.png"),
      fullPage: true,
    });
    expect(errors).toEqual([]);
  });
test("optimized arbitrary jump returns to certified state, reset and screen formatting remain independent on mobile", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await chooseCertified(page);
  await go(page, 23);
  await go(page, 78);
  const before = Number(
    await page.locator("#session-moves").getAttribute("data-total"),
  );
  await go(page, 79);
  const after = Number(
    await page.locator("#session-moves").getAttribute("data-total"),
  );
  expect(after - before).toBeGreaterThan(0);
  expect(after - before).toBeLessThanOrEqual(5);
  await page.getByRole("button", { name: "Reset session moves" }).click();
  await expect(page.locator("#session-moves")).toHaveText("0");
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "79");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#application")).toHaveValue("certified");
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "79");
  await expect(page.locator("#session-moves")).toHaveText("0");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
