# Pilot year: refined producer for the pure split and the PR #99 print

**Status: research pilot, not certified.** All chain numbers are search
results: not optimal, and no move savings are claimed. Each chain below was
checked by both chain verifiers (Julia and Flix) with identical receipts:

- PR #99 print: the **unchanged** continuous chain verifiers;
- pure split: the parametrized verifiers of `../pure_chain.jl` and the Flix
  `chain` command.

This builds on the pure split of wstein/cubistry#164 (merged) and its fair
comparison. The question is whether the pure split's move counts for December
2026 → December 2027 drop clearly with a refined producer, as PR #130's
`producer-run.jl` did for the PR #99 print (about 128.5 HTM per edge there).

## Producer

[producer.jl](producer.jl) (untrusted, candidate generator only) adapts PR #130's
hand-refined producer
(`../../global-search/evidence/chain-2026-2028/producer-run.jl`).

- **Copied unchanged:** the macro library, the beam edge search, the hybrid
  finish (minimax orbit search from the best four partial beam snapshots), the
  acceptance check, and the setting schedule
  (λ/width/minimum progress: 12/40/1, 8/30/1, 12/60/1, 12/40/0).
- **Parameters only:** the print, the displays, the DAG, the start state (the
  December 2026 root) and the 12 edges of 2027.
- **Same settings for both prints.** Each print carries its own physical state.
- **Variants** (each a separately labeled run):
  - `base`: PR #130's schedule as is.
  - `orbitfb`: `base` plus one fallback **motivated by the log**. With the
    PR #99 print, `base` failed on February → March 2027 with every setting
    and with the hybrid finish (`pr99-base-failure.log`). `orbitfb` then runs
    the planner orbit solve (`../orbit_solve.jl`).

  A second improvement was not needed for the comparison and was not tried.
- **Provenance:** the `base` runs used an earlier version of this file. It had
  two further variant hooks that `base` never activates. The `base` logic is
  identical, and the deterministic `orbitfb` run of the pure split reproduces
  the `base` chain byte for byte.

## Results (Dec 2026 → Dec 2027, 12 edges)

| Edge | PR #99, orbitfb | pure, base (= orbitfb) | PR #130 published chain (other start states) |
|---|---:|---:|---:|
| Dec → Jan | 85 (global) | 116 (hybrid) | 110 |
| Jan → Feb | 125 (global) | 126 (hybrid) | 153 |
| Feb → Mar | 77 (orbit-solve fallback) | 40 (hybrid) | 38 |
| Mar → Apr | 121 (global) | 130 (global) | 147 |
| Apr → May | 133 (hybrid) | 129 (global) | 164 |
| May → Jun | 140 (hybrid) | 143 (hybrid) | 158 |
| Jun → Jul | 142 (hybrid) | 139 (hybrid) | 126 |
| Jul → Aug | 141 (hybrid) | 153 (hybrid) | 144 |
| Aug → Sep | 144 (hybrid) | 146 (global) | 138 |
| Sep → Oct | 158 (hybrid) | 144 (hybrid) | 155 |
| Oct → Nov | 167 (global) | 134 (hybrid) | 160 |
| Nov → Dec | 124 (global) | 142 (global) | 128 |

| Run | Total HTM | Mean | Median | Max | global / hybrid / orbit fallback | Seconds per edge | Wall time |
|---|---:|---:|---:|---:|---|---:|---:|
| PR #99, orbitfb | 1557 | 129.8 | 136.5 | 167 | 5 / 6 / 1 | 263 | 52.5 min |
| pure, base | 1542 | 128.5 | 136.5 | 153 | 4 / 8 / 0 | 256 | 51.1 min |
| PR #99, base | — | — | — | — | failed at Feb → Mar | — | — |

The PR #130 column is the 2027 part of PR #130's 35-edge chain (January 2026
to December 2028). It starts from different physical states and is shown for
reference only: 1621 HTM in total, 135.1 per edge.

## Answer

- **The pure split reaches the PR #130 level with the refined producer:**
  128.5 HTM per edge on these 12 edges, against 129.8 for the PR #99 print
  under the same producer, settings and start policy.
- The heavy fallback edges of the earlier comparison (350 to 490 HTM) are gone
  on both prints. The refined producer's hybrid finish replaced them.
- What this cannot show:
  - optimal costs;
  - behavior in years other than 2027;
  - whether the producer stalls elsewhere. The PR #99 `base` run did stall,
    which is why `orbitfb` exists.

## Effort estimate for 2027–2099 (measured pilot numbers, not started)

- **Time:** 875 edges at about 256 to 263 seconds per edge is about **62 to 64
  hours** in one sequential process. Measured with a single producer process at
  a time. Two concurrent producer processes stopped without output, and the
  cause was not recorded.
- **Memory:** about 3.2 GB per producer process (measured); the library holds
  about 655,000 macros.
- **Parallelism:** only one chain at a time can carry the physical state, as in
  the earlier estimate. Running years in parallel needs full-state join edges,
  which is UNKNOWN.
- **Batching plan:** per-year segments in sequence. After each segment, verify
  the cumulative chain with both chain verifiers (minutes). Resume from the
  verified prefix.
- **Risks:**
  - producer stalls that need the orbit-solve fallback (1 of 24 edges here);
  - an edge where the fallback also fails would stop the run (UNKNOWN for
    other years).

## Reproduce

From `research/calendar-7x7/pure-split-states`, with the DAGs expanded
(`../en-physical-review/all-targets-dag.tsv.gz` for PR #99, `evidence/dag-all.tsv.gz`
for the pure split):

```sh
julia --startup-file=no pilot/producer.jl PR99_DAG ../english/evidence/physical-print.tsv pr99 OUT/pr99-orbitfb orbitfb
julia --startup-file=no pilot/producer.jl PURE_DAG evidence/print-pure-A.tsv pure OUT/pure-base base
julia --startup-file=no ../continuous/verify.jl PR99_DAG OUT/pr99-orbitfb.moves.tsv
julia --startup-file=no pure_chain.jl evidence/print-pure-A.tsv PURE_DAG OUT/pure-base.moves.tsv
```

The Flix verifiers run as `java -jar <continuous flix.jar> chain ../english/evidence ../en-physical-review DAG CHAIN`
and `java -jar <pure flix.jar> chain PRINT DAG CHAIN ../english/evidence ../en-physical-review`.
Run Flix verifiers one at a time, or with `-Xmx4g`, on a 15 GB machine.
