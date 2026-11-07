# Cube sizes 2x2 to 7x7

Status: **only 2x2 has been produced and verified** (the Pastel Garden set and the theme branches). Every statement about N > 2 below is **unverified, based on a synthetic test** of the tooling (the demo theme), not on a produced and reviewed set.

## How the size is handled

- A theme is six whole faces (`U L F R B D` as square svg), a `net.svg` and a manifest. The faces do not know N.
- The app slices each face into N x N stickers (`F_r_c`, `r` = row, `c` = column, 0-based). The same faces must therefore work at N = 2, 3, 4, 5, 6 and 7. Which consumer needs extra files is listed under "Consumers" in `SKILL.md`: the 2x2 playground loads 24 tile files plus a sha256 manifest, the theme stack ships faces only (manifest from `scripts/build-playground-theme.mjs` on that branch, 320 px faces), and the 3x3 `picture3` page takes raster uploads only.
- Sticker counts: 2x2 = 24, 3x3 = 54, 4x4 = 96, 5x5 = 150, 6x6 = 216, 7x7 = 294 (unverified for N > 2; arithmetic only: 6 * N * N).
- Use a face size every N divides: 420 px (lcm of 2..7). Legacy 320 px faces are not divisible by 3, 6 or 7 (fractional tile pixels; the checker warns).
- Tile files can be written with `theme.build(dir, { previewN: [2, 7] })` (`tiles/n2/`, `tiles/n7/`): they are checking previews, and the real tile files of a 2x2 playground set only when the consumer needs them. Tile width and height must be integers (the app's SVG validator), so the build throws when N does not divide the face size.

## Design consequence: detail at 1/49 granularity

At 7x7 every tile is 1/49 of a face (60 px of 420). Each tile must still carry something to place and something to orient:

- anchors per tile (small story-bearing marks: stars, clouds, birds, flowers, grass tufts), not one uniform scatter;
- no large empty skies: texture via stars, clouds, flat-band gradients, tufts;
- the hero object spans several tiles and has internal structure (spots, folds, patterns); a flat-filled hero produces many flat tiles at N >= 4 (the demo build showed exactly this before its hero got interior marks).

## Checker behavior (`check-cube-set.mjs`)

Default `--n-range 2-7`. Hard failures are only: constructs outside the app's SVG allowlist (faces, tile files and `net.svg`), face format and size, edge seams, tile files that differ from the face crop, and flat stickers (detail below 8 %) at a strict N. N = 2 is strict by default (`--strict-n 2,3,...` makes more sizes strict); flat stickers at other N are warnings, and the run warns when no examined N is strict.

For every N the checker only CLASSIFIES (`perN.<N>.classification`, module `src/symmetry.mjs`, an adapter over `packages/cube-appearance`, JSON `version: 1`):

- per sticker symmetry order `none`, `2-fold`, `4-fold` (a 90 or 180 degree turn changes fewer than 3 % of the pixels);
- identical groups (duplicate stones) and rotation-twin groups, found by distance (share of pixels over the pixel threshold on a downsampled probe, at most 3 %, complete linkage), so a sub-pixel shift or antialiasing does not hide a duplicate;
- for odd N the fixed center sticker of each face; a 2-fold or 4-fold symmetric center is reported as "no orientation needed" (`orientationNeeded: false`); `period` gives the exact rule (solved modulo 4, 2 or 1 quarter turns).

None of this fails a run: the owner accepts equal-looking stickers and orientations (the cube then counts as visually solved). The numbers are for the hand-back and for the app's suitability display, which calls the same package.

## Synthetic test (unverified for real cubes)

`node .agents/skills/picture-cube-faces/examples/build-demo.mjs <dir>` and the checker on it: the demo faces pass at N = 2..7 with every sticker asymmetric and unique. This shows that the tooling works for all sizes. It says nothing about how a real themed set looks or plays at N > 2.

## Owner decisions

Decided:

1. **Ambiguity is acceptable.** Equal-looking orientations and duplicate stones are accepted: the cube counts as visually solved. The checker classifies them and does not fail on them.
2. **Symmetric centers need not be turned.** On odd N (3, 5, 7) a 2-fold or 4-fold symmetric center sticker is reported as "no orientation needed". This is a new rule. [`docs/SUPER_PICTURE_CUBE.md`](../../../../docs/SUPER_PICTURE_CUBE.md) describes the existing 3x3 picture cube, whose exact-solved test counts all six center orientations, and so predates it (the doc now states the current rule); the suitability display already reports it through the package; the solved test and solver must still adopt it (`packages/cube-appearance`). Even N >= 4 has movable center blocks and no single center; the 2x2 has no centers.

Open:

3. **Hero and centers.** Should the hero be centered on the odd-N center piece, and may a center carry a near-symmetric motif? (Allowed under rule 2; a decision is needed only for composition.)
4. **Strictness for N >= 3.** Currently flat stickers at N >= 3 are warnings. Decide whether N = 3 (or all N) must have zero flat stickers.
5. **Legacy 320 px faces.** Re-export at 420 px, or accept fractional stickers at N = 3, 6, 7 (the theme stack's `build-playground-theme.mjs` requires 320 px faces).
