# Monochrome reference: separate English and German investigations

**Scope:** These are the original one-color results. The subsequently required
row colors exclude the German construction. The current task results are in
[SINGLE_LANGUAGE.md](SINGLE_LANGUAGE.md): both colored variants are UNSAT.

| Case | Result | Scope |
| --- | --- | --- |
| EN alone | **UNSAT** | Wing-cubie counting, even with all glyph rotations allowed |
| DE alone | **SAT** | Fixed 150-sticker design; circular zero; exact legal-group completion |
| Combined EN+DE | **UNSAT** | Original 26-in-24 invariant-orbit contradiction |

The layout and abbreviation tables in [FEASIBILITY.md](FEASIBILITY.md) are
unchanged. Each single-language case may choose its own permanent printing.
The optical rules are shared between both languages, not a German exception.
The German result here concerns the original symbol/position specification with
one common printing color. The row colors are now binding for the task and
are checked separately; this monochrome SAT result is not a colored SAT claim.

## Optical equivalence without losing physical identity

Every physical sticker has its own ID and belongs permanently to its cubie.
A rotation transforms its position, normal, and printed-up vector together.
Glyph comparison is separate: an orientation is accepted if it is optically
equivalent for that same glyph. No `6`/`9`, `0`/`O`, or other character
substitution is used.

`src/Glyphs.res` defines the shared per-glyph quarter-turn sets:

* `0`: {0,1,2,3}, a centered circular ring; see [zero.svg](glyphs/zero.svg).
* Blank: {0,1,2,3}, empty printing.
* `O`: {0,2}, a centered elongated oval, visibly distinct from circular zero.
* `I`: {0,2}, a centered vertical bar.
* Separator `─`: {0,2}, a centered horizontal bar.
* Other characters: the construction uses their upright orientation, {0}.

Additional symmetries of other chosen glyphs would only add allowed states;
the positive proof does not rely on forbidding them. The English negative proof
is stronger still: it ignores optical orientation entirely. Thus allowing the
same circular zero, oval O, or other symmetries for English cannot evade it.

The earlier fixed-up argument is retained as **conditional evidence only** in
`uprightOnly` in the reports. It is not the primary result: once optical
symmetries are allowed, a sticker can sometimes serve multiple front roles.

## English: a complete orientation-free impossibility proof

Call the positive-chirality sticker on each wing A and its other sticker B.
There are 24 physical wing cubies, hence 24 paired A/B sticker positions. A
front wing cubie exposes one sticker to the front, never both simultaneously.
The A front roles are weekday second letter, month third letter, separator,
and minute tens. B roles are blank, day tens, separator, and hour units.

For each side and symbol, independently compute its largest simultaneous
multiplicity over the actual English dates and times. Call these lower bounds
`mA(s)` and `mB(s)`. Summing them gives:

* A needs 23 stickers: 22 distinct symbols, with `R` twice.
* B needs 16 stickers: digits 0–3 twice each, digits 4–9 once, blank and dash once.

These bounds alone fit within 24 and do **not** prove impossibility.
The contradiction comes from their paired physical cubies.

For a putative immutable design call a symbol **tight** on a side if its
printed supply equals its required maximum. Every sticker of that symbol is
forced onto the front whenever that maximum occurs. A loose (non-tight)
symbol has at least one surplus sticker; unused glyphs are surplus too.

### At most three non-tight A stickers

A has only `24−23=1` spare sticker. At most one required A symbol can have
surplus supply. Its largest required multiplicity is two (`R`), so at most
three A stickers are non-tight. If the spare sticker instead bears an unused
glyph, only that one is non-tight. This exhausts arbitrary immutable printings,
not merely the candidate layouts found by a search.

### Almost every pair of tight symbols conflicts

Enumerating actual calendars, not independent weekday/month guesses, confirms:
for every A symbol and B symbol, their required maxima can occur in the same
display, with just one exception: A=`B` (February) and B=`3` at its maximum
(two copies, requiring a day in 30–39 and hour units 3). February has no such day.
The full joint wing projection has 14,040 patterns, preserving all relevant
calendar/time correlations. `scripts/verify_single.py` rebuilds that relation
independently using Python's Gregorian calendar.

Therefore a tight A sticker cannot share a physical wing with a tight B
sticker, except possibly the one A=`B` sticker paired with a B=`3` sticker.
Indeed, the simultaneous-max display would force both stickers of one cubie
to appear on the front. That is physically impossible, regardless of glyph
rotation. There can be at most one exceptional pair because A requires only
one `B` sticker when tight.

### Both possibilities for B=`3` contradict the available pairings

B has eight spare stickers beyond its 16-sticker lower bound. Making a symbol
non-tight costs at least one spare. With eight spares, at most eight required
symbols can be made non-tight. To minimize remaining tight B stickers, spend
those spares on symbols with the largest required multiplicities first.

| B=`3` supply | Largest required inventory made loose | Tight B stickers still forced | Available compatible partners |
| --- | ---: | ---: | ---: |
| Non-tight | 4×2 + 4×1 = 12 | At least 16−12 = **4** | At most **3** loose A stickers |
| Tight | 3×2 + 5×1 = 11 | At least 16−11 = **5** | At most **3+1=4**, including the exception |

Both cases are impossible. Unused glyphs or spending multiple spare stickers
on a symbol cannot improve either bound. Hence **English is UNSAT**, even in
the relaxation that accepts every in-plane orientation of every glyph.

## German: one fixed physical design

`results/german-monochrome.json` contains all 150 immutable stickers, their source cubie
positions, outward normals, printed-up vectors, and symbols. `targetSlots` and
`packings` are explanatory aids, not trusted by the verifier. All stickers,
including blanks, separators, hidden stickers, and fixed centers, are present.

The wing construction exploits the smaller German inventory (A=21, B=16) and
a circular zero. Here is its entire 24-piece A/B printing in front-role notation.
Coordinates below are 1-based. Each row with several values represents separate
physical wing cubies, never reassignment of a sticker between states.

| A-side role and symbols | B-side role and symbols | Cubies |
| --- | --- | ---: |
| Separator, `─` twice | Hour units `1`, `2` respectively | 2 |
| Weekday second, `O` twice | Hour units `3`, `4` respectively | 2 |
| Weekday second, `I` twice | Day tens `1`, `2` respectively | 2 |
| Month third, `B` | Day tens `3` | 1 |
| Month third, `N`, `R`, `I` | Circular `0` on each, usable at day tens or hour units | 3 |
| Weekday second, `A`, `R` | Blank on each | 2 |
| Month third, `L`, `G` | Separator on each | 2 |
| Month third, `P`, `T` | Hour units `5` on each | 2 |
| Month third, `V`, `Z` | Hour units `6` on each | 2 |
| Minute tens, `0`, `1` | Hour units `7` on each | 2 |
| Minute tens, `2`, `3` | Hour units `8` on each | 2 |
| Minute tens, `4`, `5` | Hour units `9` on each | 2 |
| Total | | **24** |

Why the critical parts work:

* The B-side singleton pairs on duplicated A tokens are mutually exclusive:
  one hour cannot have units 1 and 2 (or 3 and 4), and day tens cannot be 1 and 2.
* Day tens 3 never coincides with February's `B`.
* The three B-side circular zeros are paired with distinct month-third tokens.
  At most one can be blocked by that display's A-side month sticker, leaving
  two zeros available when day tens and hour units both need zero.
* Day tens `(2,1)` and hour units `(5,2)` differ by a quarter-turn within this
  sticker orbit. The circular zero makes exactly that optical reuse possible.
* Other duplicated B tokens are paired with distinct values of one A role,
  so at most one of the pair is blocked by the A-side requirements.

Corners and middle edges use small deterministic packing searches followed by
exhaustive verification, not success-by-timeout reasoning. Axial and diagonal
centers each receive a fixed sticker for every needed role/symbol combination.
The front fixed center is circular zero; the other five fixed centers are blank.

The independent verifier derives permitted poses from the actual sticker
geometry and glyph symmetry table, not from the listed intended roles. It checks
all distinct projections:

| Physical class | Complete projected targets checked |
| --- | ---: |
| Corners | 120 |
| Middle edges | 40 |
| Wings, both coupled sides together | 9,360 |
| Axial centers | 24 |
| Diagonal centers | 70 |

Every matching uses different physical cubies for different front positions.
This verifies the local cover, but is not yet sufficient for SAT. The following
completion argument is the separate, necessary physical-reachability step.

## Why all class matchings have a simultaneous legal completion

The independent verifier constructs the 150 labeled sticker slots directly
from the integer lattice. Twelve legal single-layer quarter turns generate a
finite permutation group G. Fixed-center **positions** stay fixed; their actual
spins are harmless because zero and blank are quarter-turn invariant.

Let the five local projections be corners C, middle edges M, wings W, axial
centers A, and diagonal centers D. The wing projection acts on the 24 positive
stickers; the negative sticker is not free: the same cubie motion determines it.
The exact local orders computed by Schreier–Sims are

```text
|C| = 8! × 3^7
|M| = 12! × 2^11
|W| = |A| = |D| = 24!
```

Necessary permutation signs are checked on every generator:

```text
sign(C) = sign(M) = sign(D)
sign(A) = sign(C) XOR sign(W).
```

Let U be the subgroup of the direct product of the actual five local groups
satisfying those three independent sign equations. Thus

```text
|U| = |C| |M| |W| |A| |D| / 8.
```

Clearly G maps into U. This map is faithful: corners, edges, and centers retain
all labeled stickers; for a wing its other sticker is fixed by its coupled
rigid orientation. The exact full-group order is independently calculated and
**equals |U|**, proving G fills this entire parity-compatible product. An order
comparison here proves equality of finite groups, rather than merely checking
some necessary invariants or a handful of example states.

For each local group, the verifier constructs its physical-permutation-even
subgroup by Schreier's two-coset method. It checks that this subgroup is
transitive on **all ordered partial placements needed by the front**:

* Four corners, including all three orientations: orbit size `(8)_4 × 3^4`.
* Four middle edges, both orientations: `(12)_4 × 2^4`.
* Eight distinct wing cubies: `(24)_8`.
* Four centers in each center orbit: `(24)_4`.

Here `(n)_k=n!/(n−k)!`. The orbit sizes are computed exactly as group order
 divided by the pointwise-stabilizer order of the front tuple. They reach the
maximum possible number of distinct-piece oriented placements. Therefore any
local matching verified above can be completed using an even local permutation.
All five completed permutations have even signs and so belong together to U=G.
Consequently they have a **common legal move realization**, not merely five
separately possible states. No move-sequence optimization or color-equivalence
assumption enters this proof.

The 150-slot model loses no hidden glyph orientation for nonfixed pieces: the
verifier enumerates proper cube rotations and checks that source and destination
position/normal uniquely determine the in-plane tangent. Fixed-center spins
were already handled by the rotationally invariant printing. Thus the argument
covers complete labeled physical configurations, including their optical poses.

This proves German SAT for all **15,779,520** date/minute displays with one fixed
printing. Class projection reduction is sound because the local completions
compose for every tuple; in particular they compose for each actual calendar
date and minute. The font witness is part of this construction, not a rule
that would be denied to English.

## Reproduction

Prerequisites: Node ≥22, npm ≥10, Python ≥3.10, and pinned SymPy 1.14.0.
A local environment can reuse already installed system packages:

```sh
python3 -m venv --system-site-packages .venv
. .venv/bin/activate
python3 -m pip install --cache-dir /tmp/cubistry-pip-cache -r requirements-verifier.txt
npm ci --cache /tmp/cubistry-npm-cache --ignore-scripts
npm run check
```

`npm run check` runs nine focused regression tests, regenerates all results,
independently verifies EN then DE, and rechecks the original combined proof.
The full exact group calculation takes approximately 30 seconds on the current
machine. `npm run verify` rechecks the saved certificates independently.

To regenerate these one-color references use `npm run experiment:en` or
`npm run experiment:de`; the current colored results are produced by the full check. A German candidate starts as UNKNOWN; only successful
independent design **and group** verification writes SAT and the reachability
certificate. A timeout or failed group/matching check cannot write SAT or UNSAT.
The strict-up-only contradiction remains explicitly conditional in both files.

The Python verifier imports none of the JavaScript/ReScript geometry, date,
matching, or group code. It uses its own lattice, Rodrigues rotations, calendar,
rigid-pose matching, and exact SymPy group calculations. The result stores exact
orders and orbit sizes for reproducible checking. It does not supply a shortest
move sequence; group membership and the constructive completion theorem supply
the required existence proof.

No layout, abbreviation, cubie connectivity, physical sticker identity, or
printing is changed between displays. No frontend or generalized engine was
introduced.
