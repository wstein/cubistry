// Browser regression source for #120. Added but NOT RUN under the session policy.
import { test, expect } from "@playwright/test";
import { pauseSoon } from "../helpers/pause-clock.mjs";
test.use({ hasTouch: true });
async function ready(page, path = "/picture3.html") {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.clock.install({ time: new Date("2026-10-30T12:00:00Z") });
  await page.goto(path);
  if (path === "/picture3.html") await expect(page.locator("#cube")).toHaveAttribute("aria-busy", "false");
  else await expect(page.locator("#seconds-speed")).toBeEnabled();
  await pauseSoon(page);
  await page.clock.runFor(30);
}
async function snapshot(page, kind = "picture") {
  return page.evaluate(async kind => {
    const view = kind === "picture" ? (await import("/src/apps/picture3/page.ts")).picture3App.viewer
      : (await import("/src/clock.mjs")).clockStage;
    const c = view.rotation.controller;
    return { phase: c.phase, speed: c.angularSpeed, deadline: c.returnDeadline, orientation: view.presentation.quaternion.toArray(),
      anchor: c.anchor.toArray(), distance: view.presentation.quaternion.angleTo(c.anchor), state: JSON.stringify(view.presentedState),
      camera: [view.camera.position.toArray(), view.camera.quaternion.toArray()] };
  }, kind);
}
async function drag(page, dx, dy, duration = 200, hold = 200, selector = "#cube canvas") {
  const box = await page.locator(selector).boundingBox(), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await page.mouse.move(x, y); await page.mouse.down(); await page.clock.runFor(duration);
  await page.mouse.move(x + dx, y + dy); if (hold) await page.clock.runFor(hold); await page.mouse.up();
}
async function mode(page, value) {
  const panel = page.locator(".cube-appearance");
  if (!(await panel.evaluate(e => e.open))) await panel.locator("summary").click();
  await page.getByLabel("View rotation mode", { exact: true }).selectOption(value);
}
test("settled 24 degrees is retained; 26 degrees waits and returns to the accepted anchor without puzzle/camera changes", async ({ page }) => {
  await ready(page); const initial = await snapshot(page);
  await drag(page, (24 * Math.PI / 180) / .007, 0);
  const accepted = await snapshot(page); expect(accepted.phase).toBe("idle"); expect(accepted.distance).toBeLessThan(1e-6);
  await page.clock.runFor(6000); expect((await snapshot(page)).orientation).toEqual(accepted.orientation);
  await drag(page, (26 * Math.PI / 180) / .007, 0);
  const outside = await snapshot(page); expect(outside.phase).toBe("awaiting-return"); expect(outside.anchor).toEqual(accepted.anchor);
  await page.clock.runFor(1950); expect((await snapshot(page)).phase).toBe("awaiting-return");
  await page.clock.runFor(100); expect((await snapshot(page)).phase).toBe("returning");
  await page.clock.runFor(1100); const end = await snapshot(page); expect(end.phase).toBe("idle"); expect(end.distance).toBeLessThan(1e-6);
  expect(end.anchor).toEqual(accepted.anchor); expect(end.state).toBe(initial.state); expect(end.camera).toEqual(initial.camera);
});
test("flick inertia is capped, a tap interrupts return, and Free/Classic/reduced modes preserve physical state", async ({ page }) => {
  await ready(page); const initial = await snapshot(page);
  await drag(page, 120, 50, 50, 0); const release = await snapshot(page); expect(release.phase).toBe("coasting"); expect(release.speed).toBeLessThanOrEqual(6);
  await page.clock.runFor(150); expect((await snapshot(page)).orientation).not.toEqual(release.orientation);
  await page.clock.runFor(2000); const waiting = await snapshot(page); expect(waiting.phase).toBe("awaiting-return");
  const now = await page.evaluate(() => performance.now() / 1000); await page.clock.runFor(Math.ceil((waiting.deadline - now + .25) * 1000));
  expect((await snapshot(page)).phase).toBe("returning");
  const box = await page.locator("#cube canvas").boundingBox(); await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
  const frozen = await snapshot(page); await page.clock.runFor(2000); expect((await snapshot(page)).orientation).toEqual(frozen.orientation); await page.mouse.up();
  expect((await snapshot(page)).anchor).toEqual(initial.anchor);
  await mode(page, "classic"); await drag(page, 80, 20, 50, 0); expect((await snapshot(page)).phase).toBe("idle");
  await mode(page, "free"); await drag(page, 80, 20, 50, 0); expect((await snapshot(page)).phase).toBe("coasting"); await page.clock.runFor(12000);
  const free = await snapshot(page); expect(free.phase).toBe("idle"); expect(free.deadline).toBeNull();
  await page.emulateMedia({ reducedMotion: "reduce" }); await mode(page, "smart"); await drag(page, 80, 20, 50, 0);
  expect((await snapshot(page)).phase).toBe("idle"); await page.clock.runFor(10000); const end = await snapshot(page);
  expect(end.phase).toBe("idle"); expect(end.state).toBe(initial.state); expect(end.camera).toEqual(initial.camera);
});
test("real touch release coasts and the clock rotates one rigid assembly with a stationary camera", async ({ page }) => {
  await ready(page, "/clock.html"); const before = await snapshot(page, "clock"), box = await page.locator("#clock-scene canvas").boundingBox();
  const client = await page.context().newCDPSession(page), x = box.x + box.width / 2, y = box.y + box.height / 2;
  await client.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x, y, id: 0 }] }); await page.clock.runFor(100);
  await client.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: x + 100, y: y + 40, id: 0 }] });
  await client.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  expect((await snapshot(page, "clock")).phase).toBe("coasting"); await page.clock.runFor(100);
  const geometry = await page.evaluate(async () => {
    const { clockStage, clockUnits } = await import("/src/clock.mjs"); clockStage.scene.updateMatrixWorld(true);
    const centers = clockUnits.map(u => u.controller.view.scene.getWorldPosition(clockStage.camera.position.clone()));
    return { midpoint: centers[0].clone().add(centers[2]).length(), span: centers[0].distanceTo(centers[2]),
      children: clockUnits.every(u => u.controller.view.scene.parent === clockStage.presentation && !u.controller.view.rotation) };
  });
  expect(geometry.midpoint).toBeLessThan(1e-7); expect(geometry.span).toBeCloseTo(5.6, 7); expect(geometry.children).toBe(true);
  const end = await snapshot(page, "clock"); expect(end.orientation).not.toEqual(before.orientation); expect(end.camera).toEqual(before.camera); await client.detach();
});
