# English calendar: stacked dual labels, case 1 (1/8 + 24/31) vs case 2 (23/30 + 24/31 + 24/31)

**Status: research candidate, not certified.** Two results are covered by both
native checkers (Julia and the Flix port) with byte-identical receipts:

- **Case 2** (layout B: `24/31` red, `24/31` black, `23/30` red) is accepted as
  one candidate under the context reading. It keeps all 91 PR #99 legal states,
  needs no repairs and frees 3 printed surfaces.
- **Case 1** (layout A: `1/8` red, `24/31` red) is **obstructed for every print**
  of the 294-surface model, under both readings.

All 13 corruption controls are rejected by both checkers. A first independent
review (at commit 35277d6, before the case comparison) found no correctness bug.
There is no pinned manifest yet. Anything not covered by both checkers is marked
UNKNOWN.

This folder replaces the meaning of PR #128 (`../dual-dates/`) without changing
it. PR #128 is an orientation-selection profile: one surface carries two labels a
quarter turn apart and only the upright one counts. The owner meant something
else: **one sticker carries two dates stacked, like a printed calendar cell
(`23` over a thin rule over `30`), both visible at the same time, and the month
decides which one applies.** Each stacked sticker has **one color**: both numbers
are in the same ink. `../dual-dates/` stays as it is.

## The owner's two cases and how they map to the checked layouts

| Owner's case | Stickers | Layout here | Checked fold cells |
|---|---|---|---|
| Case 1: two stickers, both red | `1/8` red, `24/31` red | **A** (top fold for Saturday-start months, bottom fold for Friday-start 31-day months) | row 3 Saturday `1/8` red; row 7 Sunday `24/31` red |
| Case 2: three stickers | `24/31` red, `24/31` black, `23/30` red | **B** (bottom fold) | row 7 Sunday `23/30` red; row 7 Monday `24/31` black; row 7 Sunday `24/31` red |

The mapping was checked against the calendar, not assumed. Both checkers list
every folded cell (`stacked-fold` lines in the receipts), and the inks follow
from the column rule (Sunday and Saturday red, other days black):

- In case 1, `1/8` always lands in the Saturday column and `24/31` always in the
  Sunday column. Both are red, so exactly two red stickers are needed.
- In case 2, `23/30` always lands on a Sunday, which makes it red. `24/31` lands
  on a Sunday in Friday-start months (red) and on a Monday in Saturday-start
  31-day months (black). So three stickers in two inks are needed.

Every stacked sticker is single-color. No artwork with two colors on one sticker
is used anywhere.

## Semantics checked here

The printing, cubies, 21 legal generators and the 91 PR #99 legal states are
reused unchanged. Front rows 1 and 2 (month letters, weekday names) are unchanged.

- **Stacked sticker.** A surface printed `a/b` (with b = a + 7, same weekday
  column) shows both dates in one ink. It has no rotational symmetry and is read
  only when upright. Plain dates keep the PR #99 glyph rules (bar 1, round 0,
  6/9, half-turn symmetries).
- **Folded month.** A month that needs six week rows is shown in the five date
  rows (rows 3 to 7) with stacked cells, instead of the PR #99 overflow (`30↶`,
  `31↶` wrapped into row 3). Every other month keeps its PR #99 front.
- **Strict reading:** a stacked sticker is correct only on its own folded cell,
  with the same label and ink.
- **Context reading:** in addition, an upright stacked `a/b` in the cell's ink
  may stand where a month needs only `a` or only `b`. This is the owner's "the
  month decides which one applies".
- **Layout W** keeps the PR #99 wrap layout and treats the PR #128 pairs as
  stacked context stickers. It is a comparison only.

## Comparison: case 1 vs case 2

| | Case 1 (A: `1/8` red, `24/31` red) | Case 2 (B: `23/30` red, `24/31` red, `24/31` black) |
|---|---|---|
| Changed displays (both checkers) | 18 of 91 displays, 190 of 888 months. Top fold with `1/8` in 11 Saturday-start displays (117 months); `24/31` in 7 Friday-start 31-day displays (73 months) | The same 18 displays and 190 months. `23/30` in 11 displays (117 months), plus `24/31` black in 7 of them (75 months); `24/31` red in 7 displays (73 months) |
| How much of the display changes | All date rows of the 11 Saturday-start displays move up one row | Only row 3 columns 1 and 2 (now blank) and row 7 columns 1 and 2 |
| Stacked sticker kinds and inks | 2 stickers, 2 labels, 1 ink (red) | 3 stickers, 2 labels, 2 inks |
| Surface types carrying them | inner wing (`1/8`, row 3 column 7); corner (`24/31`, row 7 column 1) | corner (`23/30` and `24/31` red, surfaces 15 and 16); outer wing (`24/31` black, surface 61) |
| Legal states, existing PR #99 states | 78 / 91 (context), 72 / 91 (strict) | **91 / 91, ACCEPT** (context, candidate print); 79 / 91 (strict) |
| Legal states, any print | **None exist under either reading**: inventory obstructed in 4 orbits (context) or 6 orbits (strict) | Context: candidate exists (above). Strict: **none exist**, the corner orbit is obstructed |
| Printed surfaces | No valid print exists | **237** printed, 57 blank (3 freed); context lower bound 234, gap 234 to 237 UNKNOWN |
| Months where a stacked sticker stands for one date (context) | not applicable | 104 of 888 months, in 12 displays (receipt column 11) |
| Transition move counts | not applicable (no states) | Unchanged: same DAG and the same 91 states. Chains not re-run with the new print |
| Checker results | inventory OBSTRUCTED (both); candidate rejected (both) | ACCEPT (both); inventory NOT_OBSTRUCTED for context |

**Recommendation: case 2 (layout B, bottom fold, three single-color stickers),
read in context.**

- It is the only case with a checked full solution: every display has a legal
  physical state (the existing PR #99 states), and it saves 3 printed surfaces.
- Case 1 is impossible in this model whatever the print, as shown below. It
  would need a different model or artwork profile.
- Owner decision: case 2 works only under the context reading. Under strict it
  is impossible as well.

## Why case 1 is impossible (both checkers, `inventory` command)

`check_stacked.jl inventory VARIANT MODE` and the Flix `inventory` command
compute, for every surface orbit, a necessary condition on any print. In one
display, the cells of an orbit that need artwork of one group must be shown by
different surfaces printed in that group, and blank cells need different blank
surfaces. The sum must fit the orbit's capacity (24, or 6 for the core).

- Strict: a group is one artwork class (the PR #99 bound).
- Context: the plain dates a and b and the stacked a/b of one pair, in one ink,
  form one group, because a stacked surface may serve any of them. This only
  weakens the bound.

| Layout, reading | Lower bound, printed | Orbits over capacity | Verdict |
|---|---:|---|---|
| W, strict (PR #99 layout) | 240 | none | NOT_OBSTRUCTED (reproduces the PR #99 bound 240) |
| W, context | 237 | none | NOT_OBSTRUCTED |
| A, strict | 267 | 6: corner (-3,-3), inner wing (-3,-1), centers (-2,-1), (-1,-1), (-1,0), core | **OBSTRUCTED** |
| A, context | 260 | 4: centers (-2,-1), (-1,-1), (-1,0) and the core | **OBSTRUCTED** |
| B, strict | 240 | 1: corner (22 printed + 3 blank > 24) | **OBSTRUCTED** |
| B, context | 234 | none | NOT_OBSTRUCTED |

The core obstruction of case 1 can be checked by hand:

- Under layout A, the front center cell (row 4, column 4) must show `5, 6, 7, 8,
  9, 10, 11` and also `12` (`stacked-core-cell`).
- The `12` comes from the Wednesday of week 3 in top-folded Saturday-start months.
- With 6 and 9 sharing one sticker, that is 7 artwork classes.
- The cube has only **6 core center stickers**.

Neither pair (1/8, 24/31) helps at that cell. So no legal state can exist for
case 1 with any print, and synthesis (commutator words) is unnecessary.

The obstruction is scoped to this model: 294 surfaces, the five-date-row
layout, the declared glyph profile and inks, and stacked labels only for the
declared pairs.

- It uses the PR #99 optics rule that a blank cell needs a blank sticker. Some
  obstructions depend on that rule:
  - case 2 strict, corner orbit: 22 printed + 3 blank > 24. So "case 2 is
    impossible under strict" depends on it;
  - case 1 context, orbits (-2,-1) and (-1,0): 24 printed + 1 blank each.
- The case 1 verdict does **not** depend on it: the core argument above uses no
  blanks (7 groups for 6 core stickers).
- It is not a statement about other artwork, such as orientation selection on
  the core.

One escape from the core argument remains, as an **open design alternative,
not a result**: a third, undeclared core pair sticker such as `5/12` (a legal
same-column pair). Under the context reading it would cut the core demand from
7 groups to 6. The other three case 1 context obstructions would then be open
again, not proven either way, because a new pair also changes their groups.

## Results of the legal-state checks (both checkers, identical receipts)

[evidence/receipts/cases.tsv](evidence/receipts/cases.tsv), from
[run_checks.sh](run_checks.sh). "Pass" counts the 91 PR #99 legal states (DAG
`all-targets-dag.tsv.gz`, SHA-256 `64d1eb37…e932`, unchanged) whose front shows
the new display. Each target line records the first failing cell, the surface
there, its angle and the cause.

| Case | Print | Pass / 91 | Printed | Verdict |
|---|---|---:|---:|---|
| B, context | candidate `print-B.tsv` | 91 | 237 | **ACCEPT** |
| B, strict | candidate `print-B.tsv` | 79 | 237 | reject |
| A, context | `print-A.tsv` (untrusted generator) | 78 | 237 | reject |
| A, strict | `print-A.tsv` | 72 | 237 | reject |
| B, context | PR #99 print unchanged | 73 | 240 | reject (the 18 folded displays fail) |
| A, context | PR #99 print unchanged | 73 | 240 | reject |
| W, context | PR #99 print unchanged | 91 | 240 | accept (positive control, reproduces all 91 PR #99 state digests) |
| W, context | PR #128 pairs as stacked, PR #99 DAG | 52 | 238 | reject |
| W, context | PR #128 pairs as stacked, PR #128 repaired DAG | 52 | 238 | reject |

Why the two W rows fail (checker output; 13 targets each):

- **PR #99 DAG:**
  - cell 3,4 shows surface 40, now blank;
  - cell 7,1 shows surface 16, now blank;
  - cell 4,5 shows surface 255 (`1/8`) at angle 2, not upright. The old bar `8`
    allowed the half turn; a stacked label does not.
- **PR #128 repaired DAG:**
  - cell 3,4 shows surface 255 at angle 3;
  - cell 4,5 shows surface 255 at angle 2;
  - cell 7,1 shows surface 281 (`24/31`) at angle 3.
  - All three fail because the label is not upright.

### Accepted candidate (case 2, context reading)

[evidence/print-B.tsv](evidence/print-B.tsv) differs from the PR #99 print in six
surfaces:

- The three overflow stickers become blank: 193 (`31↶` black), 224 (`30↶` red)
  and 243 (`31↶` red).
- Three surfaces are reprinted as stacked labels of their own date and ink:
  - 15: `23` becomes `23/30`, red, on the corner cubie at (-3,-3,3).
  - 16: `24` becomes `24/31`, red, on the same corner cubie.
  - 61: `24` becomes `24/31`, black, on the outer wing at (-3,2,3).

The DAG is unchanged, and there are no repairs. Printed surfaces go from 240 to
**237**, blanks from 54 to 57. The untrusted generator
[generate_stacked.jl](generate_stacked.jl) derived the print. The checkers
decide.

- **Depends on the context reading.** In strict mode 12 states fail: targets 28,
  33, 42, 45, 50, 54, 59, 62, 71, 76, 87, 90. Example: `24/31` black stands on an
  ordinary Monday the 24th in April 2028.
- **Transitions.** The 91 states are the same piece poses as PR #99, because
  the DAG file is the same. Any move word between two PR #99 states is therefore
  still a legal transition between the same case-2 states, with the same move
  count. No move savings are claimed. Saved chains (for example PR #130) have
  not been re-run against the new print. A formal chain receipt for case 2 is
  UNKNOWN.

### Why the existing states cannot free more than 3

This is an argument from checker output, not a computed count. Both checkers
report `stacked-printed-never-on-front 0` for the PR #99 print: each of the 240
printed surfaces is on the front, showing its own non-blank label, in at least
one of the 91 states.

- While those states are kept, blanking a surface breaks the state that shows it
  unless that cell's display changes.
- Under layout B, the cells that change to blank are row 3, columns 1 and 2.
  Only the three overflow stickers are shown there.

The context inventory bound (234) leaves room for at most 3 more frees with new
states. That is UNKNOWN: it needs new DAG synthesis.

## Space on the physical stickers

Repository sources: [evidence/space-table.tsv](evidence/space-table.tsv)
(descriptive Julia listing, [space_table.jl](space_table.jl), not a checker
input), the 294-surface model of `../english/evidence/physical-print.tsv`, and
`../english/README.md`.

- **Real sticker dimensions are not in the repository.** No millimeter values
  appear in `research/calendar-7x7/`, `docs/SUPER_PICTURE_CUBE.md`,
  `docs/PICTURE_PLAYGROUND.md` or `knowledge/plans/picture-cube-concept.md`.
  Real sizes, and whether outer-layer stickers are smaller, are UNKNOWN.
- The model puts every surface on a unit lattice cell, so all piece types have
  the same size (1:1:1:1). That is a modeling assumption, not a measurement. A
  stacked label has two text lines in one cell, so each date line gets at most
  about half the height of a plain date, minus the rule.
- The outer ring (rows 1 and 7, columns 1 and 7) is corners and edges: corner,
  outer wing, inner wing, midge, inner wing, outer wing, corner. The inner 5×5
  are centers, including the core center at row 4, column 4.
- Same-column cells seven days apart are vertical neighbors (row r over row r+1,
  r = 3..6, all 28 pairs in the table). The two cells of a pair are never in the
  same surface orbit, so no sticker can serve both cells in one month. A fold
  puts both dates on one cell instead:
  - case 2: row 7, column 1 (corner) or column 2 (outer wing);
  - case 1: row 3, column 7 (inner wing) for `1/8`, and row 7, column 1 (corner)
    for `24/31`.
- Legibility of two stacked numbers on corner and wing stickers is UNKNOWN: it
  needs real sizes and a font.

## Checkers

- [stacked_common.jl](stacked_common.jl), [check_stacked.jl](check_stacked.jl):
  native Julia. They include the unchanged `../english/replay_legal.jl`
  (geometry, print reader, legal DAG replay, PR #99 optics) and add the fold
  layouts, the print-change rules, the stacked match rule and the inventory
  obstruction.
- [flix/](flix/): Flix 0.79.0 port, built by [flix/build.sh](flix/build.sh) from
  the unchanged English Flix `Core`, `Data` and `Dag` modules plus a new
  `Main.flix`.
- Both pin the SHA-256 of the PR #99 print. Allowed print changes: an overflow or
  paired-date surface may become blank, and a plain date may become a declared
  stacked pair containing it, in the same ink. Identities and frames are fixed.

**Common-mode risks.** The Flix checker is a *structural port*: its fold layout,
print rule, match rule and inventory grouping follow the Julia code closely, so
a wrong definition of the semantics would be shared. The geometry, calendar,
optics (including the inventory artwork classes), print reader and DAG replay
come from separately written English Julia and Flix modules (the PR #99 pair).

[negative_checks.sh](negative_checks.sh) runs 13 controls. Results are in
[evidence/negative-controls/results.tsv](evidence/negative-controls/results.tsv);
Julia and Flix both exit 1 on all of them, for matching reasons and the same
first failing cell:

- **Print-rule rejections:** wrong ink on 15, undeclared pair `23/31`, reversed
  `31/24`, a blanked month letter, a flipped up vector on 16, the candidate
  checked as layout A.
- **Front-check rejections:**
  - an overflow sticker restored;
  - DAG roots of targets 1 and 2 swapped;
  - the root of folded target 5 inverted;
  - `rotated-stacked`: a legal corner-only commutator (the catalogue of
    `../dual-dates/generate_oriented.jl`) moves the red `24/31` sticker 16 onto
    row 7 Saturday of target 1. That cell needs a red 31, and the sticker
    arrives a quarter turn from upright, so the cause is `stacked-not-upright`.
- **Argument rejections:** unknown mode, and an unknown variant or mode for
  `inventory`.

These are invalid-candidate results, not UNSAT proofs.

## Reproduce

From the repository root, with Julia 1.13.3 and Java 21:

```sh
research/calendar-7x7/dual-stacked/flix/build.sh
JULIA_BIN=julia research/calendar-7x7/dual-stacked/run_checks.sh \
  /tmp/cubistry-calendar7-stacked-flix/artifact/flix.jar "$work/run"
JULIA_BIN=julia research/calendar-7x7/dual-stacked/negative_checks.sh \
  /tmp/cubistry-calendar7-stacked-flix/artifact/flix.jar "$work/neg"
```

Single runs:

- `julia --startup-file=no research/calendar-7x7/dual-stacked/check_stacked.jl PRINT DAG B context`
- `julia --startup-file=no research/calendar-7x7/dual-stacked/check_stacked.jl inventory A context`
- `java -jar flix.jar PRINT DAG B context research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review`
- `java -jar flix.jar inventory A context research/calendar-7x7/english/evidence`

Compare only lines starting with `stacked-`.

## Open decisions for the owner

1. **Case:** case 2 is recommended. Case 1 is obstructed for any print in this
   model.
2. **Reading:** is the context reading acceptable? Under it, a stacked sticker stands
   for a single date in 104 of 888 months (12 displays). For example, `24/31`
   black appears on an ordinary Monday the 24th. Without it,
   case 2 is impossible too.
3. **Overflow marks:** under case 2, `30↶` and `31↶` disappear completely. Is
   that intended?
4. **Orientation:** may a stacked label ever be read rotated? Assumed no. This
   is the rule that rejects the PR #128 states.
5. **Typography and size:** a font, the rule line and real sticker measurements
   are needed to judge two stacked numbers on corner and outer-wing stickers
   (UNKNOWN here).
6. **Scope:** stop at the 3-surface candidate, or look for up to 3 more frees
   with new states (bound 234)? That needs new DAG synthesis and is UNKNOWN.
7. **PR #128:** keep it as the superseded orientation-selection study (it is
   untouched here).
8. **Core pair (design alternative):** should an extra core sticker such as
   `5/12` be considered? It would remove the core part of the case 1 obstruction;
   the remaining case 1 orbits would then be UNKNOWN.
