---
name: pr-review
description: Independently review an agent-authored draft PR, return findings to the author, and publish reviewer-owned readiness only after final clearance.
---
# Independent PR Review

Use for the repository's [author/reviewer workflow](../../../CONTRIBUTING.md#independent-agent-review).
This skill governs independent review and readiness, not implementation or merge.
Follow [AGENTS.md](../../../AGENTS.md) and the applicable task instructions.

## Roles and inputs

The reviewer must be a different agent from the implementation author. The
coordinator assigns the review after the author opens a draft PR. The author
remains responsible for source changes and fixing findings on the same branch.
Do not certify your own implementation as an independent review.

Read the issue/request, PR description, base branch, current head SHA, diff,
repository instructions, and available tests/evidence. Review in a separate
worktree or immutable snapshot; never alter or clean up the author's worktree.
Use the sibling [proof-review](../proof-review/SKILL.md) skill for mathematical
claims and [validate-artwork](../validate-artwork/SKILL.md) for artwork changes.

## Review and fix loop

1. Record the exact PR head SHA and inspect its diff against the intended base.
   Check requirement coverage, correctness, regressions, test quality, licenses,
   evidence, and material risks. Scale checks to the change: documentation needs
   spelling/local-link checks; executable changes need appropriate runnable
   checks. Inspect what the checks prove rather than trusting a passing summary.
2. Run relevant validation independently. Record exact commands, results, and
   checks that could not run. Do not claim code was tested when it was only read.
3. Return concrete findings to the coordinator/original author with severity,
   file/line location, reproduction or reasoning, and expected behavior. Keep the
   PR in draft. Do not silently fix implementation while acting as reviewer.
4. After the author fixes findings, fetch the new head and independently check
   the changes and necessary regressions. Repeat until all findings are resolved
   and required validation passes. Mark an accepted limitation explicitly; do
   not silently discard a finding or change a requirement to clear the review.

## Final clearance and readiness

When the user has requested this PR review workflow, the independent reviewer
owns both the final PR comment and the change from draft to ready. The author
must not perform those steps on the reviewer's behalf.

1. Confirm the current PR head still equals the reviewed SHA and required
   checks pass. If validation or required CI is blocked/pending, keep the PR
   in draft and report that status. Never bypass a check to make readiness work.
2. Post a concise review comment with the reviewed head SHA, scope, commands
   actually run and outcomes, meaningful limitations, and a clear statement
   that no unresolved findings remain. This is an agent review summary, not
   a fabricated human approval or a claim of a different GitHub identity.
3. Recheck the head immediately before marking ready. If it changed, review
   the new head first. Otherwise mark Ready for review and verify the result.
   If the head changed during promotion, restore draft and review the new head.
4. If review-relevant changes land after clearance, restore draft status and
   repeat the review for the new head; do not reuse an earlier clearance.

Use structured tool arguments or body files to preserve comment formatting:

```sh
gh pr view PR_NUMBER --json headRefOid,isDraft,statusCheckRollup
# Write the reviewed SHA and actual review results to /tmp/pr-review-summary.md.
gh pr comment PR_NUMBER --body-file /tmp/pr-review-summary.md
# Recheck headRefOid before and after this command.
gh pr ready PR_NUMBER
# If the head changed or review is no longer clear:
gh pr ready PR_NUMBER --undo
```

If the reviewer, comment permission, readiness permission, or required checks
are unavailable, report the blocker and retain draft status. Do not merge,
enable auto-merge, or treat readiness as the user's final merge approval.
