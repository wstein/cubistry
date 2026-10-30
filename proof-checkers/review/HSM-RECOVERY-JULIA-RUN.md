# Native Julia recovery validation record

Julia source `249df9d31b1d2c6daa617e88f898ff0c25906300` accepted the complete
[eighteen-mode recovery profile](../HSM-RECOVERY-PROFILE.md). Overall confirmation
is **UNKNOWN** at this Julia checkpoint: independent Flix acceptance and final
review are still required. The [authority rule](../AUTHORITY.md) applies.
Tracking: [issue 98](https://github.com/wstein/cubistry/issues/98).

## Inputs and implementation

Research origin: `30b6d022da60c366d79de5498497df0a07e28caf`, files
`research/hsm-counter/seconds-first/modes/recovery.json` and `witness.json`.
The unchanged corpus retains their exact raw bytes:

| Input | SHA-256 |
| --- | --- |
| [Recovery](../conformance-hsm/cases/recovery-unsupported.json) | `0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda` |
| [All modes](../conformance-hsm/cases/modes.json) | `5dd24dd70d678cc9e7f24da633ba1a772b7ccaf72aa1d4a1622c197ba318c2ae` |

Runtime: Julia 1.13.3 / JSON 1.13.0, committed Project/Manifest, depot
`/tmp/cubistry-julia-depot`. All fresh-process measurements include method
compilation and use the installed package cache. They are shared-machine
observations, not universal timing claims. The corrected full run had no profiler
or operator intervention and did not force garbage collection.

The implementation and entrypoint hashes were:

- `Recovery.jl`: `9c044527b808e04f55daa080da366ec237565dfccf0b2df972a41023be4c48dc`.
- `recovery.jl`: `cd6e72a893c52d1a8ff1dc3235acd6f01d9856d9e8f499f59032c7ba38edac54`.

The run began with mathematical contract SHA-256
`758e95d60b04e0dfa4fb756451510e6abe0ea44d67574669f52e0fb5302c05d6`.
Documentation-only revision `ef3602c` subsequently specified the emitted wire
order/types; current profile SHA-256 is
`532e0157c241f5086e59ff0fad2f46fe24aae01dbb13e03b674656dfbb9ecd52`.
Neither mathematics, raw inputs nor running source changed.

## Complete positive execution

Exact native command, from the repository root, with
`JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot`:

```sh
/tmp/julia-1.13.3/bin/julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery.jl /tmp/hsm-recovery-source.json /tmp/hsm-modes-source.json
```

The two temporary files were byte-identical to the corpus inputs above. The
[standalone instructions](../julia/RECOVERY-README.md) give an equivalent command
using the committed corpus paths directly.

Observed result: `valid:true`, `status:VALID`, all 18 rows, exit 0. Across the
separate mode graphs the checker rebuilt 1,722,384 full-pose nodes and 28,747,368
minimum-cost endpoint edges. It replayed 264 raw sample rows, 1,061 forward steps,
1,061 per-edge inverse checks and 264 complete sample inverses. Every scoped
count, histogram, objective, exact mean and maximum matched the raw witness.

Elapsed: 1,489.607 seconds; child user CPU: 1,488.836 seconds; child system CPU:
0.715 seconds; maximum resident size: 657,952 KiB. The authoritative native output
was one 9,756-byte compact JSON line, followed by exactly one LF, SHA-256
`0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70`.
Raw stdout/stderr, measured exits/resources, runtime/driver hashes, source snapshots
and input bindings are retained in the coordinator's evidence bundle.

## Native controls

The same source passed the following native suites:

```sh
/tmp/julia-1.13.3/bin/julia --startup-file=no --compile=min --project=proof-checkers/julia proof-checkers/julia/recovery-parser-tests.jl /tmp/hsm-recovery-source.json /tmp/hsm-modes-source.json
/tmp/julia-1.13.3/bin/julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery-tests.jl /tmp/hsm-recovery-source.json /tmp/hsm-modes-source.json
```

- Exact-decimal parser controls: 23/23 assertions, exit 0, elapsed 11.819 seconds,
  maximum resident size 384,580 KiB. Controls cover scientific equivalents, a
  nearby decimal that collides as `Float64`, escaped keys and label-string decoys,
  extreme exponents, leading zeros, signed zero and original-byte binding.
- Semantic/component controls: 78/78 assertions, exit 0, elapsed 602.398 seconds,
  maximum resident size 500,444 KiB. These include lexicographic objective traps,
  ties-to-even rounding, comparison with all 6,174 unpruned physical-frame words
  through depth three, complete-graph count/histogram/mean corruptions, and sample
  defects. A bounded legal `R R'` detour preserves the final pose but is rejected
  specifically for nonoptimal cost. Semantic mutations rebuild a complete small
  mode graph; they do not reuse a saved verdict.

Eight additional raw CLI cases all produced the expected native rejection and
exit. They corrupt print binding, fractional/whole-valued/exponent integer tokens,
full-pose count, move notation, duplicate keys or version-token type. Captured
reasons identify the actual defect, including independently enumerated node-count
mismatch. The existing raw all-mode file was the second argument for every case.
Seven early-rejection cases used `--compile=min`; the node-count case used normal
compilation. Exact arguments, case bytes/hashes, statuses, reasons, exits and
resources are retained individually. These are native CLI tests, not hash-only
rejections or a third proof checker.

## Legacy regression scope

The existing native Julia 195-case conformance passed with `valid:true`,
`status:VALID`, exit 0, manifest SHA-256
`c0d0fa2fc6d692c7c89e436fe5a2670503d8a8a6c86a2cc0d1397be983832e01`.
Elapsed 15.732 seconds; maximum resident size 755,208 KiB. Exact command:

```sh
/tmp/julia-1.13.3/bin/julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl conformance /workspace/cubistry-hsm-recovery-julia
```

The unchanged old HSM command still returned `UNSUPPORTED` and expected exit 2,
elapsed 1.838 seconds, maximum resident size 315,140 KiB:

```sh
/tmp/julia-1.13.3/bin/julia --startup-file=no --compile=min --project=proof-checkers/julia proof-checkers/julia/check.jl hsm /tmp/hsm-recovery-source.json
```

The 195-case corpus data audit passed. The unchanged 46-case HSM manifest,
filenames and input hashes also passed a data-only audit, with manifest SHA-256
`0c497d15ca1cf530c7b8be2a6775723bc562e2583c5c2cfc103265b3a4935993`.
The complete old 46-case native semantic suite was not rerun. Existing pinned
sources, dependencies, dispatch, corpus, coverage and historical evidence were
not modified. Python was used only for data hashes and process/resource
instrumentation, never as a proof verifier or dissent oracle.

## Investigation history and limits

The [mean-token root cause](HSM-RECOVERY-MEAN-RC.md) was committed before its
approved fix. A prior partial one-mode smoke remained `UNKNOWN`. The obsolete
pre-fix full run was deliberately interrupted by `SIGINT` at 1,293.360 seconds,
child exit -2 and empty stdout; it remains `INTERRUPTED_UNKNOWN`. Its original
loaded source and diagnostics were preserved, including an earlier one-second
information-request profile. It was not recorded as a witness rejection.

No actual Flix/Julia dissent occurred at this Julia checkpoint; new-profile
cross-language status differences had not yet been compared. Julia acceptance
alone does not establish confirmation. Runtime reachability of forced M/H poses
is `NOT_CHECKED`, global print optimality is `UNKNOWN`, and period minimum-mean
certificates remain outside this recovery command. The result makes no universal
five-HTM recovery claim.
