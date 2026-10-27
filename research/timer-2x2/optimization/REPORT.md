# Move-optimized fixed-print 2×2 timers

Both prints are **SAT**: all settled displays and every adjacent increment/decrement are independently replayed. Each stored transition uses at most **5 HTM**. Global print optimality is **UNKNOWN**.

## Results

HTM counts each quarter, inverse, or half face turn as one move. QTM counts a half turn as two. The viewing frame is fixed; whole-cube rotations are not free moves. Setup moves are excluded from cycle statistics.

| Range | Displays | Adjacent edges | HTM min / median / p95 / max | Mean HTM | Total HTM | Mean QTM / max |
| --- | ---: | ---: | --- | ---: | ---: | --- |
| 00:00–19:50 | 120 | 119 | 1 / 3 / 5 / 5 | 3.227 | 384 | 4.109 / 8 |
| 00:00–59:50 | 360 | 359 | 1 / 3 / 5 / 5 | 3.688 | 1324 | 4.607 / 8 |

Increment and decrement use the same edge words in opposite directions, so their recorded counts are identical. Every decrement restores the exact previous full cube state. Mixed increment/decrement navigation therefore remains consistent. At 00:00 and the upper endpoint, clamp or reject an out-of-range step; no wraparound edge is certified.

## Proof and optimization boundary

The independent Python verifier rebuilds a breadth-first search on all `8×7×6×5×3⁴ = 136,080` legal oriented four-corner poses. Four selected, upright front stickers define the goal; hidden corners are unconstrained. Each face move projects to this graph and every projected move lifts to the actual physical cube. Breadth-first search therefore gives exact HTM distances to those four sticker frames, with diameter 7. For duplicate digits, all distinct-cubie sticker matchings are considered. The minimum over these matchings is the exact distance to any matching next display.

Every increment word, including the initial zero setup, attains that distance from its actual starting state. This does **not** prove that the sequence of hidden states, the reverse partial-display paths, or the print is globally optimal. Reverse paths are inverses to the canonical prior states; a different valid prior display can sometimes be reached sooner. The per-range verifier output reports those reverse alternatives. Summing their independent minima does not describe a single alternative countdown because changing one endpoint changes subsequent starts.

The seeded search makes 4,000 attempted swap trials per range (including repeated or unchanged proposals) and keeps lexicographic improvements: worst HTM first, total HTM second. It swaps digit labels within their existing upright slots and selects among 18 shortest-path tie policies with one-display lookahead. For 19:50, surplus minute-tens 2–5 are replaced with additional 0/1 copies before searching. Cubie grouping, assigned roles, sticker slots, and print orientations stay fixed. Wider layout/orientation searches remain open.

## Baselines and boundary behavior

“Direct baseline” uses the initial print and tie policy zero. The improvement below combines print changes and path tie choices; it is not attributed solely to printing. “Legacy hub” is the old raw inverse-source/forward-target concatenation, without local cancellation, on the original print; it is an upper-bound reference, not a competitive shortest solver.

| Range | Direct baseline max / total HTM | Optimized max / total | Total reduction | Legacy raw hub max / total |
| --- | --- | --- | ---: | --- |
| 19m50 | 6 / 496 | 5 / 384 | 22.58% | 21 / 2246 |
| 59m50 | 6 / 1709 | 5 / 1324 | 22.53% | 21 / 6535 |

## 19m50 layout and statistics

[Printable vector net](19m50-print.svg) · [All 24 sticker frames and orientations](19m50-stickers.csv) · [Every transition and inverse](19m50-transitions.csv)

| Cubie | Three permanent sticker roles and digits |
| --- | --- |
| 0 | MT:0, MT:1, MT:0 |
| 1 | MT:1, MT:1, MT:0 |
| 2 | MU:0, MU:2, MU:5 |
| 3 | MU:3, MU:4, MU:7 |
| 4 | MU:1, MU:6, SU:0 |
| 5 | MU:8, MU:9, SU:0 |
| 6 | ST:0, ST:2, ST:4 |
| 7 | ST:1, ST:3, ST:5 |

MT/MU = minute tens/units; ST/SU = second tens/units. All source geometry and upright print frames are in the candidate certificate.

| Transition class | Edges | Min | Mean HTM | Max |
| --- | ---: | ---: | ---: | ---: |
| decade rollover | 1 | 5 | 5.000 | 5 |
| minute rollover | 18 | 3 | 4.222 | 5 |
| seconds only | 100 | 1 | 3.030 | 5 |

HTM histogram: `{1: 5, 2: 3, 3: 81, 4: 20, 5: 10}`. Half turns: 105. Face-turn usage: `{'B': 69, 'D': 52, 'F': 5, 'L': 111, 'R': 55, 'U': 92}`.

From the printed source state, initialize the exact upper endpoint with `R' U L' F R2 U' L2 U' F' U2` (10 HTM). Initialize zero with `U' L2 B' U2`. These setup paths are physically verified; the upper-end setup is not claimed shortest. Do not start the stored countdown from an arbitrary visually matching state: hidden state matters.

Worst-case examples (the CSV lists every edge):

- `00:50 → 01:00`: `R' U R' D' R'`; reverse: `R D R U' R`.
- `01:00 → 01:10`: `L U B2 U' L'`; reverse: `L U B2 U' L'`.
- `04:50 → 05:00`: `B2 U' L' B U`; reverse: `U' B' L U B2`.
- `08:10 → 08:20`: `R2 F R2 B' L2`; reverse: `L2 B R2 F' R2`.
- `08:50 → 09:00`: `B' L' U L' U2`; reverse: `U2 L U' L B`.

## 59m50 layout and statistics

[Printable vector net](59m50-print.svg) · [All 24 sticker frames and orientations](59m50-stickers.csv) · [Every transition and inverse](59m50-transitions.csv)

| Cubie | Three permanent sticker roles and digits |
| --- | --- |
| 0 | MT:0, MT:4, MT:2 |
| 1 | MT:1, MT:5, MT:3 |
| 2 | MU:4, MU:9, MU:2 |
| 3 | MU:5, MU:7, MU:0 |
| 4 | MU:1, MU:3, SU:0 |
| 5 | MU:8, MU:6, SU:0 |
| 6 | ST:5, ST:1, ST:3 |
| 7 | ST:2, ST:4, ST:0 |

MT/MU = minute tens/units; ST/SU = second tens/units. All source geometry and upright print frames are in the candidate certificate.

| Transition class | Edges | Min | Mean HTM | Max |
| --- | ---: | ---: | ---: | ---: |
| decade rollover | 5 | 4 | 4.600 | 5 |
| minute rollover | 54 | 2 | 4.259 | 5 |
| seconds only | 300 | 1 | 3.570 | 5 |

HTM histogram: `{1: 2, 2: 6, 3: 190, 4: 65, 5: 96}`. Half turns: 330. Face-turn usage: `{'B': 196, 'D': 266, 'F': 14, 'L': 140, 'R': 413, 'U': 295}`.

From the printed source state, initialize the exact upper endpoint with `F R2 F2 L' U' F2 U L2 F` (9 HTM). Initialize zero with `L' B U2 L2 U'`. These setup paths are physically verified; the upper-end setup is not claimed shortest. Do not start the stored countdown from an arbitrary visually matching state: hidden state matters.

Worst-case examples (the CSV lists every edge):

- `00:00 → 00:10`: `R B' R D R2`; reverse: `R2 D' R' B R'`.
- `00:10 → 00:20`: `R B' R D R2`; reverse: `R2 D' R' B R'`.
- `01:10 → 01:20`: `U R2 U' B2 D'`; reverse: `D B2 U R2 U'`.
- `01:30 → 01:40`: `U R2 U' B2 D'`; reverse: `D B2 U R2 U'`.
- `01:50 → 02:00`: `R2 B2 D R2 D`; reverse: `D' R2 D' B2 R2`.

## Printing and assembly

Each SVG is an unfolded source-state net with outward face views: U above F, L/F/R/B across the middle, D below F. The SVG uses original vector seven-segment strokes and an asymmetric permanent upright marker, so no font installation or font license is needed for the digits. Face labels are assembly aids outside the stickers. The sample sticker outlines are **20 mm squares** with a 20 mm calibration line. Print at 100%, then scale uniformly to your actual cube sticker size; physical fit and printer tolerances have not been tested. No bleed or rounded-corner allowance is included. The CSV gives clockwise digit rotation relative to each outward face view. Keep all faces in the source-state arrangement during assembly; the net is not a picture of the initialized timer.

The strict upright marker preserves the earlier capacity model. Normal fonts without orientation marks may have optical symmetries and require a separate proof. The 59:50 capacity limit remains as established in the [original capacity proof](../../../docs/TIMER_2X2.md). The 19:50 print was only certified through 19:50; it intentionally uses duplicated tens 0/1 and does not retain the larger range.

## Reproduction and evidence

Run from `/workspace/cubistry` (or the repository root on another machine). The optimizer and verifier need only Node 24+ and Python 3; the optional exact-endpoint setup generator uses the existing locked `cubing@0.66.1` dependency. Both certificate generators refuse to overwrite their output paths.

```sh
node research/timer-2x2/optimization/optimize.mjs /tmp/new-timer-optimization.json
python3 research/timer-2x2/optimization/verify.py
python3 -m unittest discover -s research/timer-2x2/optimization -p 'test_*.py'
python3 research/timer-2x2/optimization/report.py
```

The seeded optimizer is deterministic. Compare regenerated prints, words, counts, and BFS fields with `optimized.json`; measured `runtimeSeconds` can differ. The verifier checks the committed candidate and its SHA-bound `setups.json`; a different candidate requires new matching setups. To regenerate setups, install the frozen parent dependencies with `npm ci --prefix research/timer-2x2`, then run `node research/timer-2x2/optimization/setups.mjs /tmp/new-timer-setups.json /tmp/new-timer-optimization.json`. Verify a fresh pair with `python3 research/timer-2x2/optimization/verify.py /tmp/new-timer-optimization.json /tmp/new-timer-setups.json`.

[Candidate certificate](optimized.json) · [Independent verification](verification.json) · [Detailed statistics](statistics.json) · [Manifest and hashes](manifest.json)

No elapsed-time or human turning-speed guarantee is made. Five HTM within a ten-second interval is a move budget, not a measured usability result. A browser animation and physical build remain untested.
