---
name: picture-cube-faces
description: Generate or refine picture-cube face sets (six whole square SVG faces U L F R B D, Pastel-style themes) that are sliced into NxN stickers at runtime for cube sizes 2x2 up to 7x7. Use when asked to create, extend, vary, check or review a themed face set with a belt panorama (L-F-R-B), Up/Down faces, seam-matching edges, tile legibility checks, concept sheets or variant comparisons. Only 2x2 is verified so far; N > 2 is unverified.
---
# Picture-cube faces

Build, check and review picture-cube themes: a belt L - F - R - B that reads as ONE panorama, plus Up and Down faces whose borders come from the belt. All code is Node ESM (no Python). Read the repo rules in `AGENTS.md` first; this skill does not override ADRs or specs. For SVG print rules also follow `.agents/skills/validate-artwork/SKILL.md`.

## What a theme is (read this first)

- **Deliverable = six whole faces** `U L F R B D` (`.svg`, square, `viewBox="0 0 S S"`, default S = 420) plus `net.svg` and a manifest (`build-report.json`, `tiles.json` from the checker).
- **Tile files are NOT shipped.** The app slices each face into N x N tiles at runtime (`F_r_c`, r = row, c = column). The same faces must work at N = 2, 3, 4, 5, 6, 7. Tile files are generated on demand as previews only: `theme.build(dir, { previewN: [2, 7] })`.
- Verification status: **2x2 is verified; N > 2 is unverified, based on a synthetic test.** See `reference/cube-sizes-2-to-7.md`, which also lists the open owner decisions (fixed center pieces on odd/even N, strictness for N >= 3).

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

- **Parameters:** face size S (not N). Scene coordinates are face pixels; `ctx.k = S / 320` scales line weights; `ctx.s` is the Pastel kit (`merged`, `happy`, `stroke`, `W` line weights); `ctx.horizonPath()` gives the ridge line.
- **Belt sampler** (`belt.mjs`): position `u` in [0, 4) around L-F-R-B; sky and ground come from four cyclic keyframes blended with a smoothstep, so B wraps into L; the horizon is a function of `u`. Edge pixels of neighboring faces sample the same `u`, so L|F, F|R, R|B, B|L match by construction.
- **Up/Down derivation** (`updown.mjs`): U takes its borders from the top rows of F, L, R, B (D from the bottom rows) and fills the interior with a Coons patch (optional calm center color), so all 8 edges touching U or D match by construction.
- **Writers** (`svg.mjs`): faces, net (standard cross: U above F; L F R B in a row; D below F), optional tile previews (viewBox crops named `F_r_c`), sticker frames and rounded fields for letter cubes.
- **Block alphabet** (`glyphs.mjs`): letters and digits as stroke paths, never `<text>`. Avoid symmetric glyphs (`SYMMETRIC_GLYPHS`) as the only orientation hint.
- **Compaction** (`compact.mjs`): background grids merge runs of equal color cells into rects; `compactSvg` merges touching equal rects. Lossless and measured (`build-report.json`, `artCompaction`). Art items may be `{svg, bbox}` so tile previews drop what lies outside the crop.
- **Keep the outer ~3 % rim of every face free of art** unless the art is continuous across the edge (a ridge line is).

Worked example (synthetic, a tooling test, not art): `examples/demo-theme.mjs`.

```
node .agents/skills/picture-cube-faces/examples/build-demo.mjs /tmp/demo --preview 2,7
node .agents/skills/picture-cube-faces/scripts/check-cube-set.mjs /tmp/demo
```

Generated demo output stays out of git (build into a temp dir). Unit tests: `node --test ".agents/skills/picture-cube-faces/tests/*.test.mjs"`.

## Design rules (encoded lessons)

- **Seams were the biggest time sink.** A belt is ONE continuous panorama. Sky, ground and terrain colors are functions of position around the belt (cyclic blends); Up and Down take edge colors from the neighbors' top and bottom rows. Target: all 12 shared edges below 3/255 mean difference, Up/Down borders about 0. Design the seam colors in the concept sheet, before drawing.
- **One dominating object per face** (35-50 % of the face), calm non-empty composition. Rejected by the owner: scattered equal small items, empty centers, pale empty rings, fussy borders, corner icons.
- **Detail at 7x7 granularity.** Each 1/49 tile needs an anchor to place and to orient: story-bearing marks, no large empty skies without texture (stars, clouds, flat-band gradients, grass tufts), a hero that spans several tiles and has internal structure.
- **Legibility under rotation:** every tile distinguishable by rotation (difference >= 3 %), detail >= 8 %, no identical tiles. Letter and number stickers need an unambiguous orientation hint.
- **Style:** flat vector, ONE ink color, three line weights, no gradients, filters, clipPath, `url()`, `<text>`, `<image>`, `<script>`, `href`. Pastel look: soft pastel fills, thin outlines, rosy cheeks, friendly faces. Original characters only.
- **File size:** a face with a full background grid is 100-200 KB if left raw. Budget: face <= 200 KB (warn), tile preview <= 30 KB (warn). Use the grid merge, quantization (`step`) and `{svg, bbox}` art; report measured sizes.

## Checker: Definition of Done

`node scripts/check-cube-set.mjs <dir> [--n N | --n-range A-B] [--strict-n 2] [--min-detail 0.08] [--min-rot 0.03] [--seam-mean 3] [--max-face-kb 200] [--max-tile-kb 30] [--size-fail] [--json path]`

Needs Playwright's Chromium (resolved from the repo, `CUBE_NODE_MODULES`, or `/opt/node-tools`; browser from `CHROMIUM_PATH` or `/opt/pw-browsers/chromium`). Prints one `RESULT: PASS|FAIL` line, writes `tiles.json` (default `<dir>/tiles.json`), exits 1 on FAIL. It checks forbidden constructs, face format, size budget, the 12 edge seams (per-sticker segment means in the json), and per N (default 2..7): tiles lacking detail, rotation-ambiguous tiles, identical-tile groups, rotation twins. N = 2 is strict. N >= 3 findings are warnings; strictness for N >= 3 is an open owner decision.

## Variant fan-out protocol

- Rule: **two variants per open question** (a question is e.g. "planet heroes or object heroes", "Up face A or B"). Never one, never three.
- Folders: `<theme>/<variant>/` with `<variant>` = `<group>-<a|b>` (`b-a`, `b-b` for belts, `u-a`/`u-b` Up, `d-a`/`d-b` Down). Each variant folder holds its current build; earlier builds sit in `v1/`, `v2/` of that folder. Rebuild in place.
- Compare: `node scripts/make-variant-sheet.mjs <theme> --variants b-a,b-b` (or `--before dirA --after dirB`) renders both nets side by side with an empty rating table and writes `<theme>/ratings.md` (`templates/ratings.md`).
- Rate every variant 1-5 for legibility, story, charm, calm, plus overall; name the winner and the reason.

## Independent review (mandatory before every hand-back)

Start a separate agent with `templates/review-prompt.md`. It must not trust the author, runs the checker itself, views the sheet, and lists findings only (no fixes). Address or list every finding in the hand-back. No hand-back without this step.

## Hand-back

Use `templates/handback.md`: checker result and per-N table, measured sizes, seam worst case, 1-5 self-rating (legibility, story coherence across edges, charm/consistency, calm vs busy), honest weaknesses, verified vs unverified (N > 2 is always unverified until a real set has been produced and reviewed), open owner questions. No session links in any text.

## Files

`src/` library, `scripts/check-cube-set.mjs`, `scripts/sketch-sheet.mjs`, `scripts/make-variant-sheet.mjs`, `templates/` (brief, handback, review-prompt, ratings, concept example), `examples/` (demo theme + build command), `reference/cube-sizes-2-to-7.md`, `tests/`.
