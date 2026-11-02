import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

test("chronocube.html contains valid structure, studio header, and script tag", () => {
  const html = readFileSync(resolve("chronocube.html"), "utf8");
  assert(html.includes('<title>Cubistry · Chronocube Studio</title>'));
  assert(html.includes('<select id="studio-application">'));
  assert(html.includes('<optgroup label="Chronocube 2×2 Studio">'));
  assert(html.includes('<option value="clock"'));
  assert(html.includes('<option value="ms-timer"'));
  assert(html.includes('<option value="hm-clock"'));
  assert(html.includes('<option value="tenth"'));
  assert(html.includes('<option value="counter"'));
  assert(html.includes('<option value="timer"'));
  assert(html.includes('<div id="studio-scene" class="clock-viewer"></div>'));
  assert(html.includes('<div id="studio-cards" class="clock-cubes"'));
  assert(html.includes('<aside id="studio-controls"'));
  assert(html.includes('src="/src/chronocube.mjs"'));
});

test("vite.config.mjs includes chronocube HTML input", () => {
  const viteConfig = readFileSync(resolve("vite.config.mjs"), "utf8");
  assert(viteConfig.includes("chronocube: fileURLToPath("));
  assert(viteConfig.includes('"./chronocube.html"'));
});

test("chronocube manifest builder correctly includes fonts and orientation markers", async () => {
  const { buildStudioManifest } = await import(
    "../src/apps/chronocube/manifest.ts"
  );
  const manifest = buildStudioManifest(
    "noto-sans",
    "line-auto",
    "quicksand",
    "words-pascal",
    [],
  );
  assert(manifest.images.length > 0);
  assert(
    manifest.images.some(
      (img) => img.id === "0" && img.url && img.url.includes("noto-sans"),
    ),
  );
  assert(
    manifest.images.some(
      (img) => img.id === "6" && img.url && img.url.includes("-line.svg"),
    ),
  );
  assert(
    manifest.images.some(
      (img) => img.id === "H" && img.url && img.url.includes("quicksand"),
    ),
  );
  assert(
    manifest.images.some(
      (img) => img.id === "T" && img.url && img.url.includes("quicksand"),
    ),
  );
});
