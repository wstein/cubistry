# German A without a leading zero

Status: **UNKNOWN** until an independent review. Julia and Flix replays agree, but no
independent reviewer has accepted them (`research/date-3x3/independent/` is not extended here).

Question: German A (`de-2`; weekday, day, month rows; day row blank, tens, units; tens digit on
the front center; centers `0 1 2 3` plus two blank centers) has only the leading-zero witness.
Can the same physical print also show days 1 to 9 without the zero?

## Results

1. **Yes, directly.** The existing generator, run with its `unpadded` mode on the unchanged print,
   produces 2,562 targets ([witnesses/de-2-unpadded.json](witnesses/de-2-unpadded.json)). The
   print (54 stickers, all fields) is identical to `witnesses/de-2.json`. A blank center is put on
   the front, so no center correction is needed: outer HTM 16 to 41, sum 76,321 (mean 29.79),
   against 86,362 (mean 33.71) for the padded witness. Nobody had generated it; nothing in the
   print prevents it.
2. **The owner's idea works.** In the padded state of days 1 to 9 (all 756 targets use the prelude
   `y y y`) the centers are F=`0` (upright), D=`1`, L=`2`, R=`3`, **U and B blank**. A pure center
   word turns U or B to the front and leaves every corner and edge sticker unchanged (position,
   orientation, 48 stickers). Checked on all 756 targets; days 10 to 31 are not touched.
3. **Slice words** (M, E, S; metric: number of slice turns / quarter turns):
   - none with at most 3 slice turns, in either metric (exhaustive: 9, 81, 729 words; and BFS to
     cost 6 and 8);
   - **4 is the minimum** in both metrics. Quarter-turn words: `M E M' E'` and `M E' M' E`
     (cycle (U F L)(R B D)), `E S E' S'`, `E' S' E S`, `S M' S' M`, `S' M' S M`. With half turns:
     `M2 E M2 E'`, `E2 M E2 M'` and others (4 slice turns, 6 quarter turns). 48 of the 6,561
     four-turn words are pure center words, 22 of them bring a blank center to the front
     ([results/w-check.report](results/w-check.report), lines `SLICEWORD`). The owner's 4 and the
     upper bound 6 are correct.
   - Proof of the lower bound: slices act on disjoint edge sets (M: UF UB DF DB; E: FR RB BL LF;
     S: UR RD DL LU) and never touch corners. A word restores all edges iff the exponent sum of each
     slice is 0 mod 4. A slice used once has a nonzero sum, so every used slice appears at least
     twice, and at least two different slices are needed to move centers: at least 4 turns.
4. **Outer turns plus whole-cube rotations.** Shortest word: **8 outer HTM + 1 rotation**
   (`B2 R L' D2 U2 R L' B2 x2`; also `y2` variants). With a diagonal 120 degree rotation: 8 outer HTM
   + 2 rotation moves (`B U' D L' R F' B U' z y`). Minimality of 8: exhaustive meet in the middle
   over all face-turn words up to length 10, for all 11 even rotations (56, 56, 56 and 8 x 21
   shortest words). 154 of those words bring a blank to the front.
5. **Not useful in practice.** W adds 8 outer + 1 rotation to a padded route, while the direct
   unpadded route is cheaper (result 1). W is useful only as a toggle between the two displays of the
   same date (8 + 1 against 17 + 2 for a planned toggle in the sample, see Transitions).

## Mathematical check

Model: 48 corner/edge stickers and 6 oriented centers; generators: 18 outer turns, 9 slice turns,
9 rotations. `V r` (face-turn word V, then rotation r) leaves all corners and edges unchanged iff
V acts on corners/edges as `r^-1`.

- Parity: corner parity + edge parity + center-permutation parity is even for each of the 36
  generators ([results/invariants.txt](results/invariants.txt), test `invariants`). Hence a pure
  center element has an even center permutation: (U F L)(R B D) and (F B)(L R) qualify, a single
  swap does not.
- Outer turns alone give equal corner and edge parity. Of the 24 rotations, 12 have equal parity
  (identity, 3 half turns, 8 diagonal 120 degree turns); `x`, `y`, `z` quarter turns do not
  (corners even, edges odd), so no face-turn word realizes them ([results/analysis.txt](results/analysis.txt), section A).
- Twist: the sum of center quarter-turn twists is even iff the corner permutation is even. Checked on
  all 36 generators and 3,000 random words (matches the handover statement); **not proven**. W has
  corner permutation identity and an even twist sum.
- Existence is shown by the explicit words, replayed; the invariants only explain which rotations can occur.

## Consequences and transitions

After W, glyph `0` sits at B with up `(0, -1, 0)` for all 756 targets, so the chain state is a
second center arrangement B (same corners and edges). Routes from the home print do not apply to B;
a route from B is planned as from any state (`plan-transitions.mjs`, solver ignoring centers,
hidden pieces completed arbitrarily, so costs are samples, not optima).

Sample (route state of the day as source; outer HTM / rotations, from
[results/transitions-sample.verify.txt](results/transitions-sample.verify.txt)). P: padded to padded, U: direct
unpadded to unpadded, W: padded route plus W (source includes W when the day is below 10; the
target adds 8 + 1 when it is below 10).

| Change | P | U | W (without W itself) |
| --- | --- | --- | --- |
| 8 to 9 | 40 / 0 | 20 / 0 | 38 / 2 + W |
| 9 to 10 | 38 / 1 | 20 / 2 | 37 / 3 |
| 10 to 9 | 40 / 3 | 20 / 1 | 40 / 3 + W |
| 28 to 29 (Feb 2028) | 19 / 0 | 19 / 0 | 19 / 0 |
| 30 to 1 (Apr to May) | 38 / 4 | 18 / 1 | 38 / 4 + W |
| 31 to 1 (Jan to Feb) | 20 / 3 | 15 / 1 | 20 / 3 + W |
| 31 to 1 (Mar to Apr) | 37 / 4 | 19 / 1 | 37 / 4 + W |
| 31 to 1 (Jul to Aug) | 40 / 3 | 20 / 1 | 40 / 3 + W |

W or W^-1 is needed whenever the target day crosses 10 (to or from 1 to 9 in the owner's scheme).
The planned 9 to 10 and 10 to 9 routes absorb the change in the route itself.
Every consecutive day pair of 2027 (1,092 jobs, all replay-checked): [results/transitions-2027-summary.txt](results/transitions-2027-summary.txt).
Means over 364 pairs: days 2 to 9 after 1 to 8: P 27.0, U 19.1, W 36.0 outer HTM (W incl. W);
month change to day 1: P 35.6, U 19.5, W 43.6; 9 to 10: P 33.0, U 34.0, W 31.7; other days equal (25.3).

## Verification (all commands from the repository root)

```sh
J="julia --startup-file=no research/date-3x3/german-unpadded"
$J/test/runtests.jl                                                    # 77 tests incl. mutations
$J/verify_witness.jl research/date-3x3/german-unpadded/witnesses/de-2-unpadded.json unpadded
$J/verify_witness.jl research/date-3x3/witnesses/de-2.json padded
$J/verify_w.jl research/date-3x3/witnesses/de-2.json "B2 R L' D2 U2 R L' B2 x2"
$J/analysis.jl research/date-3x3/witnesses/de-2.json
FLIX_JAR=/path/to/flix-0.79.0.jar bash research/date-3x3/german-unpadded/flix/test.sh   # byte comparison + 4 mutations
```

Regenerate the new witness (existing generator, unchanged; `runtimeSeconds` differs per run):
`node research/date-3x3/generate-witness.mjs research/date-3x3/constructive/de-2.json NEW.json 2562 unpadded`.
Transitions: `transition-jobs.mjs` or `transition-jobs-year.mjs`, then `plan-transitions.mjs`,
`verify_transitions.jl`, `summarize_transitions.jl`.

`Cube.jl`, `Replay.jl` (Julia) and `flix/src/Main.flix` are separate implementations of the move
engine; Flix was written without reading the Julia sources and reproduces the three Julia reports
byte for byte. The generator geometry (`../geometry.mjs`) is used only for planning. Python is not used.
The lower bound 8 (outer HTM) and the slice minimum 4 are computed by Julia only; Flix repeats the
slice-word counts up to length 4 but not the meet-in-the-middle search.

## Not verified

No independent review. No physical print. Optimality of 8 depends on one Julia search. Transition costs
are single samples with arbitrary completions of hidden pieces. The twist-sum parity rule is not proven.
Application integration is not part of this study. The SHA-256 of the new witness (without
`runtimeSeconds`) is not pinned in `manifest.json`; existing pins are untouched.
