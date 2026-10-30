# Moving three-letter month header: first results

Research-only necessary inventory bounds, not SAT or a print certificate.

**Superseding physical result:** the shared schedule below is now rejected for
DE 2026–2099 by an independently native-checked coupled-wing contradiction.
See [BLANK-OBSTRUCTION.md](physical-review/BLANK-OBSTRUCTION.md). The capacity
enumeration below remains correct; passing it was never a SAT claim. English
complete physical feasibility remains UNKNOWN.

## Requested variation

Keep three **separate adjacent uppercase letters**, but allow one deterministic
start column for each calendar month. Keep the chosen start for that month in
every year. No printed year. Prefer left (start 1), center (start 3), right
(start 5); only starts 1–5 fit three letters on seven stickers.

Each DE/EN design has its own fixed printing. Moving text means selecting
different physical stickers through legal moves, not repainting stickers.

## Best common readable candidate

**January–September right; October–December left.** One annual position change,
two positions, same rule for English and German. The independent native candidate
verification receipt, when complete, is in `verification/flix/`.

| Month | DE | EN | Start | Occupied columns |
|---|---|---|---|---|
| January | JAN | JAN | 5 | 5–7 |
| February | FEB | FEB | 5 | 5–7 |
| March | MÄR | MAR | 5 | 5–7 |
| April | APR | APR | 5 | 5–7 |
| May | MAI | MAY | 5 | 5–7 |
| June | JUN | JUN | 5 | 5–7 |
| July | JUL | JUL | 5 | 5–7 |
| August | AUG | AUG | 5 | 5–7 |
| September | SEP | SEP | 5 | 5–7 |
| October | OKT | OCT | 1 | 1–3 |
| November | NOV | NOV | 1 | 1–3 |
| December | DEZ | DEC | 1 | 1–3 |

## Enumerated schedule families

Every group chooses among all five starts, including nonpreferred starts 2/4.

| Fixed months per group | Schedules per language | DE passing | EN passing |
|---|---:|---:|---:|
| 6 (half-years) | 25 | 0 | 0 |
| 3 (quarters) | 625 | 1 | 3 |
| 2 (month pairs) | 15,625 | 0 | 55 |

Julia and independent native Flix enumeration agree on these family totals and
the common candidate. Raw native output is `verification/flix/moving.stdout.tsv`.
The detailed candidate orbit comparison is recorded separately.
The full unconstrained 5^12 assignment space has not been exhaustively searched.

Forward pairs with starts 1,2,3,4,5,1 fail both languages. Reflecting the last
pair to 4 also fails. Pair cycles left/center/right and quarter cycle
left/center/right/left fail both languages. The common candidate above is the
only passing DE quarter assignment within the declared profile.

## Tightness and proof limits

In the common candidate, DE saturates two top-row sticker orbits (24/24), EN one.
These zero-reserve orbits make further glyph/color changes potentially costly.
Overflow marks are still omitted as an optimistic relaxation. Font profile,
weekday order, fixed ink classes and date-grid structure are inherited from
`orientation_screen.jl` and `analyze.jl`.

For every orbit, compute:

1. All required oriented nonblank date/weekday classes across the supported years.
2. The union of month glyph/angle/ink classes at the scheduled positions.
3. The maximum simultaneous blank count across **actual month/year targets**.

The blank count includes date blanks and that same month's header blanks. It is
not the sum of maxima from unrelated months. Reusing the old constant-header
blank calculation would overcount in this moving-header investigation.

Passing still leaves coupled cubie matching, one full fixed print, orientations,
marked overflow artwork and constructive legal reachability unproved. Neither
this file nor a checker agreement changes physical feasibility from **UNKNOWN**.

## Reproduce

```sh
julia --startup-file=no research/calendar-7x7/moving_month_screen.jl
```

The JSON retains named failures, per-family counts and up to twenty top-scored
passing schedules per family. Ranking prefers starts 1/3/5, fewer distinct
positions, fewer month-to-month changes, then lower start-column sums. This
ranking measures layout simplicity, not physical feasibility or solver quality.
