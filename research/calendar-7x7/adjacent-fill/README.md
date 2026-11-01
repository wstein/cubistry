# English calendar: adjacent-month fill (static capacity)

**Status: research candidate, not certified. The result is negative:** none of
the new display sets fits the 294-surface cube. Native Julia and the Flix
structural port compute the same matrix, with byte-identical receipts, and both
reject all five malformed or incoherent display sets.

## Owner idea

Never leave a date cell blank:

- **Leading cells** (before day 1) show the previous month's last days.
- **Trailing cells** (after the last day) show the next month's first days.
- **A six-week month** (F31: Friday-start, 31 days; S30: Saturday-start, 30 days;
  S31: Saturday-start, 31 days) gets two displays, and the calendar is switched
  once in week 2:
  - **early**: weeks 1 to 5 in rows 3 to 7;
  - **late**: weeks 2 to 6 shifted up into rows 3 to 7, with the last row ending
    on 30, 31 and then the next month's 1, 2, ….
- **A four-week February** (Sunday start, 28 days) gets March 1 to 7 in row 7.
- Rows 1 and 2 (month letters, weekday names) are unchanged.

## Rules and assumptions

These are the PR #99 rules, unchanged:

- strict reading only;
- plain upright dates only;
- PR #99 glyph profile (6/9, half-turn-symmetric `0 1 2 5 8 H N S X Z`, O/0,
  I/1, any core rotation);
- a blank cell needs a blank sticker.

**Assumption, for the owner to confirm:** ink follows the weekday column (Sunday
and Saturday red, other days dark) for every cell, including adjacent-month
days. Adjacent-month days are therefore visually identical to in-month days: no
grey or smaller print. If they were printed differently, every adjacent-month
day would become a **new** artwork class, and the demand would grow further.

## The matrix (strict, 2026 to 2099, 888 months)

There are three choices:

- leading cells: `blank` (PR #99) or `prev`;
- trailing cells: `blank` or `next`;
- six-week months: `overflow` (PR #99 marks `30↶`/`31↶` in row 3) or
  `earlylate`.

That gives 8 combinations. `prev` with `overflow` is incoherent, because the
overflow marks need the empty row-3 cells that `prev` would fill. Both checkers
reject it (`adjacent-incoherent`, negative control `incoherent-overflow`). That
leaves 6 coherent combinations.

Receipts: [matrix.julia.tsv](evidence/receipts/matrix.julia.tsv) and
[matrix.flix.tsv](evidence/receipts/matrix.flix.tsv), identical.

| Combination (lead/trail/six) | Distinct displays | Same as a PR #99 display | New | Months with two displays | Strict lower bound (printed) | Obstructed orbits | Feasible |
|---|---:|---:|---:|---:|---:|---|---|
| blank/blank/overflow (PR #99, control) | 91 | 91 | 0 | 0 | **240** | none | yes (PR #99) |
| blank/blank/earlylate (the earlier "blanks" idea) | 109 | 73 | 36 | 190 | 294 | 8 | **no** |
| blank/next/overflow | 91 | 30 | 61 | 0 | 268 | 3: (-3,-3) (-3,-1) (-3,1) | **no** |
| blank/next/earlylate | 109 | 12 | 97 | 190 | 322 | 10 | **no** |
| prev/blank/earlylate | 115 | 13 | 102 | 190 | 333 | 9 | **no** |
| prev/next/earlylate (the owner's full idea) | 115 | 0 | 115 | 190 | **361** | 11 of 13 | **no** |

The 240 bound of the control reproduces PR #99.

**Why the counts are what they are.** What makes one display differ from
another:

- the month letters;
- the start weekday;
- the month length;
- with `prev`, the previous month's length. This varies only for March (after a
  28- or 29-day February); January always follows a 31-day December;
- with `earlylate`, the phase.

The display counts above are the exact distinct boards over all 888 months
(both checkers).

**Per orbit: printed + blank, against capacity.** "new" = artwork classes not
needed by PR #99:

| orbit (cap) | blank/blank/overflow | blank/blank/earlylate | blank/next/overflow | blank/next/earlylate | prev/blank/earlylate | prev/next/earlylate |
|---|---|---|---|---|---|---|
| (-3,-3) (24) | 20+3 (0 new) | 22+3 **over** (2 new) | 28+1 **over** (8 new) | 30+1 **over** (10 new) | 22+3 **over** (2 new) | 30+1 **over** (10 new) |
| (-3,-2) (24) | 15+2 (0 new) | 17+2 (2 new) | 21+1 (6 new) | 23+1 (8 new) | 17+2 (2 new) | 23+1 (8 new) |
| (-3,-1) (24) | 21+2 (0 new) | 25+2 **over** (4 new) | 26+1 **over** (5 new) | 30+1 **over** (9 new) | 25+2 **over** (4 new) | 30+1 **over** (9 new) |
| (-3,0) (24) | 18+2 (0 new) | 22+2 (4 new) | 22+1 (4 new) | 26+1 **over** (8 new) | 22+2 (4 new) | 26+1 **over** (8 new) |
| (-3,1) (24) | 22+2 (0 new) | 24+2 **over** (4 new) | 25+2 **over** (3 new) | 27+2 **over** (7 new) | 33+2 **over** (13 new) | 36+1 **over** (16 new) |
| (-3,2) (24) | 19+1 (0 new) | 22+2 (3 new) | 21+1 (2 new) | 24+1 **over** (5 new) | 22+2 (3 new) | 24+1 **over** (5 new) |
| (-2,-2) (24) | 16+0 (0 new) | 20+0 (4 new) | 16+0 (0 new) | 20+0 (4 new) | 20+0 (4 new) | 20+0 (4 new) |
| (-2,-1) (24) | 21+1 (0 new) | 27+1 **over** (6 new) | 21+1 (0 new) | 27+1 **over** (6 new) | 31+0 **over** (10 new) | 31+0 **over** (10 new) |
| (-2,0) (24) | 20+0 (0 new) | 25+0 **over** (5 new) | 20+0 (0 new) | 25+0 **over** (5 new) | 25+0 **over** (5 new) | 25+0 **over** (5 new) |
| (-2,1) (24) | 18+1 (0 new) | 23+1 (6 new) | 18+1 (0 new) | 23+1 (6 new) | 31+0 **over** (14 new) | 31+0 **over** (14 new) |
| (-1,-1) (24) | 22+2 (0 new) | 30+2 **over** (8 new) | 22+2 (0 new) | 30+2 **over** (8 new) | 42+0 **over** (20 new) | 42+0 **over** (20 new) |
| (-1,0) (24) | 22+1 (0 new) | 29+1 **over** (7 new) | 22+1 (0 new) | 29+1 **over** (7 new) | 35+0 **over** (13 new) | 35+0 **over** (13 new) |
| (0,0) core (6) | 6+0 | 8+0 **over** (2 new: 12, 13) | 6+0 | 8+0 **over** | 8+0 **over** | 8+0 **over** |

Every new class is listed per orbit in the receipts (`adjacent-newclass`). The
classes no longer needed are also listed (`adjacent-goneclass`: only `30↶`,
`31↶` with `earlylate`).

## What the fill does to blanks, and why it still fails

- **Blank demand falls**, as intended. With the full fill (prev/next/earlylate),
  date cells are never blank. Only the four blank month-header cells of row 1
  remain:
  - every edge orbit needs 1 blank sticker instead of 2 or 3;
  - every center orbit needs 0.
  - In particular, the corner orbit's blank peak falls from 3 to 1.
- **Printed demand rises much faster.**
  - Filled cells bring dates into orbits that never needed them. In the corner
    orbit (-3,-3) alone, the full fill adds red `1`–`7` (next month in row 7)
    and red `30`, `31`: 10 new classes, 30 + 1 = 31 > 24.
  - The early/late shift moves every date of a six-week month one row up. Dates
    then land in other orbits, as with the top fold of the stacked study: center
    orbit (-1,-1) needs 30 classes even with blanks, and 42 with full fill. The
    core cell must show 8 different labels (12 and 13 are new), but the cube has
    6 core stickers.
- **Overall:** the full fill needs at least 361 printed surfaces, more than all
  294 surfaces of the cube together. Even the mildest change (trailing fill
  only, PR #99 overflow kept) needs 268 printed and overruns three edge orbits.
  The earlier idea (early/late with blanks) needs 294 printed plus blanks.

**Answer to the owner: this is not an option on this cube.** It hits the same
kind of capacity limit, harder: per-orbit artwork capacity, and for the full
fill even the total surface count. Every new combination is obstructed even without
the blank rule: in at least one orbit, its printed classes alone exceed the
capacity. They do not
depend on a font choice either, since the PR #99 equalities are already
applied.

## Move consequences

Not studied, because no combination is feasible. For the record (both checkers,
column 6 of `adjacent-displays`): early/late would add 190 extra switches
(early to late) in 2026 to 2099, one per six-week month, and 18 to 24 extra
displays. No global search was run (it is not on this branch's base). No move
claims are made.

## Checkers

- [adjacent_common.jl](adjacent_common.jl), [check_adjacent.jl](check_adjacent.jl):
  native Julia. They include `../dual-stacked/stacked_common.jl`, which includes
  the unchanged PR #99 `../english/replay_legal.jl` and the artwork rules.
  Commands: `inventory SPEC` and `matrix`; SPEC is
  `lead=blank|prev,trail=blank|next,six=overflow|earlylate`.
- [flix/](flix/): Flix 0.79.0 structural port, built by
  [flix/build.sh](flix/build.sh) from the unchanged English Flix `Core`, `Data`
  and `Dag` modules. It validates the PR #99 target representatives against
  `../english/evidence/targets.tsv`. Run it with `-Dstdout.encoding=UTF-8` so
  that `↶` prints correctly.
- **Common-mode risks:** the display construction and the parsing are ported
  structurally, so a wrong definition would be shared. The calendar and the
  artwork classes come from the separately written PR #99 Julia and Flix
  modules.

[negative_checks.sh](negative_checks.sh) runs five controls: unknown key,
unknown choice, misordered keys, a missing key, and the incoherent prev +
overflow combination. Julia and Flix both exit 1 on all five, with matching
reasons ([results](evidence/negative-controls/results.tsv)).

## Reproduce

```sh
research/calendar-7x7/adjacent-fill/flix/build.sh
JULIA_BIN=julia research/calendar-7x7/adjacent-fill/run_checks.sh \
  /tmp/cubistry-calendar7-adjacent-flix/artifact/flix.jar "$work/run"
JULIA_BIN=julia research/calendar-7x7/adjacent-fill/negative_checks.sh \
  /tmp/cubistry-calendar7-adjacent-flix/artifact/flix.jar "$work/neg"
```

## UNKNOWN and open owner questions

- **UNKNOWN:** whether some partial variant fits that is outside this matrix.
  Examples: filling only a few chosen cells, or a different cube or sticker
  count. Not studied.
- **Owner question 1:** should adjacent-month days look exactly like in-month
  days (the assumption here)? Any visual distinction would add even more
  artwork classes.
- **Owner question 2:** the matrix shows that every fill or shift variant costs
  more stickers than the cube has in the affected orbits. Should research go
  back to the PR #99 layout (wrap marks), which remains the only checked full
  solution?
