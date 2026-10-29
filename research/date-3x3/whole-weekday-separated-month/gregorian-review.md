# Independent conditional impossibility review

Reviewer: separate agent calendar_optimizer_proof_review, October 29, 2026.
Verdict: **UNSAT under the exact assumptions below**.

## Model

- Ordinary 3×3 physical cube: eight corners with 24 sticker faces, twelve edges
  with 24 sticker faces, and six centers. Legal face and whole-cube rotations
  preserve each sticker's corner/edge/center orbit.
- One immutable exact upright image per sticker; distinct literal glyph images
  cannot be created by a rotation or runtime relabeling. In particular letter O
  and digit 0 remain distinct artwork. No word fragments or multiple meanings.
- Front top row has one complete weekday on a single sticker; both other cells
  are genuinely blank. The weekday may use any of the three top-row positions.
- Middle row stays blank / tens / units, with day 01 through 31.
- Bottom row stays three individual month letters, using JAN, FEB, MÄR, APR,
  MAI, JUN, JUL, AUG, SEP, OKT, NOV, DEZ.
- All valid Gregorian dates must be displayable. The seven distinct complete
  weekdays MON, DIE, MIT, DON, FRE, SAM, SON occur in the required domain.

## Independent counting proof

The union of month first and last letters has 17 members:
A, B, D, F, G, I, J, L, M, N, O, P, R, S, T, V, Z.
Month middle letters have seven members: A, E, K, O, P, U, Ä.

If the whole weekday occupies the upper-left or upper-right corner, corner
stickers need at least 7 whole weekday images + 17 distinct month corner letters
+ 1 blank for the other upper corner = 25 distinct images. Only 24 corner
sticker faces exist. These sets are disjoint under the exact-image assumption.

If the whole weekday occupies the upper-middle edge, edge stickers need at
least 7 whole weekday images + 7 month middle letters + 10 day units digits
+ 1 mandatory blank middle-left sticker = 25 distinct images. Only 24 edge
sticker faces exist. Again these sets are disjoint under the model.

This excludes every top-row placement. A separate reviewer script enumerated
all 146,097 days of years 2000 through 2399 and collected the required corner
and edge images directly from the requested front arrays. Its exact counts
were corner/edge 25/18, 18/25, 25/18 for weekday columns 1, 2, 3 respectively.
The captured result is /tmp/german-whole-weekday-individual-month-independent.json.
Fixed red/bold weekends add restrictions and cannot remove this obstruction.

## Scope boundaries

The corner argument explicitly needs the unused upper corner to be blank.
An unconstrained arbitrary image there is a different model. Fonts that merge
otherwise distinct letter/digit images, rotated glyph aliases, other month
abbreviations, moving or rearranging the day digits, changing row order, and
weekday text distributed over several stickers are not covered. This does not
prove that every three-letter German calendar layout is impossible, and does
not invalidate the existing German A print. It excludes the exact requested
single-sticker whole-weekday modification while retaining the specified A day
and month layout and blanks.
