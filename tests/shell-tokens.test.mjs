import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Unit checks for the shell design tokens (src/shell/tokens.css). Source only: no browser, no build.
// Decision notes: knowledge/adr/ADR-0001-shell-tokens.md.

const read = path => readFileSync(resolve(path), "utf8");
const tokensCss = read("src/shell/tokens.css");

/** Returns the declarations of the first rule whose selector equals `selector`. */
function declarations(css, selector) {
  const start = css.indexOf(`${selector} {`);
  assert(start >= 0, `selector not found: ${selector}`);
  const open = css.indexOf("{", start);
  const close = css.indexOf("}", open);
  const out = {};
  for (const m of css.slice(open + 1, close).matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)) out[m[1]] = m[2].trim();
  return out;
}

const light = declarations(tokensCss, ":root");
const dark = declarations(tokensCss, ':root[data-theme="dark"]');
const darkMedia = declarations(tokensCss, ':root:not([data-theme="light"])');

function luminance(hex) {
  assert(/^#[0-9a-f]{6}$/i.test(hex), `not a 6-digit hex color: ${hex}`);
  const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
function contrast(a, b) {
  const [x, y] = [luminance(a), luminance(b)];
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// Foreground token, background token, minimum WCAG 2.x contrast ratio.
// 4.5 = normal text. 3 = large text (>= 20 px here) and non-text UI (WCAG 1.4.11).
const status = ["--s-ready", "--s-moving", "--s-sync", "--s-paused", "--s-done", "--s-warn", "--s-error"];
const pairs = [
  ["--ink", "--bg", 4.5], ["--ink", "--surface", 4.5], ["--ink", "--surface-2", 4.5],
  ["--ink-2", "--bg", 4.5], ["--ink-2", "--surface", 4.5], ["--ink-2", "--surface-2", 4.5],
  ["--mark-ink", "--bg", 4.5], ["--mark-ink", "--surface", 4.5],
  ["--accent", "--bg", 4.5],
  ["--on-accent", "--accent", 4.5],
  ["--focus", "--bg", 3], ["--focus", "--surface", 3],
  ...status.flatMap(s => [[s, "--bg", 4.5], [s, "--surface", 4.5]]),
];
// ADR decision: --accent on --surface is below 4.5 in the dark theme (4.48). It stays at the README value and is
// used there only for large text and fills (3:1). Small accent text uses --bg.
const accentOnSurface = [["--accent", "--surface", 4.5], ["--accent", "--surface-2", 3]];
const accentOnSurfaceDark = [["--accent", "--surface", 3], ["--accent", "--surface-2", 3]];

function check(theme, tokens, list) {
  for (const [fg, bg, min] of list) {
    assert(tokens[fg] && tokens[bg], `${theme}: missing ${fg} or ${bg}`);
    const ratio = contrast(tokens[fg], tokens[bg]);
    assert(ratio >= min, `${theme}: ${fg} ${tokens[fg]} on ${bg} ${tokens[bg]} is ${ratio.toFixed(2)}:1, needs ${min}:1`);
  }
}

test("light theme tokens meet their contrast minimums", () => {
  check("light", light, [...pairs, ...accentOnSurface]);
});

test("dark theme tokens meet their contrast minimums", () => {
  check("dark", dark, [...pairs, ...accentOnSurfaceDark]);
});

test("README palette values are present in both themes", () => {
  const expected = {
    light: { "--bg": "#f5f3eb", "--surface": "#fffdf6", "--ink": "#153b61", "--ink-2": "#51647a", "--accent": "#9e0b5c",
      "--focus": "#c8257e", "--mark-ink": "#153b61", "--s-ready": "#4f6176", "--s-moving": "#245e9e", "--s-sync": "#0b6e68",
      "--s-paused": "#7d5900", "--s-done": "#2b6d36", "--s-warn": "#984a00", "--s-error": "#b0261d" },
    dark: { "--bg": "#14181f", "--surface": "#1d2330", "--ink": "#eceae2", "--ink-2": "#a9b1be", "--accent": "#e0569d",
      "--focus": "#ff7ab8", "--mark-ink": "#8fb4dd", "--s-ready": "#a3afbd", "--s-moving": "#86b5ee", "--s-sync": "#5ccdc2",
      "--s-paused": "#e3b65c", "--s-done": "#7ccf8a", "--s-warn": "#f2a65a", "--s-error": "#ff8d84" },
  };
  for (const [name, tokens] of Object.entries({ light, dark }))
    for (const [key, value] of Object.entries(expected[name])) assert.equal(tokens[key], value, `${name} ${key}`);
});

test("the system dark theme block repeats the explicit dark theme and honors an explicit light theme", () => {
  assert.deepEqual(darkMedia, dark);
  assert(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root:not\(\[data-theme="light"\]\)/.test(tokensCss));
});

test("tokens define the type, spacing and radius scales and the self-hosted font families", () => {
  for (const key of ["--f-ui", "--f-num", "--t-cap", "--t-sm", "--t-md", "--t-lg", "--t-xl", "--t-2xl",
    "--sp-1", "--sp-2", "--sp-3", "--sp-4", "--sp-5", "--sp-6", "--r-1", "--r-2", "--r-3", "--r-pill",
    "--dur-chrome", "--dur-view"]) assert(light[key], key);
  assert.match(light["--f-ui"], /^"IBM Plex Sans"/);
  assert.match(light["--f-num"], /^"IBM Plex Mono"/);
  for (const url of tokensCss.matchAll(/url\("(\/fonts\/ibm-plex\/[^"]+)"\)/g))
    assert(existsSync(resolve("public", url[1].slice(1))), url[1]);
  assert.equal([...tokensCss.matchAll(/@font-face/g)].length, 5);
});

test("IBM Plex files are woff2, carry the OFL texts and are listed in the notices", () => {
  for (const file of ["ibm-plex-sans-latin-400-normal", "ibm-plex-sans-latin-500-normal", "ibm-plex-sans-latin-600-normal",
    "ibm-plex-mono-latin-400-normal", "ibm-plex-mono-latin-500-normal"]) {
    const bytes = readFileSync(resolve(`public/fonts/ibm-plex/${file}.woff2`));
    assert.equal(bytes.subarray(0, 4).toString("latin1"), "wOF2", file);
  }
  for (const file of ["OFL-Sans.txt", "OFL-Mono.txt"]) {
    const text = read(`public/fonts/ibm-plex/${file}`);
    assert(text.includes("SIL OPEN FONT LICENSE Version 1.1"), file);
    assert(text.includes("IBM Corp."), file);
  }
  const notices = read("THIRD_PARTY_NOTICES.md");
  assert(notices.includes("IBM Plex Sans") && notices.includes("IBM Plex Mono") && notices.includes("public/fonts/ibm-plex/OFL-Sans.txt"));
  const licenses = read("licenses.html");
  assert(licenses.includes("IBM Plex Sans") && licenses.includes("IBM Plex Mono") && licenses.includes("fonts/ibm-plex/OFL-Sans.txt"));
});
