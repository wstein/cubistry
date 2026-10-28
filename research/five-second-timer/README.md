# Maximum five-second timer

Issue #58 uses one immutable 24-sticker print, eight rigid corners, legal outer-face turns, exact upright decimal glyphs, and fixed MM (top) / SS (bottom) slots. No optical aliases or independently movable digits are permitted.

**SAT:** every five-second value from 00:00 through 39:55 inclusive (480 states / 479 edges). **UNSAT:** extending that continuous range to 40:00 under the same assumptions; therefore 40-, 50-, and 60-minute ranges are excluded. The [upper-bound argument](UPPER_BOUND.md) and executable audit establish the boundary independently of the constructive search. Twenty- and thirty-minute ranges are verified subsets; exactly 30:00 includes 361 states / 360 edges.

## Consecutive five-second optimization

The preserved initial certificate has 2,261 HTM, maximum 6, mean 4.7203 per edge. The selected optimized certificate has **2,237 HTM, maximum 6, mean 4.6701**, a 24-HTM (1.06%) reduction. Its 30-minute prefix takes 1,681 HTM versus 1,703 initially. Reverse playback has the same totals. Source-to-zero setup (6 HTM for the selected layout) is excluded from adjacent-edge totals.

The search prioritizes maximum edge length, then total length across all 479 consecutive five-second edges. It explores two constructive cubie-group families, both spare seconds-unit glyphs, nine mixed-slot face placements per family, 128 seeded proposals each, then 4,000 further proposals from the selected starting layout: 8,608 proposals total. [Search results](layout-search.json) and all [search artifacts](layout-search/) preserve inputs and outputs. This is a bounded search, not a complete enumeration of print layouts. **Global print/traversal move optimality: UNKNOWN.** All 479 forward edges are independently shortest for their particular reached source state and target display; this does not establish global route optimality or shortest reverse display solutions.

Run from the Research checkout (Node.js 24, Python 3):

```sh
node research/five-second-timer/optimize-layouts.mjs /tmp/five-second-new-search
python3 research/five-second-timer/verify.py research/five-second-timer/optimized-certificate.json
python3 research/five-second-timer/physical_replay.py research/five-second-timer/optimized-certificate.json
python3 -m unittest discover -s research/five-second-timer -p test_verify.py
python3 research/five-second-timer/upper_bound.py /tmp/five-second-upper.json
```

The output directory must not exist. Search report rows contain basenames relative to that directory. To reproduce only the final refinement, run:

```sh
FIVE_SECOND_FAMILY=B FIVE_SECOND_EXTRA=0 FIVE_SECOND_FACES=0,2 FIVE_SECOND_TRIALS=4000 FIVE_SECOND_START=research/five-second-timer/layout-search/B-0-0-2.json node research/five-second-timer/optimize-candidate.mjs /tmp/five-second-refined.json
```

Compare runtime core fields excluding `evidence`: timing metadata varies. The starting core SHA-256 is recorded in the refined certificate. `optimized-runtime.json` removes only `evidence` and uses compact JSON plus a final newline; SHA-256 `fe46391d03877698633d87b5874763362f0c626ef83cade74d7c32656e990865`.

## Actual animation budget

[Benchmark observations](animation-benchmark.json) record real Chromium/SwiftShader WebGL animation, no reduced motion, 1280×1000 viewport, using the feature baseline `39cb33ba730ddf4b66b1a52c67fc0f220ae43a21`. One selected maximum-length edge is repeated three times at the inherited 250-ms timer default: 1.765, 1.698, and 1.715 seconds for six committed HTM, below the five-second budget. At 2,000 ms per move the same edge takes 12.283 seconds and exceeds that budget. These are local measurements, not hardware guarantees; accelerated time and slow devices still require bounded catch-up with truthful logical/physical synchronization status. No animation moves may be silently omitted within an active sequence.

Run the feature checkout's dev server on port 5186. From its directory (with Playwright and Chromium installed), invoke the Research script:

```sh
node /path/to/research-checkout/research/five-second-timer/benchmark.mjs /tmp/five-second-animation.json
python3 /path/to/research-checkout/research/five-second-timer/verify_trace.py /tmp/five-second-animation.json
```

`BENCHMARK_URL` and `CHROMIUM_PATH` optionally select the server and Chromium executable. The independent Rodrigues checker verifies all 24 actual committed move poses in the saved observation, including full sticker identity, normal and upright frames.

Proofs, solver output and benchmarks remain on `research/cube-display-feasibility`. The feature branch must pin its Research commit and verified runtime hash; it must not copy research history into its implementation PR. Neither this result nor reviewer clearance authorizes merge or deployment.
