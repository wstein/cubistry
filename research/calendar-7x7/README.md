# 7×7 monthly calendar research

## Latest coupled result

The fixed German three-letter schedule (January–September right, October–December
left) passes the earlier surface inventory screen but **fails the stronger
physical wing-coupling requirement** over 2026–2099. A direct universal
contradiction certificate is independently accepted by native Julia and Flix,
including marked overflow and the permitted 6/9 reuse. This is a scoped
research-local impossibility result, not a global calendar impossibility claim.

Read [the human proof](physical-review/BLANK-OBSTRUCTION.md) and
[native Flix evidence](verification/flix/PHYSICAL-DE-PROOF.md). The raw certificate
is [DE-blank-obstruction.tsv](physical-review/DE-blank-obstruction.tsv).
The canonical repository counter/state3 checker profiles have not been extended;
no canonical `CONFIRMED` status is claimed. English full physical feasibility is
still **UNKNOWN**. A 2026-only domain is also not ruled out by this certificate.

## Current design: no printed year

The user removed the year from the design. `moving_month_screen.jl` records the
latest placement search; `physical-review/` contains the stronger coupled check.
`yearless_screen.jl` retains the earlier fixed-position header investigation.
The earlier year-bearing searches are retained as superseded research, not
requirements or supported-range promises.

One accepted compact alternative is **`J | an`**: uppercase initial on
row 1, column 1, and the two lowercase letters together on row 1, column 2.
`compact_month_screen.jl` / `evidence/compact-month-screen.json` investigate this
alternative. The suffix is one indivisible, orientation-sensitive printed image;
it is not two independently movable letters. Adjacent translations are screened
as exploratory comparisons, not silently substituted for the requested c1/c2.

The user also permits **`Ja | n`**, with the first two letters together on c1r1
and the last on c2r1. `compact_prefix_screen.jl` investigates it separately.
**Do not mix splits:** one complete print uses either 1+2 for all twelve months
or 2+1 for all twelve months. Per-month selection between the two is not allowed.

There are separate immutable English and German prints. The English week starts
on Sunday; the German week starts on Monday. Row 1 carries a three-letter month:
either one letter per consecutive sticker, or a consistent approved 1+2/2+1
split on two adjacent stickers. Row 2 carries seven three-letter weekday abbreviations,
one complete abbreviation per sticker. Rows 3–7 carry complete date numbers.
Saturday/Sunday headers and dates are red. Other header colors are distinct in
this screen. The remaining four top-row cells are blank (five for compact months).

Six-week months use otherwise empty cells in the first date row for the last
one or two dates, preserving weekday columns. A production design requires clear
overflow marks. The initial inventory screens optimistically omit them; the
coupled proof explicitly includes `30↶` and `31↶` artwork.
Any physical face may be brought to the front. The specified artwork profile
allows circular 0/O, bar 1/I, appropriate half-turn glyph symmetry, and 6/9 reuse.
It is not a certified font or printable sticker sheet.

For the original one-letter-per-sticker alternative, the three month letters must
occupy **three consecutive columns**. The user explicitly rejected split headers
such as `J   AN`. Noncontiguous column triples remain screening comparisons only
and are not acceptable design candidates. The compact `J | an` alternative above
is separately approved and uses two adjacent stickers.

## Preliminary results

### Month-dependent placement of three separate letters

The user also allows the three adjacent uppercase month letters to start at a
different top-row column for each month. Each language still uses one immutable
print; placement follows a deterministic, human-readable annual rule. There is
no printed year. The two-letter compact designs remain separate alternatives;
their splits are never mixed within a print.

`moving_month_screen.jl` searches all five starts for fixed half-year, quarter,
and month-pair groups (25, 625 and 15,625 schedules per language respectively).
Blank inventory is the maximum of **date blanks plus header blanks in the same
month**, not the sum of maxima from possibly different months.

A simple shared necessary-bound candidate over 2026–2099 is:

- January–September: three separate letters in columns **5–7** (right).
- October–December: three separate letters in columns **1–3** (left).

Julia finds one passing quarter-group schedule for DE and three for EN; all
half-year schedules fail. Pair-group schedules give no passing DE schedule and
55 passing EN schedules. The suggested forward pair sequence, wrapping its sixth
pair to the left, fails both languages. These counts are search results within
this family/profile, not global calendar impossibility or SAT claims. Independent
native Flix verification agrees on all 32,550 schedules and the 34 saved
candidates; see `verification/flix/moving-comparison.log`.

Compact **`Ja | n`**, consistently applied to all twelve months: the requested
c1/c2 placement passes the necessary oriented-artwork inventory screen for both
DE and EN over 2026–2099. It is the only passing adjacent placement in each
language for that domain. This does **not** certify a common physical printing,
coupled cubie placement, legal reachability, or a SAT result.

Compact `J | an`: the requested c1/c2 placement requires at least **25** sticker
surfaces in a **24**-surface orbit under the declared artwork and color profile,
for both languages, already for 2026 alone. It therefore fails this necessary
screen. This is a scoped inventory rejection, not a global impossibility claim
about custom fonts or other row/color layouts. None of the six adjacent placements
passes for the complete 2026–2099 domain. DE c6/c7 passes for 2026 alone, but this
is exploratory, not an approved replacement placement or a physical SAT witness.

For all months in 2026–2099, both languages have one passing ordered month-column
triple among the 35 tested: **2, 6, 7** (columns numbered from the left). This
noncontiguous triple is **rejected by the user** and is not a design candidate.
None of the five contiguous month placements passes this necessary screen, even
for 2026 alone. Four blank header cells are counted as physical inventory demand.

**Unproved positive candidates remain UNKNOWN.** The scoped German moving-header
candidate is separately excluded by the stronger proof at the top of this page.
Passing an inventory screen means only that the declared
oriented-artwork orbit inventory bound does not reject the candidate. It does not
provide a common printing, simultaneous cubie assignment, legal move sequences,
or a canonical checker confirmation. The font profile, fixed row structure and
ordered top-row family delimit every exclusion; these are not impossibility
claims about arbitrary 7×7 calendars. No tested fixed-position three-sticker
contiguous header passes this screen; the month-dependent screen is separate.

The calendar domain is 2026–2099 for coverage, despite the absence of a printed
year. A shorter year range is not needed to obtain the reported passing bound.

## Reproduce

Using Julia 1.13.3 (standard library only), from the repository root:

```sh
julia --startup-file=no research/calendar-7x7/analyze.jl
julia --startup-file=no research/calendar-7x7/yearless_screen.jl
julia --startup-file=no research/calendar-7x7/compact_month_screen.jl
julia --startup-file=no research/calendar-7x7/compact_prefix_screen.jl
julia --startup-file=no research/calendar-7x7/moving_month_screen.jl
python3 research/calendar-7x7/verification/flix/run_checks.py
julia --startup-file=no research/calendar-7x7/physical-review/blank_obstruction_certificate.jl check research/calendar-7x7/physical-review/DE-blank-obstruction.tsv
julia --startup-file=no research/calendar-7x7/physical-review/negative_certificate_checks.jl
python3 research/calendar-7x7/verification/flix/run_physical_checks.py
```

The last command is an orchestration harness; the independent mathematical
checks run in native Flix. See the verification directory for pinned tooling,
native source, negative controls and comparison receipts. Historical year-bearing
scripts remain runnable but do not describe the current yearless design.

The German obstruction closes that fixed full-range candidate. Positive claims
for English or other approved layouts still require coupled cubie matching and
constructive legal-state coverage. Historical research outside this new directory
is untouched.
