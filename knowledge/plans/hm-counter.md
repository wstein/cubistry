---
id: PLAN-HM-COUNTER
title: H/M Counter on two cubes, based on the live clock
type: plan
status: draft
created: 2026-10-31
---
# H/M Counter on two cubes, based on the live clock

## Purpose
Add an **H/M Counter**: two physical 2×2 cubes, one showing hours and one showing minutes, that count like the H/M/S Counter but as a pair. It reuses the building blocks of the Live H–M–S Clock instead of adding new puzzle mathematics. Owner request, 2026-10-31: "create an H/M Counter based on the H–M live clock", two cubes H and M with counter controls.

This plan only records assumptions, acceptance criteria and the decisions still needed. It does not approve implementation, and it makes no claim about physical routes beyond what the existing H/M/S print and its verified periods already cover.

## What exists (verified in the repository at the time of writing)
- The Live H–M–S Clock (`clock.html`, `src/clock.mjs`) creates one `HsmController` per cube on one shared WebGL scene (`ClockStage`, `src/apps/clock/stage.ts`) and drives them from `LiveClockScheduler` (`src/apps/clock/scheduler.ts`).
- Each HSM cube uses the seconds-first print with the unit letters H, M and S, and supports the count ranges 00–59, 00–23 and 00–11 (`src/apps/hsm/design.ts`, `docs/HSM_COUNTER.md`).
- The H/M/S Counter (`index.html?application=hsm-counter`, `src/main.mjs`) has the controls Unit, Count range, Direction, Set value, Run/Stop, Reset, ±1 and a Rotation Speed slider with per-unit defaults: hour 500 ms, minute 250 ms, second 100 ms per HTM move.
- `ClockStage` is fixed to three cubes: `createCube` rejects an index of three or more, `clockCenters` is `[-2.8, 0, 2.8]`, the caster centers array has three entries and the framing helpers (`src/apps/clock/framing.ts`) assume that row.

## Proposed behavior (to be confirmed)
1. **Two cubes, H left and M right**, one stage, same lettering choice as the clock (large H / M or small hour / min).
2. **One time value from 00:00 to 23:59**, counted in minutes: the M cube shows 00–59, the H cube shows 00–23.
3. **Step, Run and Set**: ±1 minute, Run up or down with a direction control, Set value HH:MM. When the minutes wrap 59→00 (up) or 00→59 (down), the hour changes in the same step, so both cubes may turn at once.
4. **Speed**: the Rotation Speed slider keeps its 100 ms default; the minute cube defaults to 250 ms and the hour cube to 500 ms per HTM move, as in the H/M/S Counter.
5. A step ends only when both cubes have settled; no time-of-day clock and no wall-clock deadlines are involved.

## Work packages
1. Generalize `ClockStage` and the framing helpers from exactly three cubes to a given count (two or three), keeping the three-cube clock unchanged and its tests green.
2. A small pair controller that owns two `HsmController`s, the carry rule and the step/run state; unit tests with the existing physical replay helpers.
3. The page or application entry (`application` choice, controls, presentation, print link), reusing the H/M/S Counter controls where possible.
4. Documentation (`docs/`), the application choice lists in `index.html`, `clock.html`, `calendar.html`, and browser tests.

## Acceptance criteria
- The three-cube Live Clock and the H/M/S Counter behave exactly as before.
- Every displayed H:M value from 00:00 to 23:59 is reached by legal moves only, replayed independently of the controller; carries (for example 12:59 → 13:00 and 23:59 → 00:00, up and down) are covered.
- No physical state is invented: only prints and periods that the H/M/S Counter already verifies are used, and any new claim must carry the SAT/UNSAT/UNKNOWN wording required by `AGENTS.md`.
- Documentation and UI text in US English; spelling and link checks pass.

## Open decisions for the owner
- **Carry semantics:** one combined minute counter with carry (proposed) versus two independent counters.
- **Hour range:** 00–23 only (proposed) or an optional 12-hour range 00–11.
- **Entry point:** a new choice in the application list of every page (proposed) or a separate page.
- **Verification boundary:** the browser end-to-end suite has not passed on `main` since 2026-10-30 (see the Counter checks investigation), so browser tests for this application cannot be treated as gating until that is fixed.

## Out of scope
- New puzzle prints, solvers or proofs; a seconds cube; a wall-clock mode (the Live Clock already covers it).

Back to [Plans](index.md).
