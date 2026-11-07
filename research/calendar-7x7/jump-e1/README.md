<!-- SPDX-License-Identifier: CC-BY-SA-4.0 -->
# E1/E2: can the pure-split producer jump from an arbitrary pose?

**Status: experiment harness, not run yet. Candidate tooling only.**

Question (owner, 2026-11-07): can a universal solver replace the stored
month chain, that is, take the actual current pose and reach any display
front without a stored route? The feasibility study splits this into
experiments. This directory holds the first two. Nothing here certifies
a word; the chain verifiers (Julia and Flix) cannot check a word that
starts off the chain.

## What it measures

- **E1.** The unchanged producer search (`pilot/producer-resume.jl`:
  macro library, beam schedule 12/40/1, 8/30/1, 12/60/1, 12/40/0, hybrid
  finish, orbit-solve fallback) from start states that are *not* chain
  states. Start = end state of `pilot/evidence/pure-orbitfb.moves.tsv`
  (December 2027), then a seeded random walk of legal generators of
  length 50, 300, 1000, 3000 and 5000 (seed 20261107 + index). Whole-cube
  rotations are off in the walk by default (`E1_ROT=1` turns them on).
- **Targets (stratified).** 12 displays, 2 for each stratum: F31
  (Friday start, 31 days), S30 (Saturday start, 30 days), S31 (Saturday
  start, 31 days), plain (every other non-February month), Feb 28 and
  Feb 29. Rule, from `english/evidence/targets.tsv` (first month of each
  display id): the first id of the stratum in table order, then the
  first later id whose month and start weekday both differ (else whose
  weekday differs, else whose month differs, else the second id). The
  result is ids 5, 13 (F31), 28, 45 (S30), 8, 17 (S31), 1, 3 (plain),
  2, 14 (Feb 28), 26, 73 (Feb 29). 12 targets x 5 starts = 60 cases.
  The stratum is a column of every result row.
- **E2.** The orbit-by-orbit solve (`pure-split-states/orbit_solve.jl`)
  alone on the same 60 starts: the floor that must always finish. Its
  word goes through the producer's `accept` like E1's, so E1 and E2 use
  the same `improve_word`, `validate_front` and `M.htm`.
- **Library statistics.** Number of macros and mean stickers moved per
  macro, to estimate a sparse in-memory layout for a WASM port.
- **Resources.** Seconds per case and peak resident set per shard. The
  catalogue builds (orbit and hybrid) are done once before the first
  case and timed separately, so they do not inflate the first case.

## Output and re-check

Every row of `e1-shard*.tsv` carries the start digest, the end digest
and the word (signed generator numbers, one entry per quarter turn)
of E1 and of E2. A second, independent check replays each found word on
the 294 stickers with the continuous verifier's `direct_move` (`M.V`)
and compares state and digest with the producer's permutation
arithmetic (column `*_recheck`). Limits of that check: the front rule
is still the producer's `validate_front` (the verifier's own
`calendar_goal` implements the PR #99 layout, not the pure split), and
the check is not a chain verification. If it cannot run it reports
`unavailable` or `error` and does not fail the case.

## Reuse without copying

`jump_e1.jl` reads `pilot/producer-resume.jl`, checks its SHA-256
against a pin, cuts the text before the line that starts with
`# ---------------- driver`, replaces `@__DIR__` by the absolute
pilot directory, writes the prelude to a temporary directory outside
the source tree and includes it with
`ARGS = DAG PRINT /dev/null 1 resume PRIOR`. The producer's own
functions (`solve_edge`, `accept`, `orbit_solve`, `digest`,
`calendar_target`) then run unchanged. If the file or the marker
changes, the harness stops with an error.

## Gates (decided by the owner)

| Gate | Condition |
|---|---|
| E1 success | at least 95 % of the 60 cases end with a word that passes `validate_front` (57 of 60) |
| E1 length | median HTM at most 200 and nearest-rank p95 at most 500, over the successes |
| E2 floor | the orbit solve succeeds on every start |
| Stop rule (plan) | E1 success below 80 % ends the beam approach |

The median is the nearest-rank value, so for an even number of
successes it is the lower of the two middle values. `analyze_e1.jl`
prints a verdict only for the full run (60 expected, 60 distinct cases
present, none skipped). A smoke run prints `SMOKE (no verdict)`, an
incomplete run `INCOMPLETE (no verdict)`. Duplicate case ids are an
error. A pass only allows the next step (E3, a Rust WASM
micro-benchmark of the macro scan).

## Run (GitHub Actions only)

The dispatch-only workflow `.github/workflows/jump-e1.yml` on `main`
takes `research_ref`, runs 4 shards of 15 cases (one producer process
each, about 3 GB), uploads the shard tables and runs `analyze_e1.jl`.
Estimated cost: 4 jobs of about 75 minutes each, about 5 runner hours
(library build 40 to 64 s per process, about 260 s per case, plus the
E2 solve and the catalogue builds). A smoke run (one case, about 10
minutes) comes first. No local run is intended.

```sh
julia --startup-file=no jump_e1.jl DAG PRINT PRIOR OUT SHARD NSHARD
julia --startup-file=no analyze_e1.jl OUT 60
```

## What it cannot show

- Optimality, completeness, or that a found word is a safe physical
  route: the front rule is the producer's own.
- Behavior of a Rust or WASM port: time and memory here are those of the
  Julia producer. E3 measures the port.
- Starts reached by other means (a photographed or hand-entered pose).
  The walk starts from a legal state, so reachability is guaranteed.
- Random walks with whole-cube rotations unless `E1_ROT=1` is used.
  Whether the core prefix handles a rotated pose is UNKNOWN.
- Few starts per target: the success rate has a wide interval.
- The 6 strata are not all weekdays of every month type; two displays
  per stratum are a sample, not a coverage proof.
- Moves are counted as in the producer (`M.htm`); whole-cube rotation
  steps are counted separately as grouped steps (consecutive moves of
  one generator merge) and cost 0 HTM.

## License

Code: AGPL-3.0-or-later (SPDX-License-Identifier in each `.jl` header).
This text and the result tables: CC BY-SA 4.0 (SPDX-License-Identifier:
CC-BY-SA-4.0). Created by Werner Stein with AI assistance (Claude,
Anthropic). Licensed under CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/). Attribution: Werner
Stein, Cubistry.
