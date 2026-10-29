# Independent complete-suite lifecycle review

Reviewer work remained separate from author implementation. Reviewed aggregate
`2a9a859312d37d389f99baff4931563b530b5834`, Julia/Python lifecycle sources from
`1d31e65` plus hardening, Flix lifecycle sources retained through `0e1b3cf`, and
GNU Octave lifecycle `bca8f48d43f80cb95640157452fac8471413ba83`.
Final narrative/provenance reconciliation is pending before final clearance.

## Independent execution

All four actual runtime lifecycles were independently executed through the common
parent observer. Each fresh process runs one complete first suite and three
complete warm suites. Warm paths do not substitute the optional throughput kernel.

- Julia: each invocation reparses the positive witness and all ten corruptions,
  reruns six language assertions, padded/unpadded checks, 100 complete endpoints,
  100 full inverse checks, and an endpoint checksum. All four state SHA-256 values
  equal the independently run unchanged Python oracle. Hardened source/control
  hashes equal the actual file bytes in every iteration.
- Python: each invocation calls the unchanged full checker, including its broader
  chains and proof premises, rejects all ten corruptions, and audits complete
  endpoint states. Fresh source/fixture data are loaded for every run.
- GNU Octave: each invocation calls the unchanged positive/inverse/six-negative
  probe and exports 2,400 actual frames. The reviewer independently audited all
  four exports (9,600 frames) against unchanged Python geometry, with 400 inverse
  checks and 24 negative controls confirmed by the complete logs.
- Flix: each invocation calls unchanged `geometryChecks()` and an additional
  full 100-word frame checksum audit. The Python audit confirms checksum 29748
  in all four calls, 100 typed endpoints, 100 inverses and six controls per call.
  The separate lifecycle JAR SHA-256 is
  `45b3c40a7ed74d7ee8a92707cf1a5175327a25805299e1c9c2d248c833274ede`.
  The original standalone artifact and lifecycle artifact are distinct.

Reviewer observations (milliseconds, one local process each):

| Runtime | First complete child call | Three warm complete child calls | Observed DONE-to-exit tail | Total process wall |
| --- | ---: | --- | ---: | ---: |
| Julia, initial independent run | 717.77 | 16.76 / 47.63 / 14.51 | 22.12 | 2125.29 |
| Python | 527.62 | 546.85 / 550.61 / 527.30 | 5.04 | 2179.83 |
| GNU Octave | 4450.64 | 4537.99 / 4477.86 / 4603.21 | 11.70 | 18156.73 |
| Flix compiled lifecycle | 140.72 | 18.47 / 9.91 / 13.96 | 7.71 | 276.57 |

These rows have different coverage and must not rank the languages as replacement
gates. Repeated child-call durations exclude some surrounding runtime dispatch,
JIT, JSON-marker serialization and observation overhead; their sum is not the total
process time. In particular, Julia first-call parent envelopes contain substantial
compilation work outside its inner timer. Runtime/module loading and compiler/build
preparation must remain separately disclosed. Runtime/dependency caches were already
populated; a fresh process is not a cold installation or cold operating-system cache.

## Finding and resolution

The first lifecycle version accepted a Julia control directory containing fewer
than the contracted ten files. The author fixed this in `2a9a859` by requiring the
exact names and emitting hashes for the bytes actually parsed. Reviewer reproduction
with nine files is now rejected before validation. The same commit requires exact
phase order and exactly four results in the common observer.

Independent `lifecycle_contract_test.py`: six tests PASS, covering a valid sequence,
truncated calls, early DONE, changing coverage, missing controls and changing state.
The reviewer also checked all four hardened Julia source/control hash maps against
actual bytes; every run includes six language contracts and all ten corruptions.

## Interpretation limits

READY/DONE records are flushed in each actual runtime. Parent startup and exit
observation use the parent's monotonic clock; child elapsed values use only child
relative durations. No subtraction of unrelated absolute clocks occurs. All
observed exit tails are positive. They include scheduling, pipe delivery, runtime
cleanup and parent wait observation; they are not isolated destructor CPU time or
proof of a universally zero/nonzero intrinsic teardown cost. No garbage collection
or cleanup was forced to manufacture a result.

The full repository's Python suite is not ported. Julia omits broader proof schemas
and chains; Octave additionally omits unpadded/schema/cubie checks; Flix uses a
Python JSON/token adapter and compiled typed expectations. Build/cache invalidation
and clean-toolchain setup costs remain outside compiled Flix invocation latency.
Complete migration equivalence remains UNKNOWN. Existing proof/production/CI files
remain unchanged. No review publication, Ready transition, merge or deployment was
performed.

## Final frozen narrative and evidence clearance

Final aggregate reviewed:
`2bbdfab7cb851e923d2a71b4ec2d51494273daf2`.

The reviewer independently recomputed all four lifecycle table rows directly from
parent event receipt timestamps, including first/warm envelopes, startup, nonzero
exit tails and total wall time. Every displayed rounded value matches. The final
narrative separately reports child-internal durations and explicitly discloses
Julia's substantial first-call compilation/protocol work outside its inner timer;
it does not sum small inner timers into a fabricated total. Cached Julia package
setup and Flix compilation/acquisition remain distinct from runtime/checker phases.

All 42 source/evidence SHA-256 entries in the lifecycle manifest, all ten actual
corruption-file hashes, and unchanged proof/oracle hashes independently verified.
Repository-relative links in LIFECYCLE.md, RESULTS.md and README.md resolve. Existing
production sources, tests, public witnesses, Research verifiers, CI and root package
manifests remain unchanged from baseline.

No unresolved blocking lifecycle finding remains. The original verification entry
also passed independently after suite extraction/hardening (100 full endpoints,
both print formats, all ten corruptions and language assertions). This clearance
covers the complete finite prototypes, not the entire repository suite or a
production language migration. No new publication, Ready transition, merge or
deployment was performed.
