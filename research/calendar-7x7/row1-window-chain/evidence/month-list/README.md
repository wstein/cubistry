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
- Chain format `cubistry.calendar7.chain.v1` is unchanged. The `edge year month` of edge i must equal member i+1 of S.
  An edge whose month is more than one calendar month after the previous member is a bridge edge (state edge across a
  gap); Julia, Flix and the independent verifier mark it with a trailing `BRIDGE` field on the edge line, and the `months`
  line of a list-mode receipt gives the number of bridge edges. WINDOW_END receipts have no new field and no `months` line.
- Receipts of print, corner and chain checkers in list mode have one added line, `months<TAB>sha<TAB>count<TAB>first<TAB>last<TAB>bridges`.

## Root rule

The chain root is the identity pose of the print. The checkers enforce it twice: the chain `source` record must read
`5 2026 5`, and the front of the identity state must equal the board of the first member of S. The first member is
therefore fixed to 2026-05 in all three chain checkers (Julia, Flix, independent), and a list that starts elsewhere
(`root-mismatch`) is rejected. A chain that starts before May 2026 needs a print whose solved front shows that month:
`printing-S2.tsv` (and the 2037-01 print and the stored 21-month print) show only May months when solved (2026-05,
2037-05, 2043-05, 2048-05). Months before the root (2026-01, 2026-03, 2026-04) front-match the S2 print but are
not chain members; `coverage-S2.tsv` lists them as `before_root`, separate from gaps. This follows the owner decision
that the chain starts at the May 2026 identity root.

## Coverage

`month_coverage.jl` generates `coverage-S2.tsv` and `coverage-S2.json` from the pinned list `months-S2.tsv` (286 months) and the
gap statuses in `status-S2.tsv`. `verify_coverage.jl` (separate code) recomputes the headline, every run, gap, bridge and
before_root month from the list alone, checks that runs and gaps partition May 2026 .. 2050-01, checks that the JSON agrees,
and fails on any mismatch. A gap is `unavailable_unsat` only if it cites a Julia and a Flix corner receipt that are
byte-identical, say UNSAT, and contain the gap month, with all other targets in S; otherwise `unknown`. The coverage
tools are bookkeeping and Julia only; the UNSAT facts are the cited receipts.

```
gapless: 2026-05 .. 2037-01 (129 months)      chain members 283, runs 3, gaps 2, bridges 2, before_root 4
gaps:    2037-02, 2043-02                       both unavailable_unsat (corner receipts Julia and Flix identical)
before_root: 2026-01 (print member), 2026-02 (not), 2026-03, 2026-04 (print members)
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
  verifier with identical Julia/Flix receipts; 12 negatives (skipped month with an edge into it, missing member, wrong
  list hash, interior-gap chain presented as contiguous list, interior-gap chain under the default `WINDOW_END`, list not
  increasing, duplicate month, root mismatch, bridge edge declaring the skipped month, wrong end digest on a bridge edge,
  CRLF list, month out of range) are rejected by all three at the named reason.
- `row1-window-chain/test_month_coverage.jl`: generator output equals the stored coverage; 12 tampered copies are rejected.
- `row1-window-chain/run_month_list_receipts.sh`: regression (committed 2028-01 chain receipts, 129-month print and corner
  receipts, 21-month print) and the S2 receipts above.
- `row1-window-chain/run_month_list_mutants.sh`: source mutants of the list logic (Julia, Flix, coverage), each must make its test fail.
