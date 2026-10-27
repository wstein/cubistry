import { defineConfig } from "@playwright/test";
import base from "./playwright.config.mjs";
const port = Number(process.env.PLAYWRIGHT_PORT ?? 5183);
if (!Number.isInteger(port) || port < 1 || port > 65535)
  throw Error("PLAYWRIGHT_PORT must be a valid port");
export default defineConfig({
  ...base,
  use: { ...base.use, baseURL: `http://127.0.0.1:${port}` },
  webServer: {
    ...base.webServer,
    command: `npm run dev -- --port ${port} --strictPort`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: false,
  },
});
