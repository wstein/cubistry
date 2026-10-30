# Completed independent checker comparison

Both optional engines implement the two bounded groups in [issue 74](https://github.com/wstein/cubistry/issues/74).
The [contract](SPEC.md), [interface](INTERFACE.md) and [coverage ledger](coverage.json)
define the accepted formats. At the time of issue 74, existing Python checks and
CI were authoritative and unchanged. Since the 2026-10-29
[authority change](AUTHORITY.md), Flix and Julia are the
authoritative verifiers (both must accept; any dissent is `UNKNOWN`) and Python
verifiers play no role in confirmation. This completes the scoped implementation, not a migration of
all project tests or formal verification of either checker program.

## Correctness and independent review

Each engine reads raw JSON itself and enforces all 195 pinned outcomes: 41 counter
cases (2 accepted, 39 rejected), and 154 marked-state cases (129 accepted, 25
rejected). Each complete run also checks all 36 physical center generators and
2,048 kernel references, including full inverse restoration. The counter checks
100 padded and 100 unpadded displays, 800 chained transitions per format, and the
fixed-body premises supporting the 10,000 ordered-pair factorization argument.

All 121 geometry witnesses are actually replayed and inverted: 628 outer HTM,
369 whole rotations and 469 rotation-quarter equivalents. The engines validate
rigid bodies, all hidden/blank sticker frames, corner/edge orientation and
permutation constraints, and physical center parity after frame normalization.
Optional optical periods 1/2/4 affect goal equivalence only. A physically valid
state may report `goalMatches: false`; an optical symmetry never repairs an
unreachable physical state.

The separate [export audit](tools/audit_exports.py) compared every field of all
2,413 emitted states, totaling 124,302 sticker frames, with the unchanged pinned
Python/Research engines. Both have aggregate SHA256
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`.
Lossless outputs, reports and source hashes are retained in
[Julia evidence](julia/evidence/provenance.json) and
[Flix evidence](flix/evidence/provenance.json). Raw JSONL byte hashes differ because
object serialization differs; the full canonical state audit agrees.

An independent reviewer additionally executed raw-input boundary controls,
reordered and relabeled bodies/identities, arbitrary printed reference frames,
Unicode aliases, exact resource limits, and 52 rotated-reference center/optical
checks. Both engines passed. Each language's four complete lifecycle calls were
also independently rerun. The [contract review](review/CONTRACT_REVIEW.md) and
[implementation review](review/IMPLEMENTATION_REVIEW.md) are retained verbatim. Review found and fixed
a Flix input-order discrepancy: reordering only `unpaddedPrinting` now rejects,
matching Python and Julia; permuting both printing arrays together remains valid.
Three raw-CLI regressions also preserve equivalent integer `-0` handling.

Six deliberately stricter counter inputs are explicitly listed in the ledger:
Boolean unpadded coordinates, duplicate keys, exponent/float schema versions,
rounded fractional values and underflow fractional values. The legacy Python
checker accepts these; both new engines reject them by contract. Acceptance sets
are therefore deliberately different, rather than silently claimed identical.

Conformance compares the Boolean outcome of every case, not the diagnostic status
string. Both engines agree on accept/reject for all 195 cases, but independent
review found four rejected fixtures whose status class differs. For
`counter/float-schema` and `counter/exponent-schema`, Julia reports `UNSUPPORTED`
(exit 2) and Flix reports `INVALID` (exit 1). For `counter/invalid-utf8` and
`geometry/unpaired-surrogate-image`, Julia reports `INVALID` and Flix reports
`INVALID_JSON` (both exit 1). No invalid input is accepted by either engine.
Harmonizing these status classes is open follow-up work and needs a rerun of the
retained Julia evidence.

## Complete-suite lifecycle

These are warm-dependency-cache, fresh-process observations on the shared machine.
Every call reparses the raw inputs, verifies pins, reconstructs states and reruns
all mathematical checks and all 64 rejection controls. No cached verdict,
microkernel substitution or forced garbage collection is used.

| Phase | Julia 1.13.3, normal optimization | Flix 0.79.0, Java 21 fat JAR |
| --- | ---: | ---: |
| Process start to flushed READY | 98.95 ms | 77.51 ms |
| Child-reported load/preflight | 907.26 ms | 105.87 ms |
| LOAD receipt to first RESULT receipt | 11,047.19 ms | 3,473.01 ms |
| First complete call, child timer | 8,510.06 ms | 3,472.54 ms |
| Three warm complete calls, child timers | 3,478.05 / 3,567.14 / 3,519.45 ms | 2,806.31 / 2,918.35 / 2,478.50 ms |
| Flushed DONE receipt to observed exit | 18.80 ms | 17.59 ms |
| Complete fresh process, four calls | 22,693.78 ms | 11,880.58 ms |

[Julia raw lifecycle](julia/evidence/lifecycle/report.json) and
[Flix raw lifecycle](flix/evidence/lifecycle/report.json) include both clocks.
The parent first-call envelope deliberately includes work outside the child timer,
including Julia method compilation. Parent monotonic timestamps are never
subtracted from child absolute clocks. Load phases differ: Julia loads modules;
Flix preflights corpus files. Intervals include reporting/scheduling overhead and
cannot isolate JIT, GC or OS shutdown individually. Teardown is observably nonzero.

Flix source-to-fat-JAR build took 12,753.39 ms separately, with dependencies already
available ([build capture](flix/evidence/build.json)). Compiler/parser downloads,
network setup and Julia package installation/precompile are not included in runtime
figures. Versions, hashes and licenses are documented in each language README.
Julia's fresh-process first-call JIT remains included; JVM warm-up remains included.

Within Julia, the same four complete suites took 38,093.09 ms with `-O0` versus
22,693.78 ms with normal optimization. The
[low-optimization capture](julia/evidence/history/low-optimization-lifecycle/report.json)
is retained. Normal optimization is preferable for this larger replay-heavy suite;
the earlier small prototype's startup-only improvement does not generalize.
These are measured runs, not universal speed guarantees or a cross-language
ranking for workloads not ported here.

## Limits and recommendation

Keep both as independent proof checkers. Since the 2026-10-29 [authority change](AUTHORITY.md)
they, not Python, are the gate for every proof they cover: a proof is confirmed only
when both accept it, and the existing Python verifiers are historical evidence and port sources.
Julia offers compact exact mathematical code; Flix offers typed validation
and a reusable compiled JVM artifact. Their independent rotation implementations
and complete-state exports provide useful cross-checks beyond matching summaries.

The finite corpus and independent probes provide regression evidence, not a formal
proof of all possible parser inputs or checker source correctness. No new layout,
solver, SAT/UNSAT result, optimality certificate or universal 21-move bound is
claimed. The longest pinned kernel word is reference evidence, not an optimized
calendar transition. Other production tests and proof formats remain unported;
their full-suite lifecycle and migration cost are unknown. Cubacle integration is
future work and no unreleased producer interface is assumed.

## Port backlog

Under the 2026-10-29 [authority change](AUTHORITY.md),
existing proofs whose only verifier is Python keep their recorded Python
verification and are not re-labeled, but are not CONFIRMED until both Flix and
Julia accept them. They are candidates for porting. The backlog below lists the Python verifiers under `research/` on the
research branch, grouped by proof family, in suggested port order. Sizes and
effort are intentionally not estimated.

1. `research/hsm-counter/` (first): `blank/verify.py` (blank), `verify.py`,
   `verify_periodic.py` (periodic); tests `blank/test_verify.py`,
   `test_verify.py`, `test_verify_periodic.py`.
2. `research/five-second-timer/`: `verify.py`, `verify_endpoints.py`,
   `verify_trace.py`; test `test_verify.py`.
3. `research/counter-2x2-optimization/`: `verify.py`, `baseline-verify.py`;
   tests `test_verify.py`.
4. `research/date-3x3/` family:
   - top level: `verify_adjacent.py`, `verify_witness.py` (the oracle of the
     issue 74 marked 3×3 groups; only those bounded groups are ported) (tests
     `test_verify_adjacent.py`, `test_verify_witness.py`);
   - `center-bound-investigation/`: `verify-cyclic-repairs.py`,
     `verify-short-repairs.py`;
   - `consecutive-benchmark/verify.py`;
   - `independent/verify_initial_capacity.py`;
   - `layout-optimization-de/`: `verify.py`, `check_structure.py`;
   - `portfolio-benchmark/`: `verify.py`, `verify-contexts.py`;
   - `transition-optimization/verify.py`;
   - `weekend-layouts/verify-layout.py`;
   - `weekends/verify-certificate.py`;
   - `whole-weekday-separated-month/verify.py`.

Not yet placed in the order: `research/timer-2x2/` (`verify.py`, `optimization/verify.py`), which is also
Python-only. The `scripts/verify*.py` files are not under `research/` and are not
part of this backlog; they would need a separate review. Python verifiers on
`main` are not listed either: `research/counter/verify.py` (oracle of the ported
issue 74 counter group), `research/certified-counter/verify.py`,
`research/workshop-timer/verify.py` (with `evidence/verify.py` and
`evidence/optimization/verify.py`), `research/m1-acceptance/verify_live_solver.py`,
`research/architecture/verify_design.py` and `scripts/print/verify_exports.py`.
