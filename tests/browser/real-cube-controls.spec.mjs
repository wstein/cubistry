import { test, expect } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { stateEquals } from "@cubistry/cube-core";
const cases = JSON.parse(
  readFileSync(new URL("../fixtures/arbitrary-jumps.json", import.meta.url)),
);
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
async function go(page, value) {
  await page.locator("#value").fill(String(value));
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute(
    "data-value",
    String(value),
  );
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
test("all eight jump previews agree with actual committed moves and complete pinned physical targets", async ({
  page,
}) => {
  test.setTimeout(60000);
  await ready(page);
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate,
      configure = CubeViewer.prototype.configure;
    window.record = [];
    CubeViewer.prototype.configure = function (p, s, a) {
      window.print = p;
      window.state = s;
      return configure.call(this, p, s, a);
    };
    CubeViewer.prototype.animate = async function (p) {
      if (window.holdNext) {
        window.holdNext = false;
        await new Promise((r) => (window.release = r));
      }
      await animate.call(this, p);
      window.state = p.to;
      window.record.push(p);
    };
  });
  await page.locator("#format").uncheck();
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#format").check();
  await expect(page.locator("#application")).toBeEnabled();
  const actual = [];
  for (const c of cases) {
    await go(page, c.a);
    await page.getByRole("button", { name: "Reset session moves" }).click();
    const from = await page.evaluate(() => window.state);
    expect(stateEquals({ ...from, printId: c.from.printId }, c.from)).toBe(
      true,
    );
    await page.evaluate(() => {
      window.record = [];
      window.holdNext = true;
    });
    await page.locator("#value").fill(String(c.b));
    await page.locator("#set").click();
    await expect(page.locator("#move-progress")).toHaveText(
      `0 / ${c.selected.length} moves`,
    );
    await page.evaluate(() => window.release());
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-value",
      String(c.b),
    );
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    const record = await page.evaluate(() => window.record);
    expect(record.length).toBe(c.selected.length);
    expect(
      stateEquals({ ...record.at(-1).to, printId: c.target.printId }, c.target),
    ).toBe(true);
    await expect(page.locator("#session-moves")).toHaveText(`${record.length}`);
    actual.push({
      from,
      to: record.at(-1).to,
      moves: record.map((p) => p.move),
    });
  }
  writeFileSync("/tmp/issue44-browser-actual.json", JSON.stringify(actual));
});
