<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Skip-capacity study: which months from January 2026 to January 2050 fit one permanent print

Research candidate, not certified. Independent review is pending. Julia only; no Flix check was run for
anything new here, so by the repository rule every new negative or positive statement below is UNKNOWN for
evidence purposes unless it says that Flix also accepted it.

## Headline

```
gapless: 2026-03 .. 2037-01 (131 months)      print printing-S2.tsv, 286 valid months
gaps:    2026-02, 2037-02, 2043-02            (3 months of 289; 2026-01 is valid but isolated)
```

Fallback with the committed 2037-01 print unchanged (`../window-2037-01/printing.tsv`): `gapless: 2026-05 ..
2037-01 (129 months)`, 282 valid months, 7 gaps (the three Februaries and 2026-04, 2037-04, 2043-04, 2048-04).
The files `coverage-S2.tsv` and `coverage-S1.tsv` list every maximal run and every gap with its status.

## Definition

A target set S is a set of calendar months (not an interval). The root month (front of the print, identity
state) is the first month of the list; here it stays May 2026. In the skip semantics the state chain
connects consecutive valid months directly; calendar months in between do not need to be targets.

Month m can be added to S when both hold:

1. Fixed-print rigid front matching: a print exists (stickers on the 218 rigid bodies) such that every month in
   S ∪ {m} has a front matching (one distinct body and one rigid rotation per front cell, exact upright
   artwork). Months are independent of each other once the print is fixed, so for a given print there is no
   order effect: the addable months are exactly the front-matchable months.
2. Corner lemma (necessary condition, cheap): the corner demand of the target set is the sum over corner artwork
   classes of the per-class peak (maximum copies at the four corner cells in one month). The corner-body
   obstruction (`row1-corner-coupling/lemma.jl`) says UNSAT when the demand equals 24 and a class with peak 1
   is present in every target (the band class). The demand depends on the set: it is monotone in S, so a lemma
   UNSAT for S ∪ {m} also holds for every superset of it.

`months.jl` generalizes both Julia checkers: `WINDOW_MONTHS=YYYY-MM,...` replaces the hard-coded
May-2026-to-`WINDOW_END` interval (`coupled_goals` is redefined). For the contiguous lists the receipts are
byte-identical to the committed ones (tests below).

## What is established

| Statement | Evidence | Status |
|---|---|---|
| The 2037-01 print front-matches 153 of the 160 months 2026-01..04 and 2037-02..2050-01; it does not match 2026-02, 2026-04, 2037-02, 2037-04, 2043-02, 2043-04, 2048-04 | `scan-fixed-P1.tsv` (9 s) | Julia only |
| New print `printing-S2.tsv` front-matches all 286 months of `months-S2.txt` | `print-S2-julia.tsv` (`SAT fixed-print-rigid-front-matching 286 14014`), `front-matches-S2.tsv` | Julia only |
| Same print front-matches all but the three Februaries of the 160 candidates | `scan-fixed-P2.tsv` | Julia only |
| 2026-02, 2037-02, 2043-02: the corner demand of the 129 months May 2026..January 2037 plus that month is 24 with two blank corners (the three Februaries with 28 days starting on Sunday); lemma UNSAT, so no print for any target set containing the 129 months and that month | `corner-2026-02-julia.tsv`, `corner-2043-02-julia.tsv`, `../window-2037-01/corner-2037-02-{julia,flix}.tsv` | 2037-02: Julia and Flix (see #409). 2026-02, 2043-02: Julia only, UNKNOWN |
| No single month removed from the 282 valid months brings the demand with a February back to 23 | `drop-one-februaries.tsv` (necessary condition only) | Julia only |
| Demand of the full target sets is 23 (lemma not applicable), consistent with the prints | `corner-S1-julia.tsv`, `corner-S2-julia.tsv` | Julia only |

Because the owner requires the complete run through January 2037, the 129 months are in every admissible target
set. Under that requirement the three Februaries are the only months that the lemma excludes, so
`months-S2.txt` is maximal for the print model, with the Julia-only caveat for 2026-02 and 2043-02. A target set
that drops base months to admit a February is a different question; the single-drop test above does not rescue
any February, larger drops are UNKNOWN.

Valid months per year (S2): 2026=11, 2027..2036=12 each, 2037=11, 2038..2042=12 each, 2043=11, 2044..2049=12 each,
2050=1 (January).

## Print freeze and chain validity

The four Aprils (2026-04, 2037-04, 2043-04, 2048-04) do not fit the 2037-01 print and need a redesign
(`design_skip.jl`, untrusted Z3 designer with seeding). `redesign.tsv` lists all 49 runs. Findings:

- Freezing every surface that is a front in the existing 129 matches (270 of 294 surfaces) makes each April
  UNSAT in the designer (4 runs; relative to the freeze, not a proof). Hash-frozen fractions 0.6 and above are also
  UNSAT; 0.4 to 0.55 find prints.
- Smallest change found: freeze every body except body class (-3,-3,-2) and half of the faces inside it
  (`H-four-0.6-2`): 16 surfaces change, all in that body class, 15 of them are fronts in the old matches. That is
  `printing-S2.tsv`.
- Effect on the 129 months of the 2037-01 print (`compat-S2.txt`): the old rigid matches break in 123 of the 129
  months (still valid: 2026-05, 2027-10, 2028-10, 2030-10, 2032-10, 2034-10). All 129 months do front-match the new
  print (with other bodies/rotations), so only the chain states are affected, not the months' fitting.

Consequence for the chain:

| Print | Valid months | Chain on the 129 months of the 2037-01 print |
|---|---|---|
| 2037-01 print unchanged (sha256 `2b5a068d...c23c6`) | 282 | stays valid; later months need only new edges |
| `printing-S2.tsv` (sha256 `5808fcac...6edd3`) | 286 | every chain state of a month with a broken match (123 of 129) must be recomputed |

The decision to freeze is the owner's: either keep the 2037-01 print (4 more gaps, no recomputation) or take the
S2 print (3 gaps, recompute). The three Februaries are a gap under both.

## Not verified

- Flix: no Flix run on any new receipt. The Flix corner checker builds its window as `coupledGoalsN(..., N)`
  (contiguous from May 2026, N months) and the print checker has a fixed 21-month constant; both need an explicit
  ordered month list (for example read from a file next to the layout) to confirm anything here.
- Legal cube states and a move chain for either print, and the chain edges across skipped months: not run.
- The designer is untrusted; absence of a print under a freeze is not UNSAT. Greedy order was not needed for the
  fixed print; for the redesign all four Aprils were added at once (not greedy, no optimality claim).
- No spelling or link check, no `graph.v1.json` or UI work.

## What the next author must generalize

- Both checkers (Julia: this directory; Flix: month list instead of N), `row1-window-chain` chain/beam code
  (state chain edge from the last valid month to the next valid month), and `graph.v1.json` (node/month mapping
  with skipped calendar months; the UI must show which months have no state).
- The hidden precondition: `design_skip.jl` and the match files keep the root month first; the month order in
  `WINDOW_MONTHS` must equal the order of the targets in `front-matches.tsv`.

## Files and reproduction

Run from `research/calendar-7x7` with Julia 1.11.5 (the shim needs a trusted `mise.toml`; the toolchain binary
works directly).

```sh
W=row1-window-chain/evidence/window-skip
julia --startup-file=no $W/test_skip.jl            # 4 test sets, 20 tests, about 20 to 40 s
julia --startup-file=no $W/test_coverage.jl        # 1 test set, 10 tests
$W/run_mutants.sh "$(command -v julia)"            # 8 mutants, expect KILLED for all
WINDOW_MONTHS=$(paste -sd, $W/months-S2.txt) julia --startup-file=no $W/skip_check.jl print \
  row1-revision/layout.tsv $W/printing-S2.tsv $W/front-matches-S2.tsv | cmp - $W/print-S2-julia.tsv
WINDOW_MONTHS=$(paste -sd, $W/months-S2.txt) julia --startup-file=no $W/skip_check.jl lemma \
  row1-revision/layout.tsv | cmp - $W/corner-S2-julia.tsv
julia --startup-file=no $W/coverage.jl $W/months-S2.txt $W/status-S2.tsv | cmp - $W/coverage-S2.tsv
BASE_MONTHS=<129 months> julia --startup-file=no $W/scan_fixed.jl row1-revision/layout.tsv \
  row1-window-chain/evidence/window-2037-01/printing.tsv 2037-02 2050-01
```

Redesign (untrusted, Z3 5.4.0 native library not committed), for `H-four-0.6-2`:
`FREE_KEY=-3,-3,-2 IN_FRAC=0.6 SEED_SALT=2 SEED_PRINT=<2037-01 printing.tsv> SEED_FRAC=1.0 SMT_TIMEOUT_MS=280000
WINDOW_MONTHS=$(paste -sd, $W/months-S2.txt) julia design_skip.jl layout.tsv libz3.so OUTDIR`. The run took 151 s.

| File | Purpose |
|---|---|
| `months.jl`, `skip_check.jl` | month-list generalization, lemma and print entry points |
| `coverage.jl`, `test_coverage.jl` | runs and gaps from the month list alone, with mutation tests |
| `test_skip.jl`, `run_mutants.sh` | tests of the generalization, source mutants |
| `scan_fixed.jl`, `drop_one.jl`, `compat.jl`, `design_skip.jl` | scans, print compatibility diff, designer |
| `coverage-S1.tsv`, `coverage-S2.tsv`, `status-S1.tsv`, `status-S2.tsv`, `months-S1.txt`, `months-S2.txt` | coverage |
| `scan-fixed-P1.tsv`, `scan-fixed-P2.tsv`, `redesign.tsv`, `drop-one-februaries.tsv`, `compat-S2.txt` | per-month demand and match tables, redesign log |
| `printing-S2.tsv`, `front-matches-S2.tsv`, `print-S2-julia.tsv`, `corner-*-julia.tsv` | print and receipts |

Columns of `scan-fixed-P*.tsv`: month, size of the base set, corner demand of base plus month, blank peak, lemma
verdict on that set, fixed-print front matching of the month alone (for P1 the base is the 129 months; for P2 it
is S2, so months already in S2 repeat their own demand).
