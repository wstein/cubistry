<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Explicit month list S for the calendar-7 checkers

Research candidate, not certified. Independent review is pending. Julia and Flix both read the list; statements
below say which of them accepted what. Stacked on the skip-capacity study (`../window-skip/`).

## Mechanism

A month list is a file `months-*.tsv`: one `YYYY-MM` per row, strictly increasing, UTF-8, LF, final LF, from
1900-01 to 2100-01. It is pinned by its SHA-256 (`sha256.txt`, passed on the command line like the print hash).

| Checker | Selects the list | Without a list |
|---|---|---|
| Julia `row1-corner-coupling/check.jl`, `row1-window-print/check.jl`, `row1-window-chain/check.jl` | `CAL7_WINDOW_MONTHS=path`, `CAL7_WINDOW_MONTHS_SHA256=hex` | `WINDOW_END` (default 2028-01), unchanged |
| Julia `row1-window-chain/verify_chain.jl` (own list reader) | same variables | same |
| Flix corner jar | trailing arguments `MONTHS_FILE MONTHS_SHA256` | `ORIGINAL_EVIDENCE` is the last argument |
| Flix print jar | trailing arguments `MONTHS_FILE MONTHS_SHA256` | same |
| Flix chain jar | `... ORIGINAL_EVIDENCE months MONTHS_FILE MONTHS_SHA256 PRINT_SHA256 [LAYOUT_SHA256]` | `[WINDOW_END PRINT_SHA256]` |

- The list and `WINDOW_END` exclude each other; a list without a hash, a wrong hash, a row outside 1900-01..2100-01,
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
with only joined junctions and lists every other stage separately. A run whose first stage has a free start and is not joined to a predecessor is `free_single` / `free_composed`: exact, but not anchored at the identity pose. Julia and Flix receipt of a stage must be two different files. `verify_stage_coverage.jl` re-reads the receipts with its own code.
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
calendar months between START and LAST that are not in S (bridged, status from `status-*.tsv`). The `exact` status is planned: it is derived from the list and the status files only and no chain receipt is read for exact months (a best-effort month is `best_effort` only with chain receipts). Headline `planned-exact-gapless FIRST..LAST (N months)` is the first maximal run of exact calendar-consecutive
members; best-effort months are chain members listed separately, not gaps. A best-effort month is `best_effort` only with Julia and Flix chain receipts that carry the
`BEST_EFFORT` edge line with exactly those cells, otherwise `best_effort_unverified` (Julia Hall table `february-hall-S2.tsv`). `verify_coverage.jl` (separate code) recomputes everything from the
list and checks the JSON. `coverage-S2.*` (list `months-S2.tsv`, start = root = 2026-05) and `coverage-chain-2026-03.*` (list `months-chain-2026-03.tsv`, root 1980-01, start 2026-03, both Februaries best-effort) are committed.

```
coverage-S2:            planned-exact-gapless 2026-05 .. 2037-01 (129 months)   chain members 283, planned exact runs 3, best-effort 0, gaps 2, bridges 2, before_start 4
coverage-chain-2026-03: planned-exact-gapless 2026-03 .. 2037-01 (131 months)   chain members 287, planned exact runs 3, best-effort 2 (2037-02, 2043-02), gaps 0, before_start 2
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
- `row1-window-chain/root_best_effort_cases.jl` and `run_root_best_effort_checks.sh`: 31 fixtures, 10 accepted and 21 rejected (`GROUP=k/n` runs a share, 4 groups of about 8 fixtures take 1 to 2 minutes each) by Julia, Flix and the independent verifier at the
  named reason (root month, best-effort months, stages with free start and junction digests).
- `row1-window-chain/test_best_effort.jl` (16 tests: `chain_root_month`, Hall witness on `printing-S2.tsv` for February 2037), `test_stage_coverage.jl` (19 tests: junction mismatch, missing
  junction lines, different months, differing receipts, best-effort and bridge stages, verifier agreement).
- `row1-window-chain/test_month_coverage.jl` (36 tests): generator output equals the stored coverage; tampered copies are rejected; start 2026-03 gives 131 months and two before_start months; root and start are separate parameters; verified and unverified best-effort months.
- `row1-window-chain/run_month_list_receipts.sh`: regression (committed 2028-01 chain receipts, 129-month print and corner
  receipts, 21-month print) and the S2 receipts above.
- `row1-window-chain/run_month_list_mutants.sh`: 59 source mutants (list logic, root edge, Hall rule, start moves, junction digests in Julia, Flix and the independent verifier; coverage and stage composition), each must make its test fail.

## First chain: January 2019 .. January 2036 (owner decision 2026-11-12)

Research candidate, not certified. Julia only for the month list, Hall table and coverage; no solver or workflow was run for them (UNKNOWN as evidence). Chains and Flix receipts for root 2019-01: `../root-2019/`.
Print C is merged (#446): `../print-c/`, `printing.tsv` SHA-256 `0119ca3b...f9a92f8fc`, layout `e9a409ea...2b62a`.

| File | Content |
|---|---|
| `months-chain-2019-01-2036-01.tsv` | 205 months, strictly ascending, 2019-01 .. 2036-01, no gap; SHA-256 `4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3` (`sha256.txt`) |
| `stages-chain-2019-01-2036-01.tsv` | five stages of 41, 41, 41, 41, 40 edges (data only) |
| `best-effort-chain-2019-01-2036-01.tsv` | `best_effort_path` file: 2026-02, wrong cell (7,1), evidence `february-hall-C.tsv` |
| `february-hall-C.tsv` | Hall witness table of print C for 2026-02 (Julia only), read by `verify_coverage.jl` |
| `coverage-chain-2019-01-2036-01.{tsv,json}` | output of `month_coverage.jl` (root 2019-01, start 2019-01, last 2036-01) |
| `../../test_month_chain_2019.jl`, `../../run_chain2019_mutants.sh` | tests (`test_month_chain_2019.jl` 29 checks, `test_hall_table_c.jl` 10 checks) and 14 data mutants (`ONLY=name` selects one) |

Root and edges (stage reading B of the owner plan): the root is the solved cube, which shows January 2019 (January, Tuesday, 31 days;
the same board as January 1980 and January 2030). 2019-01 is S[1], so there is no root edge. A chain of 205 members has 204 edges;
edge i leads from S[i] to S[i+1]. `CAL7_ROOT_MONTH` is the default (S[1]). The older root fixtures of the checkers use 2037-05; root 2019-01 is accepted by the three chain checkers (fixtures `../root-2019/`, run `../../run_root2019_checks.sh`). Only `../window-skip/months.jl` (print checker) accepts months from 2026-01 only; `month_coverage.jl`, `read_list` and the producer library accept 2019 (range 1900-01 .. 2100-01).

| Stage | Edges | Count | Start state month (S[first edge]) | End month (S[last edge + 1]) |
|---|---|---|---|---|
| 1 | 1 .. 41 | 41 | 2019-01 (root) | 2022-06 |
| 2 | 42 .. 82 | 41 | 2022-06 | 2025-11 |
| 3 | 83 .. 123 | 41 | 2025-11 | 2029-04 |
| 4 | 124 .. 164 | 41 | 2029-04 | 2032-09 |
| 5 | 165 .. 204 | 40 | 2032-09 | 2036-01 |

Consecutive stages join in the boundary month (stages 2 to 5 start at a free state, chain.v3 `start` block, joined by digest). 2026-02 is edge 85 (stage 3).

Coverage (`month_coverage.jl`, list pinned by hash): 205 chain members, planned exact runs 2 (2019-01 .. 2026-01: 85 months, 2026-03 .. 2036-01: 119 months), best-effort 1 (2026-02, `best_effort_unverified`), gaps 0, bridges 0, before_start 0.
The `range` field of that output prints the generator's constant `2026-01` (`FIRST`) and is not a statement about the list. `verify_coverage.jl` first rejected this
coverage with `Hall witness table exists`: the `evidence` field of the best-effort file was free text (a path of `../config-coverage/` with a note), not the name of a file in this directory, and `../config-coverage/best-effort-feb-sunday-28.tsv` is keyed by print and cell, not by month. Now the field is `february-hall-C.tsv`, the Hall witness table of print C (`february_hall.jl LAYOUT PRINT 2026-02@7,1`: class `-3,-3,-3`, deficiency 1, wrong cell `7,1`, Hall set `7,1;7,7`, one neighbor body; the witness is checked by `chain_hall_check` of `check.jl`), and `verify_coverage.jl` accepts the coverage (`../../test_hall_table_c.jl`). The fallback cell (7,7) is the second cell of the Hall set in that table.

Configurations (Julia, `Dates`, weekday of the 1st and month length; lookup in `../config-coverage/config-table.tsv` column `C1980_status`, the matchings of print C are the
ones of print C-1980, `../print-c/README.md`): 88 of the 91 configurations occur, 87 of them front-match print C, 92 distinct consecutive configuration pairs.
204 of 205 months have a matching configuration (exact); the only month without one is 2026-02 (February, Sunday, 28 days), the best-effort month. It is the only February/Sunday/28 in the range (the previous one is 2015-02, the next 2037-02).

Best-effort data: the maximum matching of February/Sunday/28 on print C has 48 of 49 cells; the wrong cell is (7,1) (the corner must show the digit 29) with (7,7) as fallback and a note
(`../config-coverage/best-effort-feb-sunday-28.tsv`, print `C`). The file has the format `month status wrong_cells evidence` of `read_best_effort` (`window_chain_lib.jl`); the producer writes a best-effort edge for it (digit 29 in (7,1), rule in `../../README.md`; a file entry (7,7) needs the switch `best_effort_cell=7,7`). No claims file: `claims_path` rows are for months that are not chain members, and a claim on a chain member is an error (`read_claims`/`month_records`).
No fixed full state is stored for any configuration.

Not run: Flix on the month list, Hall table and coverage (Flix ran only on the root-2019 fixtures); the long chain; `stage_coverage.jl` (needs Julia and Flix stage receipts); the workflow; a receipt of the 205 months against print C (the print receipt covers the 90 configurations of print C-1980).

## Backward chain: January 2019 .. January 1980 (owner decision 2026-11-12)

Research candidate, not certified. Julia only for the list, Hall table and coverage; no chain of this list was produced (UNKNOWN as evidence).
The identity pose of print C (the solved cube, January 2019, the root of the first chain) stays the root. The next chain goes backward in time from it; the forward chain after it is computed later.

How the direction is represented (`window_chain.jl direction=backward`, `../../README.md`): the producer searches from the identity pose to earlier months (the plan is the list reversed; `CAL7_ROOT_MONTH` must be empty).
OUT then holds a forward-reading chain.v3: the free start is the search words in order (identity pose -> state of the first member), the edges are the reversed inverse words, the last edge ends at the identity pose.
The three checkers read it unchanged with `CAL7_JOIN_END=identity` (`run_checks.sh` passes the variable to Flix too, `check_join_forwarding.sh`). The checker root month stays empty: a free start has no root edge.
The first member of the list is the free start, so its month must be exact: a best-effort month at the tip of the search is never a stop (one more edge is produced), and a best-effort first member of the list is refused.
`prior=DIR` reads such a chain.v3, converts it back to the search order and continues it to earlier months. edges.tsv, segments.tsv and months.tsv are in search order (edge 1 leaves the identity pose).
PROGRESS.txt of a backward run: `direction=backward`, `chain_end` = the last member of the list (the identity pose), `chain_start` = the earliest month reached.

| File | Content |
|---|---|
| `months-back-1980-01-2019-01.tsv` | 469 months 1980-01 .. 2019-01 (increasing, no gap); SHA-256 `d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041` |
| `best-effort-back-1980-01-2019-01.tsv` | `best_effort_path` file: 1981-02, 1987-02, 1998-02, 2009-02, 2015-02, wrong cell (7,1); SHA-256 `dde09fef9c08575d4a6dbcbb10b2e016d066818b491f2899123816ad744ebdeb` |
| `february-hall-C-back.tsv` | Hall witness table of print C for these 5 months (Julia only, `february_hall.jl`; class -3,-3,-3, deficiency 1, Hall set 7,1;7,7) |
| `stages-back-1980-01-2019-01.tsv` | stage plan (data only) |
| `coverage-back-1980-01-2019-01.{tsv,json}` | `month_coverage.jl` (root = start 1980-01, last 2019-01); `verify_coverage.jl` accepts it |

Months print C cannot show exactly: the test matches the board of every month against print C (91 boards, 90 matchable). Only February, Sunday, 28 days fails: 1981-02, 1987-02, 1998-02, 2009-02, 2015-02
(the leap years 1980, 1984, .., 2016, also 2000, are exact; 1900 is outside the list). 1980-01 and 2019-01 are January/Tuesday/31 (the identity front). Whether the solver reaches every state is UNKNOWN.

468 edges. The stage plan keeps the measured basis of the first chain (27 to 37 s per edge, 64 edges in 1700 to 2400 s of the 3000 s edge loop); the times of backward edges are UNKNOWN.
The artifact of every stage starts at an exact month (a free start shows its month exactly). `expect_prior_edges` is the edge count of the exported chain before the stage.

| Stage | Search edges | max_edges | expect_prior_edges | Start month of the artifact |
|---|---|---|---|---|
| 1 | 1 .. 64 | 64 | none (no prior) | 2013-09 |
| 2 | 65 .. 128 | 64 | 64 | 2008-05 |
| 3 | 129 .. 192 | 64 | 128 | 2003-01 |
| 4 | 193 .. 256 | 64 | 192 | 1997-09 |
| 5 | 257 .. 320 | 64 | 256 | 1992-05 |
| 6 | 321 .. 384 | 64 | 320 | 1987-01 |
| 7 | 385 .. 448 | 64 | 384 | 1981-09 |
| 8 | 449 .. 468 | 20 | 448 | 1980-01 |

Inputs of every run: months_path `research/calendar-7x7/row1-window-chain/evidence/month-list/months-back-1980-01-2019-01.tsv`, months_sha256 `d99f6681...3041`, root_month empty, print and layout of print C
(`evidence/print-c/`), best_effort_path `.../best-effort-back-1980-01-2019-01.tsv`, library L5, width 40, lambda 3, best_effort_29 true, `direction=backward`, `join_end=identity`.
The workflow on main has neither `direction` nor `join_end` and cuts the list of the verify job at the late end: it cannot run this chain yet (proposal: a separate workflow change).

Tests: `test_window_chain_backward.jl` (44 checks, lib), `test_month_chain_back.jl` (42 checks, data), `check_join_forwarding.sh` (7 cases), `check_backward_refusals.sh` (3 cases),
`run_backward_e2e.sh` (end to end on a tiny list, opt-in, see its header) and `run_backward_mutants.sh` (44 mutants, `ONLY=name` selects one).

## Second chain: January 2036 .. January 2100 (preparation; no run yet)

Research candidate, not certified. Julia only for the list, Hall table and coverage; no solver or workflow ran for this list (UNKNOWN as evidence).
The second chain continues the verified first chain (204 edges, run 43307881914) as one cumulative chain with the same root, print and layout.

| File | Content |
|---|---|
| `months-chain-2019-01-2100-01.tsv` | 973 months 2019-01 .. 2100-01, no gap; the first 205 rows are `months-chain-2019-01-2036-01.tsv` byte for byte; SHA-256 `05691e207922d28669b9eb12ee99c666a13d076312eff1a049fc9b4430504ad1` |
| `best-effort-chain-2019-01-2100-01.tsv` | `best_effort_path` file: 9 months, wrong cell (7,1), evidence `february-hall-C-2100.tsv`; SHA-256 `8acf0308680cf1ff784f29cd917b1481c8df4237ca9cc1c5f6a3ea1853bceb29` |
| `february-hall-C-2100.tsv` | Hall witness table of print C for the 9 months (Julia only, `february_hall.jl`; class -3,-3,-3, deficiency 1, Hall set 7,1;7,7) |
| `stages-chain-2036-01-2100-01.tsv` | stage plan (data only): stages 6 .. 18 |
| `coverage-chain-2019-01-2100-01.{tsv,json}` | `month_coverage.jl` (root 2019-01, start 2019-01, last 2100-01); `verify_coverage.jl` accepts it |
| `../../test_month_chain_2100.jl`, `../../run_chain2100_mutants.sh` | test (45 checks) and 18 data mutants |

Months print C cannot show exactly. The test matches the board of every month of the list against print C (`ConfigTable.match_config`, 91 distinct boards, 90 matchable).
The only unmatchable configuration is February, Sunday, 28 days: 2026-02 (first chain), 2037-02, 2043-02, 2054-02, 2065-02, 2071-02, 2082-02, 2093-02, 2099-02 (8 in the new range).
These 9 months are the best-effort months (digit 29 in cell (7,1), one wrong cell); the other 964 members are exact on print C. All 29-day Februaries (2036, 2040, .. 2096) and the
other 28-day Februaries are exact. 2100 is no leap year; 2100-02 is not a member (the last month is 2100-01, the limit of the checkers and the workflow). Exactness of a month means a
front matching of its board, not a chain edge: whether the solver reaches each state is UNKNOWN until the chain is run.

Edges: 972 in total (973 members, no root edge), 204 done, 768 new. Measured times of the first chain (runs 43292017378 .. 43307881914, produce job 19 to 25 min, edge loop 27 to 37 s per edge, verify job 55 to 69 s; greedy edges 0):
64 edges take about 1700 to 2400 s of the 3000 s edge loop (job limit 70 min), so a run of 64 edges stays inside the limits; a stop at the deadline is clean but breaks the planned `expect_prior_edges` (then read `edges_total` from the artifact).

| Stage | Edges | max_edges | expect_prior_edges | Start month | End month |
|---|---|---|---|---|---|
| 6 (continuation smoke) | 205 .. 207 | 3 | 204 | 2036-01 | 2036-04 |
| 7 .. 17 | 208 .. 911, 64 each | 64 | 207, 271, 335, 399, 463, 527, 591, 655, 719, 783, 847 | 2036-04 | 2094-12 |
| 18 | 912 .. 972 | 61 | 911 | 2094-12 | 2100-01 |

13 runs (stages 6 to 18). Stage 6 is the first real continuation and is kept: its artifact is the prior of stage 7 (a run needs the artifact of the previous run, one run at a time).

Workflow contract (`window-chain.yml` on origin/main, read on 2026-11-13). The inputs of the first chain's runs: root_month empty (the first member of the list is 2019-01; the prior artifact records `root_month=-`, so
`root_month=2019-01` would be rejected as another root), `layout_path` and `layout_sha256` of print C, `best_effort_29` true, `fail_on_greedy` true, `library` L5, `width` 40, `lambda` 3.
The producer (`window_chain.jl`) accepts the longer list: it requires the months of the prior chain to equal the first months of the plan (`prior chain months do not match the plan`) and writes the month list pin of every segment into `segments.tsv`.
The step "Prepare work directory" of the job `produce` compares the prior `VERIFIED.txt` with the inputs: `months_sha256` (the prior is `4ad43a59...`, the new list `05691e20...`), `best_effort_sha256` (prior `00b721b1...`, new `8acf0308...`) and `complete=false` (the prior ends at the last month of its list, `complete=true`).
Read from `window-chain.yml` on origin/main (#462, #468): the optional inputs `prior_months_sha256` and `prior_best_effort_sha256` replace the comparison values of the first two checks when set, and a `prior_months_sha256` that differs from `months_sha256` lifts the `complete=false` check.
The inputs `direction` (default forward) and `join_end` (default empty) exist as well; the prior must match both (an older artifact counts as forward, no join_end), so the continuation uses the defaults. The producer's prefix check and the verify job still check the whole chain.
Nothing here ran the workflow with these inputs (UNKNOWN as run evidence). Stage 6 would be the first run with `prior_months_sha256` and `prior_best_effort_sha256`.
Limit stated in the workflow header: with `prior_best_effort_sha256` nothing checks the old edges against the new best-effort file (UNKNOWN).

Inputs common to every run (paths at the research commit that contains this change; `research_ref` must be that commit on `research/cube-display-feasibility`):

| Input | Value |
|---|---|
| months_path | `research/calendar-7x7/row1-window-chain/evidence/month-list/months-chain-2019-01-2100-01.tsv` |
| months_sha256 | `05691e207922d28669b9eb12ee99c666a13d076312eff1a049fc9b4430504ad1` |
| root_month | empty (S[1] = 2019-01) |
| print_path, print_sha256 | `research/calendar-7x7/row1-window-chain/evidence/print-c/printing.tsv`, `0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc` |
| layout_path, layout_sha256 | `research/calendar-7x7/row1-window-chain/evidence/print-c/layout.tsv`, `e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a` |
| best_effort_path | `research/calendar-7x7/row1-window-chain/evidence/month-list/best-effort-chain-2019-01-2100-01.tsv` |
| library, width, lambda, best_effort_29, fail_on_greedy | L5, 40, 3, true, true (defaults) |

Smoke runs (not executed here). (a) Without a prior: `smoke_mode=true` (3 edges from the root, ignores the prior; about 15 min) checks the list pin, the best-effort file, the layout and the research commit through prepare, produce and verify:

```
gh workflow run window-chain.yml --ref main -f research_ref=<SHA> -f months_path=research/calendar-7x7/row1-window-chain/evidence/month-list/months-chain-2019-01-2100-01.tsv -f months_sha256=05691e207922d28669b9eb12ee99c666a13d076312eff1a049fc9b4430504ad1 -f print_path=research/calendar-7x7/row1-window-chain/evidence/print-c/printing.tsv -f print_sha256=0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc -f layout_path=research/calendar-7x7/row1-window-chain/evidence/print-c/layout.tsv -f layout_sha256=e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a -f best_effort_path=research/calendar-7x7/row1-window-chain/evidence/month-list/best-effort-chain-2019-01-2100-01.tsv -f smoke_mode=true
```

(b) Stage 6, the continuation smoke, with the prior inputs of the workflow on main (the three edges 2036-02, 2036-03, 2036-04 are exact months):
the same command with `-f smoke_mode=false -f prior_run_id=43307881914 -f expect_prior_edges=204 -f max_edges=3 -f prior_months_sha256=4ad43a5997ec019fd0383d7d853589213d09c2bb4e20179e1cdb94df5c6a66c3 -f prior_best_effort_sha256=00b721b107cb7ad64c5b1d2ae90c0f7cbda6930f8d306492b5f98b2c3b33fbbe`.
Stage 7: `-f prior_run_id=<run id of stage 6> -f expect_prior_edges=207 -f max_edges=64` and without the two `prior_*_sha256` inputs (the prior of stage 7 on has the new list and file); then only `prior_run_id`, `expect_prior_edges` and `max_edges` change, as in the table above.

Local producer check (Julia 1.13.3, 4 threads, load about 30): `window_chain.jl` with the new list, print C, layout C, the new best-effort file, `prior=` the artifact of run 43307881914 (204 edges) and `max_edges=1` accepted the prior (replay, end digest, plan prefix), wrote edge 206 (2036-02, beam, 131 HTM, 172 s) and stopped at `max_edges`; 302 s in total, library build 126 s. No checker ran on that chain.

Not run: the workflow, a chain of more than one new edge, the three checkers on a chain of the new list, Flix on the Hall table. Stage 6 is the first time the checkers see a chain of this list.

## Backward chain, part 2: January 1900 .. January 1980 (preparation; no run yet)

Research candidate, not certified. Julia only for the list, Hall table and coverage; no solver or workflow ran for this list (UNKNOWN as evidence).
This part continues the verified backward chain 2019-01 .. 1980-01 (run 43414242499: 8 stages, 468 edges, 5 best-effort edges, artifact `wc-chain-43414242499`, `complete=true` for its list) to earlier months.
The root stays the identity pose of print C (2019-01). The list is longer at the early end: the last 469 rows are `months-back-1980-01-2019-01.tsv` byte for byte, so the prior months are the LAST members of the new list and the FIRST months of the search plan (the new list reversed).

| File | Content |
|---|---|
| `months-back-1900-01-2019-01.tsv` | 1429 months 1900-01 .. 2019-01, no gap; SHA-256 `6f858506f30a3b58ba4e4330234c280d5093908cae5f0e62d093933afa0447d0` |
| `best-effort-back-1900-01-2019-01.tsv` | `best_effort_path` file: 13 months, wrong cell (7,1), evidence `february-hall-C-back-1900.tsv`; SHA-256 `0cbf16f68a507f98236da2d4a9fabda65d4b7bd8abcda9fb0f1c54bf2b74c428` |
| `february-hall-C-back-1900.tsv` | Hall witness table of print C for the 13 months (Julia only, `february_hall.jl` with `@7,1`; class -3,-3,-3, deficiency 1, Hall set 7,1;7,7); the five rows of 1981-02 .. 2015-02 equal `february-hall-C-back.tsv` |
| `stages-back-1900-01-2019-01.tsv` | stage plan 9 .. 23 (data only) |
| `coverage-back-1900-01-2019-01.{tsv,json}` | `month_coverage.jl` (root = start 1900-01, last 2019-01); `verify_coverage.jl` accepts it |

Months print C cannot show exactly: February, Sunday, 28 days. 13 months in 1900 .. 2019: 1903-02, 1914-02, 1925-02, 1931-02, 1942-02, 1953-02, 1959-02, 1970-02 (new) and the five of the verified chain 1981-02, 1987-02, 1998-02, 2009-02, 2015-02.
The weekdays were computed twice (Zeller's congruence and `Dates`, equal for all 1440 months) and the board of every month was matched against print C (`ConfigTable.match_config`): exactly these 13 are unmatchable, all other 1416 are exact.
1900 is no leap year (1900-02 has 28 days, February/Thursday/28, exact); 2000 is one. The first member 1900-01 is January/Monday/31 and exact, so the free start of the final exported chain shows its month exactly.
Whether the solver reaches every state is UNKNOWN.

Edges: 1428 in total (1429 members), 468 done, 960 new = 15 stages of 64 edges (no remainder stage). The time per edge is the measured basis of the earlier chains (27 to 37 s, 64 edges in 1700 to 2400 s of the 3000 s edge loop); the times of these edges are UNKNOWN.
`expect_prior_edges` is the edge count of the exported chain before the stage. Every stage ends at an exact month (a free start shows its month exactly).

| Stage | Search edges | max_edges | expect_prior_edges | Start month of the artifact |
|---|---|---|---|---|
| 9 | 469 .. 532 | 64 | 468 | 1974-09 |
| 10 | 533 .. 596 | 64 | 532 | 1969-05 |
| 11 | 597 .. 660 | 64 | 596 | 1964-01 |
| 12 | 661 .. 724 | 64 | 660 | 1958-09 |
| 13 | 725 .. 788 | 64 | 724 | 1953-05 |
| 14 | 789 .. 852 | 64 | 788 | 1948-01 |
| 15 | 853 .. 916 | 64 | 852 | 1942-09 |
| 16 | 917 .. 980 | 64 | 916 | 1937-05 |
| 17 | 981 .. 1044 | 64 | 980 | 1932-01 |
| 18 | 1045 .. 1108 | 64 | 1044 | 1926-09 |
| 19 | 1109 .. 1172 | 64 | 1108 | 1921-05 |
| 20 | 1173 .. 1236 | 64 | 1172 | 1916-01 |
| 21 | 1237 .. 1300 | 64 | 1236 | 1910-09 |
| 22 | 1301 .. 1364 | 64 | 1300 | 1905-05 |
| 23 | 1365 .. 1428 | 64 | 1364 | 1900-01 |

Compatibility with the producer and the workflow (read from `window_chain.jl` here and `window-chain.yml` on origin/main, 99ef1733):
- Producer, `direction=backward prior=DIR`: `backward_import` turns the prior chain.v3 into the search order; `chain_progress` requires the prior months to equal `plan[1:k+1]` with plan = the list reversed. With the new list the plan starts 2019-01, 2018-12, .., 1980-01 and then continues, so the 469 prior months are the plan prefix. A forward-style extension (prior months are the first members of the list) is refused (`chain source is not the root month`). The best-effort months of the prior chain are read from its `wrong` records (`prior_best_edges`) and need no entry in the new file; the new file lists them anyway.
- Workflow, "Prepare work directory": the prior `VERIFIED.txt` of run 43414242499 has `months_sha256=d99f6681..`, `best_effort_sha256=dde09fef..`, `root_month=-`, `direction=backward`, `join_end=identity`, `edges_total=468`, `complete=true`. With `prior_months_sha256=d99f6681..` and `prior_best_effort_sha256=dde09fef..` the comparisons use the pins of the prior; the differing `prior_months_sha256` lifts the `complete=false` requirement; `expect_prior_edges=468` equals `edges_total`; direction and join_end match. Stages 10 to 23 continue the artifact of the previous stage of this chain, which has the new list: no `prior_*_sha256` inputs and `complete=false` until stage 23 (stage 23 ends at the list start: `complete=true`).
- Prior run: `workflow_dispatch` on `main`, conclusion success, artifact `wc-chain-43414242499` not expired (expires 2027-02-11): the "Check prior run" step accepts it.
- The verify job cuts the list at `chain_start` (the earliest month reached) and checks with `CAL7_JOIN_END=identity`; the month range 1900-01 .. 2100-01 of producer, checkers and the Flix root-month parser contains 1900-01.
- `research_ref` must be a commit on `research/cube-display-feasibility` that contains these files (the workflow rejects other commits), so the first dispatch happens after this change is merged there.

Dispatch of stage 9 (not executed; `<SHA>` is the head of `research/cube-display-feasibility` that contains this change; defaults: library L5, width 40, lambda 3, best_effort_29 true, fail_on_greedy true, root_month empty):

```
gh workflow run window-chain.yml --ref main -f research_ref=<SHA> -f months_path=research/calendar-7x7/row1-window-chain/evidence/month-list/months-back-1900-01-2019-01.tsv -f months_sha256=6f858506f30a3b58ba4e4330234c280d5093908cae5f0e62d093933afa0447d0 -f print_path=research/calendar-7x7/row1-window-chain/evidence/print-c/printing.tsv -f print_sha256=0119ca3ba1266f9c3e4d7c27753801aca30eb4af514f491615666dcd9f92a8fc -f layout_path=research/calendar-7x7/row1-window-chain/evidence/print-c/layout.tsv -f layout_sha256=e9a409eab9f0b94f05aff626efc564472fcf6271cbae42f85a2de84713c2b62a -f best_effort_path=research/calendar-7x7/row1-window-chain/evidence/month-list/best-effort-back-1900-01-2019-01.tsv -f direction=backward -f join_end=identity -f prior_run_id=43414242499 -f expect_prior_edges=468 -f max_edges=64 -f prior_months_sha256=d99f668118ecd2b094b188cb94d8bd9057a62f934e635e56bec8304b2a331041 -f prior_best_effort_sha256=dde09fef9c08575d4a6dbcbb10b2e016d066818b491f2899123816ad744ebdeb
```

Stage 10 and later: the same command with `-f prior_run_id=<run id of the previous stage> -f expect_prior_edges=<table> -f max_edges=64` and without the two `prior_*_sha256` inputs. One run at a time (a run needs the artifact of the previous one).

Tests: `test_month_chain_back_1900.jl` (63 checks, data and the producer's prefix check; 65 with `CAL7_PRIOR_ARTIFACT=<copy of wc-chain-43414242499>`), `check_back1900_workflow_inputs.sh` (17 checks with a synthetic prior, 16 with the real artifact; it runs the real steps of the workflow on origin/main with yq) and
`run_back1900_mutants.sh` (34 mutants in three groups, `ONLY=name` selects one).

Local producer check (Julia 1.11.5, 4 threads, load about 25): `window_chain.jl direction=backward` with the new list, print C, layout C, the new best-effort file, `prior=` the artifact of run 43414242499 and `max_edges=1` accepted the prior (replay, end digest, plan prefix), wrote edge 469 (1980-01 to 1979-12, beam, 116 HTM, 113 s), exported a chain.v3 of 469 edges, kept `best_effort_edges=5` and stopped at `max_edges` (`complete=false`, `chain_start=1979-12`); 169 s in total. This is the producer step of stage 9 on one edge; its output is not a stage artifact (no run id, no checkers).

Not run: the workflow, a chain of more than one new edge, the three checkers on a chain of this list (the verify job reads a list of up to 1429 months and 1428 edges, longer than any earlier run: its time is UNKNOWN), Flix on the Hall table and on a list that starts exactly at 1900-01, the real download of the prior artifact. A stage can stop at the deadline before its 64 edges (then `edges_total` of the artifact differs from the plan and the next `expect_prior_edges` follows it).
