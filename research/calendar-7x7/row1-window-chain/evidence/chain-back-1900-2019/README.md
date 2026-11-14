<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Backward chain 2019-01 .. 1900-01 on print C

Research candidate, not certified. Independent review is pending.

Chain of 1428 edges and 1429 months, 1900-01 .. 2019-01, on print C (`../print-c/`, solved cube = January 2019). It was computed backward from
2019-01 by `window-chain.yml` (direction backward, beam width 40, lambda 3) in 23 consecutive runs of 64 edges (the eighth run: 20 edges, the earlier month
list ended at 1980-01). The last run is 43542652089 (`complete=true`, `greedy_edges=0`). The chain is stored in time order: edge i leads to member i+1
of `../month-list/months-back-1900-01-2019-01.tsv`; the start block is a free state (chain.v3), the end state is the identity.

| File | Content |
|---|---|
| `chain.moves.tsv` | the chain (chain.v3) |
| `months.tsv`, `edges.tsv` | month table (valid, or unknown for the 13 best-effort months) and per-edge method |
| `segments.tsv` | the 23 runs: run id, head SHA of the research branch, width, lambda, month-list SHA, edge range |
| `julia.tsv`, `flix.tsv` | receipts of `check.jl` and of the Flix chain jar, byte-identical |
| `independent.tsv` | receipt of `verify_chain.jl`: root and every edge ACCEPT, verdict ACCEPT_BEST_EFFORT_CHAIN |
| `VERIFIED.txt`, `PROGRESS.txt`, `flix-jar.sha256`, `run.log` | files of the last run |
| `provenance.tsv` | SHA-256 of print C, layout, month list, best-effort list, inputs per run and every file here |
| `states.sha256` | SHA-256 of the 1429 state files (17 MB); the states are not committed |

Results (receipts): 1415 exact edges and 13 best-effort edges (1903-02, 1914-02, 1925-02, ... wrong cell 7,1, see `../month-list/best-effort-back-1900-01-2019-01.tsv`);
summary `1429 1428 161721 191741 2137 2771 list:2019-01 INVERSE_PASS`.

Runs 1-8 used research commit `dab8dc5` and the month list 1980-01 .. 2019-01, runs 9-14 `e095a81`, runs 15-23 `7a22c2c`; runs 9-23 use the month list of
this directory. The chain file of the last run contains all earlier edges, and the three checkers accept it as a whole.

Reproduce: `gh run download 43542652089 -R wstein/cubistry` (artifact `wc-chain-43542652089`, retained until 2027-02-12), then `check.jl` and `verify_chain.jl` with
`CAL7_WINDOW_MONTHS`, `CAL7_WINDOW_MONTHS_SHA256`, `CAL7_WINDOW_PRINT_SHA`, `CAL7_WINDOW_LAYOUT`, `CAL7_WINDOW_LAYOUT_SHA256`, `CAL7_JOIN_END=identity`, `CAL7_BEST_EFFORT_29=1` as in
`run_checks.sh`. Consistency of this directory: `julia --startup-file=no test_chain_back_1900_evidence.jl` (about 3 s).

Not part of this directory: a root change to 1900-01 (`root_change.jl` was not run), the Print D freeze, the forward chain 2019-01 .. 2100-01, the Flix rerun on this
branch (the receipt `flix.tsv` is that of the CI run) and the coverage and Hall files for the full range.
