# Contributing to Cubistry

## Branches and pull requests

Start focused feature branches from current `main`. Use small, atomic [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and open a PR with scope, tests, verification commands and any known limitations. Agent authors open PRs as drafts and leave readiness to an independent reviewer as described below. Merge only after human approval and required checks.

The repository's preferred policy is a linear `main` history: **Rebase and merge** only, not merge commits or squash merging. GitHub repository settings and a `main` linear-history ruleset enforce this. Do not rewrite published `main` history. Resolve branch divergence explicitly and coordinate rebases with other agents working on shared branches.

## Independent agent review

For agent-authored changes, use separate author and reviewer agents. The
coordinating agent tracks the handoff and sends findings back to the original
author. Follow the [PR review skill](.agents/skills/pr-review/SKILL.md).

1. **Author:** implement the scoped request in its own branch/worktree, run the
   relevant checks, push focused commits, and open a **draft** PR with the issue,
   resulting behavior, validation commands, and limitations. The author must
   not mark its own PR ready or publish an independent review of its own work.
2. **Coordinator:** after the draft and implementation are ready for review,
   assign a different agent to review the actual PR diff and current head commit.
3. **Reviewer:** check requirements, code, tests, evidence, and relevant risks.
   Apply the proof-review or artwork skills when needed. Report findings with
   severity, file/line references, and concrete expected corrections. Keep the
   PR in draft while findings or required validation remain unresolved.
4. **Author:** fix the findings on the same PR branch and report the new commit
   and verification results. The reviewer independently rechecks the fixes and
   changed scope; the author cannot clear findings on the reviewer's behalf.
5. **Reviewer:** once the final review is clear and required checks pass,
   publish a concise PR comment identifying the reviewed **head SHA**, review
   scope, checks actually run, limitations, and absence of unresolved findings.
   Verify that the PR head has not changed, then mark the PR **Ready for review**.
   Readiness belongs to this independent reviewer, not the original author.

Review is tied to a commit, not just a branch name. If review-relevant changes
arrive after clearance, restore draft status and review the new head before
marking it ready again. A stale review comment does not clear newer code.
An unavailable reviewer or blocked required check keeps the PR in draft;
report the blocker rather than substituting the author's self-review.

Ready means prepared for human review. It does not authorize merge, automatic
approval, or auto-merge. Leave the user's final merge decision intact.

## Dedicated research branch

`spike/5x5-en-de-feasibility` is a long-lived mathematical research branch with a separate protection ruleset (block deletion and non-fast-forward updates). Continue proof experiments there with regular, non-force commits. Never merge the whole research branch into `main`; independently verified findings may be promoted in their own focused PRs. Preserve reproducible proof artifacts and provenance.

**Automatic deletion of merged PR head branches stays enabled** for ordinary feature branches. This is intentional to limit remote branch buildup. Do not depend on post-merge cleanup to retain the research branch; keep its protection rules enabled and do not merge a PR whose head is that branch.

## Concurrent agents and worktrees

Give each concurrent agent a separate short-lived branch and worktree. Before cleaning up, ensure that the agent has finished and its changes are committed, pushed or intentionally discarded.

Useful inspection and cleanup commands:

```sh
git fetch --prune
git worktree list
git branch -vv
```

When a worktree is no longer in use, remove it *explicitly*:

```sh
git worktree remove /path/to/finished-worktree
git branch -d finished-feature-branch
git worktree prune
```

`git fetch --prune` deletes stale **remote-tracking references**, not local branches. `git worktree prune` cleans stale worktree administrative records, not healthy active worktrees. `git branch -d` may refuse deletion if Git sees unmerged work; investigate rather than forcing deletion. Do not run bulk deletions or use `git branch -D` on uncertain branches.

## Repository instructions

Read [AGENTS.md](AGENTS.md) for Codex rules and [knowledge/CONVENTIONS.md](knowledge/CONVENTIONS.md) for the Obsidian-compatible knowledge base. Evidence and independent mathematical validation requirements apply to all feasibility work.

## Writing and documentation checks

Use **US English (`en-US`)** consistently for source comments, documentation, descriptions and project prose; keep API names, quotations and externally required identifiers unchanged.

Documentation CI runs [typos](https://github.com/crate-ci/typos) with `typos.toml` and [lychee](https://github.com/lycheeverse/lychee) for Markdown links. Repository-local broken links fail the PR; remote URL checks are advisory while external sites may rate-limit or block automation. Prefer repository-relative Markdown paths that work on GitHub and in Obsidian.

Run the equivalent tools locally before requesting review when installed:

```sh
typos --config typos.toml .
lychee --offline --root-dir . --exclude-file .lycheeignore './**/*.md'
```

Keep any dictionary exceptions in `typos.toml` specific and documented. Do not suppress entire documentation directories to hide spelling or link errors.
