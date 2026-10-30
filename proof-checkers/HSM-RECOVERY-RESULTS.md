# Native HSM recovery proof results

**SAT / CONFIRMED for the frozen recovery graph and exact two raw inputs.**
Julia was implemented and run first; a separate Codex Sol author then implemented
Flix from the same contract without reading the new Julia code or results.
The [final independent review](review/HSM-RECOVERY-FINAL.md) clears the scoped
proof. Closes the verification work tracked in
[issue 98](https://github.com/wstein/cubistry/issues/98).

## Exact evidence and scope

- Recovery input SHA-256:
  `0679d41c0f7241787a6680e8cea66f0b82c6c57eb02a11225f4e1a7efe162bda`.
- All-mode witness SHA-256:
  `5dd24dd70d678cc9e7f24da633ba1a772b7ccaf72aa1d4a1622c197ba318c2ae`.
- Both native outputs: 9,756 byte-identical bytes, SHA-256
  `0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70`.

Across eighteen graphs, each checker independently rebuilt **1,722,384 nodes and
28,747,368 directed edges**; verified exact lexicographic recovery costs,
histograms and rounded means; and replayed **264 sample paths / 1,061 steps**
with complete edge/path inverses. Counts are summed across mode graphs, not
claimed unique across different ranges or directions.

The [profile](HSM-RECOVERY-PROFILE.md) defines the graph: next-display edges up to
five HTM, or shortest-six edges when five is impossible. Shortest paths minimize
above-five edges, then display steps, then HTM. It does not assert universal
five-HTM recovery. Owner runtime acceptance is seconds-first, six for minutes,
and at most ten for hours; those policies do not change the graph.

**Not confirmed by this command:** global print optimality remains UNKNOWN;
runtime reachability of forced poses and minimum-mean period certificates remain
NOT_CHECKED. The original period proof has its separate profile. Application
behavior remains software-tested, not formally proven by these graph validators.

## Reproduce

The unchanged old HSM corpus contains the exact frozen inputs. Its original
`hsm FILE` command intentionally remains UNSUPPORTED for recovery. Use these
new standalone entrypoints after the setup/build instructions in the
[Julia README](julia/RECOVERY-README.md) and [Flix README](flix-recovery/README.md):

```sh
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery.jl proof-checkers/conformance-hsm/cases/recovery-unsupported.json proof-checkers/conformance-hsm/cases/modes.json
java -Xmx1536m -jar proof-checkers/flix-recovery/artifact/flix.jar proof-checkers/conformance-hsm/cases/recovery-unsupported.json proof-checkers/conformance-hsm/cases/modes.json
```

The originally executed native revisions were Julia `249df9d` and Flix
`ac1b6bf`. After integration/rebase, all seventeen executed source/dependency
files remain byte-identical. Full source snapshots, tool/runtime/build/input
hashes, commands, exits, outputs, controls, reviews and historical failed or
interrupted attempts are retained at immutable
[research revision 6137579](https://github.com/wstein/cubistry/tree/613757999aebed2f839ea94d732d30ac9392d619/research/hsm-counter/seconds-first/recovery-native).

## Validation and limits

Julia passed 23 focused parser assertions, 78 semantic assertions and eight real
CLI negative cases. Flix passed ten native controls and 39 raw cases (37 rejects,
two legitimate partial acceptances). Both passed native 195-case regressions and
preserved old recovery UNSUPPORTED behavior. The old 46-case HSM corpus received
data-pin audits only; its unchanged full native semantic suite was not repeated.
The reviewer independently ran a complete selected-mode Julia smoke, its parser
controls, and additional Flix tests, and audited both full results and source/
artifact bindings. No actual cross-checker dissent occurred.

The exact-decimal input defect and two static Flix provenance findings were
corrected before final verification. The interrupted obsolete Julia baseline
and pre-entry setup failures remain evidence, not successful proof runs. Python
utilities only launch processes or audit hashes; they do not decide proof validity.

| Complete native invocation | Wall seconds | Peak RSS, KiB |
| --- | ---: | ---: |
| Julia 1.13.3 | 1489.607 | 657952 |
| Flix 0.79.0 / Java 21 | 110.354 | 1311372 |

These are shared-worker execution observations for different implementations,
not a controlled language benchmark. Build/setup costs were recorded separately.
Existing pinned contracts, dispatch, evidence, corpora and CI workflows are unchanged.
