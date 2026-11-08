import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The cube display already shows the time; the Live Clock studio mode must not
// add a Hours / Minutes / Seconds text readout below it.
// The mode lives in src/apps/clock/ (mount, panel, dock controls, Nerd drawer).
const clockMode = ["live-mode.mjs", "hud.ts", "controls.ts", "nerd.ts"]
  .map((name) => readFileSync(resolve("src/apps/clock", name), "utf8"))
  .join("\n");

test("Live Clock mode renders no text readout below the cubes", () => {
  assert(!/<h2>/.test(clockMode), "no unit headings");
  assert(!/hours-state|minutes-state|seconds-state/.test(clockMode), "no readout ids");
  assert(!/clock-state/.test(clockMode), "no readout class");
});

test("Live Clock mode does not write Moving / Synchronizing suffixes per unit", () => {
  assert(!/· Moving|· Synchronizing/.test(clockMode));
  assert(!/names\[i\] \+ "-state"/.test(clockMode));
});

test("Live Clock mode still hosts the three cube elements", () => {
  for (const id of ["clock-hours", "clock-minutes", "clock-seconds"]) {
    assert(clockMode.includes(`id="${id}"`), id);
  }
});
