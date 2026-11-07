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
- **Targets.** 12 display ids: 1, 9, 17, 25, 33, 41, 50, 58, 66, 74, 82,
  91, each at its first month of occurrence (`english/evidence/targets.tsv`).
  12 targets x 5 starts = 60 cases. The analysis prints the weekday of the
  first and the number of days of each month, so the type mix is visible.
- **E2.** The orbit-by-orbit solve (`pure-split-states/orbit_solve.jl`)
  alone on the same 60 starts: the floor that must always finish.
- **Library statistics.** Number of macros and mean stickers moved per
  macro, to estimate a sparse in-memory layout for a WASM port.
- **Resources.** Seconds per case, peak resident set per shard.

## Reuse without copying

`jump_e1.jl` reads `pilot/producer-resume.jl`, cuts the text before the
line starting with `# ---------------- driver`, writes that prelude next to
the producer (so its relative includes work) and includes it with
`ARGS = DAG PRINT /dev/null 1 resume PRIOR`. The producer's own functions
(`solve_edge`, `orbit_solve`, `digest`, `calendar_target`) then run
unchanged. If the marker disappears, the harness stops with an error.

## Gates (decided by the owner)

| Gate | Condition |
|---|---|
| E1 success | at least 95 % of the 60 cases end with a word that passes `validate_front` |
| E1 length | median HTM at most 200 and nearest-rank p95 at most 500, over the successes |
| E2 floor | the orbit solve succeeds on every start |

Anything below the gates means the beam approach is not a candidate for a
browser engine and the offline pre-computation stays the plan. A pass only
allows the next step (E3, a Rust WASM micro-benchmark of the macro scan).

## Run (GitHub Actions only)

`.github/workflows/jump-e1.yml` on `main` takes `research_ref`, runs 4
shards of 15 cases (one producer process each, about 3 GB), uploads the
shard tables and runs `analyze_e1.jl`. Estimated cost: 4 jobs of about
75 minutes each, about 5 runner hours (library build 40 to 64 s per
process, about 260 s per case, plus the E2 solve). A smoke run (one case,
about 10 minutes) comes first. No local run is intended.

```sh
julia --startup-file=no jump_e1.jl DAG PRINT PRIOR OUT SHARD NSHARD
julia --startup-file=no analyze_e1.jl OUT 60
```

## What it cannot show

- Optimality, completeness, or that a found word is a safe physical
  route: the only check is the planner's own `validate_front`.
- Behavior of a Rust or WASM port: time and memory here are those of the
  Julia producer. E3 measures the port.
- Starts reached by other means (a photographed or hand-entered pose).
  The walk starts from a legal state, so reachability is guaranteed.
- Random walks with whole-cube rotations unless `E1_ROT=1` is used.
  Whether the core prefix handles a rotated pose is UNKNOWN.
- Fewer than 5 starts per target: the success rate has a wide interval
  (57 of 60 is the pass line).

## License

Code: AGPL-3.0-or-later. This text and any result tables: CC BY-SA 4.0
(https://creativecommons.org/licenses/by-sa/4.0/). Created by Werner
Stein with AI assistance (Claude, Anthropic). Licensed under CC BY-SA 4.0.
Attribution: Werner Stein, Cubistry.
