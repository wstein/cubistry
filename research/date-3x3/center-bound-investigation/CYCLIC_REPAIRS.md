# Equivalent cyclic repair boundaries

The fixed finite family has **52 enumerated candidate slots**: 14 shifts of the
clockwise-quarter word, 12 shifts of the half word, 12 shifts of its inverse,
and 14 shifts of the counterclockwise-quarter word. Repeated strings are harmless;
this does not claim 52 distinct algorithms. No inverse is added to a quarter
word's own family, because it would perform the opposite correction.

## Why cyclic shifts preserve the complete physical effect

An outer face turn fixes every center position and changes only an orientation
coordinate on its own center. These six center-orientation translations commute.
A pure-center kernel word K is identity on all ordinary cubies, so it commutes
with each outer face turn on both the ordinary and center representations.
For K=A B, the cyclic shift B A equals A^-1 K A=K. This argument applies to
outer-face prefixes, not arbitrary whole-cube conjugations, which permute centers.

The half-turn kernel is self-inverse on all 54 frames. Its inverse word and all
of that word's shifts therefore implement the same kernel. A quarter-turn
kernel is not self-inverse.

The independent Rodrigues checker validates all 52 slots and their inverses,
plus 156 arbitrary/global-prefix applications. It also checks all 18 possible
outer face boundary tokens for each of the three corrections (54 cases).
Both quarter words contain every face, so any nonempty ordinary prefix can
merge its last token with a suitable first repair token, saving at least one
HTM. The half word only contains F/U/D, so that one-move saving is not asserted
for arbitrary prefix faces. Five deliberately non-equivalent words are rejected.

## Exact retained-pose improvements

| Historical source | Before | Selected equivalent family member | After | Complete endpoint |
| --- | --- | --- | --- | --- |
| V3 portfolio row2467, German Apr19→20,2024 | 35HTM +2 rotations | Quarter shift6 | **34HTM +2 rotations** | All54 frames identical |
| V2 portfolio row2980, German Apr20→19,2024 | 41HTM +2 rotations | Inverse-half shift5 | **31HTM +2 rotations** | All54 frames identical |

The V3 source reference and every earlier physical state are reconstructed from
the actual consecutive stream, including reference compaction. Its maximum
21-HTM ordinary prefix ends B2; beginning the shifted repair with B merges that
boundary into B', reducing QTM52→50 as well as HTM35→34. The V2 inverse-half
choice begins F' and cancels the ordinary prefix's final F. The original direct
half substitution gave32; the expanded family gives31. These are pointwise
witnesses, not new full-year maxima. A fresh V4 capture is separate work.

With the published ordinary-cube20HTM bound, this composition would give an
existence bound of33 outer HTM for the calendar's one-visible-center goal:
20+14−1 for a quarter correction, at most20+12 for a half correction, and20
without a correction. Whole-frame alignment is separate. The current bounded
ordinary/center solver does not promise that bound; it may retain longer
heuristic routes. No universal21 bound or optimality claim follows.

## Correction to the earlier endpoint discussion

Independent checking now confirms that the original18/20/18 words and the
shorter14/12/14 words already have **identical complete54-frame transformations**
for their respective corrections. Both quarter versions turn the same hidden
back center. Earlier warnings that a quarter correction must retain its actual
hidden pose remain true, but an inference that swapping these particular
macros changes the endpoint was incorrect. Differences between V2 and V3 streams
come from changed candidate lengths/rankings and bounded search behavior, not
from a different group action of the corresponding repair itself.

The earlier witness files remain unchanged. This explicit addendum corrects
that interpretation without rewriting historical captures or proofs.

## Reproduce

```sh
python research/date-3x3/center-bound-investigation/verify-cyclic-repairs.py
```

The default input is the immutable V3 calendar capture. The validator uses only
the historical independent Python Rodrigues engine and capture helpers. See
[complete witnesses](cyclic-verification.json) and [input hashes](cyclic-manifest.json).
SAT means those finite transformations and route witnesses were validated;
shortest paths and global optimality remain UNKNOWN.
