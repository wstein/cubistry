# English calendar: stacked dual labels (23/30, 24/31 and 1/8)

**Status: research candidate, not certified.** Native Julia and the Flix port
accept one candidate (variant B, context reading, below) with byte-identical
receipts and reject all ten corruption controls. There is no independent review
yet and no pinned manifest. Anything not covered by both checkers is marked
UNKNOWN.

This folder replaces the meaning of PR #128 (`../dual-dates/`) without changing
it. PR #128 is an orientation-selection profile: one surface carries two labels a
quarter turn apart and only the upright one counts. The owner meant something
else: **one sticker carries two dates stacked, like a printed calendar cell
(`23` over a thin rule over `30`), both visible at the same time, and the month
decides which one applies.** `../dual-dates/` stays as it is.

## Semantics checked here

The printing, cubies, 21 legal generators and the 91 PR #99 legal states are
reused unchanged. Front rows 1 and 2 (month letters, weekday names) are unchanged.

**Stacked sticker.** A surface printed `a/b` (with `b = a + 7`, same weekday
column) shows both dates. It has one ink: both dates are in the same column, so
they always share the column's ink class (red for Sunday and Saturday, dark
otherwise). It has no rotational symmetry: it is read only when upright. Plain
dates keep the PR #99 glyph rules (bar 1, round 0, 6/9, half-turn symmetries).

**Folded month (layouts A and B).** A month that needs six week rows is printed
in the five date rows (rows 3 to 7) with stacked cells instead of the PR #99
overflow (`30↶`, `31↶` wrapped into row 3):

| Layout | Six-week month | Folded cell | Label, ink |
|---|---|---|---|
| B (bottom) | starts Saturday, 30 or 31 days | row 7, Sunday | `23/30`, red |
| B | starts Saturday, 31 days | row 7, Monday | `24/31`, dark |
| B | starts Friday, 31 days | row 7, Sunday | `24/31`, red |
| A (top) | starts Saturday, 30 or 31 days | row 3, Saturday; weeks 2 to 6 in rows 3 to 7 | `1/8`, red |
| A | starts Friday, 31 days | row 7, Sunday | `24/31`, red |

Every other month keeps its PR #99 front. In 2026 to 2099 this folds 190 of the
888 months (73 Friday-start 31-day, 42 Saturday-start 30-day, 75 Saturday-start
31-day; Julia count only), which are 18 of the 91 representative displays. The
888 months still map one-to-one onto 91 distinct displays (both checkers check
this).

Colour assumption: the owner wrote `sw+rt` (black and red). In layout B the
`24/31` cell is red in Friday-start months and black in Saturday-start months,
and `23/30` is always red. That matches the photo (23 and 30 red, 24 and 31
black). The reading used here is **two single-ink `24/31` stickers, one red and
one black**, not one two-coloured sticker. The owner should confirm this.

**Two readings of a stacked sticker in a cell**, both implemented (`MODE`):

- `strict`: a stacked sticker is correct only on a folded cell with the same
  label and ink. Ordinary cells need plain dates.
- `context`: in addition, an upright stacked `a/b` in the cell's ink may stand
  where the month needs just `a` or just `b`. This is the owner's "the month
  decides which one applies". In such a month the other date also appears
  elsewhere as its own sticker.

**Layout W** (PR #99 wrap layout kept, overflow marks stay) reads the PR #128
pairs 1/8 and 24/31 as stacked context stickers. It is used to test the PR #128
idea under the new reading.

## Results (both checkers, identical receipts)

[evidence/receipts/cases.tsv](evidence/receipts/cases.tsv), from
[run_checks.sh](run_checks.sh). "Pass" counts the 91 PR #99 legal states (DAG
`all-targets-dag.tsv.gz`, SHA-256 `64d1eb37…e932`, unchanged) whose front shows
the new display:

| Case | Print | Pass / 91 | Printed | Verdict |
|---|---|---:|---:|---|
| B, context | candidate `print-B.tsv` | 91 | 237 | **ACCEPT** |
| B, strict | candidate `print-B.tsv` | 79 | 237 | reject |
| A, context | candidate `print-A.tsv` | 78 | 237 | reject |
| A, strict | candidate `print-A.tsv` | 72 | 237 | reject |
| B, context | PR #99 print unchanged | 73 | 240 | reject (the 18 folded displays fail) |
| A, context | PR #99 print unchanged | 73 | 240 | reject (the 18 folded displays fail) |
| W, context | PR #99 print unchanged | 91 | 240 | accept (positive control) |
| W, context | PR #128 pairs as stacked | 52 | 238 | reject |
| W, context, PR #128 repaired DAG | PR #128 pairs as stacked | 52 | 238 | reject |

The positive control reproduces all 91 PR #99 state digests of
`../english/evidence/julia-state-hashes.tsv` exactly.

### Accepted candidate (layout B, context reading)

[evidence/print-B.tsv](evidence/print-B.tsv) differs from the PR #99 print in six
surfaces. The three overflow stickers become blank: 193 (`31↶` dark), 224 (`30↶`
red) and 243 (`31↶` red). Three surfaces are reprinted as stacked labels of
their own date and ink: 15 (`23` to `23/30`, red), 16 (`24` to `24/31`, red),
both on the corner cubie at (-3,-3,3), and 61 (`24` to `24/31`, dark, outer wing
at (-3,2,3)). The DAG is not changed and there are **no repairs**: all 91 PR #99
legal states satisfy the new front. Printed surfaces go from 240 to **237**, and
blanks from 54 to 57. The untrusted generator
[generate_stacked.jl](generate_stacked.jl) derived this print from the old states.

Things to know about it:

- It depends on the context reading. In strict mode 12 states fail (targets 28,
  33, 42, 45, 50, 54, 59, 62, 71, 76, 87, 90). There a stacked sticker stands on
  an ordinary cell, for example `24/31` dark on Monday the 24th of April 2028,
  while 31 is not in that month at all.
- The move words are identical to PR #99 (same DAG file). No move savings are
  claimed.
- The state digests differ from PR #99 only because six surfaces have new
  artwork. Every piece pose is the same.

### Why the existing states cannot free more surfaces

Both checkers report `stacked-printed-never-on-front 0` for the PR #99 print:
each of the 240 printed surfaces is on the front, showing its own non-blank
label, in at least one of the 91 PR #99 states. While those states are kept,
blanking a surface breaks the state that shows it, whatever the reading. The only
exceptions are surfaces whose cells change. Under layout B those are exactly the
three overflow stickers. This is why:

- Layout W (keep wrap, merge 1/8 and 24/31 like PR #128) fails 39 states with
  the PR #99 DAG. It also fails 39 states with the PR #128 repaired DAG, because
  those repairs show surface 255 a quarter turn from upright, which a stacked
  sticker does not allow.
- Layout A changes every date row of the Saturday-start six-week months. 11 such
  displays fail outright, plus 2 Saturday-start February displays (targets 62,
  90) in which the old state shows the `1` surface (reprinted `1/8`) upside down.
  That was legal for a bar 1, but is not for a stacked label.

## Capacity

| Variant | Freed printed surfaces | Basis |
|---|---|---|
| B, context, PR #99 states kept | **3** (240 to 237) | both checkers ACCEPT |
| B, strict | **0**: the strict inventory lower bound is 240 | both checkers (`stacked-lower-bound-strict`) |
| A, strict | **none, it costs 27 more**: lower bound 267 | both checkers |
| A, context | UNKNOWN (PR #99 states fail; no context bound computed) | — |
| B, context, new states allowed | UNKNOWN (no context inventory bound computed, no new DAG) | — |
| W (PR #128 pairs, wrap kept), states kept | 0 | the never-on-front lemma above |

The strict lower bound is the per-orbit, per-artwork maximum simultaneous demand
of the existing native bound, applied to the new displays. It is a necessary
condition for any strict print, not a construction. The context reading has no
such bound here, because a stacked sticker can serve three artwork classes. A
context bound would need a small per-orbit covering computation. That is not
done.

## Space on the physical stickers

Repository sources: [evidence/space-table.tsv](evidence/space-table.tsv)
(descriptive Julia listing, [space_table.jl](space_table.jl)), the 294-surface
model of `../english/evidence/physical-print.tsv`, and `../english/README.md`
(the 240/54 component table).

- **Real sticker dimensions are not in the repository.** No millimetre values
  for corner, wing, midge or centre stickers appear in `research/calendar-7x7/`,
  `docs/SUPER_PICTURE_CUBE.md`, `docs/PICTURE_PLAYGROUND.md` or
  `knowledge/plans/picture-cube-concept.md`. Real sizes and whether outer-layer
  stickers are smaller are UNKNOWN.
- The repository model puts every surface on a unit lattice cell (positions -3
  to 3, one surface per position and normal). In the model, all piece types
  therefore have the same size (ratio 1:1:1:1). This is a modelling assumption,
  not a measurement. A stacked label has two text lines in one cell, so each
  date line gets at most about half the height a plain date gets on the same
  surface, minus the rule between them.
- Front grid piece types: rows 1 and 7 and columns 1 and 7 are edge pieces
  (corner, outer wing, inner wing, midge, inner wing, outer wing, corner). The
  inner 5×5 are centres, including the core centre at row 4, column 4.
- Same-column cells seven days apart are vertical neighbours (row r over row
  r+1, r = 3..6, all 28 pairs listed in the table). The two cells of a pair are
  never in the same surface orbit, so no single sticker can serve both cells of
  one month. A fold puts both dates on **one** cell. That cell is in row 7,
  column 1 (corner) or column 2 (outer wing) for layout B, or in row 3, column 7
  (inner wing) for layout A's `1/8`. The other date of the pair would sit in a
  sixth date row, or before the first one, which the 7×7 face does not have.
- The stacked artwork sits on the cell's surface: in layout B on a **corner**
  sticker (`23/30` red and `24/31` red, surfaces 15 and 16) and an **outer-wing**
  sticker (`24/31` dark, surface 61). Layout A's `1/8` falls on an inner-wing
  sticker (surface 244 in the rejected candidate). Whether two stacked numbers
  are legible on these real stickers depends on the UNKNOWN real sizes and on a
  font.

## Checkers

- [stacked_common.jl](stacked_common.jl), [check_stacked.jl](check_stacked.jl):
  native Julia. They include the unchanged `../english/replay_legal.jl`
  (geometry, print reader, legal DAG replay, PR #99 optics) and add the fold
  layouts, the print-change rules and the stacked match rule.
- [flix/](flix/): Flix 0.79.0 port, built by [flix/build.sh](flix/build.sh) from
  the unchanged English Flix `Core`, `Data` and `Dag` modules plus a new
  `Main.flix`.
- Both pin the SHA-256 of the PR #99 print. Both allow only these print changes:
  an overflow or paired-date surface may become blank, and a plain date may
  become a declared stacked pair containing it, in the same ink. Identities and
  frames are fixed.

**Common-mode risks.** The Flix checker is a *structural port*: its fold layout,
print rule and match rule follow the Julia code closely. A wrong definition of
the semantics would therefore be shared. The geometry, calendar, optics, print
reader and DAG replay come from separately written English Julia and Flix
modules (the PR #99 pair). The candidate print came from a Julia generator, but
only the checkers decide. The literal 888 is checked as a month count in both.

[negative_checks.sh](negative_checks.sh) corrupts one item of the accepted
candidate at a time. Results are in
[evidence/negative-controls/results.tsv](evidence/negative-controls/results.tsv).
Julia and Flix both exit 1 on all ten, for matching reasons:

- Print-rule rejections: wrong ink on 15, undeclared pair `23/31`, reversed
  `31/24`, a blanked month letter, a flipped up vector on 16, the candidate
  checked as layout A.
- Front-check rejections: an overflow sticker restored (11 states fail), DAG
  roots of targets 1 and 2 swapped (2 fail), the root of folded target 5
  inverted (1 fails).
- Argument rejection: an unknown mode.

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

One case by hand:
`julia --startup-file=no research/calendar-7x7/dual-stacked/check_stacked.jl PRINT DAG B context`
and
`java -jar flix.jar PRINT DAG B context research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review`.
Compare only lines starting with `stacked-`.

## Open decisions for the owner

1. **Reading:** is the context reading acceptable? A stacked `24/31` would
   appear on an ordinary Monday the 24th, and 31 would also appear elsewhere in
   31-day months. The 3-surface saving exists only under this reading. Under
   strict, nothing is saved.
2. **Fold position:** bottom fold (B: 23/30 and 24/31) or top fold (A: 1/8 for
   Saturday-start months and 24/31)? A costs at least 27 more printed surfaces
   under strict and does not keep the existing states.
3. **Colours:** is `sw+rt` two single-ink `24/31` stickers (assumed here), or
   something else?
4. **Overflow marks:** under B, `30↶` and `31↶` disappear completely. Is that
   intended?
5. **Orientation:** may a stacked label ever be read rotated? Assumed no.
6. **Typography and size:** a font, the rule line and real sticker
   measurements are needed to judge two stacked numbers on corner and
   outer-wing stickers (UNKNOWN here).
7. **Scope:** stop at the 3-surface candidate that keeps every legal state, or
   look for more merges with new states? That needs a context inventory bound
   and new DAG synthesis, both UNKNOWN.
8. **PR #128:** keep it as the superseded orientation-selection study (it is
   untouched here).
