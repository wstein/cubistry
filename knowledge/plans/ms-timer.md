---
id: PLAN-MS-TIMER
title: M/S Timer on two cubes, one-second resolution
type: plan
status: draft
created: 2026-11-01
---
# M/S Timer on two cubes, one-second resolution

## Purpose
Add an **M/S Timer** (application id `ms-timer`): a Stopwatch and a Countdown on two physical 2×2 cubes, one showing minutes and one showing seconds, at **one-second resolution**. The 60-Minute Timer works in 10 s steps on one cube and the 5-Second Timer in 5 s steps on one cube; neither can show single seconds on a cube. Owner request (paraphrased): a timer with two cubes in the M/S layout.

This plan records the owner decisions of 2026-11-01, assumptions, acceptance criteria and the few remaining open points. The front matter status stays `draft`: `knowledge/CONVENTIONS.md` defines no status for owner-approved plans, so none is invented here. Claims about the M/S print are **research candidates** from research PR #138 and application PR #148, not settled results. Feasibility wording follows `AGENTS.md`: `SAT`, `UNSAT` and `UNKNOWN` only where their definitions are met; nothing in this plan is a new proof claim.

## What exists (verified in the repository at the time of writing)
Verified means: read in the named file on `origin/main`. The plan was written at `34dc177`; the citations below were re-checked against `origin/main` at the 2026-11-01 tip (test(hsm): pin the safe-point density of the sliced search) (line numbers in `clock.ts`, `scheduler.ts`, `stage.ts` and `framing.ts` were unchanged; the `clock/scheduler.ts` citation was corrected).

- **Monotonic timer clock.** `WorkshopClock` (`src/apps/timer/clock.ts:32`) is one anchored virtual clock for both directions, with `start`, `pause`, `reset`, `setSpeed`, and `snapshot()` reading all deadline fields from one monotonic sample (`clock.ts:60`). It is parameterized by a `TimerProfile` (`stepSeconds`, `maxSeconds`, `defaultSeconds`, `stepName`; `clock.ts:3-8`); the two profiles are 10 s / 3590 / 900 and 5 s / 2395 / 1800 (`clock.ts:9-20`). `liveSeconds` already has one-second resolution (`clock.ts:80-84`). Countdown rounds the bucket up, Stopwatch down (`clock.ts:63-66`).
- **Timer behavior and controls** (`docs/WORKSHOP_TIMER.md`): Countdown, Stopwatch (stops at its maximum without wrapping), one Start/Pause/Resume button, Reset, Set, Timer speed (1×, 10×, 20×, 50×, 100×) and Rotation Speed. Timer rotation default is a preferred 250 ms per HTM move, Counter 100 ms. Pause retains fractions. `docs/FIVE_SECOND_TIMER.md` adds the exact inclusive domain, rejection (not rounding) of out-of-range durations and the explicit report of an infeasible budget or missed deadline.
- **Predictive scheduler and contiguous timing.** The final legal turn ends at the absolute deadline `T`, with a 20 ms observed endpoint tolerance; the scheduler reserves at most half the interval, with `overhead = 75*N + 8` ms, `effective = min(preferred, max(10, (B - overhead - 20) / N))` and `B = min(I/2, deadline - preparationFinishedAt)` (`docs/WORKSHOP_TIMER.md`, "Physical synchronization"). Every move gets a contiguous window ending at `T` (`docs/TIMER_CONTIGUOUS_TIMING.md`). Constants: `src/apps/timer/scheduler.ts:6-9`, `planSequence` at line 10.
- **Clock stage.** `ClockStage` (`src/apps/clock/stage.ts`) is fixed to three cubes: the caster centers array has three entries (line 18), cube creation requires `index < 3` (line 68), the position is `(index - 1) * 2.8` (line 76), the camera far plane uses `2.8` (line 92). The framing helpers assume the row `clockCenters = [-2.8, 0, 2.8]` (`src/apps/clock/framing.ts:6`, used at lines 19, 40 and 46). `ClockValues` is a three-tuple (`src/apps/clock/scheduler.ts:3`) and `LiveClockScheduler` requires exactly three units (`units.length === 3`, line 67).
- **H/M Counter plan** ([hm-counter.md](hm-counter.md), draft): the same stage generalization (work package 1) and a pair controller with a carry rule (work package 2). This plan must stay consistent with it. Naming: PR #143's one-cube application is renamed "H/M One-Cube Counter" (id `hm-one-cube`) so that "H/M Counter" stays reserved for the two-cube plan in [hm-counter.md](hm-counter.md), which this plan does not edit.
- **M/S Counter, PR #148, merged** into `main` on 2026-11-01 (merge commit `c592dbf`; its 10 commits are `7431ed7^..c592dbf` on `origin/main`; `docs/MS_COUNTER.md`, `src/apps/ms/{controller,design,period}.ts`): print **S3** from research PR #138 (`research/ms-counter-3move`), pinned at commit `ee88e5725be8e5e1acf554d924ae9a6d5da43de3` (`ms-source.json`). One cube is set to unit M or S (letter in the upper-right cell, two digits below, an unprinted upper-left sticker). Reported by the research and re-read by the app's tests (`docs/MS_COUNTER.md`, "What the research reports"):
  - maximum 4 HTM per increment and per decrement, with 3 edges at 4 HTM (minutes 14→15, 35→36, 55→56); seconds stay within 3 HTM; the maximum of 4 is witnessed by replay, not proven optimal;
  - "max 3 HTM for both units" is `UNKNOWN`;
  - minutes: 1 lap, 177 HTM; seconds: **2 laps** (120 edges), 324 HTM;
  - the display reads 00 after 60 seconds steps while the full pose differs; the app follows the period node by node;
  - both research checkers (Julia and Flix) accept S3, but the Flix checker is a structural port of the Julia one, `proof-checkers/AUTHORITY.md` has no M/S profile, and so nothing is confirmed under it. No sticker sheets exist for S3.
- **Browser E2E:** repaired on `main` by PR #162 (`e486de3`, `00cb02e`). The heavy lane runs on the stack tip (`.github/workflows/counter.yml`: on push to `main` and on pull requests carrying the `e2e` label).

## Assumptions (not verified; to be checked in the work packages)
- A1. Two S3 cubes, one set to M and one to S, run independently from the one-unit data in PR #148 without new puzzle mathematics. This is a reuse assumption, not a research result.
- A2. A one-second profile such as `stepSeconds: 1`, `maxSeconds: 3599` fits `TimerProfile` without changing `WorkshopClock`'s clock arithmetic. The clock was read for 5 s and 10 s steps only.
- A3. The scheduler constants and formula above apply unchanged per cube at a one-second interval.
- A4. Derived arithmetic, from the formula above at 1× (`I = 1000`, `B = 500`), shown to frame owner decision 2: for `N = 4` moves, `overhead = 308`, `(500 - 308 - 20) / 4 = 43` ms per move; for `N = 3`, `(500 - 233 - 20) / 3 = 82.3` ms; for a serial 3 + 4 = 7 moves, `overhead + 20 = 553 > 500`, so no feasible plan under that formula. Derived arithmetic, not a measurement.
- A5. Derived arithmetic for other Timer speeds, from `planSequence` (`src/apps/timer/scheduler.ts:10-16`): `I = 1000 / speed` ms, `B = I / 2`, and a plan is feasible when `8 + 75*N + 10*N + 20 <= B` (wake allowance 8, frame allowance 75, minimum move 10, endpoint tolerance 20; lines 6-9). At 10x, `B = 50 < 113` (the value for `N = 1`), so no step with a move is feasible from 10x up. The largest speed with a feasible plan is about 4.4x for `N = 1`, 1.77x for `N = 3`, 1.36x for `N = 4` (`B >= 368`) and 0.80x for a serial `N = 7` (`B >= 623`). The 1x to 100x set of the existing timers (`docs/WORKSHOP_TIMER.md`) therefore does not carry over to one-second steps unchanged (owner decision 8: 1x only). Derived arithmetic, not a measurement.

## Proposed behavior
1. **Two cubes, M left and S right**, one stage, the layout of the M/S Counter print S3 on each cube.
2. **One time value 00:00–59:59** counted in seconds. The S cube shows 00–59, the M cube shows 00–59. Whole seconds only: no sub-second state on the cubes.
3. **Stopwatch and Countdown** with the controls of the existing timers (Start/Pause/Resume, Reset, Set, Rotation Speed; Timer speed is fixed at 1x in the first version, owner decision 8). Pause retains fractions; the live readout and cube target come from one monotonic sample.
4. **Carry:** the S cube changes every second; on 59→00 (Stopwatch) or 00→59 (Countdown) the M cube changes in the same step, so both cubes turn in parallel (owner decision 2).
5. The next target is prepared ahead and the last turn of each cube ends at the one-second boundary, as in the existing timers.

## Approach (recommended): a 3-PR stack
Dependency: PR #148 (S3 data, `MsController`, period handling) is **merged** (`c592dbf`), so the stack can start.
1. **Stage generalization (shared with the H/M Counter plan).** `ClockStage` and the framing helpers take a cube count of two or three. The three-cube Live Clock stays unchanged and its tests stay green. If the H/M Counter lands this work first, this PR is dropped.
2. **Pair controller with carry (shared).** One combined counter over a minor and a major unit (60-modulus for M/S; 60 and 24 for H/M) with a carry rule, owning two single-cube controllers. [hm-counter.md](hm-counter.md) describes this controller as owning two `HsmController`s and must be aligned with the generic design in this work package (not changed by this plan). Generic in the unit moduli and cube controllers so that the H/M Counter and the M/S Timer use the same code. Unit tests with independent replay helpers.
3. **M/S Timer application.** One-second profile on `WorkshopClock`, Stopwatch and Countdown, scheduler wiring per cube, controls like the existing timers, application choice, documentation, tests.

## Work packages
1. PR 1 above, including the stage and framing tests.
2. PR 2 above, including the carry rule for both parameter sets.
3. PR 3 above; a docs page `docs/MS_TIMER.md` with the research caveats of `docs/MS_COUNTER.md`.
4. Entries in the application choice lists of the pages, as in the H/M plan. Application id `ms-timer`, name "M/S Timer".

## Alternatives considered and rejected
- **Single-PR build.** Stage generalization, pair controller and timer wiring in one review: too many simultaneous changes for an independent review.
- **Extend the 60-Minute Timer.** Not possible: its immutable 24-sticker print and its 10 s steps (`docs/WORKSHOP_TIMER.md`) cannot show single seconds.
- **New research print with M and S on one cube.** Out of scope for this plan; it would need its own research branch and SAT/UNSAT/UNKNOWN outcomes.

## Acceptance criteria
- The three-cube Live Clock, the M/S Counter, the 60-Minute Timer and the 5-Second Timer behave exactly as before.
- Every displayed value 00:00 to 59:59 is reached by legal moves only, replayed by helpers independent of the controller (the converted S3 data and a separate cube model, not the controller's own state).
- Carries are covered up and down: 00:59→01:00, 01:59→02:00, 58:59→59:00 and 59:00→58:59; and the 4-HTM minutes edges 14:59→15:00, 35:59→36:00 and 55:59→56:00 with their reverse steps, the worst case for owner decision 2 (edges per `docs/MS_COUNTER.md`).
- The range and ends (owner decision 3): Stopwatch stops at 59:59 without wrapping, Countdown stops at 00:00 and its default duration is 15:00; neither continues past its end; the end state is a displayed value of the print.
- Deadlines, at 1x only (owner decision 8, A5): the last turn of each cube ends at the one-second boundary within the documented 20 ms tolerance in deterministic scheduler tests with the virtual clock; the carry step plans one time budget per cube for the larger word (up to 4 HTM for the minutes). An infeasible budget or missed carry is reported, never shown late silently (owner decision 2). Serial turning of both cubes is not tested as a feature because it is infeasible under the formula (A4).
- Pause and resume keep fractions (for example pausing at 12.5 s shows 00:12 and keeps the 0.5 s). Set and Reset walk the saved period step by step without free jumps; Reset takes the shortest route to the configured duration (Countdown) or to zero (Stopwatch).
- Seconds cube lap: after 60 steps the display repeats while the full pose differs; the lap is planned internally (lap-aware, fewest HTM, as in PR #148) and is not shown in the timer UI; the test replays both laps and checks the lap-aware pose.
- No physical state is invented: only S3 period nodes and their saved words (or inverses) are played, and interrupted routes follow the PR #148 rules. Any new claim carries the SAT/UNSAT/UNKNOWN wording of `AGENTS.md`.
- Documentation and UI text in US English; spelling and link checks pass.

## Decisions
Owner decisions, 2026-11-01 (the owner answered "Alles ja" to the coordinator's recommendations; wording below is the recommendation as accepted):
0. **Carry semantics** transfer unchanged from the H/M Counter plan: one combined counter with carry (confirmed).
1. **Speed default:** 100 ms per HTM move, as in the Counter. The scheduler still reduces it per step: derived arithmetic (A4) at 1x gives about 82 ms with 3 moves and 43 ms with 4 moves. Not a measurement.
2. **Carry step:** both cubes turn in parallel with one time budget per cube, planned for the larger word (up to 4 HTM for the minutes). Serial turning (3 + 4) is excluded because it is infeasible under the formula (A4). A missed carry is reported, never shown late silently, as in the existing timers.
3. **Range and ends:** 00:00–59:59. The Stopwatch stops at 59:59 without wrapping, like the existing timers; the Countdown stops at 00:00. Countdown default 15:00 (the default of the 60-Minute Timer).
4. **Seconds cube with 2 laps:** handled internally as in PR #148 (lap-aware planning, fewest HTM). The lap is not shown in the timer UI. A test replays both laps.
5. **Set and Reset** walk the saved period step by step as in PR #148 (no free jumps). Reset takes the shortest route to the configured duration or to zero.
6. **E2E gating:** PR 1 (stage) and PR 2 (pair controller) get Node tests plus the existing specs unchanged; new browser specs only in PR 3; the heavy lane (label `e2e`) only on the stack tip.
7. **Name:** "M/S Timer", application id `ms-timer`, docs page `docs/MS_TIMER.md`. PR #143's one-cube application is renamed "H/M One-Cube Counter" (id `hm-one-cube`) so that "H/M Counter" stays reserved for the two-cube plan ([hm-counter.md](hm-counter.md), not edited here).
8. **Timer speeds:** only 1x in the first version. Derived arithmetic (A5): 4 moves are feasible only up to about 1.36x, 3 moves about 1.77x, one move about 4.4x, a serial 7 moves about 0.80x; at 10x not even one move fits. Acceleration is a later, separate decision; tests use the virtual clock and need no acceleration. Not a measurement.

Still open (not covered by the decisions above):
1. **UI label wording.** The product wording of the labels (buttons, status text) is pending the owner.
2. **Exact unit tests for the lap-aware replay.** Decision 4 requires a test that replays both laps; which start poses, which Set and Reset routes and which interrupted steps it covers is left to PR 3 and its review.
3. **Sticker sheets for S3.** None exist; out of scope here (see below), a separate decision.

## Out of scope
- New puzzle prints, solvers or proofs, including M and S on one cube; the M3 print of PR #138; sticker sheets for S3; sub-second display; a wall-clock mode (the Live Clock covers it); changes to the 60-Minute and 5-Second Timers.

Back to [Plans](index.md).
