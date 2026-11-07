import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// The cube displays already show the state. No studio mode may add a text readout
// ("Moving", "Turning", "Ready", "Synchronizing", per-unit values) below or beside them.
const source = readFileSync(resolve("src/chronocube.mjs"), "utf8");

function section(startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  assert(start > 0, `${startMarker} not found`);
  const end = source.indexOf(endMarker, start);
  assert(end > start, `${endMarker} not found`);
  return source.slice(start, end);
}

const modes = {
  "M/S Timer": section("async function initMsTimerMode(", "// Mode 3:"),
  "H-M Wall Clock": section("async function initHmClockMode(", "// Mode 4:"),
  "Tenth": section("async function initTenthMode(", "// Mode 5:"),
  "Counter": section("async function initCounterMode(", "// Mode 6:"),
  "Timer": section("async function initTimerMode(", "async function initHsmSingleMode("),
  "HSM": section("async function initHsmSingleMode(", "async function initStudio("),
};

for (const [name, code] of Object.entries(modes)) {
  test(`${name} mode renders and writes no state text`, () => {
    assert(!/-state\b/.test(code), "no *-state ids");
    assert(!/clock-state/.test(code), "no readout class");
    assert(!/Moving|Turning|Synchronizing to|"Ready"|>Ready</.test(code), "no state strings");
    assert(!/timer-motion-label/.test(code), "no motion label");
  });
}

test("M/S Timer and H-M Wall Clock render no unit headings", () => {
  assert(!/<h2>/.test(modes["M/S Timer"]));
  assert(!/<h2>/.test(modes["H-M Wall Clock"]));
});

test("modes still host their cube elements and value displays", () => {
  for (const id of ["ms-minutes", "ms-seconds", "ms-tenths"]) assert(modes["M/S Timer"].includes(`id="${id}"`), id);
  for (const id of ["clock-hours", "clock-minutes"]) assert(modes["H-M Wall Clock"].includes(`id="${id}"`), id);
  assert(modes.Tenth.includes('id="tenth-value-display"'));
  assert(modes.Counter.includes('id="counter-value-display"'));
  assert(modes.Timer.includes('id="timer-display"'));
  assert(modes.HSM.includes('id="hsm-value-display"'));
  assert(modes["M/S Timer"].includes('id="timer-logical"'));
});
