# Independent physical review of four 3×3 calendar proposals

Verdict: **SAT** for each exact immutable print `de-2`, `de-3`, `en-2`, and
`en-3` under [model-v2.json](../model-v2.json). This verdict follows independent
replay of 10,248 complete legal move witnesses, not capacity arithmetic,
generator assertions, inventory matching, or the generated concept image.

## Frozen claim

Each proposal has 54 immutable fragment/digit images on eight rigid corners,
twelve rigid edges, and six centers. A blank is an actual unprinted sticker;
its physical print-up vector has no visible meaning. Every nonblank fragment
and digit must be upright in the fixed front observation frame. Legal moves
are the 18 outer-face turns plus explicitly recorded whole-cube x/y/z turns.
There are no mid-sequence sticker replacements or optical rotational aliases.

- German: weekday above, two-digit day in the middle, month below. The day row
  is blank/tens/units, with a leading zero.
- English: weekday above, three individual month letters in the middle, day
  below. The day row is tens/blank/units, with a leading zero.
- Weekday names have the specified two or three letters, assembled from fixed
  fragments. They start in the left column. Two-letter names leave the third
  cell blank. In some proposals a whole weekday occupies the first sticker.
- The lexicons and fragment partitions are exact. The old single-character
  model and its original English row order are not the scope of this verdict.
- The four proposals are separate prints. An unrestricted combined-language
  print remains **UNKNOWN**; the verdict does not generalize to it.

The checker hardcodes the German and English weekday/month lexicons rather
than importing the generator's model. It checks that every candidate fragment
partition rejoins the exact word, and that the English month is always three
individual middle-row letters. Source body positions, outward normals,
tangent print frames, piece inventories, immutable token assignments, and
upright slot invariants are all checked against the constructive definitions.

## Independent physical evidence

`verify_witness.py` uses only the Python standard library and its own integer
Rodrigues rotations. It imports no solver, generator, JavaScript, or project
geometry. All 54 sticker identities, body identities, positions, outward
normals, print-up vectors, and immutable images survive every actual move.

The checker independently enumerates all 146,097 dates in Gregorian
2000–2399, obtaining exactly 2,562 distinct weekday/day/month patterns. Each
candidate supplies that exact set once: all seven weekdays for each of the
366 possible month/day combinations, including February 29 and no invalid
dates. The 400-year cycle repeats; no displayed year is part of the claim.

| Exact proposal | Verified date patterns | Outer-face HTM minimum–maximum | Mean source-to-display HTM |
| --- | ---: | ---: | ---: |
| de-2 | 2,562 | 16–41 | 33.7088 |
| de-3 | 2,562 | 15–41 | 33.1241 |
| en-2 | 2,562 | 14–41 | 33.7240 |
| en-3 | 2,562 | 13–41 | 33.7162 |

These counts include each saved center correction, count half turns as one
HTM, and exclude separately recorded whole-cube preludes of zero to three
tokens. They are existence-witness costs, not shortest paths, consecutive-day
costs, or optimization certificates.

For every target, the checker derives all nine expected cells independently
from the lexicon, day digits, and user-confirmed row order. It replays the
whole-cube prelude, outer-face word, and center correction, then checks the
exact front image and upright vector of every nonblank sticker, **including
the visible center**. Reversing all three words restores the complete original
54-sticker state in all 10,248 cases.

The three separate center helpers also pass independent replay. They take
18, 20, and 18 HTM; turn the visible center by 90, 180, or 270 degrees; and
restore every noncenter identity and physical frame. Their inverses restore
all 54 source frames. Hidden center orientations remain unconstrained.
Thus the result does not rely on a normal 3×3 solver silently ignoring center
print orientation.

The exact witness and constructive hashes, per-proposal results, center
helper outcomes, checker hash, and model hash are in
[verification.json](verification.json). The saved generator metadata may
still say UNKNOWN because it predates this independent acceptance; the SAT
verdict applies specifically to the artifacts pinned by those hashes.

## Reproduction and adversarial controls

From the Research branch root:

```sh
python3 research/date-3x3/verify_witness.py research/date-3x3/witnesses/de-2.json
python3 research/date-3x3/verify_witness.py research/date-3x3/witnesses/de-3.json
python3 research/date-3x3/verify_witness.py research/date-3x3/witnesses/en-2.json
python3 research/date-3x3/verify_witness.py research/date-3x3/witnesses/en-3.json
python3 -m unittest discover -s research/date-3x3 -p 'test_verify_witness.py' -v
```

All four full validators and four unittest methods pass. The tests reject 20
corruptions, including altered physical identities, images and frames, wrong
source-slot assignments, missing/duplicate/invalid calendar targets, lost
leading zeros, incorrect row order, illegal notation, an outer turn hidden
in a whole-cube prelude, a whole-cube rotation hidden in an outer-face word,
and removal of a required visible-center correction. A positive control
reverses every blank sticker's otherwise fictitious up vector; all 2,562
German two-letter targets still pass, confirming that unprinted blanks are
not accidentally treated as oriented text.

## Findings and limits

No unresolved physical-proof findings remain for these four exact candidates.
The center-orientation concern raised during review is resolved by actual
center-corrected legal words and the independent upright-center checks.

The four-panel concept was visually inspected: its sample cells agree with
the specified Wednesday/08/JUL layouts. It is an illustrative raster concept,
not a final print sheet or proof of all-date typography. Fragment-dependent
spacing, production artwork, print dimensions/font provenance, device timing,
application implementation, and daily move optimization remain separate work.
The five-move bound for the unrelated 2×2 counter is not applicable here.
No merge, deployment, application change, or GitHub write was performed by
this reviewer.
