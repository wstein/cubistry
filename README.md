# Cubistry

A browser-first twisty-puzzle platform. The first local MVP is a **real fixed-print
2×2 counter**: two constant upper title stickers and two lower digits, 0–99.

## Run the counter locally

Requires Node 22.12+ (tested with 24.19.0), npm, and Python 3 for proof checks.

```sh
npm ci
npm run dev
```

Open the local URL printed by Vite. Use +1/−1, +10/−10, a custom step, or a direct
value. Bounds clamp by default; wrap is an explicit option. Drag to orbit the
camera and use **Front view** to return. Manual layer turns are disabled.

The minute timer supports Start, Pause, Resume, and Reset. It derives remaining
minutes from a stored wall-clock deadline, so a background tab or reload does
not lose elapsed time. No seconds are shown on the cube.

The default title is BREAK / MINUTES. **Personalize the fixed print** accepts
one or two lines, up to 40 characters per line. **Apply new print** explicitly
creates a new immutable title/number printing and resets the counter to 15.
Changing the number format also requires this new-print operation. Editing the
form alone never changes sticker images during counting. Label fragments may
separate while turning and return upright after each completed value.

## Evidence and checks

```sh
npm test
npm run test:proof
python3 research/counter/verify.py
npm run build
npx playwright install chromium
npm run test:e2e
```

In a cloud sandbox with an unwritable home cache, use
`npm ci --cache /tmp/cubistry-npm-cache` and set
`PLAYWRIGHT_BROWSERS_PATH=/tmp/cubistry-playwright` for browser installation/tests.

[The independent feasibility proof](docs/COUNTER_FEASIBILITY.md) establishes
both padded and unpadded fixed prints as SAT, and permanently fixed upper cubies
as UNSAT under the distinct-upright-glyph model. [The reuse audit](docs/COUNTER_REUSE.md)
records existing renderer/solver choices, licenses, and sizes. The
[knowledge base](knowledge/Home.md) preserves product concepts and findings.

The UI uses actual image stickers on eight rigid corner cubies. Title text is
not a front-face HTML overlay. Solver-generated move words are independently
replayed, and arbitrary target sequences use verified paths through a common
complete source state. No shortest-path claim is made. No deployment is required.

## Preview

![Counter with a physical two-sticker title and two digits](docs/assets/counter-desktop.png)

[Mobile preview](docs/assets/counter-mobile.png). These are browser screenshots,
not print exports; their pixel dimensions and hashes are
[recorded separately](docs/assets/counter-previews.json).
