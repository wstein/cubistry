// Captures the README hero image from the running Live H-M-S Clock.
// Usage: node scripts/readme-screenshot.mjs [baseUrl] [outFile]
// Needs a running dev server (npx vite --port 5391) and Playwright's Chromium.
// Not part of `npm test`. See docs/assets/readme/README.md.
import { chromium } from "@playwright/test";

const base = process.argv[2] ?? "http://127.0.0.1:5391";
const out = process.argv[3] ?? "docs/assets/readme/live-hms-clock.png";
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || undefined,
  args: [
    "--use-gl=angle",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 810 },
  deviceScaleFactor: 1,
});
await page.goto(`${base}/clock.html`);
await page.waitForTimeout(8000); // let the cubes install their poses and settle
const shown = await page.evaluate(() => document.body.innerText.match(/\d\d:\d\d:\d\d/)?.[0]);
await page.screenshot({ path: out });
console.log(`captured ${out}; page showed ${shown}; ${browser.version()}`);
await browser.close();
