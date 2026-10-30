# Native Flix executable-transition checker

This additive research checker preserves PR #99's source files and immutable
240-nonblank physical print. The build copies its native geometry, calendar,
artwork and legal-DAG evaluator into a temporary project. It replaces only the
temporary CLI entrypoint. Julia implementation code and solver verdicts are
not inputs to Flix.

```sh
bash research/calendar-7x7/practical/flix/build.sh
java -Xmx8g -jar /tmp/cubistry-calendar7-practical-flix/artifact/flix.jar selftest research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review
java -Xmx8g -jar /tmp/cubistry-calendar7-practical-flix/artifact/flix.jar transition research/calendar-7x7/english/evidence research/calendar-7x7/en-physical-review /tmp/calendar7-english-legal-dag.tsv TRANSITION.tsv
```

Set `CALENDAR7_FLIX_BUILD_DIR` to select another temporary build directory.
The wrapper and Flix compiler remain pinned by PR #99's wrapper lock; Flix
0.79.0 and Java 21 are required. The temporary jar is not committed.

`bash research/calendar-7x7/practical/flix/test.sh DAG TRANSITION` runs the
parser's positive and 12 negative controls, the inherited 21-generator physical
self-test, a valid February–March 2026 replay and three semantic rejection
controls (removed first move, wrong destination month and an empty word).
Receipts and mutated fixture bytes go to `CALENDAR7_FLIX_TEST_DIR`, defaulting
to `/tmp/cubistry-calendar7-practical-flix-tests`. This shell driver does not
evaluate any geometry or decide proof validity.

The canonical UTF-8 input has LF endings, a final LF and no empty lines:

```text
cubistry.calendar7.practical.v1
source<TAB>2
destination<TAB>2026<TAB>3
move<TAB>4<TAB>2
```

`<TAB>` denotes one actual tab. The example illustrates syntax; it is not a
calendar solution. Source identifies one of PR #99's 91 representative roots.
Destination is an actual month in 2026–2099. Chronological adjacency belongs
to the experiment's month mapping; this certificate checks the displayed
source representative and destination, not that external mapping.

Moves are PR #99 generator IDs 1–21 and exponents `-1`, `1` or `2`. At most
100,000 records are permitted. Exponent two is a single half turn. No wide-turn
shorthand or central-slice shorthand is accepted. Individual noncentral inner
layers count as one HTM, just like outer layers. Generators 7, 14 and 21 are
whole-cube rotations and are counted separately. QTM counts a half turn twice.
The metrics row reports HTM, QTM, whole-cube rotation records, rotation QTM
and total records.

Flix derives the legal source permutation from the supplied DAG without
expanding it. It verifies source artwork and then evaluates every finite move
both on the 264-pose action and directly on all 294 identified stickers.
The final results must agree exactly. It checks every destination front cell,
including actual orientation and ink, and applies the inverse sequence to
recover the exact physical source. Source and endpoint digests include all
294 stickers, including hidden faces.

This validates an executable transition conditional on a legally established
source state. The source initialization DAG remains an existence witness, not
a practical setup sequence. No global optimality, full chronological coverage
or runtime integration is asserted.
