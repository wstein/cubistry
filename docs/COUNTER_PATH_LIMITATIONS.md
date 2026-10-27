# Counter path limitations and stacked PRs

[PR #20](https://github.com/wstein/cubistry/pull/20) establishes the shared
ReScript mechanics, fixed printing and independently replayed counter paths.
Its current controller uses:

```text
inverse(witness[current].word) + witness[target].word
```

This routes through the common reference state. The paths preserve legal moves,
physical sticker identities and upright target images; they are **not claimed
to be shortest direct transitions or optimal HTM solutions**. The independent
replay evidence proves the stated legality/target conditions, not optimality.
No solver rewrite or optimization is part of PR #20.

[Issue #23](https://github.com/wstein/cubistry/issues/23) separately tracks HTM
progress and the authorized existing-solver direct-transition integration.
The latter must solve from the actual current state to a selected complete
target and validate the exact frame; ordinary rotation-quotiented optimality
does not establish shortest paths to arbitrary valid printed displays.

The open Draft branches have separate scopes:

```text
PR #20 — shared foundation and fixed-print counter
  ├─ PR #22 — live existing-solver acceptance harness
  └─ PR #24 — visible HTM move progress (issue #23 Phase A)
```

Both #22 and #24 are stacked **directly on #20**, not on each other. The #22
head also mirrors #20's Web Crypto fix with an ordinary cherry-pick; that does
not make it a dependency of #24. Direct-transition integration is a separate
follow-up, not an implicit change in these foundation/acceptance PRs.

Earlier proof, source-hash manifests and review results remain historical
records of their stated commits. This clarification changes no runtime,
printing, witness or replay evidence. Keep the PRs Draft pending human approval;
readiness and merge are not authorized by this document.
