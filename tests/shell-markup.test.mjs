import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Unit checks for the shell markup (index.html) and how the studio loads the shell styles. Source only.

const read = path => readFileSync(resolve(path), "utf8");

const regions = ["header", "app-switcher", "stage", "reference-view", "hints", "dock", "status-zone", "alerts", "primary-action",
  "readout", "presentation", "nerd-drawer", "view-controls", "present-action"];

test("the shell markup carries every region once and the five dock slots in order", () => {
  const html = read("index.html");
  const found = [...html.matchAll(/data-region="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual([...found].sort(), [...regions].sort());
  assert.deepEqual([...html.matchAll(/data-slot="([^"]+)"/g)].map(m => m[1]), ["1", "2", "3", "4", "5"]);
  assert(html.indexOf('data-region="header"') < html.indexOf('data-region="stage"'), "header sits above the stage");
});

test("the studio no longer installs the idle HUD controller", () => {
  const source = read("src/chronocube.mjs");
  assert(!source.includes("initHudIdle") && !source.includes("hud-idle"));
  assert(existsSync(resolve("src/apps/shared/hud-idle.ts")), "single pages keep using it");
});

test("the studio stylesheet loads tokens and shell layout after the legacy styles", () => {
  const css = read("src/chronocube.css");
  const order = ['"./style.css"', '"./clock.css"', '"./ms-timer.css"', '"./shell/tokens.css"', '"./shell/shell.css"']
    .map(name => css.indexOf(name));
  assert(order.every(i => i >= 0));
  assert.deepEqual([...order].sort((a, b) => a - b), order);
});

test("the header subtitle wraps to two lines instead of ending in an ellipsis", () => {
  const css = read("src/shell/shell.css"), rule = css.slice(css.indexOf(".shell .shell-title p {"), css.indexOf("}", css.indexOf(".shell .shell-title p {")));
  assert(/-webkit-line-clamp:\s*2/.test(rule) && /white-space:\s*normal/.test(rule));
  assert(!/white-space:\s*nowrap/.test(rule));
});

test("the dock region of the Appearance section is not shown in presentation mode, and pseudo-elements honor reduced motion", () => {
  const css = read("src/shell/shell.css");
  assert.match(css, /body\.presentation-mode \.shell \.shell-view-controls\s*\{\s*display:\s*none/);
  const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
  assert(reduced.includes("::after") && reduced.includes("::before"));
});
