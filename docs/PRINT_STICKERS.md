# Physical sticker sheets

The separate **Print stickers** page provides complete physical prints for German
A, English 3 and both H/S/M lettering variants. Open it from the selected calendar,
clock or HSM counter; the physical print is selected automatically. English's
leading-zero and unpadded day options use the same print.

## Measure before ordering

The 15 mm and 16 mm rounded-square calendar presets are **examples**, not a
universal guarantee for a nominally standard cube. Measure the flat sticker recess
on your actual pieces, including its corner shape. A sticker must never span the
gap between moving pieces. The size in the selector is the finished cut size,
not the cube's overall size or the piece width.

Each calendar preset fits **two complete cubes** (108 stickers) on one A4 film
sheet, with 4 mm between cuts. The 16 mm preset has nine columns and twelve rows,
occupying 176 × 236 mm before bleed. HSM's 20 mm examples fit three complete cubes
(72 stickers) per A4 sheet. Multiple different physical prints can be ordered as
separate designs; confirm the printer's pricing for mixed artwork.

The defaults use 2 mm bleed, a 1 mm corner radius and a 1 mm minimum ink safety
inset. Printer requirements differ: choose a service that accepts that shape or
regenerate the files to its data sheet. A4 portrait is 210 × 297 mm; it does not
fit services whose maximum sheet side is 275 mm. There is no universal supplier
profile, PDF/X certification, cut-tolerance guarantee or automatic order.

## Files and physical assembly

- `print.pdf`: A4 vector artwork plus the actual named `kiss_cut` Separation
  channel, 100% magenta, with stroke overprint enabled. Agree with the service
  that this channel is for cutting and must not appear as visible ink.
- `artwork-N.svg` and `cuts-N.svg`: separate millimeter vector files for each
  production page. Cuts are closed rounded-square cubic contours. SVG's named
  cut group is metadata; the manufacturing spot-color channel is in the PDF.
- `assembly.pdf`: numbered placement map, physical source-face grids, setup
  examples and a 50 mm calibration bar. Print it on ordinary paper, not sticker
  film. It is not production artwork.
- `manifest.json`: every copy, source sticker/cubie ID, source position, normal
  and up vector, face/row/column, actual glyph rotation, cut dimensions, source
  hashes and output hashes. Genuine unprinted stickers are included.
- `bundle.zip`: these files together with printing notes and applicable licenses.

Begin with a solved physical cube. Choose and retain Front and Up, apply each
source-face grid as an outside view, and do not make face turns during assembly.
Whole-cube rotations to reach the other faces are fine. Source glyphs can be
sideways or upside down on the sheet: that is intentional. The quarter-turn
artwork transforms preserve the original print's complete orientation; do not
make every loose glyph upright by eye. The resulting cube is in its source pose,
not necessarily a readable calendar date. Use the guide's setup word afterward.

Print at **100% / actual size**, with fit-to-page disabled, and check the 50 mm
bar. Confirm the finished sticker dimensions on a proof before ordering a batch.
Ask the service about film, adhesive, wear protection, color profile, registration
tolerance, corner radius and bleed. The export's source geometry cannot establish
how accurately a particular printer or cutter will manufacture it.

## Custom sizes and reproducibility

Python export tools are development-only; application builds do not install or
require them. The Counter checks workflow installs the pinned requirements in a
virtual environment and runs `npm run test:print-exports`, which verifies the
committed presets (catalog hashes, then `verify_exports.py` on each preset) and
runs the negative controls. It never regenerates bytes, so it does not depend on
the zlib build described below. It is opt-in locally because `npm run check`
stays free of pip packages. Install the pinned dependencies into a virtual
environment, with Node 24+ available:

```sh
python3 -m venv .print-venv
.print-venv/bin/pip install -r scripts/print-requirements.txt
.print-venv/bin/python scripts/print-sticker-sheets.py --design de-a --size-mm 16 --copies 2 --output /tmp/calendar-sheet
```

The output directory must be new; the generator never overwrites saved exports.
`--radius-mm`, `--bleed-mm`, `--safe-mm` and `--gap-mm` customize the cut profile.
The gap must be at least 2 mm and contain both neighboring bleed areas. Safe ink
bounds are conservatively fitted inside the rounded cut, including circular
corner cases. Large dimensions may require more than one A4 sheet. `--layout
faces` retains six spatial face blocks instead of compact production imposition.

The H/S/M sheets carry the seconds-first print: 24 stickers per cube with three S
stickers, one H and one M (see [HSM counter](HSM_COUNTER.md#physical-reprint-required)
for the 14 changed identities; sheets printed earlier no longer match). Only the two
HSM presets and their catalog entries were regenerated for it, with
`scripts/print-sticker-sheets.py` on a Python linked to zlib-ng 1.3.1; the calendar
presets are untouched. The glyph art is unchanged; only its assignment to sticker
identities differs.

Reproduce all six committed example presets at a new location:

```sh
.print-venv/bin/python scripts/print-sticker-sheets.py --catalog --output /tmp/print-catalog
node --test --test-isolation=none tests/print-sheets.test.mjs
.print-venv/bin/python scripts/print/verify_exports.py . public/print/de-a-16mm-2sets
.print-venv/bin/python scripts/print/negative_controls.py
```

Compare the regenerated files with `public/print/`. SVG, text and license files
reproduce byte for byte. PDFs and ZIPs use deterministic metadata, but their
compressed bytes depend on the zlib build linked into Python. A different zlib
(for example zlib-ng) changes the PDF and ZIP bytes, and therefore the hashes in
`manifest.json` and `catalog.json`, while every decoded PDF object stays
identical. Byte-identical PDFs and ZIPs require the same zlib implementation.
All sticker glyphs are vector paths. Calendar glyphs and HSM unit words
derive from pinned local Noto Sans fonts under the retained SIL Open Font License;
HSM digits and large unit symbols are original geometric artwork. The project
artwork license is retained separately. Font metadata is conditional, so the
symbol-only HSM print is not described as font-derived.

The physical/PDF checker and eight corruption controls were independently authored
by the artwork reviewer. They do not import the generator: actual PDF paths,
SVG transforms, source frames, spot color, overprint and setup-word inverses are
replayed separately. A ninth control, added in PR review, swaps two identities'
glyphs consistently in SVG and PDF; the checker rejects it because every copy of
a source identity must carry identical art and each printed label must map to
one distinct glyph geometry. A label mapping that is wrong identically in every
copy still needs the visual artwork review.
