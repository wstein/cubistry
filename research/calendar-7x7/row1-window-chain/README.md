<!-- SPDX-License-Identifier: AGPL-3.0-or-later -->
# Month-name window: legal retained-state chain

The fixed whole-cubie printing from [the print experiment](../row1-window-print/README.md)
has a legal chain for May 2026 through January 2028: 21 states and 20 adjacent
month changes. All words start from the retained preceding state. May 2026 is
the identity pose of this new printing. No independent root words are joined.

The witness has 7338 HTM, 7514 QTM, 368 stored rotations and 376 rotation QTM.
It is not optimized. The words use the existing legal generators 1 through 21,
with exponents -1, 1 or 2; no middle-slice generator is introduced. Reverse
playback uses the reversed inverse word. Each edge and the complete chain
restore all 294 surfaces when reversed.

Julia and Flix replay the raw words independently, compare a direct action on
294 printed surfaces with an action on 264 oriented piece poses, and check all
21 complete snapshots, artwork, ink, orientation, chronological adjacency,
source/end hashes and all four move metrics. The print is immutable, including
hidden faces. Their receipts are byte-identical. A separate adaptation of the
existing independent `verify_chain.jl` also accepts all 20 edges and inverses;
that third replay checks HTM and hashes, while the first two check all metrics.
Its geometry, calendar construction and optics do not call the producer.
Silent self-checks of its band and blank optics reject a quarter-turned band, a
blank tile read as band and a band read as blank.

The profile keeps the bottom line on every empty row-one band tile upright.
Plain empty date tiles remain distinct. O is upright and differs from 0;
only 0 and the pair 6/9 have the inherited neutral rotations. Proper body
rotations preserve the permanent placement and up vectors of all printed faces.

## Reproduction

Build with `CALENDAR7_CHAIN_FLIX_BUILD_DIR=<unique scratch build directory>
bash flix/build.sh`. The wrapper writes `<build>/artifact/<build-name>.jar`.
Then run:

```sh
bash run_checks.sh JULIA JAVA CHAIN_JAR UNIQUE_SCRATCH_DIRECTORY --mutations
```

The default without `--mutations` runs the three positive replays. The opt-in
suite corrupts adjacency, each metric type, hashes, legal moves, canonical
encoding and full snapshots; both primary native checkers must reject each
case. `generate.jl OUT` is an untrusted candidate producer, reusing the existing
bounded orbit solver with a private in-memory band profile. Run it under an
external 290-second timeout and verify its output independently. It stops
starting new targets after 240 seconds. No frozen solver or proof is edited.

## Window end after January 2028

The window end is a parameter: `WINDOW_END=YYYY-MM` (default `2028-01`) for `check.jl`,
`verify_chain.jl`, `generate.jl` and `run_checks.sh`, and the optional arguments
`WINDOW_END PRINT_SHA256` of the Flix checker. The 21-month defaults and the stored evidence are
unchanged byte for byte. A longer window needs the SHA-256 of its print in `CAL7_WINDOW_PRINT_SHA`
(`run_checks.sh` also takes `PRINT_OVERRIDE`, `CHAIN_OVERRIDE`, `STATES_OVERRIDE`). Julia and Flix
chain checkers assert that the window end equals the year and month of the last chain edge
(`verify_chain.jl` asserts the final month). The Flix print checker in `../row1-window-print` is
fixed at 21 months and its messages say 21; the Julia print checker follows the window end.

Seam. The chain stays one chain when the stored chain is extended from its end state with the
stored print: `SEAM_CHAIN=evidence/moves.tsv SEAM_STATES=evidence/states WINDOW_END=2028-03 julia
generate.jl OUT`. The generator replays the stored words, checks the end digest, copies the stored
rows and snapshots verbatim and continues. `check_seam.jl` (run by `run_checks.sh` with
`SEAM_STORED=1`) checks the byte-identical prefix, the unchanged snapshots and that the first new
edge starts at the stored end digest. `test_seam.jl` extends to 2028-02 and breaks the seam three
ways. The same join point is meant for a later backward extension.

Result with the stored print and the stored states: 2028-02 and 2028-03 have a legal chain (SAT:
Julia and Flix receipts byte-identical, independent replay accepts; HTM 7338, then 7781, then
8057). Julia matchers find no whole-body front matching for the stored print from 2028-04 (a second
independent Julia matcher agrees); that is UNKNOWN, with no Flix confirmation. The generator
reports 2028-04 as UNKNOWN (search stalled).

Decision: the way forward is a new print with a whole recomputed chain; the stored months then
change, because a new print has a new identity root. `evidence/extended-window.tsv` lists the
recomputations per window end. Only the chosen end 2029-12 (44 months, HTM 15305) has a committed
witness, in `evidence/window-2029-12/` (print, front matches, solver log, chain, 44 states). The
other SAT rows are exploration rows without a committed witness; they are not reproducible from the
repository. Re-check the witness:

```sh
WINDOW_END=2029-12 CAL7_WINDOW_PRINT_SHA=$(sha256sum evidence/window-2029-12/printing.tsv | cut -d' ' -f1) \
PRINT_OVERRIDE=$PWD/evidence/window-2029-12/printing.tsv CHAIN_OVERRIDE=$PWD/evidence/window-2029-12/moves.tsv \
STATES_OVERRIDE=$PWD/evidence/window-2029-12/states bash run_checks.sh JULIA JAVA CHAIN_JAR SCRATCH_DIR
```

## Beam pilot: Nov 2026 to Dec 2026

The stored edge into December 2026 (greedy orbit solver) has 271 HTM and 276 QTM. `beam_edge.jl`
re-solves this one edge from the stored November 2026 state with the global macro beam (`../global-search/search.jl`
library, `../upright-beam/beam2.jl` core weight, orbit catalogs and exact last mile). The result,
`evidence/beam-pilot-2026-12/`, is the stored chain up to November 2026 byte for byte plus the new
December edge: 61 HTM, 71 QTM (`library=L5 width=40 lambda=3`, 4 threads, 38 s including the library
build; deterministic on rerun). `runs.tsv` lists the runs of every knob tried. Julia `check.jl`,
Flix and the independent `verify_chain.jl` accept it for `WINDOW_END=2026-12`; Julia and Flix receipts are
byte-identical. The new December state differs from the stored one off the front, so a later edge must
be re-solved from it (done for Jan to Jun 2027 in the next section). Candidate tooling, not a stored witness replacement;
independent review is pending.

```sh
julia --threads=4 beam_edge.jl OUT evidence/window-2029-12/printing.tsv evidence/window-2029-12/moves.tsv \
  evidence/window-2029-12/states 2026 12 mode=beam library=L5 width=40
```

`mode=greedy` reproduces the stored 271 HTM edge. `test_beam_edge.jl` bounds the pilot edge at 130 HTM and
checks the prefix, every front and the digests.


## Beam chain: Nov 2026 to Jun 2027

The pilot chain continued by six edges, each re-solved by `beam_edge.jl` from the state the previous beam edge
ended in (`evidence/beam-chain-2026-06/`: the stored chain up to Nov 2026 byte for byte, the pilot Dec 2026 edge,
then Jan to Jun 2027; 14 states). The states differ from the stored greedy chain off the front, so no stored
edge after Dec 2026 applies. Candidate tooling; independent review is pending.

| Edge into | HTM | QTM | rot | block moves (1) | seconds (2) | stored greedy HTM / QTM |
|---|---|---|---|---|---|---|
| Dec 2026 (pilot) | 61 | 71 | 1 | 53 | 38 | 271 / 276 |
| Jan 2027 | 96 | 125 | 1 | 84 | 108 | 440 / 452 |
| Feb 2027 | 115 | 138 | 2 | 94 | 37 | 384 / 390 |
| Mar 2027 | 34 | 49 | 0 | 26 | 25 | 60 / 62 |
| Apr 2027 | 99 | 118 | 2 | 82 | 35 | 347 / 354 |
| May 2027 | 121 | 148 | 1 | 101 | 37 | 342 / 348 |
| Jun 2027 | 124 | 149 | 1 | 105 | 53 | 498 / 510 |
| sum / mean | 650 / 92.9 | 798 / 114.0 | | 545 / 77.9 | | 2342 / 334.6 |

HTM min 34 (Mar), max 124 (Jun); without Mar the mean is 102.7 (61 to 124). The six new edges: mean 98.2 HTM,
121.2 QTM. The beam chain has 28 percent of the stored greedy HTM. (1) Block moves from the reviewer's
independent simulator (same-axis runs, adjacent equal-angle layers merged, no middle layer), a proxy for the app's
count: 0.76 to 0.88 of HTM, 0.84 overall. (2) In-process time of `beam_edge.jl`, 4 threads, including the library
build; all below the 5-minute limit.

Setting `library=L5 lambda=3`, `width=40`; Jan 2027 uses `width=80` (96 instead of 137 HTM at width 40). `runs.tsv`
lists every run, including two other chains tried on the way (A: width 40 everywhere, 137 154 24 121 110 87, sum 633;
B: Jan 96, width 80 for Feb and Mar, width 40 after, 96 124 33 163 127 108, sum 651; committed chain C: sum 589) and
lambda=2 for Jan (125). The beam is deterministic for fixed inputs, but an edge depends on the state it starts from,
so the per-edge HTM moves by up to about 60 between chains (Apr 99, 121, 163; Feb 115, 124, 154) and the settings are
not tuned per edge. Whether the order of magnitude of 95 to 130 HTM per edge holds in a chain: in the committed
chain 5 of 7 edges are inside it, Dec and Mar are below, none above; in the other two chains 3 of 11 edges (A, and B after Jan) were above
(137, 154, 163). One chain of seven edges is a small sample, and the Mar edge (34) is unexplained: the stored greedy edge is also small (60).

`beam_edge.jl` change for chaining: if the edge is not in `CHAIN`, `CHAIN` is a candidate chain, every edge of it is
replayed and the new edge is appended (stored HTM prints as -1). The pass-through of states
(`STATES` is the state directory of the previous run) is unchanged.

```sh
# edge Jan 2027 from the pilot chain; each later edge takes the previous OUT as CHAIN (OUT/candidate.moves.tsv) and STATES (OUT)
julia --threads=4 beam_edge.jl OUT evidence/window-2029-12/printing.tsv evidence/beam-pilot-2026-12/moves.tsv \
  evidence/beam-pilot-2026-12/states 2027 1 mode=beam library=L5 width=80 lambda=3
```

Checks of the chain with `WINDOW_END=2027-06`: Julia `check.jl` SAT, Flix receipt byte-identical, `verify_chain.jl`
ACCEPT_CHAIN, negative cases of `run_checks.sh --mutations` (see the PR text for the numbers), the independent
simulator state match for all 7 edges, and `test_beam_chain.jl` (bounds per edge, greedy chain must fail).

### What Calendar7 needs to adopt this chain

Nothing in the app or the public data changes in this branch. Facts about the current app (main):
- `public/calendar7/graph.v1.json` is the strict scheme A graph (2026-05 to 2099-12, 883 edges); `public/calendar7/names/graph.v1.json`
  is the names layout for the 21-month window May 2026 to Jan 2028 (20 edges, exported from the stored print and
  `evidence/moves.tsv` by `scripts/export-calendar7-names.mjs`, pinned by digests). Both store per edge `from`, `to`,
  `metrics [htm, qtm, rot, rotq]` and `moves` as one character per move (generator and exponent, alphabet in `graph.ts`).
  `month-view.ts` plays the edge word, shows the block-move count (`playedBlocks`/`blockCounts`, with or without the middle
  slice) as "N moves" and HTM/QTM/rotations under "Technical details". HTM is not shown as the move count.
- The beam chain uses another print (`evidence/window-2029-12/printing.tsv`, 44 months to Dec 2029, new identity root)
  and nodes hash different state texts, so it is not a drop-in for the names data (stored print, 21 months).
Missing: (1) a decision for which window and print the app ships (the names window is Jan 2028 and the print differs);
(2) a full-chain generator for all 44 months (another author builds it; only Dec 2026 to Jun 2027 exist here);
(3) the exporter generalized to the window-2029-12 print (the 21-month constant, the digest pins and
`research-inputs.sha256`) and new data files `state.v1.json`, `displays.v1.json`, `graph.v1.json` for it, or a new
data folder; the exporter header and the UI notice name the 21-month window; (4) a Flix and Julia confirmation
of the full chain and the exporter replay check (`verify:calendar7-names`); (5) the owner's choice on the displayed count:
block moves are about 0.84 of HTM, so the app would show about 80 moves for a 95 HTM edge; (6) reverse playback
(backward steps use the inverse edge) is unchanged. Because every later edge depends on the state before it, any change
of an earlier edge forces a re-solve of all later edges.

## Scope and limits

This is a window witness, not a print for every calendar shape. The separate
[corner-coupling certificate](../row1-corner-coupling/README.md) obstructs a
single permanent print for the full 91-display domain under this band profile.
That obstruction does not apply to this smaller witness. The new printing
uses its own data names; old prints, strict root words, pins and app assets
remain unchanged. No print-sheet generator, app export, workflow dispatch or
browser test is included. Independent review is still required.

See `experiment.json` for artifact hashes and `NOTICE.txt` for data attribution.
