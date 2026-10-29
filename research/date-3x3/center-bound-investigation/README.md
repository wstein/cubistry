# Center bounds and the avoidable long repair

## What the published numbers mean

[Kociemba's primary page](https://kociemba.org/twisted.htm), read October 29,
2026, introduces center twists remaining after an ordinary solve. Its wording is:
“There are 2048 possible ways the center facelets still can be twisted.”
The subsequent 21-face-turn result concerns that residual center subgroup, not
an arbitrary scrambled picture cube. The page also distinguishes face-turn and
slice-turn metrics. This is a source-scope correction, not a newly reproduced
exhaustive proof of the published diameter.

The [ordinary-cube researchers' primary report](https://www.cube20.org/) proves a
20-move bound with quarter and half face turns each counted once. Its separate
[quarter-turn result](https://cube20.org/qtm/) uses 26, with a half turn counted
as two. Neither ordinary-color statement includes marked-center orientation.

Combining the ordinary 20 bound and the residual-center 21 bound gives a
constructive 41-HTM upper bound for a full marked picture goal, in a fixed center
frame. It does not give 21 for the combined problem, and does not imply that
any particular 41-move algorithm is optimal. Secondary sources mention stronger
full-supercube lower bounds, but their linked primary discussion could not be
retrieved during this investigation. This report does **not** certify such a
lower bound or declare the universal full-picture 21 statement false based on
secondary citations. The exact full-picture diameter is **UNKNOWN here**.

## Actual portfolio worst case

The immutable V2 capture's portfolio row 2980 moves German A from April 20 to
April 19, 2024. Replaying the stream from its initial pose reproduces its exact
source hash. The measured word has:

| Component | Outer HTM | Whole-cube rotations |
| --- | ---: | ---: |
| Ordinary cubies to the chosen canonical target | 21 | 2 |
| Existing front half-turn repair | 20 | 0 |
| Existing total | 41 | 2 |
| Verified shorter replacement, after adjacent-face reduction | **32** | **2** |

The two native center-aware attempts returned **UNKNOWN** after their respective
100,000-node budgets at depth 24 and 18. Thus 41 was the retained legal route,
not a proved necessary distance. The bounded solver did not establish UNSAT.

The replacement reaches **exactly the same complete 54-frame endpoint**, not
merely the same front. The saved witness includes the actual source/endpoint
hashes, old/new words, exact HTM/QTM/global counts and inverse restoration.

## Shorter verified repairs

These are front-face conjugates of the first center cases on Kociemba's page:

| Front change from upright | Legal word | HTM |
| --- | --- | ---: |
| Half turn | `F U D F2 U' D' F U D F2 U' D'` | 12 |
| Quarter clockwise | `F U D R2 L2 U' D' B' U D R2 L2 U' D'` | 14 |
| Quarter counterclockwise | Inverse of the previous word | 14 |

All restore every ordinary cubie position and orientation. The half-turn word
changes only the front center. Each quarter-turn word also changes the hidden
back-center orientation; that is permitted by the existing visible-center
repair contract. A consumer must retain that real hidden pose rather than
pretend it reached the former macro's complete endpoint. These are verified
shorter witnesses, with shortestness **UNKNOWN**.

Since the calendar requires only one visible center orientation, combining an
ordinary solution of at most 20 HTM with these witnesses gives an **existence
upper bound of 34 outer HTM**, after aligning the whole-cube center frame.
This is a mathematical composition bound, not a guarantee for the current
bounded implementation. Its heuristic ordinary solver can return 21 or more;
its center-aware search can exhaust its node budget. Neither a universal
21-move calendar bound nor the calendar's optimal distances are established.

## Further optimization opportunity

The current `pictureRequest` assigns ephemeral colors from the entire canonical
54-frame target, constraining hidden ordinary cubies as well as the visible
front. This is a valid sufficient goal, but stronger than the user's actual
nine-cell display requirement. Front-constrained search and alternative valid
hidden targets could improve routes further. A measured improvement must retain
actual physical poses and be benchmarked in new consecutive streams; replacing
quarter repairs changes hidden centers and therefore later searches.

## Reproduce and verify

```sh
python research/date-3x3/center-bound-investigation/verify-short-repairs.py
```

[Verification output](verification.json) records three legal repair witnesses,
15 additional prefix/orientation cases, five rejected corruption controls and
the exact shortened worst-case route. The verifier imports only the historical
independent Python Rodrigues machinery and capture-format helpers; it imports
no application geometry, JavaScript planner or solver. Input/checker hashes are
in [manifest](manifest.json). The original correction table and V1/V2 captures
remain unchanged. A new application integration and fresh benchmark are separate
work, and must not silently replace the historical evidence.

## Cyclic-family follow-up and corrected interpretation

The [cyclic repair addendum](CYCLIC_REPAIRS.md) verifies 52 finite candidate slots,
including inverse half-turn shifts, and actual retained-pose improvements from
35 to34HTM (V3) and41 to31HTM (V2), with complete endpoints unchanged. It also
corrects an earlier inference: the old18/20/18 and new14/12/14 repairs already
have identical all54-frame transformations. Both quarter variants rotate the
same hidden back center; replacing these exact words does not by itself change
hidden endpoints. Changed search rankings/bounds can still select different
routes and alter a later stream. Original verification artifacts remain intact.
