# English calendar: combined date labels 1/8 and 24/31

**Status: research candidate, not certified.** Native Julia and independent
Flix accept the committed inputs with byte-identical receipts, and both reject
five corruption controls. Independent review and a pinned manifest are still
missing.

## Question

The two day pairs 1/8 and 24/31 lie seven days apart, in the same weekday
column. Can one physical surface carry both labels, so two printed day surfaces
are freed, without changing the existing seven weekday stickers in row 2 and
without changing the 91 legal full states that represent 888 months?

## Candidate semantics

This is an **orientation-selection** profile: one surface carries two labels
rotated against each other by a quarter turn, and only the label that is upright
in the viewing orientation counts. It is not a layout in which both labels of a
pair are visible and the calendar context selects one. The exact declared
artwork is [evidence/dual-art.tsv](evidence/dual-art.tsv):

| Source surface | Label at turn 0 | Label at quarter turn 1 | Printed as |
|---:|---|---|---|
| 255 | 8 | 1 | `DUAL_1_8`, dark |
| 281 | 31 | 24 | `DUAL_24_31`, red |

Source surfaces 16 (red 24) and 40 (dark 1) become blank. All other surfaces,
their cubies, positions, normals and source frames are unchanged from the PR #99
printing.

## Capacity

Physical capacity stays 294 sticker surfaces. Printed surfaces go from 240 to
238, blank surfaces from 54 to 56. Only two families change: corners 20 to 19
printed of 24, and centres at absolute position coordinates (3,1,0) 22 to 21 of
24. The first front row has the piece types corner, outer wing, inner wing,
middle edge, inner wing, outer wing, corner, so only the freed corner surface can
touch the first row. The month letters keep their placement (January to
September at columns 5 to 7, October to December at columns 1 to 3). That every
month can be placed on either side is **not** established, and no move savings
are claimed.

## Evidence in this folder

- [oriented_common.jl](oriented_common.jl), [check_oriented.jl](check_oriented.jl):
  native Julia profile reader and checker. [generate_oriented.jl](generate_oriented.jl)
  is an untrusted candidate generator. [probe.jl](probe.jl) and
  [compact_screen.jl](compact_screen.jl) are exploratory.
- [flix/](flix/): independent Flix checker, sharing only the unchanged native
  English geometry, printing and DAG modules.
- [evidence/](evidence/): candidate printing, artwork table, appended-repair list,
  gzip-compressed candidate DAG, the saved and fresh Julia receipts, the Flix
  receipt and the negative controls.

Observed so far:

- Julia, saved receipt from an earlier session, ends in
  `dual-summary SAT_SCOPED_ORIENTATION_SELECTION 238 56 91 888` with row-2
  serialization hash
  `2592f05dad652f99ad8f6bfed0cf77b86061747856edb6bf75bb63f7cbacb95a`, the same
  hash as the existing row-2 certificate.
- Flix (0.79.0, Java 21), run on the same saved inputs, produces 99 receipt lines
  that are byte-identical to the saved Julia receipt (SHA-256
  `9f3d71d52a8309b768a408a350ad9630083ff73cebf49889fb18f4daeaff31a6`). The first
  Flix build had parse errors, fixed in this branch.
- Julia 1.13.3, re-run on the committed inputs after the Flix fix, produces the
  same 99 lines ([evidence/julia-receipt.fresh.tsv](evidence/julia-receipt.fresh.tsv)),
  byte-identical to the Flix receipt and to the saved Julia receipt.
- [negative_checks.sh](negative_checks.sh) corrupts one item at a time: the
  quarter-turn table, the label of surface 255, restoring surface 16, flipping
  the up vector of surface 40, and swapping the DAG roots of targets 1 and 2.
  Julia and Flix both exit 1 on all five, for the intended reason
  ([results](evidence/negative-controls/results.tsv), diagnostics beside it).
  These are invalid-candidate results, not UNSAT proofs. The corrupted DAG
  (about 6 MB) is not stored; the script regenerates it.

## Not done yet

1. Independent review. If any verdict disagrees, stop and investigate.
2. Pinned manifest with input, source and artifact hashes.
3. A single reproduction script that runs both checkers and the controls.

## Reproduce

From the repository root, with the compressed DAG expanded to a scratch file
(`gzip -dc research/calendar-7x7/dual-dates/evidence/candidate-dag.tsv.gz > "$work/candidate-dag.tsv"`):

```sh
julia --startup-file=no research/calendar-7x7/dual-dates/check_oriented.jl \
  research/calendar-7x7/dual-dates/evidence/physical-print.tsv \
  research/calendar-7x7/dual-dates/evidence/dual-art.tsv "$work/candidate-dag.tsv"
research/calendar-7x7/dual-dates/flix/build.sh
java -Xmx8g -jar /tmp/cubistry-calendar7-dual-flix/artifact/flix.jar \
  research/calendar-7x7/dual-dates/evidence/physical-print.tsv \
  research/calendar-7x7/dual-dates/evidence/dual-art.tsv "$work/candidate-dag.tsv" \
  research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review
```

Keep only the lines starting with `dual-` from the Flix output; the rest is DAG
reader progress.

This branch is based on PR #119 for the row-2 certificate and the unchanged
English evidence. It changes no existing printing, proof input or application
code. No browser E2E, merge, deployment or release is part of this research.
