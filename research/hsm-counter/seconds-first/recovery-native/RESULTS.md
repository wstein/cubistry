# Native HSM recovery result

**SAT / CONFIRMED for the frozen recovery model and two raw inputs.** Julia ran
first; a separately implemented Flix checker then read the same unchanged files.
Both complete native results are byte-identical: 9,756 bytes, SHA-256
`0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70`.
The [comparison](comparison.json), [manifest](manifest.json) and unchanged
[final independent review](reviews/final-review.txt) bind the precise scope.

Across 18 mode graphs, both implementations independently rebuilt 1,722,384 nodes
and 28,747,368 directed edges; checked every histogram and exact rounded mean;
and replayed 264 sample paths, 1,061 forward display steps and their edge/full
inverses. Reverse shortest paths optimize above-five edges, then display steps,
then HTM within the specified graph. This is not global print optimization.

| Execution | Native source revision | Wall seconds | Peak RSS, KiB |
| --- | --- | ---: | ---: |
| Julia 1.13.3 | `249df9d31b1d2c6daa617e88f898ff0c25906300` | 1489.607 | 657952 |
| Flix 0.79.0 / Java 21 | `ac1b6bf893472044103a552a34654ec1a9162b21` | 110.354 | 1311372 |

These are measured invocations of different implementations on a shared worker,
not controlled language benchmarks or zero-startup-cost claims. Build/setup
costs are separate; exact commands, resource records, versions and artifact/source
hashes are retained in the [Julia delivery](deliveries/julia/README.md) and
[Flix delivery summary](deliveries/flix/summary.json), with their evidence archives.
Source snapshots make the originally executed revisions reproducible even when
the final feature branch is rebased; integrated source bytes were independently
audited against the executed code.

Julia passed 23 focused parser assertions, 78 semantic assertions and eight real
CLI mutation cases. Flix passed ten native controls and 39 raw cases (37 rejects,
two legitimate partial acceptances). Both passed native 195-case regressions and
kept the old HSM recovery command UNSUPPORTED; the old 46-case HSM corpus received
data-pin audits, not repeated full semantic runs. The reviewer additionally ran
a complete selected-mode Julia smoke, its parser suite and independent Flix
controls, and verified both full outputs and source/artifact bindings.

The [decimal root cause](findings/mean-decimal-rc.md), first partial smoke and
operator-canceled obsolete baseline are preserved; they are not presented as
full acceptances. Static Flix provenance findings were corrected before its full
run. No actual cross-checker dissent occurred, and no Python proof verifier or
majority vote decided confirmation.

Global print optimality remains **UNKNOWN**. Runtime reachability of forced
six-HTM poses and minimum-mean period certificates are **NOT_CHECKED by this
recovery command**. The latter have their separate original profile. The graph
explicitly permits a forced shortest-six first step for M/H where five is
impossible; it does not prove every runtime transition uses five. Owner runtime
acceptance remains seconds-first, six for minutes and at most ten for hours.
