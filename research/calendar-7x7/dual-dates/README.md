# English calendar: combined date labels 1/8 and 24/31

**Status: research candidate, not certified.** Native Julia and independent
Flix accept the committed inputs with byte-identical receipts, and both reject
the corruption controls. Independent review findings are being addressed; a
pinned manifest is still missing. Important scope note: the candidate does
**not** keep the 91 legal full states of PR #99 and #119. It repairs 26 of
them (see "Effect on the 91 legal states").

## Question

The two day pairs 1/8 and 24/31 lie seven days apart, in the same weekday
column. Can one physical surface carry both labels, so two printed day surfaces
are freed, while the existing seven weekday stickers in row 2 keep exactly the
same identities, positions and poses, and every one of the 91 front displays
(888 months) is still reachable by a legal full state? The full states of 26
of the 91 targets change (see "Effect on the 91 legal states").

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

## Effect on the 91 legal states

The candidate DAG ([evidence/candidate-dag.tsv.gz](evidence/candidate-dag.tsv.gz)) is
the original PR #99 DAG plus 496 appended legal primitive products
([evidence/repairs.tsv](evidence/repairs.tsv)). Comparing the `result` lines of the
two DAGs, **26 of the 91 targets** (targets 4, 5, 7, 13, 21, 22, 24, 27, 33, 35, 36, 42, 44, 50, 51, 53, 59, 61, 68, 70, 76, 78, 79, 86, 87, 88) get a different
result root; the other 65 keep theirs. The repairs are commutator words confined
to orbits 1 and 10 (they are needed so that the dual-label stickers show the
right label at the right turn; an unrepaired target fails the front check).
Consequences:

- The full physical states, and every state digest, of PR #99 and PR #119 do not
  carry over for those 26 targets. The row-2 serialization hash is still identical
  for all 91 states of the candidate.
- No chain verified against the PR #99 print carries over to the new print: the
  print itself changes in four surfaces, so every saved chain (for example those in
  PR #130, which are rooted on targets 1 and 11, neither of which is repaired) was
  verified against the old print and is not covered by this candidate. Chains that
  pass through one of the 26 repaired targets would in addition have different
  states. They would need to be re-derived and re-verified for the new print.
- The print changes only in the four surfaces named above; the physical model, the
  generators and the front displays are otherwise unchanged.

## Capacity

Physical capacity stays 294 sticker surfaces. Printed surfaces go from 240 to
238, blank surfaces from 54 to 56. Only two families change: corners 20 to 19
printed of 24, and centers at absolute position coordinates (3,1,0) 22 to 21 of
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
  receipt and the negative controls. `compact-screen.tsv` is the output of the
  exploratory capacity screen `compact_screen.jl` for an earlier, different
  profile ("six-week-only-fold"); no claim in this README depends on it.

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
- [negative_checks.sh](negative_checks.sh) corrupts one item at a time and records
  both verifiers' reasons ([results](evidence/negative-controls/results.tsv),
  diagnostics beside it). Julia and Flix both exit 1 on all seven. Four are caught
  by exact-match checks before any display is evaluated (the quarter-turn table,
  the label of surface 255, restoring surface 16, flipping the up vector of
  surface 40: they fail the "table, labels and frames are exactly the declared
  ones" checks). Three reach the front check: swapping the DAG roots of targets
  1 and 2, a repaired target pointed back at its original, unrepaired root, and
  the sign of the first appended repair product flipped. These are
  invalid-candidate results, not UNSAT proofs. The corrupted DAGs (about 6 MB each) are not stored; the script
  regenerates them.
- Both verifiers now pin the SHA-256 of the unchanged PR #99 printing (the Flix
  checker did from the start; the Julia checker was missing this rule).
- The literal 888 in the summary line is a fixed value in both checkers, not
  computed from the targets.

## Not done yet

1. Independent review: findings from the first review round are addressed here;
   the reviewer rechecks. If any verdict disagrees, stop and investigate.
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
