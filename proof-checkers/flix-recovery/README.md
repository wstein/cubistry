# Native Flix recovery checker

This additive command implements the frozen [recovery profile](../HSM-RECOVERY-PROFILE.md).
It reads both raw JSON files itself. All geometry, full-pose enumeration, bounded
endpoint graph construction, exact integer shortest paths, decimal comparison and
sample replay are Flix. Each strict UTF-8 raw text is read once and supplies
both the parsed input and its digest. Build hashes describe the actual copied
compiler inputs, checked before and after compilation against unchanged origins. It shares only the existing native Flix HSM model/parser.
It does not invoke the Julia checker or any Python proof verifier.

Follow the [existing build setup](../flix/README.md#build-and-run), including its
managed-proxy guidance when dependencies are not already cached.

The standalone build copies the old Flix sources except `Main.flix` into an
ignored build directory and adds `src/RecoveryMain.flix`. The old sources,
dispatch and artifact remain unchanged. It uses the existing wstein/flixw
0.34.9, Flix 0.79.0, Java 21 and pinned Jackson Core 2.22.4 tokenizer.

```sh
export FLIX_CACHE_HOME=/tmp/cubistry-flix-cache
export COURSIER_CACHE=/tmp/cubistry-flix-coursier
python3 proof-checkers/flix-recovery/build.py --output /tmp/NEW-recovery-build.json
java -Xmx1536m -jar proof-checkers/flix-recovery/artifact/flix.jar --self-test
java -Xmx1536m -jar proof-checkers/flix-recovery/artifact/flix.jar \
  proof-checkers/conformance-hsm/cases/recovery-unsupported.json \
  proof-checkers/conformance-hsm/cases/modes.json
```

`--mode INDEX RECOVERY.json MODES.json` executes only that graph row after
replaying all source periods and validating application selection. Its output is
explicitly `UNKNOWN` / `PARTIAL`, so it cannot confirm the complete proof.
Progress is flushed to standard error; the deterministic verdict is standard output.
Exit codes are 0 for a completed full or partial computation, 1 for invalid input,
2 for unsupported schema/version or command, and 3 for an unexpected runtime error.

The graph includes every full endpoint reachable in one through five HTM, with
minimum cost per endpoint. If the exact nearest next-display distance exceeds
five, it includes all shortest six-HTM endpoints instead. Four visible sticker
placement distances prune impossible move prefixes. Same-face reductions and
ordering commuting opposite turns preserve every minimum-cost endpoint. All
physical hidden corners and real blank poses remain in the graph.

For `N` nodes, an optimal positive-cost route can be simple, with fewer than `N`
edges and at most `6N` total HTM. The native heap Dijkstra therefore encodes the
integer triple exactly with `unit = 6N + 1` and `above = (N + 1) * unit`:
`aboveEdges * above + steps * unit + HTM`. These bounds prohibit a carry between
components. An explicit one-million-node capacity guard keeps every packed value within signed
64-bit arithmetic, including one extra candidate edge during relaxation. Native tiny-graph controls separately exercise each priority
level and forced-six behavior. Raw decimal means use significant ASCII digits
and base-ten exponents; no finite-precision equality decides acceptance.

Global print optimality remains `UNKNOWN`; runtime reachability of forced poses
and minimum-mean period certificates remain `NOT_CHECKED`. Confirmation still
requires independent Julia acceptance and final review under the
[authority rules](../AUTHORITY.md).

## Validation record

At mathematical source commit `ac1b6bf`, the native Flix checker accepted the two
frozen raw inputs across all 18 graphs and replayed 264 samples with 1,061 forward
steps and per-edge inverses. Its complete output matched the independently
computed Julia output byte for byte: SHA-256
`0d0d139589dfe9a39524967ebe543c4316c9343e0e0d4c05966b5a5ef3283c70`.
Final independent review remains pending; this record does not promote readiness.

The measured complete Flix process took 110.35 seconds and peaked at 1,311,372 KiB
RSS with Java 21 and `-Xmx1536m` on the shared worker. Build time was recorded
separately. These are execution observations, not a language benchmark.

Ten native small-graph/decimal controls and 39 raw-input controls passed. The raw
controls reject 37 concrete structural, graph, histogram, metric and replay
mutations; they accept an informational-label change and an exactly equivalent
scientific-notation mean as partial computations. Reproduce them with:

```sh
python3 proof-checkers/flix-recovery/tests/controls.py --output /tmp/NEW-recovery-controls
python3 proof-checkers/flix-recovery/tests/audit_hsm_data.py
```

An isolated build of the unchanged old checker passed native 195-case conformance
and retained `UNSUPPORTED` for its original recovery command. The 46-case HSM
corpus received a hash/count audit only, as its code and inputs are unchanged;
its full mathematical conformance command was not repeated for this additive
entrypoint. All 301 protected files matched the baseline checkout.

The coordinator retains the complete raw controls, build/source/tool hashes,
stdout/stderr, exits, timing and process resource captures for later evidence
publication. Two static provenance findings were corrected before the final
artifact: parsing and hashing now bind one input read, and build records hash the
actual copied compiler inputs. Both fixes were independently reviewed; the full
control suite and proof ran on the corrected artifact.
