# Required row colors: English UNSAT, German UNSAT

The completed [four-format matrix and proof review](COMPACT_FORMAT.md) additionally compare hour padding and short separators, including scoped EN/DE outcomes and verified reserves.
The later [space-padded-day investigation](DAY_PADDING.md) separately proves DE SAT with original row colors for ` 3OKT`; the zero-padded findings here are unchanged.
The subsequent [palette investigation](PALETTE.md) gives the controlled German color relaxations and all required glyph/printing rotations.
The user made the reference image's row colors binding after the one-color
investigation. These are the current results for that complete requirement:

| Case | Result | Proven necessary number of wing cubies | Physically available |
| --- | --- | ---: | ---: |
| English only | **UNSAT** | At least 26 | 24 |
| German only | **UNSAT** | At least 25 | 24 |
| Combined DE+EN | **UNSAT** | Already impossible even without ink constraints | 24 |

No layout or abbreviation changed. The [one-color investigation](MONOCHROME.md)
is preserved separately: English is still UNSAT there, whereas German has a
fully certified SAT construction. **That one-color German construction does
not satisfy the binding colors.** Its circular zero cannot change ink color.

## Physical and optical conventions

A sticker's identity, printed symbol, ink, and attachment to its cubie are
immutable. Optically identical orientations of a glyph are equivalent, using
the same per-glyph symmetry model for both languages. However a red zero is
not optically equivalent to a blue zero.

The reference image assigns these distinct ink categories:

| Content | Ink |
| --- | --- |
| Weekday letters | Black |
| Day and month | Red |
| Year | Gray |
| Five separators | Lavender |
| Time digits | Blue |
| Colon | Red |
| Blanks | No ink |

The proof depends on the categories being different, not their exact RGB values.
It even permits **every rotation of every glyph**. This relaxation is broader
than any proposed font symmetry, so no choice of circular zero, symmetric O/I,
or separators can circumvent the impossibility below. No fixed-up assumption
is used, and no different character is substituted for another.

## The coupled wing counting proof

Use the invariant wing-sticker chirality from [FEASIBILITY.md](FEASIBILITY.md).
Each of the 24 physical wing cubies has exactly one A (positive) sticker and
one B (negative) sticker. They stay coupled. A front wing cubie exposes only
one of them to the front, never both simultaneously.

The A front roles are weekday second letter, month third letter, separator,
and minute tens. The B front roles are blank, day tens, separator, and hour
units. On each side, these four roles have different ink categories (with no
ink for the blank). Therefore **one printed colored symbol can serve only one
of these roles**, even when glyph rotations are completely unrestricted.

Count the distinct `(symbol,ink)` types needed in these roles over every actual
valid date and minute, separately for each locale:

| Side/role | EN types | DE types |
| --- | ---: | ---: |
| A: weekday second, black | 6 | 4 |
| A: month third, red | 10 | 10 |
| A: minute tens, blue | 6 | 6 |
| A: separator, lavender | 1 | 1 |
| **A total a** | **23** | **21** |
| B: day tens, red | 4 | 4 |
| B: hour units, blue | 10 | 10 |
| B: blank | 1 | 1 |
| B: separator, lavender | 1 | 1 |
| **B total b** | **16** | **16** |

Merely fitting a and b into 24 is necessary but insufficient. Cubie coupling
imposes a stronger condition.

### At least eight B types have only one printed copy

Suppose a common design with N=24 wing cubies existed. Let s be the number
of required B types printed exactly once. Every other required B type needs
at least two stickers. Even allowing unused printing, we must have

```text
N ≥ s + 2(b−s), hence s ≥ 2b−N = 8.
```

Thus at least eight B stickers are forced whenever their respective type is
required: there is no other physical copy to choose instead.

### Few A stickers can have a spare alternative

After allocating one sticker to each required A type, only `N−a` spares remain.
An A type printed more than once consumes at least one spare. The total number
of A stickers on such duplicated types, including any unusable extra printing,
is at most `2(N−a)`. To see this, a type with c≥2 copies contributes c stickers
but consumes c−1 spares, and `c ≤ 2(c−1)`. Unused stickers consume one spare each.

All remaining A stickers are unique copies of required types and hence forced
whenever their type is required.

### Only one possible exception to simultaneous demand

Independent enumeration of all Gregorian dates from 2020 through 2049 and all
minutes establishes that every A type can occur simultaneously with every B
type, except one pair:

```text
A: red B, the final letter of FEB
B: red 3, the day-tens digit
```

February has no day 30 or 31. The relation retains actual weekday/date/month
correlations. Hour units and minute tens are enumerated together, and every
minute is available for every date.

If a unique B sticker shared its cubie with a unique A sticker from a
co-occurring pair, the corresponding display would require **both stickers of
that same cubie on the front**. That is impossible. Consequently every unique
B sticker must be paired either with an A sticker having a spare alternative,
or with the sole exceptional type. There is at most one exceptional singleton
B type. Therefore

```text
s ≤ 2(N−a) + 1.
```

Combining both inequalities gives the necessary physical-cubie bound

```text
2b−N ≤ 2(N−a)+1
3N ≥ 2(a+b)−1.
```

For English a=23, b=16, this demands N≥26. For German a=21, b=16, it demands
N≥25. Both contradict N=24. Equivalently, at least eight singleton B types
would be needed, but at most three (EN) or seven (DE) can have compatible
partners. Thus both required colored variants are **UNSAT**.

These are necessary lower bounds, not claims that 25 or 26 pieces would be
sufficient, nor suggestions to modify the layout. Failure of the necessary
condition is itself the complete impossibility argument: no immutable printing
can satisfy all targets even before additional reachability restrictions are
imposed. All physically reachable complete states form a subset of this
already impossible relaxation.

## Verification and artifacts

`results/english.json` and `results/german.json` are the current color-aware
UNSAT certificates. `scripts/verify_colored.py` independently rebuilds the
colored domains, the exact calendar co-occurrence relation, and the counting
inequalities. It imports none of the JS/ReScript experiment implementation.
The independent lattice and legal-move checks in `scripts/verify.py` establish
the two wing-sticker orbits and their physical coupling.

The relaxed reference files are explicitly named `english-monochrome.json`
and `german-monochrome.json`. The latter retains the 150-sticker one-color
printing and exact full-group reachability certificate. It is not presented
as a solution to the color requirement.

Use the installation commands in [README.md](../README.md), then:

```sh
npm run check
```

This runs 18 focused tests, rebuilds all certificates, independently verifies
both current colored cases and the original combined impossibility, and checks
the preserved one-color references (including the approximately 30-second
exact group calculation). To check only the current color counting after
certificate generation, run `python3 scripts/verify_colored.py`.
