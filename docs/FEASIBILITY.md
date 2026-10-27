# Bilingual 5×5 clock/calendar feasibility: UNSAT

The completed [four-format matrix and proof review](COMPACT_FORMAT.md) additionally compare hour padding and short separators, including scoped EN/DE outcomes and verified reserves.
The later [space-padded-day investigation](DAY_PADDING.md) separately proves DE SAT with original row colors for ` 3OKT`; the zero-padded findings here are unchanged.
The subsequent [palette investigation](PALETTE.md) gives the controlled German color relaxations and all required glyph/printing rotations.
The required color-aware single-language cases are both UNSAT; see
[SINGLE_LANGUAGE.md](SINGLE_LANGUAGE.md). A one-color German SAT reference is
retained in [MONOCHROME.md](MONOCHROME.md). This page proves the combined-design
obstruction even without the additional ink constraints.

No single immutable sticker printing can satisfy the specified display for
both languages. A 24-sticker invariant orbit requires at least 26 stickers.
This is a finite counting impossibility proof, independently checked by Python;
it is not a timeout, unsuccessful search, or color-state approximation.

## Display and conventions

Front rows are weekday plus two blanks, two-digit day plus month, blank plus
four-digit year, five separators, and 24-hour `HH:MM`. For example:

```text
MON··
26OKT
·2026
─────
14:37
```

Here `·` illustrates a physical blank (U+0020), not a printed dot. The separator
is `─` (U+2500). Each letter, umlaut, digit, blank, dash, and colon occupies one
sticker. Uppercase abbreviations are these explicit three-codepoint conventions:

| Locale | Monday through Sunday | January through December |
| --- | --- | --- |
| DE | MON DIE MIT DON FRE SAM SON | JAN FEB MÄR APR MAI JUN JUL AUG SEP OKT NOV DEZ |
| EN | MON TUE WED THU FRI SAT SUN | JAN FEB MAR APR MAY JUN JUL AUG SEP OCT NOV DEC |

Gregorian dates 2020-01-01 through 2049-12-31 give 10,958 dates, including eight
leap days. Actual weekdays are used, never independently chosen. Both locales
and all 1,440 minutes give 31,559,040 required `(locale,date,minute)` triples.
These need not all produce different front faces. Locale is shared across all
rows of a display; the same fixed printing serves both locales.

## Physical model

`src/Geometry.res` labels all 150 stickers individually. No equal-color or
equal-symbol pieces are merged. Coordinates are integers from −2 through 2;
front is +Z, up is +Y, right is +X. Stickers carry an immutable ID, cubie
position, outward normal, and glyph-up tangent. All stickers on a cubie undergo
the same proper quarter-turn rotation. Thus cubie coupling, orientation, and
printed identities are preserved. Glyph-up rotates with its sticker; no dynamic
printing, letter substitution, or reinterpretation of rotated digits is allowed.

| Physical class | Cubies | Stickers | Front stickers | Pooled inventory lower bound |
| --- | ---: | ---: | ---: | ---: |
| Corners | 8 | 24 | 4 | 20 |
| Wings | 24 | 48 | 8 | 42 |
| Middle edges | 12 | 24 | 4 | 19 |
| Axial centers | 24 | 24 | 4 | 13 |
| Diagonal centers | 24 | 24 | 4 | 20 |
| Fixed centers | 6 | 6 | 1 | 1 |
| Total | 98 | 150 | 25 | 115 |

Only the front fixed center participates; it always displays `0` (the hundreds
digit of these years). The other five fixed-center stickers still physically
exist. The 115 estimate is independently reproduced as a necessary pooled
inventory bound, not as an attainable minimum printing or a feasibility proof.
Exact per-symbol multiplicities, including blanks and all five separators,
are recorded in `results/feasibility.json`.

Generators are positive quarter turns about X, Y, Z for layers −2, −1, +1, +2;
inverses are cubes of these turns. Central slices in the fixed-core convention
can be represented using whole-cube rotations and other layers. The invariant
below is preserved by central slices and whole-cube rotations as well, so
allowing either cannot evade the obstruction.

## The wing-sticker invariant

For a particular sticker on a wing cubie, write its position as

```text
p = 2n + 2m + q
```

Here `n` is that sticker's outward unit normal, `m` is the other sticker's
outward unit normal, and `q` is the remaining signed unit-axis direction (the
wing's depth offset). All three are orthogonal. Define

```text
χ = det(n, m, q) ∈ {+1, −1}.
```

Every physical layer turn applies a proper rotation to `p`, `n`, `m`, and `q`.
Since its determinant is +1, it preserves χ. Every wing has one sticker of
each sign: exchanging `n` and `m` negates the determinant. Thus there are
exactly **24 stickers of each sign**, permanently, for every possible printing.
A wing cannot be independently flipped to exchange these stickers.

On the front face, the χ=+1 slots are these 1-based `(row,column)` positions:

| Position | Required content |
| --- | --- |
| (1,2) | Second letter of weekday |
| (2,5) | Third letter of month |
| (4,1) | Separator `─` |
| (5,4) | Minute tens digit |

The other four wing positions have χ=−1. Exhaustive connected components of
the twelve geometric generators independently reproduce two 24-sticker wing
orbits, with these front positions. This is a statement about labeled physical
stickers, not interchangeable face colors.

## The contradiction: 26 > 24

The weekday-second symbols required by the two locales are
`A E H I O R U` (7). The month-third symbols are
`B C G I L N P R T V Y Z` (12). Their intersection is `I R`, giving 17 distinct
letters in this single 24-sticker orbit.

Both overlapping letters must be printed **twice**, because they are required
simultaneously in separate slots:

* DE Tuesday, 2020-05-05: `DIE` and `MAI` require two `I` stickers.
* DE Friday, 2020-03-06: `FRE` and `MÄR` require two `R` stickers.

These are actual weekday/date relationships in the specified range. Hence at
least 19 letter stickers are needed in that orbit. Minute tens additionally
requires each of `0 1 2 3 4 5`, and the separator requires `─`:

```text
17 distinct letters + 2 extra copies + 6 digits + 1 separator = 26 > 24.
```

The sum counts permanent inventory across the family of displays; it does not
claim all 26 symbols appear in one display. Each symbol must exist on its own
physical sticker, and simultaneous duplicates require separate physical
stickers. No assignment of printing to the 150 stickers can meet even this
necessary condition. Therefore the existential design quantifier fails.
This proves the requested **combined DE+EN UNSAT** result. No single-language
feasibility claim is made or needed.

## Other reachability constraints

Corners and middle edges also have orientation-sum restrictions (modulo 3 and
2 respectively). Wings have position-dependent orientation and cannot flip
freely; centers preserve axial/diagonal class. Fixed centers retain their
positions and can rotate their markings. The executable model retains these
rigid transformations instead of permitting independent sticker reassignment.

Permutation-sign evidence is generated and independently checked for every
layer generator. Writing signs as bits, every reachable state necessarily has

```text
parity(corners) = parity(middleEdges) = parity(diagonalCenters)
parity(axialCenters) = parity(corners) XOR parity(wings).
```

These follow from the recorded generator signs and composition of permutation
parity. They are not asserted to be a complete labeled-state criterion.
Upright glyphs and additional whole-state constraints only restrict states
further. Our contradiction already holds after dropping those constraints;
therefore it applies to all complete physically reachable configurations.
No arbitrary-state reachability validator, design synthesis, or move optimizer
is required for this negative proof.

## Reproduction and independent verification

Prerequisites: Node ≥22, npm ≥10, Python ≥3.10, and SymPy 1.14.0
for the additional single-language verification. ReScript is pinned to 12.3.1.
From the repository root:

```sh
python3 -m venv --system-site-packages .venv
. .venv/bin/activate
python3 -m pip install --cache-dir /tmp/cubistry-pip-cache -r requirements-verifier.txt
npm ci --cache /tmp/cubistry-npm-cache --ignore-scripts
npm run check
```

`npm run check` compiles ReScript, runs 17 focused Node regression tests,
regenerates `results/feasibility.json`, and executes `scripts/verify.py`.
The combined check takes seconds; the full single-language group verification
takes approximately 30 seconds. No service, credential, numerical solver,
or heavyweight testing framework is needed. Exit code zero means verification succeeded;
read the result's `status` field for the mathematical outcome.

The Python verifier imports none of the ReScript/JavaScript implementation.
It uses Python's Gregorian calendar, separately hardcoded locale conventions,
and an independently constructed integer lattice with Rodrigues rotations.
It checks all date and minute projections, both wing inventories, all sticker
components, cubie counts, and generator permutation signs. It also enumerates
the Cartesian product of the critical date/time projections as a separate
check on the inventory reduction. Corrupt certificates cause nonzero exits.

The reduction preserves the simultaneous rows: for each symbol and orbit,
`max_(locale,date,minute)(dateCount + timeCount)` equals
`max_(locale,date)(dateCount) + max_minute(timeCount)` because every minute is
required for every date/locale. Weekday/month/day correlations stay intact.
This computes a necessary bound, not a sufficient condition for any display.

## Assumptions and limitations

A sticker bears one immutable symbol. Symbols are distinct, legible uppercase
glyphs; blanks and separators are real stickers. No multi-symbol, lenticular,
repaintable, replaceable, or position-dependent printing is allowed. Turns are
physical rigid cubie moves, with no disassembly or independent wing flips.
The proof even permits arbitrary glyph rotations without identifying different
symbols, so the stricter upright requirement cannot restore feasibility.

The conclusion depends on the explicit abbreviations and exact layout above.
Changing either may change the bound and requires a new investigation. This
spike does not establish the feasibility of any modified layout or either
single-language variant. It provides a sound impossibility proof for the
requested common printing, rather than a general 5×5 reachability solver.

## Reference inspection and attribution

Inspected these revisions (no source copied):

* [CubeLab](https://github.com/wstein/cubelab/tree/89053d06df0a992acf68506d0dec5082c71dfaab),
  especially `src/Move/MoveExecutor.res` and `docs/state-validation.md`.
  Its coordinate/normal approach informed the independent geometry model.
* [cube-assembler](https://github.com/wstein/cube-assembler/tree/d62d1715e041c6b808fcce08c597fcb4a3ce5c98),
  especially `docs/parity.md`, which documents limits of color-based checks.
* [cubacle](https://github.com/wstein/cubacle/tree/233045908fe3b3a2ef5e57e410549d438614c820),
  especially `docs/design/5x5-port.md`, for physical class terminology.

No solver code, tables, or color-only reachability conclusions were imported.
This implementation remains AGPL-3.0-or-later under the repository license.
