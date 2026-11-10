# Shifted German weekend: strict-print capacity

This separate model implements the owner-authorized weekday positions. Existing
weekday ink, red weekend ink, brown month letters, green digits and font weight
600 are retained. Each character remains a permanent, strictly upright print.
The previous fixed-position obstruction is preserved under `../weekends-dual/`;
its edge argument is not applied to this new layout.

| Weekday | Left | Middle | Right | Nonblank ink |
| --- | --- | --- | --- | --- |
| MO | M | O | blank | dark |
| DI | D | I | blank | dark |
| MI | M | I | blank | dark |
| DO | D | O | blank | dark |
| FR | F | R | blank | dark |
| SA | blank | S | A | red |
| SO | blank | S | O | red |

Distinct top-row values, including blank, are 4 / 4 / 3. The rest of the front
remains weekday / padded day / individual month letters, across the same 3×3
face. The application contract remains all civil dates 0001–9999; the native
checkers enumerate the complete 2000–2399 Gregorian cycle within that range and
independently verify all 2,562 raw weekday/month/day targets in `targets.tsv`.
The baseline print is source evidence, not a candidate print for this layout.

## Transport and body obstruction

Raw glyph identity alone is insufficient. Every legal rigid rotation preserves
`dot(p, up)` and `dot(p, cross(n, up))`. When a nonblank print must face front with
exact up vector `(0,1,0)`, these values fix its front cell. Consequently, one
permanent brown N face cannot serve both bottom-left and bottom-right upright
positions. The two source N faces in `baseline-print.tsv` have different
invariants `(-1,1)` and `(-1,-1)`. Both native checkers verify the actual source
frames and all 24 proper rotation frames. They also verify that a blank corner,
whose up vector is unconstrained, can reach all four corner cells.

| Physical pool | Required nonblank transported classes | Simultaneous neutral blanks | Face capacity |
| --- | ---: | ---: | ---: |
| Corners | 23 | 1 | 24 |
| Edges | 21 | 1 | 24 |
| Centers | 4 | 0 | 6 |

The corner classes split into 3 dark top-left letters, 2 red top-right letters,
8 brown bottom-left letters and 10 brown bottom-right letters. All 23 classes
occur in the target domain. Every target also requires exactly one blank corner.
The face counts alone fit; coupling the three faces of each physical corner
prevents a print:

- Zero blank faces cannot show a target.
- At most one blank face fits beside 23 mandatory nonblank classes. Its physical
  corner must occupy the visible blank position in every target. The other two
  faces on that corner are unavailable for any simultaneously required nonblank
  class. Seven remaining corners provide only 21 faces for 23 mandatory classes.
- Two or more blank faces need at least 25 faces alongside those 23 classes,
  exceeding the 24 corner faces.

The argument permits arbitrary legal-state reachability, corner orientation,
parity, edge pairing and center behavior beyond the stated strict print-frame
invariant. Relaxing those other restrictions cannot repair this corner-body
contradiction. A source face cannot cover two transported classes, so duplicates
or unused partner faces cannot evade the bound.

## Evidence boundary

Both author native checkers return the same scoped UNSAT result: 146,097 dates,
2,562 targets, corner demand 23 + 1 / 24, edge demand 21 + 1 / 24 and center
demand 4 + 0 / 6. Independent review is pending; this is not yet a confirmed
delivery claim. No solver search, candidate state, application change, print
export or optimized layout was produced. A different optical-alias, font-frame
or layout rule needs a separate owner decision and new evidence.

An initial Julia rejection disagreed with the accepting Flix checker. The status
was set UNKNOWN. Root cause was an incorrectly shared Boolean numeric policy:
Julia's `Bool <: Number` made the model's legitimate `opticalAliases=false` and
`reflections=false` fail the certificate's integer-only check. The fix permits
Boolean tokens only in the byte-pinned model, retaining their rejection as
certificate numbers. Both checkers reran successfully, followed by 16/16 control
results: two expected accepts and fourteen expected rejects. The investigation
and reevaluation are retained in `evidence/dissent-rc.txt`.

The seven negative classes cover a Boolean certificate version, changed demand,
changed per-cell transport demand, changed maximum blank count, changed reserved
body budget, a removed target with its hash correctly rebound, and changed
weekend positions with their hash rebound. Checkers still independently reject
the semantic or immutable-input violation. No Python proof verifier was used.
The full mutation sweep was not run, by owner decision. This additive profile
does not change or repeat the frozen issue-74 corpus checks.

Implementation and one fixed print optimized for both day +1 and day -1 remain
conditional on a feasible validated design. That future objective would report
HTM and QTM mean, median, p95 and maximum, including month, year and leap seams;
it does not authorize treating individually solved dates as different prints.

## Reproduce

Use Julia 1.11.5 with the sibling `../weekends-dual/Project.toml` and pinned
manifest (JSON 1.13.0). Flix 0.79.0, Java 21.0.13, the frozen JSON reader and the
wrapper come from that same sibling profile. The author used a 2 GiB compiler
heap, two compiler threads and a 768 MiB Flix runtime heap; native runs were
serial. No state search was run.

From this directory, choose a new absolute scratch build path:

```sh
BUILD=/absolute/path/to/new-scratch-build
test ! -e "$BUILD"
mkdir -p "$BUILD/src"
cp -R ../weekends-dual/flix/.flixw "$BUILD/"
cp ../weekends-dual/flix/flixw ../weekends-dual/flix/flix.toml ../weekends-dual/flix/packages.lock "$BUILD/"
cp ../weekends-dual/flix/src/JsonRead.flix flix/Main.flix "$BUILD/src/"
(cd "$BUILD" && ./flixw build-fatjar --threads 2)
julia --startup-file=no --project=../weekends-dual check.jl . certificate.json
java -Xmx768m -jar "$BUILD/artifact/flix.jar" . certificate.json
FLIX_JAR="$BUILD/artifact/flix.jar" julia --startup-file=no --project=../weekends-dual controls.jl . /absolute/path/to/new-controls-output
```

Verify the resolved Jackson Core 2.22.4 JAR has SHA-256
`2d30c375cddea9657a1e1ef97547a2694b663b355facb4de53a097782b312d1a`,
as pinned by the sibling `flix/parser-pin.json`. Use scratch Julia and Flix
caches. `JAVA` optionally selects the Java binary for controls. To regenerate
targets in a separate input copy without overwriting retained evidence, run
`julia --startup-file=no generate-targets.jl INPUT_DIRECTORY`; both checkers then
reconstruct every target independently. Retain the matching target hash binding.
