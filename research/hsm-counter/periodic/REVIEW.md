# Independent proof: at most five moves indefinitely

Verdict: **SAT** for the previously preserved intermediate print. Once the
required H, S, or M is upright in the upper-right front slot, every required
00–59 number can be reached in at most five HTM, from every legal hidden pose.
The two digits are upright in the lower front row. Upper-left is unconstrained.
This holds for either counting direction, every wrap, and arbitrary subsequent
number choices with the same letter. It is stronger than a single-pass bound
or a guarantee restricted to one deterministic route policy.

## Universal finite proof and induction

The independently rebuilt legal three-sticker graph covers all
`8 × 7 × 6 × 3³ = 9,072` distinct-corner pose triples. Its transitions use the
reviewer's integer Rodrigues engine, with no generator or JavaScript imports.
Each transition is one legal outer-face HTM and therefore also acts legally on
the remaining five physical corners.

Restrict the source triples to those where the required letter sticker is
already upright in its target upper-right slot. This fixes the letter's pose
coordinate to its identity value, leaving `7 × 6 × 3² = 378` possibilities for
the selected tens and units corners. The checker exhaustively enumerates them:

| Distance to the required target triple | Number of source triples |
| --- | ---: |
| 0 | 1 |
| 1 | 6 |
| 2 | 29 |
| 3 | 118 |
| 4 | 180 |
| 5 | 44 |

There are no distance-six sources in this restricted graph. Legal moves have
legal inverses, so the BFS distance from the goal also gives a path from every
listed source to that goal. The preserved immutable print supplies a selection
of three distinct physical corner bodies for every H/S/M × 00–59 target; the
checker independently confirms target selection and legal reachability for
all 180 combinations without trusting generator slot annotations.

Every legal full cube state with the same upright letter projects into one of
these 378 triples for any chosen matching target selection. Thus a path of at
most five moves exists regardless of hidden-corner poses. A shortest planner
to any matching display is no longer than that path. After the move sequence,
the letter is again upright in the required slot. Applying the same argument
inductively proves the bound for arbitrarily many subsequent steps.

This proof does not require a period, a particular tie policy, or retention of
the same hidden pose between steps. Same-letter direction and range changes
are covered. Setup from an arbitrary state and a change of letter are outside
the five-move assertion. Intermediate animated frames need not display a
readable letter or number; the premise and conclusion concern settled states.

## Additional full-state recurrent witnesses

The independently checked [witness](witness.json) contains 18 concrete modes:
three letters × maximum 11/23/59 × forward/backward counting. Across the saved
preperiods and periods, 10,548 edges pass physical replay. Every counting and
wrap edge is at most five HTM and is independently shortest from its actual
full source pose. Setup costs are reported separately.

For each mode, the checker verifies the exact modular number order, every
upright display, the inverse of every edge, and equality of all 24 sticker
identities, positions, normals, and print-up vectors between the saved period
start and final endpoint. This supplies a second, explicit infinite-repetition
argument by replaying a genuinely closed full-state period. A merely matching
visible 00 would not satisfy this check.

## Reproduction and controls

```sh
python3 research/hsm-counter/verify_periodic.py research/hsm-counter/periodic/witness.json
python3 -m unittest discover -s research/hsm-counter -p 'test_verify_periodic.py' -v
```

The structured result, including each mode's period and preperiod lengths,
is saved in [verification.json](verification.json). Adversarial controls reject
a changed print, missing mode, boolean range, incorrect number order, padded
long motion, a visible-only closure with the wrong full pose, an empty period,
and an incorrect maximum. A separate regression checks the exhaustive
378-state histogram and the saved structured result.

No blocking proof findings remain. This establishes existence and correctness
of the stated move bound; global print optimality, whole-route optimality,
animation timing, and hardware performance remain unproved. An application
must use legal moves and correctly replan from the actual full pose to invoke
the universal lemma. This review does not itself approve an application build
or deployment.
