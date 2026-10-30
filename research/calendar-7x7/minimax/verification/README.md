# Corrected R3 verification (Phase A)

The corrected implementation at `7f71dde7363714d802f94ad095cf1752c2a23b73`
regenerates and independently verifies five complete two-edge chains. The
historical checkpoint in `../evidence/` is preserved unchanged.

Both unchanged native Julia and Flix chain checkers accept every saved raw word
and produce byte-identical receipts: complete initial/intermediate/end physical
hashes, HTM/QTM/rotation counts, actual artwork/up vectors and inverse restoration.
The supplemental midge word differs from the checkpoint only by simplification
of whole-cube turns; it was checked afresh by both native checkers.

Primary HTM remains 358, 57, 48, 409, 446, 401, 363, 361: maximum 446,
mean 305.375, median 362, nearest-rank p90/p95 446. Total HTM is 2,443.
The supplemental probe is 66/432 HTM and is excluded from these statistics.
No 100–120 or 200-HTM bound or global optimality is established.

## Search versus retained witnesses

Regeneration uses 60,000 relaxation attempts separately on orbits 4, 7 and 10,
beam width 8, chain width 2, depth cap 6, and 20,000 beam expansions per orbit.
The supplemental probe uses 40,000 expansions. Greedy incumbent scans and
catalog construction are outside those expansion budgets, as documented in
[search policy](../SEARCH-POLICY.md).

The new bounded candidates do not improve the certified checkpoint. Case 3
reports UNKNOWN at a corner local-search budget limit; the midge probe reports
UNKNOWN at orbit 4. The saved outputs explicitly retain previously verified
complete trajectories. A valid fallback is not a claim that the new search
solved the unsuccessful attempt. All failure and selection logs are preserved.

The corrected primary regeneration reported 82.53 seconds, approximately
1.076 GB peak RSS and 71.05 GB cumulative allocation. Allocation is not resident
memory. These measurements describe this implementation and budget, not the
pre-correction experiments in the historical checkpoint.

## Regression and reproduction

The unit receipt records **318,629 assertions**, including the production
60,000-attempt relaxed catalog, every cached inverse, exact orbit actions,
legal cancellation counterexamples, later cheaper endpoint trajectories,
Pareto tradeoffs and export length guards. The corrected search never uses an
additive or normalized-prefix cost as a hard incumbent pruning bound.

```sh
JULIA_BIN=julia bash research/calendar-7x7/minimax/reproduce.sh
```

The default regenerates R2 and compares its four words byte for byte, regenerates
the corrected selected R3 words at the declared budgets, builds the unchanged
Flix verifier, compares both native receipts, and checks nine shared corruptions.
`--verify-only` skips generation but runs software and native acceptance/rejection
gates. Set `CALENDAR7_MINIMAX_RESULTS_DIR` and
`CALENDAR7_MINIMAX_FLIX_BUILD_DIR` for isolated temporary outputs.

Independent final executable review is required before clearing Phase A.
All certified parents remain unchanged. No browser E2E, merge or deployment.
