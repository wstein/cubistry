# Zero-padded German date with colored wordmark: SAT

A newly synthesized immutable printing supports **every valid German date in
2020–2049 and every minute**, with `09OKT` date formatting, `12:33` time
formatting, red day/month printing, blue time digits, and three distinct upright
wordmark images across row 4. The two outer row-4 cells are unprinted blanks.
Weekday letters remain dark, year digits gray, and the colon red. The logo can
contain arbitrary fixed internal colors. This is a new joint wing printing,
not an assumption that the previous space-day printing still works.

The earlier UNSAT proof concerns the five-dash row. It does not apply here.
The previous [space-day wordmark witness](WORDMARK.md) is kept unchanged.

## Constructive wing proof

Each of 24 physical wing cubies has one sticker on each chirality side, A and B.
Front A slots (one-based row/column) are (1,2), (2,5), (4,1), (5,4).
Front B slots are (1,4), (2,1), (4,5), (5,2).
The blank at A (4,1) is always needed. The two B blanks at (1,4) and (4,5)
are always needed simultaneously. A blank may serve either eligible blank slot;
its multiplicity is never discarded.

The entire new 24-cubie wing printing is:

| A printing / role | B printing / role | Physical cubies |
| --- | --- | --- |
| Blank, two copies | Blue hour-unit 0, 1 | 2 |
| Blue minute-tens 0, two copies | Blue hour-unit 2, 3 | 2 |
| Blue minute-tens 1, two copies | Blue hour-unit 4, 5 | 2 |
| Red month-final B | Red day-tens 3 | 1 |
| Dark weekday-middle A, R | Red day-tens 0, two copies | 2 |
| Dark weekday-middle O, I | Red day-tens 1, two copies | 2 |
| Red month-final T, L | Red day-tens 2, two copies | 2 |
| Red month-final V, R | Blue hour-unit 6, two copies | 2 |
| Red month-final G, N | Blue hour-unit 7, two copies | 2 |
| Blue minute-tens 2, 3 | Blue hour-unit 8, two copies | 2 |
| Blue minute-tens 4, 5 | Blue hour-unit 9, two copies | 2 |
| Red month-final I, Z, P | Blank, three copies | 3 |

Rows describe separate connected components of the demand/physical-cubie graph:

* In each first-three-row component, the B symbols are mutually exclusive
  hour-unit digits. At most one of the two cubies is needed on side B, leaving
  one available for that component's A demand.
* FEB's final B and day tens 3 never coexist in a valid date.
* In each two-cubie component thereafter, the A symbols belong to the same
  display position and are mutually exclusive. At most one cubie is needed on
  side A, leaving one for that component's B demand.
* In the three-cubie blank component, the A symbols are mutually exclusive
  month-final letters. At least two cubies remain available for the two B blanks.

These components have disjoint demand types and disjoint physical cubies.
Their matches therefore combine without conflict. All required wing symbols,
colors, and blank multiplicities are covered. In particular the leading day
zero is a real red printed zero, separate from every blue time zero.

The weighted necessary bound alone is inconclusive here: A inventory 21,
B inventory 16 (including two blanks), at most six loose A stickers, at least
seven tight B stickers, and one calendar exception give equality `7 = 6+1`.
The explicit construction above resolves that equality positively. No numerical
solver status is used as evidence; the witness is independently checked.

## Full physical proof and verification

The generator reprints all wing stickers according to this new pairing. Other
cubie classes, including the three logo centers, retain the preceding witness's
fixed printing. The verifier nevertheless rechecks **all** cubie classes against
the zero-padded target model; it does not inherit its SAT verdict.

`scripts/verify_zero_day_wordmark.py` independently enumerates the labeled
150-sticker lattice, all proper rigid orientations, actual Gregorian dates,
and all 1,440 times. It matches immutable glyph/image identities, inks, and
frames using distinct physical cubies for each target projection. Its fresh
exact SymPy 1.14.0 group-order computation and even-subgroup partial-placement
transitivity establish simultaneous completion into the legal 5×5 move group,
as detailed in [the proof review](COMPACT_FORMAT.md#final-proof-review-what-is-actually-established).
This is an existence proof of legal complete states, not a generated sequence
of moves for each display or a proof-assistant formalization.

All nonfixed printed symbols and logo images can appear upright. Only blanks
need rotational reuse. The fixed front center remains a circular gray zero,
whose spin is optically irrelevant. Source printing angles for all 150 stickers
are supplied in `results/german-zero-day-wordmark-printing.csv`.
The logo uses the same fixed center stickers as before: IDs 6, 32, 8 for
left/middle/right, with source print angles 270°, 180°, 90° CCW respectively.

Two negative controls change actual physical printing: recoloring all blue
wing zeros red, and rotating the middle logo image by 90°. Both must fail actual
target matching. The verifier also checks the complete CSV against the witness.

Run (after the standard setup with the virtual environment activated):

```sh
npm run experiment:zero-day-wordmark
python3 scripts/verify_zero_day_wordmark.py
```

The certificate is `results/german-zero-day-wordmark.json`. The prior witness's
22-reserve claim is **not transferred** to this new printing. No maximum reserve
count is established here. Production artwork cropping/pixel validation remains
out of scope: each of the three fixed full images, including internal colors,
is treated as an opaque identity with a rigid upright frame. The logo may break
apart during turns; it is guaranteed in completed target states.
This result concerns German only; no new English or bilingual result is claimed.
