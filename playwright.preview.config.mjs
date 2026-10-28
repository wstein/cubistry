import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";
const port = Number(process.env.PLAYWRIGHT_PORT || 5199);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PLAYWRIGHT_PORT must be a valid port");
export default defineConfig({
  ...base,
  testDir: "./tests/pages-infra",
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}/cubistry/` },
  webServer: {
    command: `node tests/pages-infra/build-fixture.mjs && PLAYWRIGHT_PORT=${port} STATIC_ROOT=test-results/preview-site node tests/pages/serve.mjs`,
    url: `http://127.0.0.1:${port}/cubistry/`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
