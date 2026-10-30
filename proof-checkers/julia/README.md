# Independent Julia checker

This optional checker implements the two bounded groups in [issue 74](https://github.com/wstein/cubistry/issues/74)
against the shared [specification](../SPEC.md). Since the 2026-10-29
[authority change](../AUTHORITY.md) it is, together with
the Flix checker, the authoritative verifier; Python verifiers play no role in confirmation. The issue
74 delivery left existing Python, production and CI unchanged. It reads raw certificate/state JSON directly; Python is used
only for separate conformance/audit tooling.

Use Julia 1.13.3 and the committed Project/Manifest (JSON 1.13.0, MIT licensed).
The independent semantic/group-action code is covered by the repository license.
JSON parsing is reused; identity, schema, targets, reachability and exact integer
Rodrigues replay are implemented here without production/solver imports.

```sh
export JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot
julia --startup-file=no --project=proof-checkers/julia -e 'using Pkg; Pkg.instantiate()'
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl counter public/counter-proof.json
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl state3 proof-checkers/conformance/geometry/outer-R-quarter.json
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl conformance "$PWD" /tmp/NEW-julia-full-states.jsonl
python3 proof-checkers/julia/protocol_test.py --julia /path/to/julia
```

`counter FILE [REPO_ROOT]` also checks the pinned chain bytes outside conformance.
`state3 FILE` returns every actual fixed-frame sticker and separately reports
physical center twists and optional optical-goal matching. Invalid/unsupported
input cannot claim SAT/UNSAT. Exits are 0 valid, 1 invalid/invalid JSON, 2 unsupported
command/schema and 3 unexpected runtime/I/O/corpus-integrity failure. Reasons and
statuses are structured JSON; compiler/dependency failures before entry are
prerequisite failures, not certificate verdicts.

Conformance enforces the exact manifest hash and all 195 names/input hashes, then
executes 41 counter cases, 154 marked-state cases, 36 center generators and 2,048
kernel references. All 121 explicit geometry words are actually replayed and
inverted, including 369 whole rotations (469 quarter equivalents) and 628 outer
HTM. No xyz token is removed because an external optimizer might price it at zero.

The JSONL export is optional and must use a new path. It retains 2,413 complete
states for independent comparison: 200 counter canonical states, 129 valid marked
states, 36 generator endpoints and 2,048 kernel endpoints. Metadata is
`group/name/state`, with a separate `value` for counter records. Generator names
are ordinal strings 0–35; kernel names are the corpus's bit-index strings.

```sh
python3 proof-checkers/tools/audit_exports.py /tmp/NEW-julia-full-states.jsonl --research-root /path/to/pinned-research --output /tmp/NEW-audit.json
```

The audit compares all 124,302 actual sticker frames against unchanged independent
Python/Research replay. Keep the original Research revision/hashes shown in the
shared manifest; do not substitute application move code as an oracle.

## Full-conformance lifecycle

```sh
python3 spikes/test-language/lifecycle_driver.py --output /tmp/NEW-julia-full-life --label julia-full --timeout 600 -- julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/lifecycle.jl "$PWD"
```

Each of four calls reruns the complete two-group conformance, including every
corruption, word, target, full-state hash, inverse and reachable-state check.
There is no microkernel substitution, cached verdict or forced garbage collection.
READY/load/first complete/warm complete/observed exit are separated. Cold dependency
installation and package precompile are separate from first-use method JIT.

Default compiler optimization is preferred for this larger replay workload. The
old small-spike `-O0` startup win did not carry over: measured four-call totals were
22.69 seconds with normal optimization versus 38.09 seconds with `-O0`. Those are
shared-machine observations, not universal timings or a claim that all project
proof formats have been ported. Full production-suite migration remains out of scope.

## HSM seconds-first profile

`hsm FILE` and `hsm-conformance REPO_ROOT` verify the raw HSM witnesses of
[HSM-PROFILE.md](../HSM-PROFILE.md) (source `Hsm.jl`, independent of the Flix
implementation). They are additive; `counter`, `state3` and `conformance` are unchanged.

```sh
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl hsm proof-checkers/conformance-hsm/cases/witness.json
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/check.jl hsm-conformance "$PWD"
```

Run time on a shared two-core machine: about 35 seconds for the eight-mode witness and about
50 seconds for the all-modes witness (includes first-call compilation).
