# English calendar: exact row-2 identity at month boundaries

## Question and scope

Can row 1 and rows 3–7 change while row 2 is restored to exactly the same
physical state at the end of each month transition?

The owner's clarified requirement is **endpoint-only, row 2 only**. Its seven
stickers may move during a transition. This is separate from keeping two rows,
entire horizontal rings, or any row motionless throughout every primitive move.
No impossibility claim about those different problems is made here.

This additive research branch depends on the unchanged English printing and
legal existence witness from PR #99, commit
`1bd783245abaa0d10946945be309e9fe8392d392`. It changes no printing, calendar
layout, physical model, old checker, proof input or application code.

Status: **research-local SAT for the checked endpoint-invariance claim**.
The independent native Julia and Flix runs accept all 91 existing states and
five continuous chains, and their 114-line row-invariant receipts are
byte-identical. All four certificate-corruption controls are rejected by both.
Independent agent review remains pending; no canonical proof registration or
production promotion is claimed.

## Why the existing printing is promising

The seven weekday artworks each appear on exactly one immutable physical
surface under the declared O/0 and I/1 artwork equivalences. Their only matching
orientation is upright. The native checkers must derive this from all 294 source
surfaces and all four in-plane orientations, rather than trusting this table.

| Column | Weekday | Source sticker | Cubie |
|---|---|---:|---:|
| 1 | SUN | 66 | 44 |
| 2 | MON, printed M0N | 200 | 154 |
| 3 | TUE | 237 | 179 |
| 4 | WED | 213 | 166 |
| 5 | THU | 202 | 156 |
| 6 | FRI, printed FR1 | 199 | 153 |
| 7 | SAT | 290 | 217 |

Uniqueness alone is not a feasibility proof. The checkers additionally replay
all 91 existing legal physical witnesses, covering 888 months in 2026–2099,
without expanding their compressed legal words. Each replay validates all
294 sticker identities and rigid poses, all 49 front artworks and their
orientations, and the seven exact row-2 IDs, cubie IDs, positions, normals and
up vectors. Every row-2 serialization must have the same SHA-256.

The same additive checks also read five complete continuous chains from the
native-verified R3 checkpoint at commit
`545e342b75d883e88159fd31d8acfcdee3b95f59`. Their raw source is
`research/calendar-7x7/minimax/verification/`: four primary chains and
`midge-recovery.moves.tsv`. Those inputs are passed explicitly; this branch does
not depend on R3 planner code or modify its evidence. Both new checkers replay
the raw legal moves, chronology, metrics and retained full-state hashes before
checking the row-2 endpoints.

## Limits

- This concerns the existing English calendar and its symbolic artwork profile.
  It does not certify a production font or a different printing.
- The seven weekday cubies are restored at every checked month endpoint. They
  are not promised to stay still during a move sequence.
- All-month physical existence uses the PR #99 witnesses. Their compressed
  words are not practical initialization or monthly playback instructions.
- The five practical chains cover selected months. No complete practical
  887-transition calendar run, uniform move bound or global optimum is claimed.
- Unique oriented weekday surfaces also force these same row-2 poses in any
  other legal full state that correctly displays this fixed calendar profile.
  This implication does not itself supply efficient moves to such a state.

## Reproduce

The certificate is [certificate.tsv](certificate.tsv). The additive Julia
checker is [check.jl](check.jl); the independent Flix entrypoint and build script
are [Main.flix](flix/src/Main.flix) and [build.sh](flix/build.sh). The Flix build
copies the unchanged native English geometry, calendar, printing and DAG
modules, preserving their independent implementation.

From the repository root, with Julia 1.13.3, Flix 0.79.0, wrapper 0.34.9
and Java 21:

```sh
# Fetch the pinned PR #115 dependency if its commit is not present locally.
git fetch origin 545e342b75d883e88159fd31d8acfcdee3b95f59
JULIA_BIN=julia research/calendar-7x7/row2-invariant/reproduce.sh /tmp/calendar7-row2
```

The [manifest](experiment.json) pins the print, original DAG, practical source
commit and raw input hashes, new checker sources, and saved receipts. The
[Julia](evidence/julia.tsv) and [Flix](evidence/flix.tsv) receipts agree on
seven unique oriented surfaces, all 91 complete-state hashes, five chain
sources, ten retained endpoints, and the same row serialization hash:
`2592f05dad652f99ad8f6bfed0cf77b86061747856edb6bf75bb63f7cbacb95a`.
The [full Flix log](evidence/flix-full.tsv) additionally contains unchanged
DAG-reader progress messages, which are excluded from receipt comparison.

The [negative-control matrix](evidence/negative-results.tsv) records rejection
of a wrong weekday ID, wrong up vector, duplicate column and wrong row position.
The shell drivers only prepare bytes, invoke native checkers and compare their
receipts. Python is not a proof authority. No browser E2E, merge, deployment or
release is part of this research.
