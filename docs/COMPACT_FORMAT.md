# Four-format result matrix and proof review

All four rows below use **space-padded single-digit dates**, e.g. ` 3OKT`,
not `03OKT`. Days 10–31 remain two digits. The original ink categories remain:
weekday dark, day/month red, year gray, separator gray, time digits blue,
colon red, blanks unprinted. The earlier lavender separator also works.
No date/time ink merger is assumed in this matrix.

| Time example | Separator | DE | EN | Common EN+DE |
| --- | --- | --- | --- | --- |
| `09:37` | `─────` | **SAT** | **UNSAT** | **UNSAT** |
| ` 9:37` | `─────` | **SAT** | **UNSAT** | **UNSAT** |
| `09:37` | `·───·` | **SAT** | **UNSAT** | **UNSAT** |
| ` 9:37` | `·───·` | **SAT** | **UNSAT** | **UNSAT** |

Dots illustrate real unprinted blanks; they are not printed dot glyphs.
The short separator is exactly ` ─── `, retaining the original horizontal
separator glyph and leaving its first and last positions empty. The user's
ASCII notation ` --- ` describes the same three-stroke layout; this experiment
does not introduce a different separator font as an extra variable.

These verdicts concern the explicit layouts, abbreviations, calendar range,
and optical assumptions below. They do **not** rule out an English calendar
cube with a different layout, target vocabulary, or newly designed glyph model.

## Formatting details

* Date padding: ` 1` through ` 9`, then `10` through `31`.
* Zero-padded hours: `00` through `23`, including `09:03`.
* Space-padded hours: ` 0` through ` 9`, then `10` through `23`.
* Minutes always keep two digits, e.g. ` 9:03`, never ` 9: 3`.
* Every front row still occupies exactly five stickers.

Saturday October 3, 2026 at 09:37 in the preferred zero-hour/short-separator
variant is:

```text
SAM··
·3OKT
·2026
·───·
09:37
```

The original zero-padded **day** experiments remain separately scoped in
[PALETTE.md](PALETTE.md) and [SINGLE_LANGUAGE.md](SINGLE_LANGUAGE.md). The matrix
above must not be read as a new SAT claim for `03OKT` with all original inks.

## Color variants

For every matrix row, a stronger German witness is verified with **seven
independent component inks**:

1. Weekday letters.
2. Month letters.
3. Day digits.
4. Year digits.
5. Time digits.
6. Separators.
7. Colon.

The physical blank stickers carry no ink. Every coarsening or renaming of those
seven inks preserves the certified configurations. Thus the original colors,
monochrome, and the requested A/B/C restrictions all have German SAT witnesses
in these space-day formats. This is a statement about these seven fields,
not arbitrary independent coloring of every position or date.

English is UNSAT with the original distinct row colors even when all glyph
rotations are allowed. For the two five-stroke rows, the stronger orientation-free
English impossibility also holds without any ink distinctions. For the two
three-stroke rows, the color-ignored impossibility is independently established
within the **documented shared glyph model**, not every conceivable future font.
A common DE+EN printing would have to serve EN alone, so its impossibility
follows for the same scope.

## Fixed German construction

The existing [space-day printing](DAY_PADDING.md) is reused. Hours with a leading
blank only change corner stickers that previously printed the leading hour zero
into blanks; minute zeros and hour units retain their printing. No physical
piece is detached or reassigned between states.

Shortening the separator changes its two *front wing positions* to blanks.
In the complete fixed printing, four former wing-dash copies become blank;
three center-dash stickers stay unchanged. B-side blanks can now supply weekday
blank, leading-day blank, and the right separator blank. The A-side separator
blank remains coupled to its original partner, not independently movable.

For every successful case the result JSON contains all 150 permanent sticker
identities, cubie positions, normals, print-up vectors, glyphs, and inks.
The seven-ink alternatives are specified by an immutable ink array referring
to those same physical IDs in the comparison certificate. There is one printing
per chosen design, not a different printing for each calendar target.

## Which characters must be rotated?

All **printed glyphs on nonfixed front cubies can appear upright** in every
matrix row. The verifier repeats the positive proof with every such printed
glyph restricted to 0° display rotation. Quarter-turn reuse is confined to
unprinted blanks. Optional half-turn equivalences of O/I/separators are permitted
by the font but are not needed for this construction.

The front fixed center remains the circular zero, so its otherwise untracked
spin is optically invisible. Other fixed centers are blank. A nonsymmetric
fixed-center zero has not been certified by this experiment.

Source printing angles differ from display angles: a source sticker can need
sideways/upside-down printing so that it reads upright after cube moves.
The audited 150-sticker plans are:

* Baseline `09:37` + long separator:
  [german-space-padded-printing.csv](../results/german-space-padded-printing.csv).
* Space hour + long separator:
  [german-hour-space-printing.csv](../results/german-hour-space-printing.csv).
* **Preferred zero hour + short separator:**
  [german-short-separator-printing.csv](../results/german-short-separator-printing.csv).
* Space hour + short separator:
  [german-compact-printing.csv](../results/german-compact-printing.csv).

Angles are counterclockwise around the outward source-face normal relative to
its canonical face-up direction. Every CSV entry is checked against the fixed
physical assignment; blank print angles have no optical significance.

## Conservative sticker reserves

These are **verified unused printing positions**, not capacity estimates and
not additional available cubies. For every required display, the verifier
finds a legal completion while forbidding all listed reserved sticker IDs
from supplying the front at once. The physical pieces and their other stickers
remain present and coupled. A random scramble could still bring a reserved
sticker to the front; the certificate concerns the chosen display states.

| Hour padding | Separator | Simultaneously reservable printing positions verified |
| --- | --- | ---: |
| Zero | Long | At least **21** |
| Space | Long | At least **21** |
| Zero | Short | At least **22** |
| Space | Short | At least **22** |

The 21 consist of 11 axial-center stickers, five diagonal-center stickers,
and five hidden fixed-center stickers. With the short separator, one B-side
blank wing sticker (ID 28 in these printings) can additionally be excluded from
all front assignments. Its cubie may still supply the *other* sticker, so this
is one printing position, not an extra wing cubie. All remaining matching and
legal-completion checks are rerun with this exclusion.

No search for the global maximum reserve is claimed. Extra blanks from the
space-hour mode might allow other reserves not established here. Therefore the
identical conservative counts do not prove the two hour styles have equal
optimal capacity.

The preferred `09:37` + short separator has a full SAT certificate and the
additional verified wing printing reserve, without sacrificing the two-digit
hour style. Typography can therefore decide between the successful German
variants without a demonstrated mathematical penalty for that preference.

## English impossibility with the short separator

The earlier five-dash proof is recomputed for those rows, rather than silently
extended to a changed layout. For the short separator, a new weighted wing-type
proof is used. It retains 24 labeled coupled wing cubies, each with one A-side
and one B-side sticker.

With the original inks, each nonblank glyph/ink combination serves a unique
role. Blank roles share one optical type, because a single unprinted sticker
can occupy different eligible blank slots. The same role separation remains
valid without inks in the defined glyph model: repeated nonblank symbols at
quarter-turn-related slots cannot share a printed sticker unless their declared
symmetries permit it. This is explicitly enumerated over proper rotations.

For English:

* A requires 23 role types, once each, with one spare among 24 stickers.
  Hence at most two A stickers can be non-tight (have a surplus alternative).
* B needs three simultaneous blanks plus 13 nonblank role types: required
  inventory 16, leaving eight spares. Loosening at most eight types can cover
  at most `3+7=10` of the required inventory. At least **six B stickers remain
  tight**, forced whenever their type's maximum is displayed.
* Actual-calendar co-occurrence has just the February/day-tens-3 exception.
  It can supply at most one additional exceptional pairing.
* Consequently at least six forced B stickers would have to fit at most
  `2+1=3` compatible A partners. This is impossible.

The independent verifier recomputes the maxima and the co-occurrence relation
from the new complete wing projections, and checks the physical role-separation
premise. It counts multiple blanks as different physical required copies, never
as one interchangeable sticker. Changing glyph symmetries beyond the font model
requires checking that premise again for the color-ignored result.

## Final proof review: what is actually established

SAT here is a reproducible computational group-theoretic existence proof,
not merely a passing test or a list of plausible front faces:

1. The witness fixes all 150 printed sticker identities once. Targets never
   modify their glyph, ink, source cubie, or print-up vector.
2. Independent rigid-pose matching covers every real Gregorian date and minute
   projection, including blank/separator stickers, with distinct whole cubies
   at different front positions. Normals and glyph-up vectors rotate together.
3. Python independently constructs the actual legal quarter-turn action on
   all labeled stickers. No same-color piece quotient is used.
4. Exact Schreier–Sims orders prove that this legal group equals the full
   parity-compatible product of its local projections, not merely a subgroup
   satisfying necessary invariants. This is the key completeness step.
5. Pointwise-stabilizer orders establish transitivity on **all needed oriented
   partial placements** within the even local subgroups. Therefore each class's
   matched front can be completed, and the class completions belong together
   to the full legal group. This yields one complete legal state per display.
6. Nonfixed source/destination facelets uniquely determine their glyph tangent;
   invisible fixed-center spins are covered by circular-zero/blank symmetry.
   Unobserved internal cubies follow the legal move word implicit in group
   membership; they are not assigned an arbitrary illegal completion.

The argument uses the explicit 5×5 physical move model, the font equivalences,
and the pinned exact SymPy 1.14.0 algorithms. It is independently implemented
in Python relative to the ReScript/JS generator; it is not a proof-assistant
formalization or an independently implemented second Schreier–Sims library.
The mathematical reduction and finite-group equality argument are documented
in [MONOCHROME.md](MONOCHROME.md), with exact integer evidence in the JSON files.

The regression tests check formatting and model boundaries; they are not the
reason SAT/UNSAT is asserted. Failed or incomplete independent certification
leaves new candidates UNKNOWN and exits nonzero. No timeout is treated as UNSAT.

## Reproduce

After normal [setup](../README.md):

```sh
npm run experiment:compact
```

This rebuilds candidates and independently certifies the baseline and all three
new combinations. `npm run check` includes all prior experiments and 17 focused
regressions. `npm run verify` verifies saved results without replacing them.
One fresh legal-group calculation is reused in that same process for unchanged
geometry, while every color/format/reserve matching is checked anew.

`results/format-comparison.json` is the complete machine-readable four-row
matrix, with language scopes, seven-ink witnesses, and verified reserve IDs.
Each language/case also has its own result file. No layout outside these explicit
changes or general English calendar-cube impossibility is claimed.
