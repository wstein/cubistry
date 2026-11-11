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

## Explicit month list instead of a window end

`CAL7_WINDOW_MONTHS=<file>` with `CAL7_WINDOW_MONTHS_SHA256=<hex>` (Flix: `months MONTHS_FILE MONTHS_SHA256 PRINT_SHA256`) replaces `WINDOW_END`
in `check.jl`, `verify_chain.jl`, the Flix chain jar and `run_checks.sh`. The list is strictly increasing; its first month is the chain
root (identity pose; a parameter: the print must show it solved); edge i must carry the month of member i+1; an edge across skipped calendar months is a bridge edge
(`BRIDGE` on the receipt line). Format, root rule, coverage and receipts: [evidence/month-list/README.md](evidence/month-list/README.md).
Tests: `test_month_list.jl`, `run_month_list_checks.sh` (two positives, a bridge chain and a chain starting at 2037-05, and 14 negatives; Julia, Flix and the independent verifier),
`test_month_coverage.jl`. `generate.jl` and `beam_edge.jl` take their targets from the same goals and were not changed or run for a list.

## Beam pilot: Nov 2026 to Dec 2026

The stored edge into December 2026 (greedy orbit solver) has 271 HTM and 276 QTM. `beam_edge.jl`
re-solves this one edge from the stored November 2026 state with the global macro beam (`../global-search/search.jl`
library, `../upright-beam/beam2.jl` core weight, orbit catalogs and exact last mile). The result,
`evidence/beam-pilot-2026-12/`, is the stored chain up to November 2026 byte for byte plus the new
December edge: 61 HTM, 71 QTM (`library=L5 width=40 lambda=3`, 4 threads, 38 s including the library
build; deterministic on rerun). `runs.tsv` lists the runs of every knob tried. Julia `check.jl`,
Flix and the independent `verify_chain.jl` accept it for `WINDOW_END=2026-12`; Julia and Flix receipts are
byte-identical. The new December state differs from the stored one off the front, so a later edge must
be re-solved from it; no other edge was run. Candidate tooling, not a stored witness replacement;
independent review is pending.

```sh
julia --threads=4 beam_edge.jl OUT evidence/window-2029-12/printing.tsv evidence/window-2029-12/moves.tsv \
  evidence/window-2029-12/states 2026 12 mode=beam library=L5 width=40
```

`mode=greedy` reproduces the stored 271 HTM edge. `test_beam_edge.jl` bounds the pilot edge at 130 HTM and
checks the prefix, every front and the digests.

## Scope and limits

This is a window witness, not a print for every calendar shape. The separate
[corner-coupling certificate](../row1-corner-coupling/README.md) obstructs a
single permanent print for the full 91-display domain under this band profile.
That obstruction does not apply to this smaller witness. The new printing
uses its own data names; old prints, strict root words, pins and app assets
remain unchanged. No print-sheet generator, app export, workflow dispatch or
browser test is included. Independent review is still required.

See `experiment.json` for artifact hashes and `NOTICE.txt` for data attribution.
