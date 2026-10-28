import { test, expect } from "@playwright/test";
import { expectedHtm as total } from "../helpers/shared-solver.mjs";
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
async function holdTurns(page) {
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const original = CubeViewer.prototype.animate;
    window.holdTurns = true;
    CubeViewer.prototype.animate = async function (p) {
      if (window.holdTurns)
        await new Promise((resolve) => (window.releaseTurn = resolve));
      return original.call(this, p);
    };
  });
}
async function go(page, value) {
  await page.locator("#value").fill(String(value));
  await page.locator("#jump-form button[type=submit]").click();
}
async function release(page, keepHolding = false) {
  await page.evaluate((hold) => {
    window.holdTurns = hold;
    window.releaseTurn();
  }, keepHolding);
}
test("planned/committed counts stay attached to the active value through queued changes", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await holdTurns(page);
  await go(page, 42);
  await expect(page.locator("#move-progress")).toHaveText(
    `0 / ${total(15, 42)} moves`,
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "aria-valuenow",
    "0",
  );
  await release(page, true);
  await expect(page.locator("#move-progress")).toHaveText(
    `1 / ${total(15, 42)} moves`,
  );
  await go(page, 43);
  await go(page, 44);
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-target",
    "42",
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-queued",
    "44",
  );
  await expect(page.locator("#move-progress")).toHaveText(
    `1 / ${total(15, 42)} moves`,
  );
  await release(page);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "44");
  await expect(page.locator("#move-progress")).toHaveText(
    `${total(42, 44)} / ${total(42, 44)} moves`,
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-state",
    "completed",
  );
});
test("explicit stop finishes the active value, drops queue and persists a stopped timer", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#start").click();
  await holdTurns(page);
  await go(page, 42);
  await go(page, 99);
  await page.locator("#stop-turns").click();
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-state",
    "stopping",
  );
  await expect(page.locator("#value")).toHaveValue("42");
  await expect(page.locator("#mode")).toHaveText("Manual");
  await expect(page.locator("#stop-turns")).toBeDisabled();
  await release(page);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "42");
  await expect(page.locator("#move-progress")).toHaveText(
    `${total(15, 42)} / ${total(15, 42)} moves`,
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-state",
    "stopped",
  );
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubistry-counter-v1")),
  );
  expect(saved.value).toBe(42);
  expect(saved.timer.state).toBe("idle");
  expect(saved.timer.initialMinutes).toBe(42);
  await go(page, 7);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#move-progress")).toHaveText(
    `${total(42, 7)} / ${total(42, 7)} moves`,
  );
});
test("reset is queued honestly; new printing and no-op request reset to zero moves", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-27T12:00:00Z") });
  await ready(page);
  await holdTurns(page);
  await page.locator("#start").click();
  const started = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("cubistry-counter-v1"));
    return saved.timer.deadline - saved.timer.initialMinutes * 60000;
  });
  await page.clock.setSystemTime(new Date(started + 61000));
  await page.evaluate(() =>
    document.dispatchEvent(new Event("visibilitychange")),
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-target",
    "14",
  );
  await page.locator("#reset").click();
  await expect(page.locator("#move-progress")).toHaveText(
    `0 / ${total(15, 14)} moves`,
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-queued",
    "15",
  );
  await release(page);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#move-progress")).toHaveText(
    `${total(14, 15)} / ${total(14, 15)} moves`,
  );
  await go(page, 15);
  await expect(page.locator("#move-progress")).toHaveText("0 / 0 moves");
  await page.locator("summary").click();
  await page.locator("#label").fill("NEW TITLE");
  await page.locator("#apply-print").click();
  await expect(page.locator("#apply-print")).toBeEnabled();
  await expect(page.locator("#move-progress")).toHaveText("0 / 0 moves");
});
test("move progress and stop control fit a small screen and expose accessible values", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  await holdTurns(page);
  await go(page, 7);
  const meter = page.getByRole("progressbar", {
    name: "Committed moves (HTM)",
  });
  await expect(meter).toHaveAttribute("aria-valuemax", String(total(15, 7)));
  await expect(meter).toHaveAttribute(
    "aria-valuetext",
    `0 of ${total(15, 7)} moves committed`,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(
    page.getByRole("button", { name: "Stop after this value" }),
  ).toBeEnabled();
  await page.screenshot({
    path: "/tmp/cubistry-move-progress-mobile.png",
    fullPage: true,
  });
  await release(page);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
});

test("session total counts committed turns, survives timer reset and has an independent accessible reset", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await ready(page);
  const session = page.locator("#session-moves");
  const reset = page.getByRole("button", {name:"Reset session moves"});
  await expect(session).toHaveText("Session: 0 moves");
  await holdTurns(page);
  await go(page,42);
  await expect(reset).toBeDisabled();
  await expect(session).toHaveText("Session: 0 moves");
  await release(page);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","false");
  await expect(session).toHaveText(`Session: ${total(15,42)} moves`);
  await page.locator("#reset").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value","42");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","false");
  await expect(session).toHaveText(`Session: ${total(15,42)} moves`);
  await reset.click();
  await expect(session).toHaveText("Session: 0 moves");
  await expect(page.locator("#move-progress")).toHaveText("0 / 0 moves");
  await go(page,7);
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy","false");
  await expect(session).toHaveText(`Session: ${total(42,7)} moves`);
  await page.locator("summary").click();
  await page.locator("#label").fill("NEW SESSION");
  await page.locator("#apply-print").click();
  await expect(page.locator("#apply-print")).toBeEnabled();
  await expect(session).toHaveText("Session: 0 moves");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
