# Native-verified R3 checkpoint before optimization pause

Candidate-generation source: `1e6f246810b241f7a3ddb38dc4c1dbf996f64f2f`.
The owner paused further optimization to prioritize a first presentation.
This checkpoint preserves observed results; it is not final solver clearance.

The unchanged R2 native Julia and independent Flix verifiers accept all four
primary raw chains and the supplemental midge recovery chain. Each paired
seven-line receipt is byte-identical, including actual intermediate physical
hashes and HTM/QTM/rotation metrics. All printing, legal generators and R2
source states are unchanged.

| Primary chain | HTM | QTM |
|---|---|---|
| January–February–March 2026 | 358 / 57 | 366 / 58 |
| February–March–April 2026 | 48 / 409 | 50 / 416 |
| November–December 2026–January 2027 | 446 / 401 | 454 / 412 |
| February–March–April 2028 | 363 / 361 | 368 / 372 |

Primary eight-edge observations: maximum 446, mean 305.375, median 362 HTM.
The supplemental midge probe is **66 / 432 HTM**, outside those statistics.
Its cached greedy attempt still reports a local plateau; bounded search finds
an executable continuation. No arbitrary-state completeness is established.

The unit log records 2,219 algebra/cost and 140,611 cached-action assertions.
These tests cover the unrelaxed catalog. Production-budget relaxation coverage
remains an open review finding, so this log is not full optimization clearance.
The timing logs concern the original pre-fix implementation and distinct search
workloads; allocation is cumulative, not resident memory. They must not be
attributed to a later corrected solver without new measurements.

Native replay from the repository root:

```sh
julia --startup-file=no research/calendar-7x7/continuous/verify.jl /tmp/calendar7-english-legal-dag.tsv research/calendar-7x7/minimax/evidence/chain-3.moves.tsv
java -Xmx8g -jar /tmp/calendar7-r2-review-flix/artifact/flix.jar chain research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review /tmp/calendar7-english-legal-dag.tsv research/calendar-7x7/minimax/evidence/chain-3.moves.tsv
```

The jar is built by the unchanged `continuous/flix/build.sh` at its configured
build directory. The example jar path identifies the separately built reviewer
artifact used for this checkpoint. The original DAG archive is decompressed as
specified in the R2 reproduction instructions. Julia 1.13.3, Flix 0.79.0,
wrapper 0.34.9 and Java 21 were used.

## Open implementation review findings

1. Full-endpoint deduplication currently keeps the first path instead of the
   best known trajectory; longer chains need careful Pareto-label handling.
2. Additive macro costs are compared against a normalized incumbent, which can
   prune useful cancellation paths. The bounded-search pruning policy needs a
   correction or a precisely tested limitation.
3. Tests must exercise nonzero relaxation budgets used by production experiments.
4. Export must assert equal input/word/hash lengths before writing any chain,
   rather than relying on `zip` truncation.
5. Expansion budgets count beam attempts, not the separate greedy incumbent
   scans; resource documentation must distinguish them.

These findings concern search quality, coverage and export robustness. They do
not invalidate native acceptance of the saved complete raw chains. Final
independent executable review, a complete reproduction driver and broader
regressions remain outstanding. Keep PR #115 Draft. No 100–120 or 200-HTM
bound, global optimality, complete 887-edge run or practical initialization is
claimed. No browser E2E, merge, deployment or release was performed.
