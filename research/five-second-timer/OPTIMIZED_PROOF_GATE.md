# Independent optimized witness review

Reviewed 2026-10-28 by a separate proof reviewer. Original certificate and original PROOF_GATE.md remain historical evidence. This report concerns optimized-certificate.json SHA256 `6eaf8b36a585338d8536c0f84b24b1924488de0086eac623f4e937373c363b89`; optimized-runtime.json SHA256 `fe46391d03877698633d87b5874763362f0c626ef83cade74d7c32656e990865`.

## Result: proof gate passes

Independently executed physical_replay.py and verify.py against the corrected certificate. Both pass: 480 exact upright displays, 479 consecutive five-second edges, 2237 HTM, maximum 6 HTM, mean 4.670146137787056. Full reverse traversal restores every exact prior physical state. Independent BFS verifies each forward word is shortest from its reached starting state to the requested partial display. This does not establish global layout/route optimality or reverse partial-display shortestness.

Independently reran upper_bound.py: UNSAT at 40:00. The new print uses the same strict model (24 immutable decimal stickers, eight rigid corners, exact upright MM above SS, no optical aliases). The proof covers arbitrary prints in that model, so switching constructive family does not weaken it. Together these establish exact maximum continuous five-second range 00:00 through 39:55 inclusive. Global print/move optimality remains UNKNOWN.

Compared with the preserved 2261-HTM witness, the optimized route saves 24 HTM (about 1.06%). The inclusive 00:00..30:00 prefix saves 22 HTM: 1681 versus 1703 across 360 edges. Maximum remains 6. Setup increases from 5 to 6 HTM and is excluded from these route totals. The original certificate was byte-compared with research commit 27c2b72 and remains unchanged. Optimized runtime JSON equals the certificate with only observational evidence removed.

## Independent reproduction and provenance

Independently regenerated family B, spare glyph 0, mixed faces 0,2, seed 271028, 128 proposals, then the 4000-proposal refinement starting from that result. The starting semantic core hash is `e3af164f5b58e15d8b572470e8920d577f4c5aef0cc6da4b47f1ed51aa6d0d44`. The regenerated final semantic core exactly equals optimized-runtime.json. Hash here means compact JSON with evidence removed; it intentionally differs from the formatted runtime file byte hash.

Inspected optimize-candidate.mjs and optimize-layouts.mjs. The campaign is a bounded seeded heuristic: 36 family/spare/placement runs of 128 proposals, plus 4000 refinement proposals, totaling 8608 proposals. These are not 8608 necessarily distinct layouts. All 36 saved row cores were independently hashed and matched layout-search.json. Canonical row paths resolve under layout-search/. Earlier stale generator provenance and missing starting-core identity have been corrected. The generator and startingCoreSHA256 now identify the actual reproduction. The selected run and refinement were independently reproduced; this review did not rerun all 36 searches. No claim of global exhaustive optimization is justified.

Reproduce selected run in fresh output files from the Research checkout:

```sh
FIVE_SECOND_FAMILY=B FIVE_SECOND_EXTRA=0 FIVE_SECOND_FACES=0,2 FIVE_SECOND_TRIALS=128 node research/five-second-timer/optimize-candidate.mjs /tmp/selected-start.json
FIVE_SECOND_FAMILY=B FIVE_SECOND_EXTRA=0 FIVE_SECOND_FACES=0,2 FIVE_SECOND_TRIALS=4000 FIVE_SECOND_START=/tmp/selected-start.json node research/five-second-timer/optimize-candidate.mjs /tmp/selected-refined.json
python research/five-second-timer/physical_replay.py research/five-second-timer/optimized-certificate.json
python research/five-second-timer/verify.py research/five-second-timer/optimized-certificate.json
python research/five-second-timer/upper_bound.py
python research/five-second-timer/verify_trace.py research/five-second-timer/animation-benchmark.json
```

Output paths must not already exist. Runtime duration metadata varies; compare semantic core rather than full generated certificate bytes.

## Animation observation and remaining implementation gate

Reviewed benchmark.mjs and independently ran verify_trace.py on animation-benchmark.json: PASS, four observations, 24 actual committed moves. The trace checker independently reconstructs every committed frame and exact target using Rodrigues rotations; it binds the observations to the optimized print and canonical starting state. Benchmark measures the existing viewer directly, not an integrated timer controller.

Three local Chromium/SwiftShader observations of one maximum-length six-HTM edge at 250 ms per move took 1.765, 1.698, and 1.715 seconds. At 2000 ms per move it took 12.283 seconds. These support feasibility at the measured normal setting and demonstrate slow settings can exceed a five-second interval. They are sampled local rendering observations, not a universal device guarantee or an exhaustive timing check of all edges. The trace replay checks state correctness, not the truth of wall-clock timestamps. Integration still requires timer scheduling/slow-speed behavior, browser/regression checks, and an implementation review. This report authorizes no merge or deployment.
