# Research branch migration preflight

Audit date: 2026-10-28. Tracks [#32](https://github.com/wstein/cubistry/issues/32).
Status: proposed migration; no branch rename, deletion, protection mutation or
history rewrite performed. Optimistic housekeeping permits this audit while the
PuzlWerk knowledge/documentation stack is under review.

## Frozen inventory

- Old remote: `spike/5x5-en-de-feasibility` at
  `7c05d28e97ecf30848220f5c70cb3100a4f3628d`.
- Tree: `a036e97056b36b1ba6fab8ae844a297a6ad8d77b`.
- Target `research/cube-display-feasibility` did not exist at audit time.
- Local `/workspace/cubistry` is clean at `9a3faf6`, five commits behind remote;
  it is not an unpublished divergent branch. Other counter/solver/review worktrees
  remain separate. Do not clean another session's worktree.
- Timer proof `22ad143168f814a1d7513d7ac2349b9c77c97a2d` is an ancestor of the
  remote head. Later commits preserve reversible timer optimization, portable CSV,
  fixed-title counter optimization and the Excel comparison. Earlier 5×5 language,
  palette, wordmark, century and SAT/UNSAT evidence remains in this same ancestry.
- [Historical PR #1](https://github.com/wstein/cubistry/pull/1) is already CLOSED,
  with recorded head `9a3faf6`; no closure was performed by this task. Its recorded
  head is older than today's research head. Never merge it to promote all research.

## Proof-preservation check

In a separate clean detached worktree at the remote head, ran:

```sh
python3 research/timer-2x2/verify.py
python3 -m unittest discover -s research/timer-2x2 -p 'test_*.py'
```

The checker passed; all nine negative/control tests passed. The existing claim is
scoped to a fixed upright-digit print: 00:00 through 59:50 at ten-second ticks,
with 60:00 impossible under that model. This audit neither creates a new proof
nor certifies animation speed, new layouts or all optimization statistics. Other
research artifacts are preserved by exact commit/tree ancestry, not re-generated.

## Protection and active references

Active rulesets `25981073` (Preserve 5x5 research spike) and `25943522`
(research-branch-protection) both target only the OLD ref and prohibit deletion
and non-fast-forward updates. Ruleset `25943525` protects linear `main`.
Repository merge commits and squash merges are disabled; rebase merge is enabled.
The target would not inherit these exact-name rules automatically.

Current active main-branch references are in AGENTS.md and CONTRIBUTING.md.
Keep them correct for the old protected branch until an approved migration actually
occurs; update both in the same authorized transition. Historical source URLs,
proof manifests, source hashes and PR/issue quotations retain their old strings.
Do not apply a global replacement. This planning PR changes no active routing.

## Approval-dependent procedure

1. Coordinate a short writer pause with maintainers and active Codex sessions.
   Re-fetch both refs, repeat ancestry checks, confirm clean/stale local worktrees,
   record the final source SHA/tree and inventory every new intervening commit.
2. Obtain explicit approval for branch migration and protection changes. Prefer
   creating the identical target ref first, applying deletion/non-fast-forward
   protection to it, and verifying SHA/tree/ancestry before touching the old ref.
   A GitHub rename or old-ref removal is also a maintainer operation.
3. Preserve an immutable recovery reference according to the maintainer's chosen
   retention policy. Do not delete the old branch as an agent cleanup step.
4. Verify all source/research paths, manifests, printable SVG/CSV/XLSX and proof
   commits remain reachable at the target. No rebase, squash or source edits.
5. Update active AGENTS/CONTRIBUTING/issue links and tracking/worktree upstreams;
   retain historical references. Migrate worktrees individually without discarding
   changes. Recheck protection for both names and agreed PR #1 treatment.
6. Document actual before/after refs and settings. Only the maintainer decides when
   to retire the old protected name. Do not infer production merge permission.

Rollback before retirement: retain the original protected ref and resume writers
there after coordination. If anything differs, stop the affected migration and
compare exact trees/ancestry; never fix evidence by rewriting it. Any later rollback
that changes protected refs/settings needs explicit maintainer authorization.
