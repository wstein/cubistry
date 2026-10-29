# Bounded center-aware calendar planning

The calendar first finds its existing checked direct route, then attempts a strictly
shorter center-aware route using the private PuzlWerk picture solver. Source and
artifact pins are in `puzlwerk-picture-source.json`; shared review is
https://github.com/wstein/puzlwerk/pull/21 and integration tracking is
https://github.com/wstein/cubistry/issues/67.

The adapter relabels physical pieces relative to the selected target, aligns the
six physical centers, and preserves the visible front center orientation. Hidden
center goal orientations are free; physical parity remains checked. Every chosen
route is replayed against the actual sticker model. The default attempt has
100,000 nodes and depth at most 24, further limited to strictly beat the checked
direct route. Unknown, invalid, failed or late searches retain a verified route;
there is no universal 21-move or optimality claim. Cold initialization takes about
two seconds in the measured Node pilot. The worker has an eight-second deadline
and publishes the direct candidate before the center search starts.

Exact source-reference compaction prevents chained dates accumulating thousands
of historical tokens. It uses a constructive 2,048-state physical center kernel
(maximum constructed reference 286 moves), accepting replacements only when all
54 sticker poses match. This is an internal exact reference, not a shortest route:
a fallback can traverse its inverse and its moves are counted normally. Hidden
centers are never reset. Partial interrupted turns retain their committed history;
stale complete-target references cannot replace a different actual pose.

A changed target terminates obsolete planning immediately. Playback interruption
still finishes its current legal turn before replanning from the committed pose.
The German A printing and month lettering are unchanged.

The Node benchmark factory is `src/apps/calendar/center-planner.mjs:createPlanner`.
Use `options.backend: "direct"` for the same reference policy without center
search, or the default center-aware backend. Its `metadata` pins the dependency;
`lastDiagnostics` reports attempt/status, chosen/direct lengths and timings.
Instrumentation wrappers must forward `compactReference` and `cancelPlanning`.
The controller exposes `sourceReferenceWord` and `referenceMoveCount` for audit;
independent verifiers should replay each replacement against all 54 actual poses.

Regression coverage includes rotated nonzero goal frames, the recorded German
19-to-18 move improvement, 1,000 noncanonical hidden-center transitions, rejected
wrong reference, bounded-search fallback, interim-candidate deadline fallback and
immediate cancellation with stale messages ignored. Performance improvements are
fixture evidence, not a guarantee for every date or arbitrary starting state.

## Bounded search portfolio (follow-up)

The `default-then-shorter-cap18-v2` policy retains the original bounded candidate
first, then tries a shorter native outer-turn depth: at most 18, at most the
first candidate's outer HTM minus one, and no more than the configured depth.
The second call runs only when its effective depth is strictly smaller than the
first call's effective depth: repeating the same deterministic search with an
unchanged node ceiling cannot improve an unknown result. Skips are recorded in
`improvementSkippedReason`.
Whole-cube alignment rotations are reported separately and do not consume this
native outer-turn cap. Both attempts retain the same physical replay and exact
reference requirements. A failed, unknown or non-improving second attempt keeps
the first checked result; this is a portfolio, not an optimal solver.

Each attempt permits at most 100,000 nodes by default: **at most two attempts and
200,000 nodes total**, in addition to the unchanged existing direct planner. The
worker's eight-second hard deadline is unchanged. It posts the first center-aware
candidate and its exact references before the improvement attempt, so a deadline
retains that best known candidate with its actual backend identity. Diagnostics
record each attempt's word, native depth ceiling, node ceiling, status, elapsed
time, outer HTM and alignment rotations. Node counts are ceilings, not measured
visited nodes. Benchmark metadata distinguishes this policy from `default-v1`;
`options.policy: "default"` reproduces the previous single-attempt policy.

The reported German A 03→04 November 2026 case illustrates the distinction:
the earlier direct route was 19 ordinary moves plus an 18-move visible-center
repair (37 total); the original center search found 24; the shorter-depth attempt
finds 18. Tests replay all 18 recorded source contexts (three source histories,
three printings and both prior backend histories), including hidden poses and
exact references. Other dates may retain longer checked routes.

## Shorter visible-center repairs

Repair table version 3 uses face-renamed conjugates of the algorithms published
in [Kociemba's picture-cube discussion](https://kociemba.org/twisted.htm): 12 HTM
for a half-turn correction and 14 HTM for either quarter-turn correction. Every
word restores all noncenter positions and orientations. A quarter correction
also turns the hidden back center; its orientation is unconstrained by the
calendar goal and remains part of the actual physical state. The pinned [independent repair verification](https://github.com/wstein/cubistry/blob/9e736592563885322451b99fb118c79889c25855/research/date-3x3/center-bound-investigation/verification.json)
and its hash are recorded in `transition/provenance.json`, alongside the original
research hashes and the updated local table hash. The shared solver and its
exact-reference kernel are unchanged. Metadata records the repair table
version separately from the search policy and provider pin.

On the exact captured German A 20→19 April 2024 source, replacing the old 20-turn
half correction constructs a 32-HTM route plus two whole-cube rotations, with the
same full 54-pose endpoint as the old 41-HTM route. Its ordinary prefix is still
21 HTM; adjacent F turns merge at the repair boundary. This is a checked improvement
for that source, not a new global maximum or optimality proof. Each new repair has the same full 54-pose transformation as its corresponding old
repair, including the hidden back-center twist. Shorter repair costs can select
a different ordinary-solver candidate and therefore change later chained poses;
previous full-year statistics remain historical and new maxima need a fresh capture.

## Cyclic repair joins

A center-only repair commutes with outer face turns. Cyclic token shifts of the
verified 12/14/14-turn words therefore preserve their full 54-pose effect. The
direct planner checks the 14/12/14 cyclic families plus 12 verified inverse-half
shifts (52 candidates across all three corrections) and keeps the shortest simplified
prefix-plus-repair word, retaining the earliest offset on ties. Whole-cube
rotations are prohibited inside repair words because this commutation argument
does not apply to them. Physical replay still checks the resulting whole route.

Both quarter words contain all six outer faces, so any nonempty ordinary prefix
can merge at least its last turn with a suitable repair start. The half word
contains only F/U/D, so that guarantee does not apply to every prefix. Diagnostic
`repairHTM` is the selected witness length; `repairVariant`, `repairOffset` and
`repairBoundarySavings` describe the join. Budgets and the worker deadline are
unchanged. On the exact captured V3 German A 19→20 April source, the 35-HTM route
has a checked 34-HTM cyclic join with the same full 54-pose endpoint. This is not an
optimality proof or a global maximum claim. The explicitly supplied inverse-half
family also constructs 31 HTM on the historical 41-HTM source with the same full
endpoint. Inverting quarter families is not an additional same-angle candidate;
the opposite angle remains its own matching correction.

The finite family is pinned by [independent cyclic verification](https://github.com/wstein/cubistry/blob/f0f6ebb41413c6f79ddea78793e045c8ebd028f6/research/date-3x3/center-bound-investigation/cyclic-verification.json); provenance records its immutable commit and artifact hash.
