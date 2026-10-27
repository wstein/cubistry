---
id: PLAN-CHRONOCUBE-DESIGN-WORKFLOW
title: Chronocube design-to-Codex workflow
type: plan
status: draft
created: 2026-10-27
---
# Chronocube design-to-Codex workflow

## Purpose
Use the design conversation as a workshop for typography, visual directions, and comparison. Use the **repository** for durable decisions and Codex for specification, implementation, tests, and feasibility research. Git-tracked knowledge is the source of truth; this guide itself is a proposal for review.

## Handoff procedure
1. **Discover before creating.** Read [Knowledge Home](../Home.md), [conventions](../CONVENTIONS.md), existing [ADRs](../adr/index.md) and [specifications](../specs/index.md), plus actual assets, code, and proof records. Extend existing authoritative files rather than duplicating them.
2. **Capture proposal.** For each design change, record the exact view, sticker coordinates, glyph/color/weight inventory and whether the change is visual-only or affects physical sticker constraints. Save editable SVG assets in the existing asset location as appropriate.
3. **Resolve authority.** Compare with current accepted ADRs, approved specs, and verified certificates. Flag conflicts and missing evidence. Do not silently promote chat preferences to final requirements.
4. **Validate.** Ask Codex to implement or research independently on an appropriate branch. Use the repository's feasibility-spike, proof-review, and validate-artwork skills where applicable. Keep long-lived research work on its designated branch.
5. **Review.** Submit focused Conventional Commits in a PR; include links, commands, limitations, font licenses and affected docs. Do not merge a draft without human approval.
6. **Document the decision.** Once approved, update the relevant existing spec and, when warranted, add a concise ADR with alternatives and consequences. Link exact evidence from its original location.
7. **Return to design.** Bring technical limitations back to the design conversation only when a new visual/product tradeoff needs deciding.

## Initial reconciliation checklist
- Confirm 5×5 row/column semantics, pinned divider, weekday abbreviations, date/year/time ranges and leap-year logic against actual specs.
- Audit Manufacture style assets, palette and Quicksand licensing/weights; distinguish study files from production assets.
- Inspect the original independent weekend-color UNSAT evidence and document the exact proven scope.
- Determine if four wordmark stickers or right-aligned years are tested or remain UNKNOWN.
- Ensure indexes link to authoritative documents. Track executable tasks in GitHub Issues, not a duplicate task list in the vault.

## Links
- [Design baseline draft](../specs/chronocube-design-handoff.md)
- [Conventions](../CONVENTIONS.md)
- [Project agent instructions](../../AGENTS.md)
