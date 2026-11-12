import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// Source checks for the header app switcher (src/shell/shell.css): the native <select> keeps its keyboard and
// mobile behavior, the chevron is drawn by the shell so it follows the theme tokens and sits at a fixed inset.

const css = readFileSync(resolve("src/shell/shell.css"), "utf8");

/** Returns the declaration block of the first rule whose selector list contains `selector` exactly. */
function rule(selector) {
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = m[1].replace(/\/\*[\s\S]*?\*\//g, "").split(",").map(s => s.trim());
    if (selectors.includes(selector)) return m[2];
  }
  assert.fail(`rule not found: ${selector}`);
}

const selectRule = () => rule(".shell .shell-switcher select");
const chevronRule = () => rule(".shell .shell-switcher::after");
const switcherRule = () => rule(".shell .shell-switcher");

test("switcher is a positioning context for the chevron", () => {
  assert.match(switcherRule(), /(^|[\s;])position:\s*relative/);
});

test("switcher select drops the native arrow", () => {
  const select = selectRule();
  assert.match(select, /(^|[\s;])appearance:\s*none/);
  assert.match(select, /-webkit-appearance:\s*none/);
});

test("switcher select reserves room for the chevron and ellipsizes long labels", () => {
  const select = selectRule();
  const chevron = chevronRule();
  // Accept shorthand or the longhand form; the chevron needs a right inset at least this large.
  const pad =
    select.match(/padding:\s*0\s+(\d+)px\s+0\s+(\d+)px/) ||
    (() => {
      const right = select.match(/padding-right:\s*(\d+)px/)?.[1];
      const left = select.match(/padding-left:\s*(\d+)px/)?.[1];
      return right && left ? [null, right, left] : null;
    })();
  assert(pad, "padding-right and padding-left (or padding shorthand) expected");
  const [right, left] = [Number(pad[1]), Number(pad[2])];
  assert(left >= 16, `left padding ${left}px must follow the pill curvature (>= 16px)`);
  const right_inset = Number(chevron.match(/right:\s*(\d+)px/)?.[1]);
  const size = Number(chevron.match(/width:\s*(\d+)px/)?.[1]);
  assert(right_inset >= 16, `chevron inset ${right_inset}px must be >= 16px`);
  assert(right >= right_inset + size + 8, `padding-right ${right}px must clear the chevron (${right_inset}+${size}+8)`);
  assert.match(select, /text-overflow:\s*ellipsis/);
});

test("chevron is a mask painted with a theme token, not a hard-coded color", () => {
  const chevron = chevronRule();
  assert.match(chevron, /-webkit-mask(-image)?:\s*url\(/);
  assert.match(chevron, /(^|[\s;])mask(-image)?:\s*url\(/);
  assert.match(chevron, /background(-color)?:\s*var\(--ink\)/);
  assert.match(chevron, /pointer-events:\s*none/);
  assert.match(chevron, /top:\s*50%/);
  assert.match(chevron, /translateY\(-50%\)/);
  assert.doesNotMatch(chevron, /#[0-9a-f]{3,8}\b|rgba?\(/i, "no raw color in the chevron rule");
  assert.doesNotMatch(css, /background-image:\s*url\(["']?data:image\/svg[^)]*(fill|stroke)=['"]?%?23/i, "no colored data-URI arrow");
});

test("chevron stays visible in forced-colors mode", () => {
  const block = css.match(/@media \(forced-colors: active\)\s*\{([\s\S]*?\n\})/);
  assert(block, "forced-colors media block expected");
  assert.match(block[1], /\.shell \.shell-switcher::after[^}]*background(-color)?:\s*CanvasText/);
});

test("focus ring of the switcher is not suppressed", () => {
  const select = selectRule();
  assert.doesNotMatch(select, /outline:\s*(none|0)/);
});
