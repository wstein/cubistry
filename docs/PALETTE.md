# German palette experiment: one critical color equality

The later [space-padded-day investigation](DAY_PADDING.md) separately proves DE SAT with original row colors for ` 3OKT`; the zero-padded findings here are unchanged.
The layout, abbreviations, physical cubies, and glyph model are unchanged.
The existing German fixed sticker design is reused, not rediscovered by a new
large search. Only permanent ink assignments are varied. English remains UNSAT
even without colors; none of these color relaxations can rescue English.

## A, B, C and the minimal change

| Case | Color requirement / witness | DE result |
| --- | --- | --- |
| A | All digits one ink; weekday and month letters may have different inks | **SAT** |
| B | All letters one ink; digit inks may differ: date/time together, year separate | **SAT** |
| B, keeping original digit colors | Letters together, but red date digits and blue time digits remain distinct | **UNSAT in the documented glyph model** |
| C | All letters and digits one ink; separator and colon may each have their own ink | **SAT** |
| Minimal change to your latest color table | Change only date digits to time blue; month letters remain red, year/separator gray, weekday dark, colon red | **SAT** |

“May have different colors” is permissive, not a requirement that every digit
component keep a different ink. Thus B itself is SAT: two digit inks suffice,
with one for date/time and another for the year. Only the stricter B experiment
that preserves the original separate date/time inks fails.

The critical equality in this glyph model is

```text
ink(date digits) = ink(time digits).
```

**Year digits need not join that ink.** Neither weekday letters nor month
letters need to match each other or any digit ink. Separators and colon can
have independent inks too. A fixed witness with **six distinct printed inks**
is independently certified:

1. Weekday letters.
2. Month letters.
3. Date digits and time digits together.
4. Year digits.
5. Separators.
6. Colon.

Blank stickers have no printing and are not counted as a seventh ink. The six
names denote distinguishable fixed colors; no specific RGB choice is needed.
Every coarsening of this witness's colors preserves its legal configurations.
This proves the positive A/B/C variants without assuming that arbitrary new
colorings would be feasible.

## What “minimal” means

Two complementary measures are checked:

* **Fields recolored:** Zero changes reproduces the impossible four-class target in your latest table.
  Changing only the date-digit field to the time-digit color succeeds. Hence
  one recolored field is minimal; the overall palette can retain all four of
  your latest table's four ink colors. The month letters stay red.
* **Whole original color classes merged:** Start with the four classes in your latest table: dark weekday,
  red date/month, gray year/separator, blue time. All 15 partitions (coarsenings)
  are classified. In the documented glyph model, five are SAT and ten UNSAT.
  The only successful one-pair merger is red date/month with blue time. Its
  whole-class interpretation merges month-letter and time-digit ink too; that broader change
  is unnecessary if digit and letter fields may be colored separately.

The earlier image used a lavender separator; your latest table groups it with
the gray year. Both original choices are impossible before the critical digit
change. The four-class partition enumeration uses your latest table.

The second statement establishes uniqueness only in the specified glyph model.
The first minimum is also supported by the stronger, orientation-free proof
that the unchanged original colors are impossible. Neither minimum claims
that every conceivable font has the same classification.

## Why keeping date/time digit inks different fails

The fixed-up assumption is not restored. The verifier enumerates all proper
cube rotations, source wing stickers, four print-up directions, allowed glyph
symmetries, and target inks. It checks which front roles each physical printed
sticker can serve.

If date and time digit inks differ, every physical wing sticker in this model
can serve at most one required role/symbol token on its sign side:

* The four A roles need 21 tokens in total.
* The four B roles need 16 tokens.
* Distinct inks separate day digits from hour digits even for a circular zero.
* If weekday and month letters share ink, their overlapping `I` and `R` still
  cannot serve both A positions: those positions differ by a quarter-turn.
  Here I is a vertical bar with only half-turn symmetry and R is used upright.

Thus the [paired-wing singleton proof](SINGLE_LANGUAGE.md) applies: at least
8 unique B tokens would need physical partners, but at most 7 can be supplied.
At least 25 wings would be necessary; the cube has 24. This is a complete
negative proof within the stated physical/optical model, not a failed attempt
to color the particular witness.

If a future font adds quarter-turn symmetry to I or R, the role lemma must be
checked again. The verifier deliberately rejects applying this UNSAT argument
when an added I symmetry makes the lemma fail. It does not label that changed
font UNSAT by extrapolation.

## How the fixed positive printing is certified

`results/palette-analysis.json` stores the six-ink palette, an immutable ink
for every one of the 150 sticker IDs, and mappings for the coarser successful
palettes. The geometry, symbols, normals, and printed-up vectors come from
`results/german-monochrome.json`. Together these files are the complete physical
printing assignment; no sticker changes ink between display states.

The independent Python verifier:

1. Recomputes the exact full legal group and local partial-placement coverage
   for the original design in the current process.
2. Reconstructs each palette's fixed printing and all rigid glyph poses.
3. Requires **both symbol and ink** to match every target. It does not trust
   `targetSlots` as evidence that a colored sticker can be used there.
4. Checks every calendar/time projection and selects distinct physical cubies
   for different front positions, including both stickers' wing coupling.
5. Uses the already verified unchanged legal group to prove that the five
   class matchings have a simultaneous legal full-state completion.

The group calculation is reused only after fresh verification in that same
process, never merely because an old JSON says SAT. Only ink changes, so
repeating the identical 30–40 second group calculation for every palette
would add no physical evidence. All colored matchings are independently redone.

This covers all 10,958 dates and all 1,440 minutes, i.e. 15,779,520 German
displays, with one fixed printing for each successful palette.

## Which characters must be rotated?

Two different angles must not be confused.

### Rotation in the displayed text

In this construction **only the circular zero needs nonzero optical display
rotation**. Three fixed zero stickers can occupy either of these front slots:

| Front use | Position (row,column) | Angle relative to upright text |
| --- | --- | ---: |
| Day tens | (2,1) | 0° |
| Hour units | (5,2) | 90° counterclockwise |

These are the same three physical stickers, permanently carrying the common
date/time digit ink. Their IDs and original positions are:

| Sticker ID (0-based) | Source face | Source row,column | Print angle on that source face |
| --- | --- | --- | ---: |
| 28 | D | (1,4) | 270° |
| 53 | F | (1,4) | 270° |
| 71 | F | (5,2) | 90° |

A centered circular ring looks identical at these angles. Its symmetry is
specified in `src/Glyphs.res` and [zero.svg](glyphs/zero.svg).

The verifier repeats the positive matching with **all nonblank characters
except zero restricted to 0° display orientation**, and it still passes.
Therefore rotated O, I, separators, or other letters/digits are not needed.
Their declared half-turn symmetries remain permitted, but optional.

In the current glyph model, removing the zero's 90°/270° equivalences restores
the 25-in-24 contradiction even when all text inks are merged. Thus quarter-turn
use of zero is necessary in this model, not just a cosmetic accident of this
printing. Alternative fonts with other new symmetries are outside that claim.
Fixed-center zero may also undergo invisible spins; other fixed centers are blank.

### Printing angle on the initial physical cube

A sticker may need to be printed sideways or upside down on its **source face**
so that it later appears upright after legal cube moves. That can involve
letters and all other glyphs; it is not a request to read them sideways.

[The 150-sticker CSV](../results/german-palette-printing.csv) lists every source
face/row/column, glyph, both the six-ink and minimal-change ink, and print angle.
Angles are 0°, 90°, 180°, 270° counterclockwise about the outward face normal,
relative to the canonical U/D/F/B/R/L face-up convention in the geometry model.
The independent verifier checks the CSV against the physical assignment and
print-up vectors. Blank print angles have no optical significance.

## Commands and result scope

After [installation](../README.md), run:

```sh
npm run experiment:palette
```

This regenerates palette candidates, independently certifies the unchanged
physical group, checks all successful fixed colorings, verifies all impossibility
arguments and rotation records, and writes final statuses. Successful candidates
start as UNKNOWN until those checks complete. The full `npm run check` also
runs 14 focused regression tests and preserves previous EN/DE/reference results.
`npm run verify` checks saved certificates rather than replacing them.

This investigation changes color constraints as requested. It does not change
the layout, words, calendar range, glyph identities, cubie attachment, or legal
moves, and it creates no new pull request.
