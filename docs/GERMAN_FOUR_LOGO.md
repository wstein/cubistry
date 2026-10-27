# Four rightmost logo fragments, German 1900–2099: UNSAT

The requested change puts four separately printed upright full-image fragments
in **row 4, columns 2–5**, leaving column 1 blank. Under the otherwise unchanged
[German 1900–2099 baseline](GERMAN_BASELINE_1900.md), this model is **UNSAT**.
This is an impossibility proof over all immutable printings, not merely a failed
extension of the preceding printing.

## Exact scope

The five rows retain the German baseline's vocabulary, zero-padded red day and
month, split gray year `19 89` / `20 26`, zero-padded blue time digits, dark
weekday, and red colon. Every valid Gregorian date in 1900–2099 and all 1,440
times per date are required. Only row 4 changes:

```text
Before: blank | image 1 | image 2 | image 3 | blank
After:  blank | image 1 | image 2 | image 3 | image 4
```

The four fragments are complete fixed images, individually attached to physical
stickers, correctly ordered and upright in completed target states. Each includes
all internal pixels/colors; the fourth is a visible logo image distinct from a
blank or a numeric glyph. This proof does not assume the old image crops must
be preserved: new four-way crops and entirely new joint printing are allowed.
No production artwork has been generated or pixel-validated.

Columns 2–4 are center positions; column 5 is a **wing** position. Physical cubie
coupling therefore changes. The prior three-fragment SAT witness is unchanged.
No wider-century or bilingual experiment is part of this investigation.

## Independently checked physical contradiction

Every physical wing cubie carries one sticker from each of two invariant sign
orbits. There are only **24 such cubies**. The new generator and independent
standard-library Python checker separately enumerate all 73,049 dates and all
minute projections for the exact new layout. The checker also independently
rebuilds the 150-facelet physical lattice and verifies all twelve legal quarter
turns and each wing's two-sticker/sign coupling.

With the original colors, each wing image/ink identity serves one required type
within its sign orbit. The fourth image is one new B-side type. Unlike the old
model, B no longer needs two identical blanks simultaneously: its row-1 blank
and its row-4 logo are distinct image types. All required type peaks now equal 1.
The exact actual-calendar result is:

* A requires **21 distinct types** among 24 A stickers. With three surplus
  copies, at most six A stickers can have spare alternatives.
* B requires **16 distinct types** among 24 B stickers. At least eight B types
  must occur on a unique physical B sticker.
* The only peak-incompatible opposite-side pair is final B in FEB versus
  day tens 3. It can supply at most one exceptional pairing.

Each unique B sticker needs a physical partner on A. If that partner is also
unique and their demands coexist, that display would require two stickers of
the same physical cubie on the front. Thus at least eight unique B stickers
need partners among at most six nonunique A stickers plus one exception:

```text
8 > 6 + 1
```

For a hypothetical N-wing puzzle, the same singleton bound is
`2b−N ≤ 2(N−a)+1`, so `3N ≥ 2(a+b)−1 = 73`. Therefore this target set requires
**at least 25 physical wing cubies**, while the 5×5 has only 24.
The pooled sticker inventory alone would not prove this; the independently
verified cubie coupling and calendar co-occurrence are essential premises.

All glyph and image rotations are allowed in the negative proof. It therefore
excludes the requested upright artwork as well, without any fixed-up/font
symmetry assumption. A matching set of centers or a different hidden completion
cannot repair the wing contradiction. Changes to day padding, colors, logo
occupancy, or target coverage would be new models requiring new proofs.

## Reproduce and review

* [New candidate/model](../results/baseline-1900-2099/german-four-logo-candidate.json)
* [Independent proof output](../results/baseline-1900-2099/german-four-logo-verification.json)
* [Manifest and review controls](../results/baseline-1900-2099/german-four-logo-manifest.json)
* [Generator](../scripts/german-four-logo.mjs)
* [Independent checker](../scripts/verify_german_four_logo.py)

The generator reuses the existing ReScript calendar/year formatter. The checker
reuses the independently implemented proof method from the English review,
with its own German calendar data, explicit four-image cells, image ink role,
and exact model assertions; it imports no generator or research helper modules.
It checks the unit-multiplicity premise before reporting the 25-cubie bound.
The output and manifest record source hashes, software versions, and runtime.

```sh
npm run build
timeout 60 node scripts/german-four-logo.mjs > /tmp/german-four-logo-candidate.json
timeout 60 python3 scripts/verify_german_four_logo.py /tmp/german-four-logo-candidate.json > /tmp/german-four-logo-verification.json
cmp /tmp/german-four-logo-candidate.json results/baseline-1900-2099/german-four-logo-candidate.json
```

No external Python dependency or numerical solver is needed. Models with a
blank fourth crop instead of visible artwork, or a different calendar layout,
are outside this verdict. The original three-fragment baseline remains SAT.
