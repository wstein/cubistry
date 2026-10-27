# Cubistry — Agent instructions

## Mission
Cubistry is a browser-first twisty-puzzle platform. Chronocube is a reference application; its calendar/clock display must be physically realizable, not merely visually plausible.

## Sources of truth
- Read `knowledge/Home.md` and `knowledge/CONVENTIONS.md` before modifying architecture, specs or research.
- Accepted ADRs govern decisions; specs govern requirements; Zettel capture hypotheses and findings. Do not silently rewrite accepted decisions.
- Keep experimentally verified facts distinct from proposals and assumptions.
- Existing results, scripts, and certificates in research branches are evidence; preserve their provenance.

## Work discipline
- Clarify assumptions and acceptance criteria in the relevant spec or task.
- Make small, focused Conventional Commits and provide a concise PR summary with verification commands and outstanding risks.
- Agent-authored PRs follow the independent author/reviewer workflow in [CONTRIBUTING.md](CONTRIBUTING.md#independent-agent-review). The author opens a draft and fixes findings; a separate reviewer publishes the final review and marks it ready only after clearance. Authors do not mark their own PRs ready.
- Never merge a draft PR without explicit approval. Never overwrite proof artifacts without retaining reproducibility.
- Keep proof research on its dedicated spike branch; keep foundational design changes on feature branches.
- Do not claim SAT or UNSAT from sticker capacity, a screenshot, solver log alone, or a candidate layout.
- Use exactly `SAT` (validated witness), `UNSAT` (independently checkable proof under explicit assumptions), or `UNKNOWN` (anything else) for feasibility outcomes.
- Prefer SVG/vector artwork for final print output; PNG is optional raster interchange/preview. Preserve font licensing, embedded asset provenance, dimensions, and sticker orientation.
- Run available tests and validators; disclose tests you could not run. Do not fabricate validation.

## Skills
For repeated workflows follow:
- `.agents/skills/feasibility-spike/SKILL.md` for mathematical investigations;
- `.agents/skills/proof-review/SKILL.md` for independent validation;
- `.agents/skills/validate-artwork/SKILL.md` for SVG, typography and printable output;
- [pr-review](.agents/skills/pr-review/SKILL.md) for independent PR review, findings, and reviewer-owned readiness.

Skill instructions are task-specific and do not override accepted project ADRs or specs.

## Git history and branch lifecycle
- Keep `main` linear. Use GitHub **Rebase and merge** for approved PRs; do not use merge commits or squash merges.
- Preserve small, meaningful Conventional Commits. Do not force-push `main`.
- Leave automatic remote branch deletion enabled for merged short-lived feature branches.
- `spike/5x5-en-de-feasibility` is a long-lived protected research branch: never delete it, force-push it, or retarget research into `main` without a separate approved PR. Ordinary non-force research commits are permitted.
- For concurrent agents, use separate branches and worktrees, and never clean up a worktree owned by another active agent. `git fetch --prune` does **not** delete local branches or active worktrees.
- Follow [CONTRIBUTING.md](CONTRIBUTING.md) for review and safe local cleanup.

## Language and documentation quality
- Write all project documentation, code comments, identifier prose, PR descriptions, and contributor-facing text in **US English (`en-US`)**. Preserve externally specified names, legal notices, quotations and data formats when required.
- Prefer US spellings (for example, `color`, `center`, `behavior`) over British variants.
- Run repository spelling and link checks on changed documentation before submitting a PR. Maintain narrowly scoped dictionary exceptions for domain terms; do not globally disable checks for convenience.
- Treat broken repository-relative links as blockers. Investigate external link failures separately because upstream sites can be transient or block CI.
