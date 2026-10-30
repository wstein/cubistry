# Independent native Flix research check

**Stronger physical result:** the DE `555555555111` print profile is rejected
by a native necessary wing-coupling proof, despite passing the earlier capacity
screen. See [PHYSICAL-DE-PROOF.md](PHYSICAL-DE-PROOF.md). The strict native
certificate check accepts the independently generated certificate and rejects
nine corrupt controls. This scope includes marked overflow and the full
2026–2099 range. EN complete physical feasibility remains UNKNOWN.

**Current screen: three separate contiguous uppercase month letters, with a
fixed start for each month and no printed year.** The current native module is
`src/Moving.flix`, with raw evidence `moving.stdout.tsv` and comparison receipt
`moving-comparison.log`. Previous fixed-position and compact-split alternatives
are retained below. The rejected noncontiguous three-sticker placement is
historical evidence, not a recommendation.

This is a research-local necessary-bound check, **not canonical checker
CONFIRMED, a legal-move witness, SAT, or a global print optimum**. It does not
read or reuse the Julia analyzer source or pinned canonical proof checker.

`src/Main.flix` independently constructs Gregorian month lengths and weekdays
from the number of completed days since Monday 0001-01-01. It accepts exactly
the canonical UTF-8 TSV serialization of all 888 months in 2026–2099, including
one final LF. Exact comparison rejects malformed fields, order/coverage errors,
wrong weekdays, and wrong leap lengths. It then builds its own grids and checks
that sixth-week dates wrap without collisions to the first date row in the same
weekday column.

For separate DE Monday-first and EN Sunday-first prints, it checks all five
consecutive three-glyph month-header starts for 2026–2026, 2026–2027,
2026–2028, 2026–2029, 2026–2039, and 2026–2099. Weekday headers occupy one
sticker per complete abbreviation. Weekend dates and headers use red ink;
other dates use dark ink; month glyphs use their own ink. Equal-ink numeric
6 and 9 share one permissive art class. Other numeric classes remain distinct.
Year fields, unused top-row fields, and overflow markers are relaxed away.
Unused date cells require blank stickers.

A sticker's invariant is its local C4 coordinate orbit. Six faces each contribute
four stickers for every noncentral orbit (24); the core has the fourfold
stabilizer and contributes one per face (6). The checker verifies the 49 front
cells partition into twelve four-cell orbits and one singleton. Each orbit's
necessary demand is its union of nonblank art classes plus its maximum count
of simultaneous date blanks in one target. A violation rules out that fixed
layout under this relaxation. Passing the bound does not establish feasibility.

Run from this directory:

```sh
python3 run_checks.py
```

The Python driver only invokes the pinned Flix compiler/JVM and creates corrupt
inputs; all calendar, overflow, orbit, and inventory logic executes in native
Flix. The driver builds the standalone jar with `./flixw build-jar`, then runs
`java -jar artifact/flix.jar PATH`. Caches default to writable shared tooling
paths; set `FLIX_CACHE_HOME` and `COURSIER_CACHE` to override. The compiler is
Flix 0.79.0, wrapper 0.34.9; `.flixw/lock.toml` pins its complete SHA-256. No Maven
or third-party application libraries are used. The project metadata uses only
fields accepted by the Flix 0.79.0 manifest schema; this research source follows
the repository AGPL-3.0 license.

`toolchain.log` records actual JVM/compiler versions and compiler digest.
`checks.tsv` records input SHA-256 and process exit for the valid input and 11
corrupt controls. Per-case stdout/stderr and mutation files are retained.
`valid.stdout.tsv` is structured native Flix evidence:

| Record | Fields after record name |
| --- | --- |
| `valid` | format, accepted month count |
| `census` | language, upper year, month count, six-week count, max overflow |
| `orbit` | language, upper year, month start, orbit x, orbit y, nonblank classes, max blanks, capacity |
| `layout` | language, upper year, month start, number of violating orbits |

The observed full-range census is DE 191 and EN 190 six-week months, with at
most two overflow dates. For 2026, four DE header starts and all five EN starts
violate their bounds. By 2028, all five starts violate in each language.

## Orientation-aware boundary check

`src/Oriented.flix` independently implements the specified optimistic font
profile: circular 0/O; bar 1/I; 180-degree symmetric 2,5,8,H,N,S,X,Z; 6/9 dual;
other glyphs orientation-sensitive. At each noncentral coordinate it rotates
both the position and the artwork into the orbit reference. A half-turn of an
entire word reverses its glyph order. The core may use any quarter-turn.

The `oriented` command enumerates the same increasing three-column month
placements, consecutive two-digit year positions, optional prefix, and
`dark`/`red`/distinct `year` inks for endpoints 2030 and 2031. The native results
match all 15 passing candidates and all 195 candidate orbit triples from Julia:
DE has 6 passing relaxations in 2030, EN has 9; both have zero in 2031. Since
required art unions and maximum blank counts cannot decrease when extending
the year range, failure at 2031 persists for later endpoints in this family.
These statements depend on the declared font profile and header family.

`python3 compare_outputs.py` compares native stdout with Julia's output JSON
without reading the Julia implementation. It also compares all 780 baseline
orbit triples. `baseline-comparison.log` records the result. Physical
feasibility remains UNKNOWN, including for every passing inventory bound.

The additional `oriented-month` command probes year digits using the month ink,
which is a distinct case when I/1 or O/0 artwork can share. This case must be
included if the year color is unconstrained. Its output is retained separately
as `oriented-month.stdout.tsv`.

The separate native month-ink probe found two DE and three EN passing
candidates at 2030, and zero for both languages at 2031. Thus this omitted ink
choice does not extend the
reported prefix boundary for the same coordinate and font family.

## Historical three-sticker yearless screen

The `yearless` command covers 2026 alone and all months of 2026–2099 separately
for DE and EN.
It places the three month glyphs left to right on each of the 35 increasing
column triples and requires the remaining four top-row stickers blank. It
flags the five contiguous placements explicitly. Date and weekday labels retain
the reviewed font/rotation profile and weekend ink rules. No year or prefix
labels or year ink appear. `yearless-layout` records language, first/last
coverage years, comma-separated columns, whether contiguous, and violating
orbit count. `yearless-orbit` records the same range/columns, orbit x/y, unique
nonblank artwork count, simultaneous blanks, and capacity. Passing any bound
leaves physical feasibility UNKNOWN.

Run directly after `./flixw build-jar`:

```sh
java -jar artifact/flix.jar yearless ../../evidence/calendar-months.tsv
```

`python3 compare_yearless.py` compares all 140 native yearless layout results
and all 1820 orbit triples with Julia’s output JSON only; the receipt is
`yearless-comparison.log`. For 2026–2099, no contiguous placement passes; exactly
columns 2,6,7 pass in each language. For 2026 alone, DE additionally permits
2,5,7; EN additionally permits 2,4,7 and 2,5,7. These are inventory-bound passes
with UNKNOWN physical feasibility.

## Current compact month screen

`src/Compact.flix` covers DE and EN separately for 2026 alone and 2026–2099.
The requested placement is columns 1,2 of the first row. Columns 2,3 through
6,7 are exploratory translations. The suffix is one immutable lowercase
artwork, explicitly orientation-sensitive, with no splitting or uppercase/digit
alias. The capital and calendar artwork use the reviewed optimistic profile.
The other five top cells require blank stickers. No year or prefix is printed.

`python3 run_checks.py` builds and invokes this native command alongside
historical regression checks. `python3 compare_compact.py` compares the 24
layout results and 312 orbit triples against Julia’s output JSON only; its
receipt is `compact-comparison.log`.

```sh
java -jar artifact/flix.jar compact ../../evidence/calendar-months.tsv
```

The requested columns 1,2 fail for both languages, even for 2026 alone: orbit
(-3,-2) needs 25 stickers but has capacity 24. All six adjacent placements fail
for the full 2026–2099 range. Only DE columns 6,7 pass for 2026 alone, as an
exploratory necessary-bound pass. Physical feasibility remains UNKNOWN.

## Fixed 2+1 split alternative: `Ja | n`

The user also permits the first two letters together, initial uppercase and
second lowercase, with the third lowercase letter on the next sticker. The
`compact-prefix` command applies **one fixed 2+1 split to all twelve months**.
The earlier `compact` command applies **one fixed 1+2 split to all twelve
months**. Neither command switches the split by month. Both resulting tokens
in the 2+1 alternative are immutable and orientation-sensitive; neither token
is split or aliased to digit/uppercase artworks. Each language is checked as a
separate print inventory.

`compact-prefix.stdout.tsv` and `compact-prefix.stderr.log` preserve the native
result separately from `J | an`. `compare_compact_prefix.py` compares all 24
layouts and 312 orbit triples with `compact-prefix-screen.json`, writing
`compact-prefix-comparison.log`. Requested first-row columns 1,2 pass necessary
bounds for both languages and both ranges. The other five adjacent translations
fail. A passing bound is **not** a legal-move or coupled-cubie construction;
physical feasibility remains UNKNOWN.

```sh
java -jar artifact/flix.jar compact-prefix ../../evidence/calendar-months.tsv
python3 compare_compact_prefix.py
```

## Current moving-month schedule screen

Each month keeps three separate uppercase letter stickers on a contiguous
run of columns `start, start+1, start+2`, with start in 1–5. Its start is fixed
across all years of 2026–2099. Each language has its own print inventory; month
ink differs from date and weekday inks. All other top-row cells require blanks.

`src/Moving.flix` computes the date/weekday art union over the whole period.
For every orbit and each actual month it computes the maximum date blanks over
years, adds the top blanks for that same month’s assigned start, then takes the
maximum over months. It does **not** add unrelated date/top blank maxima.
This equals the maximum over complete target states because each month’s header
position is constant across years. It preserves artwork/coordinate rotation
normalization as in the prior orientation-aware screens.

The `moving` command reads `evidence/moving-candidates.tsv`: one LF-terminated
row `name<TAB>DE|EN<TAB>2099<TAB>12digits`, one start digit per month. Native
Flix checks all 34 candidate rows and emits 442 orbit records. It also
independently enumerates all 25 half-year, 625 quarterly, and 15,625 paired-month
schedules for each language: 32,550 total schedules. Passing counts are DE/EN
0/0 for half-years, 1/3 for quarters, and 0/55 for pairs. The proposed forward
pair schedule `112233445511` fails for both languages.

The common simple schedule `555555555111` passes necessary bounds in both
languages: **January–September on the right (columns 5–7), October–December
on the left (columns 1–3)**. This is one fixed rule for the whole period.
Its necessary-bound pass does not establish coupled-cubie compatibility or
legal-move reachability; physical feasibility remains UNKNOWN.

```sh
python3 run_checks.py
python3 compare_moving.py
# Or invoke the native executable after building:
java -jar artifact/flix.jar moving ../../evidence/calendar-months.tsv ../../evidence/moving-candidates.tsv
```

`moving-layout` records candidate name, language, upper year, and bound pass.
`moving-orbit` records name/language/year, orbit x/y, base nonblank classes,
month classes, combined nonblank classes, state-conditioned blank maximum,
and capacity. `moving-family` records language, months per group, tested and
passing counts. `moving-family-pass` lists every passing grouped schedule.
`compare_moving.py` reads only Julia’s output JSON and compares all candidate
orbit fields and all six family totals; it does not read the analyzer source.
