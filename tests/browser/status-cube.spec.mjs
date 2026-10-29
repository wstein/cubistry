import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
async function ready(page) {
  await page.goto("/status.html");
  await expect(page.locator("#status-select")).toBeEnabled();
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  await expect(page.locator("canvas")).toHaveCount(1);
}
async function exact(page, id) {
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-current",
    id,
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "idle",
  );
  expect(
    await page.evaluate(async (id) => {
      const { statusController: c, statusDefinition: d } = await import(
        "/src/status.mjs"
      );
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      const { matchesTarget, applyMoves, initialState } = await import(
        "/packages/cube-mechanics/src/index.ts"
      );
      const target = d.statuses.find((s) => s.id === id);
      return (
        stateEquals(c.state, target.state) &&
        stateEquals(c.view.presentedState, c.state) &&
        matchesTarget(d.print, c.state, target.target) &&
        stateEquals(
          applyMoves(initialState(d.print), c.sourceReference),
          c.state,
        )
      );
    }, id),
  ).toBe(true);
}
test("six fixed physical status faces render and native keyboard controls select the same controller", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await ready(page);
  await exact(page, "idle");
  await page.locator("#status-select").focus();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  // Complete native select navigation before later pixel capture; an open
  // platform popup blocks Playwright's isolated-world stability observation.
  await page.keyboard.press("Tab");
  await exact(page, "planning");
  for (const [id, letters] of [
    ["coding", "C O D E"],
    ["testing", "T E S T"],
    ["review", "R E V W"],
    ["done", "D O N E"],
    ["idle", "I D L E"],
  ]) {
    await page.selectOption("#status-select", id);
    await exact(page, id);
    await expect(page.locator("#status-front")).toHaveText(letters);
  }
  const pixels = PNG.sync.read(
    await page.locator("#status-viewer").screenshot(),
  );
  let colored = 0,
    dark = 0;
  for (let i = 0; i < pixels.data.length; i += 4) {
    const [r, g, b] = pixels.data.subarray(i, i + 3);
    if (Math.max(r, g, b) - Math.min(r, g, b) > 25 && Math.min(r, g, b) < 150)
      colored++;
    if (Math.max(r, g, b) < 80) dark++;
  }
  expect(colored).toBeGreaterThan(2000);
  expect(dark).toBeGreaterThan(500);
  await page.screenshot({
    path: "test-results/status-cube-idle.png",
    fullPage: true,
  });
  expect(errors).toEqual([]);
});

test("rapid events, agent failure and invalid transitions remain explicit and preserve physical frames", async ({
  page,
}) => {
  await ready(page);
  await page.selectOption("#status-event", "task.completed");
  await page.click("#status-send");
  await expect(page.locator("#status-error")).toContainText("not allowed");
  await exact(page, "idle");
  await page.click("#status-burst");
  await exact(page, "done");
  await expect(page.locator("#status-error")).toBeEmpty();
  await page.selectOption("#status-event", "agent.failed");
  await page.click("#status-send");
  await exact(page, "review");
  await expect(page.locator("#status-fault")).toContainText(
    "Simulated agent failure",
  );
  await page.selectOption("#status-select", "coding");
  await exact(page, "coding");
  await expect(page.locator("#status-fault")).toBeEmpty();
  await page.click("#status-demo");
  await expect(page.locator("#status-demo")).toHaveText("Stop demo");
  await page.click("#status-demo");
  await expect(page.locator("#status-demo")).toHaveText("Run demo");
  await expect(page.locator("#status-history li")).not.toHaveCount(0);
});

test("a newer status interrupts after the active real turn and never starts an obsolete second turn", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await ready(page);
  await page.selectOption("#status-speed", "500");
  await page.evaluate(async () => {
    const { statusController: c } = await import("/src/status.mjs");
    const { serializeMove } = await import(
      "/packages/cube-mechanics/src/index.ts"
    );
    const animate = c.view.animate.bind(c.view);
    window.statusStarted = [];
    c.view.animate = (p) => {
      window.statusStarted.push(serializeMove(p.move));
      return animate(p);
    };
  });
  await page.selectOption("#status-select", "coding");
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-sync",
    "moving",
  );
  await page.selectOption("#status-select", "done");
  await expect(page.locator("#status-requested")).toHaveText("Done");
  await exact(page, "done");
  expect(await page.evaluate(() => window.statusStarted.slice(0, 2))).toEqual([
    "U2",
    "U2",
  ]);
  expect(await page.evaluate(() => window.statusStarted.includes("D2"))).toBe(
    false,
  );
  await expect(page.locator("#status-viewer")).toHaveAttribute(
    "data-session-moves",
    "4",
  );
});

test("animation failure retains the committed physical pose and exposes a fresh-load recovery", async ({
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
  await page.selectOption("#status-select", "coding");
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
  await expect(page.locator("#status-select")).toBeDisabled();
  expect(
    await page.evaluate(async () => {
      const { statusController: c, statusDefinition: d } = await import(
        "/src/status.mjs"
      );
      const { stateEquals } = await import("/packages/cube-core/src/index.ts");
      const { applyMoves, initialState } = await import(
        "/packages/cube-mechanics/src/index.ts"
      );
      return (
        c.currentStatus === "idle" &&
        stateEquals(c.state, c.view.presentedState) &&
        stateEquals(
          c.state,
          applyMoves(initialState(d.print), c.sourceReference),
        )
      );
    }),
  ).toBe(true);
  await page.click("#status-reload");
  await exact(page, "idle");
});

test("a corrupted pinned font fails fresh load without claiming a physical status", async ({
  page,
}) => {
  await page.route("**/fonts/noto-sans-latin-800.woff2", (route) =>
    route.fulfill({ contentType: "font/woff2", body: "corrupt" }),
  );
  await page.goto("/status.html");
  await expect(page.locator("#status-error")).toContainText("integrity");
  await expect(page.locator("#status-current")).toHaveText("Not configured");
  await expect(page.locator("#status-select")).toBeDisabled();
  await expect(page.locator("#status-reload")).toBeVisible();
});
