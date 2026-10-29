# One process: load, full validation, repeats and exit

Compiling or loading once does not make subsequent tests or teardown free. This
follow-up separates those phases for the **complete existing prototypes**, with
one fresh process per language and four complete calls in that process. It does
not estimate the cost of porting/running all 43 Python regressions, 29 proof
controls or every Research verifier; that full-suite cost remains UNKNOWN.

## Upfront work

- **Flix:** source-to-bytecode lifecycle artifact build took **8.907 s** using the
  pinned `flixw` compiler. This is separate from running the resulting JAR. JVM
  class loading and first-use JIT still occur after that build. Prior empty-cache
  wrapper acquisition is separately recorded in the original startup report.
- **Julia:** an already populated depot's offline `Pkg.instantiate` and
  `Pkg.precompile` check took **0.694 s**. This is neither a cold installation nor
  compilation of every checker function. First-call JIT remains observable.
- **GNU Octave:** no artificial compiler phase is introduced. Loading/parsing
  the checker is observed separately; installation is outside these captures.
- **Python:** no native build step is introduced. Interpreter startup and loading
  the unchanged standard-library checker are observed separately.

## Observed phases

All values below are milliseconds. Parent-observed intervals use the parent's
monotonic clock only. `READY` is flushed at runtime entry, `LOAD` follows checker
loading where meaningful, and each `RESULT` follows one complete validation.
First-call and warm **envelopes** include marker/protocol/scheduling costs between
receipts; they are not fabricated sums of unrelated process clocks.

| Language | Process → READY | READY → LOAD | First full-call envelope | Median of three warm full-call envelopes | DONE → exit | Whole process, four calls |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Python | 21.49 | 2.72 | 564.93 | 536.85 | 5.34 | 2,210.43 |
| Julia, `-O0` | 96.77 | 501.72 | 1,640.23 | 16.39 | 20.16 | 2,321.52 |
| Flix compiled entry | 38.47 | Included in runtime/first use | 152.14 | 19.57 | 7.10 | 259.65 |
| GNU Octave | 67.80 | 8.06 | 4,334.22 | 4,353.62 | 9.50 | 17,555.67 |

The rows have **different validation coverage**, so they cannot rank replacement
of the complete project suite. Python runs its original broader checker, including
chains and proof premises. Julia checks the raw JSON schema, padded/unpadded
100-state prototype, all ten corruption fixtures and all six language assertions.
Flix checks 100 typed full states, inverses and six geometry controls, with an
additional checksum audit; raw JSON preprocessing is still Python. Octave checks
100 padded states, inverses and six controls. Each call recreates/reparses its
state and repeats **all** of its controls; only code/runtime caches remain warm.

Child-internal relative timers are retained separately. Julia's first complete
body was **789.92 ms** and its three repeat bodies **16.30 / 16.01 / 29.93 ms**.
Its larger 1,640.23 ms parent first-call envelope includes compilation/protocol
work outside that inner timer. Its module-load timer was 438.86 ms, versus the
501.72 ms parent ready-to-load interval. Reporting only the small inner times as
the complete process cost would hide real startup/JIT work.

Flix's complete body times were **134.08 ms**, then **19.02 / 9.85 / 13.65 ms**.
Octave's were **4,332.24 ms**, then **4,299.64 / 4,481.54 / 4,352.92 ms**; its
separate checker metadata/parse lookup was 1.06 ms. Python's were **564.56 ms**,
then **546.75 / 536.78 / 532.24 ms**. These are not microkernel-only repeats.

## Completeness and interpretation

The parent requires `READY`, optional `LOAD`, exactly four contiguous `RESULT`
records, then `DONE`. Checksum and coverage counts must remain unchanged. Julia
requires the exact ten named corruption fixtures before validation; removing one
is rejected. Six protocol-corruption regressions cover missing calls, early exit
markers, coverage drift, absent negatives and changed state. The first six Julia
language assertions run again in every complete call.

Julia and Python produce the same complete-state SHA-256 on all four calls.
Octave retains all four actual exports: **9,600 sticker frames** independently
match the unchanged Python oracle. Flix independently verifies numeric checksum
**29748** on all four runs, while still calling the original complete geometry
checks each time. Source/control hashes, raw markers and actual commands are saved.
No validation is elided and no garbage collection is forced.

Observed exit tails are **nonzero**. They include normal runtime cleanup, pipe
closure/delivery and parent/OS scheduling; they are not isolated destructor CPU
time. Other cleanup can occur during tests, and operating-system reclamation may
not map to a separately attributable phase. No zero-cost teardown guarantee or
universal warm-run latency follows from these measurements.

The practical model is: setup/build once when required, pay runtime/load/first-use
costs once per process, batch complete checks in that process, and measure exit
rather than assuming it is free. New input types, workloads, garbage collection,
JIT decisions and cold caches can change these observations. Full production-suite
migration and timing still require the proposed broader conformance work.

## Reproduce and audit

```sh
export JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot
python3 spikes/test-language/lifecycle_driver.py --output /tmp/NEW-julia-life --label julia -- /path/to/julia --startup-file=no --optimize=0 --project=spikes/test-language/julia spikes/test-language/julia/lifecycle.jl public/counter-proof.json spikes/test-language/evidence/julia-verify-low-optimization/controls
python3 spikes/test-language/lifecycle_driver.py --output /tmp/NEW-python-life --label python -- python3 spikes/test-language/python_lifecycle.py spikes/test-language/evidence/julia-verify-low-optimization/controls
python3 spikes/test-language/lifecycle_contract_test.py
```

- [Julia lifecycle capture](lifecycle/julia/report.json)
- [Julia cached-package setup](lifecycle/julia-package-setup/report.json)
- [Missing-control rejection](lifecycle/julia-missing-control/report.json)
- [Python lifecycle capture](lifecycle/python/report.json)
- [Flix build and lifecycle instructions](flix/README.md)
- [Flix separate build capture](flix/evidence/lifecycle/build.json)
- [Flix lifecycle capture](flix/evidence/lifecycle/report.json)
- [GNU Octave reproduction, exports and audit](octave/lifecycle/README.md)
- [GNU Octave lifecycle capture](octave/lifecycle/report.json)

Existing production code, Python verifiers and CI remain unchanged. Historical
startup/throughput observations are preserved; the lifecycle experiment is additive.

The [independent lifecycle review](lifecycle/independent/LIFECYCLE_REVIEW.md)
separately executed all four runtimes, checked the nine-control rejection and
protocol regressions, reconciled the timeline table and verified the source/input
hashes. No unresolved findings remain within this finite prototype scope.
