# Contributing to Cubistry

## Branches and pull requests

Agent collaboration (roles, review, Ready, merge, rewrite, stacks, labels, identity, reports) follows the global agent rules, not this file.

Start focused feature branches from current `main`. Use small, atomic [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/).

A PR describes its scope, a short summary, the verification commands you ran, and known risks or limitations.

Merge: Rebase and merge only. Repository merge settings and a linear-history ruleset on `main` enforce this.

Agent rules are in [AGENTS.md](AGENTS.md).

## Dedicated research branch

`research/cube-display-feasibility` is the active long-lived mathematical research branch. Both research protection rulesets block deletion and non-fast-forward updates. Continue proof experiments on the new branch with regular, non-force commits. Never merge the whole research branch into `main`; independently verified findings may be promoted in their own focused PRs. Preserve reproducible proof artifacts and provenance.

The former `spike/5x5-en-de-feasibility` remains protected temporarily as a recovery reference. Retire it only after verifying all active agents, worktrees, tracking references, and CI links have switched to the new branch, with a separately approved removal of the old-name protection rules and old remote ref. Preserve historical source references unchanged.

**Automatic deletion of merged PR head branches stays enabled** for ordinary feature branches. This is intentional to limit remote branch buildup. Do not depend on post-merge cleanup to retain the research branch; keep its protection rules enabled and do not merge a PR whose head is that branch.

## Repository instructions

Read [knowledge/CONVENTIONS.md](knowledge/CONVENTIONS.md) for the Obsidian-compatible knowledge base. Evidence and independent mathematical validation requirements apply to all feasibility work.

## Writing and documentation checks

Use **US English (`en-US`)** consistently for source comments, documentation, descriptions and project prose; keep API names, quotations and externally required identifiers unchanged.

Documentation CI runs [typos](https://github.com/crate-ci/typos) with `typos.toml` and [lychee](https://github.com/lycheeverse/lychee) for Markdown links. Repository-local broken links fail the PR; remote URL checks are advisory while external sites may rate-limit or block automation. Prefer repository-relative Markdown paths that work on GitHub and in Obsidian.

Run the equivalent tools locally before requesting review when installed:

```sh
typos --config typos.toml .
lychee --offline --root-dir . --exclude-file .lycheeignore './**/*.md'
```

Keep any dictionary exceptions in `typos.toml` specific and documented. Do not suppress entire documentation directories to hide spelling or link errors.

## Shared solver dependency setup

Run `npm run setup` before the first build/check (Node 24+, npm, Git and Python 3).
This first verifies or rebuilds the immutable provider package pinned in
`puzlwerk-source.json`, then runs the existing `npm ci`. It does not publish a
package or version solver source/table bytes in Cubistry. CI and Pages perform
the same preparation before installation. See the
[shared solver integration contract](docs/COUNTER_SHARED_SOLVER.md) for provenance,
stacked PR dependencies and verification.
