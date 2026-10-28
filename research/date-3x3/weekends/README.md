# Fixed weekend color and weight

The new requirement is a fixed red, extra-bold (800) display for **all characters**
of Saturday and Sunday, in German and English. Other weekday characters retain
their dark 600 artwork, month letters retain brown 600, and day digits retain
green 600. Sticker images remain immutable under legal turns; an on-screen date
style override is forbidden. This investigation starts at Research `6714710`.

## English 3

The selected English print uses whole weekday abbreviations on individual corner
stickers. SAT is source sticker 20; SUN is source stickers 33 and 40. All three
can receive permanent red 800 images without changing a geometric assignment,
target layout, or any saved move word. No regular weekday shares these stickers.
The feature implementation must update both SUN copies, the local licensed font,
SVG source artwork, preview textures, and integrity/visual regressions.

## German A: conditional UNSAT

The existing O at source sticker 3 is used for MO, DO and SO. Recoloring it would
also recolor ordinary Mondays and Thursdays. This alone rules out recoloring the
unchanged print, but does **not** rule out a newly assigned print. The following
stronger obstruction does, for exactly the selected layout and retained styles.

The machine-readable [model](model.json) fixes German A's front rows to weekday /
day / month, one character per field. Its four front **edge** positions need:

| Edge field | Mandatory different permanent images | Count |
| --- | --- | --- |
| Weekday right | dark O/I/R; red bold A/O | 5 |
| Month middle | brown A/E/Ä/P/U/K/O | 7 |
| Day units | green 0–9 | 10 |
| Day-row left | Unprinted blank | At least 1 |

The colors/weights are part of image identity. In particular, a brown month O
cannot serve as a dark weekday O or red Sunday O. The generator enumerates all
146,097 dates in 2000–2399 and retains a representative date for each of all
**350 = 5 × 7 × 10** simultaneous active-field combinations. The separate checker
recomputes this using integer Gregorian weekday arithmetic, not `datetime`.

A 3×3 has 12 two-face edge bodies: 24 edge stickers. Every simultaneously visible
front edge must come from a different physical edge. Relax orientation, legal
permutation parity, corner constraints, centers and reachability completely; if
this relaxed edge assignment is impossible, a real cube is also impossible.

There are 22 mandatory, distinct nonblank images. Let k count unprinted edge
faces. All possibilities are exhausted:

1. **k = 0:** the mandatory blank edge cannot be displayed.
2. **k = 1, or k = 2 on one body:** every active image is required together with
   the blank. Remove the sole blank-bearing body: all 22 mandatory images must
   remain on the other 22 faces, exactly once. Different fields cannot share a
   body, since every pair from different fields occurs together in some target.
   Therefore each body must pair images from the same field. Field sizes 5 and 7
   are odd, making such a pairing impossible. This argument allows an arbitrary
   image or a duplicate on the other face of the removed body.
3. **k = 2 on different bodies:** all 22 nonblank faces must be the 22 mandatory
   images, once each. Let x and y be the other faces of the two blank bodies.
   If x and y are from different fields, some target needs both, occupying both
   blank bodies and leaving no blank available. If they belong to the same
   field, remove them. All remaining bodies must again pair within their fields;
   subtracting two leaves the same odd parities. The certificate retains all
   231 partner pairs: 155 cross-field conflicts and 76 same-field parity cases.
4. **k ≥ 3:** 22 mandatory images plus 3 blanks already require 25 faces, beyond
   the 24-face budget.

Thus **UNSAT under this exact German A layout/style model**. The result is not an
impossibility theorem for arbitrary German calendar layouts, changed palettes,
word fragments, optical aliases or movable fields. It does not change or revoke
the earlier uncolored German A SAT witness. Independent review is pending before
public delivery of this new conclusion.

## Reproduction

```sh
python3 research/date-3x3/weekends/generate-certificate.py
python3 research/date-3x3/weekends/verify-certificate.py
python3 -m unittest discover -s research/date-3x3/weekends -p test_certificate.py
```

[certificate.json](certificate.json) retains date representatives and the finite
blank-case split. The checker imports no generator or solver and rejects changed
layouts, palettes and edge budgets. Negative controls also remove domain and
partner cases and corrupt cardinalities. There is no timeout-based UNSAT claim.

## Choices requiring a new user decision

- Keep German A exactly as selected: its fully red SA/SO requirement cannot be
  met with permanent images. Coloring only the leading S would be an explicit
  partial highlight, not the requested full-word red treatment.
- Permit a different German layout or controlled word fragments: feasibility
  remains **UNKNOWN** until a new candidate, full witness and independent check
  are supplied. No replacement is silently selected here.
- English 3 supports the complete red/bold treatment on its existing print.
