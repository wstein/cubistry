# DE wing obstruction

This is a scoped research-local certificate. Independent native Julia and Flix
checkers accepted the exact same raw certificate, SHA256
`a567f89f2c13dcd37e3dc22507c49f96a27da510bec6efe8449f92db32b7129b`.
The existing canonical counter/state3 checker profiles do not support this new
format, so canonical profile confirmation is **UNKNOWN**, not claimed CONFIRMED.

## Exact scope

- 7×7 cube, separate German printing, Gregorian months 2026–2099.
- Week starts Monday; Saturday/Sunday dates are red and other dates dark.
- Three separate uppercase month letters: January–September in c5–c7,
  October–December in c1–c3. No printed year.
- Two headers and five date rows; sixth-week dates use the corresponding free
  first-week columns and carry the explicit `↶` marker.
- The stated artwork profile allows 6/9 half-turn reuse and the previously
  declared circular/bar/half-turn glyph symmetries. Other artwork stays fixed.
- Whole-cube rotations and a different physical front face are allowed.
- One immutable print must support every target. The proof rules out even a
  simultaneous physical front matching, before imposing legal-move reachability.

## Physical coupling

The inner wing-distance orbit contains **24 physical two-sticker cubies**. Each
has one sticker in surface orbit A = (-3,-1) and one in B = (-3,1), as independently
derived from the 24 proper signed-permutation rotations in `geometry_audit.jl`.

Front cells:

| Orbit | Cells (row, column) |
|---|---|
| A | (1,3), (3,7), (5,1), (7,5) |
| B | (1,5), (3,1), (5,7), (7,3) |

One physical cubie can fill only one front cell in any target state.

## Finite obstruction

1. Across the supported targets, each side needs 23 distinct oriented artwork
   classes. Every nonblank class has minimum multiplicity one; blank has minimum
   multiplicity two. Thus each side needs exactly **22 + 2 = 24 surfaces**.
   There is no room for a spare sticker of any class.
2. Exactly two physical wings therefore carry a B-side blank. To determine their
   possible A-side artwork, inspect every A class. If some target simultaneously
   needs all copies of that A class and both B blanks, such a pairing is
   impossible: its one cubie would have to fill two different front positions.
3. The certificate supplies concrete year/month peak witnesses excluding 20 of
   the 23 A classes. Only these three canonical artwork classes can face a B blank:
   `("1", 0, "red")`, `("27", 3, "dark")`, and `("6", 2, "dark")`.
   These are artwork/angle/ink signatures, not three interchangeable raw digits.
4. **November 2026 needs all three simultaneously:** Sunday 1 at r3/c7,
   Monday 9 at r5/c1, and Friday 27 at r7/c5. The 9 uses the allowed 6/9 artwork
   class; this reuse has not been omitted.
5. Each of these three A classes has exactly one physical copy. Consequently the
   two B-blank cubies must carry different A classes, and both must already show
   their A sides in those three required A cells. But the same November target requires a B blank at
   **r1/c5**. Neither cubie is available to fill it.

The contradiction is about coupled physical cubies, not a shortage in the separate
surface inventories: both separate capacities are exactly satisfied.

## Evidence and reproduction

`DE-blank-obstruction.tsv` contains the exact profile, 46 artwork classes and
minimum multiplicities, 20 exclusion witnesses, three remaining partners, and the
eight November front cells. Every record is canonical UTF-8 with LF endings.

```sh
julia --startup-file=no research/calendar-7x7/physical-review/geometry_audit.jl
julia --startup-file=no research/calendar-7x7/physical-review/blank_obstruction_certificate.jl check research/calendar-7x7/physical-review/DE-blank-obstruction.tsv
```

The Julia checker reads the raw certificate and regenerates its exact contents
from its own Gregorian targets and 3D rotation normalization. It imports no SMT
model, root target generator, root artwork function, or SAT solver.

The earlier `exhaustive_blank_pairing.jl` enumerated 45 possible blank-incident
patterns and found all failed, but that branch-completeness argument is not
needed for the smaller direct contradiction above. Its files remain as exploratory
evidence, not a competing proof authority.

Do not extend the claim to 2026 alone: its minimum inventories are A24/B23, leaving
one spare B surface, so the tight-inventory argument does not apply to that scope.
Do not extend it to English, another header placement, a new color policy, another
font-equivalence policy, or any general 7×7 calendar.
