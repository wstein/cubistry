<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Skip-capacity study: which months from January 2026 to January 2050 fit one permanent print

Research candidate, not certified. Independent review is pending. Julia only; no Flix check was run for
anything new here, so by the repository rule every new negative or positive statement below is UNKNOWN for
evidence purposes unless it says that Flix also accepted it.

## Headline

The chain root is the identity pose, May 2026 (`row1-window-chain/check.jl`, `verify_chain.jl` and both Flix
checkers pin it). Only months from the root on can be chain members. Months before the root front-match but are
reported as `before_root`.

```
gapless: 2026-05 .. 2037-01 (129 months)     both prints
2037-01 print (282 front-matching months): chain gaps 2037-02, 2037-04, 2043-02, 2043-04, 2048-04  (280 chain members)
S2 print      (286 front-matching months): chain gaps 2037-02, 2043-02                              (283 chain members)
before the root: 2026-01 and 2026-03 front-match on both prints, 2026-04 only on S2, 2026-02 on neither
```

The gain of the S2 print is the three Aprils 2037-04, 2043-04, 2048-04 (plus 2026-04 before the root). The owner's
wish "chain from January 2026" conflicts with the root rule: a chain that starts before May 2026 needs a new root
(a print whose identity shows the earliest month) or a chain format with a non-identity start. That is an owner
decision and is not decided here. `coverage-S2.tsv` and `coverage-S1.tsv` list every maximal run, every gap and
every before-root month with its status.

## Definition

A target set S is a set of calendar months (not an interval). The root month (front of the print, identity
state) is May 2026. The month files (`months-S1.txt`, `months-S2.txt`) are sets; their line order is the target
order of the print files (root first, then calendar order), which the print checker needs. In the skip semantics
the state chain connects consecutive valid months directly; calendar months in between do not need to be targets.

Month m can be added to S when both hold:

1. Fixed-print rigid front matching: a print exists (stickers on the 218 rigid bodies) such that every month in
   S ∪ {m} has a front matching (one distinct body and one rigid rotation per front cell, exact upright
   artwork). Months are independent of each other once the print is fixed, so for a given print there is no
   order effect: the addable months are exactly the front-matchable months.
2. Corner lemma (necessary condition, cheap): the corner demand of the target set is the sum over corner artwork
   classes of the per-class peak (maximum copies at the four corner cells in one month). As coded
   (`row1-corner-coupling/lemma.jl`) the lemma says UNSAT only when the demand equals exactly 24 and a class with
   peak 1 is present in every target (the band class). Demand 25 or more is not covered by the lemma as coded.
   The demand is monotone in S. The conclusion "no print for any superset" carries over because front matching
   is a per-month conjunction: a print for a superset is a print for every subset, so a lemma UNSAT for
   S ∪ {m} rules out every target set that contains S ∪ {m}.

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

Chain members per year (S2, from May 2026): 2026=8, 2027..2036=12 each, 2037=11, 2038..2042=12 each, 2043=11,
2044..2049=12 each, 2050=1 (January). With the 2037-01 print: 2037=10, 2043=10, 2048=11, otherwise equal.

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
julia --startup-file=no $W/test_coverage.jl        # 1 test set, 14 tests
julia --startup-file=no $W/test_pins.jl            # 2 test sets, 17 tests: SHA-256 pins and receipt replay, about 35 s
julia --startup-file=no $W/test_tools.jl           # 3 test sets, 6 tests: scan_fixed, drop_one, compat, about 35 s
$W/run_mutants.sh "$(command -v julia)"            # 13 mutants, expect KILLED for all
WINDOW_MONTHS=$(paste -sd, $W/months-S2.txt) julia --startup-file=no $W/skip_check.jl print \
  row1-revision/layout.tsv $W/printing-S2.tsv $W/front-matches-S2.tsv | cmp - $W/print-S2-julia.tsv
WINDOW_MONTHS=$(paste -sd, $W/months-S2.txt) julia --startup-file=no $W/skip_check.jl lemma \
  row1-revision/layout.tsv | cmp - $W/corner-S2-julia.tsv
julia --startup-file=no $W/coverage.jl $W/months-S2.txt $W/status-S2.tsv | cmp - $W/coverage-S2.tsv
B=$(julia --startup-file=no -e 'print(join([string(2026+(m-1)÷12,"-",lpad((m-1)%12+1,2,"0")) for m in 5:133],","))')
# scan-fixed-P1.tsv (the header plus the 2026-01..04 and 2037-02..2050-01 rows, in two calls):
{ BASE_MONTHS=$B julia --startup-file=no $W/scan_fixed.jl row1-revision/layout.tsv \
    row1-window-chain/evidence/window-2037-01/printing.tsv 2026-01 2026-04
  BASE_MONTHS=$B julia --startup-file=no $W/scan_fixed.jl row1-revision/layout.tsv \
    row1-window-chain/evidence/window-2037-01/printing.tsv 2037-02 2050-01 | tail -n +2; } | cmp - $W/scan-fixed-P1.tsv
# scan-fixed-P2.tsv: the same two calls with BASE_MONTHS=$(paste -sd, $W/months-S2.txt) and $W/printing-S2.tsv
# drop-one-februaries.tsv:
julia --startup-file=no $W/drop_one.jl row1-revision/layout.tsv 2026-02,2026-04,2037-02,2037-04,2043-02,2043-04,2048-04 \
  | grep -E "^S_valid|\(20[0-9]+, 2\)" | cut -c1-200 | cmp - $W/drop-one-februaries.tsv
# compat-S2.txt:
WINDOW_MONTHS=$B julia --startup-file=no $W/compat.jl row1-revision/layout.tsv \
  row1-window-chain/evidence/window-2037-01/printing.tsv row1-window-chain/evidence/window-2037-01/front-matches.tsv \
  $W/printing-S2.tsv | cmp - $W/compat-S2.txt
# February receipts (target 1 is the February, a set check: the lemma does not depend on the order; the receipts
# were produced with the February first, the print files use the root first):
WINDOW_MONTHS="2043-02,$B" julia --startup-file=no $W/skip_check.jl lemma row1-revision/layout.tsv | cmp - $W/corner-2043-02-julia.tsv
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
