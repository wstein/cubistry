import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator("#format").selectOption("unpadded");
  await expect(page.locator("#application")).toBeEnabled();
  await page.locator("#value").fill("15");
  await page.locator("#jump-form button").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "15");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.locator("#reset-session-moves").click();
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
test("manual controls, rapid chains, bounds, validation and immutable draft print", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.locator('[data-delta="1"]').click();
  await page.locator('[data-delta="1"]').click();
  await page.locator('[data-delta="10"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "27");
  await go(page, 99);
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "99");
  await page.locator("#wrap").check();
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await page.locator("#step").fill("7");
  await page.locator("#subtract").click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "93");
  await page.locator("#value").fill("1x");
  await page.locator("#jump-form button").click();
  await expect(page.locator("#error")).toContainText("whole number");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "93");
  await page.locator("#format").selectOption("unpadded");
  await expect(page.locator("#application")).toBeEnabled();
  await go(page, 7);
  const saved = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("cubistry-counter-v2")),
  );
  expect(saved.label).toBe("COUNTER");
  expect(saved.padded).toBe(false);
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await expect(page.locator("#format")).toHaveValue("unpadded");
  expect(errors).toEqual([]);
});
test("explicit new fixed print, physical SVG orientation and title pixels survive goals", async ({
  page,
}) => {
  await ready(page);
  await page.locator("#format").selectOption("unpadded");
  await expect(page.locator("#application")).toBeEnabled();
  await go(page, 7);
  const first = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  // The actual WebGL front projection: sample the vector baseline marker at
  // image y=234, not merely the logical sticker state's up vector.
  const scale =
    first.height / (2 * Math.tan((36 * Math.PI) / 360) * (5.3 - 1.021));
  const sample = (image, cx, cy) => {
    const x = Math.round(first.width / 2 + cx * scale),
      y = Math.round(first.height / 2 - cy * scale),
      values = [];
    for (let dy = -2; dy <= 2; dy++)
      for (let dx = -2; dx <= 2; dx++) {
        const i = ((y + dy) * image.width + x + dx) * 4;
        values.push([...image.data.slice(i, i + 3)]);
      }
    return values;
  };
  const blue = (rgb) => rgb[2] > rgb[0] * 1.25 && rgb[2] > rgb[1] * 1.05;
  const markerY = -0.52 + (0.5 - 234 / 256) * 0.87;
  expect(sample(first, 0.52, markerY).some(blue)).toBe(true);
  expect(sample(first, -0.52, markerY).some(blue)).toBe(false);
  await go(page, 99);
  const second = PNG.sync.read(await page.locator("#cube canvas").screenshot());
  let changed = 0,
    total = 0;
  // Interior upper-row pixels keep the same full text images in the same frame.
  for (
    let y = Math.round(first.height / 2 - 0.93 * scale);
    y < Math.round(first.height / 2 - 0.1 * scale);
    y++
  )
    for (
      let x = Math.round(first.width / 2 - 0.93 * scale);
      x < Math.round(first.width / 2 + 0.93 * scale);
      x++
    ) {
      const i = (y * first.width + x) * 4;
      total++;
      if (
        Math.abs(first.data[i] - second.data[i]) +
          Math.abs(first.data[i + 1] - second.data[i + 1]) +
          Math.abs(first.data[i + 2] - second.data[i + 2]) >
        25
      )
        changed++;
    }
  expect(changed / total).toBeLessThan(0.01);
  await page.screenshot({
    path: "test-results/counter-desktop.png",
    fullPage: true,
  });
});
test("wall-clock timer pause/resume and large suspended-tab jump", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-27T12:00:00Z") });
  await ready(page);
  await page.locator("#start").click();
  await page.clock.fastForward(61000);
  await expect(page.locator("#value")).toHaveValue("14");
  await page.locator("#pause").click();
  await page.clock.fastForward(120000);
  await expect(page.locator("#value")).toHaveValue("14");
  await page.locator("#start").click();
  await page.clock.fastForward(20 * 60000);
  await expect(page.locator("#value")).toHaveValue("0");
  await expect(page.locator("#timer-status")).toHaveText("Break complete.");
  await page.locator("#reset").click();
  await expect(page.locator("#value")).toHaveValue("15");
});
test("animated turns, camera drag and apply guard preserve legal final state", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.locator('[data-delta="1"]').click();
  await page.locator('[data-delta="10"]').click();
  await expect(page.locator("#application")).toBeDisabled();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "26", {
    timeout: 15000,
  });
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  const box = await page.locator("#cube canvas").boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 90,
    box.y + box.height / 2 + 30,
    { steps: 6 },
  );
  await page.mouse.up();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "26");
  await page.locator("#front").click();
  await expect(page.locator("#error")).toBeEmpty();
});
test("mobile controls remain usable without horizontal overflow", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await ready(page);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await go(page, 42);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "42");
  await page.screenshot({
    path: "test-results/counter-mobile.png",
    fullPage: true,
  });
});

test("an expired running timer restores the cube at zero, not its stale saved count", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(() => {
    const saved = JSON.parse(
      localStorage.getItem("cubistry-counter-v2") || "{}",
    );
    Object.assign(saved, {
      value: 15,
      label: "BREAK\nMINUTES",
      padded: true,
      timer: {
        state: "running",
        initialMinutes: 15,
        remainingMs: 900000,
        deadline: Date.now() - 1000,
      },
    });
    localStorage.setItem("cubistry-counter-v2", JSON.stringify(saved));
  });
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "0");
  await expect(page.locator("#value")).toHaveValue("0");
  await expect(page.locator("#timer-status")).toHaveText("Break complete.");
});

test("pausing between a wall-clock minute boundary and the next timer tick synchronizes the cube", async ({
  page,
}) => {
  const start = new Date("2026-10-27T12:00:00Z");
  await page.clock.install({ time: start });
  await ready(page);
  await page.locator("#start").click();
  const timerStart = await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("cubistry-counter-v2"));
    return saved.timer.deadline - saved.timer.initialMinutes * 60000;
  });
  await page.clock.setSystemTime(new Date(timerStart + 61000));
  await page.locator("#pause").click();
  await expect(page.locator("#value")).toHaveValue("14");
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "14");
  await expect(page.locator("#mode")).toHaveText("Timer paused");
});

for (const application of ["certified", "countdown"]) {
  test(`application, format and speed persist across reload: ${application}`, async ({
    page,
  }) => {
    await ready(page);
    await page.locator("#application").selectOption(application);
    await expect(page.locator("#application")).toBeEnabled();
    await page.locator("#rotation-speed").fill("2");
    await page.locator("#rotation-speed").dispatchEvent("input");
    await go(page, 42);
    await page.reload();
    await expect(page.locator("#cube")).toHaveAttribute("data-value", "42");
    await expect(page.locator("#application")).toHaveValue(application);
    await expect(page.locator("#rotation-speed")).toHaveValue("2");
    await expect(page.locator("#format")).toHaveValue("padded");
  });
}
