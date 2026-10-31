# H/M counter: at most 3 HTM per increment and decrement?

Research question from the owner: can one fixed 2×2×2 print run an hours/minutes
counter where every increment and every decrement costs **at most 3 HTM**?

## Results

| Profile | Upper-left cell | Status of "max 3 HTM" | Evidence |
| --- | --- | --- | --- |
| **blank** (primary, owner's frame) | must show a blank sticker | **Max 3 SAT for the minutes alone** (m3-SH, s3-MH) **or for both hour modes alone** (hours3). The other field stays at max 4. All three modes at max 3 on one print: **UNKNOWN**. Every mode at max 4 is SAT (R1, s3-SH and others). | [witnesses](evidence/), Julia and Flix receipts byte-identical |
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
- Each edge also carries a lower bound recomputed by both checkers: the shortest
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

### Blank profile, fifth attempt: M/S S3 and M3 structures imported — max 3 reached for minutes or for both hour modes (checked)

Inputs: the M/S study's prints S3 and M3 (PR #138, commit `d497312`, copied
with provenance into [ms-import/](ms-import/PROVENANCE.md)). In both, each of
the three blanks sits on a corner that also carries two tens digits, and the
letters are spread over four corners. In S3 the S counter stays within 3 HTM
throughout, using a two-lap period. [ms-import/msconvert.jl](ms-import/msconvert.jl)
relabels their letters and converts their up runs into route seeds:
s3-MH (S3 with S→M, M→H), s3-SH (S→H), m3-SH (M3 with S→H) and m3-MH.

**Exact max-3 screen** ([fixpoint.jl](fixpoint.jl), generator-side; the tool
finds limits of any length, so multi-lap periods are covered):

| Print | M 00..59 | H 00..23 | H 00..11 |
| --- | --- | --- | --- |
| s3-MH | feasible (limit 39) | infeasible | infeasible |
| s3-SH | infeasible | **feasible** (limit 19) | infeasible |
| m3-SH | feasible (limit 3) | infeasible | infeasible |
| m3-MH | infeasible | infeasible | infeasible |
| hours3 (annealed from s3-SH, 10 stickers changed) | infeasible | **feasible** | **feasible** |

Hours3 came from annealing over all 21 non-blank stickers of s3-SH, with the
sum of the three exact fixpoint penalties as the objective. It reached max 3
for both hour modes within 8 iterations. The minutes penalty did not reach 0
in 889+ iterations; a second run seeded from m3-SH made no progress on the
hours.

**Checked witnesses.** Per mode: edges (laps) / total HTM / edges at 4 / max.
Run-in 0 everywhere. Every row is accepted by both checkers with
byte-identical receipts; the negative controls are in the
`evidence/checks-blank-*.tsv` files.

| Print (sticker changes vs H/S/M; H setups) | M 00..59 | H 00..23 | H 00..11 |
| --- | --- | --- | --- |
| R1 final (4; 16 / 16) | 60 (1) / 159 / 9 / 4 | 24 (1) / 78 / 7 / 4 | 12 (1) / 40 / 4 / 4 |
| **m3-SH** (24; 4 / 4) | 60 (1) / 163 / 0 / **3** | 24 (1) / 73 / 5 / 4 | 12 (1) / 40 / 5 / 4 |
| **s3-MH** (20; 9 / 10) | 120 (2) / 324 / 0 / **3** | 24 (1) / 73 / 3 / 4 | 12 (1) / 40 / 6 / 4 |
| **s3-SH** (22; 8 / 4) | 60 (1) / 177 / 3 / 4 | 24 (1) / 65 / 0 / **3** | 12 (1) / 38 / 4 / 4 |
| **hours3** (23; 16 / 15) | 60 (1) / 190 / 13 / 4 | 24 (1) / 61 / 0 / **3** | 12 (1) / 32 / 0 / **3** |
| M/S S3, for reference (M/S checkers) | S: 120 (2) / 324 / 0 / 3 | — | — |

- **Minutes at max 3: SAT** (m3-SH, one lap, 163 HTM; s3-MH, two laps,
  162 HTM per lap). The hours stay at max 4.
- **Both hour modes at max 3: SAT** (hours3: H 00..23 61 HTM, H 00..11
  32 HTM, one lap each). The minutes stay at max 4 with 13 edges at 4.
- **All three modes at max 3 on one print: UNKNOWN.** None of the prints
  above admits it (exact fixpoint), and the bounded annealing did not find
  one.
- Compared with R1 using the lexicographic order (max, edges at max, total),
  **s3-SH is better on every mode**: M has 3 instead of 9 edges at 4,
  although its total is 177 against 159; H 00..23 reaches max 3; H 00..11 has
  the same 4 edges at 4 and 38 against 40 HTM. If the minutes total of 159
  must not get worse, R1 stays on the Pareto front. m3-SH, s3-MH and hours3
  are Pareto alternatives.
- Sticker changes in the table are counted position by position against the
  H/S/M seconds-first print, so S3 and M3 derivatives count as almost entirely
  repositioned (20–24 stickers; m3-SH 24). R1 changes only 4. Counted by
  artwork instead (printed glyphs as a multiset, position and orientation
  ignored), **every print in the table needs only 3 newly printed stickers**:
  the H/S/M set has S×3, H, M, and every print here uses five H/M letters
  (R1: M×3, H×2; m3-SH: H×2, M×3), so the three S stickers are reprinted as
  letters; the 3 blanks and 16 digits are the same multiset.
- Checker semantics changed in two respects: both checkers now also require
  the **period to be minimal** (no earlier whole-lap repetition), which the
  new "period too long" control needs, and the **distinct-state rule**: the
  Q full states inside a period are pairwise distinct (see the periodic
  definitions). New controls: period too long (period rows repeated, rejected
  as not minimal), period too short (last lap of a multi-lap period removed,
  rejected at the period boundary; exercised on s3-MH), exact closure,
  distinct states, lower bound +1 and claimed maximum +1 (see
  [the controls table](#reproduce)). Inert H is not needed here: H is an
  active letter.

### Blank profile, fourth attempt: improving R1 and deciding max 3 exactly (R1 still on the Pareto front; its max-3 status is superseded by the fifth)

**Final print: R1** (unchanged sticker set: 4 stickers differ from the
H/S/M seconds-first print, ids 10, 14, 18 S→M and id 20 M→H). The final
witness uses an improved H 00..23 route chosen with the owner's lexicographic
objective (max, then edges at the max, then total):
[evidence/witness-blank-R1-final.tsv](evidence/witness-blank-R1-final.tsv).

Pareto table, all rows measured by both native checkers with byte-identical
receipts. Per mode: edges / total HTM / edges at 4 HTM / max. All periods
are one lap with run-in 0.

| Print (sticker changes vs H/S/M; H setup HTM) | M 00..59 | H 00..23 | H 00..11 |
| --- | --- | --- | --- |
| restricted H/S/M (0; S inert) | 120 / 408 / 30 (+9 at 5) / 5 (2 laps) | 48 / 164 / 10 (+7 at 5) / 5 (2 laps) | 12 / 40 / 4 / 4 |
| R1, third attempt (4; 16) | 60 / 159 / 9 / 4 | 24 / 78 / 8 / 4 | 12 / 40 / 4 / 4 |
| **R1 final (4; 16)** | **60 / 159 / 9 / 4** | **24 / 78 / 7 / 4** | **12 / 40 / 4 / 4** |
| R1, alternative minutes route (4; 13) | 60 / 182 / 8 / 4 | 24 / 78 / 7 / 4 | 12 / 40 / 4 / 4 |
| HHHMM (4; 12) | 60 / 192 / 20 / 4 | 24 / 70 / 10 / 4 | 12 / 32 / 2 / 4 |
| annealed for hours (18; 14) | 60 / 190 / 14 / 4 | 24 / 70 / 3 / 4 | 12 / 38 / 4 / 4 |

- R1 final dominates the restricted H/S/M print on every mode and improves
  the third-attempt R1 on H 00..23 (7 instead of 8 edges at 4, same total).
  The other rows are Pareto alternatives. They trade minutes quality for
  hours quality (HHHMM, annealed) or minutes total for one fewer 4-HTM edge
  (alternative route). None of them dominates R1 final.
- Of R1 final's 20 edges at 4 HTM, **13 have lower bound 4** (M: 9 of 9,
  H 00..11: 4 of 4). No 3-move word from those source states reaches any
  matching display. The 7 in H 00..23 have lower bound 3. They are long
  because the closed cycle needs them, not because the graph forces it.

**Max 3: exact fixpoint decision (generator-side, [fixpoint.jl](fixpoint.jl)).**
For a print and a mode, U is the set of all full states showing that mode's
00 display. The tool enumerates U exactly (blank in any orientation; twist-sum
invariant checked under 20,000 random moves). It then iterates
X ← Lap3(X), keeping the states at 00 reachable from X by one lap whose every
edge is ≤ 3 HTM. The chain decreases, and its limit is nonempty exactly when
some ≤ 3 HTM up run of that mode can continue forever for that print. As a
sanity check, the same computation with radius 4 gives a large nonempty limit
for R1 (3,837 / 2,234 / 2,098 states).

| Print | M 00..59 | H 00..23 | H 00..11 |
| --- | --- | --- | --- |
| R1 | infeasible (no lap from any of 5,832 states) | infeasible (3,888) | infeasible (3,888) |
| restricted H/S/M | infeasible | infeasible | infeasible |
| HHHMM | infeasible | infeasible | infeasible (dies in lap 2) |
| second attempt | infeasible (dies in lap 2) | infeasible | infeasible (dies in lap 2) |
| annealed for hours | infeasible | infeasible (dies in lap 2) | **feasible** (limit 1 state) |

- **For print R1, max 3 is impossible on every mode**, for every route,
  run-in and period, under this model. The result is generator-side, but each
  claim is a finite exact computation, reproducible with `fixpoint.jl`.
- Keeping R1's minutes period exactly fixes 20 of the 24 stickers (every
  sticker it shows; [baseline/enum-free2-fixpoint.tsv](baseline/enum-free2-fixpoint.tsv)).
  All 35 assignments of the two remaining non-blank stickers were enumerated
  exhaustively. They cover H or M at the upper-right, any tens digit or any
  units digit, with at least one H, which includes every R2(d). **Max 3 for
  H 00..23 and H 00..11 is infeasible in all 35.** So max 3 for the hours
  needs a different minutes route, not only a relabeling of the free stickers.
- Annealing over all 24 stickers (seeded from R1 and HHHMM, three blanks
  kept) found a print whose H 00..11 admits a ≤ 3 HTM cycle. That print
  (`prints/annealed-h11max3-candidate.txt`, 18 sticker changes) has no ≤ 3
  cycle for M 00..59 or H 00..23. Its checked witness above still uses a
  4-HTM H 00..11 cycle, because the route search did not reach the one-state
  limit. *(Superseded by the fifth attempt.)* At the time of this attempt,
  max 3 was UNKNOWN for M 00..59 and H 00..23 in general, and no single print
  with max 3 on even one mode had been checked by both checkers. The fifth
  attempt above now has checker-accepted max-3 witnesses for M 00..59 alone
  (m3-SH, s3-MH) and for both hour modes alone (hours3). Max 3 for all three
  modes on one print remains **UNKNOWN**.

### Blank profile, third attempt: warm start from the H/S/M seconds-first print (superseded by the fourth)

The best H/M print can never be worse than an H/S/M print restricted to H and
M, because a print that works with three letters still works when the S
stickers are ignored. So the third attempt starts from the seconds-first
H/S/M print. Its 24 stickers are 3 blanks, 6 tens, 10 units and five letters:
S ×3 (ids 10, 14, 18), H (id 19) and M (id 20).
[baseline/hmsconvert.jl](baseline/hmsconvert.jl) converts it from
origin/main `data/hsm/seconds-first/modes/witness.json`. The JSON is first
flattened with `jq` into [baseline/hms-print-flat.tsv](baseline/hms-print-flat.tsv),
and the converter cross-checks every up vector against its slot. The
converter relabels the five letter stickers in id order. The H/S/M up-direction
runs ([baseline/hms-up-routes.tsv](baseline/hms-up-routes.tsv)) remain valid
for every relabeling that keeps the stickers they use. Each mode then takes
the better of those routes and this folder's lap-graph cycle search. The
objective is no edge above 4 first (10⁶ per 5-HTM edge), then total HTM.

All rows below are measured by **both** native checkers (byte-identical
receipts) under this folder's definitions: blank upper-left, run-in plus
repeating full-state period, and decrement = exact inverse of the up period.

| Print | M 00..59 edges / total / mean / max / laps | H 00..23 | H 00..11 | Run-ins |
| --- | --- | --- | --- | --- |
| restricted H/S/M (SSSHM, S inert) | 120 / 408 / 3.40 / 5 / 2 | 48 / 164 / 3.42 / 5 / 2 | 12 / 40 / 3.33 / 4 / 1 | 0 |
| **R1 = MMMHH (final)** | **60 / 159 / 2.65 / 4 / 1** | **24 / 78 / 3.25 / 4 / 1** | **12 / 40 / 3.33 / 4 / 1** | 0 |
| relabeling HHHMM (Pareto alternative) | 60 / 192 / 3.20 / 4 / 1 | 24 / 70 / 2.92 / 4 / 1 | 12 / 32 / 2.67 / 4 / 1 | 0 |
| second attempt (prints/blank-periodic.txt) | 120 / 344 / 2.87 / 4 / 2 | 48 / 157 / 3.27 / 5 / 2 | 60 / 190 / 3.17 / 5 / 5 | 216 edges, max 5 |

- **R1 dominates the restricted H/S/M print on every mode.** Max: 4/4/4 versus
  5/5/4. Mean per edge: 2.65/3.25/3.33 versus 3.40/3.42/3.33. Total per lap:
  159/78/40 versus 204/82/40. H 00..11 is equal (one lap, 40 HTM, max 4).
  R1 also beats the second attempt on every mode.
- R1's M mode reproduces the H/S/M **S** route exactly: 60 edges, 159 HTM,
  max 4. Its H 00..11 run is the H/S/M H route (40 HTM). Its H 00..23 run
  comes from this folder's search (78 HTM, max 4), which beats the H/S/M H
  route (164 per 48, max 5).
- **Max 4: SAT** on all modes (checker-accepted). Every period is one lap and
  starts right at setup (run-in 0), so this also satisfies the strict
  one-lap exact-closure model at max 4. **Max 3: UNKNOWN.** R1 has 9 + 8 + 4
  edges at 4 HTM. All 60 M edges and all 12 H 00..11 edges equal the
  recomputed lower bound for their source state (receipt column `tight`).
- Screening of all 30 letters-only relabelings with H ≥1 and M ≥1, using the
  given routes only, is in [baseline/screen-relabelings.tsv](baseline/screen-relabelings.tsv).
  MMMHM, MMMMH and MMMHH get the S route for M (159/60, max 4). The variants
  with S stickers turned into H (HHHMM, HHHHM, HHHMH) get the S routes for both
  H modes (68/24 max 5, 32/12 max 4). Only R1 and HHHMM also got the full
  search. Setups: R1 M 0 (reference state), H 16 HTM each; not part of the
  bound.

Not done in this time box: the R2(d) variants (old M sticker turned into
digit d with a new up vector), the one-H/one-M variants with freed letter
stickers as digit duplicates, and general annealing over all 24 stickers
seeded from R1. These are the next steps toward lower totals or max 3.

### Blank profile, second attempt (superseded by the third): max 5 with run-in + period

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
- The period is **minimal** (the state after P edges does not reappear at an
  earlier whole-lap boundary) and its Q full states are **pairwise distinct**
  (distinct-state rule), so every period state has exactly one successor word
  and the period can be run by a device that knows only the full state. The
  rule covers period states only. Preperiod states may coincide with period
  states: P must be a whole number of laps, so a run-in that joins the cycle
  in the middle of a lap repeats period states until the next lap boundary.
  This happens in the second-attempt witness (M: the states before steps
  39–59 equal those before steps 159–179, counted from the setup; H 00..23
  and H 00..11 similarly), which both checkers accept.
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
  0.79.0) share no code with the generator. They are **not** independent of
  each other: the Flix checker is a structural port of the Julia checker (see
  [Checker independence](#checker-independence)). Each one parses the witness and validates the 24-facelet lattice, the rigid
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

### Checker independence

The two checkers are two implementations of **one** design, not two designs.
`flix/src/Main.flix` was written as a structural port of `checker/check.jl`:
the same decomposition (parse print, replay, display check, tracked-sticker
graph, lower bound), the same integer Rodrigues turn formula, the same
breadth-first search over the same tracked slots and pose encoding, the same
candidate enumeration for the lower bound (blank stickers tried in every
tangent orientation), the same period, minimality and distinct-state rules,
and the same reject strings. What the port does buy is independence from
language-level mistakes: separate parsers, separate integer and list
handling, separate hashing and receipt formatting, and a byte-for-byte receipt
comparison, so a slip in one implementation of the shared design shows up as
a dissent.

Common-mode risks that byte-identical receipts do **not** rule out:

- a modeling error in the shared design: move sign convention (k = −side ×
  amount), the cell coordinates and the "upright" up vector (0,1,0), the
  definition of an increment, the reset or the decrement;
- an error in the lower-bound argument itself: the tracked-sticker graph and
  the rule that a blank reads in every orientation are taken over unchanged,
  so a wrong but consistent bound would be confirmed by both;
- a rule that both omit (the distinct-state rule inside a period was missing
  from both until an independent PR review pointed it out);
- shared reading of the witness format, including what counts as a field.

Before the integer grammar below was shared, the two parsers disagreed on
malformed numbers (Julia accepted `+4`, ` 4`, `4 `, `0x4` and padded
naturals and crashed on `4e0`, empty or 20-digit fields; Flix rejected them).
The committed witnesses never used such fields, so no receipt changed; the
cause was Julia's `parse(Int, …)` accepting more than the regular expression
in front of it was meant to allow, and no check in front of some fields.

## Reproduce

```sh
J=/tmp/claude-0/julia/bin/julia   # Julia 1.13, --startup-file=no
$J --startup-file=no research/hm-counter-3move/finalize.jl free research/hm-counter-3move/prints/free.txt /tmp/witness-free.tsv
HM_B5=1 $J --startup-file=no research/hm-counter-3move/periodic.jl write research/hm-counter-3move/prints/blank-periodic.txt /tmp/witness-blank.tsv
HM_PEN4=0 HM_B5=1 $J --startup-file=no research/hm-counter-3move/periodic.jl write2 research/hm-counter-3move/prints/hms-R1-MMMHH.txt /tmp/witness-R1.tsv research/hm-counter-3move/baseline/hms-up-routes.tsv
HM_PEN4=0 HM_B5=1 HM_HSTARTS=0 $J --startup-file=no research/hm-counter-3move/periodic.jl write2 research/hm-counter-3move/prints/hms-restricted.txt /tmp/witness-hms.tsv research/hm-counter-3move/baseline/hms-up-routes.tsv
HM_PEN4_M=0 HM_PEN4_H=1000 HM_B5=1 $J --startup-file=no research/hm-counter-3move/periodic.jl write2 research/hm-counter-3move/prints/hms-R1-MMMHH.txt /tmp/witness-R1-final.tsv research/hm-counter-3move/baseline/hms-up-routes.tsv
$J --startup-file=no research/hm-counter-3move/fixpoint.jl research/hm-counter-3move/prints/hms-R1-MMMHH.txt   # exact max-3 decision per mode
HM_PEN4=1000 HM_FSTARTS=1 $J --startup-file=no research/hm-counter-3move/fixpoint.jl write3 research/hm-counter-3move/prints/hours3.txt /tmp/witness-hours3.tsv research/hm-counter-3move/ms-import/routes-s3-SH.tsv
research/hm-counter-3move/flix/build.sh            # Flix 0.79.0 / Java 21 jar
research/hm-counter-3move/checker/run-checks.sh research/hm-counter-3move/evidence/witness-free.tsv /tmp/hm-checks-free
research/hm-counter-3move/checker/run-checks.sh research/hm-counter-3move/evidence/witness-blank-periodic.tsv /tmp/hm-checks-blank
research/hm-counter-3move/checker/run-malformed.sh research/hm-counter-3move/evidence/witness-blank-m3-SH.tsv research/hm-counter-3move/evidence/witness-free.tsv /tmp/hm-checks-malformed
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
[evidence/checks-blank-periodic.tsv](evidence/checks-blank-periodic.tsv) and the other
`evidence/checks-blank-*.tsv` files):

| Control | Free (v1) rejection | Blank (v2) rejection, every v2 witness |
| --- | --- | --- |
| corrupted glyph (M→H at upper-right) | wrong glyph at cell 2 for M00 after setup | wrong glyph at cell 2 for M59 00 after setup |
| corrupted up vector (units sticker) | glyph not upright at cell 4 for M00 after setup | glyph not upright at cell 4 for M59 00 after setup |
| non-blank sticker at upper-left | n/a | upper-left cell must show a blank sticker at M59 00 after setup |
| route move changed (M step 5→6) | wrong glyph at cell 2 for M 5->6 | wrong glyph at cell 2 (or another display error) for M59 step 5 |
| claimed lower bound +1 (v1: every H 7→8 edge; v2: first H 00..23 step with bound ≥ 1) | claimed lower bound differs for H 7->8 | claimed lower bound differs for H23 step *k* |
| claimed lower bound −1 (same v2 step) | n/a | claimed lower bound differs for H23 step *k* |
| claimed maximum −1 | claimed maximum edge HTM differs from replay | same |
| claimed maximum +1 | claimed maximum edge HTM differs from replay | same |
| truncated wrap word | word shorter than graph distance for M 59->0 | n/a |
| wrong period boundary: one lap moved (period ≥ 2 laps or preperiod > 0), else one edge moved | n/a | period boundary: … for M59, or preperiod and period must be whole laps (one-lap witnesses) |
| exact closure: last M period word gets a trailing `B` (displays stay correct, full state does not close) | n/a | period boundary: state after preperiod+period must equal state after preperiod for M59 |
| period too long: M period rows repeated, Q doubled | n/a | period is not minimal for M59 |
| period too short: last lap of the first multi-lap period removed (only witnesses with one) | n/a | period boundary: … for that mode |
| distinct states: M period run twice, first copy ends with `B`, second starts with `B'` (minimal, closes, but repeats a full state) | n/a | full state repeats within the period for M59 |

For one-lap periods the "wrong period boundary" control can only hit the
whole-lap rule; the "exact closure" control is the one that exercises exact
full-state closure there.

[checker/run-malformed.sh](checker/run-malformed.sh) adds negative controls for
the integer grammar and for broken files, run once on a v2 witness (m3-SH) and
on the v1 witness ([evidence/checks-malformed.tsv](evidence/checks-malformed.tsv)).
Every numeric field (sticker id, cubie id, vector component, preperiod,
period, lower bound, reset lower bound, claimed maximum) follows one grammar in
both checkers: a natural number is `0` or a nonzero ASCII digit followed by at
most five ASCII digits (no sign, no leading zeros, no spaces, at most 6
digits); a vector component may also be `-` followed by a nonzero natural.
Anything else is rejected with `malformed number in <field>`. The controls
cover `+4`, ` 4`, `4 `, `0x4`, `4e0`, an empty field, `4x`, `04`, 7- and
20-digit padded values, a 20-digit overflow, `-4`, `-0` and `+1` in vectors,
padded or signed ids, preperiod and period, lower bounds in v1 and v2, the v1
reset bound, a truncated file, a truncated print, a missing or doubled `end`
row, and invalid UTF-8. Each is rejected by both checkers with the same
reason; none raises an uncaught exception.

## Alternatives (estimate only, not built)

- (a) Accepting the tens glyph at UL **or** LL roughly doubles the target
  selections per display, which helps the blank profile most. It costs
  readability (the tens position moves) and frees no stickers. Not evaluated
  numerically.
- (b) 3×3×3 front face: 54 stickers allow many more copies per glyph, but each
  display then fixes up to 9 front facelets and the state space is far larger.
  No ball sizes were computed in this time box.

## Not established

- Blank profile: max 3 for all three modes on one print is UNKNOWN. Max 3
  for the minutes alone or for both hour modes alone is SAT (checked). Max 3
  is impossible for print R1 and for the 35 two-sticker variants that keep its minutes period
  (exact generator-side fixpoint, not a checker claim). It is UNKNOWN for
  prints in general: the annealing over all 24 stickers was bounded, and its
  one H 00..11 max-3 print was not turned into a checked witness. The
  fixpoint verdicts are not re-derived by the Julia/Flix checkers.
- Blank profile: the words are min-cost for each lap given the lap's start
  state. Global optimality of the cycle, the preperiod length and the setup is
  not claimed.
- Free profile: optimality of the total HTM (236) is not claimed. Neither is
  minimality of the setup word or of the duplicate allocation.
