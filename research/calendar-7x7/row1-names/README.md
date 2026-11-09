# Row-1 month names: inventory gate

**Research candidate, not certified. Gate 1 fails.** The proposed layout
requires 25 face tiles in the 24-tile corner orbit. Stop: no printing,
cubie matching, state synthesis or chain search follows this result.
Physical feasibility is `UNKNOWN`; this is an oriented inventory obstruction,
not a legal-state or full-puzzle SAT/UNSAT claim.

The [experiment manifest](experiment.json) records pins and scope.
The raw [layout](layout.tsv) is the owner's English label table. Columns 4–7
remain blank. Identical whole labels share an artwork class where their
transported orientation and ink agree. Column occupancy is 12/11/6 months;
distinct labels are 10/10/4. Weekdays, date ink and the strict upright
`23/30` and `24/31` splits retain scheme A semantics.

The owner's direct decision on 2026-11-09 supersedes the earlier handover's
O exception: only `0` and `6`/`9` are rotation-neutral as specified by the
existing strict rule; `O` is distinct from `0` and must remain upright.
Multi-letter labels are indivisible artwork, without letter/digit aliases.
No single `0` or `O` occurs in the proposed header. Old profile, printing,
root words, source pins and proof receipts remain unchanged.

## Model gap: 22 versus 21

The historical original `dual-stacked` checkers reproduce scheme A's
19 printed classes + 3 blanks = 22, with identical receipts. The 19 printed
classes comprise 12 date classes and seven month-letter classes. A text-only
count loses the second red `29` requirement: the bottom-left and bottom-right
corners transport the same upright text into different reference orientations
(`q=0` and `q=3`). One asymmetric printed `29` cannot supply both upright.
These q values describe physical reference transport, not a displayed rotation.

Replacing seven corner month-letter classes with ten first-column labels gives
12 + 10 + 3 = 25. The additional corner tile is not removable by merging 6/9.
The coordinator's text-only arithmetic also differs in the middle top-edge
orbit; the complete oriented result is authoritative for this gate.

| Orbit | Printed | Blank peak | Capacity | Reserve |
|---|---:|---:|---:|---:|
| (-3,-3) | 22 | 3 | 24 | -1 |
| (-3,-2) | 22 | 2 | 24 | 0 |
| (-3,-1) | 22 | 2 | 24 | 0 |
| (-3,0) | 19 | 2 | 24 | 3 |
| (-3,1) | 15 | 3 | 24 | 6 |
| (-3,2) | 16 | 2 | 24 | 6 |
| (-2,-2) | 16 | 0 | 24 | 8 |
| (-2,-1) | 21 | 1 | 24 | 2 |
| (-2,0) | 21 | 0 | 24 | 3 |
| (-2,1) | 17 | 1 | 24 | 6 |
| (-1,-1) | 22 | 2 | 24 | 0 |
| (-1,0) | 23 | 1 | 24 | 0 |
| (0,0) | 6 | 0 | 6 | 0 |

Every noncentral face-tile orbit has capacity 24; the fixed center has six.
This ignores cubie coupling and cannot establish physical feasibility when
all inventories fit. Peak blank demand is simultaneous demand, not one blank
per distinct label. Ink and transported orientation remain part of every class.

## Reproduction

Base: research commit `8c823fe6f6e3cd3c9ecc4e5797177498944ac285`.
Both implementations independently read the raw TSV. Julia builds boards through
`pure_common.jl`; Flix uses its native `Core`, `Data`, `Dag` and `Stacked` modules.
Shared inherited model choices remain a common-mode risk. Both check all 91
representatives and independently verify that their month/weekday-offset/day-count
shapes cover all 2400 months from 1900-01 through 2099-12. This extends inventory
coverage only; no new physical route is claimed.

From the repository root, using Julia 1.11.5 and JDK 21:

```sh
cal=research/calendar-7x7
out=/tmp/calendar7-row1-names-reproduction
mkdir -p "$out"
CALENDAR7_NAMES_FLIX_BUILD_DIR="$out/flix" bash "$cal/row1-names/flix/build.sh"
julia --startup-file=no "$cal/row1-names/inventory.jl" "$cal/row1-names/layout.tsv" names > "$out/julia.tsv"
java -Xmx2g -jar "$out/flix/artifact/flix.jar" "$cal/row1-names/layout.tsv" names "$cal/english/evidence" > "$out/flix.tsv"
cmp "$out/julia.tsv" "$out/flix.tsv"
bash "$cal/row1-names/negative_checks.sh" "$(command -v julia)" "$(command -v java)" "$out/flix/artifact/flix.jar" "$out/negative"
```

The wrapper names its output jar after its build directory. The example uses
`flix`; another directory name produces a correspondingly named jar.
For the historical check, build `dual-stacked/flix/build.sh` and run its
`inventory F31=bfold,S30=bfold,S31=bfold;H=555555555222 strict` command
(with the variant quoted), adding `english/evidence` to the Flix invocation.
The historical receipt is preserved separately from the new strict inventory.

Not run: print generation, cubie matchability, legal-state synthesis, route
search, app integration, CI or a full mutation sweep (by owner decision).
No data is exported under `public/calendar7`; any future accepted profile must
use separate v1 data files and leave scheme A selectable.
