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
