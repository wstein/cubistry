import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

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
      (img) => img.id === "6" && img.marker === "underline",
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
