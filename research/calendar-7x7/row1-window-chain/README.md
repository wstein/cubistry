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

## Scope and limits

This is a window witness, not a print for every calendar shape. The separate
[corner-coupling certificate](../row1-corner-coupling/README.md) obstructs a
single permanent print for the full 91-display domain under this band profile.
That obstruction does not apply to this smaller witness. The new printing
uses its own data names; old prints, strict root words, pins and app assets
remain unchanged. No print-sheet generator, app export, workflow dispatch or
browser test is included. Independent review is still required.

See `experiment.json` for artifact hashes and `NOTICE.txt` for data attribution.
