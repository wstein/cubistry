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
test("settled 34 degrees from the front is retained; beyond 35 degrees waits and springs back to the front without puzzle/camera changes", async ({ page }) => {
  await ready(page); const initial = await snapshot(page);
  await drag(page, (34 * Math.PI / 180) / .007, 0);
  const retained = await snapshot(page); expect(retained.phase).toBe("idle"); expect(retained.distance).toBeCloseTo(34 * Math.PI / 180, 3);
  await page.clock.runFor(6000); expect((await snapshot(page)).orientation).toEqual(retained.orientation);
  await drag(page, (26 * Math.PI / 180) / .007, 0);
  const outside = await snapshot(page); expect(outside.phase).toBe("awaiting-return"); expect(outside.anchor).toEqual(initial.anchor);
  await page.clock.runFor(1950); expect((await snapshot(page)).phase).toBe("awaiting-return");
  await page.clock.runFor(100); expect((await snapshot(page)).phase).toBe("returning");
  await page.clock.runFor(2500); const end = await snapshot(page); expect(end.phase).toBe("idle"); expect(end.distance).toBeLessThan(2e-3);
  expect(end.anchor).toEqual(initial.anchor); expect(end.state).toBe(initial.state); expect(end.camera).toEqual(initial.camera);
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
  await page.emulateMedia({ reducedMotion: "reduce" }); await mode(page, "smart"); await drag(page, 80, 20, 50, 0); await page.clock.runFor(180);
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
    return { midpoint: centers[0].clone().add(centers[2]).length(), // Presentation containment is one uniform scale; local rigid spacing stays 5.6.
      span: centers[0].distanceTo(centers[2]) / clockStage.presentation.scale.x,
      children: clockUnits.every(u => u.controller.view.scene.parent === clockStage.presentation && !u.controller.view.rotation) };
  });
  expect(geometry.midpoint).toBeLessThan(1e-7); expect(geometry.span).toBeCloseTo(5.6, 7); expect(geometry.children).toBe(true);
  const end = await snapshot(page, "clock"); expect(end.orientation).not.toEqual(before.orientation); expect(end.camera).toEqual(before.camera); await client.detach();
});

// Owner follow-up: upright default / optional Free. Source only, NOT RUN.
test("upright defaults retain vertical up through drag/coast/return; Free mode levels continuously when leaving it", async ({page})=>{
 await ready(page);const initial=await snapshot(page);
 await drag(page,100,80,100,0);
 const upright=async()=>page.evaluate(async()=>{const v=(await import('/src/apps/picture3/page.ts')).picture3App.viewer;
  const q=v.presentation.quaternion,up=v.camera.up.clone().set(0,1,0).applyQuaternion(q);return [up.x,up.y];});
 for(let i=0;i<40;i++){const up=await upright();expect(Math.abs(up[0])).toBeLessThan(1e-7);expect(up[1]).toBeGreaterThan(.049);await page.clock.runFor(100);}
 await mode(page,'free');await drag(page,80,40);await drag(page,-30,70);const rolled=await snapshot(page);
 await mode(page,'smart');const start=await snapshot(page);expect(start.orientation).toEqual(rolled.orientation);expect(start.phase).toBe('leveling');
 await page.clock.runFor(400);const beforeTap=await snapshot(page),box=await page.locator('#cube canvas').boundingBox();
 await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();await page.clock.runFor(200);
 expect((await snapshot(page)).orientation).toEqual(beforeTap.orientation);await page.mouse.up();await page.clock.runFor(1050);
 const up=await upright();expect(Math.abs(up[0])).toBeLessThan(1e-7);expect(up[1]).toBeGreaterThan(.049);
 expect((await snapshot(page)).state).toBe(initial.state);expect((await snapshot(page)).camera).toEqual(initial.camera);
 await mode(page,'free');await drag(page,80,40);await drag(page,-30,70);await page.emulateMedia({reducedMotion:'reduce'});await mode(page,'classic');
 expect((await snapshot(page)).phase).toBe('leveling');await page.clock.runFor(180);expect((await snapshot(page)).phase).toBe('idle');
});
