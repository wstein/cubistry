import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { validateFiveSecondRoute } from "../src/apps/timer/design.ts";
import { buildStudioManifest } from "../src/apps/chronocube/manifest.ts";
import { FIVE_SECOND_TIMER, TEN_SECOND_TIMER } from "../src/apps/timer/clock.ts";
import { createStudioTimerController, studioTimerProfile } from "../src/apps/chronocube/timer-mode.ts";

const route = validateFiveSecondRoute(
  JSON.parse(readFileSync("public/five-second-timer.v1.json")),
);
const view = { configure() {}, resetCamera() {}, async animate() {} };

test("studio five-second-timer mode builds its controller from the studio manifest", () => {
  // Same inputs chronocube.mjs initTimerMode(true) passes: studio manifest + route.
  const manifest = buildStudioManifest("dseg7", "off", "same", "words-pascal", []);
  const states = [];
  const controller = createStudioTimerController(view, route, manifest, (v, busy) =>
    states.push([v, busy]),
  );
  assert.equal(controller.constructor.name, "TimerController");
});

test("studio timer modes use the profile matching their route and a bucket default", () => {
  assert.equal(studioTimerProfile(true), FIVE_SECOND_TIMER);
  assert.equal(studioTimerProfile(false), TEN_SECOND_TIMER);
  const p = studioTimerProfile(true);
  const bucket = p.defaultSeconds / p.stepSeconds;
  assert(Number.isInteger(bucket) && bucket < route.states.length);
});

test("chronocube.mjs routes the timer modes through the shared factory", () => {
  const src = readFileSync("src/chronocube.mjs", "utf8");
  assert(src.includes("createStudioTimerController("));
  assert(!src.includes("new TimerController("));
});
