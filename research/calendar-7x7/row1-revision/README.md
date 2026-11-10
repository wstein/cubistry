# Revised row-one names: oriented inventory gate

Research candidate, not certified. The necessary face-tile inventory is
`NOT_OBSTRUCTED`: all 13 pools fit. Physical feasibility remains `UNKNOWN`.
No printing, cubie matching, states, chains, app exports or publication follows
from this inventory result alone.

The owner's revised [raw table](layout.tsv) shares `ARY` between January and
February, uses `MA/RCH` for March and `MA/Y` for May. Columns 4–7 are empty
month-band tiles. Distinct nonempty texts per column are **9/11/3**; including
empty text, **9/11/4**. Occupied month counts are **12/12/6**. These counts do
not count physical artwork classes.

## Oriented artwork

The `names-band` mode is the decisive profile. Every empty tile in row one has
ink `band`, with a bottom-edge line retained as asymmetric artwork. Empty days
have ink `blank` and remain rotation-neutral. A band's transported reference
orientation is part of its class even though its text is empty. Month and
weekday text already fixes upright orientation, so adding their bottom lines
does not grant an extra rotation equivalence. Identical text shares artwork
only when ink and transported orientation agree.

The existing strict optical rules are unchanged: only zero is quarter-turn
neutral and six/nine are half-turn twins; O stays upright and distinct from
zero. In particular, the two upright red `29` corner transport classes remain
separate. The fixed-center inventory retains the inherited four-way reference
quotient; this is only a necessary face-tile inventory bound.

| Orbit | Decorated demand | Empty-day peak | Capacity | Reserve |
|---|---:|---:|---:|---:|
| (-3,-3) | 22 | 2 | 24 | 0 |
| (-3,-2) | 23 | 1 | 24 | 0 |
| (-3,-1) | 22 | 1 | 24 | 1 |
| (-3,0) | 20 | 1 | 24 | 3 |
| (-3,1) | 16 | 2 | 24 | 6 |
| (-3,2) | 17 | 1 | 24 | 6 |
| (-2,-2) | 16 | 0 | 24 | 8 |
| (-2,-1) | 21 | 1 | 24 | 2 |
| (-2,0) | 21 | 0 | 24 | 3 |
| (-2,1) | 17 | 1 | 24 | 6 |
| (-1,-1) | 22 | 2 | 24 | 0 |
| (-1,0) | 23 | 1 | 24 | 0 |
| (0,0) | 6 | 0 | 6 | 0 |

Decorated demand includes text-free lined band tiles. The corner demand is
12 date classes + 9 month classes + 1 lined band + 2 empty days = **24**.
The earlier `MAY` variant still needs 25 corners. Sharing `MA` between March
and May removes one corner class; its new `Y` occupies the formerly empty May
cell in column two, whose pool still fits at 24.

The middle top-edge pool needs **21**, not the text-only estimate 20. As in
the historical model, reference orientation is retained. The raw class lists
in the receipts expose each contribution; no hand-count estimate replaces it.

## Controls and reproduction

Base: `b2d8e1c478e01f14b7494b16a00e4a70d47084b3`, the merged PR #379.
Its tree equals the reviewed source `b5a5c702a313f91b902effb4e2d825ca5c116570`.
All older prints, checkers, pins, roots and receipts remain unchanged.
The extended checkers reproduce the old 25-corner receipt byte for byte.
They also reproduce scheme A's 22-corner class inventory; its older receipt
uses a different report format, so that comparison is through the unchanged
row-one checker in `scheme-a` mode rather than a false byte-identity claim.
The `names` mode is a diagnostic without the new band artwork; it is not the
accepted new profile.

Julia 1.11.5 and Flix 0.79.0 / JDK 21 independently read the same raw table.
Both verify all 91 representative displays and coverage of all 2400 months
from 1900-01 through 2099-12. The 271-line `names-band` receipts agree byte for
byte, SHA-256 `f1a9d7fb18d1852c184fde414902e8627341230d83e07ad1ca8a13e4f1651c51`.

From the repository root, set unique workspace scratch paths:

```sh
cal=research/calendar-7x7
out=/Users/werner/whr/cubing/scratch/row1-revision-reproduction
mkdir -p "$out"
CALENDAR7_NAMES_FLIX_BUILD_DIR="$out/flix" bash "$cal/row1-revision/flix/build.sh"
julia --startup-file=no "$cal/row1-revision/inventory.jl" "$cal/row1-revision/layout.tsv" names-band > "$out/julia.tsv"
java -Xmx2g -jar "$out/flix/artifact/flix.jar" "$cal/row1-revision/layout.tsv" names-band "$cal/english/evidence" > "$out/flix.tsv"
cmp "$out/julia.tsv" "$out/flix.tsv"
```

The build wrapper's jar name follows the build-directory name. Targeted raw
negative controls are opt-in, run separately with `negative_checks.sh` using
Julia and Java executable paths, the built jar and a unique output directory.
No full mutation sweep is run by default.

Remaining gates: independent review, cubie-level print matchability, legal
states, and the May 2026–January 2028 chain with Julia, Flix and independent
replay. The eventual January 2000–January 2100 domain is not checked here;
January 2100 needs an explicit display-domain test. No state file is generated,
so optional `surface: face` compatibility is not asserted by this experiment.
