# Independent native Flix EN physical proof checker

A confirmed integer-overflow ingress bug in the initial checker was corrected
using the documented [root-cause report](../rc-overflow/REPORT.md). Unit vectors
now require exact membership in the six signed coordinate axes before any
vector arithmetic. The old native accept receipt is preserved in
`overflow-before.stdout.tsv`; the malformed unused-blank fixture is retained
as a mandatory rejection regression. The post-fix native Flix and independent Julia runs both accept the full
91-target witness, agree on all 91 complete-state hashes, reject the same
26 negative controls, and accept the valid unused-blank axis case. The
independent Julia control receipt is `../evidence/julia-negative-checks.tsv`.

This isolated checker validates the **EN 2026–2099 fixed print profile**:
Sunday-first weekdays, five date rows with marked sixth-week overflow in the
empty first row at the same weekday column, no printed year, and three separate
uppercase month letters in columns 5–7 for January–September and 1–3 for
October–December. Weekend text/dates are red. Month ink is separate. Other date
ink is dark and weekday headers use their declared ink.

The native checker establishes all of the following for the supplied witness:

- A fixed physical print has 294 stickers on 218 rigid cubies, with 240 nonblank
  and 54 blank stickers. IDs, home positions, outward normals, and actual
  tangent up vectors are validated against independently generated geometry.
- Independent Gregorian arithmetic generates every one of the 888 months and
  independently selects exactly the same 91 earliest representative fronts.
- An inventory lower bound requires at least **240 nonblank physical stickers**
  for this fixed target/font profile. It sums the maximum simultaneous demand
  of each oriented artwork class in each invariant sticker orbit. The core
  receives an optimistic orientation quotient for this lower bound only.
- A compressed legal-word DAG uses only the 21 original physical quarter-turn
  generators. Every ancestor product and inverse therefore denotes a legal
  word. The checker derives the generators from 3D geometry rather than
  trusting generator permutations from GAP or Julia.
- Every one of the 91 resulting permutations is lifted to **all 218 physical
  cubies and all 294 individually identified stickers**. The checker verifies
  rigid-piece orientation consistency, every final surface location, actual
  sticker normal/up vectors, and all 49 front-cell optics. Actual core up is
  preserved in this replay; the lower-bound core quotient is never used for
  rendering.
- All 91 complete physical state SHA-256 hashes agree exactly with the separate
  native Julia replayer. This is supplementary agreement; the Flix proof does
  not consume Julia permutations or hashes as its authority.

Together, these checks establish a legal physical existence witness and a
matching 240-sticker lower bound **within the stated fixed profile**. They do
not optimize the number of turns or show a practical human playback. Expanded
words are astronomically long; the finite DAG is checked without expansion.
This is a research-local checker, not an extension of the pinned canonical
application checker. No production solver or PR97 artifact is modified here.

## Reproduce

From this directory, with Java 21 and Python 3 available:

```sh
python3 run_checks.py
```

Python only invokes the compiler/JVM, creates byte-corrupt negative inputs,
and compares independently produced state digests. **All geometry, arithmetic,
artwork, lower-bound, legal-word, and actual physical-state proof logic runs in
native Flix.** `run_checks.py --no-build` reuses an already built native jar.

The wrapper/compiler pins were copied into this new project without changing
the previous checker: wrapper 0.34.9, Flix 0.79.0, compiler SHA-256
`8fad2aa09567a7edabcc43f4101fa6199131df2c22929e001c87659d764f6dcf`.
There are no third-party application dependencies. The driver defaults to the
session's writable shared caches; override `FLIX_CACHE_HOME` and
`COURSIER_CACHE` for another environment. The source follows the repository's
AGPL-3.0 license.

The direct native commands are:

```sh
./flixw build-jar
java -Xmx8g -jar artifact/flix.jar data ../evidence ../../en-physical-review
java -Xmx8g -jar artifact/flix.jar selftest ../evidence ../../en-physical-review
java -Xmx8g -jar artifact/flix.jar legal ../evidence ../../en-physical-review ../../en-physical-review/all-targets-dag.tsv
python3 compare_states.py
```

`partial` takes the same arguments as `legal` and checks only roots present in
the file. Its final output explicitly leaves full physical SAT UNKNOWN. The
`dag GEOMETRY_DIR DAG_FILE` command validates legal DAG membership only and
makes no target claim. The default `legal` command requires all 91 roots.

## Canonical evidence and DAG format

The checker independently validates `physical-print.tsv`, `targets.tsv`,
`front-matches.tsv`, `pose-points.tsv`, and `moves.tsv`. All files must be UTF-8,
LF-terminated, with no CR or empty lines. Integer fields use canonical decimal
serialization; IDs and row coverage are strict. Each front-match target-point
must be the first lexicographic native pose for that target body, matching the
canonical producer metadata. Source-point orientation remains determined by
the actual printing. This format restriction supplements the independent full
physical goal replay; it is not a new mathematical feasibility assumption.

The legal DAG format is:

```text
cubistry.calendar7.legal-dag.v1<TAB>264<TAB>21
generator<TAB>1<TAB>1
...
generator<TAB>21<TAB>21
product<TAB>22<TAB>signedLeft<TAB>signedRight
...
result<TAB>targetIndex<TAB>signedRoot
```

Products have consecutive IDs after the seeds and precede result rows. Every
nonzero reference names an earlier defined node. Reference 0 is identity;
a negative reference means inverse. Product `a*b` maps point `i` to `b[a[i]]`,
matching GAP's `OnRight` convention. Only the original 21 physical generators
may be seeds. Results have distinct target indices 1–91. Every result must be
a bijection with a valid inverse before physical lifting/replay.

`Core.flix` separates `optic` (actual image orientation, including core up)
from `lowerArt` (the optimistic inventory quotient). The declared font profile
uses circular 0/O, bar 1/I, 180-degree symmetric 2,5,8,H,N,S,X,Z and 6/9 duality;
whole-word half-turns reverse glyph order. Other glyphs and overflow arrows
remain orientation-sensitive. A different font/symmetry profile needs a new
proof run and may have a different optimum.

The independent lower bound uses the 91 fronts only after native verification
that they exactly cover all 888 independently generated raw target boards.
Thus taking each artwork's maximum multiplicity over representatives is
identical to taking it over the full calendar range.

## Receipts and controls

`legal.stdout.tsv` records the orbit lower bounds, DAG node count, all 91 legal
front replays, all 91 full-state digests, and final full-witness acceptance.
`state-comparison.log` records exact Julia/Flix digest agreement. State digest
serialization is headerless UTF-8, one row for sticker IDs 1–294:
`id<TAB>piece<TAB>position<TAB>normal<TAB>up<TAB>text<TAB>ink<LF>`, with comma-only
vectors and empty text preserved.

`selftest.stdout.tsv` records direct 294-sticker tests for all 21 generators,
their inverses, four-turn identities, a noncommuting product's composition
convention, and core/overflow optic cases. `checks.tsv` records process exits
and wall times. `toolchain.log` records actual Java/Flix versions and source,
compiler, executable, print, target, match, and DAG digests.

The original seventeen negative controls reject foreign/missing seeds, forward references,
ID gaps, products after results, unknown roots, duplicate/missing targets,
noncanonical integers, wrong degree, CRLF/missing LF, identity words that do
not render the requested targets, corrupted actual core up, a 239-nonblank
print, a missing sticker, and changed calendar representatives. The legal
identity DAG is also accepted by the membership-only command, confirming that
membership is kept separate from actual target correctness.

The overflow RC adds nine rejected vector-boundary fixtures and one accepted
valid-axis fixture, all changing unused blank sticker 25. The exact old exploit
has print SHA-256
`58b26265a392049333fc098a1fb46eacf0ef561eba88a0b4092f64f900498608`: up
`(65536,1,0)` with normal `(0,0,1)`. It is rejected before any dot/cross/frame
arithmetic. Other cases include Int32 extrema/out-of-range fields, zero and
diagonal directions, non-tangent unit directions, and invalid normals.
`toolchain-before-overflow-fix.log` and `checks-before-overflow-fix.tsv` retain
pre-correction provenance; `toolchain.log` and `checks.tsv` are the new run.
The old compiled binary is retained only in the temporary RC workspace, not
committed to this project. The physical printing and all 91 valid state hashes
remain unchanged after the correction.

The final metadata review added the canonical first-target-pose format guard.
The original physical print, target fronts, matches, poses, moves, and legal
DAG bytes are unchanged. The final compiled artifact/source digests are those
in the latest `toolchain.log`; historical pre-fix digests remain explicitly
separate.
