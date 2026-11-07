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
