<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Month-configuration coverage: which months can one permanent print show, for every year

Research candidate, not certified. Independent review is pending. Julia only; no Flix check was run for anything
here, so by the repository rule every statement below is UNKNOWN for evidence purposes (SAT, UNSAT and NOMATCH
below are Julia verdicts, not confirmed ones). Stacked on #413 (merged); base `research/cube-display-feasibility`. The 2037-01 print is evaluated with its own `window-2037-01/layout.tsv` (April tiles AP+RIL, since 284e196c); all other prints use `row1-revision/layout.tsv`.

## Headline

A month board depends only on (month, weekday of the 1st, month length). There are exactly 91 such
configurations (11 months x 7 weekdays + February x 7 weekdays x 2 lengths). The Gregorian calendar repeats every
400 years, so a front-matching verdict for one configuration holds for every date with that configuration, in any
year. The whole question "which months can the print show" is therefore the 91-row table `config-table.tsv`.

```
print B (printing-S2.tsv, Print B of #413)  90 of 91 configurations front-match; fails: February, Sunday, 28 days
2037-01 print (committed, old)               89 of 91 front-match;  fails: February, Sunday, 28 days;  April, Wednesday, 30 days
print C (printing-C.tsv, root January 2026)  90 of 91 front-match;  fails: February, Sunday, 28 days
```

Dates of the failing configurations, 2026-01 .. 2100-01 (`failing-dates.tsv`):

| Configuration | Print | Dates |
|---|---|---|
| February, Sunday, 28 days | B, old, C | 2026-02, 2037-02, 2043-02, 2054-02, 2065-02, 2071-02, 2082-02, 2093-02, 2099-02 (9 dates) |
| April, Wednesday, 30 days | old only | 2026-04, 2037-04, 2043-04, 2048-04, 2054-04, 2065-04, 2071-04, 2076-04, 2082-04, 2093-04, 2099-04 (11 dates) |

For 1900 .. 2200 the same configurations occur in the years listed in `config-table.tsv` (column
`years_1900_2200`): February Sunday 28 in 33 years (1903, 1914, ..., 2195), April Wednesday 30 in 43 years.

Answer to "are the Februaries the only problem": for print B and for print C, yes, over every year (2026 .. 2100
and 1900 .. 2200 alike): the only configuration that does not front-match is February that starts on a Sunday and
has 28 days. The 29-day Februaries (7 configurations) and the other six 28-day Februaries all match. For the
committed 2037-01 print the April that starts on a Wednesday is a second failing configuration (the Aprils of
2037, 2043 and 2048 found by #413 are three of its 11 dates before 2100).

## Corner lemma (necessary condition, Julia only)

`lemma-config.tsv`, computed with `months.jl` `corner_demand` on one representative month per configuration:

| Set of configurations | Corner demand | Lemma |
|---|---|---|
| all 91 | 24 (two blank corners) | UNSAT (as coded: demand exactly 24 with a peak-1 class in every target) |
| the 90 matched by print B | 23 | not applicable (UNKNOWN) |
| the 89 matched by the old print | 23 | not applicable (UNKNOWN) |

- The set "every month of 2026 .. 2100 except February/Sunday/28" is lemma-feasible: its demand is 23, and print B
  (and print C) front-match all of its 90 configurations (`front-matches-config-B.tsv`, `front-matches-config-C.tsv`
  replayed by the repository print checker, `print-config-*-julia.tsv`).
- Adding the failing configuration February/Sunday/28 to the 90 raises the demand to 24: lemma UNSAT, so no print
  exists for any target set that contains all 90 and that February (Julia only, UNKNOWN).
- Dropping any single configuration from the 90 does not bring the demand back to 23 (0 of 89 drops, both prints):
  the February is not rescued by a single-configuration drop. Larger drops are not tested. That is the
  all-years version of `window-skip/drop-one-februaries.tsv`.
- April/Wednesday/30 does not raise the demand (23); it fails the old print for a different reason: a whole-body
  matching deficiency in body class (-3,-3,-2) (the unmatched cell and Hall violator are in the table).

Consequence for the chain target set: February/Sunday/28 (nine dates before 2100) is the only month class that
cannot be chain members; every other month from 2026-01 to 2100-01 is front-matchable by print B.

## Table

`config-table.tsv` has 91 rows (month, weekday of the 1st, length, first month with that configuration from
2026-01, SHA-256 of the board, the years 2026 .. 2100 and 1900 .. 2200 in which it occurs, then status and
unmatched cell for B, old and C). A `NOMATCH` row names the first cell that Kuhn matching cannot match, its body
class, and a Hall violator (cells that compete for fewer bodies). `front-matches-config-{B,old,C}.tsv` store the
matching (body and rotation for each of the 49 cells) of every matchable configuration, one target per
configuration with its first month. `gregorian-400.txt` records the 400-year check: all 4800 months of 2026 .. 2425
have the board of their configuration, 91 configurations occur, and config(y, m) = config(y + 400, m) for 1900 ..
2200. `test_config.jl` also checks the 289 months 2026-01 .. 2050-01 of #413 against `months-S2.txt` and
`months-S1.txt`: every month has the result of its configuration (578 comparisons).

## Print C: root January 2026

Root rule today: the chain root is the identity pose, whose front shows the root month. Both prints show May 2026.
`design_skip.jl` already takes the first month of `WINDOW_MONTHS` as the identity target (it fixes the 49 root front
surfaces to that board); this PR adds an optional `ROOT=YYYY-MM` assertion that equals the first month, and makes
the root front surfaces exempt from seed freezing (before, a frozen seed face conflicted with the new root board).
Month list `months-C.txt`: the 286 months 2026-01 .. 2050-01 except 2026-02, 2037-02, 2043-02 (calendar order, root
2026-01 first). The checkers (`row1-window-chain/check.jl`, `verify_chain.jl`, the Flix `Main.flix`) still pin root
May 2026; another author generalizes them. Nothing here changes them.

| Fact | Value |
|---|---|
| Result | UNTRUSTED_SAT designer result, replayed by the repository print checker: 286 months, 14014 cells (`SAT fixed-print-rigid-front-matching`, Julia only, so UNKNOWN as evidence) |
| `printing-C.tsv` SHA-256 | `009983500ad7f4db37a8a5619a1fa4fddcc9524e014d0372fea79efffb6f9ff6` |
| Identity front | January 2026 board (test) |
| Changed surfaces against print B | 134 of 294 (34 are the identity front surfaces; body class (-3,-3,-3): 23, (-3,-3,-2): 29, (-3,-3,-1): 30, (-3,-3,0): 18, the single-face classes 4+4+6+6+6+6+2) |
| Runtime | 180 s wall; Z3 5.4.0 per class 80 s, 86 s, 0.5 s, 0.06 s |
| Front matching of all 90 configurations | all SAT (`config-table.tsv`, column `C_status`) |
| Not the "16 surface" change | the root change moves every cell of the front board, so all four three-face body classes change |

Search path (`redesign-C.tsv`, all 20 runs; the designer is untrusted, so UNSAT rows are relative to the freeze, not
proofs): with 40 percent or more of the faces frozen to print B the corner class (-3,-3,-3) is UNSAT, at 10 to 30
percent it times out (280 s), and only the free corner class (fraction 0) is found (167 s alone, 80 s in the final
run). Class (-3,-3,-2) needs a frozen fraction of at most 0.6 (0.5 and 0.6: SAT with salt 1; 0.7 and 0.8: UNSAT;
0.15, 0.3 with salt 0: timeout). The final run uses per-class fractions `-3,-3,-3:0.0;-3,-3,-2:0.5;-3,-3,-1:0.4;-3,-3,0:0.3`
with salt 1 and `RELEASE_SURPLUS=1` (frozen single-face stickers whose artwork is already available are released;
without it the single-face classes fail "free faces suffice"). The seed was `printing-S2.tsv`.

Other root months are not tried (UNKNOWN). The root months before May that the old prints already match
(2026-01, 2026-03 on B and old; 2026-04 on B) are only a statement about front matching, not about a print with that
root.

Chain consequence: with root 2026-01 and print C the months 2026-01 .. 2026-04 (except February) become chain
members; the bridged gaps are 2026-02, 2037-02 and 2043-02 (February/Sunday/28). The chain states of print B are
not valid for print C (the front surfaces moved; the number of broken states was not computed). No chain was run.

## Size of a chain to January 2100

`chain-size.tsv` (print B or C, February/Sunday/28 skipped): 2026-01 .. 2050-01: 286 members, 285 edges;
2026-01 .. 2100-01: 889 calendar months, 880 members, 879 edges. At the per-edge cost of about 100 s from the
earlier pilots, 879 edges are about 24 hours, 285 edges about 8 hours, sequential (estimate, not measured here). If
the chain state belongs to the configuration, not to the calendar month (UNKNOWN: the stored window chain is
per month), only distinct consecutive configuration pairs need an edge: 95 for 2026-01 .. 2050-01 and 97 for
2026-01 .. 2100-01, because the 400-year cycle and the weekday pattern repeat the same configuration pairs. No chain
run.

## Not verified

- Flix: no Flix run on any receipt here; every statement stays UNKNOWN until the Flix checkers (month list, root
  parameter) confirm it.
- Print C is a candidate print for a new root, not a certified print; legal cube states and a move chain are not run.
  Receipts for print C are per configuration (90 targets), not for all 286 months (the 286-month match file of the
  designer, 524 KB, is not committed; the designer replay ran and printed SAT).
- The designer is untrusted; failure to find a print under a freeze is not UNSAT.
- No spelling or link check, no `graph.v1.json` or UI work.

## Reproduction

Run from `research/calendar-7x7` with Julia 1.11.5.

```sh
C=row1-window-chain/evidence/config-coverage
julia --startup-file=no $C/test_config.jl          # 1 test set group, 1671 tests, about 25 s on an idle machine
julia --startup-file=no $C/test_root.jl            # 2 test sets, 6 tests, about 60 s
julia --startup-file=no $C/test_cache.jl           # 7 tests
julia --startup-file=no $C/test_freeze.jl          # 5 tests
julia --startup-file=no $C/test_stages.jl          # 4 tests
$C/run_mutants.sh "$(command -v julia)"            # 30 mutants, expect KILLED for all
mkdir -p /tmp/cfg && julia --startup-file=no $C/config_table.jl write /tmp/cfg   # then diff -r with $C
# receipts: for N in B old C
M=$(julia --startup-file=no -e 'print(join([string(f[2],"-",lpad(f[3],2,"0")) for f in split.(readlines(ARGS[1])[2:end],"\t") if f[4]=="1" && f[5]=="1"],","))' $C/front-matches-config-$N.tsv)
WINDOW_MONTHS=$M julia --startup-file=no row1-window-chain/evidence/window-skip/skip_check.jl print row1-revision/layout.tsv PRINT $C/front-matches-config-$N.tsv | cmp - $C/print-config-$N-julia.tsv
```

Print C (untrusted, Z3 5.4.0 native library not committed; Linux arm64 build used):
`RELEASE_SURPLUS=1 CLASS_FRACS='-3,-3,-3:0.0;-3,-3,-2:0.5;-3,-3,-1:0.4;-3,-3,0:0.3' CONTINUE=1 SMT_TIMEOUT_MS=280000
ROOT=2026-01 SEED_PRINT=window-skip/printing-S2.tsv SEED_FRAC=1.0 SEED_SALT=1 WINDOW_MONTHS=$(paste -sd, $C/months-C.txt)
julia design_skip.jl row1-revision/layout.tsv libz3.so OUT`. `OUT/printing.tsv` is `printing-C.tsv`.

| File | Purpose |
|---|---|
| `config_table.jl` | derives the 91 configurations, matches, lemma, chain size; `write OUTDIR` regenerates the tables |
| `test_config.jl`, `test_root.jl`, `test_freeze.jl`, `run_mutants.sh` | tests and 30 source/data mutants |
| `config-table.tsv`, `failing-dates.tsv`, `gregorian-400.txt`, `lemma-config.tsv`, `chain-size.tsv` | the tables |
| `front-matches-config-{B,old,C}.tsv`, `print-config-{B,old,C}-julia.tsv` | matchings and checker receipts per configuration |
| `printing-C.tsv`, `months-C.txt`, `solver-C.tsv`, `redesign-C.tsv` | print C, its month list, solver log, all 20 design runs |
| `printing-C1980.tsv`, `solver-C1980.tsv`, `front-matches-config-C1980.tsv`, `print-config-C1980-julia.tsv`, `months-C1980.txt`, `redesign-C1980.tsv`, `best-effort-feb-sunday-28.tsv`, `stage-pairs.tsv`, `stage_pairs.jl`, `test_stages.jl` | root January 1980 attempts, best-effort matchings, staged pairs |
| `../window-skip/design_skip.jl`, `test_root.jl`, `test_cache.jl` | designer: `ROOT`, root fronts never frozen, `CLASS_FRACS`, `ONLY`, `CONTINUE`, `RELEASE_SURPLUS`, `RESULT_DIR` (solved classes stored by SMT digest, never solved twice); the root-front exemption applies to every seeded run, otherwise defaults are unchanged |

## Root January 1980 (configuration January / Tuesday / 31 days), best effort, staged chains

Owner decision 2026-11-11: the solved cube shows January 1980. `Dates.dayofweek(Date(1980,1,1))` is 2 (Tuesday) and January has 31 days, so the board is the one of configuration January/Tuesday/31 (first occurrence in 2026 .. 2099: 2030-01). `months.jl` accepts months from 2026-01 only, so the month list `months-C1980.txt` (286 lines, sha256 `bbbd83b75ee0a10fe00344f3fa5a8edfa7509ed867aafaa4c76cc40a5b6b4f6c`) uses 2030-01 as the root month (same board), then 2026-03 .. 2050-01 in calendar order without 2030-01, 2037-02 and 2043-02, and last 2052-02 (February/Thursday/29, the one matchable configuration that does not occur in 2026-03 .. 2050-01), so that all 90 matchable configurations are targets. Designer call: `ROOT=2030-01 RELEASE_SURPLUS=1 CLASS_FRACS=... WINDOW_MONTHS=$(paste -sd, months-C1980.txt) design_skip.jl` with seed `printing-S2.tsv`.

Result: print C-1980 found: `printing-C1980.tsv`, sha256 `e3c7e3eeaa012a62cc372642e796a8640c95bd5da569d2c3352bee9ecc24c3be`. Untrusted designer result (UNTRUSTED_SAT per class) replayed by the repository print checker for all 286 months of `months-C1980.txt` (14014 cells, `SAT fixed-print-rigid-front-matching`, Julia only, so UNKNOWN as evidence); the identity front equals the January/Tuesday/31 board and all 90 matchable configurations front-match (`config-table.tsv` column `C1980_status`, receipt `print-config-C1980-julia.tsv`). Changed surfaces against print B: 160 differ in text, ink or up (159 in artwork class; 35 are identity-front surfaces; by class (-3,-3,-3) 20, (-3,-3,-2) 42, (-3,-3,-1) 43, (-3,-3,0) 18, single-face classes 4, 4, 6, 6, 8, 8). Final run `D6` (all 25 earlier runs are in `redesign-C1980.tsv`): seed `printing-S2.tsv`, `CLASS_FRACS=-3,-3,-3:0.0;-3,-3,-2:0.0;-3,-3,-1:0.0;-3,-3,0:0.3`, salt 1, `RELEASE_SURPLUS=1`, `RESULT_DIR`, timeout 1500 s per class. Per-class times 28.5 s, 1108 s, 7.3 s, 0.15 s, wall 1366 s, at a machine load average of 7.7 at start and 27 to 44 during the run (the load was high because of other processes; the class (-3,-3,-2) time is therefore not representative). Earlier attempts timed out on the same class problem (SMT digest unchanged) under load, see below:
- Class (-3,-3,-3) (corner) free: SAT in 27 to 153 s. Class (-3,-3,0) at 0.3: SAT in under 1 s. Class (-3,-3,-1) free: SAT in 2 s (0.2: 120 s, 0.4: timeout).
- Class (-3,-3,-2) is the obstacle. Frozen fractions 0.5 to 0.95 (seed B or seed print C): UNSAT relative to the freeze; 0.2 to 0.45: timeout (280 s). Fully free (fraction 0): UNTRUSTED_SAT twice in isolated runs (553 s alone, 503 s inside a full run that I stopped in the next class), but the assembling runs D4 (840 s) and D5 (1500 s) timed out on the same SMT input (the `component-2.smt2` files are byte-identical).

Best effort for February/Sunday/28 (`best-effort-feb-sunday-28.tsv`, prints B, C and C1980; print `D` in the file): the maximum matching has 48 of 49 cells; exactly two cells can be the wrong one, (7,1) or (7,7) (the two blank bottom corners; any other single wrong cell leaves a deficiency), and for each choice the table lists the matching of the other 48 cells (cell, body, rotation), replayed by an independent check in `test_config.jl`. Same data for 2026-02, 2037-02 and 2043-02 (one configuration). Move-sequence tie-breaks: not run.

Staged chains (`stage-pairs.tsv`, `stage_pairs.jl`, test `test_stages.jl`; Gregorian, no month skipped): stage 1 1980-01 .. 2050-01 has 841 months and already all 98 distinct consecutive configuration pairs (counted with no month skipped; the bridged chain without February/Sunday/28 has 95 or 97, see `chain-size.tsv`); stages 2 (1950-01 .. 1980-01, 361 months), 3 (1900-01 .. 1950-01, 601) and 4 (2050-01 .. 2100-01, 601) add no new pair. February/Sunday/28 occurs in 8, 3, 5 and 6 months of the stages, and 2 pairs involve it (January to it, it to March). The 400-year cycle is therefore complete in 70 years.
