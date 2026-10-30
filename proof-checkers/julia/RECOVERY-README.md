# Native Julia HSM recovery checker

The additive [recovery profile](../HSM-RECOVERY-PROFILE.md) has its own entrypoint.
It preserves all pinned issue-74 and HSM sources, corpus cases and historical
verdicts. In particular, `check.jl hsm RECOVERY.json` still reports `UNSUPPORTED`.
Tracking: [issue 98](https://github.com/wstein/cubistry/issues/98).

Use the existing Julia 1.13.3 / JSON 1.13.0 environment from [the setup
instructions](README.md). Both arguments are raw research files from revision
`30b6d022da60c366d79de5498497df0a07e28caf`; each invocation parses both itself:

```sh
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery.jl RECOVERY.json MODES.json
julia --startup-file=no --compile=min --project=proof-checkers/julia proof-checkers/julia/recovery-parser-tests.jl RECOVERY.json MODES.json
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery-tests.jl RECOVERY.json MODES.json
```

The exact frozen bytes already exist in the unchanged old corpus:
[recovery input](../conformance-hsm/cases/recovery-unsupported.json) and
[all-mode input](../conformance-hsm/cases/modes.json). The former filename and its
old `UNSUPPORTED` expectation belong to `check.jl hsm`, and stay unchanged. The new
entrypoint can read these same files directly:

```sh
julia --startup-file=no --project=proof-checkers/julia proof-checkers/julia/recovery.jl proof-checkers/conformance-hsm/cases/recovery-unsupported.json proof-checkers/conformance-hsm/cases/modes.json
```

The checker replays all eighteen own periods and inverses and recomputes the
application selection rule. For each recovery row it independently enumerates
all legal settled full poses, rebuilds every endpoint reachable within five HTM
(or every shortest endpoint for a forced six-HTM source), and runs reverse
multi-source Dijkstra with exact lexicographic integer costs. It checks every
published count, histogram, mean, maximum and sample, including full-frame sample
inverses. It does not consume a Python verifier or another checker's verdict.
The sole real field, `meanSteps`, retains its original JSON number token through
hash-bound `JSONText` traversal and compares exact integer coefficients and
base-10 exponents. The [decimal investigation](../review/HSM-RECOVERY-MEAN-RC.md)
records why preserving that token is necessary.

Only algebraically redundant words are omitted: adjacent same-face moves reduce,
and opposite-face moves commute. A separately executed test compares the pruned
search with all 6,174 raw words of one through three HTM using physical frame
replay. Other controls corrupt structure, counts, selection, histograms, means
and sample paths; synthetic graphs challenge each level of the objective and
rounding ties. None of these controls rejects by an expected input hash.

The normal command always checks all eighteen rows and emits one deterministic
JSON verdict line. The internal one-row smoke API explicitly emits `valid:false`,
`status:UNKNOWN` and a partial claim. It is not exposed as a positive CLI mode.
Exit codes are 0 for a complete valid result, 1 for invalid JSON or claims, 2 for
unsupported arguments/schema/version and 3 for runtime or resource errors.

Resource bounds are 16 MiB per raw JSON input, nesting depth 64 and numeric token
length 128 bytes (the existing native reader); graph bounds are one million
nodes, fifty million endpoint edges, five hundred thousand word-cache entries and
ten million cached suffix words per mode. Exceeding a graph/cache bound reports
`ERROR` and establishes no proof. The model is reused within an invocation;
each mode's graph and distances are independently rebuilt.

Julia acceptance alone leaves confirmation **UNKNOWN**. Under [the authority
rule](../AUTHORITY.md), an independently implemented Flix checker must accept the
same raw files and produce the same complete result, followed by separate review.
Any actual dissent stops the proof and requires a documented root cause.
The runtime reachability of forced M/H poses and global print optimality remain
`NOT_CHECKED` / `UNKNOWN`; the unrestricted graph is a different claim from the
application's runtime policy. Minimum-mean period certificates are outside this
command and retain the scope of the [original HSM profile](../HSM-PROFILE.md).
