<!--
Created by Werner Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0 (https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner Stein, Cubistry.
SPDX-License-Identifier: CC-BY-SA-4.0
-->
# Why the global beam stalls under the strict upright rule, and cheap chain edges

**Status: research study, not certified. The study itself changed no app file, workflow,
old checker or Flix. The chain producer section at the end was added later; the chain was
not started by the study.**
Base: branch `research/cube-display-feasibility` (head `e3af2033`), print
`../upright-feasibility/evidence/print-strict-upright.tsv`, rule: only the digit 0
and 6 <-> 9 read the same after a half turn. Read `../upright-moves/README.md` first.

Marks: **[V]** verified (a Julia script here printed it, output in `evidence/`),
**[I]** inference, **[D]** deferred. Everything verified is **Julia only; Flix was
not run.** Every word below was replayed by the independent `verify_moves.jl` code of
`../upright-moves` (own parser, own geometry, own boards, own strict rule).

## Result

| Question | Result |
|---|---|
| Root cause of the beam stall | four defects, three of them needed for the fix; the glyph rule itself is not shown to be the cause (next section) [V] |
| All 98 distinct display transitions solved (each from the root state of its source display) | **98 / 98**, independent replay **ACCEPT_ALL** [V] |
| HTM per transition | min 17, Q1 105, **median 115**, Q3 131, mean 112.9, max 156 [V] |
| Before (naive strict beam, fallback to orbit solve) | 270 to 462 HTM per edge, 4-edge smoke 1604 HTM [V, PR #337] |
| Old rule chain (pure split, 576 edges) | median 134, mean 131.0, min 14, max 471 HTM; mean 158 s per edge [V, `pure-split-states/evidence/chain-2028-2076-edges.tsv`] |
| 4-edge smoke from 2028-01, one retained state | 142, 105, 126, 108 = **481 HTM** (was 1604); all four by the beam, none by the orbit-solve fallback; `verify_smoke.jl` **ACCEPT** [V] |
| Seconds per edge | 98 transitions (four single-thread processes at once on 4 cores): mean 68 s, max 127 s [V]. Smoke, one process alone, single-threaded: 64 to 81 s [V, `evidence/chain-smoke-edges.tsv`]; with 4 threads 21 to 39 s with identical words [measured, not archived: no evidence file holds that run] |
| Target < 60 HTM per edge | **not met**: 7 transitions that change only 6 cells cost 22 HTM on average, the other 91 (about 36 cells change) cost 120 HTM, 2.6 HTM per wrong cell [V]. I do not see a way under 60 with this macro method [I] |
| Target < 60 s per edge | met with 4 threads (about 30 s, measured, not archived), not single-threaded (about 70 s) [V for single-threaded] |
| 863-edge chain | about **98 000 HTM** (was about 350 000) and **7 h** CPU wall with 4 threads, **17 h** single-threaded (was about 55 h) [estimate; the 7 h rests on the 4-thread timing that is not archived] |
| Flix port and Flix replay | **not done** [D] |

A correction to the task text: the old chain's median is 134 HTM, not 15. 15 is about its
minimum (14). Mean 131 is right. The new edges (median 115, mean 113) are therefore at the
old order of magnitude, a little below it, and the old rule was not cheaper per edge.

## Root cause [V unless marked]

First chain edge, display 25 (2028-01) to 26 (2028-02). After the planner's core frame
prefix 43 of the 49 front cells are wrong. The beam fixes 39 of them for 108 HTM
(about 2.8 HTM per cell, so the beam itself is fine) and then no macro in the library has
positive weighted progress: the stall is 4 cells [4, 22, 40, 253].
`diagnose_stall.jl` -> `evidence/stall-diagnosis.txt` prints, for each wrong cell, where
the pose it needs sits:

1. **The core cell is given up by the beam (cell 253).** The core is right after the
   prefix. The beam's progress is a weighted count, the core has the weight 1.0
   (`ORBIT_WEIGHTS_W1`, "8/8") like any corner, so a macro that fixes two cells and twists
   the front centre has positive progress [I: this is the mechanism; the evidence is that
   with weight 100 the core is never in a stall list]. At the stall the centre piece is
   the right one with the wrong twist (pose 255 where 253 is needed), and nothing cheap
   repairs it: the only moves that twist it are turns of the front layer (the whole
   display) or a whole-cube rotation.
   With core weight 100 the beam never gives the core up. Core weight 1 fails (UNKNOWN)
   on 4 of 8 development edges even with all other fixes (`evidence/ablation-8edges.tsv`).
2. **The old hybrid finish is self-defeating**. It restarts `orbit_solve` from a beam
   snapshot, and `orbit_solve` begins with `chain_core_prefix`. The core of every
   snapshot is wrong, so the prefix rotates the whole cube (`[21,21,21]`): 4 wrong cells
   become 47. The result is the 436 to 448 HTM of the hybrid experiments in
   `../upright-moves/evidence/beam-experiments-display1.tsv`, which looks like the plain orbit
   solve from scratch (440) in disguise [I for display 1: the mechanism was
   only shown on the 25 -> 26 snapshots, the match of the HTM is circumstantial].
3. **Plateaus that strict progress cannot cross (cell 4).** The cell holds the right
   corner cubie in the wrong twist (pose 9 where pose 8 of the same cubie is needed).
   Untwisting needs two orbit-isolated macros (cubie out, cubie in); the first has zero
   progress (wrong -> wrong), `strict=true` refuses it, and the beam library
   (commutators of single-layer blocks, at most one block as conjugator, plus two
   front-free layer turns) has no orbit-isolated macro of that kind. The planner's
   orbit catalogs (`chain_catalogues`, 1008 to 4048 macros per orbit, each moves no pose
   of any other orbit) do. The same holds for the core twist.
4. **Greedy trap (cells 22 and 40).** A cell counts as satisfied when its occupant is in
   its allowed set, independently of the other cells. The piece that cell 22 needs (pose
   2) sits in cell 10, whose allowed set is {2, 6, 8, 12, 13}; cell 40 needs pose 47,
   which sits in cell 36 (9 allowed poses). Taking it out of the flexible cell loses one
   and wins one: zero net progress. All-different filtering of the allowed sets (Regin;
   `tighten`) drops 7 (cell, pose) pairs on this edge and removes this trap (stall [4]).
   It is lossless, but **not needed**: with the catalog macros and the exact last mile
   the results with and without it are equal within noise (`evidence/ablation-8edges.tsv`).

What I could **not** show [I]: that the strict rule itself makes the stall worse. The
allowed sets are about equally small under both rules (mean size 1.64 strict, 1.67 old;
81 to 83 % of the cells have exactly one allowed pose; `evidence/allowed-sizes.txt`), and
the beam stalled on about half of the old edges too (299 of 576 old edges are "hybrid" (294 at l=12/w=40, 3 at l=8/w=30, 2 at w=60), plus 1 orbit-solve fallback; hybrid =
beam stall + orbit finish). What changed is that every finish now fails (point 2), because
the core is wrong in every snapshot; under the old rule the core of 39 of 91 displays had
two allowed poses, which probably hid point 1 more often. Per-edge stall rates of the old
beam were not re-measured.

Not shown to be the cause [I]: parity or orbit invariants. The quarter turns have
parities in a 3-dimensional space over the 11 orbits, but only 49 of 264 poses are
constrained and the hidden pieces can absorb a parity; all 98 transitions and all 91 root
words were solved, so no such obstruction showed up. Sticker supply: in all 13 surface
orbits the non-blank supply equals the peak demand (slack 0), and in the orbits
(-3,0), (-1,-1), (-1,0) and the core the blank supply is also used up
(`supply_slack.jl` -> `evidence/supply-slack.txt`). This makes most allowed sets single,
but a front display exists for every start tried.

## The fix (`beam2.jl`, untrusted generator)

1. **Core protection:** core weight 100 (`corew=100`).
2. **Orbit-isolated catalog macros in the beam library** (`catalog_macros`): 18 712 extra
   macros (673 464 in all). They cannot disturb any other orbit, so they finish residues
   and cross the twist plateau in two steps.
3. **Exact last mile** (`finish_orbit`, `finish_node`): from the cheapest beam snapshots,
   per orbit, the cheapest sequence of 1, 2 or (relevant macros only) 3 catalog macros
   that satisfies the orbit's cells; no cube rotation, the core stays. 14 of 98
   transitions needed it; the beam finished the other 84 alone.
4. **Indexed beam** (`beam_fast`): a node looks only at macros that move an allowed piece
   into a wrong cell (index over (cell, source position)). A macro with strictly positive
   progress must do that, so the child pool is identical; `check_equivalence.jl`
   compares it with the unchanged `GlobalSearch.beam_search` (word, snapshots, trace,
   stall; `evidence/equivalence.txt`). 4 to 6 times faster [measured, not archived]; threads over beam nodes give
   another factor 2.6 to 3, and 1 and 4 threads returned the same words (smoke: byte-identical) [both measured, not archived: no output file; re-run to confirm].
5. **Tightened allowed sets** (`tighten`), optional (see 4. above).
6. `lambda=3` (default 12): sums over 8 development edges 995 (lambda 3), 1020 (2), 1028
   (5), 1085 (8), 1169 (12) HTM (`evidence/lambda-tuning.tsv`). The spread between
   neighbours is within the noise (one edge differs by up to 40 HTM between settings); only
   12 vs 3 looks worse. Width 120 was tried on one edge only (121 to 122 HTM against
   119 to 137, at 3 times the time): not conclusive, not used.

Ablation on the first edge (`evidence/ablation-25-26.tsv`, lambda 12): of 13 combinations
only the ones with core protection **and** (catalog in the beam or last mile) solve it,
153 to 159 HTM. Tightening alone, core protection alone, tightening plus core protection
all stall ([4], [4,22,40], [60,112]).

`evidence/ablation-8edges.tsv` (8 development edges, HTM): the column `full` is
`lambda=5` (it equals the `lambda5` column of `evidence/lambda-tuning.tsv`), not the
chosen `lambda=3`. `no_tightening` and `core_weight_1` change one setting each.
`-1` means UNKNOWN (stall). The last mile (`finishN`, method column of the edge files)
starts from a beam snapshot with N wrong cells (N is the number of wrong cells of the
snapshot, not the number of macros); `solve_edge` tries the 6 snapshots with the fewest
wrong cells. The committed runs presumably used `tight=1` (tightening on), per the default of
`edge_batch.jl`; no edge TSV records its options. The `no_tightening` column is the exception.

## Measurements [V]

- `evidence/edges-98.tsv`: all 98 distinct directed display transitions (the edge graph of
  `../upright-moves/chain_plan.jl`), each from the root state of its source display,
  word, HTM, seconds, method (84 beam, 14 beam + last mile).
  `evidence/verify-edges.txt`: **ACCEPT_ALL**, 0 bad cells; each word shows one turned
  reading (the 9 as a turned 6, allowed by the accepted print, same as in the 91 root
  words).
- `evidence/wrong-counts.tsv`: cells that differ between the two boards and wrong cells at
  the start. 91 transitions change 32 to 41 cells, 7 change 6.
- `evidence/chain-smoke-edges.tsv`, `evidence/verify-smoke.txt`: the 4-edge smoke.
- `evidence/negative-controls.tsv`: valid accepted; old print, a dropped move, two swapped
  edge words, generator 22, a wrong declared HTM, a wrong target month and a wrong source
  display are all rejected (7 of 7).
- `evidence/chain-estimate.txt` (`chain_estimate.jl`): sum over the 98 transitions weighted
  by how often the 863-edge chain uses each: 113.3 HTM and 69.7 s per edge (contended),
  97 762 HTM and 16.7 CPU hours. Single-threaded smoke average 73 s -> 17.6 h; 4 threads
  30 s -> 7.2 h [4-thread figure measured, not archived].

## 863-edge chain, re-estimate [I]

| | edges | HTM per edge | total HTM | CPU |
|---|---|---|---|---|
| naive strict beam (PR #337) | 863 | 270 to 462 | about 350 000 | about 55 h |
| old rule, pure split chain | 576 (2028-2076) | 131 | about 75 000 | 158 s each |
| this work | 863 | 113 | **about 98 000** | **7 h wall (4 threads) to 17 h** |

It is an estimate: every edge in the real chain starts from the retained state and may
differ by +-30 HTM; the edges are strictly sequential, so the wall time cannot be reduced
by more processes, only by threads inside one edge. The 4-edge smoke (481 HTM, mean 120)
is consistent with the 98-transition mean (113). The real chain would also need the
fallback for the rare edge where no finish exists (not seen in 102 edges).

## Why not < 60 HTM [I]

91 of 98 transitions change about 36 cells, and 45 cells are wrong after the frame prefix.
Every wrong cell needs one specific piece (83 % of the cells have one allowed pose), the
beam spends 2.6 HTM per wrong cell, and a macro fixes 2 to 3 cells for 6 to 20 HTM. Less
than 60 HTM would need about 1.3 HTM per wrong cell. A different representation of the
months (fewer changed cells, i.e. a different print or layout) would be needed, not a
better search. Two ideas that do not pay: canonical states per display (98 words instead
of 863 solves, but a non-tree edge is the product of two tree paths, hundreds of HTM, and
the physical cube can never take a shortcut) and meet-in-the-middle for the last cells
(the last mile is already an exact search).

## Reproduce

```sh
cd research/calendar-7x7/upright-beam
gunzip -c ../pure-split-states/evidence/dag-all.tsv.gz > /tmp/dag-all.tsv   # pose action only
export DAG=/tmp/dag-all.tsv
P=../upright-feasibility/evidence/print-strict-upright.tsv
M=../upright-moves/evidence/moves-strict.tsv
julia --startup-file=no diagnose_stall.jl                                  # root cause, ~4 min
julia --startup-file=no ablate.jl OUT.tsv 25 26                            # ablation, ~10 min
julia --startup-file=no check_equivalence.jl 25:26 2:3                     # slow, ~20 min
julia --startup-file=no allowed_sizes.jl $P strict
julia --startup-file=no edge_batch.jl pairs OUT.tsv pairs=25:26,26:27 lambda=3   # 40..80 s per edge
julia --startup-file=no -t 4 edge_batch.jl smoke SMOKE.tsv n=4 lambda=3
julia --startup-file=no verify_edges.jl $P $M OUT.tsv                       # independent replay
julia --startup-file=no ../upright-moves/verify_smoke.jl $P $M SMOKE.tsv
julia --startup-file=no chain_estimate.jl ../upright-moves/evidence/chain-plan.tsv evidence/edges-98.tsv
./negative_controls.sh julia evidence/edges-98.tsv evidence/negative-controls.tsv
```

Julia 1.13.3 used (the base used 1.10.5; results do not depend on it). Timing columns are
not deterministic. Tests only via GitHub Actions: nothing was added to a workflow, and no CI
test covers these scripts yet.

## Not done [D]

- Flix port and Flix replay of the words (the base README says the same).
- The chain itself (863 edges), and a run of the smoke with the new fallback for an edge
  where nothing finishes.
- Stall rate of the old beam per edge under the old rule (only the method column of the old
  chain is available).
- The Hall/twist analysis is per orbit and by example (edge 25 -> 26); I did not prove that
  no other stall class exists, the 102 edges solved here are the only evidence.

## Chain production in segments (`chain_segment.jl`)

`chain_segment.jl DAG PRINT ROOT_MOVES OUT_PREFIX EDGES START PRIOR_MOVES` is the untrusted
producer behind the workflow `upright-chain.yml` (PR against `main`). It runs `solve_edge`
of `beam2.jl` exactly as `edge_batch.jl` smoke mode does (core weight 100, catalog macros,
exact last mile, `lambda=3`, 4 threads), but on **one retained state** and **resumable**:

- `START=YYYY-MM` with `PRIOR_MOVES=-` begins at the root word of that display; `START=resume`
  with a cumulative `chain.v1` file first replays that file from its root (every declared
  source and end SHA-256 and every front must match) and continues from its end.
- Output: `OUT_PREFIX.moves.tsv` (cumulative chain, prior blocks copied verbatim) and
  `OUT_PREFIX-edges.tsv` (the new edges: from, to, method, HTM, seconds).
- An edge nobody finishes falls back to the planner orbit solve (about 450 HTM); none
  of the 4 smoke edges needed it. It stops at 2099-12, or before the next edge once
  `CHAIN_DEADLINE_SECONDS` of the edge loop have passed, so a segment is shorter instead of
  hitting the 6 h job limit. If the deadline stops it before the first new edge it exits 3 and writes no moves
  file (the segment job fails instead of passing off the old chain as progress).
- Anything it writes is only a candidate. The workflow accepts a segment only when the Julia
  `pure_chain.jl` (strict rule), the Flix `chain` command (strict rule) and the independent
  replay `verify_chain.jl` all accept the **cumulative** chain and the two receipts are
  byte-identical (`../upright-flix/README.md`, "Strict chain command").

### Smoke evidence [V] (GitHub Actions run 42465455889, `upright-verify.yml` from branch `ci/upright-chain`)

| Check | Result |
|---|---|
| Two chained segments of 2 edges from 2028-01, the second resumed from the verified artifact of the first | cumulative chain **byte-identical** to the 4-edge smoke chain `chain-smoke.moves.tsv` (`../upright-beam/evidence/` of PR #347, compared by the job `chain-segment-smoke-compare`), which `make_chain.jl` wrote from `evidence/chain-smoke-edges.tsv`, the words of the earlier `edge_batch.jl` smoke run (another machine, one process); same words 142, 105, 126, 108 = 481 HTM |
| Checkers on the cumulative chain | Julia and Flix `VALID_CONTINUOUS_CHAIN 4 218 294 49`, receipts equal, replay `ACCEPT_CHAIN 4 2028-5` |
| Time on the hosted runner (4 cores, 4 threads) | setup 27 s (673 464 macros); 22, 22, 34, 36 s per edge (`evidence/chain-segments-smoke.edges.tsv`) [V]; the 30 s planning figure of the study holds, 70 s single-threaded is not re-measured here |
| Local check on a 4-core machine (not a test) | 2 + 2 edges, resumed: same bytes, 24 to 53 s per edge |

Not shown: that all 863 edges succeed (the study solved 98 transitions from root states and
a 4-edge chain; the retained state changes every edge) and the cost of the full chain; those
come from the chain run itself [D].

## Start months from 1900-01 (not only 2028-01)

The strict chain tooling accepts a chain that starts at any month from **1900-01** and runs to
at most **2099-12**. Nothing about the data had to change [V]: the 91 displays are the 91 start
weekday x month type combinations, and every month 1900-01 .. 2099-12 (2400 months) shows one of
the same 91 boards (checked with `pure_common.jl` `stacked_goals` against `stacked_board` and
`wrapped_board` for 1900..2099: 0 mismatches; 1900 is not a leap year, 2000 is, both handled by
the calendar functions). The display ids stay those of the first occurrence in 2026..2099 (2026-01 is
display 1, 2028-01 is 25, 1900-01 is 37, 2025-11 is 71). The distinct directed display transitions
are the same 98 for 1900..2099 as for 2028..2099, so the root words (`moves-strict.tsv`), the
strict print (pin `4fc44606...bcab`) and the chain plan stay valid. What changed is only a gate:

| File | Change |
|---|---|
| `chain_segment.jl` | `START` accepts 1900-01 .. 2099-12 (was 2026..2099) |
| `../pure-split-states/pure_chain.jl` | year bound 1900..2099, edge bound 2400 (was 2026..2099, 1000) |
| `../pure-split-states/flix/src/Chain.flix` | `validMonth` 1900..2099, edge bound 2400 (same) |
| `verify_chain.jl`, `make_chain.jl`, `chain_runner_*.sh`, `chain_controls.sh` | none (no year assumption) |
| `.github/workflows/upright-chain.yml`, `upright-chain-segment.yml` (PR against `main`) | `start_year` 1900..2099, `start` `YYYY-MM` with 19xx or 20xx |

`chain_plan.jl` still describes 2028..2099 (863 edges, 91 displays, 98 transitions) and is
unchanged; it is planning output only.

A chain is **one retained state from its own root**. A chain started at 2026-05 that runs to
2028-01 is therefore an independent chain: its state at 2028-01 is not the root state of the
2028-01 chain (`chain-smoke.moves.tsv`, `chain-2028-2076`), the two cannot be concatenated, and
no byte of the 2028 chains changes.

Cost: about 30 to 50 s per edge (4 threads); 2026-05 .. 2028-01 is 20 edges (about 11 to
17 min), 1900-01 .. 2099-12 is 2399 edges (an estimate of 20 to 33 h at 30 to 50 s per edge, 16 segments
of 150, two or three runs with `prior_run_id`) [D, estimate from the measured per-edge times, not run].

### Evidence from this change [V, local run on a 4-core machine, not Actions]

| Chain (3 edges unless noted) | Result |
|---|---|
| `chain-2026-05-smoke.moves.tsv` (2026-05 .. 2026-08, 121, 125, 137 HTM) | Julia and Flix `VALID_CONTINUOUS_CHAIN 3 218 294 49`, byte-identical receipts, replay `ACCEPT_CHAIN 3 2026-8`; nine controls rejected by each of the three checkers (`chain-controls-2026-05-*.tsv`) |
| `chain-2025-11-smoke.moves.tsv` (2025-11 .. 2026-02, a start before 2026) | the same three verdicts and nine controls (`chain-controls-2025-11-*.tsv`) |
| `chain-1900-01-smoke.moves.tsv` (2 edges, 1900-01 .. 1900-03) | Julia, Flix `VALID_CONTINUOUS_CHAIN 2 218 294 49`, replay `ACCEPT_CHAIN 2 1900-3`; nine controls rejected by each checker (`chain-controls-1900-01-*.tsv`) |
| A chain whose source year is 1899 | rejected by all three (`chain-source-year-1899-rejected.tsv`): Julia and Flix by the year gate, the replay (no year gate) because the declared month no longer matches the source display and the hashes |
| Regression: `chain-smoke.moves.tsv` (2028-01, 4 edges) with the changed verifiers | Julia, Flix and replay receipts byte-identical to the committed ones |

The producer change is one assertion, so a 2028 start produces the same bytes as before
(not re-run here; the committed byte-identical resume evidence above is unchanged).

Not shown: that the edges of a long chain from 2026 or 1900 all succeed (only the short chains above and the
edges produced there), the cost of the full chain, and a run on Actions (`upright-chain.yml` with
`start_year` before 2028 can be dispatched only after the workflow change is on `main`).
