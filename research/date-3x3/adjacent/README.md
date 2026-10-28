# English calendar: adjacent day digits and uniform weekday labels

**SAT**, independently checked: `en-adjacent-2` and `en-adjacent-3` each support
both leading-zero settings on one immutable 54-sticker print.

The user's revised visual requirements supersede the earlier English split-day
proposals and reject German proposal B. These new English prints contain no
irregular weekday fragments: every weekday is the full two- or three-letter
abbreviation on the upper-left sticker. The remaining upper stickers are blank.
Month names always use three individual letters in the middle row. The day is
right-aligned below, with its tens and units on **adjacent** middle/right
stickers. For an unpadded single-digit day, only the lower-right digit is shown.

| Physical print | Formatting | Verified calendar patterns |
| --- | --- | ---: |
| en-adjacent-2 | 01–31 | 2,562 |
| Same en-adjacent-2 | 1–31 | 2,562 |
| en-adjacent-3 | 01–31 | 2,562 |
| Same en-adjacent-3 | 1–31 | 2,562 |

![Original revised English design concepts](../images/english-adjacent-proposals.png)

The image illustrates one date; the independent proof covers all 10,248 target
states, including February 29. The [review](independent/REVIEW.md) and
[structured verification](independent/verification.json) record exact hashes.
The complete physical print is byte-identical between formatting modes for each
weekday width. This changes the actual sticker shown at the day-tens position;
it does not hide or replace a zero in the renderer.

## Why the physical packing works

Two corner bodies supply blank upper-right and lower-left stickers. The other
six bodies hold the seven weekday abbreviations and ten unit digits. The last
weekday (`SU` or `SUN`) has two copies on different bodies. This avoids a
collision when that weekday and a unit digit would otherwise require the same
corner. The saved legal witnesses, rather than this allocation alone, establish
reachability.

Nine edges supply the eight first-month-letter and ten last-month-letter
images. The remaining three edges carry `(0, blank)`, `(1, blank)`, and `(2, 3)`
for the day-tens position and the blank upper-middle sticker. If no leading
zero is requested, the two blank images occupy two distinct visible edges.
The six middle letters `A, E, P, U, C, O` occupy the six centers.

## Reproduce

Install the parent folder's locked `cubing` dependency, then run from the
Research root. Use a new output path for each command:

```sh
node research/date-3x3/generate-witness.mjs research/date-3x3/adjacent/constructive/en-adjacent-2.json NEW_OUTPUT_PATH 2562 zero
node research/date-3x3/generate-witness.mjs research/date-3x3/adjacent/constructive/en-adjacent-2.json ANOTHER_NEW_OUTPUT_PATH 2562 unpadded
python3 research/date-3x3/verify_adjacent.py research/date-3x3/adjacent/witnesses/en-adjacent-2-zero.json
python3 -m unittest discover -s research/date-3x3 -p 'test_verify_adjacent.py' -v
```

Repeat for `en-adjacent-3`. The independent verifier reuses only the earlier
independent Python geometry, not author or solver geometry. It checks actual
whole-cube and face turns, every nonblank upright frame including the center,
full-state inverses, all valid Gregorian display patterns, and source-print
identity across formatting modes.

These are existence witnesses, not shortest daily transitions or global print
optima. The two weekday widths remain separate prints. A combined German and
English print is not claimed; no application or deployment is part of this
research change.
