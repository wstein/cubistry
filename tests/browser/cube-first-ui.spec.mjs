import { test, expect } from "@playwright/test";
import { pauseSoon } from "../helpers/pause-clock.mjs";
async function ready(page) {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await pauseSoon(page);
}
async function target(page, n) {
  await page.locator("#value").fill(String(n));
}
async function step(page, n) {
  await page.clock.runFor(1050);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", String(n));
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
}
for (const [start, end] of [
  [0, 3],
  [3, 0],
])
  test(`Run visits every value from ${start} to ${end} and stops regardless of Wrap`, async ({
    page,
  }) => {
    await ready(page);
    await target(page, start);
    await page.locator("#set").click();
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-value",
      String(start),
    );
    await page.locator("#wrap").check();
    await target(page, end);
    await page.locator("#run").click();
    for (
      let n = start + Math.sign(end - start);
      n !== end + Math.sign(end - start);
      n += Math.sign(end - start)
    )
      await step(page, n);
    await expect(page.locator("#run")).toBeVisible();
    await expect(page.locator("#run")).toHaveText("Run");
    await page.clock.runFor(2100);
    await expect(page.locator("#cube")).toHaveAttribute(
      "data-value",
      String(end),
    );
    await expect(page.locator("#value")).toHaveValue(String(end));
  });
test("start=target, edit during Run, Stop, Set interruption and reload never start unsolicited counting", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#run").click();
  await expect(page.locator("#run")).toBeVisible();
  await target(page, 9);
  await page.locator("#run").click();
  await step(page, 1);
  await target(page, 40);
  await step(page, 2);
  await expect(page.locator("#value")).toHaveValue("40");
  await expect(page.locator("#status")).toContainText("Running to 9");
  await page.locator("#run").click();
  await page.clock.runFor(3000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "2");
  await page.locator("#run").click();
  await step(page, 3);
  await target(page, 7);
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await page.clock.runFor(3000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await expect(page.locator("#run")).toBeVisible();
});
test("slow physical Run never skips a value and Stop completes the active value only", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const animate = CubeViewer.prototype.animate;
    window.moves = [];
    CubeViewer.prototype.animate = async function (p) {
      if (!window.releaseAll)
        await new Promise((r) => (window.releaseTurn = r));
      await animate.call(this, p);
      window.moves.push(p);
    };
  });
  await target(page, 8);
  await page.locator("#run").click();
  await page.clock.runFor(1050);
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-target",
    "1",
  );
  await page.clock.runFor(8000);
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-target",
    "1",
  );
  await expect(page.locator("#move-progress")).toHaveAttribute(
    "data-queued",
    "",
  );
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await page.locator("#run").click();
  await page.evaluate(() => {
    window.releaseAll = true;
    window.releaseTurn();
  });
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  expect(await page.evaluate(() => window.moves.length)).toBe(5);
  await page.clock.runFor(5000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
});
test("seven exact keyboard speed stops persist and remain separate from Run cadence", async ({
  page,
}) => {
  await ready(page);
  const slider = page.getByLabel("Rotation Speed");
  await expect(slider).toHaveValue("4");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "6");
  await expect(slider).toHaveAttribute("step", "1");
  const labels = ["2 s", "1 s", "500 ms", "250 ms", "100 ms", "50 ms", "10 ms"];
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < labels.length; i++) {
    await expect(slider).toHaveValue(String(i));
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      `${labels[i]} per HTM move`,
    );
    if (i < labels.length - 1) await slider.press("ArrowRight");
  }
  await target(page, 2);
  await page.locator("#run").click();
  await step(page, 1);
  await step(page, 2);
  await page.reload();
  await expect(slider).toHaveValue("6");
});
test("viewer hint ignores clicks, dismisses on drag or zoom, stays hidden, and times out with reduced motion", async ({
  page,
}) => {
  await ready(page);
  const canvas = page.locator("#cube canvas"),
    hint = page.locator("#viewer-hint");
  await expect(hint).toBeVisible();
  await canvas.click();
  await expect(hint).toBeVisible();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 60,
    box.y + box.height / 2 + 30,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(hint).toBeHidden();
  await target(page, 1);
  await page.locator("#set").click();
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(canvas).toBeVisible();
  await expect(hint).toBeVisible();
  await canvas.hover();
  await page.mouse.wheel(0, 100);
  await expect(hint).toBeHidden();
  await page.reload();
  await expect(hint).toBeVisible();
  await page.clock.runFor(10001);
  await expect(hint).toBeHidden();
});

test("real seven-stop speed can change during playback without changing legal moves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await target(page, 4);
  await page.locator("#set").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "4");
  const slider = page.locator("#rotation-speed");
  await slider.fill("0");
  const start = Date.now();
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "5");
  expect(Date.now() - start).toBeGreaterThan(1700);
  await expect(page.locator("#move-progress")).toHaveText("1 / 1 moves");
  await page.locator('[data-delta="-1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "true");
  await slider.fill("6");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "4");
  await expect(page.locator("#move-progress")).toHaveText("1 / 1 moves");
});

test("front-dominant default camera still orbits and zooms without altering cube state", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  const canvas = page.locator("#cube canvas");
  const before = await canvas.screenshot();
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 25,
    { steps: 6 },
  );
  await page.mouse.up();
  expect(Buffer.compare(before, await canvas.screenshot())).not.toBe(0);
  const rotated = await canvas.screenshot();
  await page.mouse.wheel(0, 300);
  await expect
    .poll(async () => Buffer.compare(rotated, await canvas.screenshot()))
    .not.toBe(0);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  const camera = await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const host = document.createElement("div");
    host.style = "width:200px;height:200px";
    document.body.append(host);
    const viewer = new CubeViewer(host);
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(r)),
    );
    const p = viewer.camera.position;
    const result = {
      yaw: (Math.atan2(p.x, p.z) * 180) / Math.PI,
      pitch: (Math.asin(p.y / p.length()) * 180) / Math.PI,
      radius: p.length(),
      fov: viewer.camera.fov,
    };
    viewer.destroy();
    host.remove();
    return result;
  });
  expect(camera.yaw).toBeCloseTo(10);
  expect(camera.pitch).toBeCloseTo(7);
  expect(camera.radius).toBeGreaterThan(9);
  expect(camera.fov).toBeLessThan(20);
});

test("one stable Run/Stop button supports keyboard operation and returns to Run at target", async ({
  page,
}) => {
  await ready(page);
  await target(page, 9);
  const button = page.locator("#run"),
    set = page.locator("#set");
  await expect(page.locator("#counter-controls .target-actions button")).toHaveCount(2);
  await expect(page.locator("#stop-turns")).toHaveCount(0);
  const before = await button.boundingBox(),
    setBefore = await set.boundingBox();
  await button.focus();
  await button.press("Space");
  await expect(button).toHaveText("Stop");
  await expect(button).toHaveAccessibleName("Stop");
  await expect(button).toHaveAttribute("aria-pressed", "true");
  await expect(button).toBeFocused();
  expect(await button.boundingBox()).toEqual(before);
  expect(await set.boundingBox()).toEqual(setBefore);
  await step(page, 1);
  await button.press("Space");
  await expect(button).toHaveText("Run");
  await expect(button).toHaveAttribute("aria-pressed", "false");
  await expect(button).toBeFocused();
  await page.clock.runFor(2100);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "1");
  await target(page, 2);
  await button.press("Enter");
  await expect(button).toHaveText("Stop");
  await step(page, 2);
  await expect(button).toHaveText("Run");
  await expect(button).toHaveAccessibleName("Run");
  expect(await button.boundingBox()).toEqual(before);
});

for (const width of [1440, 768, 390, 320])
  test(`header, visible stats and speed fit at ${width}px without covering the cube`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    const header = page.locator("header"),
      chooser = page.locator("header #application");
    await expect(chooser).toHaveCount(1);
    await expect(chooser).toBeVisible();
    const wrap = await page.locator("#wrap").boundingBox();
    const format = await page.locator("#format").boundingBox();
    expect(wrap.y).toBe(format.y);
    await expect(page.locator("#status")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset session moves" }),
    ).toBeVisible();
    await expect(page.locator("details,#application-status")).toHaveCount(0);
    await expect(page.locator("#counter-controls #status")).toHaveCount(0);
    await expect(page.locator(".counter-stats")).not.toContainText(
      /certified|permanent print/i,
    );
    const rect = async (selector) => page.locator(selector).boundingBox();
    const h = await header.boundingBox(),
      c = await rect(".cube-card"),
      a = await rect("#counter-controls"),
      canvas = await rect("#cube"),
      stats = await rect(".counter-stats"),
      speed = await rect(".speed-control"),
      slider = await rect("#rotation-speed");
    expect(h.y + h.height).toBeLessThanOrEqual(c.y);
    if (width > 760) expect(a.y).toBe(c.y);
    expect(stats.y).toBeGreaterThanOrEqual(canvas.y + canvas.height);
    expect(speed.y).toBeGreaterThanOrEqual(stats.y + stats.height);
    expect(slider.y).toBeGreaterThan(speed.y);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const boxes = await page
      .locator(".move-summary dd")
      .evaluateAll((nodes) =>
        nodes.map((n) => n.getBoundingClientRect().right),
      );
    expect(Math.abs(boxes[0] - boxes[1])).toBeLessThan(1);
    await page.locator("#reset-session-moves").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#rotation-speed")).toBeFocused();
  });

for (const saved of [
  { value: 7 },
  { value: 7, moveDuration: 100 },
  { value: 7, moveDuration: 250 },
  { value: 7, speed: 0.3 },
])
  test(`default and saved speed preferences restore predictably: ${JSON.stringify(saved)}`, async ({
    page,
  }) => {
    await page.addInitScript(
      (saved) =>
        localStorage.setItem("cubistry-counter-v2", JSON.stringify(saved)),
      saved,
    );
    await page.goto("/");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#rotation-speed")).toHaveValue(
      saved.moveDuration === 250 || saved.speed === 0.3 ? "3" : "4",
    );
  });
