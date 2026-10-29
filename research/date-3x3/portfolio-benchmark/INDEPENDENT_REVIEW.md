# Independent bounded-portfolio evidence review

Reviewed frozen Research `9c1053cfa645d25323691af1f4ccbdb462c890ab` in a separate
detached checkout. Application capture source is clean
`1ef2ffc64b9eeb2d8065de75021ff5e6053cfffc`; runner source is frozen `21d3b76bfeef36ebd065ab7f9ea576a385f90745`.
The later consumer `3d4c179308b74b1242eaf17cafd4e1d70400b587` delta was independently confirmed test-only;
implementation/code review is coordinated separately by the parent reviewer.
No author source or prior evidence capture was edited during this review.

## Independently executed replay

Calendar capture SHA-256:
`235b91c60b3e9521ff62cb10807e16067f59a57b5cc035f21c0076d4f4187952`.
The separate standard-library Rodrigues verifier passed all 4,716 request groups,
24 actual-pose streams, 4,794 saved candidate full-frame replays/inverses, 2,418
own-first-proposal retention checks, and 120 obsolete committed turns. Immutable
printing, exact actual source references, all 54 hidden frames, target displays,
Gregorian request coverage, counts, node/depth ceilings and summaries passed.
All thirteen full-capture corruption controls were rejected independently.

The 30-group November capture passed all committed paths and candidate checks.
The 18 historical same-source contexts passed 72 candidate/inverse replays and
18 equality/retention checks against the old default's first result at exactly
that stored source. Eight context corruptions were rejected. Machine-readable
independent reports are retained beside the captures.

Commands actually run from the detached Research checkout:

```sh
python3 research/date-3x3/portfolio-benchmark/verify.py research/date-3x3/portfolio-benchmark/captures/calendar-2024.json
python3 research/date-3x3/portfolio-benchmark/test_verify.py research/date-3x3/portfolio-benchmark/captures/calendar-2024.json
python3 research/date-3x3/portfolio-benchmark/verify.py research/date-3x3/portfolio-benchmark/captures/november-regressions.json
python3 research/date-3x3/portfolio-benchmark/verify-contexts.py research/date-3x3/portfolio-benchmark/captures/historical-contexts.json
python3 research/date-3x3/portfolio-benchmark/test-contexts.py research/date-3x3/portfolio-benchmark/captures/historical-contexts.json
```

## Measurements and limits

| Print | Old-policy mean HTM increment/decrement | Portfolio mean HTM increment/decrement |
| --- | ---: | ---: |
| German A | 20.16 / 20.28 | 19.59 / 19.12 |
| English, zero | 17.34 / 17.45 | 16.03 / 16.02 |
| English, unpadded | 17.27 / 17.43 | 16.03 / 15.98 |

The canonical November 3→4 fixture improves German 24→18 HTM and English
14→13 HTM. Across the complete chained year, optimized maxima still reach 41;
a free jump can still retain 40 HTM. No universal 18/20/21 bound or optimality
claim follows. The second search is capped at 18 outer HTM, but an unknown search
retains its longer checked first proposal. All actual `solved` candidate words
were additionally checked to fit their reported depth; retained unknown routes
are not misrepresented as newly found within-cap solutions.

Each policy carries its own actual hidden pose through the entire stream, so later
sources can differ. Aggregate improvements are whole-stream measurements, not
pointwise comparisons at identical physical sources. The own-first checks and
historical contexts establish the narrower same-source retention statements.

Portfolio mean Node request times are approximately 108–127 ms in year scenarios,
versus approximately 55–75 ms for the old policy. These immediate-port timings
exclude rendering, animation and network. The first baseline request includes lazy
table initialization; subsequent providers may use warm shared process caches.
Do not advertise a lower cold-start maximum from that asymmetric cache state.
Extra searches add planning work; unknown statuses remain distinct from errors,
cancellation and fallback. Physical XYZ moves are replayed/counted even when
priced at zero outer HTM. These timings do not test browser hard deadlines.

## Review finding resolved

The context verifier initially checked only `maximumDepth <= cap`, allowing
negative/Boolean/fractional metadata to pass. `9c1053cfa645d25323691af1f4ccbdb462c890ab` now requires an exact
integer with `0 <= depth <= cap` and adds three corresponding corruption controls.
All eight context controls and the unchanged 18-context capture pass after the fix.
Actual captured depths were independently verified valid before this hardening;
no data repair or remeasurement was needed.

No remaining blocking evidence finding was identified. Existing 7,074-group
historical evidence is preserved. No Ready transition, review-comment publication,
merge or deployment was performed. This review certifies the bounded captured
physical replays and reported statistics, not a solver completeness theorem.

## V2 independent follow-up: duplicate native search removal

Reviewed frozen Research `2ed6b79f0d85dba372c4706835d1424a1ff7fdc8` (including the V2 evidence and strengthened
verifiers) in a separate detached checkout. Captured application source is clean
`0c9b166ca66d252ecd096a73042d322f52d987a0`. The frozen run source is unchanged;
all original V1 captures and the independent V1 findings above remain preserved.

V2 raw capture SHA-256:
`c74b7ddb58dd6769ed26aaa0aa18d3f8d58300ab745f18f93c86957152f50b14`.
Independent full replay passes all **4,716 request groups**, 24 streams, 120 obsolete
committed turns, **4,254 saved candidate full-frame replays/inverses**, and **2,418
own-first-proposal retention checks**. All fifteen full-capture corruption controls
are rejected, including equal-depth second calls and missing skip diagnostics.
The V2 November paths pass all 30 groups. All 18 historical contexts pass 72
candidate/inverse replays, with all nine context corruption controls rejected.
The strengthened checks retain exact integer/nonnegative depths and require every
reported solved candidate to fit its recorded native outer-face cap.

The reviewer additionally compared every ordered V1/V2 row, rather than accepting
summary equality: all **4,716 chosen words, complete source and endpoint hashes,
physical move counts and committed-interruption counts are identical**. V2 has
**exactly 540 explicitly diagnosed skipped second searches**, 1,836 actual second
native calls and **zero second calls at an equal or greater depth**. All actual solved
candidate words fit their native cap. This independently confirms preserved
captured physical behavior while eliminating the redundant calls. It is not a
claim that all future soft-budget runs must choose identical paths.

The comparison reproduces unchanged HTM totals of 43,669 for default and 40,984
for portfolio across each policy's 2,358 groups. V1's 540 equal-depth second calls
recorded 43.535 seconds of attempt time. Whole run time changed from 462.204 to
397.839 seconds; portfolio request time sums changed from 296.255 to 239.647
seconds, while default also varied from 161.019 to 153.441 seconds. The entire
64.366-second difference cannot be attributed solely to skipping duplicate work.
These remain descriptive shared-machine/immediate-port measurements with differing
cache/order conditions, not a latency guarantee or isolated browser benchmark.

V2 year portfolio means are approximately 91–102 ms, versus default 54–72 ms.
Move paths and the existing maximum of 41 HTM remain unchanged; physical XYZ turns
are still retained separately. No universal 18/20/21-move bound, optimality or
zero-cost fallback is established. Build/deployment/browser hard-deadline behavior
was not measured by this Node capture.

Machine-readable independent replay, corruption, strict-policy and version-identity
reports are retained as new `*-v2.*independent.json` and
`calendar-v1-v2.comparison-independent.json` sidecars. No raw capture, original
review section, or German-layout file was modified. No remaining blocking V2
evidence finding was identified. No Ready transition, publication, merge or
deployment was performed.
