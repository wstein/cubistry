# Contributing to Cubistry

## Branches and pull requests

Start focused feature branches from current `main`. Use small, atomic [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/) and open a PR with scope, tests, verification commands and any known limitations. Keep PRs in draft while incomplete; only merge after human approval and required checks.

The repository's preferred policy is a linear `main` history: **Rebase and merge** only, not merge commits or squash merging. GitHub repository settings and a `main` linear-history ruleset enforce this. Do not rewrite published `main` history. Resolve branch divergence explicitly and coordinate rebases with other agents working on shared branches.

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
