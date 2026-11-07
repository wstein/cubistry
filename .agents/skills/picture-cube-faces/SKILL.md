---
name: picture-cube-faces
description: Generate or refine picture-cube face sets (six whole square SVG faces U L F R B D, Pastel-style themes) that are sliced into NxN stickers at runtime for cube sizes 2x2 up to 7x7. Use when asked to create, extend, vary, check or review a themed face set with a belt panorama (L-F-R-B), Up/Down faces, seam-matching edges, tile legibility checks, concept sheets or variant comparisons. Only 2x2 is verified so far; N > 2 is unverified.
---
# Picture-cube faces

Build, check and review picture-cube themes: a belt L - F - R - B that reads as ONE panorama, plus Up and Down faces whose borders come from the belt. All code is Node ESM (no Python). Read the repo rules in `AGENTS.md` first; this skill does not override ADRs or specs. For SVG print rules also follow `.agents/skills/validate-artwork/SKILL.md`.

## What a theme is (read this first)

- **Core deliverable = six whole faces** `U L F R B D` (`.svg`, square, `viewBox="0 0 S S"`, integer width/height up to 1024, default S = 420) plus `net.svg` and a manifest (`build-report.json`, `tiles.json` from the checker). The theme does not know N: faces are sliced into N x N stickers (`F_r_c`, r = row, c = column) and the same faces must work at N = 2, 3, 4, 5, 6, 7.
- **What else is needed depends on the consumer.** Ask which one the brief targets (see "Consumers" below): the 2x2 playground (on this branch) loads 24 per-sticker tile files plus a sha256 manifest; the theme stack (unmerged theme branches) ships faces only plus a manifest made by `scripts/build-playground-theme.mjs`; the 3x3 `picture3` page takes raster uploads only. Tile files from `theme.build(dir, { previewN: [2] })` are previews for checking, not automatically a deliverable.
- **Hard rule: the app's SVG allowlist.** Every shipped svg must pass `validateSvg` in `packages/cube-assets/src/index.ts`: tags `svg g path rect circle ellipse line polygon polyline` only; attributes `xmlns viewBox width height fill stroke stroke-width stroke-linecap stroke-linejoin opacity fill-opacity stroke-opacity d x y x1 x2 y1 y2 cx cy r rx ry points transform` only; no `url(`, `javascript:`, `data:`, `http(s):`, `@`, backslash in values; no `style`, `id`, `class`, `href`, `shape-rendering`, `overflow`; no prefixed elements; no `<!` or `<?`. The checker applies the same rules to a parsed document (decoded attribute values, namespaces).
- **Ambiguity is acceptable (owner rule).** Stickers or orientations that look alike (symmetric stickers, duplicate stones, rotation twins) do not make a theme invalid: the cube counts as visually solved. The checker therefore CLASSIFIES them and does not fail on them. Symmetric centers of an odd-N cube need not be turned.
- Verification status: **2x2 is verified; N > 2 is unverified, based on a synthetic test.** See `reference/cube-sizes-2-to-7.md`, which also lists the open owner decisions (hero and centers, strictness for N >= 3, legacy 320 px faces).

## Workflow

0. **Pre-sketch (always first).** Write a concept JSON (`templates/concept.example.json`): per face the hero, background colors and edge colors. Run `node scripts/sketch-sheet.mjs concept.json --png concept.png`. It checks the 12 shared edge colors and the hero share (35-50 %). The owner approves the composition before any full build.
1. **Brief.** Fill `templates/brief.md` (theme, mood, cast, belt story, hero per face, hard rules, Definition of Done, deliverables, hand-back format).
2. **Build.** Write scene code with the library (below). Rebuild in place; earlier builds go to `v1/`, `v2/` (`build(dir, { archive: true })`).
3. **Check.** `node scripts/check-cube-set.mjs <dir>` until `RESULT: PASS`. Fix causes, not thresholds.
4. **View.** Render the net and enlarged faces and LOOK at them after the LAST change. Numbers do not show composition, charm or calm.
5. **Variants** for every open design question (protocol below).
6. **Independent review** (below), then the hand-back (`templates/handback.md`).

## Library (`src/index.mjs`)

Pure Node ESM. The folder is `src/` because the repo `.gitignore` ignores `lib/`.

```js
import { defineTheme, createBelt } from "../src/index.mjs";
export default defineTheme({
  name: "mytheme", size: 420,                       // face px; 420 is divisible by every N from 2 to 7
  belt: createBelt({ sky: [/* L F R B stops */], ground: [/* L F R B stops */], horizon: (u) => 0.74 }),
  up: { center: [250, 235, 250], band: 0.4 }, down: { center: [190, 220, 170] },
  faces: { L: (ctx) => "<svg fragment>", F, R, B, U, D },   // draw ON TOP of the automatic background
});
// theme.build("out/mytheme", { archive: true, previewN: [2, 7] })
```

- **Parameters:** face size S (not N). Scene coordinates are face pixels; `ctx.k = S / 320` scales line weights (line weights are designed for a 320 px face: k = 1 there, 1.3125 at 420 px); `ctx.s` is the Pastel kit (`merged`, `happy`, `stroke`, `W` line weights); `ctx.horizonPath()` gives the ridge line.
- **Belt sampler** (`belt.mjs`): position `u` in [0, 4) around L-F-R-B; sky and ground come from four cyclic keyframes blended with a smoothstep, so B wraps into L; the horizon is a function of `u`. Edge pixels of neighboring faces sample the same `u`, so L|F, F|R, R|B, B|L match by construction.
- **Up/Down derivation** (`updown.mjs`): U takes its borders from the top rows of F, L, R, B (D from the bottom rows) and fills the interior with a Coons patch (optional calm center color), so all 8 edges touching U or D match by construction.
- **Writers** (`svg.mjs`): faces, net (standard cross: U above F; L F R B in a row; D below F), optional tile previews (viewBox crops named `F_r_c`), sticker frames and rounded fields for letter cubes.
- **Block alphabet** (`glyphs.mjs`): letters and digits as stroke paths, never `<text>`. Avoid symmetric glyphs (`SYMMETRIC_GLYPHS`) as the only orientation hint.
- **Compaction** (`compact.mjs`): background grids merge runs of equal color cells into plain rects (no wrapper, no `shape-rendering`); `compactSvg` merges touching equal rects and keeps 12 significant digits; it skips any rect that has an attribute it did not parse (single-quoted, for example). Lossless and measured (`build-report.json`, `artCompaction`). Art items may be `{svg, bbox}` so tile previews drop what lies outside the crop; the bbox must include the stroke, and the checker compares every tile file with the face crop.
- **Belt horizon must be periodic.** A function horizon needs `horizon(0) = horizon(4-)`: B wraps into L, and a jump there is a seam one cell inside B that the edge check cannot see. `createBelt` reports `belt.warnings` and `theme.build` prints them and stores them in `build-report.json`.
- **Keep the outer ~3 % rim of every face free of art** unless the art is continuous across the edge (a ridge line is).

Worked example (synthetic, a tooling test, not art; its hero is below the 35-50 % rule): `examples/demo-theme.mjs`.

```
node .agents/skills/picture-cube-faces/examples/build-demo.mjs /tmp/demo --preview 3,7
node .agents/skills/picture-cube-faces/scripts/check-cube-set.mjs /tmp/demo
```

Generated demo output stays out of git (build into a temp dir). Tile previews at N = 2 are a quarter of a full-background face (30-47 KB) and exceed the 30 KB tile budget with a warning; that is expected. Tests: `node --test ".agents/skills/picture-cube-faces/tests/*.test.mjs"`; they also run in `npm test` (and so in `npm run check`). The checker end-to-end tests need Playwright's Chromium and report themselves as skipped when no browser can start. The `counter` CI job installs Chromium (`npx playwright install --with-deps chromium`) so they run there; elsewhere run them locally before a hand-back.

## Consumers: what the deliverable must contain

| Consumer | Needs | How |
| --- | --- | --- |
| Skill/theme checking, review, concept work | six faces + `net.svg` + `tiles.json` | `theme.build(dir)`, `check-cube-set.mjs` |
| 2x2 playground set on this branch (like `public/playground-pastel/`) | six faces **and** 24 tile files `F_r_c.svg` (N = 2: width/height S/2, viewBox = the crop) **and** the sha256 manifest and typed list in `src/apps/playground/pastel-assets.ts` | `theme.build(dir, { previewN: [2] })` writes the tile files; the hashes come from the generator in the app repo (`scripts/build-pastel-garden-art.mjs` pattern, `docs/PICTURE_PLAYGROUND.md`); legacy sets use S = 320 |
| Theme stack (unmerged branches such as `feat/picture-upload`, `feat/theme-*`) | faces only (tile files are not shipped); `scripts/build-playground-theme.mjs <id>` on that branch pins them by sha256 into `manifest.json` and `theme-assets/<id>.ts`; it requires faces of exactly 320 x 320 with the root `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="320" viewBox="0 0 320 320">` | build with `size: 320` (the checker then warns that 320 is not divisible by 3, 6, 7: stickers are fractional pixels; the app cuts at run time) or extend that script for 420 |
| 3x3 `picture3` page | raster uploads only (PNG, JPEG, WebP); uploaded SVG is rejected, SVG presets are compiled into `src/apps/picture3/presets.ts` | rasterize the faces, or add a preset in the app repo |

In the brief, name the consumer and list exactly these files. In the hand-back, say which of them were produced and which still need the app repo's generator.

## Design rules (encoded lessons)

- **Seams were the biggest time sink.** A belt is ONE continuous panorama. Sky, ground and terrain colors are functions of position around the belt (cyclic blends); Up and Down take edge colors from the neighbors' top and bottom rows. Target: all 12 shared edges below 3/255 mean difference, Up/Down borders about 0. Design the seam colors in the concept sheet, before drawing.
- **One dominating object per face** (35-50 % of the face), calm non-empty composition. Rejected by the owner: scattered equal small items, empty centers, pale empty rings, fussy borders, corner icons.
- **Detail at 7x7 granularity.** Each 1/49 tile needs an anchor to place and to orient: story-bearing marks, no large empty skies without texture (stars, clouds, flat-band gradients, grass tufts), a hero that spans several tiles and has internal structure.
- **Detail and legibility:** every sticker needs detail >= 8 % (not flat). Rotation symmetry, identical stickers and rotation twins are acceptable (see the classification below) but still worth minimizing where it is cheap: they make the picture easier to confuse. Letter and number stickers need an unambiguous orientation hint.
- **Style:** flat vector, ONE ink color, three line weights, nothing outside the app's SVG allowlist (no gradients, filters, clipPath, `url()`, `<text>`, `<image>`, `<script>`, `href`, `style`). Pastel look: soft pastel fills, thin outlines, rosy cheeks, friendly faces. Original characters only.
- **File size:** a face with a full background grid is 100-200 KB if left raw. Budget: face <= 200 KB (warn), tile preview <= 30 KB (warn). Use the grid merge, quantization (`step`) and `{svg, bbox}` art; report measured sizes.

## Checker: Definition of Done

`node scripts/check-cube-set.mjs <dir> [--n N | --n-range A-B] [--strict-n 2] [--min-detail 0.08] [--tol 0.03] [--seam-mean 3] [--seam-segment 9] [--tile-tol 0.005] [--max-face-kb 200] [--max-tile-kb 30] [--size-fail] [--json path]`

Needs Playwright's Chromium (resolved from the repo, `CUBE_NODE_MODULES`, or `/opt/node-tools`; browser from `CHROMIUM_PATH` or `/opt/pw-browsers/chromium`). Prints one `RESULT: PASS|FAIL` line, writes `tiles.json` (default `<dir>/tiles.json`). Exit codes: 0 PASS, 1 FAIL, 2 usage or environment error (unknown option, non-numeric or out-of-range number, `--n 8`, missing directory, no browser).

- **Hard failures (exit 1):** a face, tile file or `net.svg` that the app's SVG validator would reject (allowlist above, integer width/height <= 1024, <= 262144 bytes); wrong face format or size; the 12 edge seams (3 px band; mean <= 3/255, big-pixel share <= 10 %, and no sticker segment at the largest N examined above 9/255); a tile file that differs from the face crop; flat stickers (detail < 8 %) at a strict N.
- **Warnings:** size budget (face 200 KB, tile 30 KB), face size not divisible by N, style audit (one ink, three weights), flat stickers at a non-strict N, and "no strict N among the examined sizes" (for example `--n 3` alone). N = 2 is strict by default; strictness for N >= 3 is an open owner decision.
- **Information, never a failure** (per N, `perN.<N>.classification` in the json, module `src/symmetry.mjs` which calls `packages/cube-appearance` at its loose level, `version: 1`): per sticker the symmetry order `none`, `2-fold`, `4-fold` (share of pixels changing under a 90/180 degree turn at most `--tol`, default 3 %; `--sym-tol` and `--dup-tol` are aliases); identical groups (stickers whose upright pictures differ in at most `--tol` of their pixels, measured on a downsampled probe, grouped by complete linkage so a chain A~B~C never pulls in C when A and C differ); rotation-twin groups (equal only after a quarter turn); and for odd N the six fixed center stickers with `orientationNeeded: false` when they are 2-fold or 4-fold symmetric. The classifier itself is `packages/cube-appearance` (owner decision D8, [docs/CUBE_APPEARANCE.md](../../../docs/CUBE_APPEARANCE.md)); the suitability display calls the same package.

The classification tells the owner how many stickers are interchangeable; it does not reject a theme. Read the counts, look at the groups, and only redraw where a duplicate is cheap to avoid.

## Variant fan-out protocol

- Rule: **two variants per open question** (a question is e.g. "planet heroes or object heroes", "Up face A or B"). Never one, never three.
- Folders: `<theme>/<variant>/` with `<variant>` = `<group>-<a|b>` (`b-a`, `b-b` for belts, `u-a`/`u-b` Up, `d-a`/`d-b` Down). Each variant folder holds its current build; earlier builds sit in `v1/`, `v2/` of that folder. Rebuild in place.
- Compare: `node scripts/make-variant-sheet.mjs <theme> --variants b-a,b-b` (or `--before dirA --after dirB`) renders both nets side by side with an empty rating table and writes `<theme>/ratings.md` (`templates/ratings.md`).
- Rate every variant 1-5 for legibility, story, charm, calm, plus overall; name the winner and the reason.

## Independent review (mandatory before every hand-back)

Start a separate agent with `templates/review-prompt.md`. It must not trust the author, runs the checker itself, views the sheet, and lists findings only (no fixes). Address or list every finding in the hand-back. No hand-back without this step.

## Hand-back

Use `templates/handback.md`: checker result and per-N table (symmetry classes, identical groups, rotation twins, centers), measured sizes, seam worst case, 1-5 self-rating (legibility, story coherence across edges, charm/consistency, calm vs busy), honest weaknesses, verified vs unverified (N > 2 is always unverified until a real set has been produced and reviewed), open owner questions. No session links in any text.

## Files

`src/` library, `scripts/check-cube-set.mjs`, `scripts/sketch-sheet.mjs`, `scripts/make-variant-sheet.mjs`, `templates/` (brief, handback, review-prompt, ratings, concept example), `examples/` (demo theme + build command), `reference/cube-sizes-2-to-7.md`, `tests/`.
