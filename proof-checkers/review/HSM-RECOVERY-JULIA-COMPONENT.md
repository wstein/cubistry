# Independent Julia recovery component execution

This execution supplements, and does not replace, the historical
[static review](HSM-RECOVERY-JULIA-STATIC.md). Reviewed source remains
`175c68587fca8d1d2ba4f9dffffd51437fade077`, with mathematical implementation
`249df9d31b1d2c6daa617e88f898ff0c25906300`. No checker implementation was edited.
The author and this reviewer used separate worktrees.

**Verdict: UNKNOWN.** The complete selected S 00-11 +1 component passed its
graph, optimum, metric and sample checks, but this invocation deliberately checked
only one of eighteen rows. The native result correctly states `valid:false`,
`status:UNKNOWN` and `recoveryReturnOntoPeriod:PARTIAL`. The focused parser tests
are regression controls, not a complete proof. Independent Flix implementation
and the final complete-output comparison remain required by the
[authority rule](../AUTHORITY.md).

## Environment and immutable inputs

- Julia 1.13.3, with JSON 1.13.0 from the unchanged Project/Manifest.
- Depot: `/tmp/cubistry-julia-depot`.
- Recovery raw input: `proof-checkers/conformance-hsm/cases/recovery-unsupported.json`,
  SHA-256 `0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda`.
- All-mode raw input: `proof-checkers/conformance-hsm/cases/modes.json`,
  SHA-256 `5dd24dd70d678cc9e7f24da633ba1a772b7ccaf72aa1d4a1622c197ba318c2ae`.
- `Recovery.jl` SHA-256:
  `9c044527b808e04f55daa080da366ec237565dfccf0b2df972a41023be4c48dc`.
- Frozen contract SHA-256:
  `758e95d60b04e0dfa4fb756451510e6abe0ea44d67574669f52e0fb5302c05d6`.

The [execution manifest](evidence/hsm-recovery-julia-component/manifest.json)
records the dependency/source/input hashes and every captured output hash. Both
native invocations read the original files themselves. The small Python
subprocess launcher recorded timing, child exit status and memory only; it did
not preprocess proof input, implement mathematics or determine a proof verdict.

## One-mode native execution

Executed from the separate review worktree:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia \
  --startup-file=no --project=proof-checkers/julia -e '
include("proof-checkers/julia/Checker.jl");
include("proof-checkers/julia/Hsm.jl");
include("proof-checkers/julia/Recovery.jl");
valid,status,text=IndependentRecovery.evaluate(
  "proof-checkers/conformance-hsm/cases/recovery-unsupported.json",
  "proof-checkers/conformance-hsm/cases/modes.json"; smoke_index=5);
println(text);
@assert !valid && status=="UNKNOWN"'
```

Observed wall time: **79.957 seconds**, including process startup, method
compilation, model construction and selected-mode execution. Harness exit: 0;
maximum resident size: 567,656 KiB. Exit 0 here means the explicit partial-mode
harness completed and retained the required UNKNOWN result. It does not turn the
native partial result into a valid complete-proof verdict.

The checker replayed the eighteen own periods and inverse closures, then
independently enumerated the selected mode's full poses, rebuilt its endpoint
graph, ran lexicographic shortest paths and checked its metrics and sample
inverses. The [raw output](evidence/hsm-recovery-julia-component/smoke.stdout.json),
[diagnostics](evidence/hsm-recovery-julia-component/smoke.stderr.log) and
[invocation metadata](evidence/hsm-recovery-julia-component/smoke-run.json)
are retained without converting this component run into confirmation.

An initial attempt to use `/usr/bin/time` exited 127 before Julia entry because
that utility is absent. Its
[preflight diagnostic](evidence/hsm-recovery-julia-component/preflight-missing-time.stderr.log)
is preserved separately. It was a launcher prerequisite failure, not an invalid
certificate or checker dissent. The successful metadata-only launcher did not
change the native command or its proof input.

## Exact-decimal parser controls

Executed after the smoke, in the same exclusive CPU window:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot /tmp/julia-1.13.3/bin/julia \
  --startup-file=no --compile=min --project=proof-checkers/julia \
  proof-checkers/julia/recovery-parser-tests.jl \
  proof-checkers/conformance-hsm/cases/recovery-unsupported.json \
  proof-checkers/conformance-hsm/cases/modes.json
```

Result: **23/23 assertions passed**, exit 0, wall time **12.708 seconds**,
maximum resident size 387,296 KiB. These include equivalent decimal/scientific
tokens, an unequal decimal that collides as Float64, extreme exponents, escaped
keys, label-string decoys and changed-file SHA binding. Actual
[stdout](evidence/hsm-recovery-julia-component/parser.stdout.log),
[stderr](evidence/hsm-recovery-julia-component/parser.stderr.log) and
[invocation metadata](evidence/hsm-recovery-julia-component/parser-run.json)
are preserved.

Both local processes finished before the CPU slot was released to the independent
Flix author. No Julia algorithm or computed mode values were sent to that author.
This reviewer did not execute a second complete eighteen-mode proof or rerun the
old native semantic corpora in this window. The previous data-pin checks remain
data audits only. No native class-only differences were compared in this run.

No source or pinned evidence was changed, no complete proof was declared
CONFIRMED, and no pull request promotion, merge or deployment follows from this
component report.
