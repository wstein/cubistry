# Row-one names: corner-body obstruction

Research candidate, not certified. Native Julia and Flix report **UNSAT for a
single permanent print covering all 91 inherited targets**, under the explicit
model below. Independent review is pending. The earlier face inventory still
fits; this is a subsequent, stronger corner-body coupling check.

The short May 2026–January 2028 window is different. Its corner demand is only
21 surface copies, and this particular obstruction does not apply. A separate
[window print witness](../row1-window-print/README.md) addresses that domain.
Neither domain's result may be substituted for the other's.

## Model and certificate

Both checkers independently read the owner's [raw month table](../row1-revision/layout.tsv).
Names stay in row one, columns one through three. All other row-one cells have
ink `band`: the empty band with its asymmetric bottom line is distinct from an
empty-day `blank`. Weekdays, date ink, upright split labels and strict optics
remain unchanged. O is upright and distinct from zero. Only zero is quarter-turn
neutral; six and nine are half-turn twins. No electronic or changing print,
letter/digit aliases, or position-dependent repainting is permitted.

The printing model has eight rigid corner bodies, three permanent outward
surfaces per body, axis-aligned tangent artwork up, and the 24 proper cube
rotations. Each front corner is occupied by one body and shows one of its faces.
The check allows every body to choose any proper pose independently, ignoring
legal group constraints. An obstruction even in this relaxation also rules out
legal cube states with the same fixed printing.

The certificate consists of four finite checks and an integer contradiction:

1. Derive all 24 proper rotations, eight corner homes and 96 tangent-up frames.
   Each physical face has four front-facing poses. The sum of its actual image
   angle and the front-cell reference transport is constant across those poses.
   Strict optical equivalence is rotation-congruent. Thus a physical surface can
   serve only one of the oriented artwork classes used in the inventory.
2. Independently construct each target from the raw table and the inherited
   calendar. List all four corner requirements, all class peaks and a target
   witnessing each peak. The two upright red `29` transport classes remain
   separate. The all-target inventory is 23 classes requiring 24 copies:
   12 date copies + 9 month copies + 1 band copy + 2 plain blanks.
3. All 24 available surfaces are therefore needed. The band class has peak one
   and occurs in every one of the 91 targets, so exactly one physical band face
   exists. Its body must occupy the band corner in every target.
4. That body's other two faces can never show on the front. The other seven
   bodies have only 21 faces, but the other requirements need 23 copies.
   **23 > 21** is the corner-body contradiction.

This is not a capacity-only inference or an unsuccessful solver search. The
body occupancy restriction is essential. Reusing a spare face for a second band
copy would avoid the uniqueness premise, but there is no spare surface in the
all-target domain. No old print, root word or pin is changed, and the obstruction
is not restricted to a recoloring of the old print: it applies to any permanent
printing in this model.

All 91 target dates lie inside January 2000–January 2100; both checkers verify
that containment. Consequently the same negative subset certificate also
obstructs a printing required to cover that larger date range. This is not a
positive coverage or route check of all 1201 months.

## Controls and boundaries

| Profile and domain | Corner demand | Capacity | This lemma |
|---|---:|---:|---|
| Names with lined band, all 91 | 24 | 24 | UNSAT |
| Names with lined band, 21-month window | 21 | 24 | UNKNOWN |
| Names without a distinct band, all 91 | 24 | 24 | UNKNOWN |
| Historical scheme A, all 91 | 22 | 24 | UNKNOWN |

UNKNOWN controls mean only that the singleton-anchor lemma does not apply.
They are not proofs of physical feasibility. Julia's 14 scalar lemma tests and
Flix's 11 scalar tests include capacity slack, multiple anchor copies, an anchor
missing from a target, an empty target domain, and one-face bodies that hide no
other face. Targeted source mutants independently remove five premises or the
body-face bound. The full mutation sweep is not run by default.

Both implementations inherit calendar and geometry helpers from their own
language's frozen research modules. Those inherited model assumptions remain a
common-mode risk; the raw layout, new optics, geometry checks and coupling
argument must also receive independent source review.

## Reproduction

Base: `96cf09a864e3c51758991b4be7b7826dcdedec5f`.
From the repository root, with Julia 1.11.5, Flix 0.79.0 and JDK 21:

```sh
cal=research/calendar-7x7
out=/Users/werner/whr/cubing/scratch/calendar7-corner-coupling-reproduction
mkdir -p "$out"
CALENDAR7_CORNER_FLIX_BUILD_DIR="$out/flix" bash "$cal/row1-corner-coupling/flix/build.sh"
bash "$cal/row1-corner-coupling/run_checks.sh" "$(command -v julia)" "$(command -v java)" "$out/flix/artifact/flix.jar" "$out/checks"
```

The build directory determines the jar filename. `check.jl LAYOUT PROFILE DOMAIN`
and the Flix jar's `LAYOUT PROFILE DOMAIN ORIGINAL_EVIDENCE` independently replay
one case. PROFILE is `names-band`, `names` or `scheme-a`; DOMAIN is `all` or
`window`. Raw receipts and hashes are recorded in the experiment manifest.
No state synthesis, chain, app export or print-sheet generation is performed
by this corner certificate.
