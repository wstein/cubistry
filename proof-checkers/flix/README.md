# Independent Flix proof checkers

This optional checker implements the frozen [issue 74 contract](../SPEC.md).
Existing Python proof gates, production code and CI remain unchanged. The Flix
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
No binary or local cache is committed. A managed proxy may require the normal
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
