# Cube sizes 2x2 to 7x7

Status: **only 2x2 has been produced and verified** (the Pastel Garden set and the theme branches). Every statement about N > 2 below is **unverified, based on a synthetic test** of the tooling (the demo theme), not on a produced and reviewed set.

## How the size is handled

- A theme is six whole faces (`U L F R B D` as square svg), a `net.svg` and a manifest. It does NOT contain tile files and does NOT know N.
- The app slices each face into N x N tiles at runtime (`F_r_c`, `r` = row, `c` = column, 0-based). The same faces must therefore work at N = 2, 3, 4, 5, 6 and 7.
- Sticker counts: 2x2 = 24, 3x3 = 54, 4x4 = 96, 5x5 = 150, 6x6 = 216, 7x7 = 294 (unverified for N > 2; arithmetic only: 6 * N * N).
- Use a face size every N divides: 420 px (lcm of 2..7). Legacy 320 px faces are not divisible by 3, 6 or 7 (fractional tile pixels; the checker warns).
- Tile files can be written as preview artifacts: `theme.build(dir, { previewN: [2, 7] })` writes `tiles/n2/`, `tiles/n7/`. Do not ship them.

## Design consequence: detail at 1/49 granularity

At 7x7 every tile is 1/49 of a face (60 px of 420). Each tile must still carry something to place and something to orient:

- anchors per tile (small story-bearing marks: stars, clouds, birds, flowers, grass tufts), not one uniform scatter;
- no large empty skies: texture via stars, clouds, flat-band gradients, tufts;
- the hero object spans several tiles and has internal structure (spots, folds, patterns); a flat-filled hero produces many flat tiles at N >= 4 (the demo build showed exactly this before its hero got interior marks).

## Checker behavior (`check-cube-set.mjs`)

Default `--n-range 2-7`. For every N it reports tiles lacking detail, rotation-ambiguous tiles, groups of identical tiles and groups of rotation twins (identical up to a quarter turn). N = 2 is strict: any finding fails the run. N >= 3 findings are warnings (`--strict-n 2,3,...` makes more sizes strict; `--min-detail` and `--min-rot` change the thresholds).

## Synthetic test (unverified for real cubes)

`node .agents/skills/picture-cube-faces/examples/build-demo.mjs <dir>` and the checker on it: the demo faces pass at N = 2..7. This shows that the tooling works for all sizes. It says nothing about how a real themed set looks or plays at N > 2.

## Owner decisions needed

1. **Fixed center pieces.** On odd N (3, 5, 7) every face has one fixed center piece, and on even N >= 4 (4, 6) the centers form movable blocks; the 2x2 has no centers. Open: should the center sticker(s) be exempt from the uniqueness and rotation-difference rules (a center can only turn in place), should the hero be centered on the center piece, and may a center carry a near-symmetric motif? Until decided, the checker treats every sticker alike (stricter).
2. **Strictness for N >= 3.** Currently warnings. Decide whether N = 3 (or all N) must be clean, or which counts are acceptable.
3. **Rotation twins.** Tiles identical up to a quarter turn are reported; decide whether they are acceptable on larger cubes (many stickers make some repeats likely).
4. **Legacy 320 px faces.** Re-export at 420 px, or accept fractional tiles at N = 3, 6, 7.
