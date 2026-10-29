# Independent test-language spike review

Reviewed Julia prototype `bea01b6` in detached `/workspace/cubistry-language-review`,
against unchanged-main baseline `377747515be034cf19f656244a20449421b12b1d`.
No author implementation files changed. Final comparative documentation and Octave
assessment remain pending; this is an interim Julia result.

## Scope and result

No blocking Julia correctness finding in the bounded experiment. The port uses
integer Rodrigues rotations, legal face notation, immutable 24-sticker identities,
rigid signed-axis frames, all 100 canonical padded/unpadded target displays, and
exact inverse restoration. Python retains its independently coded coordinate
rotation and unchanged full checker. Existing Python/production/CI files are not
modified. The Julia prototype does not implement the Python checker’s chained
checks, fixed-cubie UNSAT argument, or other repository certificate schemas.

Independently ran:

```sh
JULIA_DEPOT_PATH=/tmp/cubistry-julia-depot python3 spikes/test-language/run_spike.py \
  --julia /tmp/julia-1.13.3/bin/julia --repetitions 20 \
  --output /tmp/cubistry-language-review-run
```

PASS: 100 complete frame states agree, ten deliberate corruptions rejected by both
checkers, checksums agree, six Julia convention unit assertions pass. An additional
reviewer-selected 120 seeded noncanonical move words and all six fourfold face
identity words (126 cases) agree on every source sticker frame with the unchanged
Python oracle; corpus and output are retained beside this report.

Official Julia archive SHA-256 independently verified as
`5c61cb4b40332cb5a3504e7779e2f5dac093caa4a1116ded19f01413f85c63e4`.
Tool version is 1.13.3, JSON dependency is pinned 1.13.0 in Project/Manifest.
Local footprint: 289 MiB compressed archive, about 1.1 GiB unpacked runtime,
122 MiB populated depot. These are local observations, not cache-size guarantees.

## Performance interpretation

Identical warmed apply kernels: five samples of 2,000 words each, reviewer medians
277.09 ms Python and 26.65 ms Julia. Julia fresh-process execution was 3,735 ms,
including loading/JIT, validation, negative controls, all benchmark samples, and
JSON output. This is not a pure startup measurement. Full Python validation also
runs chains and proof premises omitted from Julia; their validation timings are
not an equivalent-work speed comparison. Results are machine-specific and do not
establish large-certificate performance, complete migration equivalence, or checker
correctness formally. A ~10× warm microkernel improvement alone does not justify
replacing all current Python verifiers or adding a second mandatory CI runtime.

## Minor provenance suggestion

The author was asked to distinguish current spike HEAD from unchanged-main
baseline in the result JSON: its `baseline` key currently records the spike HEAD,
while manifest/README baseline denotes main. This does not alter computed results.

No GitHub comment publication attempted; previous automated egress rejection remains
in force. Keep the spike Draft; no CI replacement, merge, or deployment authorized.

## Follow-up and GNU Octave review

The provenance suggestion is resolved in `7e1b5f1`: `baselineMain` records unchanged
main, while `spikeHead` records the measured implementation revision. This is a
report-field-only change; no frame computation changed.

Independently reviewed frozen GNU Octave `92d9b75d3f4866e525a37790a1342900b17f5979`
in detached `/workspace/cubistry-octave-review`. Executed the recorded private
GNU Octave 9.4 runtime with no init/site/history files and BLAS single threaded.
The 100 padded witnesses, 100 exact inverse restorations and six deliberate
corruptions passed. The reviewer regenerated every endpoint and independently
compared all 2,400 full sticker frames with the unchanged Python oracle. Export
SHA-256 `c95848ef838078d19bdef47100ceebf5eefc2808d4f8e68a26d67f195d35f82a`
exactly matches retained author output. All nine evidence-manifest hashes verified.

Raw JSON boundary tests independently confirmed that mixed Boolean/numeric vectors
remain cells in this runtime, and an actual positive coordinate replaced with JSON
`true` is rejected. Distinct integers above 2^53 do alias, as documented. Small
signed-axis geometry remains exact in doubles. General arbitrary-integer/schema
parity is not established. The previously noticed empty inverse edge is guarded
in the frozen source. Missing cubie-group/range checks, unpadded variants, chains,
fixed-cubie proofs and other schemas are clearly disclosed, so this is an additional
padded geometry probe rather than a candidate drop-in production checker.

GNU Octave reproduction used the environment in `octave/results.json` and:

```sh
octave-cli --no-init-file --no-site-file --no-history --quiet --eval \
  "addpath('spikes/test-language/octave'); counter_probe('public/counter-proof.json', '/tmp/octave-states.json');"
```

Reviewer inner positive-check time was 2.89 seconds. No apples-to-apples warm-kernel
comparison with Julia/Python is established by this differently scoped Octave run.
MATLAB was not evaluated, consistent with the latest request to consider GNU Octave.

Local finite-scope implementation review is clear. Final combined recommendation
and archived cross-tool performance wording remain to be checked at the author’s
combined frozen head. Full replacement feasibility remains UNKNOWN.

## Startup comparison follow-up

Reviewed `939f71c` option/batching changes and independently ran low-optimization
Julia (`--optimize=0`) with unchanged 100-state/ten-negative/six-assertion scope.
It passed; reviewer fresh complete process was 2.409 seconds and warm median was
63.68 ms. The earlier default-mode result was 3.735 seconds and 26.65 ms. This
illustrates a startup/throughput tradeoff, not a universal paired speedup.

Independently ran the three-trial Python fresh-per-case versus single-batch
comparison. All eleven outcomes were identical in every trial. Medians were
997.90 ms versus 553.74 ms. The existing repository already batches unittest
cases; this experiment is not a demonstrated existing-CI improvement.

Reviewed and ran Octave `4547daae232de537acda15fffa32cd597539c34b` fresh/batch experiment. Both modes execute
300 positive witnesses, 300 inverse words, 18 corruptions, and 7,200 exported
sticker frames, whose hashes equal the previously Python-checked output.
Reviewer result: fresh total 13.346 seconds, batch 13.738 seconds, ratio 1.029.
This corroborates the absence of a material measured startup benefit; small local
differences can change sign. `octave-startup.json` retains complete commands/results.

The subsequent `ab001bd` Julia minimal-compilation option only adds
`--compile=min` with `--optimize=0`; it does not remove checks. It was statically
reviewed but has not been executed independently. Any bounded failure/timeout must
remain labeled as such rather than counted as completed prototype validation.

## Complete verification versus optional throughput

Reviewed `22d40d2` separation: default verify-only skips only warm benchmark loops,
not canonical states, complete inverses, unpadded displays, ten corruptions or six
convention assertions. Independently ran low-optimization verify-only: PASS with
100 full states equal, ten negatives rejected, no benchmark samples and null warm
medians; fresh full process was 2.012 seconds. Independently ran explicit benchmark
mode at one repetition: the same checks passed plus five 100-word samples.
The later default choice of low-optimization is a CLI selection, not weakened
validation. Removing redundant timed performance work from ordinary verification
must not be described as removing correctness coverage.

## Flix independent review

Reviewed source `80948047e76119ac3826c1779928efe8f62aea06` and retained evidence
`ee1bb13` in detached `/workspace/cubistry-flix-independent`. Regenerated typed
fixtures from the unchanged Python oracle; committed fixture/manifest bytes were
unchanged. The reviewer ran the actual pinned `flixw test --no-install --threads 2`:
one batched test passed, zero failed/skipped. Independently executed the retained
fat JAR: 100 full 24-sticker states, 100 exact inverse checks and six controls passed.
The same `geometryChecks()` function is called by tests and the executable.

Independently verified SHA-256 pins:

- flixw setup: `8db484443e822d200a59bbce1d9a64bb6a679c1446a61724cca0ba51732b77d6`
- Flix 0.79 compiler: `8fad2aa09567a7edabcc43f4101fa6199131df2c22929e001c87659d764f6dcf`
- Frozen compiled artifact: `1cee269bb3c2a290070629619e5bcd6e969e9cf1a2bbc87a85c8c9740b5525e0`

The wrapper is experimental third-party MIT software, with retained license; Flix
compiler licensing is separately identified. No binaries/production dependencies
or repository workflow changes are introduced.

Typed fixture limits are material: Python decodes raw JSON and move notation and
provides expected states. The six Flix controls cover a wrong expected frame,
missing expected state and four illegal typed move parameter sets; they do not
port Python’s raw JSON/schema controls. No unpadded/chained/general-proof coverage
is implied. Cached compilation/test (~9.3 seconds) versus the built JVM entry
(~0.177 seconds) is an observed startup strategy for identical typed checks, not
a direct comparison to the complete Python proof gate or a 52× existing-CI gain.
Build (~9.1 seconds), cache acquisition, source-change invalidation and rebuilding
are separate costs. The executable must be rebuilt when source/fixtures change.

## Final aggregate clearance

Reviewed frozen aggregate `3f8da2d626184bd99acd41e89ea0f8c509d4bf9d`, including
RESULTS.md, reproduction instructions, pinned manifests and same-coverage startup
claims. Independently ran the default entry without mode overrides: verify-only,
low-optimization, all 100 full states equal, ten corruptions rejected, no performance
samples and null warm medians; complete Julia process 2.400 seconds. All repository-
relative links in the four changed narrative documents resolve. The diff for existing
`.github`, `tests`, `src`, `public`, `research` and root package manifests is empty.
The detached aggregate review checkout remained clean after execution.

No unresolved blocking findings remain for this isolated experimental branch.
The recommendation to retain Python gates is supported. Startup tables correctly
compare identical work only within a language row, disclose differing cross-language
coverage, distinguish compiled startup from compilation/cache/network costs, and
make no existing-CI speedup promise. No result establishes replacement of all
repository Python verifiers, formal checker equivalence, or general certificate
performance. Complete migration feasibility remains UNKNOWN.

No PR comment, Ready transition, merge, deployment, production migration or CI
replacement was performed. Detailed review publication remains blocked by the earlier
automatic approval review; local evidence is retained for the parent-authorized Draft.
