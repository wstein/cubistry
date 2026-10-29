# First finite CI Quality Cube measurements

Evidence classification: **SAT** for all 625 fixed-print upright displays and
the universal six-HTM single-category policy, confirmed by the separate
[independent review](independent-review/REVIEW.md) of publication author commit
`e9e544c`, byte-identical to the original reviewed Quality Cube snapshot `13ad01a`.
A universal five-HTM bound is **UNSAT within the specified five-state pair
construction**, not for arbitrary other prints. Global print and unrestricted
mean optimization remain **UNKNOWN**. Original generated pending-review
snapshots are preserved; the review supplies the subsequent classification.

## Executed construction and witnesses

The fully labeled five-state candidate uses one pair of corner bodies per
category. In target-corner twist order, its first body carries open / open /
running and its second body carries OK / error / blocked. This is not a sheet
net order; see the permanent source normal/up vectors in the witness JSON.
All 24 physical stickers carry a category/state artwork. There are 20 distinct
artworks because open appears twice for each category.

Julia generated legal setup words for all 625 requested displays and a 1,250-step
sequence that continues through actual full physical poses, with no resetting of
hidden back corners. The canonical Cubistry mechanics replayed every word,
checked all eight complete body poses by SHA256, preserved all 24 physical sticker
IDs, checked exact upright category/state artwork, and restored each source via
the inverse word. Twelve corrupted-word/pose/print-up controls were rejected
across the four candidate families.

Only **one** whole-cube orientation of the fully labeled five-state print gives
a valid upright category front. It cannot select the other 624 requested
combinations. The neutral variants have no valid whole-cube-only display in the
factory pose; the fully labeled four-state candidate has one. These counts are
reported per print, not generalized between layouts.

## Measured upper-bound policy

For a single-category transition, preserve the actual identities of the three
unchanged front stickers. Choose the nearest valid physical sticker for the
changed state. Enumerate every currently shown copy of the source state and all
12 possible positions/orientations of the category's other body behind the front.
The four-corner distance table then gives exact shortest routes under this
preservation restriction. This covers arbitrary physically legal hidden poses,
including poses produced by repeated earlier requests.

The mean below gives equal weight to categories and directed logical edges. Within
an edge it averages equally over valid source copies and the 12 back-body poses.
It is a stated comparison distribution, not measured CI usage or a promise about
the long-run mean of one runtime's routing policy.

| State set / print restriction | Raw patterns | Symmetry representatives | Maximum HTM | Mean HTM under the policy |
| --- | ---: | ---: | ---: | ---: |
| Four states, eight neutral stickers | 360 | 20 | 6 | 4.314815 |
| Four states, 24 labeled stickers | 1,560 | 92 | 6 | 3.888889 |
| Five states, four neutral stickers | 720 | 40 | 6 | 4.166667 |
| Five states, 24 labeled stickers | 1,800 | 100 | 6 | 4.012821 |

The pattern enumeration is exhaustive only inside the stated two-bodies-per-
category construction, with independent cyclic reindexing of either body and
swapping the two bodies. It does not cover every conceivable print allocation.
The selected pattern minimizes maximum and then mean HTM for this particular
preserve-three-IDs policy. A route that also replaces unchanged fields with
equal-artwork copies may be shorter; global mean optimality is not claimed.

For arbitrary multi-category jumps, the complete four-corner table gives a
seven-HTM upper bound to a fixed four-sticker target from any actual pose. The
saved five-state fully labeled sequence reaches this bound (maximum seven,
mean 5.0304); its setup paths have maximum seven and mean 4.9952. Those are
different questions from a one-category event, so their statistics are not mixed.

## Distance certificate

The domain has 8P4 × 3⁴ = 136,080 ordered four-corner poses, without a rotation
quotient. The generated BFS histogram is:

```text
distance  0   1    2     3      4      5      6     7
count     1  15  198  2030  15396  61768  53528  3144
```

`distances.u8` is one unsigned byte per rank, with Julia's one-based rank 1 stored
at byte offset 0. Position ranking removes selected positions successively from
the ordered list 0…7 (radices 8,7,6,5); twist digits use radix 3. The combined
zero-based rank is positionRank × 81 + twistRank. Its goal rank is 66,259
one-based. SHA256 is
`f56224ee1b76e2bdaac4bb8441df5881e6b7c9a51dd6a14e62eff58e78e396d6`.

Independent certificate review must check the full domain, the unique zero goal,
every move inequality d(s) ≤ 1 + d(move(s)), and a descending edge from every
non-goal. These conditions prove exact graph distance, rather than trusting BFS.
The separately implemented canonical physical checker checks the geometry and
all saved words against the pinned existing mechanics.

The first Julia script took 7.84 seconds including model loading/JIT, generation,
checks, scoring and JSON output; graph build plus BFS took 0.238 seconds within
that process. These are one local run on a shared execution host, not a universal
performance estimate. Nothing is reported as zero startup or teardown cost.

## Independently reviewed lower-bound extension

`lower-bounds.jl` saved one reachable full source and six-move
target path for each of the 100 five-state fully labeled pattern representatives.
For its obstruction, the other three category artworks occur only once, and all
copies of the changed target state are on the currently front body. Every target
therefore requires a nonzero twist of that front body while restoring the other
three exact front bodies. The table's two nonzero front-twist distances are both
six. The independently checked finite argument rules out a universal five-HTM bound **inside this print family**,
including alternative equal-artwork target copies. It is not an impossibility
claim for arbitrary other print constructions. Canonical physical replay and
the separate review of all 100 source/target pairs passed. Those saved examples
repeat one pattern across the four categories; they are not a literal search
over all mixed pattern combinations. The review gives the separability argument
for mixed labels with the same fixed pairing and upright-frame construction.
It also independently verifies identical per-slot profiles, which supports
separable policy scoring. Final vector artwork and browser behavior are outside
this proof's scope.

## Reproduction

Julia 1.13.3 and the locked JSON 1.13.0 environment are used. An existing verified
depot can be reused, or instantiate the pinned Julia project normally. New code
does not depend on Python.

```sh
julia --startup-file=no --project=research/ci-quality-cube research/ci-quality-cube/evaluate.jl
julia --startup-file=no --project=research/ci-quality-cube research/ci-quality-cube/lower-bounds.jl
node research/ci-quality-cube/check-canonical.mjs /path/to/pinned-cubistry-checkout research/ci-quality-cube/evidence research/ci-quality-cube/evidence/canonical-replay.json
```

Build the existing core in the canonical checkout before the Node command. Its
physical source files must match main commit
`35db0e1929979f569e4758cd105f4df805a6c6d3`; the script checks them through Git and
records actual source hashes and checkout HEAD. The execution environment may
require subprocess permission for those Git checks. The first restricted attempt
failed with `spawnSync git EPERM`; the approved subprocess-capable rerun passed.

Application redesign, final vector sticker art, external CI integration,
arbitrary puzzle sizes, and global print-layout optimization are not implemented
by this research work.
