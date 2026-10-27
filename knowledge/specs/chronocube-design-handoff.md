---
id: SPEC-CHRONOCUBE-DESIGN-HANDOFF
title: Chronocube design baseline and Codex handoff
type: spec
status: draft
created: 2026-10-27
---
# Chronocube design baseline and Codex handoff

## Scope
A reviewable design-to-implementation handoff, **not** a change to the solver baseline or a manufacturing approval. Reconcile every statement with existing accepted ADRs, specifications, code, and proof evidence before approving this specification.

## Working design direction (conversation-sourced, pending repository reconciliation)
- Working style name: **Style 01 — Manufacture**.
- Weekday row: three large German letters; the preferred typography is **Quicksand ExtraBold for all weekdays**, not just weekends. Uniform styling avoids introducing separate weekend weekday glyph variants.
- Functional numerals: **Quicksand SemiBold** is the working preference for date, year, and time; compare real licensed font files and validate print dimensions before approval.
- Working colors: anthracite weekdays, red date/month accents, blue time numerals; retain a restrained red accent. Pin actual color values only after checking existing repository design assets; do not invent production hex values.
- 5×5 display working arrangement: weekday row; day/month row; year row; wordmark/divider row; HH:MM time row. The year currently has an empty center sticker as the working baseline (e.g., `2|0|·|2|6`). Right-aligned `·|2|0|2|6` remains an *unproven alternative*.
- Wordmark: compact cube-clock icon over CHRONOCUBE, with optional tiny “Time in Motion”; current visual preference uses three stickers. In row 4 the first sticker is reserved for the fixed divider; positions 2–5 are a **research candidate**, not a released four-sticker logo. The divider must not be consumed by a full-width wordmark.
- Weekend-red weekday glyphs: a prior research discussion reports an independent UNSAT proof for a particular pinned baseline (reference: [research commit](https://github.com/wstein/cubistry/commit/9a3faf6522db78fc89a7dc6fae48ffc32b94b73f)). Verify the actual assumptions and certificate before treating the scope of that result as authoritative; do not generalize it to different layouts.

## Requirements
1. Design proposals must be labeled as draft, approved, or blocked by feasibility, with links to relevant decisions and evidence.
2. A changed glyph, color, weight, position, or print shape must be evaluated for its effect on physical sticker inventory and Cubie-orbit constraints.
3. Keep existing validated baseline and pinned divider intact unless an independently verified replacement is accepted.
4. Artwork handoff must include editable SVG, exact sticker dimensions, typographic measurements, font licenses and reproducible previews; do not silently replace fonts.
5. Only call a candidate `SAT` with validated witness, `UNSAT` with independently checkable proof under stated assumptions, or `UNKNOWN` otherwise.

## Acceptance criteria
- Inventory and link existing documents under `knowledge/`, artwork, calendar rules, geometry definitions, and proof artifacts before promoting this draft to approved.
- Resolve font availability and font naming (Quicksand, not “Quickstand”); verify whether the intended ExtraBold weight exists as an authentic font or requires another reproducible technique.
- Compare candidate functional typography using one consistent 5×5 sticker model with real units and edge clearances.
- Record right-aligned year, four-sticker wordmark, and alternate coloring as open alternatives, not approved feasibility claims.
- Add an ADR only when an explicit consequential decision is approved, using existing templates.

## References
- [Knowledge conventions](../CONVENTIONS.md)
- [Specifications index](index.md)
- [Design handoff guide](../plans/chronocube-design-workflow.md)
- [Existing ADRs](../adr/index.md)
