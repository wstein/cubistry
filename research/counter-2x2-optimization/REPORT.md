# Move-optimized 00–99 counter with a fixed upper title

**SAT:** one permanent 24-sticker print supports every value from **00 through 99**, with two upright title fragments above and two upright decimal digits below. Every stored ±1 edge uses at most **5 HTM**. Global print optimality remains **UNKNOWN**.

## Scope

This is the original counter configuration: upper-left and upper-right stickers reconstruct a fixed title; lower-left is tens and lower-right is units. Values 00–09 have a leading zero. All cubies may move and intermediate displays need not be readable. The title returns upright after each completed step; permanently fixed upper cubies are not required. 00 and 99 are endpoints: clamp or reject out-of-range operations. No 99→00 wraparound or arbitrary jump optimization is certified.

The title identities remain exactly `title-left` and `title-right`, with two physical copies of each. The printable sample says **COUNTER**, split into two immutable image halves. Any other fixed title split into the same two square images has the same combinatorial proof if the up frames and copy locations are preserved. The prior application’s dynamic title text and runtime assets are not modified.

## Move statistics

HTM counts quarter, inverse, and half face turns as one move. QTM counts a half turn as two. Whole-cube regrips are not free moves. Setup is excluded from the following 99-edge statistics. Increment and decrement counts are identical because edges are reversed exactly.

| Metric | Optimized route |
| --- | ---: |
| Displays / adjacent edges | 100 / 99 |
| HTM minimum / median / p95 / maximum | 1 / 3 / 5 / 5 |
| Mean HTM | 3.424 |
| Total HTM, one full traversal | 339 |
| Mean / maximum QTM | 4.222 / 8 |
| Total QTM | 418 |

| Transition class | Edges | Min HTM | Mean HTM | Max HTM |
| --- | ---: | ---: | ---: | ---: |
| units only | 90 | 1 | 3.367 | 5 |
| tens rollover | 9 | 2 | 4.000 | 5 |

HTM histogram: `{1: 6, 2: 8, 3: 40, 4: 28, 5: 17}`. Half turns: 79. Face-turn usage: `{'B': 79, 'D': 14, 'F': 7, 'L': 6, 'R': 142, 'U': 91}`.

## Baseline comparison

| Route | Worst HTM | Total HTM | Mean HTM |
| --- | ---: | ---: | ---: |
| Initial print, direct shortest paths with tie policy zero | 6 | 461 | 4.657 |
| Selected print and tie policy | 5 | 339 | 3.424 |
| Prior raw source-hub concatenation | 20 | 1892 | 19.111 |

Total HTM falls **26.46%** relative to the direct baseline. This combines print changes and route tie choices; it is not an isolated estimate of the print’s contribution. The legacy hub comparison is raw inverse/forward concatenation without cancellation, not a competitive shortest-path baseline. Both baseline statistics are independently checked.

## Fixed print and assembly

[Printable vector source net](counter-print.svg) · [All sticker positions and rotations](stickers.csv) · [Every increment and decrement word](transitions.csv)

| Cubie | Three permanent sticker identities |
| --- | --- |
| 0 | TL:title-left, DT:9, DT:7 |
| 1 | TL:title-left, DT:2, DT:5 |
| 2 | DT:0, DT:8, DT:6 |
| 3 | DT:3, DT:4, DT:1 |
| 4 | TR:title-right, DU:1, DU:6 |
| 5 | TR:title-right, DU:7, DU:3 |
| 6 | DU:5, DU:9, DU:2 |
| 7 | DU:4, DU:8, DU:0 |

TL/TR = title-left/title-right; DT/DU = digit tens/units. There are 20 digit stickers plus four title-fragment stickers. Every digit 0–9 occurs once in each numeric slot. Only digit assignments within those slots were searched; cubie groups, title stickers, and the upright-frame stencil were retained.

The SVG uses original vector strokes for digits and the sample title, with permanent asymmetric markers to define upright. The title is printed on the stickers, never overlaid across the cube. The four title stickers carry two identical left copies and two identical right copies, with clipping at the permanent center split. The net shows outward source-state faces: U above F, L/F/R/B across, D below F. Stickers are sample **20 mm squares**, with a 20 mm calibration line. Scale uniformly for the physical cube. Print at 100%, preserve the face arrangement, and then initialize the cube. No bleed or rounded-corner allowance is included. Printer fit and physical assembly have not been tested.

## Initialization and use

- Exact canonical 00 setup from the printed source: `U2 F' L U' R'` (5 HTM).
- Exact canonical 99 setup: `F U' R' U F2 U2 L F' L2 U2` (10 HTM).

Setups are independently replayed, including all hidden sticker frames. The 99 setup uses the pinned complete-state solver and is not claimed shortest. From canonical 00, follow the increment CSV; from canonical 99, follow the decrement words in reverse row order. Reversing any edge restores its exact previous full state, so mixed ±1 navigation is consistent. An arbitrary visually matching cube state need not have the required hidden arrangement.

Worst-case examples (all 99 edges are in the CSV):

- `00 → 01`: `R2 B' U2 B' U2`; reverse: `U2 B U2 B R2`.
- `09 → 10`: `R' B2 R B' D'`; reverse: `D B R' B2 R`.
- `16 → 17`: `U2 R U2 R' U2`; reverse: `U2 R U2 R' U2`.
- `24 → 25`: `U F D2 F' U'`; reverse: `U F D2 F' U'`.
- `26 → 27`: `U2 R U2 R' U2`; reverse: `U2 R U2 R' U2`.
- `42 → 43`: `R B' R2 B' R'`; reverse: `R B R2 B R'`.

## Independent proof and optimization limits

The Python verifier first validates the preserved original counter certificate, then replays every optimized increment, every reverse edge, and both endpoint setups on 24 permanently labeled rigid sticker frames. It checks title identities, both digits, upright orientation, and exact full-state restoration.

The independent four-corner breadth-first search covers all `8×7×6×5×3⁴ = 136,080` legal oriented selected-corner poses. Its maximum distance is seven HTM. Every projected face move lifts to the actual cube; hidden corners are unconstrained in the target. Enumerating all title-copy choices with four distinct cubies gives the exact distance to any matching next display. Every stored increment is verified to attain that distance from its actual starting state.

For decrement, 59 of 99 stored edges are also shortest to any matching prior display. The remaining reversed edges intentionally restore canonical states; a different visually matching prior state can sometimes be reached sooner. Those alternatives do not automatically compose into a shorter complete countdown.

The search makes 8,000 seeded attempted swaps, including repeated or unchanged proposals, and tries 18 shortest-path tie policies with one-display lookahead. It minimizes worst HTM first, total HTM second. **Global print optimality, globally optimal hidden-state routing, and fastest physical operation remain UNKNOWN.** This is a certified improved candidate, not a proof that five is the best possible worst-case count. No animation, human timing, physical build, unpadded display, or wraparound is validated.

## Reproduction and evidence

Run from the repository root. Edge optimization needs only Node 24+; verification uses Python 3 standard library. The optional exact-endpoint solver is frozen separately in this directory’s package lock. Existing timer proof tools supply geometry and the independent distance graph without modifying their artifacts.

```sh
node research/counter-2x2-optimization/optimize.mjs /tmp/new-counter-candidate.json
python3 research/counter-2x2-optimization/verify.py
python3 -m unittest discover -s research/counter-2x2-optimization -p 'test_*.py'
python3 research/counter-2x2-optimization/report.py
```

The seeded search reproduces all semantic output fields; measured runtime can differ. To verify a fresh candidate, run `npm ci --ignore-scripts --prefix research/counter-2x2-optimization`, then `node research/counter-2x2-optimization/setups.mjs /tmp/new-counter-setups.json /tmp/new-counter-candidate.json` and `python3 research/counter-2x2-optimization/verify.py /tmp/new-counter-candidate.json /tmp/new-counter-setups.json`. The generators refuse to overwrite output paths.

[Optimized certificate](optimized.json) · [Independent verification](verification.json) · [Full statistics](statistics.json) · [Provenance and hashes](manifest.json) · [Earlier timer optimization](../timer-2x2/optimization/REPORT.md)
