import { test, expect } from "@playwright/test";
import { PNG } from "pngjs";
import { frontPoint } from "../helpers/front-projection.mjs";
async function ready(page) {
  await page.goto("/");
  await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const setter = CubeViewer.prototype.setFaceletImageOverride;
    const configure = CubeViewer.prototype.configure;
    window.reconfigurations = 0;
    CubeViewer.prototype.configure = function (...args) {
      window.reconfigurations++;
      return configure.apply(this, args);
    };
    CubeViewer.prototype.setFaceletImageOverride = function (rule) {
      window.counterViewer = this;
      return setter.call(this, rule);
    };
  });
  // A no-op presentation update captures the actual viewer without reconfiguration.
  await page.locator("#format").dispatchEvent("change");
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
async function snapshot(page) {
  return page.evaluate(() => {
    const v = window.counterViewer,
      stickers = [],
      transforms = [];
    v.scene.traverse((o) => {
      transforms.push({
        id: o.uuid,
        parent: o.parent?.uuid,
        position: o.position.toArray(),
        orientation: o.quaternion.toArray(),
        scale: o.scale.toArray(),
      });
      if (o.userData.stickerId !== undefined)
        stickers.push({
          id: o.userData.stickerId,
          geometry: o.geometry.id,
          material: o.material.uuid,
          map: o.material.map.uuid,
          color: o.material.color.getHexString(),
          position: o.position.toArray(),
          orientation: o.quaternion.toArray(),
        });
    });
    return {
      transforms,
      print: v.presentedPrint,
      state: v.presentedState,
      stickers: stickers.sort((a, b) => a.id - b.id),
      camera: {
        position: v.camera.position.toArray(),
        orientation: v.camera.quaternion.toArray(),
      },
      progress: { ...document.querySelector("#move-progress").dataset },
      session: document.querySelector("#session-moves").dataset.total,
      current: document.querySelector("#cube").dataset.value,
      status: document.querySelector("#status").textContent,
      button: document.querySelector("#run").textContent,
      configurations: window.reconfigurations,
    };
  });
}
function compare(before, after, expectedChanged) {
  const strip = (s) => ({
    ...s,
    stickers: s.stickers.map(({ map, ...rest }) => rest),
  });
  expect(strip(after)).toEqual(strip(before));
  const changed = before.stickers.filter(
    (s, i) => s.map !== after.stickers[i].map,
  );
  expect(changed).toHaveLength(expectedChanged);
  if (expectedChanged) {
    const original = before.print.stickers.find((s) => s.id === changed[0].id);
    expect(original.assetId).toBe("0");
  }
}
function changedPixels(before, after, value) {
  const a = PNG.sync.read(before),
    b = PNG.sync.read(after);
  expect([b.width, b.height]).toEqual([a.width, a.height]);
  const corners = [
    [-0.955, -0.955],
    [-0.085, -0.955],
    [-0.955, -0.085],
    [-0.085, -0.085],
  ].map(([x, y]) => frontPoint(a, x, y));
  const minX = Math.min(...corners.map((p) => p[0])) - 3,
    maxX = Math.max(...corners.map((p) => p[0])) + 3,
    minY = Math.min(...corners.map((p) => p[1])) - 3,
    maxY = Math.max(...corners.map((p) => p[1])) + 3;
  let changed = 0,
    outside = 0;
  for (let y = 0; y < a.height; y++)
    for (let x = 0; x < a.width; x++) {
      const i = (y * a.width + x) * 4;
      if (
        Math.abs(a.data[i] - b.data[i]) +
          Math.abs(a.data[i + 1] - b.data[i + 1]) +
          Math.abs(a.data[i + 2] - b.data[i + 2]) >
        10
      ) {
        changed++;
        if (!(x >= minX && x <= maxX && y >= minY && y <= maxY)) outside++;
      }
    }
  expect(outside).toBe(0);
  if (value < 10) expect(changed).toBeGreaterThan(100);
  else expect(changed).toBe(0);
  // The units glyph (including zero at value0) remains blue and in place.
  const [x, y] = frontPoint(b, 0.52, -0.52 + (0.5 - 48 / 256) * 0.87),
    i = (y * b.width + x) * 4;
  // For digits whose top segment is absent, exact image equality outside the field above
  // still verifies units. Value0 additionally checks the rendered zero survives.
  if (value === 0) expect(b.data[i + 2]).toBeGreaterThan(b.data[i] * 1.2);
}
for (const value of [0, 1, 7, 9, 10, 42, 99])
  test(`Leading Zero only changes one rendered field at ${value}, preserving print/state/counters/camera`, async ({
    page,
  }) => {
    await ready(page);
    await go(page, value);
    const a = await snapshot(page),
      on = await page.locator("#cube canvas").screenshot();
    await page.locator("#format").uncheck();
    const b = await snapshot(page),
      off = await page.locator("#cube canvas").screenshot();
    compare(a, b, value < 10 ? 1 : 0);
    changedPixels(on, off, value);
    expect(b.configurations).toBe(0);
    await page.locator("#format").check();
    expect(await snapshot(page)).toEqual(a);
  });
test("formatting remains available during actual Set animation and Run without resetting in-flight work or draft target", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install();
  await ready(page);
  await page.clock.pauseAt(await page.evaluate(() => Date.now() + 100));
  await page.locator("#value").fill("7");
  await page.locator("#set").click();
  await page.clock.runFor(100);
  expect(await page.evaluate(() => window.counterViewer.animating)).toBe(true);
  const before = await snapshot(page);
  await expect(page.locator("#format")).toBeEnabled();
  await page.locator("#format").uncheck();
  compare(before, await snapshot(page), 1);
  await page.clock.runFor(4000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await page.locator("#value").fill("9");
  await page.locator("#run").click();
  const runBefore = await snapshot(page);
  await page.locator("#format").check();
  compare(runBefore, await snapshot(page), 1);
  await expect(page.locator("#run")).toHaveText("Stop");
  await expect(page.locator("#value")).toHaveValue("9");
  await page.clock.runFor(6000);
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "9");
  await expect(page.locator("#run")).toHaveText("Run");
  expect((await snapshot(page)).configurations).toBe(0);
});
test("unchecked format reloads the same optimized print and value and retains adjacent move accounting", async ({
  page,
}) => {
  await ready(page);
  await go(page, 7);
  const a = await snapshot(page);
  await page.locator("#format").uncheck();
  await page.reload();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "7");
  await expect(page.locator("#format")).not.toBeChecked();
  await page.evaluate(async () => {
    const { CubeViewer } = await import("/packages/cube-viewer/src/index.ts");
    const setter = CubeViewer.prototype.setFaceletImageOverride;
    CubeViewer.prototype.setFaceletImageOverride = function (r) {
      window.counterViewer = this;
      return setter.call(this, r);
    };
  });
  await page.locator("#format").dispatchEvent("change");
  const b = await snapshot(page);
  expect(b.print).toEqual(a.print);
  expect(b.state).toEqual(a.state);
  await page.locator('[data-delta="1"]').click();
  await expect(page.locator("#cube")).toHaveAttribute("data-value", "8");
  const total = Number(
    await page.locator("#session-moves").getAttribute("data-total"),
  );
  expect(total).toBeGreaterThan(0);
  expect(total).toBeLessThanOrEqual(5);
});
