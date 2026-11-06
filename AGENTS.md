# Cubistry — Agent instructions

## Mission
Cubistry is a browser-first twisty-puzzle platform. Chronocube is a reference application; its calendar/clock display must be physically realizable, not merely visually plausible.

## Sources of truth
- Read `knowledge/Home.md` and `knowledge/CONVENTIONS.md` before modifying architecture, specs or research.
- Accepted ADRs govern decisions; specs govern requirements. Do not silently rewrite accepted decisions.
- Keep experimentally verified facts distinct from proposals and assumptions.
- Existing results, scripts, and certificates in research branches are evidence; preserve their provenance.

## Work discipline
- Clarify assumptions and acceptance criteria in the relevant spec or task.
- Agent collaboration (roles, review, Ready, merge, rewrite, stacks, labels, identity, reports) follows the global agent rules, not this file.
- Labels: `e2e` starts the heavy lane (`counter.yml:65,97`; on PRs only the `fast` group); `preview` publishes a same-repo PR preview (`pages.yml:21-28`, `pages-publish.yml:8`).
- Never overwrite proof artifacts without retaining reproducibility.
- Keep proof research on its dedicated research branch; keep foundational design changes on feature branches.
- Do not claim SAT or UNSAT from sticker capacity, a screenshot, solver log alone, or a candidate layout.
- Use exactly `SAT` (validated witness), `UNSAT` (independently checkable proof under explicit assumptions), or `UNKNOWN` (anything else) for feasibility outcomes.
- Proofs are confirmed only when both the Flix and the Julia checker accept; read [proof-checkers/AUTHORITY.md](proof-checkers/AUTHORITY.md) (section "For agents") before any proof work.
  - We never vote; Python verifiers play no role in confirming proofs or settling dissent.
  - Any Flix/Julia dissent means `UNKNOWN` plus a root-cause investigation as described in the authority file.
- Prefer SVG/vector artwork for final print output; PNG is optional raster interchange/preview. Preserve font licensing, embedded asset provenance, dimensions, and sticker orientation.

## Skills
For repeated workflows follow:
- `.agents/skills/feasibility-spike/SKILL.md` for mathematical investigations;
- `.agents/skills/proof-review/SKILL.md` for independent validation;
- `.agents/skills/validate-artwork/SKILL.md` for SVG, typography and printable output.

Skill instructions are task-specific and do not override accepted project ADRs or specs.

## Git history and branch lifecycle
- Merge: Rebase and merge only.
- Leave automatic remote branch deletion enabled for merged short-lived feature branches.
- `research/cube-display-feasibility` is the active long-lived protected research branch: never delete it, force-push it, or retarget research into `main` without a separate approved PR. Ordinary non-force research commits are permitted.

## Language and documentation quality
- Write all project documentation, code comments, identifier prose, PR descriptions, and contributor-facing text in **US English (`en-US`)**. Preserve externally specified names, legal notices, quotations and data formats when required.
- Prefer US spellings (for example, `color`, `center`, `behavior`) over British variants.
- Run repository spelling and link checks on changed documentation before submitting a PR. Maintain narrowly scoped dictionary exceptions for domain terms; do not globally disable checks for convenience.
- Treat broken repository-relative links as blockers. Investigate external link failures separately because upstream sites can be transient or block CI.

## PuzlWerk naming conventions

- Display/branding: **PuzlWerk**. Technical identifiers, paths, directory names and imports always use lowercase `puzlwerk`.
- GitHub repository: `wstein/puzlwerk`. npm scope: `@puzlwerk/*`; a scope name does not imply a published package or authorize a new dependency.
- Apply exact-case, context-aware edits to active references; never use global case-insensitive replacements.
- Preserve historical ADR wording, immutable snapshots, source URLs/revisions/hashes, quotations and license/copyright notices. Classify old-name occurrences as historical, active or uncertain; report uncertain cases for review instead of silently changing them.
- Naming-only work does not authorize a solver/application change, package publication or migration. Preserve existing `@cubistry/*` packages.

## Visual branding and theme consistency
- **Icon and Palette Provenance**: The brand visual identity is grounded in `public/brand/cubistry-mark.svg` (logo, quarter-turn mark; dark variant `public/brand/cubistry-mark-dark.svg`) and `public/favicon.svg` (favicon, 2×2 sticker grid in berry plastic and deep navy ink; PNG set `public/favicon-16.png`, `-32.png`, `-48.png`, `public/apple-touch-icon.png` shows the mark). Minimum sizes: mark 24 px, favicon 16 px. The 512 px mark PNG files are in `docs/design/brand/`.
  - Body / Plastic Primary: `#9e0b5c` (Dark: `#7a0645`, Highlight: `#c8257e`).
  - Face / Sticker Surface: `#fffdf6`.
  - Lettering / Segments Ink: `#153b61`.
  - App Canvas Background: `#f5f3eb`.
- **UI Elements**: Use the berry plastic tone for `.brand-mark` and primary call-to-action buttons (`button.primary`). Keep text and control readouts in navy/ink tones (`--color-ink-navy`).
- Do not introduce unrelated neon or high-saturation greens/blues into the core Chronocube shell without ADR approval.
