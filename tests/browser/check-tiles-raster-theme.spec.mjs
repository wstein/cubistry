import { test, expect } from "@playwright/test";
import { spawnSync } from "node:child_process";
// scripts/check-pastel-garden-tiles.mjs iterates every public/playground-<id>/ theme. CI runs it without arguments
// (e2e-pages job), so it has to measure a theme whose faces are WebP images, not only SVG themes.
test("the sticker-tile check measures the WebP theme Frieden tile by tile", () => {
  test.slow();
  const r = spawnSync(process.execPath, ["scripts/check-pastel-garden-tiles.mjs", "frieden"], { encoding: "utf8", timeout: 120000 });
  expect(r.stderr).not.toContain("ENOENT");
  const lines = r.stdout.split("\n");
  expect(lines.filter((l) => /^ok {3}frieden\/[FBRLUD]_[01]_[01] detail=/.test(l))).toHaveLength(24);
  expect(r.stdout).toContain("all tiles pass");
  expect(r.status).toBe(0);
});
