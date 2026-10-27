# Three-sticker wordmark: German SAT

A later [new zero-padded-day wordmark construction](ZERO_DAY_WORDMARK.md) is SAT
with distinct red date and blue time inks and blank outer logo cells. This page
retains its original space-padded-day scope and reserve certificate.

The preferred German design remains **SAT** when its three interior separator
stickers are replaced with the supplied wordmark as three separate, upright
image fragments. This is a newly verified branding extension, not an automatic
consequence of the earlier separator result.

Scope: space-padded dates (` 3OKT`), two-digit hours (`09:37`), blanks at the
ends of row 4, the established 2020–2049 calendar/minute requirements, and the
same calendar/time ink categories and glyph conventions as the preferred design.

## Target and physical pieces

The front's fourth row is five sticker-sized images:

```text
blank | wordmark:left | wordmark:middle | wordmark:right | blank
```

The three images together carry `CHRONOCUBE`, `TIME IN MOTION`, and the upward
arrow from the reference. Each image is a **full immutable texture**, including
its internal pixels/colors, not a single letter or an average ink color.
They must be physically separate prints; no film bridges a cut between cubies.

| Front target (1-based) | Fragment | Physical class | Fixed source sticker ID |
| --- | --- | --- | ---: |
| (4,2) | Left | Diagonal center | 6 |
| (4,3) | Middle, including upward arrow | Axial center | 32 |
| (4,4) | Right | Diagonal center | 8 |

The middle logo cell is **not** the fixed face center. The latter is at (3,3)
and still displays the circular year zero. Each logo sticker belongs permanently
to its own center cubie and participates in that center orbit's permutations.
The verifier checks those competitions together with the date/month/year
center requirements, rather than assuming a logo can simply remain in place.

Only the three dedicated interior separator images change. Other symbols,
inks, source positions, and print-up vectors remain unchanged. The original
three separator stickers already occupied these positions, so the extension
needs no additional sticker and consumes none of the 22 certified reserve
printing positions. The reserve exclusion is rechecked with branding present.

## Orientation and order

Each image fragment is deliberately assigned only the upright orientation:

```text
allowed quarter turns: {0}
```

No quarter-turn or half-turn symmetry of the wordmark is assumed. Its middle
arrow must point up. Distinct image identities force left/middle/right ordering;
reflection, character substitution, and swapping similar-colored fragments are
not accepted. Normal and up vector together specify the entire image frame,
including its left-to-right direction.

The full image must be cut into three sticker-sized artboards while respecting
physical gaps. The proof is **asset-agnostic**: it works for any three fixed
image fragments with those frames, including the supplied concept. It does not
claim that a print-ready SVG/bitmap crop of the uploaded reference has been
created or pixel-checked. Internal black/gold or other colors are part of each
image's immutable identity, not a requirement to make the logo monochrome.

### Source printing angles

The source cubes need these print angles relative to their canonical face-up
directions; all three images appear **0° upright** on the completed front:

| Fragment | Source face and cell | Print angle, CCW around outward normal |
| --- | --- | ---: |
| Left | U (2,2), ID 6 | 270° |
| Middle | D (2,3), ID 32 | 180° |
| Right | U (2,4), ID 8 | 90° |

The complete [150-sticker plan](../results/german-wordmark-printing.csv) includes
these image identities, source coordinates, orientations, and all unchanged
calendar/time printing. Source printing angle must not be confused with reading
a sideways logo in the target display.

The wordmark is guaranteed in **every completed display state**. During turns
between displays its fragments can temporarily leave the row or misalign;
continuous visual assembly throughout a transition is not claimed.

## New proof and independent checks

`results/german-wordmark.json` supplies the complete fixed printing. The
independent verifier checks:

1. Only the three concrete center stickers change, and each stays attached to
   its original physical cubie with a fixed print direction.
2. All calendar/time targets are rebuilt, with the three row-4 center targets
   replaced by distinct full-image tokens in a constant left/middle/right order.
   Outer row-4 targets remain unprinted blanks.
3. Every date and minute projection has a rigid, symbol/image-and-ink matching
   using different physical cubies at different front positions. Full fragment
   equality is required; readable text alone or a matching average color is not
   enough.
4. The exact legal move-group and oriented partial-placement theorem are
   freshly verified in the process, then reused for the unchanged cube geometry.
   This proves a **common legal full-state completion**, including the branding
   centers, for each of the 15,779,520 German target displays.
5. The checks pass with every nonfixed printed glyph/image restricted to upright
   display poses. The fixed-center circular zero and hidden blank centers keep
   their previously documented optical treatment.
6. All 22 reserved print positions can still be excluded from display supply
   simultaneously, with branding present.

Two deliberately incorrect printings must fail actual target matching:
left/right image labels swapped with their print directions unchanged, and
the middle arrow image printed 90° off. These negative controls demonstrate
that order and orientation are enforced by the new check.

As before, a positive matching alone is not used as the SAT proof. The exact
full-group equality and even-subgroup partial-placement transitivity give the
simultaneous physical completion. The pinned SymPy calculation and its explicit
model assumptions are reviewed in [COMPACT_FORMAT.md](COMPACT_FORMAT.md).

The English wing impossibility is unaffected because branding modifies only
center targets. It is independently rechecked for the unchanged wing demands.
Thus the corresponding EN and common EN+DE configurations remain UNSAT, within
the same scopes as the preferred unbranded format. No general English calendar
cube impossibility is asserted.

## Reproduce

After normal repository setup:

```sh
npm run experiment:wordmark
```

The candidate starts UNKNOWN. SAT is written only after independent branded
matching, legal-completion, reserve, CSV, and negative-control checks succeed.
`npm run check` includes this extension and all previous experiments, with
18 focused regression tests. `npm run verify` validates saved certificates.
No artwork preview, generalized renderer, or move optimizer is introduced.
