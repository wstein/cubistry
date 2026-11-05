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
(`../../global-search/evidence/chain-2026-2028/producer-run.jl`, SHA-256
`112ad364bcd27a6724182d5928bc55a5d047ae580ac3fab1cdcf025eccf89e9d`).

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
  the `base` chain byte for byte: `evidence/pure-orbitfb.moves.tsv` and
  `evidence/pure-base.moves.tsv` both have SHA-256
  `4e4df8d7b5d0666d2f34105032b227ae1166f92dd98c2d7e24d7fa4b524898e1`.

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

- **With the refined producer, the pure split is at the same level as the
  PR #99 print:** 128.5 HTM per edge on these 12 edges, against 129.8 under the
  same producer, settings and start policy.
- **Comparison with PR #130:**
  - 128.5 happens to equal PR #130's 35-edge mean (4496 / 35). That mean
    covers other years and states.
  - The like-for-like 2027 figure of PR #130's chain is 135.1 (1621 / 12), from
    other start states.
- **Fairness:**
  - The `orbitfb` fallback was added **after** seeing the PR #99 `base`
    failure. The pure split never activates it, so pure `orbitfb` equals pure
    `base`.
  - On the PR #99 print, the orbit-solve edge (Feb → Mar: 77 HTM, against 40
    for the pure split's hybrid) changes the PR #99 trajectory for every later
    edge.
  - This is one 12-edge trajectory per print. A gap of about 15 HTM (about 1%)
    is within noise: **on par, not "pure is lower"**.
- The heavy fallback edges of the earlier comparison (350 to 490 HTM) are gone
  on both prints. The refined producer's hybrid finish replaced them.
- What this cannot show:
  - optimal costs;
  - behavior in years other than 2027;
  - whether the producer stalls elsewhere. The PR #99 `base` run did stall,
    which is why `orbitfb` exists.

## Effort estimate for 2027–2099 (measured pilot numbers, not started)

- **Time:** the full chain is 875 edges. At about 256 to 263 seconds per edge
  that is about **62 to 64 hours** in one sequential process.
  - The pilot already covers 12 of those edges, so about 864 remain.
  - The seconds per edge exclude the one-time library build of each process:
    39 to 64 seconds, logged in `evidence/library-build.log` (654,752 macros).
  - The edge times were measured with a single producer process at a time.
  - Unlogged observation: two concurrent producer processes stopped without
    output; no log survives and the cause was not recorded.
- **Memory:** unlogged observation from `ps` of about 2.3 to 3.2 GB per producer
  process. No `/usr/bin/time` output was recorded.
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

## Resumable producer: [producer-resume.jl](producer-resume.jl)

A new file; the merged `producer.jl` is **not** modified. It derives from `producer.jl`
with SHA-256 `c9e2249fba62b5904525c20558f9d9789a8d79a2857b14368d9079e43dde2adc`
(`sha256sum pilot/producer.jl`), also recorded in the header of `producer-resume.jl`.
The block from `function obtm` through `solve_edge` (macro library, beam edge search,
hybrid finish, acceptance check, setting schedule 12/40/1, 8/30/1, 12/60/1, 12/40/0 and
the `orbitfb` fallback) is a verbatim copy of `producer.jl` lines 33-233. Only the
argument handling and the driver differ. The layout is fixed to the pure split and the
variant to `orbitfb`.

```sh
julia --startup-file=no pilot/producer-resume.jl DAG PRINT OUT_PREFIX EDGES START PRIOR_MOVES
```

- `EDGES`: number of new month edges; production stops after 2099-12.
- `START`: `YYYY-MM` root month of a fresh chain (`PRIOR_MOVES` is `-`), or `resume` to
  continue from the last edge of `PRIOR_MOVES`. A resume replays the whole prior chain
  from its root and checks every source and end digest and every strict front before
  producing anything.
- Writes `OUT_PREFIX.moves.tsv` (cumulative: prior edge blocks copied byte for byte,
  then the new blocks) and `OUT_PREFIX-edges.tsv` (exactly one header line, then the new
  edges only, so `tail -n +2` concatenates cleanly). Exits non-zero, without writing a
  moves file, when the prior chain does not replay or an edge fails.
- One process builds the 654,752-macro library (about 40 s) and needs about 3 GB. Run
  one producer process at a time.

### Tests (Julia 1.13.3)

Receipts are in `evidence/resume-*`.

1. **Determinism.** Resuming from the first 2 edges of `evidence/pure-orbitfb.moves.tsv`
   and producing 2 edges (2027-03 hybrid 40 HTM, 2027-04 global 130 HTM) gave a
   `.moves.tsv` byte-identical (SHA-256
   `e321cbc59ba34a8c7e18ac88afbf814382bc9ec063d5cd375413fc8a2cf9f064`) to the first 4
   edges of the shipped chain. The method and HTM columns of the edge rows match; the
   seconds column differs.
2. **Past 2027.** Resuming from the full 12-edge shipped chain and producing 2 edges gave
   2028-01 (hybrid, 149 HTM) and 2028-02 (hybrid, 147 HTM). The first 12 edge blocks are
   byte-identical to the shipped chain. **Both** chain verifiers (`pure_chain.jl` and the
   Flix `chain` command) accept this 14-edge chain, the receipts are identical, and the
   status is `VALID_CONTINUOUS_CHAIN 14 218 294 49`
   (endpoint `e0bd491ec3eb8c6e35d5bcc8d8fa2b4c07d945229f5c0083483946dd810c7c40`).
   This shows acceptance of one chain crossing the year boundary 2027 to 2028 with a
   leap-year February; acceptance of the rest of 2028-2099 is UNKNOWN until shown.
3. **Failure paths.** A prior chain with a changed move and a prior chain with a
   truncated edge block each exit 1 before producing any edge. A fresh START with a
   non-`-` PRIOR_MOVES exits 1.
4. **Fresh start.** `START=2028-01` with `PRIOR_MOVES=-` and `EDGES=2` (the workflow's smoke
   path) gave 2028-02 (global, 137 HTM) and 2028-03 (global, 149 HTM) from the DAG root
   with source month 2028-01. Both verifiers accept it with identical receipts
   (`VALID_CONTINUOUS_CHAIN 2 218 294 49`).

Files: `evidence/resume-determinism*`, `evidence/resume-2028*` (edge table, chain, Julia
and Flix receipts) and `evidence/resume-fresh-2028-01*`.
