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

Reproduction uses `/tmp/calendar-backend-review/export-kernel.mjs` and
`/tmp/calendar-backend-review/replay-kernel.py`; these reviewer helpers are archived
with this evidence. The latter imports only the historical Python Rodrigues verifier,
never the JavaScript coordinate implementation.
