# Final finite-family repair measurements (V4)

Frozen application `aef3c6c132aae5596ddef6a1ee17bf6ee66a6edb` uses repair table 3
and join policy `cyclic-with-verified-half-inverse-v1`. The finite 52 shifts are
14 clockwise-quarter, 24 half (including its explicit verified inverse), and 14
counterclockwise-quarter word shifts. Each has the same full 54 transform as its
base repair. Candidate selection minimizes the simplified prefix/repair join with
deterministic ties; this is not a global shortest-path solver. See the separate
[cyclic proof](../center-bound-investigation/cyclic-verification.json).

The same-source proof examples reduce the old 41-HTM route to 31HTM, and the V3
35-HTM route to 34HTM, preserving all 54 endpoint frames. Those examples are separate
from the fresh continuous measurements below. Cyclic boundary merging can lower
HTM while leaving QTM unchanged; it does not establish an animation-time bound.

## Complete continuous run

[The immutable V4 capture](captures/calendar-2024-v4.json) contains **4,716 groups**,
24 actual-pose streams, 366 forward and 366 backward year steps per print/policy,
14 jumps and 20 groups each of move/planning retargeting. No canonical reset occurs
between dates. Fixed printing and V2 bounded policy remain unchanged: threshold 14,
maximum outer depth 24, 100,000 nodes/attempt, maximum two attempts/200,000 nodes,
and a strictly smaller second native depth. XYZ rotations remain physical moves.

Author replay passed all 4,716 full 54 inverses, 120 obsolete single turns,
**4,252 saved candidate replays**, 2,418 retained-first checks and all 15 corruption
controls. Raw SHA256:
`1f92d9f6cd67c6ee05c24e1e5f16a0ae6cc1c18cccdc0afce3b270a59a1dda9e`.

**Observed global maximum: 34 HTM plus two XYZ rotations, 36 physical tokens.**
The worst German A group is 2024-04-19 → 20, portfolio row 2467/default row 109,
with QTM 50. Across all scenarios, including jumps and interrupted prefixes,
style maxima are German 34, English-zero 34, English-unpadded 33. The year-only
portfolio statistics are:

| Print | Direction | V3 mean HTM | V4 mean HTM | V3 max HTM | V4 max HTM | V4 mean QTM |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| de-a | inc | 19.186 | 19.148 | 35 | 34 | 27.825 |
| de-a | dec | 18.907 | 18.831 | 34 | 34 | 27.060 |
| en-3-zero | inc | 16.011 | 16.000 | 32 | 32 | 23.077 |
| en-3-zero | dec | 15.951 | 15.937 | 33 | 31 | 23.109 |
| en-3-unpadded | inc | 15.964 | 15.956 | 34 | 33 | 23.049 |
| en-3-unpadded | dec | 16.008 | 16.000 | 34 | 33 | 23.230 |

V1/V2 maximum 41 and V3 maximum 35 remain historical captures. No universal 21-move
bound or optimality is proved. Across the whole stream, portfolio HTM changes
40,610 → 40,533 and default 42,960 → 42,711. Only 1,120/2,358 portfolio endpoints and
403/2,358 default endpoints match V3 completely: changed candidate costs/native
caps can choose different paths, despite equal full transforms for each repair.
Same-date rows across captures therefore need not share the same physical source.

Portfolio outcomes: 1,053 second-call improvements, 2,250 candidate moves saved
relative to their own first proposals, 542 explicit depth skips, zero duplicate
native depths, zero provider errors, zero legacy fallback groups and 60 expected
planning cancellations per policy. First outcomes are 1,513 solved/863 unknown/42
not-attempted; second outcomes are 1,053 solved/781 unknown. Unknown retains the
checked best and is not an impossibility result. Reference endpoint maxima are
353 tokens for default and 358 for portfolio; all substitutions preserve all 54 frames.

The full run took 418.106 seconds (V3 418.486 seconds). Portfolio year request means
are 95–105 ms. The cold first default request took 2,313.71 ms. These Node timings
include planning and immediate verified commits, exclude browser animation/network,
and depend on shared-machine load and warm process caches. No general latency gain
is inferred. Full HTM/QTM/XYZ medians, p95, maxima, totals, worst cases and timings are
retained in the [CSV](captures/calendar-2024-v4.summary.csv),
[analysis](captures/calendar-2024-v4.analysis.md),
[outcomes](captures/calendar-2024-v4.outcomes.json) and
[V3/V4 comparison](captures/calendar-v3-v4.comparison.json). In that comparison,
`v1`/`v2` identify its first/second arguments (V3/V4), with exact hashes/commits.

Reproduce with the unchanged README command at source `aef3c6c`, using new output
paths, then `verify.py`, `test_verify.py`, `analyze.py`, `analyze-portfolio.py` and
`compare-versions.py OLD-V3.json NEW-V4.json`. The run froze Research `f0f6ebb`
with unchanged runner bytes. Prior raw evidence and generation-time UNKNOWN fields
remain unchanged; independent review is recorded separately. No further family
expansion or experimental benchmark is included here.
