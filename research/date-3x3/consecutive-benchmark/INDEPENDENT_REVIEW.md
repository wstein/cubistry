# Independent backend and consecutive-run review

## Baseline capture: independently verified

Reviewer: a separate reviewer agent, using a detached read-only checkout at
`307f45ecaab19193ddd233cbd2e8f7d8e00fc960`. No author implementation files were changed.
The runner captured the clean Cubistry application at
`5a73f34c39cf9d254a5ac4056d152f595d832123`; runner revision
`3eef3c5092beb1ccfa362275760d0151c65d0c3d` and source hashes are recorded in
`captures/legacy-direct-2024.manifest.json`.

Capture SHA-256: `e0eca88879f13017972b1ae9222cb97bbd4defd7fa178c0b5c943a6eb37e9b55`.

The independent standard-library Rodrigues replay passed all 4,716 request groups,
24 actual-pose streams, all 54-sticker inverse restorations, and 120 obsolete single
turns committed before interruption. It verified immutable printing, upright visible
cells including centers, exact counts, initial witnesses, reference lengths,
actual-source fallback baselines, and independently recomputed statistics.
All ten author corruption controls and eight separately selected reviewer corruption
controls were rejected. Machine-readable independent outputs are stored beside the capture.

Commands (from the detached reviewer checkout):

```sh
python3 research/date-3x3/consecutive-benchmark/verify.py /tmp/cubistry-consecutive-baseline-full.json
python3 research/date-3x3/consecutive-benchmark/test_verify.py /tmp/cubistry-consecutive-baseline-full.json
python3 /tmp/calendar-backend-review/check_negative.py /tmp/cubistry-consecutive-baseline-full.json
```

The reviewer controls altered the printing, source hash, legal move syntax, move
count, source-reference length, baseline count, stream coverage, and completeness.
They are independent corruption selections, while the geometric replay deliberately
reuses the historical Python Rodrigues implementation rather than JavaScript solver
or planner geometry.

### Finding requiring follow-up

The retained physical reference grows to 13,642 tokens in the German actual chain.
The direct method reaches 41 HTM in this dataset, and measured planning time grows
substantially relative to the legacy planner. These are actual chained measurements,
not canonical-start comparisons. A separate exact-reference compaction/backend
change is being developed and is **not covered by this baseline approval**.
No global move bound, optimality, browser responsiveness, or universal feasibility
claim follows from this benchmark. Timing describes the captured machine only.

## Initial shared package review

PuzlWerk `135dd43e0aa678c114978da66460e1a310fcde4a` was reviewed in a detached checkout.
All 12 retained CubeLab source files match their pinned upstream revision
`08e079f3bc211777d8980f75ec6a7f61979dd2ac` byte for byte. The existing 2×2 package has
no source/table/API changes. `npm run check` passed 33 tests and type/format checks;
`npm run docs:check`, `npm run test:docs` (19 tests), and `npm run test:package`
passed. Both old and new packed consumers run without application/compiler imports.
An independent cubing.js full-transformation replay passed six cases, including two
color-identical states with different center orientations. A new center-reference
helper and final calendar consumer require an additional frozen-revision review.

## Shared center-reference addendum

Frozen PuzlWerk `ffe513c43f5d622810b9a3c9aff2fac88163d0f0` passed a separate
standard-library Rodrigues replay of **all 2,048 even-parity center tuples**.
Each legal reference restores every noncenter identity and complete frame, reaches
all six requested center frames, and restores the entire 54-sticker state when
its inverse is applied. All 36 macro generators passed the same physical test.
Six intentionally incorrect center goals were rejected. The exported corpus hash
and result are recorded in `captures/kernel-2048-replay.json`.

The maximum constructed reference is 286 HTM. This is an exact-history bound for
this construction, not shortest-path evidence or a normal transition animation
bound. A fallback can traverse such references. Odd-parity tuples were independently
checked to return invalid. The final package `npm run check` passed all 34 tests,
type checking, and formatting; the existing 2×2 package remains unchanged.

Reproduction uses the archived reviewer helpers:

```sh
node captures/export-kernel.mjs /path/to/puzlwerk/packages/solver-3x3-picture > /tmp/kernel-2048.json
python3 captures/replay-kernel.py /tmp/kernel-2048.json
```

Run them from this benchmark directory after building the pinned provider. The latter imports only the historical Python Rodrigues verifier,
never the JavaScript coordinate implementation.

## Calendar integration addendum

Reviewed frozen Cubistry `96bd61cd7d226fae7973300139e589bd1738fd01` in a separate
detached checkout with actual packed PuzlWerk dependency `ffe513c`. Its dependency
pin and archive integrity are retained in `puzlwerk-picture-source.json`.
The production build and type check passed. Focused calendar/controller/optimizer
regressions and retained runtime-notice artifact checks passed. Independently ran
the two real production Chromium tests beneath `/cubistry/`: German 18 HTM and
English 15 HTM reached their exact visible fronts, with no page errors.

Additional reviewer probes covered all 24 rigid physical frames for each of the
three print variants (72 cases), nonzero target poses, actual candidate replay,
and exact-reference construction. Separate node-budget, invalid-budget, and
threshold controls retained the supplied checked route in all three prints.
`captures/consumer-independent.json` records these results.

A review found cancelled prepared results could be reused on an A→B→A target
revisit, animating a 79-move fallback without attempting the new solve. The focused
`96bd61c` fix evicts cancelled entries; its regression requires a fresh solve and
18 optimized moves. Active obsolete browser planning now terminates its worker;
playback still completes only the current legal turn before replanning.

The upgraded Research verifier at `1b036aadc8397e0c7e363f07cb0303edf90a1947`
independently replayed the 72-case exact-reference smoke capture. Five additional
reviewer corruption controls rejected wrong hidden-center pre-turn/end references,
false reference hashes, and false final lengths. A complete final provider-comparison
capture is still pending and is not approved by these smoke results.

No blocking implementation finding remains within this reviewed scope. Bounds are
operational budgets, not a completeness or optimality guarantee. Cold initialization,
worker deadlines, and checked fallbacks can still produce delays or longer routes.

Publication of a detailed review comment to PuzlWerk PR #21 was blocked by automatic
approval review, citing external egress of potentially non-public test/repository
information without explicit user approval for that payload/destination. No alternate
publication route was attempted; the independent report is retained here. Both PRs
remain Draft, with no merge, deployment, or package publication performed.

## Final actual chained comparison: independently verified

Frozen harness `1b036aadc8397e0c7e363f07cb0303edf90a1947`, clean application
`96bd61cd7d226fae7973300139e589bd1738fd01`, and pinned shared provider `ffe513c`
produced the complete final 7,074-group capture in 324.67 seconds. Capture SHA-256:
`3753b6ec0aec44068fd2dc9aa23481c7abf001f6b6f025265f60f0a6ff96af84`.
The independent Rodrigues verifier passed all 36 actual-pose streams and all 7,074
54-frame inverse restorations, including 180 obsolete committed single turns.
Actual full-frame reference replacements, strict reference shortening, reference
hashes, retained hidden centers, fallback baselines and all summary counts were
checked. The eight general reviewer corruptions and five additional compaction
corruptions were rejected, including color-equivalent but wrong hidden-center words.
Machine outputs are retained as `captures/final-comparison-2024.*independent.json`.

The direct comparison uses the same exact-reference compaction policy as the
center-aware comparison. Both carry their own actual pose through their entire
stream; neither is reset to a canonical pose between requests. Their later sources
can therefore differ: aggregate comparisons are measured whole-stream outcomes,
not per-date claims from an identical physical source.

| Print | Direct mean HTM increment/decrement | Center-aware mean HTM increment/decrement |
| --- | ---: | ---: |
| German A | 21.98 / 22.15 | 20.16 / 20.28 |
| English, zero | 18.53 / 18.61 | 17.34 / 17.45 |
| English, unpadded | 18.74 / 18.43 | 17.27 / 17.43 |

Across all scenarios, maximum HTM remains 41 for both optimized providers.
Maximum actual source-reference length is 352 tokens for direct and 361 for
center-aware, versus 13,642 in the uncompacted baseline capture. All 1,516 accepted
center-aware results report a strictly shorter route than their own same-source
direct candidate, and returned token counts match those diagnostics. There were
860 center-search `unknown` results retaining direct routes, no provider errors,
and 60 expected cancelled plans per optimized provider.

The center-aware year means add planning work in several variants; measured mean
request time is roughly 54–82 ms, with a cold 2.26-second first request. The Node
benchmark uses immediate animation ports, so these measurements do not describe
browser animation completion time. This is useful measured improvement, not a
universal speed, move-count, or optimality guarantee. Final reviewed implementation
and complete dataset have no remaining blocking finding in the authorized scope.

### Final stacked-head reconciliation

Final integration head `36cfef4694f69874a13c44f9e1181810070e137e` has the same
runtime tree as reviewed/benchmarked `96bd61c`; their diff contains only
`tests/browser/calendar-optimizer.spec.mjs`. The independently reviewed test delta
waits for the requested endpoint plus idle rather than an earlier false idle
state, records actual first-motion/settled timings, and gives first-motion polling
15 seconds consistent with the eight-second hard worker deadline and existing
settle timeout. All physical endpoint, count and continuity assertions remain.
This test-only change does not invalidate the captured runtime evidence.
