# H/M counter: at most 3 HTM per increment and decrement?

Research question from the owner: can one fixed 2×2×2 print run an hours/minutes
counter where every increment and every decrement costs **at most 3 HTM**?

## Results

| Profile | Upper-left cell | Status of "max 3 HTM" | Evidence |
| --- | --- | --- | --- |
| **blank** (primary, owner's frame) | must show a blank sticker | **UNKNOWN** for max 3. Best found: **max 5** with run-in + repeating period (202 of 228 period edges ≤3, 15 at 4, 11 at 5). Strict one-lap exact closure at max 3 was not found. | [witness](evidence/witness-blank-periodic.tsv), Julia and Flix receipts byte-identical |
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

### Blank profile (primary): max 5 with run-in + period; max 3 UNKNOWN

Every display needs a blank sticker at the upper-left, so all four front
corners are tracked: 136,080 states. Both checkers rebuild this graph
(histogram `0:1,1:15,2:198,3:2030,4:15396,5:61768,6:53528,7:3144`). Only
2,244 states lie within 3 HTM, versus 17–22% in the free profile. The blank
corner's orientation is free: a blank sticker counts in any orientation.

**Periodic result (accepted by Julia and Flix, byte-identical receipts):** the
witness is [evidence/witness-blank-periodic.tsv](evidence/witness-blank-periodic.tsv)
and the print is [prints/blank-periodic.txt](prints/blank-periodic.txt). The
print has three blank stickers on three different corners, H×2, M×3, tens 0–5
and units 0–9 once each, which uses all 24 stickers.

| Mode | Setup | Preperiod edges | Period edges (laps) | Period HTM 1/2/3/4/5 | Period total | Period max |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| M 00..59 | 0 (reference) | 60 | 120 (2) | 2/18/94/6/0 | 344 | 4 |
| H 00..23 | 3 (`U B U`) | 120 | 48 (2) | 0/2/36/5/5 | 157 | 5 |
| H 00..11 (11→00 reset) | 3 (`U B U`) | 36 | 60 (5) | 1/4/45/4/6 | 190 | 5 |
| all periods | | | 228 | 3/24/175/15/11 | 691 | **5** |

Preperiod edges: 216 in total, max 5, HTM 1/2/3/4/5 = 2/14/146/36/18.

- **Max 3 is not reached.** 202 of 228 period edges are ≤3 HTM, 15 need 4 and
  11 need 5. The maximum equals the H/S/M blank baseline's 5 (Python-checked
  there, not re-verified here). The minutes mode alone reaches max 4.
- Many long edges are forced by the graph. The claimed lower bound (shortest
  distance from the actual source state to *any* matching display, recomputed
  by both checkers) equals the word length on 176 of 228 period edges. All
  11 five-HTM period edges have lower bound 5: from those source states no
  matching display is closer. Shortening them would need different earlier
  choices or a different print.
- What was searched (bounded, not exhaustive): simulated annealing over prints
  (glyph and cell per sticker, any number of blanks) with exact set-propagation
  scores. Lap-graph cycle search used radius-3/4/5 balls (3,136 / 31,136 /
  ~280k elements). 2 annealed prints were turned into witnesses, and the better
  one was kept. The other one (prints/blank.txt) also reaches max 5, with
  36 of 204 period edges above 3. **No infeasibility argument for max 3 or
  max 4 was found; both are UNKNOWN.**

**Side result, strict exact closure** (one lap, back to the exact start state,
max 3): not found. With prints/blank.txt, the open minutes walk from one
sampled start had 58 edges ≤3 and 2 at 4 HTM, but it could not return to its
exact start ([blank-open-probe.jl](blank-open-probe.jl), generator-side
diagnostic only). The reachable state sets shrink to 1–20 states. Under
periodic closure, the same print's minutes mode has a one-lap period with
max 4.

Structural fact (computed, not a proof of anything): among the 3,136 group
elements within 3 HTM, exactly 6 keep the UL, UR and LL corners in place and
move LR: `R' B R`, `R' B2 R`, `R' B' R`, `U R U'`, `U R2 U'` and `U R' U'`.
With the upper-left free there are 13 such elements at length 3, plus B, B2
and B'.

#### Periodic definitions (blank profile)

- A **mode** is (letter, range): M 00..59, H 00..23, and H 00..11. The last one
  is the 12-hour cycle, whose 11→00 step is the requested reset. This mirrors
  the H/S/M baseline modes (letter × range), restricted to H and M.
- **Up run**: from the reference print state apply the mode's setup word
  (excluded from the bound), then count 00→01→…→range→00→… with one word per
  edge. The run is a **preperiod** of P edges followed by a **period** of
  Q edges. P and Q are whole laps. The full 24-sticker state after P+Q edges
  equals the state after P edges, so the period repeats forever.
- **Decrement = exact inverse traversal of the period** (same words inverted,
  same lengths). The baseline uses separate down runs instead. Here the owner's
  requirement fixes decrements as the exact inverse of the increment route, and
  the inverse of a closed period is again a closed period, so separate down
  runs are not needed. Decrements are defined on period states. A device in
  the preperiod counts up into the period, or uses setup+preperiod as an
  extended setup.
- The words come from a min-cost search over all matching full states,
  lexicographic on (edges >3 HTM, total HTM). This replaces the baseline's
  fixed tie-break policies. The checkers do not depend on how the words were
  found.

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
- `periodic.jl` (blank profile): annealing with an exact one-lap min-cost
  objective per mode, lap-graph exploration (nodes = full states at 00, edges
  = one lap) to find a reachable cycle, and the v2 witness writer. For v2 the
  checkers also replay every preperiod and period edge, check the period
  boundary (exact full-state repetition) and the inverse-of-period decrement,
  and check the blank upper-left at every display.
- Search used Julia only. No Python is part of the deliverable or of the
  evidence.

## Reproduce

```sh
J=/tmp/claude-0/julia/bin/julia   # Julia 1.13, --startup-file=no
$J --startup-file=no research/hm-counter-3move/finalize.jl free research/hm-counter-3move/prints/free.txt /tmp/witness-free.tsv
HM_B5=1 $J --startup-file=no research/hm-counter-3move/periodic.jl write research/hm-counter-3move/prints/blank-periodic.txt /tmp/witness-blank.tsv
research/hm-counter-3move/flix/build.sh            # Flix 0.79.0 / Java 21 jar
research/hm-counter-3move/checker/run-checks.sh research/hm-counter-3move/evidence/witness-free.tsv /tmp/hm-checks-free
research/hm-counter-3move/checker/run-checks.sh research/hm-counter-3move/evidence/witness-blank-periodic.tsv /tmp/hm-checks-blank
$J --startup-file=no research/hm-counter-3move/blank-open-probe.jl   # strict-closure diagnostic
```

The free witness regenerates byte-identically. The blank witness was produced
by the second command (about 15 minutes, deterministic seeds). Print search:
`periodic.jl anneal2 SEED ITERS OUT INIT`. The blank witness uses format v2
(`mode` rows with preperiod P and period Q, then `step` rows). The free witness
uses v1. Both checkers accept both formats.

`run-checks.sh` writes both receipts and requires them to be byte-identical. It
then runs the negative controls through both checkers. Each control must be
rejected with the intended reason ([evidence/checks-free.tsv](evidence/checks-free.tsv),
[evidence/checks-blank-periodic.tsv](evidence/checks-blank-periodic.tsv)):

| Control | Free (v1) rejection | Blank periodic (v2) rejection |
| --- | --- | --- |
| corrupted glyph (M→H at upper-right) | wrong glyph at cell 2 for M00 after setup | wrong glyph at cell 2 for M59 00 after setup |
| corrupted up vector (units sticker) | glyph not upright at cell 4 for M00 after setup | glyph not upright at cell 4 for M59 00 after setup |
| non-blank sticker at upper-left | n/a | upper-left cell must show a blank sticker at M59 00 after setup |
| route move changed (M step 5→6) | wrong glyph at cell 2 for M 5->6 | wrong glyph at cell 2 for M59 step 5 |
| claimed distance +1 / −1 (too small) | claimed lower bound differs for H 7->8 | claimed lower bound differs for H23 step 0 |
| claimed maximum −1 | claimed maximum edge HTM differs from replay | same |
| truncated wrap word | word shorter than graph distance for M 59->0 | n/a |
| wrong period boundary (one lap moved) | n/a | period boundary: state after preperiod+period must equal state after preperiod for M59 |

## Alternatives (estimate only, not built)

- (a) Accepting the tens glyph at UL **or** LL roughly doubles the target
  selections per display, which helps the blank profile most. It costs
  readability (the tens position moves) and frees no stickers. Not evaluated
  numerically.
- (b) 3×3×3 front face: 54 stickers allow many more copies per glyph, but each
  display then fixes up to 9 front facelets and the state space is far larger.
  No ball sizes were computed in this time box.

## Not established

- Blank profile: max 3 and max 4 are **UNKNOWN**, under both strict and
  periodic closure. The best checked result is max 5 (periodic). The search
  was bounded annealing plus cycle search, not exhaustive, and no
  infeasibility argument was found.
- Blank profile: the words are min-cost for each lap given the lap's start
  state. Global optimality of the cycle, the preperiod length and the setup is
  not claimed.
- Free profile: optimality of the total HTM (236) is not claimed. Neither is
  minimality of the setup word or of the duplicate allocation.
