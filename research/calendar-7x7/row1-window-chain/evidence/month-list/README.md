<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Explicit month list S for the calendar-7 checkers

Research candidate, not certified. Independent review is pending. Julia and Flix both read the list; statements
below say which of them accepted what. Stacked on the skip-capacity study (`../window-skip/`).

## Mechanism

A month list is a file `months-*.tsv`: one `YYYY-MM` per row, strictly increasing, UTF-8, LF, final LF, from
2026-01 to 2100-01. It is pinned by its SHA-256 (`sha256.txt`, passed on the command line like the print hash).

| Checker | Selects the list | Without a list |
|---|---|---|
| Julia `row1-corner-coupling/check.jl`, `row1-window-print/check.jl`, `row1-window-chain/check.jl` | `CAL7_WINDOW_MONTHS=path`, `CAL7_WINDOW_MONTHS_SHA256=hex` | `WINDOW_END` (default 2028-01), unchanged |
| Julia `row1-window-chain/verify_chain.jl` (own list reader) | same variables | same |
| Flix corner jar | trailing arguments `MONTHS_FILE MONTHS_SHA256` | `ORIGINAL_EVIDENCE` is the last argument |
| Flix print jar | trailing arguments `MONTHS_FILE MONTHS_SHA256` | same |
| Flix chain jar | `... ORIGINAL_EVIDENCE months MONTHS_FILE MONTHS_SHA256 PRINT_SHA256 [LAYOUT_SHA256]` | `[WINDOW_END PRINT_SHA256]` |

- The list and `WINDOW_END` exclude each other; a list without a hash, a wrong hash, a row outside 2026-01..2100-01,
  CRLF, a missing final LF, a blank row and a non-increasing row are rejected by Julia and by Flix.
- Flix reads the list at runtime (`read(path)` as for all other inputs), so no patched constants and no generator are
  needed. Julia and Flix parse the list in separate code (`verify_chain.jl` does not include `check.jl`).
- `run_checks.sh` takes the list through the same environment variables and forwards it to the Flix jar.
- Layout override is a parameter: `CAL7_WINDOW_LAYOUT_SHA256` (Julia) and the optional last Flix chain argument pin a
  window-local `layout.tsv`; the layout path is already an argument. The layout parser still requires the twelve full
  English month names, so the April label `AP|RIL` needs a parser change later; it is not done here.
- Chain format `cubistry.calendar7.chain.v1` is unchanged (v2 and v3 below). The `edge year month` of edge i must equal member i+1 of S.
  An edge whose month is more than one calendar month after the previous member is a bridge edge (state edge across a
  gap); Julia, Flix and the independent verifier mark it with a trailing `BRIDGE` field on the edge line, and the `months`
  line of a list-mode receipt gives the number of bridge edges. WINDOW_END receipts have no new field and no `months` line.
- Receipts of print, corner and chain checkers in list mode have one added line, `months<TAB>sha<TAB>count<TAB>first<TAB>last<TAB>bridges`.

## Root month, first member and free start

The chain root is a parameter, separate from the first member of S. `CAL7_ROOT_MONTH=YYYY-MM` (1900-01 .. 2100-01; Flix:
the argument after the layout pin, `-` for the default) names the month whose board the identity pose of the print shows; the default is
S[1]. The `source` record of the chain reads `<month> <year> <month>` of the root month and the identity front must equal the
board of the root month (configuration lookup in all three checkers). If the root month is not S[1], the chain has one
extra root edge from the identity pose to S[1]; it is counted as an edge, carries `ROOTEDGE` on the receipt line and may have zero
moves when both boards agree. A root month other than S[1] needs a list. The solved cube shows January 1980 (Jan/Tue/31);
no print in this repository shows it yet, so the root fixtures use 2037-05 (same calendar as 2026-05): `root-edge-2037-05`,
`root-edge-zero-moves`, `root-equals-first-member` accepted; `root-month-1980-01` and `root-record-mismatch` rejected
(`root_best_effort_cases.jl`). A root month the print does not show is rejected at `identity root front`.

Chains are computed in stages (owner decision 2026-11-11). A chain file is always stored in time order; a stage computed backward is
inverted by the solver, so there is no direction flag. Chain format `cubistry.calendar7.chain.v3` adds an optional block after
the `source` line:

```
start<TAB>N              N move lines (move<TAB>generator<TAB>exponent) from the identity pose to the start state
```

Without the block the start state is the identity pose (root stage). With it the start state is any legal state reached from the identity
pose by the listed moves (legal by construction, no group-membership test needed); its front must equal the board of the first member
(`free start front is the first member`), its digest is the `source` digest and is printed as `start<TAB>free<TAB>N<TAB>digest`.
A free start and a root edge exclude each other. The start moves are not edges: they are not in the metrics and not in the move count of the summary.
Header v1 and v2 stay valid; a `start` block in them is rejected.

Junctions: `CAL7_JOIN_START` and `CAL7_JOIN_END` (Julia and independent verifier; Flix: the two arguments after the root month, `-`
for none) hold 64 hex or `identity`, the digest the start (end) state must have. `identity` is the digest of the identity pose of the print. A
checker that was given a digest prints `join<TAB>start|end<TAB>digest` (independent: `independent-join`) only after the comparison succeeded; a
mismatch is `start junction digest` / `end junction digest`. A stage that ends at the root passes `identity` as the end digest; the stage that
follows passes the digest the previous stage ended with as start digest.

`stage_coverage.jl` composes stages from their Julia and Flix receipts (byte-identical): adjacent stages are `joined` when the first ends in the
month the second starts in, the digests are equal and both receipts carry the junction lines; otherwise `mismatch` (digests or months differ) or
`unchecked` (no junction lines). It states `composed FIRST LAST N` for maximal runs of exact stages (verdict SAT, no bridge or root edge)
with only joined junctions and lists every other stage separately. `verify_stage_coverage.jl` re-reads the receipts with its own code.
Committed example: `stage-A-*` (2026-05, 2026-06) and `stage-B-*` (2026-06 .. 2028-01, free start) give `composed 2026-05 2028-01 21` (`stage-summary.tsv`).
The stage inputs here are fixtures from the stored 21-month chain; no real stage run (2026-01 .. 2050-01 and the backward stages) exists yet.

## Best-effort months

`cubistry.calendar7.chain.v2` (and v3) allow per edge, between the edge line and its moves, optional lines
`wrong<TAB>r<TAB>c` (strictly increasing, row-major) and `hall<TAB>r,c;r,c;...` (cells strictly increasing). Rule, checked by all three checkers
with their own code: the cells whose sticker does not show the board (strict optics) must equal the listed wrong cells exactly; the
`hall` sets are disjoint, each lies inside one body class, covers part of the wrong cells, and the number of wrong cells in a set equals the
deficiency |X| - |N(X)| >= 1, where N(X) are the bodies of that class that can show some cell of X exactly under a rigid rotation. Every legal
state then shows at least that many wrong cells in X, so the recorded wrong cells are a minimum (Hall violation witness, verified, not trusted). An exact
month has no `wrong` and no `hall` lines. Receipt suffix `BEST_EFFORT<TAB>k<TAB>r,c;...`, line `status<TAB>exact<TAB>N<TAB>best_effort<TAB>K`, verdict
`BEST_EFFORT` (independent: `ACCEPT_BEST_EFFORT_CHAIN`). The tie rule of the owner (shortest move sequence from the predecessor) is a solver
objective and not checkable by these checkers. Fixtures: `best-effort-center` accepted; `-no-hall`, `-unlisted-wrong`, `-not-minimal`, `-hall-two-classes`,
`-v1-header`, `-wrong-unsorted`, `exact-month-with-hall` rejected; `exact-v2` accepted.

For the two Februaries (2037-02, 2043-02; Feb/Sun/28) on `printing-S2.tsv`, `february_hall.jl` finds the deficiency: X = {(7,1),(7,7)} has deficiency 1, so at least
one wrong cell per February (`february-hall-S2.tsv`). This is verified by the Julia witness check only (`test_best_effort.jl`); no chain with these months exists, so the
status in the coverage is `best_effort_unverified` and the minimum is UNKNOWN as a proof until Julia and Flix chain receipts exist. Print C (root Jan/Tue/31) may change the cells.

## Coverage

`month_coverage.jl` takes the root month and the start month separately (`LIST PIN STATUS LAST START ROOT BEST|-`). Months of the list before START are
`before_start`; chain members from START to LAST are exact unless listed in the best-effort table (`best-effort-chain.tsv`: month, status, wrong cells, evidence); gaps are
calendar months between START and LAST that are not in S (bridged, status from `status-*.tsv`). Headline `exact-gapless FIRST..LAST (N months)` is the first maximal run of exact calendar-consecutive
members; best-effort months are chain members listed separately, not gaps. A best-effort month is `best_effort` only with Julia and Flix chain receipts that carry the
`BEST_EFFORT` edge line with exactly those cells, otherwise `best_effort_unverified` (Julia Hall table `february-hall-S2.tsv`). `verify_coverage.jl` (separate code) recomputes everything from the
list and checks the JSON. `coverage-S2.*` (list `months-S2.tsv`, start = root = 2026-05) and `coverage-chain-2026-03.*` (list `months-chain-2026-03.tsv`, root 1980-01, start 2026-03, both Februaries best-effort) are committed.

```
coverage-S2:            exact-gapless 2026-05 .. 2037-01 (129 months)   chain members 283, exact runs 3, best-effort 0, gaps 2, bridges 2, before_start 4
coverage-chain-2026-03: exact-gapless 2026-03 .. 2037-01 (131 months)   chain members 287, exact runs 3, best-effort 2 (2037-02, 2043-02), gaps 0, before_start 2
```

## Receipts (Julia and Flix byte-identical, committed here)

| Check | List | Result |
|---|---|---|
| Print, fixed-print rigid front matching, `printing-S2.tsv` | `months-S2.tsv` (286) | SAT, 286 months, 14014 cells (`print-S2-{julia,flix}.tsv`) |
| Corner lemma | `months-S2.tsv` (286) | UNKNOWN lemma-not-applicable, demand 23 (`corner-S2-*`) |
| Corner lemma | `months-S2-chain.tsv` (283, root first) | UNKNOWN lemma-not-applicable, demand 23 (`corner-S2-chain-*`) |
| Corner lemma | 2026-02 plus the 129 months | UNSAT unique-always-visible-face, demand 24 (`corner-2026-02-*`) |
| Corner lemma | the 129 months plus 2043-02 | UNSAT unique-always-visible-face, demand 24 (`corner-2043-02-*`) |

`front-matches-S2.tsv` is an untrusted witness (`../window-skip/make_matches.jl`) in list order; both print checkers
verify it. 2043-02 is therefore Julia and Flix UNSAT under the lemma assumptions (the 129 months in every target set);
2037-02 was already (see `../window-2037-01`). 2026-02 is before the root and not a chain gap; the same lemma
applies to it as a print month with the 129 months. No chain exists for the S2 print: legal states and move chains for
S2 are not run.

## Tests

- `row1-window-chain/test_month_list.jl`: reader, hash, structure, `coupled_goals` with a list (Julia unit tests).
- `row1-window-chain/month_list_cases.jl` and `run_month_list_checks.sh`: the stored 21-month chain with 2027-03 skipped
  (the edges of 2027-03 and 2027-04 merged into one bridge edge, no solver) is accepted by Julia, Flix and the independent
  verifier with identical Julia/Flix receipts; a second positive starts at 2037-05 (same calendar as 2026, stored print and first seven edges relabeled); 15 negatives (skipped month with an edge into it, missing member, wrong
  list hash, interior-gap chain presented as contiguous list, interior-gap chain under the default `WINDOW_END`, list not
  increasing, duplicate month, root record mismatch, start month the print does not show, 2037-05 chain under a 2026-05 list, bridge edge declaring the skipped month, wrong end digest on a bridge edge,
  CRLF list, month after 2100-01, month before 1900-01) are rejected by all three at the named reason.
- `row1-window-chain/root_best_effort_cases.jl` and `run_root_best_effort_checks.sh`: 26 fixtures, 9 accepted and 17 rejected by Julia, Flix and the independent verifier at the
  named reason (root month, best-effort months, stages with free start and junction digests).
- `row1-window-chain/test_best_effort.jl` (16 tests: `chain_root_month`, Hall witness on `printing-S2.tsv` for February 2037), `test_stage_coverage.jl` (15 tests: junction mismatch, missing
  junction lines, different months, differing receipts, best-effort and bridge stages, verifier agreement).
- `row1-window-chain/test_month_coverage.jl` (35 tests): generator output equals the stored coverage; tampered copies are rejected; start 2026-03 gives 131 months and two before_start months; root and start are separate parameters; verified and unverified best-effort months.
- `row1-window-chain/run_month_list_receipts.sh`: regression (committed 2028-01 chain receipts, 129-month print and corner
  receipts, 21-month print) and the S2 receipts above.
- `row1-window-chain/run_month_list_mutants.sh`: 44 source mutants (list logic, root edge, Hall rule, start moves, junction digests in Julia, Flix and the independent verifier; coverage and stage composition), each must make its test fail.
  Not mutation-tested: the Hall count rule `wrong cells == deficiency` in the independent verifier and in Flix (the Julia rule is covered by `test_best_effort.jl`, mutant H2).
