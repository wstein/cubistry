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
    assert(!/id="[^"]*-state"|\+ "-state"|\$\("[a-z-]*-state"\)/.test(code), "no *-state ids or writers");
    assert(!/clock-state/.test(code), "no readout class");
    assert(!/Moving|Turning|Synchroniz|Counting down|Paused|"Ready"|>Ready</.test(code), "no state strings");
    assert(!/timer-motion-label|timer-sync|timer-status-info|clock-status/.test(code), "no status elements");
    assert(!/role="status"/.test(code), "no live status regions");
  });
}

test("M/S Timer and H-M Wall Clock render no unit headings", () => {
  assert(!/<h2>/.test(modes["M/S Timer"]));
  assert(!/<h2>/.test(modes["H-M Wall Clock"]));
});

test("M/S Timer and H-M Wall Clock host bare cubes like the Live Clock: no wrapper cards, no stuck aria-busy", () => {
  for (const name of ["M/S Timer", "H-M Wall Clock"]) {
    assert(!/clock-card/.test(modes[name]), `${name}: no wrapper article`);
    assert(!/aria-busy|role="img"/.test(modes[name]), `${name}: no aria-busy or role=img on hosts`);
    assert(/data-unit="[HMST]"/.test(modes[name]), `${name}: data-unit kept`);
  }
});

test("the four single-cube modes have no card heading; the HUD title stays except in the migrated Tenth mode", () => {
  for (const name of ["Tenth", "Counter", "Timer", "HSM"]) {
    assert(!/<h2/.test(modes[name].split("renderStudioHud(")[0]), `${name}: no card h2`);
    // Tenth fills the dock slots through ModeShell instead of the HUD (slot API); the others still render the HUD.
    if (name === "Tenth") assert(modes[name].includes("mountTenthControls(") && !modes[name].includes("renderStudioHud("), "Tenth: dock slots");
    else assert(modes[name].includes("renderStudioHud("), `${name}: HUD kept`);
  }
});

test("the Live Clock mode keeps its status line", () => {
  // The mode moved to src/apps/clock/; its panel markup is hud.ts.
  const live = readFileSync(resolve("src/apps/clock/hud.ts"), "utf8");
  assert(live.includes('id="clock-status"'));
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
