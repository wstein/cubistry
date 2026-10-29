# GNU Octave assessment

This limited implementation spike uses Cubistry main
`377747515be034cf19f656244a20449421b12b1d`. Existing Python tests, certificates,
workflows and dependencies are unchanged. Complete replacement feasibility is
**UNKNOWN**; a passing prototype is not a port of the complete test suite.
The selected candidate is GNU Octave, as requested; MATLAB is not evaluated.

## Executed scope

`counter_probe.m` independently reads `public/counter-proof.json`, checks its 100
padded 2×2 display witnesses and reverses every word against all 24 physical
sticker frames. Quarter rotations use signed axis permutations, without floating
point trigonometry. Six corruptions are rejected: Boolean ID, nonaxis normal,
duplicate ID, illegal move, changed image and rotated printing.

All 100 actual Octave endpoint states are saved in `states.json`.
`cross_validate.py` compares every ID, cubie ID, position, normal, printed-up vector
and image with the unchanged Python verifier's `apply` function: **2,400 complete
sticker frames agree**. `cross-validation.json` pins the source certificate and
Python checker. `manifest.json` pins all evidence.

The prototype omits unpadded prints, long chained routes, cubie grouping/range
validation, fixed-cubie impossibility premises, 3×3 centers, print PDFs and full
production metadata. It must not replace the existing verifier as written.
Empty inverse words are supported, but general legal-word equivalence is not
claimed beyond the tested notation and corpus.

## Runtime and reproduction

Measured runtime: **GNU Octave 9.4.0**, official Debian x86-64 packages extracted
privately under `/tmp/cubistry-octave-runtime`; no system package installation.
Exact seven archive URLs and SHA-256 values are in `runtime-packages.json`.
Download each archive, check its hash and extract it with `dpkg-deb -x` into that
prefix. The environment supplies other Debian libraries, so this extraction is
not a universal portable distribution.

An attempted `gnuoctave/octave:11.3.0` container pull failed while registering a
layer because the daemon's storage quota was exhausted. No 11.3 execution or
performance is claimed. No broad Docker cleanup or system changes were made.

From the repository root, with a normally installed Octave:

```sh
octave-cli --no-init-file --no-site-file --no-history --quiet --eval "addpath('spikes/test-language/octave'); counter_probe('public/counter-proof.json');"
python3 spikes/test-language/octave/cross_validate.py
```

To regenerate endpoint states, pass a second output-path argument to
`counter_probe`. Use a new path and compare with retained `states.json`; do not
overwrite published evidence. The private-runtime invocation and its
`OCTAVE_HOME`, `LD_LIBRARY_PATH` and single-threaded BLAS settings are recorded
verbatim in `results.json`.

Three separate process runs in `results.json` all exit zero. The inner timed
section contains the 100 positive replays and inverses; process wall time also
includes startup, JSON handling, export and six corruptions. These local timings
are not comparable to the much larger complete Python verifier workload.

## Numerical and operational findings

- Octave is freely redistributable GPL software; see its
  [official introduction](https://octave.org/about).
- [JSON decoding](https://docs.octave.org/latest/JSON-data-encoding_002fdecoding.html)
  maps numbers to doubles and Booleans to logical values, and can change vector
  dimensions. The prototype rejects logical IDs/frames and preserves vector
  shape during inverse comparison.
- Raw `jsondecode('[true,1,-1]')` returns a **cell array** on Octave 9.4, rather
  than coercing the Boolean to a number. Replacing an actual positive position
  coordinate with JSON `true` is rejected as `cube:invalid`.
- Tiny signed coordinates remain exact, but JSON decoding aliases the distinct
  integers `9007199254740993` and `9007199254740992`. Do not transfer Python's
  arbitrary-precision assumptions to unbounded JSON integers. Prototype sticker
  IDs are explicitly restricted to 0–23.
- [Integer arithmetic](https://docs.octave.org/latest/Integer-Arithmetic.html)
  saturates overflow and rounds integer division. The probe confirms
  `int8(127) + int8(1) == int8(127)` and `mod(-1,4) == 3`. Choosing an integer
  type alone does not establish Python-equivalent arithmetic.

## Recommendation

Retain the standard-library Python proof gates during any migration. Octave can
serve as an additional independent geometry checker, but replacing the complete
suite still needs schema/negative-control parity, large-certificate and chained
measurements, and independent review. Matrix syntax alone provides no measured
benefit for these small exact frame operations.
