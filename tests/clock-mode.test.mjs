import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { MODE_CATALOG } from "../src/apps/mode-catalog.ts";
import { clockHudHtml } from "../src/apps/clock/hud.ts";

// Contract of the Live Clock mode (id `clock`) that replaced clock.html: the panel keeps the digital clock and the
// status line, the controls sit in the dock slots and the numbers in the Nerd drawer (owner decisions of 2026-11-08),
// the host passes the URL parameters and the ModeShell to the mount, and the shell resets what the mode changes.

const read = (path) => readFileSync(path, "utf8");
const html = clockHudHtml();
const idsOf = (markup) => [...markup.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const mode = read("src/apps/clock/live-mode.mjs");

test("the clock is the first app of the registry and has its documentation", () => {
  const clock = MODE_CATALOG.find((m) => m.id === "clock");
  assert.ok(clock);
  assert.equal(MODE_CATALOG[0].id, "clock");
  assert.equal(clock.group, "apps");
  assert.equal(clock.cubes, 3);
  assert.equal(clock.help, "docs/LIVE_CLOCK.md");
});

test("the panel holds the digital clock and the status line only", () => {
  assert.deepEqual(idsOf(html), ["clock-digital", "clock-status"]);
  assert.match(html, /<output id="clock-digital"[^>]*aria-live="off"/);
  assert.match(html, /<p id="clock-status"[^>]*role="status"/);
  assert.doesNotMatch(html, /<select|<button|<table|<details|<h2>|clock-state/);
});

test("the mount fills the slots, the drawer and the Reference view through the ModeShell", () => {
  assert.match(mode, /mountLiveClock\(studio, params, shell, isCurrent\)/);
  assert.match(mode, /mountClockControls\(shell, document,/);
  assert.match(mode, /shell\.setNerd\(nerd\.spec\)/);
  assert.match(mode, /shell\.setReferenceView\(\(\) => stage\?\.resetCamera\(\)\)/);
  assert.match(mode, /shell\.setError\(/);
  assert.doesNotMatch(mode, /getElementById\("(nerd|reference|studio-error)/);
  assert.doesNotMatch(mode, /localStorage/, "no Nerd state of its own: the host owns the drawer");
});

test("the mode adds no live region: errors are alert rows, the status chip is not used", () => {
  assert.doesNotMatch(mode, /setStatus\(/);
  assert.doesNotMatch(mode, /aria-live/);
  assert.doesNotMatch(read("src/apps/clock/controls.ts"), /aria-live|role/);
});

test("the host hands the URL parameters and the ModeShell to the clock mount", () => {
  const host = read("src/chronocube.mjs");
  assert.match(host, /import \{ mountLiveClock \} from "\.\/apps\/clock\/live-mode\.mjs"/);
  assert.match(host, /clock: \(isCurrent, params, shell\) => initClockMode\(isCurrent, params, shell\)/);
  assert.match(host, /return mountLiveClock\(clockStudio, params, shell, isCurrent\)/);
});

test("the single Present button of the shell runs through the fullscreen gate", () => {
  const host = read("src/chronocube.mjs");
  assert.match(host, /createPresentationGate\(documentFullscreenEnv\(\)/);
  assert.match(host, /presentation\.nativeChange\(\)/);
  assert.doesNotMatch(host, /requestFullscreen\(\)\.catch/);
});

test("the shell resets the shared elements a mode may change before the next mode starts", () => {
  const host = read("src/chronocube.mjs");
  const before = host.slice(host.indexOf("onBefore(mode)"), host.indexOf("onMounted(mode)"));
  assert.match(before, /classList\.remove\("clock-control"\)/);
  assert.match(before, /printLink\.setAttribute\("href", defaultPrintHref\)/);
});

test("the mode owns its test hooks, its teardown and no timer outlives it", () => {
  assert.match(mode, /export const clockUnits = \[\]/);
  assert.match(mode, /export let clockStage = null/);
  assert.match(mode, /export let clockStatistics = null/);
  assert.match(mode, /clearInterval\(intervalId\)/);
  assert.match(mode, /removeEventListener\("visibilitychange", draw\)/);
  assert.match(mode, /removeEventListener\("pageshow", draw\)/);
  assert.match(mode, /new SlicedExecutor\(\)/);
});

test("the unified mode does not import the Clock page script", () => {
  assert.doesNotMatch(mode, /from "\.\.?\/clock\.mjs"/);
  assert.doesNotMatch(read("src/chronocube.mjs"), /clock\.mjs"/);
});
