import { test, expect } from "@playwright/test";
async function ready(page) {
  await page.clock.install();
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
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
    await expect(page.locator("#stop-turns")).toBeHidden();
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
  await page.locator("#stop-turns").click();
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
  await page.locator("#stop-turns").click();
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
test("six exact keyboard speed stops persist and remain separate from Run cadence", async ({
  page,
}) => {
  await ready(page);
  const slider = page.getByLabel("Rotation Speed");
  await expect(slider).toHaveValue("4");
  await expect(slider).toHaveAttribute("min", "0");
  await expect(slider).toHaveAttribute("max", "5");
  await expect(slider).toHaveAttribute("step", "1");
  const labels = ["2 s", "1 s", "500 ms", "250 ms", "100 ms", "50 ms"];
  await slider.focus();
  await slider.press("Home");
  for (let i = 0; i < labels.length; i++) {
    await expect(slider).toHaveValue(String(i));
    await expect(slider).toHaveAttribute(
      "aria-valuetext",
      `${labels[i]} per HTM move`,
    );
    if (i < 5) await slider.press("ArrowRight");
  }
  await target(page, 2);
  await page.locator("#run").click();
  await step(page, 1);
  await step(page, 2);
  await page.reload();
  await expect(slider).toHaveValue("5");
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

test("real six-stop speed can change during playback without changing legal moves", async ({
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
  await slider.fill("5");
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
