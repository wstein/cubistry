import { test, expect } from "@playwright/test";
import { pauseSoon } from "../helpers/pause-clock.mjs";
async function ready(page) {
  await page.clock.install();
  await page.goto("/counter.html");
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
test("real seven-stop speed can change during playback without changing legal moves", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/counter.html");
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
  await page.goto("/counter.html");
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
      yaw: (-viewer.presentation.rotation.y * 180) / Math.PI,
      pitch: (viewer.presentation.rotation.x * 180) / Math.PI,
      cameraPosition: p.toArray(),
      radius: p.length(),
      fov: viewer.camera.fov,
    };
    viewer.destroy();
    host.remove();
    return result;
  });
  expect(camera.cameraPosition.slice(0, 2)).toEqual([0, 0]);
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

// [viewport width, root font size in percent]. The island and the panel both grow with the text size.
for (const [width, textPercent] of [
  [1440, 100],
  [1280, 100],
  [1200, 100],
  [768, 100],
  [390, 100],
  [320, 100],
  [1280, 125],
  [1200, 150],
  [768, 125],
  [390, 125],
  [320, 125],
])
  test(`header, visible stats and speed fit at ${width}px, ${textPercent}% text, without covering controls or the cube center`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page.evaluate((percent) => {
      document.documentElement.style.fontSize = `${percent}%`;
      // Resolves once the resize observers have run, among them the one that places the panel below the island.
      // (Not requestAnimationFrame: page.clock.install() fakes it.)
      return new Promise((done) => {
        const probe = new ResizeObserver(() => {
          probe.disconnect();
          done();
        });
        probe.observe(document.querySelector("header"));
        probe.observe(document.querySelector("#counter-controls"));
      });
    }, textPercent);
    const header = page.locator("header"),
      chooser = page.locator("header #application");
    await expect(chooser).toHaveCount(1);
    await expect(chooser).toBeVisible();
    // Both option checkboxes stay inside the panel; they may wrap onto two rows in a 280 px wide panel.
    const panel = await page.locator("#counter-controls").boundingBox();
    for (const id of ["#wrap", "#format"]) {
      const box = await page.locator(id).boundingBox();
      expect(box.x).toBeGreaterThanOrEqual(panel.x);
      expect(box.x + box.width).toBeLessThanOrEqual(panel.x + panel.width);
    }
    await expect(page.locator("#status")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Reset session moves" }),
    ).toBeVisible();
    // No collapsible help or status blocks; the shared Appearance panel and its "More" group are <details> by design.
    await expect(
      page.locator("details:not(.cube-appearance):not(.cube-appearance-more),#application-status"),
    ).toHaveCount(0);
    await expect(page.locator("#counter-controls #status")).toHaveCount(0);
    await expect(page.locator(".counter-stats")).not.toContainText(
      /certified|permanent print/i,
    );
    const rect = async (selector) => page.locator(selector).boundingBox();
    const h = await header.boundingBox(),
      canvas = await rect("#cube"),
      stats = await rect(".counter-stats"),
      speed = await rect(".speed-control"),
      slider = await rect("#rotation-speed");
    // The island floats over the full-bleed canvas on purpose (position: fixed), so it may overlap the canvas. It must
    // stay on screen, keep clear of the canvas center and never sit on top of an interactive control.
    expect(h.x).toBeGreaterThanOrEqual(0);
    expect(h.x + h.width).toBeLessThanOrEqual(width);
    const cx = canvas.x + canvas.width / 2,
      cy = canvas.y + canvas.height / 2;
    expect(
      cx >= h.x && cx <= h.x + h.width && cy >= h.y && cy <= h.y + h.height,
      `header ${JSON.stringify(h)} covers the canvas center ${cx},${cy}`,
    ).toBe(false);
    const overlaps = (p, q) =>
      p.x < q.x + q.width &&
      q.x < p.x + p.width &&
      p.y < q.y + q.height &&
      q.y < p.y + p.height;
    for (const selector of [
      "#counter-controls",
      "#counter-controls .hud-title",
      "#counter-controls .hud-toggle-btn",
      ".counter-stats",
      ".speed-control",
      "#rotation-speed",
    ]) {
      const box = await rect(selector);
      expect(
        overlaps(h, box),
        `header ${JSON.stringify(h)} overlaps ${selector} ${JSON.stringify(box)}`,
      ).toBe(false);
      // Hit test at the center: the header must not receive the pointer.
      const hit = await page.locator(selector).evaluate((el) => {
        const r = el.getBoundingClientRect();
        const x = r.left + r.width / 2,
          y = r.top + r.height / 2;
        if (x < 0 || x > innerWidth || y < 0 || y > innerHeight)
          return "off screen";
        return document.querySelector("header").contains(document.elementFromPoint(x, y))
          ? "header"
          : "page";
      });
      expect(hit, `${selector} center hit target`).toBe("page");
    }
    // Stats and speed live in the bottom dock, well below the island.
    expect(Math.min(stats.y, speed.y)).toBeGreaterThan(h.y + h.height);
    expect(slider.y).toBeGreaterThan(h.y + h.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    // The two move counters sit side by side or, when the dock wraps, one above the other; they never overlap.
    const counters = await page
      .locator(".move-summary dd")
      .evaluateAll((nodes) =>
        nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return { x: r.x, y: r.y, width: r.width, height: r.height };
        }),
      );
    expect(counters).toHaveLength(2);
    expect(overlaps(counters[0], counters[1])).toBe(false);
    await page.locator("#reset-session-moves").focus();
    await page.keyboard.press("Tab");
    await expect(page.locator("#rotation-speed")).toBeFocused();
  });

for (const [width, textPercent] of [
  [1440, 100],
  [768, 100],
  [700, 100],
  [600, 100],
  [390, 100],
  [320, 100],
  [768, 125],
  [390, 125],
  [320, 125],
])
  test(`the bottom dock lies inside the viewport at ${width}px, ${textPercent}% text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page.evaluate((percent) => {
      document.documentElement.style.fontSize = `${percent}%`;
    }, textPercent);
    for (const selector of [
      ".floating-dock",
      ".counter-stats",
      "#session-moves",
      "#reset-session-moves",
      ".speed-control",
      "#rotation-speed",
    ]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x, `${selector} left edge ${box.x}`).toBeGreaterThanOrEqual(0);
      expect(
        box.x + box.width,
        `${selector} right edge ${box.x + box.width}`,
      ).toBeLessThanOrEqual(width);
    }
  });

// The text is modeled on the print-install and setup-switch messages in src/main.mjs; the dock must wrap it, not
// widen.
for (const [width, textPercent] of [
  [768, 125],
  [700, 100],
  [600, 100],
  [390, 100],
  [320, 100],
  [390, 125],
  [320, 125],
])
  test(`a long status message keeps the dock inside the viewport at ${width}px, ${textPercent}% text`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    await page.evaluate((percent) => {
      document.documentElement.style.fontSize = `${percent}%`;
      document.getElementById("status").textContent =
        "Blank-top print, NZ installed at 37. Session moves restart at 0. Switching to LZ · 12 / 31 setup moves";
    }, textPercent);
    for (const selector of ["#status", ".floating-dock", ".counter-stats", "#reset-session-moves"]) {
      const box = await page.locator(selector).boundingBox();
      expect(box.x, `${selector} left edge ${box.x}`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${selector} right edge ${box.x + box.width}`).toBeLessThanOrEqual(width);
    }
  });

// Wide viewports keep the dock on one row for every realistic status, as before the wrap rules were added. This
// checks only the dock height, not whether the content overflows the pill or the viewport.
for (const width of [1440, 1280, 1181])
  test(`the bottom dock stays one row for real status messages at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await ready(page);
    const dockHeight = async (text) => {
      await page.evaluate((text) => {
        document.getElementById("status").textContent = text;
      }, text);
      return (await page.locator(".floating-dock").boundingBox()).height;
    };
    const oneRow = await dockHeight("Current 0");
    for (const text of [
      "Running to 37 · Current 12",
      "Running to 9999 · Current 9999",
      "Turn sequence stopped.",
      "Switching to LZ · 1 / 8 setup moves",
      "Blank-top print, NZ installed at 37. Session moves restart at 0.",
    ])
      expect(await dockHeight(text), text).toBeLessThan(oneRow * 1.5);
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
    await page.goto("/counter.html");
    await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
    await expect(page.locator("#rotation-speed")).toHaveValue(
      saved.moveDuration === 250 || saved.speed === 0.3 ? "3" : "4",
    );
  });
