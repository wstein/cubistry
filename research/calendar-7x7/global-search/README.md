# Global macro beam search for single calendar transitions

Candidate generator only. Research module stacked on the minimax and
protected-row work; it changes no printing, planner, verifier, evidence or
application code. It reuses `../continuous/solver_chain.jl` (planner, through
`../minimax/algebra.jl`) and `../continuous/verify.jl` unchanged.

**Status: CANDIDATE tooling.** No output of this module is verified until both
unchanged native chain verifiers, Julia (`../continuous/verify.jl`) and Flix
(`../continuous/flix`), accept the exported raw chain and their receipts agree.
There is no optimality, completeness or 200-HTM guarantee.

## Method

The orbit-by-orbit solver (`../minimax/search.jl`) fixes the ten front orbits
one after another with macros that touch only that orbit. This module instead
runs one beam search over complete cube states for a whole month edge:

- **State and goal.** After the planner's core prefix
  (`chain_core_prefix`), the goal is that all 49 constrained front positions
  hold an allowed piece pose (`macro_front_constraints` for orbits 1..11).
  Nothing outside the front is constrained, so macros may have arbitrary side
  effects there.
- **Score.** A child is ranked by
  `lambda * weighted_wrong_front_positions + HTM(parent word) + HTM(macro)`.
  The kept node stores its exactly normalized word (minimax `simplify`); its
  real HTM replaces the additive estimate at the next depth.
- **Idea 1, don't-care progress.** A macro's progress is the number of front
  positions it turns from wrong to right minus those it turns from right to
  wrong (weighted variant analogously). Positions that are currently wrong are
  free, so cheap plain insertions such as `x y x'` are admissible whenever no
  correct position is lost. By default only strictly positive weighted
  progress is accepted (`strict=true`).
- **Idea 2, middle-slice commutators.** A middle-slice quarter turn is not a
  legal single move. It is expanded to the whole-cube rotation plus inverse
  quarter turns of the six noncentral layers on that axis (6 HTM); its
  permutation equals the planner's `chain_alphabet` generator `21+axis`.
  Commutators `[m,y]` and `[y,m]` with such a turn `m` (quarter, inverse, half)
  and a base block `y` on another axis are added to the library.
- **Idea 3, orbit weighting.** Orbits 4, 7 and 10 lie on the middle row and
  middle column of the front, where single legal layer turns cannot reach
  without disturbing much of the front. Weighting their wrong positions higher
  makes the beam solve them early, while the front is still mostly free.
- **Library.** Base blocks are single noncentral layer turns (quarter, inverse,
  half) and adjacent two-layer turns. From them: commutators `[x,y]` on
  different axes, middle-slice commutators, every commutator conjugated by one
  base block and by two front-free single-layer setups (derived as the
  single-layer turns that move no front piece), and all plain words of one to
  three single-layer turns. Macros that move no front position are dropped;
  for every permutation the first cheapest word in enumeration order
  is kept (its HTM with adjacent equal turns merged). The library does
  not depend on the calendar target and can be reused across edges.
- **Determinism.** The library is sorted by `(HTM, word)`, all pool keys are full
  tuples, and duplicate states are detected by the complete occupant vector,
  so runs are reproducible for fixed inputs and parameters.

At the end, `search_edge` normalizes the word with `improve_word`, checks that
the incrementally tracked occupants equal an independent replay, and calls the
planner's `validate_front`. That check belongs to the planner and is not a
native verification.

## Parameters

| Name | Default | Meaning |
|---|---|---|
| `lambda` | 12 | weight of a wrong front position relative to one HTM |
| `width` | 40 | beam width |
| `fanout` | 4 | each parent contributes at most `fanout*width` children |
| `maxdepth` | 60 | maximum number of macros after the core prefix |
| `patience` | 8 | stop after this many depths without a new minimum of wrong positions |
| `strict` | true | require strictly positive weighted progress per macro |
| `prune_incumbent` | true | drop children not cheaper than the best complete word (heuristic cut, not a lower bound) |
| `orbit_weights` | `W1` | `W1`: baseline HTM per wrong piece per orbit on the Jan→Feb 2027 edge, divided by 8; `W2`: 3 for orbits 4, 7, 10, else 1; `uniform` |
| `library` | `L5` | `L1`: single-layer commutators and setups; `L4`: plus two-layer blocks and plain words up to length 3; `L5`: plus middle-slice commutators |

`W1` is calibrated on one edge and is not a general cost model.

## Running

```sh
gzip -dc research/calendar-7x7/en-physical-review/all-targets-dag.tsv.gz > /tmp/dag.tsv
julia --startup-file=no research/calendar-7x7/global-search/test.jl
julia --startup-file=no --heap-size-hint=3500M research/calendar-7x7/global-search/search.jl \
    /tmp/dag.tsv research/calendar-7x7/minimax/verification/chain-3.moves.tsv 2 2027 2 /tmp/gs-out \
    lambda=12 width=40 library=L5 weights=W1
```

The command replays the root and the first `PREFIX_EDGES` edges of a saved
chain (each front validated, each digest compared), searches the following
month and writes `trace.tsv`, `summary.tsv`, `edge.word` and
`candidate.moves.tsv`. The last file contains the replayed prefix edges and the
new edge in the `cubistry.calendar7.chain.v1` format, ready for both native
verifiers. `PREFIX_EDGES` must be at least 1 because the verifiers require two
edges. If the beam does not finish, the status is `UNKNOWN_*` and the wrong
front positions are printed; a failed search is not an impossibility result.

`test.jl` (about 1.5 minutes on one core) checks library legality (every stored
action equals the replayed word, generators 1..21 only, costs equal native HTM),
middle-slice turns and commutators against the planner's expansion, the
don't-care progress counter against full recomputation, and a reduced-budget
`L1` run on the cheap edge Feb→Mar 2026 that must pass `validate_front`, be
deterministic and export a chain accepted by the unchanged Julia verifier code.
That last step is a format smoke test, not a receipt. Set `CALENDAR7_DAG` to
reuse an already decompressed DAG.

## What is established and what is not

Established (software level only):

- The fast tests above pass.
- On the experiment edge Jan 2027 → Feb 2027 (state after edge 2027-1 of
  `minimax/verification/chain-3.moves.tsv`), an earlier experimental script
  found a 119 HTM / 136 OBTM word with `L5`, `lambda=12`, `width=40`, `W1`,
  where the orbit-by-orbit solver (width 8, budget 150000, relax budget 60000)
  needs 456 HTM / 497 OBTM. That word passed only the planner's
  `validate_front` and a replay.
- This port reproduces that result as a candidate: with the same parameters it
  follows the same per-depth trajectory (wrong positions / cheapest beam HTM
  24/15 at depth 4, 12/68 at depth 10, 1/115 at depth 19) and finishes at
  depth 20 with a 119 HTM word that passes `validate_front`. The word differs
  from the experiment's word (tie order differs), so its end state differs too
  (end digest `1ecaf408…1bea5`). Exported candidate chain (chain-3 root, its
  two saved edges and the new edge): SHA-256
  `5c347bf4d014de02475588918bb977a5f8fe2d36c4b4c7b7b5218181fc21dc7c`. The
  candidate file is not committed; it is regenerated by the command above.
- The reduced `L4` test run on the chain-1 Feb 2026 state returns an 18 HTM
  candidate for Feb→Mar 2026, where the saved chain-1 edge has 57 HTM. Also
  unverified.

Not established:

- No native verification of any word produced by this module (see below).
- One experiment edge only; no statement about other edges or whole chains.
  The end state differs from the orbit solver's end state off the front, which
  matters for later edges of a chain.
- No optimality, no completeness, no 200-HTM (or 100–120 HTM) bound. The
  search is a heuristic beam.

## Known limits

- The `L5` library has 654,752 macros (2,452,542 words tried). Building it
  took about 30 s; the port's process stayed near 1.5 GB resident memory
  (about 2.5 GB in the experimental script, which stored dense permutations).
  The beam scans the whole library for every node: the 20-depth reproduction
  took about 7 minutes on the shared 4-core machine (about 2.5 minutes in the
  experiment on a less loaded machine).
- Without middle-slice commutators the beam typically stalls with a few wrong
  positions, almost all in orbits 4, 7 and 10. Even with `L5` a stall can
  occur; the run then reports `UNKNOWN_STALLED`/`UNKNOWN_PATIENCE`. The
  experimental script finished such runs with the orbit solver; that hybrid
  fallback is not part of this module.
- A single remaining wrong position whose only allowed piece sits on another
  front position cannot be fixed by one strictly improving macro; it needs a
  macro that also moves that piece's position correctly. `L1` stalls this way
  on the chain-1 Feb 2026 state (orbit 3); `L4` finishes.
- Results are sensitive to tie-breaking and library word choice. A variant that
  ranked library words by their normalized HTM stalled at one wrong position on
  the experiment edge; the committed version keeps the experiment's choice
  (first cheapest raw word).
- `prune_incumbent` and the additive score can discard continuations that would
  have cancelled to a shorter word.

## Native verification receipts

Reserved. Receipts are added only after the unchanged native Julia and Flix
chain verifiers have been run on an exported `candidate.moves.tsv` by the
session owner, following `../minimax/reproduce.sh` (`--verify-only` style).
Until then every result of this module is a candidate.

<!-- RECEIPTS: input file, SHA-256, Julia receipt, Flix receipt, cmp result -->
