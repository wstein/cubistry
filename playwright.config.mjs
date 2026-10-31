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
export default defineConfig({
  testDir: "./tests/browser",
  timeout: 30000,
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
