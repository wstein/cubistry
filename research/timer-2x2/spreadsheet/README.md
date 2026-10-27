# 59:50 timer Excel comparison

[timer-5950-standard-optimized.xlsx](timer-5950-standard-optimized.xlsx) contains
12 sheets covering the original standard print and the selected optimized print:
summary, all increment/decrement words, edge comparison, two color-coded source
assembly maps, both 24-sticker frame tables, initialization, rollover statistics,
and move-count histograms.

“Standard” uses the original source-hub words without cancellation. The additional
“Direct baseline” uses the same standard print with direct routes; it makes the
routing comparison explicit. The optimized route has a maximum of five HTM and
1,324 HTM total across 359 edges, versus 1,709 for the direct baseline and 6,535
for the raw standard source-hub route. A half turn counts as one HTM or two QTM.
The range is 00:00–59:50 in ten-second steps. Setup costs are separate.

Assembly maps are not cut-out sticker artwork: digits are displayed upright for
legibility and arrows specify their physical print-up direction. Exact physical
vectors and clockwise rotations are in the sticker tables. For the optimized
vector sticker artwork, see [the SVG net](../optimization/59m50-print.svg).

The exporter independently replays all 360 displays, 359 increments and 359
inverse decrements for each of the three routes. It then reopens the actual XLSX
and checks its routes, counts, sheet sizes, and comparison formulas. Excel
recalculates the reduction formulas on opening. Global print optimality and
physical timing remain unproven; refer to the [proof report](../optimization/REPORT.md).

Regenerate with Python 3 and `openpyxl`:

```sh
python3 research/timer-2x2/spreadsheet/export.py
```

Existing proof artifacts are read without modification.
