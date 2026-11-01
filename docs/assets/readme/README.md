# README hero screenshot: provenance

Back to the [README](../../../README.md).

`live-hms-clock.png` is an unedited browser screenshot of the running Live H-M-S
Clock. It is not a print export and not a mock-up.

| Field | Value |
| --- | --- |
| Page | `clock.html` (Live H-M-S Clock) served by Vite from this repository |
| Source commit | `db4fff9c30a5c2108f26e693fd9363178c4e6084` (`origin/main`) |
| Captured | 2026-11-01 12:10:17 UTC; the page showed 12:10:17 (UTC), sticker lettering "Small hour / min / sec" (page default) |
| Viewport | 1440x810 CSS pixels, device scale factor 1 |
| Browser | Chromium 153.0.8010.12, headless, via Playwright 1.56.1, software WebGL (SwiftShader) |
| Settling | 8 s after page load, so the cubes have installed their poses; the clock keeps ticking, so the seconds cube may be mid-turn |
| Post-processing | None to the pixels. The PNG was re-encoded losslessly (Pillow `optimize`, compress level 9); a pixel difference check against the original capture was empty |
| Result | 1440x810 PNG, 300,699 bytes, sha256 `24c1cefef8deac613c733669d5672e359a85fb6d4ebf4f9de932cc77dc30796f` |

## Reproduce

```sh
npm run setup
npx vite --port 5391 --host 127.0.0.1 &
CHROMIUM_PATH=/path/to/chrome node scripts/readme-screenshot.mjs http://127.0.0.1:5391
```

[`scripts/readme-screenshot.mjs`](../../../scripts/readme-screenshot.mjs) is not
part of `npm test`. The image shows the time of capture, so a rerun differs.
