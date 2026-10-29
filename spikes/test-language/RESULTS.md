# Test-language and startup results

Retain Python as the authoritative proof gate. This spike supports faster startup
paths and additional independent checkers; it does **not** establish that replacing
all Python tests is safe or beneficial. Complete migration equivalence is
**UNKNOWN**. No existing Python verifier, production source or workflow changed.

All four requested languages were executed: Python 3.12.14, Julia 1.13.3,
GNU Octave 9.4.0 and Flix 0.79.0 on Java 21. Flix setup uses the requested
[flixw wrapper](https://github.com/wstein/flixw), pinned to release 0.34.9.
MATLAB is not part of this experiment.

## Measured startup changes

Each row preserves its own complete positive and negative checks before and after.
**The rows have different coverage and cannot rank the languages against one
another.** These are observations on a shared machine, not performance guarantees.
Fresh-process measurements use already populated language/dependency caches unless
stated otherwise.

| Language | Identical work within the row | Before | After | Finding |
| --- | --- | ---: | ---: | --- |
| Python | Full existing checker on one valid certificate and ten corruptions | 0.970 s median, eleven fresh processes | 0.569 s median, one process | About 41% lower elapsed time across three paired trials. Existing unittest runs already batch cases; this is not an existing-CI speedup claim. |
| Julia | 100 full canonical states, padded/unpadded displays, 100 inverses, ten corruptions and six language assertions | 3.693 s, usual optimization | 2.095 s, `--optimize=0` | About 43% lower fresh verification time. The spike defaults to this mode and omits microbenchmarks from normal verification. |
| GNU Octave | Three full probes: 300 witnesses, 300 inverses, 18 corruptions and 7,200 exported frames | 12.982 s, three fresh processes | 12.766 s, one process | About 1.7% in one paired trial; too small to claim a material benefit. Independent reproduction reversed the small difference. |
| Flix | 100 typed full states, 100 inverses and six geometry controls, calling the same `geometryChecks()` | 9.304 s median, cached wrapper/compiler test invocation | 0.177 s median, fresh compiled fat-JAR JVM | About 52 times lower invocation latency across three samples; compilation must happen separately and sources must match the artifact. |

Flix's separate fat-JAR build took 9.075 s. Empty-wrapper-cache setup took 6.630 s
and required network access; it is not included in the compiled invocation time.
The resulting artifact was 698,333 bytes. Rebuilding a stale artifact is mandatory;
a fast launch does not eliminate compilation or dependency setup in a clean CI job.
The wrapper/compiler/setup hashes, commands and raw logs are retained in
[Flix evidence](flix/evidence/report.json).

Julia's `--compile=min --optimize=0` completed the same verification in 16.621 s,
so it is not the preferred startup mode. An earlier full trial including 10,000
extra throughput words exceeded a 90-second supervisor bound. That timeout does
not mean verification-only startup exceeded 90 seconds. Normal verification now
excludes those optional timing loops; `--benchmark` explicitly enables them.

The separate identical 2,000-word warm replay samples show the tradeoff: Python
medians were 267–275 ms, Julia usual optimization 25.48 ms and Julia `-O0`
64.44 ms. These small warm-kernel timings exclude process/package startup and are
not whole-suite timings. The unchanged full Python checker also performs long
chains and historical proof checks absent from the Julia prototype, so its
roughly 0.5–0.8 s measurements are not an equivalent cross-language speed ratio.

## Correctness and migration boundaries

- **Julia:** independently parses the real witness JSON, validates the complete
  24-sticker source lattice and rigid frames, and checks both fixed print formats.
  All 100 complete endpoint states agree with the unchanged Python oracle.
  Ten corrupted inputs are rejected, including Boolean/fractional values, an
  oversized identity, out-of-range position, duplicate identity, illegal notation,
  wrong target, changed unpadded print and rotated print-up vector.
- **GNU Octave:** all 2,400 full exported sticker frames agree with Python, with
  100 padded witnesses, inverses and six corruption controls. Its intentionally
  incomplete schema/cubie validation means the prototype must not replace the
  existing checker. Raw mixed Boolean input is rejected; distinct JSON integers
  above 2^53 can alias as doubles. Integer overflow also saturates rather than
  matching Python's arbitrary-precision arithmetic. See the detailed
  [Octave report](octave/report.md).
- **Flix:** complete typed frames and inverses agree with Python-generated
  expectations, and six geometry controls are retained in both entry points.
  Python currently decodes JSON/move notation into typed fixtures, so raw JSON
  schema validation is **not** independently ported. The initial fixture layout
  exceeded the JVM 64-KB method limit; splitting it into 100 functions preserved
  every fixture. See the [Flix scope and wrapper instructions](flix/README.md).
- **Python:** remains unchanged and independently checks the prototypes' outputs.
  The spike has not ported every regression, certificate schema, long route,
  timer trace, 3×3 center proof, corruption suite or print-artwork checker.

Julia has fixed-width integers as well as explicit arbitrary-precision types;
this prototype bounds identities and coordinates before using machine integers.
Its modulo operation is chosen explicitly for negative quarter turns. Typed
arithmetic or a new language does not itself prove a checker correct. The Julia
JSON dependency is locked; the prototype no longer uses deprecated JSON3.

## Recommendation

1. Keep the existing standard-library Python proof gates and process batching.
   The measured startup benefit does not justify discarding independently checked
   certificates or rewriting the whole test suite.
2. Use the new Julia verification entry in low-optimization mode for optional
   checks; select usual optimization explicitly for long warm replay workloads.
   Keep the Python comparison until the remaining schemas and controls are ported.
3. For repeated Flix geometry checks, compile once through pinned `flixw` and run
   the matching compiled entry. Keep source/artifact hashes and a rebuild step;
   add an independent raw JSON boundary before considering any gate replacement.
4. Retain GNU Octave as an optional independent numerical/geometry experiment.
   This run established no material startup benefit, and full schema coverage
   remains outstanding.

The Julia binary download is approximately 289 MiB and adds a separate runtime
and locked package setup. Flix needs Java and compiler setup; its wrapper is
experimental third-party MIT software with its original license retained. Octave
was run from privately extracted, hash-pinned Debian packages after a container
pull hit the daemon's storage quota. These setup costs are separate from execution
and must be considered before adding another required CI toolchain.

## Evidence and reproduction

- [Common contract, manifests and Julia/Python commands](README.md)
- [Machine-readable experiment manifest](manifest.json)
- [Julia normal verification](evidence/julia-verify-default/report.json)
- [Julia optimized verification](evidence/julia-verify-low-optimization/report.json)
- [Julia minimal-compilation verification](evidence/julia-verify-minimal/report.json)
- [Julia normal warm trial](evidence/julia-default/report.json)
- [Julia low-optimization warm trial](evidence/julia-low-optimization/report.json)
- [Bounded minimal-compilation throughput trial](evidence/julia-minimal-benchmark.json)
- [Python startup comparison](evidence/python-startup.json)
- [GNU Octave startup comparison](octave/startup-results.json)
- [Flix startup comparison](flix/evidence/report.json)

Raw outputs retain their original source revisions and file hashes. The initial
`baseline` result field meant the measured spike revision; it was corrected to
separate `baselineMain` and `spikeHead`. Proof inputs and the incumbent checker are
unchanged. Measurement artifacts include their actual repository status; some
runs occurred while documentation/evidence files were being prepared. Loaded
checker and harness hashes identify the executed code independently of that state.

The [independent review](evidence/independent/INDEPENDENT_REVIEW.md) separately
replayed the prototypes, added 126 noncanonical/group-identity frame cases,
checked numeric boundaries, repeated startup experiments and reviewed the final
verification-only default. No blocking findings remain within the stated finite
scope. Complete replacement remains UNKNOWN; retain Draft for human review.

The additive [lifecycle experiment](LIFECYCLE.md) now measures one-time setup,
runtime/load, first complete validation, three complete same-process repeats and
observed exit. It preserves every prototype check and shows nonzero exit tails;
it does not estimate the cost of an unimplemented complete project-suite port.
