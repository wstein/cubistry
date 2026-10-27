# Leading day space: German SAT with the original row colors

A later [new zero-padded-day wordmark construction](ZERO_DAY_WORDMARK.md) is SAT
with distinct red date and blue time inks and blank outer logo cells. Earlier
negative claims here retain their original five-dash-layout scope.

The completed [four-format matrix and proof review](COMPACT_FORMAT.md) additionally compare hour padding and short separators, including scoped EN/DE outcomes and verified reserves.
Replacing `03OKT` with ` 3OKT` changes the answer for German:

| Day style | Date and time digit inks | DE | EN |
| --- | --- | --- | --- |
| `03OKT` | Separate, original red / blue | UNSAT in the documented glyph model | UNSAT |
| `03OKT` | Shared digit ink | SAT | UNSAT |
| ` 3OKT` | **Separate, original red / blue** | **SAT** | UNSAT |

Combined DE+EN remains UNSAT because the English requirement alone is impossible,
even without colors. All day-padding results are independently recalculated;
the old zero-padding impossibility proof is not blindly applied to a new display.

## Exact new display rule

Only single-digit days change. Days 1–9 receive a leading blank, days 10–31
remain two digits. Month, weekday, year, separators, time, abbreviations,
languages, and the valid 2020–2049 date range retain their previous meanings.
The front still has exactly five rows of five stickers. For example Saturday,
October 3, 2026, at 14:37 is

```text
SAM··
·3OKT
·2026
─────
14:37
```

Here `·` is an unprinted blank, not a dot glyph. Day units still require a red
zero for dates 10, 20, and 30; those are diagonal-center stickers. It is the
**day-tens wing position** that no longer requires a red zero.

The original zero-padded mode remains available and its results remain scoped
to it. The explicit `dayPadding: "space"` field identifies the new certificates.

## Why the original colors now work

The earlier obstruction came from immutable colored printing on paired wing
stickers. A red date zero and a blue hour zero cannot be the same printed sticker.
But a leading day **blank** has no ink and is optically identical to the existing
weekday blank under all rotations. Those two roles are in the same wing-sticker
orbit, and may now share unprinted physical stickers.

A fixed modification of the existing German design suffices:

* Three wing stickers that carried the shared circular zero become unprinted
  blanks. Their IDs are **28, 53, 71**. They can cover weekday blank `(1,4)`
  and leading-day blank `(2,1)`. At most one of these three cubies is needed
  for the A-side month letter, leaving two available when both blanks show.
* Two wing stickers that carried the weekday blank become **blue hour-only
  zeros**, IDs **30 and 121**. Their paired A stickers are different weekday
  letters, so at most one is blocked; one blue hour zero remains available.
* Every other sticker keeps its source cubie, outward normal, glyph, and print
  direction. Permanent ink is assigned to its display role once, not recolored
  between states.

This is a new fixed printing, not a manual sticker swap between dates. Its
full 150-sticker assignment is in `results/german-space-padded.json`.

The target colors are unchanged from the user's latest table: weekday dark,
day/month red, year gray, separators gray, time digits blue, colon red. The
independent verifier also checks that separators may independently retain the
lavender ink of the earlier image, with every other target color unchanged.
**No date/time ink merger is required.**

## Physical reachability and complete coverage

The independent verifier uses its own Python Gregorian calendar and integer
cubie geometry. It formats days 1–9 with a real space, enumerates all target
projections, matches symbol **and immutable ink**, and requires distinct physical
cubies at distinct front positions. Both wing sides remain coupled throughout.

It then applies the freshly verified exact legal-group completion theorem
from [MONOCHROME.md](MONOCHROME.md). The physical 5×5 move group, front positions,
and oriented partial-placement coverage have not changed; only required symbols
and their printing changed. The group is recomputed once in the current process
and reused for these new colored matchings. No serialized old SAT status is
accepted instead of that verification.

All 10,958 dates and 1,440 minutes are covered, yielding **15,779,520 German
displays with one immutable printing and a legal full-state completion**.
This is not merely an example front face or an inventory estimate.

## Which characters need rotation now?

The quarter-turn **reuse has moved from printed zeros to blanks**. Empty stickers
look identical in every orientation. The verifier reruns the positive cover with
all nonfixed printed characters, including zero, restricted to upright display
poses, and it passes. No sideways digit or letter on a movable front cubie is
required by this construction.

The front fixed center is still the circular zero from the shared glyph model.
Its spin is optically invisible; the other fixed centers are blank. The result
does not claim to have removed every zero-symmetry assumption from the full
physical model or to have verified a different nonsymmetric fixed-center font.

As before, **source printing angle is different from display angle**. A letter
may be printed 90°, 180°, or 270° relative to its original face-up direction so
that it later reads upright. The new per-sticker plan, including immutable ink,
is [german-space-padded-printing.csv](../results/german-space-padded-printing.csv).
Every one of its 150 rows is independently checked against the physical design.

## English is still impossible

With space padding, the B-side maximum inventory requires two blanks instead
of two zeros; its total necessary inventory is still 16. The A total remains
23 with only one spare. Re-enumerating the actual simultaneous-max calendar
relations still gives just the February/day-30 exception. The two branches of
the orientation-free tight-inventory proof remain contradictory: at least four
B stickers need at most three partners, or five need at most four.

`results/english-space-padded.json` and the independent peak verifier record
this new calculation. It permits every glyph rotation and ignores colors,
so adding colors or choosing another allowed symmetric font cannot fix it.

## Commands

After the repository's normal setup:

```sh
npm run experiment:space-day
```

The German candidate starts UNKNOWN. Only successful independent colored
matching and common legal completion write SAT. `npm run check` also checks
all previous modes, palette variants, print angles, and 18 regression tests.
`npm run verify` validates saved results without replacing them.
