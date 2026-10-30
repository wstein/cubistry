# English 7×7 calendar: legal physical witness and minimum printing

## Result and scope

**Research-local SAT for the declared English profile.** One immutable physical
printing supports all 888 months in 2026–2099. Native Julia and independent native
Flix replay all 91 distinct target states and agree on every complete-state hash.
The printing uses **240 nonblank sticker surfaces and 54 blanks**, attaining the
independently calculated minimum nonblank count for this fixed profile.

The scope is:

- A 7×7 cube with Sunday-first English weeks and red Saturday/Sunday dates and
  weekday headers; other date, weekday and month ink classes remain distinct.
- Three separate, adjacent uppercase month letters: January–September at columns
  5–7, October–December at columns 1–3. No printed year.
- Seven whole three-letter weekday abbreviations in row 2, five date rows, and
  sixth-week dates wrapped into their empty first-week columns with `↶` marks.
- The declared symbolic glyph-equivalence profile, including circular O/0, bar
  I/1, specified half-turn symmetries and 6/9 reuse. This is not certification of
  a production font, SVG sticker sheet or arbitrary additional glyph aliases.
- Whole-cube rotations and any physical face as front are allowed. All 294 source
  sticker identities remain fixed on their 218 visible rigid cubies.

The canonical repository counter/state3 checker formats have not been changed.
No canonical `CONFIRMED` registration or production release is claimed here.
The separate German impossibility certificate is preserved unchanged.

## Printing optimization

| Component | Minimum nonblank surfaces | Achieved |
|---|---:|---:|
| Corners | 20 | 20 |
| Midges | 18 | 18 |
| Inner-distance wings, both sticker sides | 43 | 43 |
| Outer-distance wings, both sticker sides | 34 | 34 |
| Movable centers | 119 | 119 |
| Six core centers | 6 | 6 |
| **Total** | **240** | **240** |

The lower bound sums each oriented-artwork class's maximum simultaneous demand
within its physical sticker orbit, excluding blank artwork. Every immutable
printing must meet this bound. Because the 240-surface candidate also has fully
legal witnesses, the bound is attained in the physical problem, not merely in a
relaxed inventory calculation.

The initial coupled-front candidate had 250 nonblank surfaces. This construction
saves ten, or 4%. It does not optimize move count, visual typography, or every
possible calendar layout. The 54 blanks are a physical inventory, **not 54
unconditionally free positions for additional artwork**.

The canonical component print is
[`minimum-print.tsv`](../en-print-optimization/minimum-print.tsv). Its physical
embedding, [`physical-print.tsv`](evidence/physical-print.tsv), gives every source
sticker's immutable ID, cubie ID, home position, normal, up vector, text and ink.

## Legal reachability and exact replay

The word alphabet contains 18 noncentral layer quarter turns and three whole-cube
quarter rotations. The generated witness is a signed product DAG whose leaves
are only those original legal generators. Inversion and composition therefore
describe a finite legal move word by induction; no group-order, solver log,
parity-only condition or front matching is trusted as proof.

Each native checker derives the 264-point complete-pose action independently,
evaluates the word DAG, lifts it to all 218 rigid cubies and 294 source stickers,
and checks the front against its own Gregorian calendar goals. All source
identities, normals and up vectors are retained. In particular, the actual core
center up vector is checked; inventory rotation equivalence does not erase it.
The exact physical chain A→B→C→A returns to A, including hidden sticker poses.

The compressed archive is
[`all-targets-dag.tsv.gz`](../en-physical-review/all-targets-dag.tsv.gz).
Its raw SHA-256 is
`ef2071eceb3f7e1934c4b67684613044e38d0446f16e86f4d0ba112ddc9f9f24`.
It contains 230,384 pooled nodes and 91 target roots. The two checkers agree on
all 91 complete-state SHA-256 values.

**Existence only, not practical playback:** the unreduced expressions contain
approximately **1.44–1.88 × 10¹¹¹ generator leaves**. Compression makes their
effects exactly checkable; it does not make these words usable as human move
instructions or animation sequences. No HTM optimality is claimed. A practical
construction is separate work.

## Validation and independent review

- Julia and Flix accept all 91 legal target replays, covering 888 months.
- Both reject the same 26 corrupt inputs and accept a valid alternative blank
  sticker axis. A legal identity-only word is accepted as legal but rejected as
  a calendar solution, distinguishing membership from target correctness.
- Native generator checks compare the pose action with direct 294-sticker
  transformations, inverses, four-quarter identities and noncommuting products.
- Independent review is in [review/REVIEW.md](review/REVIEW.md).
- A discovered Int32 input-validation overflow, its original dissent, correction
  and cross-checker closure are preserved in
  [rc-overflow/REPORT.md](rc-overflow/REPORT.md). The accepted printing and word
  bytes did not change during this correction.

## Reproduce without trusting the generator

From the repository root, using Julia 1.13.3, Flix 0.79.0 and Java 21:

```sh
gzip -dc research/calendar-7x7/en-physical-review/all-targets-dag.tsv.gz > /tmp/calendar7-english-legal-dag.tsv
julia --startup-file=no research/calendar-7x7/english/replay_legal.jl /tmp/calendar7-english-legal-dag.tsv
python3 research/calendar-7x7/english/flix/run_checks.py --dag /tmp/calendar7-english-legal-dag.tsv
julia --startup-file=no research/calendar-7x7/english/negative_controls.jl
```

Python only invokes native Flix, copies/mutates raw fixture bytes and records
exits/digests. It performs no proof arithmetic or acceptance decisions. Set
`FLIX_CACHE_HOME` and `COURSIER_CACHE` to writable cache locations outside the
managed workspace when needed. The pinned wrapper preserves its upstream MIT
license; research source follows the repository license.

The Julia negative suite consumes the same fixtures generated by the Flix driver.
It does not use Flix's decisions. Partial or alternative-print checks write
input-specific receipts and cannot replace the full canonical state-hash receipt.

To regenerate candidate words, see
[GROUP-WITNESS.md](../en-physical-review/GROUP-WITNESS.md). GAP is candidate tooling
only and is not needed to validate the stored witness. Saved GAP workspaces,
compiler binaries and caches are not committed.
