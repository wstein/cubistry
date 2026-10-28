# Independent proof of adjacent English day layouts

Verdict: **SAT** for two exact immutable English prints, `en-adjacent-2` and
`en-adjacent-3`. Each physical print supports both leading-zero and unpadded
day display modes. The day digits are adjacent in the bottom-middle and
bottom-right cells; removing the zero is **not** required for feasibility.

This is the user's revised English layout. It supersedes the earlier English
split-digit proposals as a design recommendation, without overwriting their
historical mathematical evidence. The previously rejected German three-letter
proposal is not reinstated by this result.

## Exact display and print model

- The full two- or three-letter weekday abbreviation always occupies the
  top-left sticker. Top-middle and top-right are actual blank stickers.
  There are no exceptional weekday fragment partitions within either print.
- The English month occupies all three middle-row cells as individual
  characters. Its six possible middle letters use the six immutable centers
  `A, E, P, U, C, O`.
- Bottom-left is blank. Bottom-middle is the tens digit and bottom-right is
  the units digit. Leading-zero mode displays 01–09; unpadded mode replaces
  the tens image with a real blank for days 1–9. Days 10–31 retain adjacent
  tens and units in both modes.
- Each cube has exactly 54 fixed images on eight corners, twelve edges, and
  six centers. Every nonblank image is upright; blank up direction is ignored.
  Legal operations are outer-face turns and explicitly recorded whole-cube
  preludes. No image replacement, optical alias, or movable print is used.

The two weekday widths are different physical prints. The two padding modes
for a given width use the **same exact source print definition**, independently
verified by equality of their canonical 54-sticker hashes.

## Independent checking

`verify_adjacent.py` imports only the previously frozen independent
`verify_witness.py` engine, whose integer Rodrigues move replayer uses the
Python standard library and imports no author geometry, solver, or generator.
The new validator independently derives the adjacent cells, uniform weekday
placement, month lexicon, and zero policy. It also checks source body geometry,
immutable constructive piece tokens, and upright print-slot invariants.

All four full witness sets pass actual physical replay:

| Physical print | Day mode | Date patterns | Source-to-display outer HTM minimum–maximum | Mean HTM |
| --- | --- | ---: | ---: | ---: |
| en-adjacent-2 | Leading zero | 2,562 | 15–41 | 32.1530 |
| en-adjacent-2 | Unpadded | 2,562 | 16–41 | 32.3169 |
| en-adjacent-3 | Leading zero | 2,562 | 15–41 | 32.1530 |
| en-adjacent-3 | Unpadded | 2,562 | 16–41 | 32.3169 |

The checker independently enumerates Gregorian 2000–2399 and requires exactly
its 2,562 unique visible weekday/day/month patterns in each set. Thus 10,248
new target states are checked, including every valid month/day paired with
all seven weekdays, February 29, and no invalid dates.

For every target the actual whole-cube prelude, face-turn word, and center
correction are replayed through all 54 immutable sticker frames. Every front
cell matches the independently derived adjacent layout, and every nonblank
frame, **including the month center**, is upright. The inverse words restore
every original physical identity and frame in all 10,248 cases.

The construction's two all-blank corners supply the two blank front corners.
Its duplicated Sunday sticker avoids sharing a corner with the required units
digit. Two separate blank edge stickers cover the top-middle blank and the
unpadded tens blank simultaneously. When a tens 0 or 1 uses one of those edge
bodies, the top-middle blank uses the other. These observations explain the
construction; the legal witnesses, not inventory arithmetic, establish SAT.

All precise input hashes, source print hashes, per-mode results, and exact
unrounded metrics are retained in [verification.json](verification.json).

## Reproduction and controls

```sh
python3 research/date-3x3/verify_adjacent.py
python3 -m unittest discover -s research/date-3x3 -p 'test_verify_adjacent.py' -v
```

The full family validator and all four unittest methods pass. Eleven negative
cases reject a missing padding mode, nonuniform weekday fragments, a spoofed
or unknown padding policy, the old gap-between-digits layout, a zero retained
in unpadded mode, missing tens on day 10, an omitted visible-center correction,
a changed source image, a missing date witness, and illegal move notation.
The saved acceptance result is checked against complete fresh replay.

## Findings and limits

No unresolved physical-proof findings remain for these two exact prints and
their four display configurations. The earlier checker, original witnesses,
and earlier review artifacts were not modified for this investigation.

The move statistics include center corrections and count a half turn as one
HTM; whole-cube preludes are recorded separately. These are source-to-display
existence words, not shortest paths, consecutive-day averages, or an unlimited
five-move guarantee. Daily move optimization, global print optimality, final
typography, physical print sheets, application implementation, and unrestricted
bilingual feasibility remain outside this verdict.
