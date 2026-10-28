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
  await page.locator("#jump-form button").click();
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
  await page.locator("#format").selectOption("unpadded");
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#application").selectOption("certified");
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
    await page.locator("#jump-form button").click();
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
    await expect(page.locator("#session-moves")).toHaveText(
      `Session: ${record.length} moves`,
    );
    actual.push({
      from,
      to: record.at(-1).to,
      moves: record.map((p) => p.move),
    });
  }
  writeFileSync("/tmp/issue44-browser-actual.json", JSON.stringify(actual));
});
test("default application and physical format switch are prominent, exclusive and reset session", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await expect(page.getByLabel("Application", { exact: true })).toHaveValue(
    "certified",
  );
  await expect(page.getByText("Personalize the fixed print")).toHaveCount(0);
  await expect(page.getByText("Apply new print")).toHaveCount(0);
  await expect(page.locator("#application-status")).toContainText("339 HTM");
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
  await page.locator("#format").selectOption("unpadded");
  await expect(page.locator("#application")).toBeEnabled();
  await expect(page.locator("#application")).toHaveValue("certified");
  await expect(page.locator("#session-moves")).toHaveText("Session: 0 moves");
  await expect(page.locator("#application-status")).toContainText(
    "no certified",
  );
  await page.locator("#application").selectOption("countdown");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "10");
  await expect(page.locator("#format")).toHaveValue("padded");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "/tmp/cubistry-47-mobile.png",
    fullPage: true,
  });
});
test("one fixed-cadence Auto handles countdown, suspension, stop and manual rebase independently of speed", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-28T12:00:00Z") });
  await ready(page);
  await page.locator("#auto").check();
  await page.clock.fastForward(5100);
  await expect(page.locator("#value")).toHaveValue("5");
  await page.locator("#auto").uncheck();
  const stopped = await page.locator("#value").inputValue();
  await page.clock.fastForward(5000);
  await expect(page.locator("#value")).toHaveValue(stopped);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator("#application").selectOption("countdown");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "10");
  await page.locator("#auto").check();
  await page.clock.fastForward(11000);
  await expect(page.locator("#value")).toHaveValue("0");
  await expect(page.locator("#auto")).not.toBeChecked();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await go(page, 10);
  await page.locator("#auto").check();
  await page.locator("#start").click();
  await expect(page.locator("#auto")).not.toBeChecked();
  await expect(page.locator("#mode")).toHaveText("Counting down");
});
test("speed slider changes only presentation duration, can change during a move, and persists", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await go(page, 4);
  await page.locator("#rotation-speed").fill("0.0375");
  await page.locator("#rotation-speed").dispatchEvent("input");
  const start = Date.now();
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "5", {
    timeout: 5000,
  });
  expect(Date.now() - start).toBeGreaterThan(1700);
  await expect(page.locator("#move-progress")).toHaveText("1 / 1 moves");
  await page.locator('[data-delta="-1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await page.locator("#rotation-speed").fill("2");
  await page.locator("#rotation-speed").dispatchEvent("input");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "4");
  await expect(page.locator("#move-progress")).toHaveText("1 / 1 moves");
  await page.locator("#rotation-speed").focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator("#rotation-speed")).toHaveValue("1.9975");
  await page.keyboard.press("ArrowRight");
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "4");
  await expect(page.locator("#rotation-speed")).toHaveValue("2");
});
