# Test-language migration spike

This isolated feature branch investigates replacing Python proof/regression tests
with Julia, GNU Octave, or Flix. Existing tests, production sources,
certificates and CI remain unchanged. This is an experiment, not an approved
language migration or a new mathematical feasibility claim.

## Experiment contract

Baseline: `377747515be034cf19f656244a20449421b12b1d` (main).
The representative input is the existing `public/counter-proof.json`: a complete
24-sticker fixed-print cube and 100 canonical display witnesses. The incumbent
independent Python checker is `research/counter/verify.py`.

The Julia prototype must independently parse and validate the original JSON,
retain every sticker identity/cubie/position/normal/up/image, replay legal face
moves exactly, validate padded/unpadded displays, and restore full source frames
with inverses. Cross-language comparison must inspect complete states, not just
visible digits. Deliberately corrupted inputs must be rejected. Existing Python
remains the independent oracle; agreement on this finite experiment does not
prove all future inputs or all existing certificate schemas equivalent.

Measure fresh-process startup/JIT separately from warm kernel throughput. Use
identical words and repetition counts. Record toolchain versions, official binary
hashes, input/code hashes, exit status and commands. Do not extrapolate small-input
results to large proof certificates or claim an unavailable Octave/Flix
prototype ran. New dependencies are confined to this directory and optional local
tool caches; no workflow changes are proposed.

## Reproduction

Use Python 3.12 and the pinned Julia 1.13.3 Linux x86-64 distribution in
`manifest.json`. Download the archive, verify its SHA-256, and extract it outside
the repository. Neither the runtime binary nor a package depot is committed.

```sh
export JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot
/path/to/julia --startup-file=no --project=spikes/test-language/julia -e 'using Pkg; Pkg.instantiate()'
python3 spikes/test-language/run_spike.py --julia /path/to/julia --julia-mode default --output /tmp/new-default-run
python3 spikes/test-language/run_spike.py --julia /path/to/julia --julia-mode low-optimization --output /tmp/new-startup-run
python3 spikes/test-language/python_startup.py --controls /tmp/new-startup-run/controls --output /tmp/new-python-startup.json
```

The default and low-optimization Julia modes execute the same complete prototype
validation, ten corruption controls and six language-contract assertions. Normal
verification omits performance loops; add `--benchmark` for five identical kernel
samples. The default test mode is low-optimization; explicit `--julia-mode default`
retains the compiler's usual optimization for throughput comparisons.
`low-optimization` adds `--optimize=0`; it reduces measured fresh-process latency
at the cost of warm throughput. `minimal-compilation` additionally adds
`--compile=min` and is an explicitly bounded experiment, not a preferred mode: validation completed
but was slower, while the complete throughput trial exceeded 90 seconds.
The Python startup comparison executes the same full incumbent checker on one
valid input and ten corruptions either in eleven fresh processes or one batch.
The current repository already batches unittest cases; its CI has not been
modified, and the measured batch gain is not a claimed existing-CI improvement.

The Julia JSON dependency and its transitive versions/tree hashes are locked in
`julia/Manifest.toml`. JSON 1.13.0 and Julia use MIT licenses; Julia's distribution
also retains notices for bundled third-party libraries. No runtime or dependency
source is vendored by this spike. An initial JSON3 dependency attempt was replaced
because Julia's package manager marked it deprecated; final measurements use JSON.

- [GNU Octave execution and reproduction](octave/report.md)
- [Julia's exact integer types and overflow behavior](https://docs.julialang.org/en/v1/manual/integers-and-floating-point-numbers/)
- [Julia startup and compilation considerations](https://docs.julialang.org/en/v1/manual/performance-tips/)
- [Julia JSON package and migration documentation](https://github.com/JuliaIO/JSON.jl)
- [Julia runtime license](https://github.com/JuliaLang/julia/blob/v1.13.3/LICENSE.md)
