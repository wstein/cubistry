<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Wide and inner-wide block moves: how many moves does the 7x7 calendar cube need?

**Status: research measurement, read-only. No change to the solver, the chain
data, the app or `.github`.** Base: branch `research/cube-display-feasibility`
(head `f7688f78`). Everything below is **Julia only** (`wide_blocks.jl`, Julia
1.10.5); Flix was not run. Marks: **[V]** verified by the script (output in
`evidence/`), **[I]** inference, **[D]** deferred.

## Question

Today a word is a product of generators 1..21 and every layer turn costs one
move. Consecutive turns of adjacent layers of one axis with the same angle can
be merged into one block turn ("wide" if the block contains an outer layer,
"inner wide" if it consists of inner layers only). How many block moves do the
existing words need?

## Existing definitions [V by reading the code]

- Generators `g = 7*axis + slot` (`engine.ts`; `verify_moves.jl`): axis x, y, z;
  slots 1..6 turn the layers -3, -2, -1, +1, +2, +3 (selected by `pos[axis] == layer`),
  slot 7 (g = 7, 14, 21) turns the whole cube. There is no generator for layer 0.
- One positive quarter turn is the **same lab rotation for every layer of an axis**
  ((x,y,z) to (x,-z,y) about x, (z,y,-x) about y, (-y,x,z) about z). So two layers
  with the same exponent turn the same way; "equal angle" needs no face-relative
  sign flip. A negative generator `-g` is three quarter turns; the app stores
  `(g, q)` with `q` in -1, 1, 2.
- HTM in `verify_moves.jl` (`htm`): adjacent equal generators are merged first
  (stack: net quarter turns mod 4, a net 0 disappears and the neighbours can merge
  again), then every remaining non-rotation group counts 1 (a half turn counts 1),
  whole-cube rotations count 0. `engine.ts metrics()` counts every `(g, q)` entry
  (no merging); on the 576 old chain edges both give 75433, so those words have no
  adjacent equal generators. QTM = quarter turns (1 or 3 exponent = 1, 2 = 2).
  There is no other run-length or stack reduction in the repo that I found.
- Layer geometry [V] (`evidence/layer-geometry.txt`): the slabs `pos[axis] = -3..3`
  hold 77, 28, 28, 28, 28, 28, 77 stickers on each axis, so **layer 0 exists
  physically** (28 stickers, like every inner layer), it is just never turned alone.
  218 surface bodies. A block of adjacent layers is contiguous in the physical order
  -3..+3 including layer 0, so -1 and +1 are **not** adjacent. Generators 1..21 equal
  the slab turns of my own geometry for all 18 layer generators.

## Rules (each is a separate column)

All rules work per **maximal same-axis run** (a run ends at a move of another axis,
which does not commute). Rotations of the same axis belong to the run and commute.
Blocks are always contiguous intervals of the physical layers; a block over all 7
layers is a free whole-cube rotation.

| rule | what is allowed | blocks may contain layer 0 | free rotation used to complement |
|---|---|---|---|
| r0 | baseline: net per layer after commuting and cancelling, no merging | no | no |
| a | merge only **adjacent** (as written) equal-angle layer turns whose layers form a contiguous set | no | no |
| b | in addition reorder inside the run, add up angles per layer (cancel opposite turns), group maximal contiguous equal-angle layers (the cheaper of a and this) | no | no |
| cn | exact minimum cover of the net per-layer vector by arbitrary angle intervals (nested blocks, e.g. angles 1,2,1 = one 3-block plus one inner turn), still no layer 0 | no | no |
| c | like cn, but intervals may contain layer 0 and the full interval is free: "rotation plus inverse complementary block" | yes | yes |

Metrics: **HTM-like** = every block turn (90, 180, 270) counts 1; **QTM-like** =
quarter turns (a block of 180 counts 2). Both are optimized separately (the cost
of the interval cover differs). Ties are broken by the narrowest total width.
Columns marked `W` keep the word's frame; `F` pushes every whole-cube rotation to the
end (conjugating the later layer turns) before the same rules; this changes
nothing measurable (see below), so the tables show `W`.

## Semantic preservation [V] by construction and by independent replay

By construction (all group identities, comments in `wide_blocks.jl`): merging equal
generators; same-axis layer turns commute; a block is the product of its disjoint
layer turns; the full block is the rotation, hence block(lo..hi) = rotation times
the inverse complement (the form used to expand blocks that contain layer 0 back to
generators 1..21); the frame trick `R m = (R m R^-1) R`.

Independent check on **every word and every rule/metric/mode** (5 rules x 2 metrics
x 2 modes = 20 transformed words per input word): the state digest (SHA-256 of
the 294-sticker state text of `verify_moves.jl`) of
(1) the original word (existing `verify_moves.jl` `apply_word`),
(2) the blocks applied as direct slab turns (own geometry in `wide_blocks.jl`),
(3) the blocks expanded to generators 1..21 and replayed with the existing
`apply_word`
are equal. Result: **ALL_DIGESTS_EQUAL**, 0 mismatches over 91 + 98 + 4 + 4 + 576
= 773 words (`evidence/run.log`). The digests of the 91 root words also equal the
digests in `../upright-moves/evidence/verify-moves.tsv` (0 differences), which ties
this to the accepted strict-front replay. Edge and chain words start from other
states in real life; a word is a group element and the 294 stickers are all distinct,
so equality of the final state from the solved cube is equality of the words
(the same argument as `crosscheck_library.jl`). Negative controls
(`evidence/negative-controls.tsv`): dropping the last block, adding 90 degrees to the
first block, widening the last block each broke the digest in 20 of 20 words.

## Results (rule columns, `W` mode, optimal under the stated rule) [V]

Cells: min / median / mean / max / **total** of the per-word move count.
`base` = existing definition (HTM merged adjacent generators; QTM likewise).

**moves91**

| rule | HTM-like: min / med / mean / max / total | QTM: min / med / mean / max / total |
|---|---|---|
| base | 389 / 447.0 / 446.62 / 489 / **40642** | 398 / 462.0 / 459.12 / 502 / **41780** |
| r0 | 385 / 447.0 / 444.48 / 487 / **40448** | 396 / 460.0 / 457.87 / 502 / **41666** |
| a | 324 / 361.0 / 360.04 / 392 / **32764** | 332 / 375.0 / 372.53 / 405 / **33900** |
| b | 322 / 360.0 / 359.01 / 392 / **32670** | 331 / 373.0 / 371.79 / 405 / **33833** |
| cn | 322 / 360.0 / 359.01 / 392 / **32670** | 331 / 373.0 / 370.96 / 403 / **33757** |
| c | 303 / 337.0 / 337.32 / 366 / **30696** | 312 / 350.0 / 348.93 / 377 / **31753** |

**edges98**

| rule | HTM-like: min / med / mean / max / total | QTM: min / med / mean / max / total |
|---|---|---|
| base | 17 / 115.0 / 112.92 / 156 / **11066** | 20 / 141.0 / 135.37 / 187 / **13266** |
| r0 | 17 / 115.0 / 112.92 / 156 / **11066** | 20 / 141.0 / 135.37 / 187 / **13266** |
| a | 16 / 96.0 / 91.21 / 124 / **8939** | 19 / 117.0 / 112.43 / 145 / **11018** |
| b | 16 / 96.0 / 91.21 / 124 / **8939** | 19 / 117.0 / 112.43 / 145 / **11018** |
| cn | 16 / 96.0 / 91.08 / 124 / **8926** | 19 / 115.0 / 110.79 / 141 / **10857** |
| c | 15 / 91.0 / 86.21 / 115 / **8449** | 18 / 109.0 / 105.56 / 139 / **10345** |

**smoke-orbit4**

| rule | HTM-like: min / med / mean / max / total | QTM: min / med / mean / max / total |
|---|---|---|
| base | 270 / 436.0 / 401.0 / 462 / **1604** | 280 / 447.0 / 412.0 / 474 / **1648** |
| r0 | 266 / 435.5 / 398.25 / 456 / **1593** | 278 / 447.0 / 410.5 / 470 / **1642** |
| a | 229 / 348.5 / 320.5 / 356 / **1282** | 239 / 359.5 / 331.5 / 368 / **1326** |
| b | 227 / 348.5 / 319.75 / 355 / **1279** | 238 / 359.5 / 330.75 / 366 / **1323** |
| cn | 227 / 348.5 / 319.75 / 355 / **1279** | 237 / 359.0 / 330.25 / 366 / **1321** |
| c | 218 / 324.5 / 299.75 / 332 / **1199** | 228 / 335.5 / 310.25 / 342 / **1241** |

**smoke-beam4**

| rule | HTM-like: min / med / mean / max / total | QTM: min / med / mean / max / total |
|---|---|---|
| base | 105 / 117.0 / 120.25 / 142 / **481** | 131 / 144.0 / 146.0 / 165 / **584** |
| r0 | 105 / 117.0 / 120.25 / 142 / **481** | 131 / 144.0 / 146.0 / 165 / **584** |
| a | 91 / 95.0 / 97.75 / 110 / **391** | 117 / 120.0 / 122.5 / 133 / **490** |
| b | 91 / 95.0 / 97.75 / 110 / **391** | 117 / 120.0 / 122.5 / 133 / **490** |
| cn | 91 / 95.0 / 97.75 / 110 / **391** | 116 / 119.5 / 121.5 / 131 / **486** |
| c | 86 / 90.0 / 91.75 / 101 / **367** | 109 / 116.0 / 116.0 / 123 / **464** |

**chain576**

| rule | HTM-like: min / med / mean / max / total | QTM: min / med / mean / max / total |
|---|---|---|
| base | 14 / 134.0 / 130.96 / 471 / **75433** | 16 / 162.0 / 157.5 / 486 / **90719** |
| r0 | 14 / 134.0 / 130.96 / 471 / **75433** | 16 / 162.0 / 157.5 / 486 / **90719** |
| a | 13 / 99.0 / 97.37 / 375 / **56083** | 15 / 123.0 / 118.85 / 390 / **68458** |
| b | 13 / 99.0 / 97.37 / 375 / **56083** | 15 / 123.0 / 118.85 / 390 / **68458** |
| cn | 13 / 99.0 / 97.08 / 375 / **55920** | 15 / 120.0 / 116.63 / 390 / **67177** |
| c | 13 / 93.0 / 91.31 / 351 / **52594** | 15 / 113.0 / 109.94 / 366 / **63328** |

Reductions of the total (HTM-like): root words 40642 to a 32764 (-19.4%), b 32670
(-19.6%), cn 32670, c 30696 (-24.5%). Edge words 11066 to 8939 (-19.2%) and 8449
(-23.6%). Orbit smoke 1604 to 1282 and 1199 (-25.2%), beam smoke 481 to 391 and 367
(-23.7%). Old chain 75433 to 56083 (-25.6%) and 52594 (-30.3%). QTM-like totals fall
by almost the same share (roots 41780 to 33900 and 31753).

Words with at least one merge (cost below base, rule a / rule c): roots 91/91 and
91/91; edges 94/98 and 94/98 (95 in QTM); orbit smoke 4/4; beam smoke 4/4; chain
566/576 and 570/576. Words with at least one block of width 2 or more in the
c-plan: roots 63, edges 93, orbit smoke 3, beam smoke 4, chain 565.

Reading the roots: cancelling alone (r0) saves 194 (0.5%); adjacent merging (a)
saves 7684 more; reordering (b) 94; nested intervals (cn) 0 in HTM; rule c a
further 1974 (4.9% of base). The frame trick (`F`) gives the same totals as `W` in every cell except
roots a/b in QTM (F worse by 25 and 26 of about 33900) and the orbit smoke (1 move
either way): whole-cube rotations rarely sit between runs that would merge. The
summary rows for `F` are in `evidence/summary.tsv`.

### Block shares (HTM-optimal plan, free rotations not counted as moves)

Width / category counts are in `evidence/block-classes.tsv` (columns w1..w6,
outer1 = single outer layer, inner1 = single inner layer or layer 0 slice,
outer_wide, inner_wide, blocks_with_layer0).

| set, rule | blocks | width 1 | width 2 | width 3 | width 4-5 | outer-wide | inner-wide | blocks touching layer 0 |
|---|---|---|---|---|---|---|---|---|
| roots, a | 32764 | 87.8% | 0.3% | 11.9% | 0 | 12.0% | 0.1% | 0 |
| roots, c | 30696 | 99.6% | 0.2% | 0 | 0.3% | 0.2% | 0.3% | 2051 (6.7%) |
| edges, a | 8939 | 85.5% | 5.2% | 9.3% | 0 | 12.1% | 2.4% | 0 |
| edges, c | 8449 | 94.7% | 4.7% | 0.1% | 0.5% | 2.7% | 2.6% | 523 (6.2%) |
| chain, a | 56083 | 75.7% | 14.2% | 10.2% | 0 | 18.6% | 5.7% | 0 |
| chain, c | 52594 | 84.6% | 14.5% | 0.4% | 0.6% | 8.8% | 6.6% | 3574 (6.8%) |

Interpretation [I from the counts]: the gain of a/b/cn is mostly 3-wide blocks
(-3..-1 or +1..+3) and, in the old chain, 2-wide blocks. In rule c the wide blocks
almost vanish because they are replaced by **one layer-0 slice turn** (or a rotation):
the six layers except the middle one turned alike, `7,-1,..,-6`, is one middle-slice
move plus a free rotation. Rule c therefore needs a turnable middle layer as a move
type of its own.

Run structure (`evidence/run-structure.tsv`): in the root words 29552 same-axis
runs, 26494 (90%) are a single layer turn; runs with 2 or more layer turns carry 14148 of
40642 turns (34.8%), 1837 runs of 6 (the 6-layer sweep, 27.1% of all turns) account for most
of it. Old chain: 14224 of 47200 runs and 56.3% of the turns are in runs of 2 or more.

## Potential upper bound

Rule c is the exact minimum per run for rewriting of the existing words without
changing the order of moves of different axes: about **24% fewer** moves on the roots
and edges and 30% on the old chain, in both HTM-like and QTM-like counting. No
rewriting of these fixed words can beat it **[V as a minimum under the model]**.
A solver that searches in a block alphabet could find different, shorter words;
that is not measured here.

## What is verified and what is inferred

- [V] Layer numbering, same-direction rotation, physical existence of layer 0.
- [V] The block counts, for all 773 words, with three-way digest equality.
- [V] The minima are exact for the stated rule sets (Dijkstra over the 4^7 states
  of one axis, plus the DP of rule a).
- [I] That a layer-0 slice turn is an acceptable move in the app and for a
  person: the engine has no such generator; rule c leaves the existing alphabet.
- [I] The old chain edges start from other states; equivalence is argued by
  group element, not replayed from those states.
- [D] Wide-aware macro search, a wide-move animation in the app, the strict
  863-edge chain (not started).

## Recommendation

1. **Yes, show the block count as a second metric column** (next to HTM and QTM)
   and compute it with rule b for the existing alphabet (no layer 0): it is exact,
   mechanical, needs no solver change, and lowers the printed numbers by about 19%
   (roots 447 to 360 median, old chain 134 to 99). Name it a block-turn metric and
   keep HTM unchanged for continuity.
2. **Wide notation in the app: worth it for outer-wide blocks** (12% of blocks in
   rule a on the roots, 18.6% in the old chain), where one wide turn is one
   physical gesture. Inner-wide blocks and layer-0 slices (rule c) need a decision
   on whether the middle slice counts as a move.
3. **Wide-aware macros in the solver: not recommended yet.** Most structure that
   merges (the 6-layer sweep, 27% of the root turns) is already picked up for free
   by post-processing the existing words; 90% of the same-axis runs are single turns,
   which no block alphabet can merge. A larger alphabet multiplies the
   branching: per axis 27 block intervals times 3 angles = 81 non-rotation moves
   against 18 now, 4.5 times as many, on top of the 673,464 macros. Whether the
   search would find shorter words is **not measured** and I cannot justify a
   number from this run structure; the free post-processing gain (19% to 24%) is
   the only solid figure. If the owner wants a trial, first re-score the existing
   macro library with the block count (cost change only, no new alphabet) and see
   whether the beam choices change.

## Reproduce

```sh
cd research/calendar-7x7/wide-blocks
git show origin/main:data/calendar7/research/chain-2028-2076.moves.tsv > /tmp/chain.tsv   # sha256 34925dac...a88e0
julia --startup-file=no wide_blocks.jl RUN evidence /tmp/chain.tsv   # about 2.5 min
julia --startup-file=no wide_blocks.jl GEOM evidence/layer-geometry.txt
julia --startup-file=no wide_blocks.jl WORD "7,-1,-2,-3,-4,-5,-6,-20,6"   # one word, all rules
```

Block notation: axis letter, layers in -3..3 (`[0]` the middle layer, `[all]` a whole
cube rotation), then `+` 90, `2` 180, `-` 270 degrees (positive = engine quarter turn),
e.g. `x[-3..-1]-`. `evidence/words-*.tsv` hold the per-word counts for both modes and
the rule-c plan of each root, edge and smoke word.
