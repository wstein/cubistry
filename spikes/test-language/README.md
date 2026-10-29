# Test-language migration spike

This isolated feature branch investigates replacing Python proof/regression tests
with Julia, MATLAB/GNU Octave, or Flix. Existing tests, production sources,
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
results to large proof certificates or claim an unavailable MATLAB/Octave/Flix
prototype ran. New dependencies are confined to this directory and optional local
tool caches; no workflow changes are proposed.
