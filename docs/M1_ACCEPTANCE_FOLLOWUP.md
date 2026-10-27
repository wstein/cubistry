# Live-solver acceptance follow-up

[PR #22](https://github.com/wstein/cubistry/pull/22) is a **development-only
integration/acceptance harness**. Its adapter calls
`experimentalSolve2x2x2` for the start and the selected complete target, then
combines the first solution with the inverse of the second:

```text
actual start → common reference → selected complete target
```

These two calls do **not** establish a shortest direct path or printed-display
optimality. Exact-frame, full-target and independent physical replay checks
remain required and unchanged. The production counter's path is not replaced
by this acceptance PR; its ordinary fast witness playback remains separate.

[Issue #23](https://github.com/wstein/cubistry/issues/23) tracks the separately
authorized reuse of an existing solver for direct current-state → selected
complete target transitions. It does not authorize this PR to add a new search,
move counter, optimization or partial-display optimality claim.

PR #22 is stacked on [PR #20](https://github.com/wstein/cubistry/pull/20), with
#20's Web Crypto fix explicitly mirrored by an ordinary cherry-pick. It is
independent of [PR #24](https://github.com/wstein/cubistry/pull/24), which is a
separate sibling branch directly on #20 and implements HTM progress. Do not
fold either the move counter or direct-transition work into the harness.

The [acceptance evidence and limits](M1_ACCEPTANCE.md) remain intact. This
clarification changes no source, asset, witness, manifest or test. Earlier
results remain records of their reviewed commits. Keep the PR Draft pending
human approval; no readiness, merge or auto-merge is authorized here.
