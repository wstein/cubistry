# Independent Flix proof checkers

This optional checker implements the frozen [issue 74 contract](../SPEC.md).
Since the 2026-10-29 [authority change](../AUTHORITY.md)
this checker and the Julia one are the authoritative verifiers; Python verifiers play
no role in confirmation. The issue 74 delivery left existing Python proof gates, production code and
CI unchanged. The Flix
entry point reads original raw UTF-8 files; no Python-generated typed input or
production/solver move implementation is used.

## Build and run

Java 21 is required. The repository-local flixw 0.34.9 wrapper pins stock Flix
0.79.0. Its MIT license is retained in [WRAPPER-LICENSE.txt](WRAPPER-LICENSE.txt).
Jackson Core 2.22.4 is used only for JSON tokenization through Java interoperability;
all type policy, schema, geometry, reachability and mathematical checks are Flix.
Its exact artifact hash is in [parser-pin.json](parser-pin.json), with the original
[Apache license](PARSER-LICENSE.txt) and [notice](PARSER-NOTICE.txt).

From the repository root:

```sh
export FLIX_CACHE_HOME=/tmp/cubistry-flix-cache
export COURSIER_CACHE=/tmp/cubistry-flix-coursier
(cd proof-checkers/flix && python3 build.py --output /tmp/NEW-flix-build.json)
java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar counter public/counter-proof.json .
java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar state3 proof-checkers/conformance/geometry/outer-R-quarter.json
python3 proof-checkers/flix/tests/acceptance.py
```

The build guard checks the resolved parser JAR's SHA-256 before the executable is
used and records the built artifact and source hashes. Build/setup costs are
separate from validation. The Python build/test utilities are launch/integrity
harnesses; they do not preprocess certificate data or implement the checker engine.
No compiler/runtime binary or local cache is committed. A managed proxy may require the normal
Java HTTP/HTTPS proxy properties in `JAVA_TOOL_OPTIONS`; caches stay in `/tmp`.

## Checks and deliberate input policy

`counter FILE [REPO_ROOT]` validates the complete immutable 24-face print, all
100 padded/unpadded displays, 100 exact inverses, the pinned 800-transition chain
per format, hub-factorization premises, fixed-upper-body arithmetic and actual
rotated-title tamper rejection. The chain is SHA-pinned even for direct invocations.

`state3 FILE` validates every ID/body/image/frame, 26 rigid bodies and complete
occupancy. A normalized copy derived from center identities checks corner/edge
orientation sums, permutation parity and physical center quarter parity. Center
indices use explicit U/L/F/R/B/D face-turn conventions; optical periods 1/2/4 never
remove the underlying physical state. Full world-frame state is returned.

Raw integer tokens remain distinct from floats/exponents and Booleans until
range-checked conversion. Duplicate keys, invalid UTF-8, unpaired surrogates,
resource-bound violations, malformed frames and unsupported schemas fail closed.
Informational metadata does not bypass parsing or required-field checks. This is
deliberately stricter than the incumbent's integer-valued-float and duplicate-key
policies, as recorded in the shared coverage ledger. Canonical full-state output
is ID-sorted and uses exact ASCII JSON escaping, including surrogate pairs for
valid supplementary characters. No invalid input is labeled UNSAT.

Result records contain `valid`, `status` and diagnostics. Exit codes are 0 for
valid, 1 for semantic/parser-invalid, 2 for unsupported commands/schemas and 3 for
unexpected runtime, I/O or integrity errors. Valid execution returns naturally.
These validators do not solve cubes or prove an optimal move bound.

## Complete corpus and lifecycle

The executable enforces the embedded manifest SHA-256, every declared case name
and input hash, the exact 801-value chain, all 36 generators and all 2,048 kernel
references. Missing or substituted data is an error. Expected-invalid fixtures
must be rejected by the parser/semantic checker; digest and witness comparisons
run outside that rejection catch, so a comparison failure cannot masquerade as a
successful negative control.

```sh
java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar conformance . /tmp/NEW-flix-states.jsonl
python3 proof-checkers/tools/audit_exports.py /tmp/NEW-flix-states.jsonl --research-root /path/to/pinned-research-checkout
python3 spikes/test-language/lifecycle_driver.py --output /tmp/NEW-flix-lifecycle --label flix-complete -- java -Xmx768m -jar proof-checkers/flix/artifact/flix.jar lifecycle .
python3 proof-checkers/flix/tests/parser_limits.py
python3 proof-checkers/flix/tests/counter_order.py
```

Run these commands from the repository root. The separate Research checkout is
needed only by the independent Python audit utility; the Flix runtime never
imports it. The original 195-case CLI regression also checks unknown-command,
I/O-error and direct-chain-integrity exit behavior. Eleven additional raw boundary
controls cover depth 64/65, positive/negative/decimal numeric tokens of 128/129
bytes, scalar Unicode and a valid 60,000-character informational member name.

Three additional counter-order controls require matching input ID order between
`printing` and `unpaddedPrinting`: permuting only one rejects, permuting both
identically accepts, and integer ID tokens `-0` and `0` compare equally. This
check runs before canonical ID sorting.

All 195 fixtures pass their declared outcomes: 41 counter cases (2 valid, 39
rejected) and 154 marked cases (129 valid, 25 rejected). Every valid geometry row
with a word is actually replayed and inverted: 121 witnesses, 628 outer HTM,
369 physical whole-rotation tokens and 469 whole-rotation quarter equivalents.
Those totals are derived from the executed branches and asserted, not inferred
from the presence of files. All generators and kernel endpoints retain every
hidden/blank center frame and restore the complete source under inversion.

The ID-sorted ASCII full-state aggregate is
`2b7474246a94f3ea4788c119b93a292283dd2d40cd2739dcc76978b399fcb661`,
matching Julia. The independently audited 2,413 actual output states contain
124,302 complete physical sticker frames. They are retained losslessly in
[evidence/full-states.jsonl.gz](evidence/full-states.jsonl.gz); decompress to a new
JSONL path for the audit command. [Provenance](evidence/provenance.json),
[conformance](evidence/conformance.json), [build](evidence/build.json) and
[full-frame audit](evidence/export-audit.json) retain source/input/artifact hashes.
Compiler/runtime binaries and local caches remain excluded.

`lifecycle REPO_ROOT` uses one fresh JVM. READY is flushed before input work; LOAD
is a raw-byte integrity preflight over 199 files and retains no semantic cache.
**Each** of the four later complete invocations rereads, pins and reparses every
certificate/state, manifest, chain and kernel input, redoes all expected negative
rejections and all mathematical replay/inverse/hash checks. No AST or accepted/
rejected verdict is reused. Only output volume is suppressed during repeats.

The final [lifecycle capture](evidence/lifecycle/report.json) measured startup
77.51 ms, preflight 105.87 ms, first complete validation 3,472.54 ms, three complete
warm validations 2,806.31 / 2,918.35 / 2,478.50 ms, and observed DONE-to-exit
17.59 ms. Upfront build was separately 12,753.39 ms. Java/JIT/OS caches naturally
warm; no forced collection or disabled assertions are used. Parent observations
use one monotonic clock and child validation durations use another only locally;
no cross-process timestamps are subtracted. Exit is natural and its measured tail
is not assumed zero. These are shared-machine observations, not universal timing
promises or an identical-algorithm language benchmark.
