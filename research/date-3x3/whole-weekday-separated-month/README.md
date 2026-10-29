# Whole German weekday with individually lettered month

**UNSAT under the exact front below.** This is not a general impossibility result
for German three-letter weekday displays.

- Ordinary 3×3 cube, fixed immutable exact upright glyph images.
- One entire weekday label (MON, DIE, MIT, DON, FRE, SAM, SON) occupies one
  top-row sticker; the two other top stickers are genuine blanks.
- The existing German A day row remains blank / tens / units.
- The month remains three individual letters across the bottom row, using the
  exact JAN, FEB, MÄR, APR, MAI, JUN, JUL, AUG, SEP, OKT, NOV, DEZ vocabulary.
- No dynamic images, fragments, rotated-glyph reinterpretation or shared O/0 image.

If the weekday uses either top corner, its seven whole labels require corner
sticker faces. The union of all first and last month letters contains seventeen
single-letter images. The opposite top corner requires a blank. Even allowing
all possible reuse of identical images across positions and dates, this needs
7 + 17 + 1 = **25 distinct corner images**, but eight corners have **24 faces**.

If the weekday instead uses the upper middle edge, its seven whole labels,
seven distinct middle month letters, ten day units and the blank at middle-left
require 7 + 7 + 10 + 1 = **25 distinct edge images**, but twelve edges have
**24 faces**. The glyph sets are disjoint. Every required month, weekday and
units glyph occurs within the Gregorian calendar domain.

These two cases exhaust the top row. Whole-cube rotations preserve corner and
edge orbits; more capable center-aware solving cannot remove this inventory
obstruction. Red/bold weekends impose further constraints and cannot help.

Run `python3 research/date-3x3/whole-weekday-separated-month/verify.py` from the
repository root. The script loads the preserved German A month vocabulary,
checks its source hash in the saved [proof output](proof.json), and computes
unions rather than assuming position-specific duplicate faces are needed.
An independent reviewer separately recomputed both unions and the orbit counts;
see [independent review](INDEPENDENT_REVIEW.md).

The previously feasible [whole-month proposals](../weekend-layouts/README.md)
are different models and were rejected by the user. Retain German A in the
application. Alternative day/row layouts, nonblank spare fields, other month
vocabularies and distributed weekday letters are outside this proof.
