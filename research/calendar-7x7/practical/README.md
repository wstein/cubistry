# Practical English 7×7 month transitions (R1)

## Research question

Can the immutable 240-nonblank printing from PR #99 support useful, explicitly
executable chronological month transitions? The initial milestone is 200 HTM,
the primary engineering target is 100 HTM, and fewer than 50 HTM is an ambitious
target. None is an assumed guarantee. Global optimality is not required.

This additive experiment starts at PR #99 commit
`1bd783245abaa0d10946945be309e9fe8392d392`, on branch
`research/calendar-7x7-practical-months`. Its transitive dependency is PR #97
commit `e2afe2af9aa85a9ec05518c8c519b7fd1ee156a0`.
The upstream English [printing and physical profile](../english/README.md)
remain unchanged. Neither dependency is merged or promoted by this experiment.
Issue #102's Research / Verified Proofs / Runtime distinction applies: this is
research, with no runtime integration or canonical proof registration.

## Scope and metrics

The chronological domain is January 2026 through December 2099: 888 months and
887 adjacent transitions, including 73 December-to-January transitions. The
English Sunday-first calendar, marked overflow, artwork equivalences, physical
printing and actual sticker orientations are exactly those of PR #99.

Executable records identify the original legal generator from
[`moves.tsv`](../en-physical-review/moves.tsv) and a quarter-turn exponent of
`-1`, `1`, or `2`. Positive quarter turns use the right-handed coordinate action
defined by that model. This explicit axis/layer notation avoids ambiguous
inner-layer or wide-turn conventions.

- Each noncentral individual layer quarter turn, inverse or half turn costs
  **one HTM**. Half turns cost two QTM; other layer turns cost one QTM.
- Whole-cube rotations are legal and counted separately, costing zero HTM.
  Their quarter-turn equivalents are also reported separately.
- Wide turns are not primitive records. They must be expanded into individual
  layers, each charged separately. Consequently these figures are not the
  alternative metric that charges an arbitrary wide turn once.
- Central slices are not primitive generators. A representation using a
  whole-cube rotation and six compensating noncentral slices is charged for
  the six slices. No unreported free slice moves are allowed.
- Counts describe the emitted sequence after simplification, not a proven
  minimum. An unsimplified count must be labeled separately.

The sequence file is UTF-8, LF-terminated TSV, with no blank lines:

```text
cubistry.calendar7.practical.v1
source	2
destination	2026	3
move	1	1
move	8	-1
```

This format example is **not a solution**. `source` selects a legally certified
physical state from the original DAG. `destination` is independently generated
Gregorian artwork. All hidden sticker identities remain in the replay. The
initial source state's existence witness is compressed and not practical
initialization; a practical transition does not resolve that separate problem.

## Experiment plan and acceptance

The first candidate is February → March 2026. February has 28 days and starts
on Sunday, so the weekday headers and dates 1–28 stay in place. Six front
stickers change: FEB → MAR, and three blanks → 29/30/31. This is a useful
initial case, not evidence of general coverage or representative worst-case
length.

Candidate generation is untrusted. Native Julia and native Flix must read the
same raw sequence independently, establish the source from the unchanged DAG,
replay legal moves on rigid physical pieces, and validate the destination
front. Their counts and complete physical endpoint hashes must agree. Corrupt
inputs and legal-but-wrong destinations must be rejected. Any dissent leaves
the result UNKNOWN pending the repository's prescribed root-cause review.

Compare sparse reusable macros with generic constructive permutation methods;
test cancellation separately from physical replay. Multiple physical states
for the same front are permitted, but a full chronological chain must carry
the actual preceding physical state forward. Independently solved pairs cannot
be presented as such a chain.

R1 delivers concrete transitions and reproducible evidence. R2 investigates all
887 chronological edges, including leap-year and year boundaries. R3 optimizes
the worst edge and state selection across the sequence. Follow-up PRs should
depend only on the evidence or code they actually use.

**Current status: UNKNOWN.** No executable transition or move-target attainment
is claimed until both native replay receipts are saved. No browser E2E, merge,
deployment or release is part of this work.
