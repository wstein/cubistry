# Native HSM recovery verification

This experiment is registered before native recovery verdicts. The final scoped result
is **SAT / CONFIRMED**; see [results](RESULTS.md). [Issue 98](https://github.com/wstein/cubistry/issues/98) tracks the
implementation and delivery; this directory preserves research provenance and
later immutable run records rather than mirroring the task list.

The [manifest](manifest.json) binds the unchanged recovery and mode inputs at
research revision `30b6d022da60c366d79de5498497df0a07e28caf` and the additive
contract. Original witnesses and historical verification are preserved in place.
Merged [PR 95](https://github.com/wstein/cubistry/pull/95) confirms the original
and all-mode witnesses only; its scope does not include the recovery table.

Julia runs first. Only after a complete Julia acceptance and meaningful negative
controls does the independent Flix implementation run on the same two raw files.
Neither implementation consumes another checker's verdict. Python is not an
authoritative proof gate. Any accept/reject, replay, hash or count disagreement
retains UNKNOWN and requires a documented Codex Sol or Claude Opus root-cause
investigation before correction and rerunning both checkers.

The graph includes every legal settled pose displaying the selected unit and
range. Recovery edges show the next modular value and use up to five HTM, or
shortest six-HTM routes when no route of five exists. Reverse shortest paths
minimize above-limit edges, then display steps, then HTM. All 18 row counts,
histograms, means and sample paths must be recomputed independently.

The owner accepts six HTM for minutes and up to ten HTM for hours; seconds retain
the five-HTM normal-counting priority. Those runtime acceptance limits do not
change the unrestricted graph or prove which forced poses the application can
reach. Global print optimality and application reachability are outside this
experiment's claims.

Each run record must retain the exact checker source and contract revisions,
input and artifact hashes, tool versions, invocation, exit status, stdout,
stderr, elapsed time and resource limits. A partial smoke run is explicitly
partial and cannot confirm the full table. The final feature/documentation PR
will reference immutable research evidence and receive separate review.

For durable reproduction on the protected research branch, the exact raw
[recovery input](inputs/recovery.json) and [mode input](inputs/modes.json) are
archived here too. Their bytes match the manifest's original source hashes;
they are copies, not new witnesses or regenerated data.
