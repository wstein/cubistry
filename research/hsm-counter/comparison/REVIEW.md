# Independent retained-candidate comparison review

Verdict: **PASS**, scoped to the three retained complete witnesses: initial,
intermediate, and final. This comparison does not claim to publish every random
proposal from the bounded search, and it does not change the selected final
print or its existing proof.

Before reading `compare.py`, the reviewer independently replayed each retained
print's three number routes using the separately authored physical checker.
At 11, 23, and 59 the reviewer computed the shortest reset distance from the
actual reached 24-sticker state and added it to the corresponding prefix cost.
Those independently recorded values agree with every table row and aggregate.

| Candidate | Three 00–23–00 passes | Three 00–11–00 passes | Three 00–59–00 passes |
| --- | ---: | ---: | ---: |
| Initial | 236 HTM | 118 HTM | 591 HTM |
| Intermediate | 228 HTM | 112 HTM | 563 HTM |
| Final | 241 HTM | 116 HTM | 594 HTM |

Per-letter means divide by 24, 12, and 60 transitions, respectively. The
three-letter aggregates divide by 72, 36, and 180. Setup is excluded, the final
wrap is included, and half turns count as one HTM. These are exact one-pass
costs rather than a mean of differently sized cycles.

The comparison additionally constructs actual shortest wrap words, physically
replays them, and reverses each entire pass from its actual ending full pose.
All 27 passes return to the correct visible 00 but have a different hidden pose
from their saved starting 00 state. The report records this explicitly. It
correctly requires replanning before further cycles; these costs are not a
steady-state guarantee or evidence of globally optimal prints or traversals.

Two review findings were resolved before acceptance: an incomplete candidate
directory could otherwise retain the misleading “all three” scope, and a
boolean version could otherwise pass the numeric schema comparison. The
comparison now requires the exact three candidate names and an integer schema
version. No blocking findings remain.

## Verification

```sh
python3 -m unittest discover -s research/hsm-counter -p 'test_*.py' -v
```

All six tests pass. The comparison tests check all nine independently recorded
cycle-total triples, per-row and aggregate denominators, exact regeneration of
the saved JSON ledger and Markdown report, missing-candidate rejection, and
five corrupt candidate controls. Together with the existing proof suite this
includes 24 rejected negative cases. A legal padded reset is rejected even
though it still reaches the correct display, because it is not shortest.

This review follows the project's independent proof-review workflow. No
application change, repeatable closed full-state cycle, timing guarantee,
deployment, or global optimization result is asserted.
