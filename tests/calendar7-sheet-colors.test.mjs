import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { contrast } from "./calendar7-contrast.mjs";

// The month sheet palette lives in the calendar7 block of chronocube.css as --c7-* tokens (light in .c7-root, dark in
// the two dark selectors). Every ink on its cell reads at 4.5:1 in both themes. The print inks are untouched.
const css = readFileSync(new URL("../src/chronocube.css", import.meta.url), "utf8");
const tokens = (block) => Object.fromEntries([...block.matchAll(/--c7-([a-z-]+):\s*(#[0-9a-f]{6});/g)].map((m) => [m[1], m[2]]));
const light = tokens(css.slice(css.indexOf(".c7-root {"), css.indexOf("}", css.indexOf(".c7-root {"))));
const darkAt = css.indexOf(':root[data-theme="dark"] .c7-root {');
const dark = tokens(css.slice(darkAt, css.indexOf("}", darkAt)));
const media = css.slice(css.indexOf("@media (prefers-color-scheme: dark) {\n  :root:not([data-theme=\"light\"]) .c7-root"));
const darkMedia = tokens(media.slice(0, media.indexOf("}")));

test("light palette is the chosen one", () => {
  assert.deepEqual(light, { dark: "#193f63", month: "#193f63", weekday: "#52657a", red: "#a83d32", cell: "#eae7dd", "weekend-cell": "#f1e5df", empty: "#f3f1e9" });
});

test("the two dark selectors agree", () => assert.deepEqual(darkMedia, dark));

for (const [name, t] of [["light", light], ["dark", dark]]) {
  test(`sheet inks read at 4.5:1 on their cells (${name})`, () => {
    const pairs = [
      ["weekday date numbers", t.dark, t.cell],
      ["month name letters", t.month, t.cell],
      ["weekday names", t.weekday, t.cell],
      ["SUN/SAT labels", t.red, t.cell],
      ["weekend dates", t.red, t["weekend-cell"]],
    ];
    for (const [what, fg, bg] of pairs) assert.ok(contrast(fg, bg) >= 4.5, `${name} ${what} ${contrast(fg, bg).toFixed(2)}`);
  });
}

test("cells are told apart: empty, date, weekend", () => {
  for (const t of [light, dark]) assert.equal(new Set([t.cell, t["weekend-cell"], t.empty]).size, 3);
});
