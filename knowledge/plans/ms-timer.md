---
id: PLAN-MS-TIMER
title: M/S Timer on two cubes, one-second resolution
type: plan
status: draft
created: 2026-11-01
---
# M/S Timer on two cubes, one-second resolution

## Purpose
Add an **M/S Timer** (working name): a Stopwatch and a Countdown on two physical 2×2 cubes, one showing minutes and one showing seconds, at **one-second resolution**. The 60-Minute Timer works in 10 s steps on one cube and the 5-Second Timer in 5 s steps on one cube; neither can show single seconds on a cube. Owner request (paraphrased): a timer with two cubes in the M/S layout.

This plan records assumptions, acceptance criteria and open decisions. It does not approve implementation. Claims about the M/S print are **research candidates** from research PR #138 and application PR #148, not settled results. Feasibility wording follows `AGENTS.md`: `SAT`, `UNSAT` and `UNKNOWN` only where their definitions are met; nothing in this plan is a new proof claim.

## What exists (verified in the repository at the time of writing)
Verified means: read in the named file on `origin/main` (commit `34dc177`) or, where marked **PR #148**, on `origin/feat/ms-counter` (Draft, not merged, may be restacked).

- **Monotonic timer clock.** `WorkshopClock` (`src/apps/timer/clock.ts:32`) is one anchored virtual clock for both directions, with `start`, `pause`, `reset`, `setSpeed`, and `snapshot()` reading all deadline fields from one monotonic sample (`clock.ts:60`). It is parameterized by a `TimerProfile` (`stepSeconds`, `maxSeconds`, `defaultSeconds`, `stepName`; `clock.ts:3-8`); the two profiles are 10 s / 3590 / 900 and 5 s / 2395 / 1800 (`clock.ts:9-20`). `liveSeconds` already has one-second resolution (`clock.ts:80-84`). Countdown rounds the bucket up, Stopwatch down (`clock.ts:63-66`).
- **Timer behavior and controls** (`docs/WORKSHOP_TIMER.md`): Countdown, Stopwatch (stops at its maximum without wrapping), one Start/Pause/Resume button, Reset, Set, Timer speed (1×, 10×, 20×, 50×, 100×) and Rotation Speed. Timer rotation default is a preferred 250 ms per HTM move, Counter 100 ms. Pause retains fractions. `docs/FIVE_SECOND_TIMER.md` adds the exact inclusive domain, rejection (not rounding) of out-of-range durations and the explicit report of an infeasible budget or missed deadline.
- **Predictive scheduler and contiguous timing.** The final legal turn ends at the absolute deadline `T`, with a 20 ms observed endpoint tolerance; the scheduler reserves at most half the interval, with `overhead = 75*N + 8` ms, `effective = min(preferred, max(10, (B - overhead - 20) / N))` and `B = min(I/2, deadline - preparationFinishedAt)` (`docs/WORKSHOP_TIMER.md`, "Physical synchronization"). Every move gets a contiguous window ending at `T` (`docs/TIMER_CONTIGUOUS_TIMING.md`). Constants: `src/apps/timer/scheduler.ts:6-9`, `planSequence` at line 10.
- **Clock stage.** `ClockStage` (`src/apps/clock/stage.ts`) is fixed to three cubes: the caster centers array has three entries (line 18), cube creation requires `index < 3` (line 68), the position is `(index - 1) * 2.8` (line 76), the camera far plane uses `2.8` (line 92). The framing helpers assume the row `clockCenters = [-2.8, 0, 2.8]` (`src/apps/clock/framing.ts:6`, used at lines 19, 40 and 46). `LiveClockScheduler` and `ClockValues` are three-tuples (`src/apps/clock/scheduler.ts:3,48`).
- **H/M Counter plan** ([hm-counter.md](hm-counter.md), draft): the same stage generalization (work package 1) and a pair controller with a carry rule (work package 2). This plan must stay consistent with it.
- **M/S Counter, PR #148** (`docs/MS_COUNTER.md`, `src/apps/ms/{controller,design,period}.ts` on `origin/feat/ms-counter`): print **S3** from research PR #138 (`research/ms-counter-3move`), pinned at commit `ee88e5725be8e5e1acf554d924ae9a6d5da43de3` (`ms-source.json`). One cube is set to unit M or S (letter in the upper-right cell, two digits below, an unprinted upper-left sticker). Reported by the research and re-read by the app's tests (`docs/MS_COUNTER.md`, "What the research reports"):
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
- A4. Derived arithmetic, from the formula above at 1× (`I = 1000`, `B = 500`), shown only to frame open decision 2: for `N = 4` moves, `overhead = 308`, `(500 - 308 - 20) / 4 = 43` ms per move; for `N = 3`, `(500 - 233 - 20) / 3 = 82.3` ms; for a serial 3 + 4 = 7 moves, `overhead + 20 = 553 > 500`, so no feasible plan under that formula. Not a measurement.
- A5. Derived arithmetic for other Timer speeds, from `planSequence` (`src/apps/timer/scheduler.ts:10-16`): `I = 1000 / speed` ms, `B = I / 2`, and a plan is feasible when `8 + 75*N + 10*N + 20 <= B` (wake allowance 8, frame allowance 75, minimum move 10, endpoint tolerance 20; lines 6-9). At 10x, `B = 50 < 113` (the value for `N = 1`), so no step with a move is feasible from 10x up. The largest speed with a feasible plan is about 4.4x for `N = 1`, 1.77x for `N = 3`, 1.36x for `N = 4` (`B >= 368`) and 0.80x for a serial `N = 7` (`B >= 623`). The 1x to 100x set of the existing timers (`docs/WORKSHOP_TIMER.md`) therefore does not carry over to one-second steps unchanged. Not a measurement.

## Proposed behavior
1. **Two cubes, M left and S right**, one stage, the layout of the M/S Counter print S3 on each cube.
2. **One time value 00:00–59:59** counted in seconds. The S cube shows 00–59, the M cube shows 00–59. Whole seconds only: no sub-second state on the cubes.
3. **Stopwatch and Countdown** with the controls of the existing timers (Start/Pause/Resume, Reset, Set, Timer speed, Rotation Speed; the speed set is open decision 8). Pause retains fractions; the live readout and cube target come from one monotonic sample.
4. **Carry:** the S cube changes every second; on 59→00 (Stopwatch) or 00→59 (Countdown) the M cube changes in the same step, so both cubes may turn at once.
5. The next target is prepared ahead and the last turn of each cube ends at the one-second boundary, as in the existing timers.

## Approach (recommended): a 3-PR stack
Dependency: **PR #148 must be merged first** (S3 data, `MsController`, period handling). Until then the stack cannot start; PR #148 may still be restacked.
1. **Stage generalization (shared with the H/M Counter plan).** `ClockStage` and the framing helpers take a cube count of two or three. The three-cube Live Clock stays unchanged and its tests stay green. If the H/M Counter lands this work first, this PR is dropped.
2. **Pair controller with carry (shared).** One combined counter over a minor and a major unit (60-modulus for M/S; 60 and 24 for H/M) with a carry rule, owning two single-cube controllers. [hm-counter.md](hm-counter.md) describes this controller as owning two `HsmController`s and must be aligned with the generic design in this work package (not changed by this plan). Generic in the unit moduli and cube controllers so that the H/M Counter and the M/S Timer use the same code. Unit tests with independent replay helpers.
3. **M/S Timer application.** One-second profile on `WorkshopClock`, Stopwatch and Countdown, scheduler wiring per cube, controls like the existing timers, application choice, documentation, tests.

## Work packages
1. PR 1 above, including the stage and framing tests.
2. PR 2 above, including the carry rule for both parameter sets.
3. PR 3 above; a docs page `docs/MS_TIMER.md` with the research caveats of `docs/MS_COUNTER.md`.
4. Entries in the application choice lists of the pages, as in the H/M plan.

## Alternatives considered and rejected
- **Single-PR build.** Stage generalization, pair controller, timer wiring and the dependency on an unmerged PR in one review: too many simultaneous dependencies for an independent review.
- **Extend the 60-Minute Timer.** Not possible: its immutable 24-sticker print and its 10 s steps (`docs/WORKSHOP_TIMER.md`) cannot show single seconds.
- **New research print with M and S on one cube.** Out of scope for this plan; it would need its own research branch and SAT/UNSAT/UNKNOWN outcomes.

## Acceptance criteria
- The three-cube Live Clock, the M/S Counter, the 60-Minute Timer and the 5-Second Timer behave exactly as before.
- Every displayed value 00:00 to 59:59 is reached by legal moves only, replayed by helpers independent of the controller (the converted S3 data and a separate cube model, not the controller's own state).
- Carries are covered up and down: 00:59→01:00, 01:59→02:00, 58:59→59:00 and 59:00→58:59; and the 4-HTM minutes edges 14:59→15:00, 35:59→36:00 and 55:59→56:00 with their reverse steps, the worst case for open decision 2 (edges per `docs/MS_COUNTER.md` on PR #148).
- The 59:59 boundary: Stopwatch stops at its end behavior chosen under open decision 3 and Countdown stops at 00:00; neither continues past it; the end state is a displayed value of the print.
- Deadlines, for the Timer speeds that decision 8 admits (A5): the last turn of each cube ends at the one-second boundary within the documented 20 ms tolerance in deterministic scheduler tests; speeds with an infeasible budget are reported as such by the existing mechanism. An infeasible budget or missed deadline is reported, not hidden.
- Pause and resume keep fractions (for example pausing at 12.5 s shows 00:12 and keeps the 0.5 s); Reset returns to the configured duration or zero.
- Seconds cube lap: after 60 steps the display repeats while the full pose differs; the test replays two laps and checks the lap-aware pose.
- No physical state is invented: only S3 period nodes and their saved words (or inverses) are played, and interrupted routes follow the PR #148 rules. Any new claim carries the SAT/UNSAT/UNKNOWN wording of `AGENTS.md`.
- Documentation and UI text in US English; spelling and link checks pass.

## Decisions
Owner decisions: none recorded yet for this plan. The carry semantics (one combined counter with carry) are taken from the H/M Counter plan, whose owner decisions are dated 2026-10-31; whether they transfer unchanged is for the owner to confirm.

Still open:
1. **Speed default.** 100 ms per HTM move as in the Counter, or the timer preference of 250 ms (`docs/WORKSHOP_TIMER.md`). Under A4 a 250 ms preference is reduced by the scheduler at 4 moves per second.
2. **Carry step.** Both cubes turn at once; the step is bounded by the larger cube word (seconds max 3 HTM, minutes max 4 HTM per `docs/MS_COUNTER.md`) if the cubes turn in parallel, or by the sum if serial. Whether one shared time budget or one per cube applies, and whether a missed carry may be shown late, is undecided (see A4).
3. **Range and end behavior.** 00:00–59:59 for both modes is proposed; Stopwatch stop versus wrap at 59:59, and the Countdown default duration (15:00 and 30:00 are the existing timers' defaults), are undecided.
4. **Seconds cube with 2 laps.** Whether to show the lap, and how Set and Reset choose the lap (fewest HTM as in PR #148, or a fixed lap), are undecided.
5. **Set and Reset targets.** Whether Set walks the period (as in PR #148) or jumps; Reset target when the cubes show a mid-period pose.
6. **E2E gating.** Browser E2E on `main` was repaired by PR #162; the heavy lane runs only on the stack tip. Whether PR 1 and PR 2 need browser tests, or only PR 3, is undecided.
7. **Naming.** Timer versus Counter, and the product name, are pending the owner.
8. **Timer speed set.** Which speeds exist for a one-second timer. See A5: with one-second steps only low multipliers admit a feasible plan, so the 1x to 100x set of the existing timers cannot be kept as is for the deadline criterion; the set, or accepting infeasible reports at high speeds, is undecided.

## Out of scope
- New puzzle prints, solvers or proofs, including M and S on one cube; the M3 print of PR #138; sticker sheets for S3; sub-second display; a wall-clock mode (the Live Clock covers it); changes to the 60-Minute and 5-Second Timers.

Back to [Plans](index.md).
