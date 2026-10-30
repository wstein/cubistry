# Native Flix recovery checker

This additive command implements the frozen [recovery profile](../HSM-RECOVERY-PROFILE.md).
It reads both raw JSON files itself. All geometry, full-pose enumeration, bounded
endpoint graph construction, exact integer shortest paths, decimal comparison and
sample replay are Flix. Each strict UTF-8 raw text is read once and supplies
both the parsed input and its digest. Build hashes describe the actual copied
compiler inputs, checked before and after compilation against unchanged origins. It shares only the existing native Flix HSM model/parser.
It does not invoke the Julia checker or any Python proof verifier.

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
