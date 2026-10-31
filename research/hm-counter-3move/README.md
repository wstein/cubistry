# H/M counter: at most 3 HTM per increment and decrement?

Research question from the owner: can one fixed 2×2×2 print run an hours/minutes
counter where every increment and every decrement costs **at most 3 HTM**?

## Results

| Profile | Upper-left cell | Status of "max 3 HTM" | Evidence |
| --- | --- | --- | --- |
| **blank** (primary, owner's frame) | must show a blank sticker | **UNKNOWN**. No closed witness was found. No infeasibility proof exists. | Generator-side diagnostics only (below) |
| **free** (relaxation) | unconstrained | **SAT**: every transition is at most 3 HTM | [witness](evidence/witness-free.tsv), Julia and Flix receipts byte-identical |

### Free profile (relaxation): SAT, checked by Julia and Flix

There are 85 counted transitions: M 00→01 … 59→00 (60), H 00→01 … 23→00 (24),
and the H 11→00 reset (1). Each one is **at most 3 HTM**.

| | Edges | HTM 1 / 2 / 3 | Total | Mean | Max |
| --- | ---: | --- | ---: | ---: | ---: |
| M 00→…→59→00 | 60 | 3 / 10 / 47 | 164 | 2.733 | 3 |
| H 00→…→23→00 | 24 | 0 / 3 / 21 | 69 | 2.875 | 3 |
| H 11→00 reset | 1 | 0 / 0 / 1 | 3 | 3 | 3 |
| all | 85 | 3 / 13 / 69 | 236 | 2.776 | 3 |

- Both cycles **close on the exact full 24-sticker state**: 59→00 returns to the
  very M00 state and 23→00 returns to the very H00 state. The 11→00 reset
  (`R2 D F`) also lands on that exact H00 state. Decrements are the exact
  inverse traversal, with the same lengths. Wrap-around decrements are 00→59
  and 00→23; in 12-hour use 00→11 is the inverse of the reset word. The counter
  can therefore run forever in either direction within 3 HTM per step.
- Setup and switching are not part of the bound. The reference print state is
  M00 (setup 0 HTM). H00 is reached from M00 by `B' U2 F' R' U2 R F` (7 HTM).
  Switching letters at other values is not optimized. One option is to count
  back to 00 and use the setup word; another is to replan freely, but then the
  device leaves the closed cycle.
- Each edge also carries an independently recomputed lower bound: the shortest
  distance from its source state to *any* state showing the target. This uses
  the 9,072-state graph of the three tracked front stickers (histogram
  `0:1,1:15,2:177,3:1397,4:4981,5:2497,6:4`). For 63 of the 85 transitions the
  word is shortest in this sense. For the others, the extra moves are the price
  of exact closure.
- Print: [prints/free.txt](prints/free.txt). It has no blank sticker. Letters
  H×3 and M×3 sit at upper-right; tens 0–5 (one each) and units 0–9 (with
  duplicates 4, 4, 4, 6) cover the other 18 stickers. Each non-blank sticker is
  upright in exactly one front cell. With a fixed frame, a glyph's up vector
  fixes the corner's rotation, and therefore its cell.

### Blank profile (primary): UNKNOWN

Every display needs a blank sticker at the upper-left. That tracks all four
front corners: 136,080 states. The checker rebuilds this graph (histogram
`0:1,1:15,2:198,3:2030,4:15396,5:61768,6:53528,7:3144`; 2,244 states within
3 HTM, versus 17–22% in the free profile).

What the time box did and did not establish:

- **Not established**: no closed blank-profile walk was found at any maximum.
  Neither checker has accepted a blank-profile witness. No claim is made about
  the achievable maximum.
- Generator-side diagnostic only (not a proof; [blank-open-probe.jl](blank-open-probe.jl)).
  It uses the annealed print [prints/blank.txt](prints/blank.txt): three blank
  stickers on three different corners, H×2, M×3. From one sampled M00 state,
  exact set propagation reaches all 60 M edges as an **open** walk: 58 edges at
  ≤3 HTM and 2 at 4 HTM (46→47 and 51→52). The 59→00 step cannot return to
  the exact start state, though: only 11 states remain, and none of them is the
  start. The reachable sets shrink to 1–20 states. This suggests that exact
  closure, not the per-edge distance, is the binding constraint here.
- Structural fact, computed and not a proof of anything: among the 3,136 group
  elements within 3 HTM, exactly 6 keep the UL, UR and LL corners in place and
  move LR. They are `R' B R`, `R' B2 R`, `R' B' R`, `U' R U`, `U' R2 U` and
  `U' R' U`. With the free cell there are 13 at length 3, plus B, B2 and B'.
- Baseline for comparison (research/hsm-counter/blank, H/S/M, Python-checked,
  not re-verified here): canonical runs at most 5 HTM, using preperiod plus
  period. A closure in that weaker, eventually periodic sense was **not tried**
  here and is the natural next step for the blank profile.

## Model (stated interpretations)

- 2×2×2, fixed frame (no whole-cube rotations), 8 rigid corners, 24 immutable
  stickers. The 18 generators R/L/U/D/F/B in quarter, inverse and half turns
  each cost 1 HTM. There are no optical aliases and no replacement stickers.
- Front cells: upper-right = letter (H or M), lower-left = tens,
  lower-right = units, all upright. Upper-left is blank (blank profile) or
  unconstrained (free profile). A blank sticker reads as blank in every
  orientation.
- Minutes 00..59 with 59→00. Hours 00..23 with 23→00, plus 11→00. Leading
  zeros are shown.
- **Interpretation:** "every transition at most 3" is taken to hold forever.
  The increment cycle must therefore return to the exact full state (all
  24 stickers), not just the same display. The reset must hit the exact H00
  state. This is stronger than the H/S/M baseline's open routes and periodic
  runs.
- Capacity note, correcting the brief: because a glyph's up vector fixes its
  cell, tens and units digits cannot share stickers. The minimum is 2 letters
  + 6 tens + 10 units = 18 stickers, plus blanks in the blank profile. Only
  6 stickers remain for blanks and duplicates, not 12.

## Method

- `engine.jl`: full-state model. A state is a tuple of 8 corner rotations.
  Group elements within radius 3 and 4 (3,136 and 31,136 elements) are
  precomputed, with per-cell bitsets, so the matching successors of a state
  are found with a few bitset operations.
- `construct.jl` and `anneal.jl`: a lazy-print depth-first search seeds a
  print. Simulated annealing then scores prints by exact set propagation of
  *all* full states reachable through the chains. Edges at radius 4 and
  larger gaps are penalized.
- `solve.jl` and `finalize.jl`: for a fixed print, exact set propagation with
  minimum accumulated HTM is followed by exact closure at 59→00, 23→00 and
  11→00, then backtracking to words. The output is the TSV witness. These are
  candidate producers only.
- `checker/check.jl` (native Julia) and `flix/src/Main.flix` (native Flix
  0.79.0) were written independently of the generator and of each other. Each
  one parses the witness and validates the 24-facelet lattice, the rigid
  corners and the tangent up vectors. It turns stickers with integer Rodrigues
  quarter turns and replays the setups, every increment, the exact inverse
  decrement traversal and the reset. It checks the displays (including the
  blank upper-left in the blank profile) and exact full-state closure. It
  rebuilds the tracked-sticker graph (3 or 4 stickers), verifies every claimed
  lower bound and the claimed maximum, and prints a canonical receipt.
- Search used Julia only. No Python is part of the deliverable or of the
  evidence.

## Reproduce

```sh
J=/tmp/claude-0/julia/bin/julia   # Julia 1.13, --startup-file=no
$J --startup-file=no research/hm-counter-3move/finalize.jl free research/hm-counter-3move/prints/free.txt /tmp/witness-free.tsv
research/hm-counter-3move/flix/build.sh            # Flix 0.79.0 / Java 21 jar
research/hm-counter-3move/checker/run-checks.sh research/hm-counter-3move/evidence/witness-free.tsv /tmp/hm-checks
$J --startup-file=no research/hm-counter-3move/blank-open-probe.jl   # blank diagnostic
```

`run-checks.sh` writes both receipts and requires them to be byte-identical. It
then runs the negative controls through both checkers. Each control must be
rejected with the intended reason ([evidence/checks-free.tsv](evidence/checks-free.tsv)):

| Control | Rejection (both checkers) |
| --- | --- |
| corrupted glyph (M→H at upper-right) | wrong glyph at cell 2 for M00 after setup |
| corrupted up vector (units sticker) | glyph not upright at cell 4 for M00 after setup |
| corrupted route move (M 5→6) | wrong glyph at cell 2 for M 5->6 |
| corrupted claimed distance (H 7→8 lower bound +1) | claimed lower bound differs for H 7->8 |
| corrupted claimed maximum | claimed maximum edge HTM differs from replay |
| truncated wrap word (M 59→00 emptied) | word shorter than graph distance for M 59->0 |
| non-blank sticker at upper-left (blank profile only) | implemented in `run-checks.sh`; not exercised, because no blank witness exists |

## Alternatives (estimate only, not built)

- (a) Accepting the tens glyph at UL **or** LL roughly doubles the target
  selections per display, which helps the blank profile most. It costs
  readability (the tens position moves) and frees no stickers. Not evaluated
  numerically.
- (b) 3×3×3 front face: 54 stickers allow many more copies per glyph, but each
  display then fixes up to 9 front facelets and the state space is far larger.
  No ball sizes were computed in this time box.

## Not established

- Blank profile: whether max 3 (or max 4) is feasible with exact closure, or
  with eventually periodic closure, is **UNKNOWN**.
- Free profile: optimality of the total HTM (236) is not claimed. Neither is
  minimality of the setup word or of the duplicate allocation.
- The Flix and Julia checkers have only accepted the free-profile witness.
  The blank code path (4 tracked stickers, blank at upper-left) is
  implemented and its graph size (136,080) was checked in Julia, but it has
  not yet accepted an actual blank witness.
