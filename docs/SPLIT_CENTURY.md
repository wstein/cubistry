# Split-century German wordmark calendar: historical and future windows

The new year row is `19 89` / `20 26`, with an **unprinted fixed front center**.
Thousands, hundreds, tens, and units are on movable pieces. This is a newly
synthesized printing/layout, separate from the earlier ` 2026` certificates.

All five candidates below have **SAT** certificates for one immutable printing
per candidate, all supported Gregorian dates, and every one of 1,440 minutes.
They keep zero-padded red day digits, red month letters, blue time digits, gray
year digits, dark weekday letters, red colon, and three fixed upright wordmark
images with blank outer row-4 cells. Image-internal colors remain unrestricted
fixed pixels. Production artwork cropping is not certified.

Thousands signs are **blank, 1, 2** in every row. Blank means years below 1000;
there is no year zero. A date in year 789 displays ` 7 89`. Year 1 displays
` 0 01`; only the thousands zero is suppressed, hundreds and decades remain.
Historical weekdays use the proleptic Gregorian calendar, not local historical
calendar-transition conventions.

| Allowed hundreds | Status | Axial centers used | Supported years | Actual date count |
| --- | --- | --- | --- | --- |
| 0,9 | SAT | 21/24 | 599 | 218,780 |
| 0,9,8 | SAT | 22/24 | 899 | 328,354 |
| **0,9,8,7** | **SAT** | **23/24** | **1,199** | **437,926** |
| 0,9,8,7,6 (more past) | SAT | 24/24 | 1,499 | 547,499 |
| 0,9,8,7,1 (more future) | SAT | 24/24 | 1,499 | 547,498 |
| 0,9,8,7,6,1 together | **UNSAT** | **at least 25/24** | — | — |

The requested four-hundreds candidate covers exactly these inclusive windows:

* **1–99**
* **700–1099**
* **1700–2099**
* **2700–2999**

The fifth digit **6** instead gives 1–99, 600–1099, 1600–2099, 2600–2999.
The fifth digit **1** instead gives 1–199, 700–1199, 1700–2199, 2700–2999.
Each list is supported by one common printing, not separate printing per window.
Past and future are both supported; choosing a fifth hundreds digit shifts the
windows and does not make every intermediate year available. A different fifth
digit is capacity-wise equally eligible, but only the two options above were
fully computationally certified in this experiment.

## Constructive capacity and physical pairing

Axial centers number 24. Give each demanded role-symbol a dedicated center:

* 8 red month-first letters at front (2,3): A,D,F,J,M,N,O,S.
* 1 upright middle-logo image at (4,3).
* 10 gray decade digits at (3,4).
* One gray center for each allowed hundreds digit at (3,2).

This uses `19 + |H|` centers. Thousands have moved to the middle-edge orbit and
consume no axial centers. With H=0,9,8,7, one center is unprinted. This count is
not a globally maximized general reserve certificate.

For the twelve physical two-sticker middle-edge cubies, allocate disjoint
physical groups to the four simultaneous front roles:

| Role | Printed symbols | Dedicated physical cubies |
| --- | --- | --- |
| Weekday final letter (1,3) | N,E,M,T | 2 |
| Thousands (3,1) | blank,1,2 | 2 |
| Year units (3,5) | 0 through 9 | 5 |
| Colon (5,3) | : | 1 |

Both stickers of each cubie are printed for the same role. Their symbols are
mutually exclusive at that role. One concrete construction pairs N/E, M/T;
blank/1, 2/2; 0/1, 2/3, 4/5, 6/7, 8/9; and :/:.
Every front role therefore selects a different group, with no cubie collision.
Only ten cubies are allocated; two are left unallocated and printed blank.
The fixed print-up of every sticker is synthesized from its actual rigid
orientation to its assigned slot. No sticker ever changes image or ink.

The corner, wing, diagonal-center, and logo printing from the zero-day witness
is preserved. All their targets are nevertheless independently rechecked over
the actual supported historical/future calendar dates. In particular the
wing construction's sole FEB/day-tens-3 exception remains valid for every year.

## Why six complete hundreds classes really are impossible here

This negative bound does not assume upright or asymmetric digits. Each of the
ten gray digits must exist for the decade position. For every digit c allowed
at hundreds, a supported year can have c at **both** hundreds and decades, e.g.
1990 for c=9. Hence it requires a second distinct gray c sticker simultaneously.
There are therefore at least `10 + |H|` gray axial stickers. In addition,
eight distinct red month letters and one immutable logo image need nine more.
For six hundreds classes this gives **25 physical center stickers, versus 24**.

Optical rotational equivalence cannot eliminate two copies simultaneously
needed on the front. Different ink and image identities keep the other nine
stickers distinct. This proves UNSAT for six full hundreds classes under the
specified year positions, colors, month vocabulary, logo, and coverage demand.
It is not a claim that six hundred-digit classes are impossible in every layout,
with different ink policy, or with selectively omitted years.
The machine-readable negative certificate is
`results/german-century-six-bound.json`. Its verifier independently recomputes
all six-class calendar projections and the maximum simultaneous multiplicity
of each immutable glyph/image-and-ink identity, then sums those required
physical copies and compares them with the actual 24-center lattice inventory.
It does not infer UNSAT from a failed search or a solver status.

Together with the five-class construction, **five is the exact maximum number
of complete hundreds classes for this layout and these requirements**.

## Complete legal-state verification

`scripts/split-century.py` constructs the physical printing and invokes the
independent Python lattice/orientation/matching and exact SymPy verifier. It
independently generates every valid date in the requested windows, crosses
all date/time projections per orbit, matches distinct labeled physical cubies,
and requires the exact whole-group completion theorem. A fresh group-order
computation is performed in each process; the verified geometry theorem is
then reused only after all changed target matchings have been checked.
The number of matched target projections is recorded separately per candidate.
All six fixed-center stickers are blank, so their spins are optically irrelevant.
All nonfixed printed glyphs and full logo images can appear strictly upright.

The theorem's geometry, four/eight front placements, and local stabilizer
orders do not depend on how many target patterns the calendar produces.
The reuse path now records the newly checked projection counts instead of
requiring them to equal the preceding candidate's counts. No serialized SAT
certificate is accepted as a substitute for fresh group computation.

On the requested four-class candidate, negative controls remove the actual
printed gray hundreds-9 sticker and rotate the actual middle logo by 90°.
Both must fail real target matching. ReScript independently formats the split
year row; regression tests cover leading blank, historical, and future years.

Run after the standard setup with the virtual environment activated:

```sh
npm run experiment:centuries
python3 scripts/split-century.py --verify
```

Certificates and all-150-sticker source-printing CSVs are
`results/german-century-{09,098,0987,09876,09871}.json` and corresponding
`-printing.csv` files. The preferred four-class plan is
`results/german-century-0987-printing.csv`.
The old fixed-front-zero and space-day witnesses remain unchanged.
