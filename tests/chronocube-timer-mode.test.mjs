import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateFiveSecondRoute, validateTimerRoute } from "../src/apps/timer/design.ts";
import { buildStudioManifest } from "../src/apps/chronocube/manifest.ts";
import {
  createStudioTimerController,
  studioTimerDefaultBucket,
  studioTimerProfile,
  studioTimerReadout,
} from "../src/apps/chronocube/timer-mode.ts";

const read = (f) => JSON.parse(readFileSync(f));
const routes = {
  false: validateTimerRoute(read("public/workshop-timer.v1.json")),
  true: validateFiveSecondRoute(read("public/five-second-timer.v1.json")),
};
// Mirrors buildManifest() in src/chronocube.mjs after ensureProof(): studio manifest plus the counter design's assets.
const assets = read("public/counter-design.v2.json").assets;
const manifest = () =>
  buildStudioManifest("dseg7", "off", "same", "words-pascal", assets?.images ?? [], assets?.fonts ?? [], assets?.documents ?? [], assets?.materials ?? []);
const view = { configure() {}, resetCamera() {}, async animate() {} };
const resolveAssets = async () => ({ dispose() {} });

// Runs the same helpers initTimerMode runs, in the same order.
for (const [five, start, readout] of [
  [false, 90, "15:00"],
  [true, 360, "30:00"],
]) {
  test(`studio ${five ? "five-second-timer" : "timer"} mode starts at ${readout} and reports state`, async () => {
    const route = routes[five];
    const profile = studioTimerProfile(five);
    const states = [];
    const controller = createStudioTimerController(view, route, manifest(), (v, busy) => states.push([v, busy]), resolveAssets);
    const bucket = studioTimerDefaultBucket(profile);
    assert.equal(bucket, start);
    await controller.configure(bucket);
    assert.equal(controller.currentValue, start);
    assert(states.length > 0);
    assert.equal(studioTimerReadout(bucket, profile), readout);
  });
}

// Fake clock time so the countdown advances without waiting.
const drive = async (five) => {
  const { WorkshopClock } = await import("../src/apps/timer/clock.ts");
  const { StudioTimerDriver } = await import("../src/apps/chronocube/timer-mode.ts");
  const profile = studioTimerProfile(five);
  let t = 1000;
  const clock = new WorkshopClock(() => t, profile);
  const controller = createStudioTimerController(view, routes[five], manifest(), () => {}, resolveAssets);
  await controller.configure(studioTimerDefaultBucket(profile));
  const durations = [];
  const driver = new StudioTimerDriver({ clock, controller, setDuration: (d) => durations.push(d) });
  const settle = async () => {
    for (let i = 0; controller.busy && i < 5000; i++) await new Promise((r) => setImmediate(r));
  };
  // Advances the fake clock in 50 ms ticks, as the mode's interval does.
  const advance = async (ms) => {
    for (let spent = 0; spent < ms; spent += 50) {
      t += 50;
      driver.tick();
      await settle();
    }
  };
  return { clock, controller, driver, advance, settle, profile, durations };
};

for (const five of [false, true]) {
  test(`studio ${five ? "five-second-timer" : "timer"}: Reset returns the cube to the start bucket`, async () => {
    const { clock, controller, driver, settle, profile } = await drive(five);
    const start = studioTimerDefaultBucket(profile);
    controller.request(start - 3);
    await settle();
    driver.reset();
    await settle();
    assert.equal(controller.currentValue, start);
    assert.equal(clock.snapshot().bucket, start);
  });
}

for (const five of [false, true]) {
  test(`studio ${five ? "five-second-timer" : "timer"}: the cube follows the countdown bucket while running`, async () => {
    const { clock, controller, driver, advance, profile } = await drive(five);
    const start = studioTimerDefaultBucket(profile);
    driver.start();
    await advance(profile.stepSeconds * 1000 * 3 + 200);
    const bucket = clock.snapshot().bucket;
    assert.equal(bucket, start - 3);
    assert.equal(controller.currentValue, bucket);
  });

  test(`studio ${five ? "five-second-timer" : "timer"}: Pause settles the cube on the paused bucket`, async () => {
    const { clock, controller, driver, advance, settle, profile } = await drive(five);
    const start = studioTimerDefaultBucket(profile);
    driver.start();
    await advance(profile.stepSeconds * 1000 * 2 + 200);
    driver.pause();
    await settle();
    await advance(500);
    assert.equal(clock.running, false);
    assert.equal(controller.currentValue, clock.snapshot().bucket);
    assert.equal(controller.currentValue, start - 2);
  });
}

test("studio timer: Pause restores the preferred move duration, as src/main.mjs does", async () => {
  const { driver, advance, settle, durations, profile } = await drive(false);
  driver.start();
  await advance(profile.stepSeconds * 1000 + 200);
  durations.push(-1); // marker: everything after it comes from the Pause
  driver.pause();
  await settle();
  const after = durations.slice(durations.indexOf(-1) + 1);
  assert(after.length > 0);
  assert.equal(after[0], 100);
});

test("studio timer: an error in the periodic tick goes to onError instead of escaping", async () => {
  const { StudioTimerDriver } = await import("../src/apps/chronocube/timer-mode.ts");
  const errors = [];
  const clock = { snapshot() { throw new Error("tick failed"); } };
  const driver = new StudioTimerDriver({ clock, controller: {}, setDuration() {}, onError: (e) => errors.push(e.message) });
  assert.doesNotThrow(() => driver.tick());
  assert.deepEqual(errors, ["tick failed"]);
});
