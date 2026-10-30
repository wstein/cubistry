# Final independent native HSM recovery proof review

## Verdict and precise scope

**CONFIRMED for the frozen HSM recovery profile and the two raw inputs below.**
Both independent native implementations completed all eighteen mode graphs,
accepted the same raw inputs and produced byte-identical complete verdicts. A
separate reviewer inspected their mathematics, closed the static findings,
independently checked the actual execution artifacts and performed focused native
runtime checks. No unresolved findings remain for this scoped proof.

This confirms the graph of every legal settled full eight-corner pose displaying
the specified H/S/M value and range, with no global-rotation quotient. Edges
advance one modular display step, include all minimum-cost endpoints attainable
within five HTM when possible, and otherwise include all shortest six-HTM
endpoints. The goal is the bound application period; the objective is exactly
`(above-limit edges, display steps, total HTM)`, in that order.

The result confirms reachability, optimal cost labels, counts, histograms,
rounded/exact means, maxima, period bindings and full-frame sample replay/inverses
under [that contract](../HSM-RECOVERY-PROFILE.md). It does **not** establish:

- global print optimality: **UNKNOWN**;
- runtime reachability of forced M/H poses: **NOT_CHECKED**;
- minimum-mean period certificates: **NOT_CHECKED by this new command**, retaining
  the separate [existing HSM profile](../HSM-PROFILE.md) scope;
- a new bound for browser timing or all user-interface event sequences.

This is not a universal five-HTM claim for minutes or hours. The raw graphs
explicitly include forced six-HTM sources. Seconds retain their five-HTM priority;
the owner accepts six HTM for minutes and up to ten moves for hours. The earlier
implementation approval and this mathematical confirmation are distinct.

## Frozen inputs and reviewed implementations

| Item | Revision or SHA-256 |
| --- | --- |
| Research revision | `30b6d022da60c366d79de5498497df0a07e28caf` |
| Raw recovery input | `0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda` |
| Raw all-mode input | `5dd24dd70d678cc9e7f24da633ba1a772b7ccaf72aa1d4a1622c197ba318c2ae` |
| Julia mathematical source | `249df9d31b1d2c6daa617e88f898ff0c25906300` |
| Julia `Recovery.jl` | `9c044527b808e04f55daa080da366ec237565dfccf0b2df972a41023be4c48dc` |
| Corrected Flix source revision | `ac1b6bf893472044103a552a34654ec1a9162b21` |
| Flix `RecoveryMain.flix` | `1dd0ea4cfb8347661fefbf84c09916847091d21e78486bdf48517400ebb6d21f` |
| Actual Flix artifact | `dd296c1320e42ae3bd7474b67b23f2d1b14f479d1a1c13a8c62aada16435c691` |
| Mathematical contract before wire clarification | `758e95d60b04e0dfa4fb756451510e6abe0ea44d67574669f52e0fb5302c05d6` |
| Contract including wire clarification | `532e0157c241f5086e59ff0fad2f46fe24aae01dbb13e03b674656dfbb9ecd52` |

The wire clarification appends ordering/types without changing mathematics,
inputs or the running Julia source. The reviewer checked both mathematical source
hashes in integration snapshot `a595c00`; they match the independently reviewed
and executed sources.

## Complete native executions and comparison

The respective authors executed the following complete commands, in the required
order: Julia first, then independently implemented Flix on the same raw bytes.
The reviewer did not claim to launch those two full runs again.

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia \
  --startup-file=no --project=proof-checkers/julia \
  proof-checkers/julia/recovery.jl \
  /tmp/hsm-recovery-source.json /tmp/hsm-modes-source.json

java -Xmx1536m -jar proof-checkers/flix-recovery/artifact/flix.jar \
  proof-checkers/conformance-hsm/cases/recovery-unsupported.json \
  proof-checkers/conformance-hsm/cases/modes.json
```

Julia 1.13.3 / JSON 1.13.0: complete run exit 0, observed wall time 1,489.607
seconds. Flix 0.79.0 / Java 21: complete run exit 0, observed wall time 110.354
seconds. These are captured local execution observations, not universal performance
claims; setup/build and compilation boundaries differ. No Python proof engine
participated. Launchers captured process metadata and bytes only.

The reviewer independently read and compared the actual
[Julia output](evidence/hsm-recovery-final/julia-full.stdout.json) and
[Flix output](evidence/hsm-recovery-final/flix-full.stdout.json), rather than
accepting the coordinator's comparison summary. Both are one compact JSON record
plus one LF, **9,756 bytes**, with SHA-256:

```text
0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70
```

Both say `valid:true`, `status:VALID`, contain all eighteen ordered mode summaries
and the correct two raw input hashes. Across those eighteen separately enumerated
graphs they report 1,722,384 nodes, 28,747,368 endpoint edges, 264 sample replays
and 1,061 forward sample steps with per-edge inverse checks. Counts across mode
graphs must not be confused with unique global cube states.

The independent data audit also matched seven Julia source/dependency snapshot
hashes against the reviewed files; matched all seven Flix compiler input hashes
against both the frozen review files and actual copied `work/src` files; checked
the actual JAR digest; and checked the actual temporary Julia input files against
the canonical raw inputs. The
[audit record](evidence/hsm-recovery-final/independent-data-audit.json),
[Julia capture/context](evidence/hsm-recovery-final/julia-full-context.json),
[Flix capture](evidence/hsm-recovery-final/flix-full-run.json) and
[guarded build record](evidence/hsm-recovery-final/flix-build-final.json) are
retained with an [evidence manifest](evidence/hsm-recovery-final/manifest.json).
Data comparison and hashing are not a third mathematical verifier or a vote.

## Independent review and adversarial checks

The historical [Julia static review](HSM-RECOVERY-JULIA-STATIC.md) and
[Flix static review](HSM-RECOVERY-FLIX-STATIC.md) describe the separate source
inspection. Reviewed geometry includes immutable sticker slots/up vectors, real
blank orientations, all hidden-corner permutations/twists, canonical endpoint
coverage and minimum costs, forced-six handling, exact lexicographic shortest
paths, goal/selection/inverse binding, metrics and optimal full-frame samples.

The Julia exact-decimal defect was investigated before the recorded corrected
full run; raw token equality no longer depends on Float64 rounding. The Flix
review found two provenance defects: separate parse/hash reads, and build hashes
of origins instead of actual compiler copies. The author corrected both before
the final complete run. An explicit node bound also protects exact signed-64-bit
packed costs. The static report gives the integer bound. No finding was resolved
by accepting a majority or weakening the contract.

Checks actually executed by this reviewer:

- The [Julia component review](HSM-RECOVERY-JULIA-COMPONENT.md) records an
  independent complete S 00-11 +1 component (79.957 seconds) and 23/23 focused
  parser assertions (12.708 seconds), including commands and source/input hashes.
  Its partial proof output remained `valid:false`, `UNKNOWN`, `PARTIAL`; it was
  never substituted for the complete eighteen-row verdict.
- On the exact final Flix artifact, ran `java -Xmx768m -jar ARTIFACT --self-test`:
  all ten native priority/decimal self-tests passed. Ran seven newly constructed
  raw negative cases through the same artifact's ordinary two-file command:
  unknown schema, Boolean graph count, string mean, wrong print binding,
  duplicate key, BOM and invalid UTF-8. All native exits/statuses/rejections matched
  the contract. Eight JVM calls took 1.528 seconds in total. The observed runtime
  was OpenJDK 21.0.12.1. Exact arguments, raw mutations, actual stdout/stderr and
  timing/digests are preserved in the
  [independent controls record](evidence/hsm-recovery-final/independent-flix-controls/report.json).
- Ran `python3 proof-checkers/tools/audit_corpus.py`: `PASS_DATA_PINS`, 195
  cases, 2,048 kernel rows, 36 generators and 801 chain values; manifest
  `c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
  This script checks data only. Independently hashed all 46 existing HSM case
  files and their exact filename set against unchanged manifest
  `0c497d15ca1cf530c7b8be2a6775723bc562e2583c5c2cfc103265b3a4935993`.

The reviewer also inspected the actual author captures: Julia's 78 native semantic
assertions and eight raw CLI controls passed; Flix's final 39 raw controls passed,
including two accepted partial diagnostics and 37 rejections. Flix's isolated
legacy native 195-case run passed; its old `hsm RECOVERY.json` entrypoint still
rejects that schema as UNSUPPORTED. The old 46-case HSM corpus was hash-audited,
not falsely reported as a newly repeated full semantic run. Existing source,
dependency pins, dispatch, corpora and expected outcomes have no changes.

## Dissent, limitations and delivery boundary

There is **no observed accept/reject, full-result, count or hash dissent** in the
complete native comparison. No new class-only differences were observed in the
comparisons performed. Existing issue-74 class-only differences remain historical
and unchanged; the pinned coverage ledger was not edited. Invalid reason strings
need not match under the frozen wire contract.

Both complete native acceptances plus this independent review establish scoped
confirmation. They do not prove global print optimality or runtime reachability
of forced poses. Earlier partial, interrupted and failed-preflight evidence is
retained and is not retroactively upgraded to complete proof acceptance.

This report completes the proof review. It does not mark an uncreated or untested
integration PR ready. The separate implementation/evidence PR still needs its
exact-head required CI and final integration check before reviewer-owned readiness.
No merge, auto-merge or deployment is authorized or performed.
