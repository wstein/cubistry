# Printed orientation overflow: root-cause report

Investigator: Codex Sol; 2026-10-30. Branch:
`research/calendar-7x7-en-physical-proof`. Authority: `origin/main:AGENTS.md`
and `origin/main:proof-checkers/AUTHORITY.md`, read before investigation.
Initial status was `UNKNOWN` pending correction and both native reruns.
No checker source was edited by the investigator. The closure below records
subsequent checker-author corrections and rerun evidence; final independent
review owns the overall feasibility verdict.

## Reproduction and provenance

Working directory for commands: `/workspace/cubistry-calendar5-research`.
Java: OpenJDK 21.0.12.1; Julia: 1.13.3.

SHA-256:

| Artifact | SHA-256 |
| --- | --- |
| `/tmp/calendar7-en-review-before-overflow-fix.jar` | `7a41b036ba9dbea152bb0cb729a8e5b701ae38af0953cacc52062830175d3059` |
| `/tmp/calendar7-en-review-overflow/physical-print.tsv` | `58b26265a392049333fc098a1fb46eacf0ef561eba88a0b4092f64f900498608` |
| Original `evidence/physical-print.tsv` | `b2a9fa1fd96343c6403cb4a9d7bb0f684b539cc26c0b6154c71728f3053c7931` |
| Fixture `front-matches.tsv` | `e972d7bdc1d64761bc0913e20e5545025f9dfb8e3a6b8de181605086cfcaf757` |
| Fixture `targets.tsv` | `ac58cbf371c60be82e52f73a1fc8c4f3aa8a46903a27d5246150785f0cb60a3d` |

`diff -u research/calendar-7x7/english/evidence/physical-print.tsv /tmp/calendar7-en-review-overflow/physical-print.tsv`
shows exactly one change: blank sticker 25, normal `(0,0,1)`, has up
`(65536,1,0)` instead of `(0,1,0)`. Glyph and ink remain empty/blank.

Independently rerun commands:

```sh
java -jar /tmp/calendar7-en-review-before-overflow-fix.jar data /tmp/calendar7-en-review-overflow /workspace/cubistry-calendar5-research/research/calendar-7x7/en-physical-review
/workspace/shared/calendar-tooling/julia-1.13.3/bin/julia --startup-file=no -e 'include("research/calendar-7x7/english/replay_legal.jl"); read_physical("/tmp/calendar7-en-review-overflow/physical-print.tsv")'
```

Flix exits 0, accepting inventory `294 / 240 / 54` and all `91 / 4459`
front matches with status `VALID_DATA_AND_MINIMUM_COUNT`. Julia exits 1 at
`read_physical`, line 34, with the printed orientation assertion failure.
This is an accept/reject dissent, not a class-only difference.

## Cause and boundary

`flix/src/Core.flix` defines `Vec` with `Int32` components and defines
`unit(v)` as `dot(v,v)==1`. Multiplication and addition use fixed-width
arithmetic: `65536 * 65536 = 2^32`, which wraps to zero. Thus
`unit((65536,1,0))` is true although the vector is not an axis vector.
Its dot product with `(0,0,1)` is zero, so `Data.flix:readPrint` accepts it.
This is a soundness defect in physical printing validation.

The changed blank sticker is unused by the supplied front-match witnesses;
those witnesses therefore never send its malformed up vector to `upAngle`,
whose exact direction lookup could otherwise reject it. Blank or hidden
stickers still require physical orientation at ingress. Every command that
calls `readPrint` shares the defective boundary, including legal replay;
this reproduction establishes acceptance by `data`, not full legal acceptance
of this corrupt printing.

Home and normal tuples are checked against independently generated bounded
surface tuples before vector arithmetic. Other pose/move tables are compared
to generated geometry. The unbounded raw printed up vector is the direct
arithmetic ingress involved here. This finding does not establish a general
audit of unrelated integer counters or resource limits.

Julia's `sum(abs,up)==1` also must not be described as an overflow-free unit
test in isolation: on this runtime,
`sum(abs,(typemin(Int),typemin(Int),1))` evaluates to `1`.
That example fails the separate tangent constraint for every axis normal;
no Julia printing-acceptance exploit is established by it. Exact membership
is nevertheless simpler and removes reliance on overflow reasoning.

## Minimal correction and required reevaluation

Define unit vectors by exact membership in the six tuples
`(1,0,0), (-1,0,0), (0,1,0), (0,-1,0), (0,0,1), (0,0,-1)`.
At printing ingress require that membership in a separate check before any
dot or cross operation involving the parsed up vector. Retain the tangent
test after this check. Apply the same explicit membership to Julia printing
ingress. Do not merely widen the norm arithmetic: that moves the overflow
boundary instead of expressing the finite physical domain.

The actual printing is unchanged and uses legitimate axis directions;
changing this predicate preserves its interpretation. Prior matching native
91-state results concern the original printing, not the corrupt fixture.
They do not waive the required reevaluation: both native checkers must rerun
the original full witness, compare all state hashes/counts, and reject this
fixture plus malformed direction boundary cases after correction. Only those
results can restore a confirmed feasibility verdict. No vote or third-source
verdict was used.

## Root-cause closure after correction

The Flix author replaced `unit` with exact six-axis membership and split
printing membership validation from the subsequent tangent dot product. Julia
now checks `up in AXIS_UNITS` before its tangent calculation. Inspection of
the corrected source confirms the proposed finite-domain boundary is in place.

Corrected SHA-256 values:

| File | SHA-256 |
| --- | --- |
| `flix/src/Core.flix` | `01719a6d01f9bb2021d51d621905571d2165c7540767729a66d04c9370935d5a` |
| `flix/src/Data.flix` | `29058ab830cb41edc3ea1b02d334f73e054e0630a9a79468dcfb0084de345b41` |
| `replay_legal.jl` | `c405bd9cac39ccf13236cb69a48fb278c32d701c9a7d0c0c7faa198c7f51b444` |
| `flix/artifact/flix.jar` | `453d5d565999509e207b73de13c6e41109e500fa2bd17764b1c217e5f73687fc` |

The investigator inspected the post-correction receipts, rather than rerunning
the full witness a second time. [Flix checks](../flix/checks.tsv) and
[Julia checks](../evidence/julia-negative-checks.tsv) show rejection of all
26 shared malformed inputs, including the exact overflow printing hash
`58b26265a392049333fc098a1fb46eacf0ef561eba88a0b4092f64f900498608`.
Flix now exits 1 with `printed actual up must be one of six signed coordinate axes`;
Julia also rejects. Both accept the positive alternative tangent axis on the
same unused blank sticker, input hash
`f13de704c7a7b54c15fe4796ff4f9da0a3fb3874b67fa3f80bf14b1990591ef7`.

The [state comparison receipt](../flix/state-comparison.log) records exact
agreement of all 91 complete 294-sticker state hashes, coverage of 888 months,
and printing count 240 equal to the native lower bound. The Julia rerun log
`/tmp/calendar7-en-final-full.log` also records the full 91-state replay,
minimum 240, and exact chained transition. The original printing hash remains
unchanged. Thus the correction preserves the supplied actual witness while
closing the demonstrated malformed-input acceptance path.

Before-fix acceptance receipts remain in
[overflow-before.stdout.tsv](../flix/overflow-before.stdout.tsv),
[checks-before-overflow-fix.tsv](../flix/checks-before-overflow-fix.tsv), and
[toolchain-before-overflow-fix.log](../flix/toolchain-before-overflow-fix.log).
The old binary and fixture hashes above remain the reproduction provenance.
The reported accept/reject dissent is resolved on the shared controls; this
root-cause closure does not assign the canonical overall feasibility verdict.
