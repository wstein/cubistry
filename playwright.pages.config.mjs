import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";
const port = Number(process.env.PLAYWRIGHT_PORT || 5190);
export default defineConfig({
  ...base,
  testDir: "./tests/pages",
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}/cubistry/` },
  webServer: {
    command:
      "VITE_BASE_PATH=/cubistry/ npm run build && node tests/pages/serve.mjs",
    url: `http://127.0.0.1:${port}/cubistry/`,
    reuseExistingServer: false,
    timeout: 120000,
  },
});
