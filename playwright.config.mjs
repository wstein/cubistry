import { defineConfig } from "@playwright/test";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5173);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PLAYWRIGHT_PORT must be an integer from 1 to 65535");
const baseURL = `http://127.0.0.1:${port}`;
// Test-only low-effects mode (docs/VIEWER_RENDERING.md, "Test mode (low effects)"): software GL
// (SwiftShader) pays heavily for the shadow maps. "shadows" disables only the renderer shadow map;
// "1" would also halve the drawing-buffer pixel ratio, which breaks specs that assert a 2x buffer.
const lowEffects = {
  cookies: [],
  origins: [{ origin: baseURL, localStorage: [{ name: "cubistry-lowfx", value: "shadows" }] }],
};
// CI splits the suite into two jobs (.github/workflows/counter.yml). Specs that wait on real animation time or assert
// millisecond precision are slow in software GL, so they run in their own job with a longer per-test limit.
// CUBISTRY_E2E_GROUP=fast runs everything else, =timing only these files; unset (the default) runs all of them.
export const timingSpecs = [
  "cube-first-ui", "five-second-timer", "leading-zero", "live-clock", "workshop-timer",
].map(name => `**/${name}.spec.mjs`);
const group = process.env.CUBISTRY_E2E_GROUP;
if (group !== undefined && group !== "" && group !== "fast" && group !== "timing")
  throw Error('CUBISTRY_E2E_GROUP must be "fast" or "timing"');
export default defineConfig({
  testDir: "./tests/browser",
  ...(group === "fast" ? { testIgnore: timingSpecs } : group === "timing" ? { testMatch: timingSpecs } : {}),
  timeout: group === "timing" ? 90000 : 30000,
  expect: { timeout: group === "timing" ? 20000 : 5000 }, // polls and auto-waits in the slow group
  fullyParallel: false,
  workers: 1,
  use: {
    baseURL,
    storageState: lowEffects,
    viewport: { width: 1280, height: 1000 },
    contextOptions: { reducedMotion: "reduce" },
    launchOptions: {
      args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader"],
    },
    trace: "retain-on-failure",
  },
  webServer: {
    command: `npm run dev -- --port ${port} --strictPort`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
  },
  reporter: "list",
});
