# M/S counter: at most 3 HTM per increment and decrement?

Research question from the owner: is there a fixed 2×2×2 print, modeled on the
H/S/M cube, that runs a minutes counter and a seconds counter (fields M and S
only), where every increment and every decrement costs **at most 3 HTM**? The
edges are M 00→01 … 59→00 and S 00→01 … 59→00. There are no hour resets.

## Result

**Blank profile (owner's frame): "max 3 for both letters" is UNKNOWN.** It was
not found and is not proven infeasible. The best established result is
**max 4 HTM with only 3 edges at 4**. Two different prints reach it. On each,
one letter is entirely within 3 HTM:

| Witness | M run | S run | Closure | Checkers |
| --- | --- | --- | --- | --- |
| **S3** ([witness-s3.tsv](evidence/witness-s3.tsv)), primary | max 4: 57 edges ≤ 3, 3 at 4; 177 HTM | **max 3: all edges ≤ 3**; 162 HTM per 60 edges | M exact (period 1); S period 2 (120 edges), run-in 0 | Julia = Flix (byte-identical); 11/11 controls rejected by both |
| **M3** ([witness-m3.tsv](evidence/witness-m3.tsv)) | **max 3: all edges ≤ 3**; 163 HTM | max 4: 57 edges ≤ 3, 3 at 4; 171 HTM | exact (period 1) for both | Julia = Flix (byte-identical); 10/10 controls rejected by both |

The free profile (upper-left unconstrained) was not run in this time box.

S3 is primary because it dominates the H/S/M seconds-first print restricted
to M and S on every mode, comparing maximum first, then edges at the maximum
(next section). M3 is kept because its closure is exact for both letters.

### Comparison with the H/S/M seconds-first print restricted to M and S

Any H/S/M print is also an M/S print once H is ignored, so the H/S/M
seconds-first print (origin/main `010da4e8`,
`data/hsm/seconds-first/modes/witness.json`) is the baseline. Its printing was
converted with the slot/up consistency asserted for all 24 stickers
([hms-seconds-first-printing.txt](evidence/hms-seconds-first-printing.txt),
`hmsbase.jl`). The H sticker stays printed and inert. Under this study's
closure rule (exact inverse decrements, edges up to 4) it was then
re-optimized, and **both checkers accept it**:
[witness](evidence/witness-hms-restricted.tsv), receipts byte-identical,
controls in [checks-hms-restricted.tsv](evidence/checks-hms-restricted.tsv).
That print was also the seed of the search that found S3.

| Mode | H/S/M as published (separate up/down runs) | Same print, re-optimized here | **S3** | M3 |
| --- | --- | --- | --- | --- |
| S 00..59 up | max 4, 159 HTM / 60 | max 4, 3 edges at 4, 159 HTM | **max 3**, 0 edges at 4, 162 HTM / 60 | max 4, 3 edges at 4, 171 HTM |
| S 00..59 down | max 5, 171 HTM / 60 | inverse of up: max 4, 3 edges at 4, 159 | inverse of up: **max 3**, 162 | inverse of up: max 4, 3 edges at 4, 171 |
| M 00..59 up | max 5, 408 HTM / 120 (mean 3.40) | max 4, 15 edges at 4, 195 HTM | max 4, **3** edges at 4, **177** HTM | **max 3**, 163 HTM |
| M 00..59 down | max 5, 819 HTM / 240 | inverse of up: max 4, 15 edges at 4, 195 | inverse of up: max 4, 3 edges at 4, 177 | inverse of up: **max 3**, 163 |

How the definitions differ: the H/S/M witness optimizes up and down as
separate periodic runs, with their own setups and periods. This study keeps
the owner's rule that decrements are the exact inverse traversal of the up
period, so down mirrors up exactly. Both use full-state periods with a
run-in. With setup excluded, the run-in here is 0.

**Dominance.** Order of comparison: maximum HTM, then edges at the maximum,
then total HTM. **S3 dominates the restricted H/S/M print on all four
modes.** On S it is strictly better on the maximum (3 against 4), even though
its S total is 3 HTM higher per 60 edges (162 against 159). On M it is better
on all three criteria. M3 does not dominate: its S run ties on max and
edges at 4 but costs 171 against 159 HTM.

### Witness S3 (primary)

Receipts: [Julia](evidence/receipt-s3.julia.tsv) and
[Flix](evidence/receipt-s3.flix.tsv) are byte-identical. Controls:
[checks-s3.tsv](evidence/checks-s3.tsv).

| Run | Period edges | HTM 1 / 2 / 3 / 4 | Total | Max | Word = lower bound |
| --- | ---: | --- | ---: | ---: | ---: |
| M | 60 | 0 / 6 / 51 / 3 | 177 | 4 | 51 |
| S | 120 (2 laps) | 6 / 24 / 90 / 0 | 324 | **3** | 80 |

The three 4-HTM edges are M 14→15 (`R' F2 L F2`), M 35→36 (`F2 L' F2 R`) and
M 55→56 (`F2 L' F2 R`). Each has lower bound 3. The S run returns to its
exact start state after two laps (120 edges) and not after one; both checkers
verify that the period is minimal. Setup: M00 is the sticker-row state, so M
needs 0 HTM. S00 is reached from M00 by `F2 L U' B2 D R2 U R' B2` (9 HTM).

Print S3 (corner 0..7; faces in home-axis order x, y, z):

| Corner | faces |
| --- | --- |
| 0 | tens 4, blank, tens 1 |
| 1 | tens 3, blank, tens 0 |
| 2 | M, S, units 3 |
| 3 | units 4, units 8, units 0 |
| 4 | units 1, S, units 5 |
| 5 | units 6, units 2, units 9 |
| 6 | units 7, M, S |
| 7 | tens 5, blank, tens 2 |

That makes 3 blanks, 6 tens, 10 units (one each), M ×2 and S ×3.

### Witness M3

Receipts: [Julia](evidence/receipt-m3.julia.tsv) and
[Flix](evidence/receipt-m3.flix.tsv) are byte-identical. Controls:
[checks-m3.tsv](evidence/checks-m3.tsv).

| Run | Period edges | HTM 1 / 2 / 3 / 4 | Total | Max | Word = lower bound |
| --- | ---: | --- | ---: | ---: | ---: |
| M | 60 | 4 / 9 / 47 / 0 | 163 | **3** | 42 |
| S | 60 | 1 / 10 / 46 / 3 | 171 | 4 | 43 |

The three 4-HTM edges are S 03→04 (`U' B U R`, lower bound 2), S 37→38
(`F2 L' F2 R`, lower bound 3) and S 47→48 (`U' B U R'`, lower bound 3).
Closure is exact for both letters. S00 is reached from M00 by
`R F' D' L' D' R2 U' F2 U2` (9 HTM).

Print M3: corner 0 (tens 4, tens 5, blank), 1 (blank, tens 0, tens 2), 2
(units 5, units 9, S), 3 (tens 1, blank, tens 3), 4 (M, units 0, units 8), 5
(M, units 1, units 4), 6 (M, units 2, units 6), 7 (S, units 7, units 3). That
makes 3 blanks, 6 tens, 10 units, M ×3 and S ×2.

### Facts common to both witnesses

- **Closure.** Closure is run-in plus a repeating period of full 24-sticker
  states, hidden stickers included. Setup is outside the bound, so it can put
  the cube straight onto the period, and the run-in is 0. Period 1 is exact
  closure. Decrements are the exact inverse traversal over the whole period,
  with the same lengths, and both checkers replay them, the 00→59 wrap
  included. Each counter therefore runs forever in either direction.
- **Lower bounds.** Each edge carries its distance in the rebuilt
  136,080-state graph of four tracked front stickers: the shortest distance
  from the source state to *any* state that shows the target. On the letter
  that misses (S on M3, M on S3), every lower bound is ≤ 3. So each 4-HTM edge could reach *some* state that shows the target in 3, but
  not one that continues a closed cycle. Closure is the binding constraint,
  as in the H/M study.
- **Capacity**, from the H/M finding: a glyph's up vector fixes its cell. The
  minimum is therefore 2 letters + 6 tens + 10 units = 18 glyph stickers,
  leaving 6 for blanks and duplicates. Both prints spend them on 3 blanks
  (on three different corners) and 3 extra letters, with no duplicate digits.
- Letter switching at values other than 00 was not optimized.

## Approaches and what was searched for max 3

The search is generator-side only and is not a proof. The checkers are the
only proof authority.

1. **Pool model, the symmetric design (approach 3).** One corner has three
   blank faces and stays at the upper-left. One corner carries M and S and
   never leaves the upper-right untwisted. Edges are restricted to the 88
   elements within 3 HTM (378 within 4) that respect this. The S run is then
   literally the M run started with the letter corner turned to S and the
   blank corner counter-twisted. For each print, a cyclic layered graph is
   built: layer i holds *all* states that show display i. Value iteration on
   it gives the **exact minimum mean number of 4-HTM edges per cycle** over
   all eventually periodic walks and all setups (`vi.jl`). Annealing over
   prints (`annealvi.jl`) reached **8 edges at 4 per letter** at best.
   Structural reason: when the tens cell must keep its sticker, exactly
   **6** elements within 3 HTM change only the units cell (`R' B R`,
   `R' B2 R`, `R' B' R`, `U R U'`, `U R2 U'`, `U R' U'`), each costing
   exactly 3. These 6 elements offer at most 6 (corner, orientation) choices
   for the next units digit, and 54 of the 60 edges are such units steps. In
   the pool walks the decade steps were cheap (2 HTM) and the 4-HTM edges were
   units steps.
2. **Decade-periodic construction, exhaustive within its restriction**
   (`decade.jl`). This is the pool model with four units corners and two
   tens corners. Every decade uses the same 9-step units word, and every
   decade step must undo that word on the units corners within 3 HTM. All
   valid units words were enumerated for every parking position of the
   second tens corner: 1,462 + 1,314 + 1,858 + 1,462. For each word, all
   decade-step choices were searched with a lazily built tens print. There
   is **no** exactly closed max-3 cycle of this shape.
3. **Full model** (no print restriction; letters, blanks and duplicates
   anywhere; unrestricted 31,136-element radius-4 ball; M and S scored
   separately; `fullvi.jl`, `annealfull.jl`, `sweep.jl`). This gave M3: 0 + 3 edges at 4. A complete one-step neighborhood sweep
   around M3 (every swap and every relabel, about 700 prints, three plateau
   rounds) found no print with fewer than 3 edges at 4 in total. S3 came from
   annealing seeded from the restricted H/S/M print, with extra weight on the
   S total (`MS_SWEIGHT=4`, seed 54). No search reached 0 edges at 4 for both
   letters.
4. **Exact max-3 diagnostic for both prints** (`diag-max3.jl`): the greatest
   fixed point of the 60-edge Post operator with the unrestricted
   3,136-element radius-3 ball, started from *all* full states that show L00.
   On M3 it is nonempty for M and **empty for S**. On S3 it is nonempty for S
   and **empty for M**. So on each of these exact prints, the missing letter
   has no run-in + period walk with every edge ≤ 3, for any setup and any
   period. This is a generator-side computation about
   these prints. Neither checker covers it.
5. Earlier probes: a lazy-print DFS for an exactly closed pool walk (at most
   36 consecutive edges), and a break-count annealer.

## Model (stated interpretations)

- 2×2×2, fixed frame, eight rigid corners, 24 immutable stickers. The 18
  generators R/L/U/D/F/B in quarter, inverse and half turns each cost 1 HTM.
  There are no whole-cube rotations and no optical aliases.
- Frame: upper-left = a genuinely blank (unprinted) sticker, upper-right = M
  or S, lower-left = tens, lower-right = units, all glyphs upright. A blank
  reads as blank in every orientation.
- Closure: run-in + repeating period of full states, the same notion as the
  H/S/M blank baseline and the H/M follow-up. Period p means the state after
  60·p edges equals the start state, and the checkers require p to be
  minimal. With setup excluded, the run-in is 0. p = 1 is exact closure. M3
  has p = 1 for both letters; S3 has p = 1 for M and p = 2 for S.

## Verification

`checker/check.jl` (native Julia) and `flix/src/Main.flix` (native Flix 0.79.0,
Java 21) are adapted from the H/M checkers (provenance in each header). They
share no code with the generator or with each other. Each one:

- parses the 24 sticker rows (corner, position, outward normal, tangent up
  vector, glyph or `_` for blank) and validates the lattice and the rigid
  corners;
- turns all sticker frames, hidden ones included, with integer Rodrigues
  quarter turns;
- replays each setup and every edge of the claimed period for M and S;
- checks at every display the blank upper-left sticker, the letter, tens and
  units, and the up vector (0,1,0);
- checks that each edge word inverts exactly, that the run returns to the
  exact start state at the period boundary and not earlier, and that the
  inverse decrement traversal over the whole period is exact;
- rebuilds the 136,080-state four-tracked-sticker graph (histogram
  `0:1,1:15,2:198,3:2030,4:15396,5:61768,6:53528,7:3144`), recomputes every
  claimed lower bound and the claimed maximum, and prints a canonical receipt.

`checker/run-checks.sh` requires byte-identical receipts. It then feeds these
negative controls to both checkers and compares the REJECT message, not only
the exit code:

| Control | Rejection (both checkers) |
| --- | --- |
| wrong glyph (M→S at upper-right) | wrong glyph at cell 2 for M00 after setup |
| wrong up vector (units sticker) | glyph not upright at cell 4 for M00 after setup |
| non-blank sticker in the upper-left cell | upper-left cell must show a blank sticker at M00 after setup |
| hidden stickers 8 and 9 swapped | …M edge 7 (7->8) |
| changed route move (M edge 5) | …M edge 5 (5->6) |
| claimed distance too large / too small (S edge 7) | claimed lower bound differs for S edge 7 (7->8) |
| claimed maximum too small | claimed maximum edge HTM differs from replay |
| emptied wrap word (M 59→00) | word shorter than graph distance for M edge 59 (59->0) |
| wrong period boundary (period 2 claimed, edges repeated) | period boundary: M returns to the start state before the claimed period |
| wrong period boundary (S period 2 claimed as 1; S3 only) | period boundary: S run does not return to the exact start state after the claimed period |

No Python is used anywhere in the search, the checkers or the evidence.

## Reproduce

```sh
J=/tmp/claude-0/julia/bin/julia   # Julia 1.13, --startup-file=no
cd research/ms-counter-3move
P3S="e bd aMS34801S56297MSf c"    # S3; 24 labels: ' ' blank, a-f tens 0-5, 0-9 units, M, S
P3M="ef  ac59Sb dM08M14M26S73"    # M3
$J --startup-file=no finalize-full.jl "$P3S" /tmp/witness-s3.tsv   # candidate producer
flix/build.sh                                                        # Flix jar
checker/run-checks.sh evidence/witness-s3.tsv /tmp/ms-s3          # both checkers + controls
checker/run-checks.sh evidence/witness-m3.tsv /tmp/ms-m3
checker/run-checks.sh evidence/witness-hms-restricted.tsv /tmp/ms-hms
$J --startup-file=no diag-max3.jl "$P3S"                             # max-3 diagnostic
$J --startup-file=no decade.jl                                       # decade-periodic search
$J --startup-file=no scoreprint.jl "$P3S" "$P3M"                     # per-letter optimum
MS_SWEIGHT=4 $J --startup-file=no annealfull.jl SEED ITERS "$P3S" [T0]   # full-model search
```

`evidence/run.log` records the runs used for this README. Search provenance:
`engine.jl` is copied unchanged from research/hm-counter-3move at commit
9ca9f9e (PR #133). The other Julia files are new. They are candidate producers
only.

## Not established

- **max 3 for both counters on the blank profile: UNKNOWN.** Not infeasible:
  the print searches are heuristic. The exact statements hold only for the
  prints they were computed on, and only on the generator side: the minimum
  mean number of 4-HTM edges, and the empty fixed points.
- S3 dominates the restricted H/S/M print only in the lexicographic order
  (max, then edges at max, then total). Its S total is 162 against 159 HTM per
  60 edges. A print that is no worse on every single number was not found.
- Optimality of 3 edges at 4, and of the total HTM, is not claimed. Neither is
  minimality of the S setup word.
- The free profile (upper-left unconstrained) was not evaluated for M/S.
- Letter switching at values other than 00 is not optimized or checked.
