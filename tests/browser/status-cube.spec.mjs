import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
async function ready(page) {
  await page.goto("/status.html");
  await expect(page.locator("#status-build")).toBeEnabled();
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
}
async function exact(page, snapshot) {
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-current",
    snapshot.join(","),
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  expect(
    await page.evaluate(async (snapshot) => {
      const { statusController: c, statusDefinition: d } = await import(
        "/src/status.mjs"
      );
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      const { matchesTarget } = await import(
        "/packages/cube-mechanics/src/index.ts"
      );
      const { displayTarget } = await import("/src/apps/status/definition.ts");
      return (
        stateEquals(c.state, c.view.presentedState) &&
        matchesTarget(d.print, c.state, displayTarget(snapshot))
      );
    }, snapshot),
  ).toBe(true);
}
test("five fixed vector states render for all four categories, with native keyboard controls", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await page.locator("#status-build").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await page.keyboard.press("Tab");
  await exact(page, ["running", "open", "open", "open"]);
  const categories = ["build", "test", "analyze", "review"];
  for (const [state, word, color] of [
    ["open", "OFFEN", "#56616a"],
    ["running", "LÄUFT", "#145a91"],
    ["ok", "OK", "#187044"],
    ["error", "FEHLER", "#b12c2c"],
    ["blocked", "BLOCKIERT", "#855600"],
  ]) {
    for (const category of categories)
      await page.selectOption(`#status-${category}`, state);
    await exact(page, Array(4).fill(state));
    await expect(page.locator("#status-front")).toHaveText(
      categories.map((c) => `${c.toUpperCase()} ${word}`).join(" · "),
    );
    // Inspect the actual installed bitmap pixels, not just the declarative manifest or accessibility text.
    const result = await page.evaluate(
      async ({ state, color, categories }) => {
        const { statusController: c } = await import("/src/status.mjs");
        const expected = color
          .slice(1)
          .match(/../g)
          .map((v) => parseInt(v, 16));
        const counts = [];
        for (const category of categories) {
          const bitmap = c.assets.images.get(`quality-${category}-${state}`);
          const canvas = document.createElement("canvas");
          canvas.width = canvas.height = 256;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(bitmap, 0, 0);
          const pixels = ctx.getImageData(0, 0, 256, 256).data;
          let colored = 0,
            dark = 0;
          for (let i = 0; i < pixels.length; i += 4) {
            if (expected.every((v, j) => Math.abs(v - pixels[i + j]) < 5))
              colored++;
            if (pixels[i] < 60 && pixels[i + 1] < 70 && pixels[i + 2] < 85)
              dark++;
          }
          counts.push({ colored, dark });
        }
        return counts;
      },
      { state, color, categories },
    );
    for (const count of result) {
      expect(count.colored).toBeGreaterThan(1500);
      expect(count.dark).toBeGreaterThan(400);
    }
    const pixels = PNG.sync.read(
      await page.locator("#status-viewer").screenshot(),
    );
    expect(pixels.width).toBeGreaterThan(300);
    await page.screenshot({
      path: `test-results/quality-${state}.png`,
      fullPage: true,
    });
  }
  expect(errors).toEqual([]);
});
test("events enforce requested transitions and distinguish failure from unavailable prerequisites", async ({
  page,
}) => {
  await ready(page);
  await page.selectOption("#status-event", "passed");
  await page.click("#status-send");
  await expect(page.locator("#status-error")).toContainText("not allowed");
  await exact(page, ["open", "open", "open", "open"]);
  await page.selectOption("#status-event", "failed");
  await page.click("#status-send");
  await exact(page, ["error", "open", "open", "open"]);
  await expect(page.locator("#status-fault")).toContainText("attempt failed");
  await page.selectOption("#status-build", "open");
  await page.selectOption("#status-event-category", "test");
  await page.selectOption("#status-event", "blocked");
  await page.click("#status-send");
  await exact(page, ["open", "blocked", "open", "open"]);
  await expect(page.locator("#status-fault")).toContainText("prerequisite");
  await page.click("#status-burst");
  await exact(page, ["ok", "ok", "ok", "ok"]);
  await expect(page.locator("#status-error")).toBeEmpty();
  await page.click("#status-demo");
  await expect(page.locator("#status-demo")).toHaveText("Stop demo");
  await page.click("#status-demo");
  await expect(page.locator("#status-demo")).toHaveText("Run demo");
});
test("rapid real animation finishes only active legal turn then uses latest actual full pose", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.selectOption("#status-speed", "500");
  await page.evaluate(async () => {
    const { statusController: c } = await import("/src/status.mjs");
    const animate = c.view.animate.bind(c.view);
    window.started = [];
    c.view.animate = (p) => {
      window.started.push(JSON.stringify(p));
      return animate(p);
    };
  });
  await page.selectOption("#status-build", "running");
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "moving",
  );
  await page.selectOption("#status-test", "blocked");
  await page.selectOption("#status-build", "error");
  await exact(page, ["error", "blocked", "open", "open"]);
  const replay = await page.evaluate(async () => {
    const { statusController: c, statusDefinition: d } = await import(
      "/src/status.mjs"
    );
    const { stateEquals } = await import("/packages/cube-core/src/index.ts");
    const { applyMoves, initialState } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const { QualityPolicy } = await import("/src/apps/status/policy.ts");
    const p = await QualityPolicy.load(d),
      started = window.started.map(JSON.parse),
      first = started[0],
      expected = p.plan(first.to, ["error", "blocked", "open", "open"]);
    return {
      valid: stateEquals(
        applyMoves(
          initialState(d.print),
          started.map((p) => p.move),
        ),
        c.state,
      ),
      actual: started.slice(1).map((p) => p.move),
      expected: expected.moves,
      total: c.progress.sessionTotal,
    };
  });
  expect(replay.valid).toBe(true);
  expect(replay.actual).toEqual(replay.expected);
  expect(replay.total).toBeLessThanOrEqual(8);
});
test("animation failure freezes last committed pose and explicit reload recovers", async ({
  page,
}) => {
  await ready(page);
  await page.evaluate(async () => {
    const { statusController: c } = await import("/src/status.mjs");
    const animate = c.view.animate.bind(c.view);
    let moves = 0;
    c.view.animate = async (p) => {
      if (++moves === 2) throw Error("Injected animation failure");
      await animate(p);
    };
  });
  await page.selectOption("#status-build", "running");
  await expect(page.locator("#status-error")).toHaveText(
    "Injected animation failure",
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "failed",
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-session-moves",
    "1",
  );
  await expect(page.locator("#status-build")).toBeDisabled();
  expect(
    await page.evaluate(async () => {
      const { statusController: c } = await import("/src/status.mjs");
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      return (
        c.currentStatus.join(",") === "open,open,open,open" &&
        stateEquals(c.state, c.view.presentedState)
      );
    }),
  ).toBe(true);
  await page.click("#status-reload");
  await exact(page, ["open", "open", "open", "open"]);
});
for (const resource of ["distances.u8", "quality-build-open.svg"])
  test(`corrupt ${resource} freezes fresh load without false completion`, async ({
    page,
  }) => {
    await page.route(`**/assets/quality/${resource}`, (route) =>
      route.fulfill({
        contentType: resource.endsWith("svg")
          ? "image/svg+xml"
          : "application/octet-stream",
        body: "corrupt",
      }),
    );
    await page.goto("/status.html");
    await expect(page.locator("#status-error")).toContainText("integrity");
    await expect(page.locator("#status-current")).toHaveText("Not configured");
    await expect(page.locator("#status-build")).toBeDisabled();
    await expect(page.locator("#status-reload")).toBeVisible();
  });
for (const [name, viewport] of [
  ["desktop", { width: 1280, height: 1000 }],
  ["mobile", { width: 390, height: 844 }],
]) {
  test(`DPR2 ${name} contains its high-resolution canvas and camera interaction preserves physical state`, async ({
    browser,
    baseURL,
  }) => {
    const context = await browser.newContext({
      baseURL,
      viewport,
      deviceScaleFactor: 2,
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    try {
      await ready(page);
      const geometry = await page.evaluate(() => {
        const host = document.querySelector("#status-viewer");
        const canvas = host.querySelector("canvas");
        const bounds = (node) => {
          const r = node.getBoundingClientRect();
          return {
            x: r.x,
            y: r.y,
            width: r.width,
            height: r.height,
            right: r.right,
            bottom: r.bottom,
          };
        };
        return {
          host: bounds(host),
          canvas: bounds(canvas),
          buffer: { width: canvas.width, height: canvas.height },
          dpr: devicePixelRatio,
          pageWidth: document.documentElement.scrollWidth,
          viewportWidth: innerWidth,
        };
      });
      expect(geometry.dpr).toBe(2);
      expect(
        Math.abs(geometry.canvas.width - geometry.host.width),
      ).toBeLessThanOrEqual(1);
      expect(
        Math.abs(geometry.canvas.height - geometry.host.height),
      ).toBeLessThanOrEqual(1);
      expect(geometry.canvas.x).toBeGreaterThanOrEqual(geometry.host.x - 1);
      expect(geometry.canvas.y).toBeGreaterThanOrEqual(geometry.host.y - 1);
      expect(geometry.canvas.right).toBeLessThanOrEqual(
        geometry.host.right + 1,
      );
      expect(geometry.canvas.bottom).toBeLessThanOrEqual(
        geometry.host.bottom + 1,
      );
      expect(
        Math.abs(geometry.buffer.width - geometry.host.width * 2),
      ).toBeLessThanOrEqual(2);
      expect(
        Math.abs(geometry.buffer.height - geometry.host.height * 2),
      ).toBeLessThanOrEqual(2);
      expect(geometry.pageWidth).toBeLessThanOrEqual(geometry.viewportWidth);
      const before = await page.evaluate(async () => {
        const { statusController: c } = await import("/src/status.mjs");
        return {
          state: JSON.stringify(c.state),
          camera: c.view.camera.position.toArray(),
          moves: c.progress.sessionTotal,
        };
      });
      const { x, y, width, height } = geometry.canvas;
      await page.mouse.move(x + width / 2, y + height / 2);
      await page.mouse.down();
      await page.mouse.move(x + width / 2 + 45, y + height / 2 + 25, {
        steps: 5,
      });
      await page.mouse.up();
      await expect
        .poll(async () =>
          page.evaluate(async () => {
            const { statusController: c } = await import("/src/status.mjs");
            return c.view.camera.position.toArray();
          }),
        )
        .not.toEqual(before.camera);
      const after = await page.evaluate(async () => {
        const { statusController: c } = await import("/src/status.mjs");
        return {
          state: JSON.stringify(c.state),
          moves: c.progress.sessionTotal,
        };
      });
      expect(after.state).toBe(before.state);
      expect(after.moves).toBe(before.moves);
      await page.selectOption("#status-build", "running");
      await exact(page, ["running", "open", "open", "open"]);
      for (const [category, state] of [
        ["build", "blocked"],
        ["test", "running"],
        ["analyze", "error"],
        ["review", "ok"],
      ]) {
        await page.selectOption(`#status-${category}`, state);
      }
      await exact(page, ["blocked", "running", "error", "ok"]);
      await page.evaluate(async () => {
        const { statusController: c } = await import("/src/status.mjs");
        c.resetCamera();
      });
      await page.locator("#status-viewer").scrollIntoViewIfNeeded();
      await page.screenshot({
        path: `test-results/quality-${name}-dpr2-mixed.png`,
        fullPage: true,
      });
      await page
        .locator("#status-viewer")
        .screenshot({
          path: `test-results/quality-${name}-dpr2-mixed-cube.png`,
        });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
      ).toBe(true);
    } finally {
      await context.close();
    }
  });
}
