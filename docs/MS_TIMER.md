# M/S Timer

The **M/S Timer** (application id `ms-timer`) is a Countdown and a Stopwatch on
**two** physical 2×2 cubes at one-second resolution: the left cube shows the
minutes (M), the right cube the seconds (S). One combined time, **00:00–59:59**,
is counted in whole seconds. The [60-Minute Timer](WORKSHOP_TIMER.md) works in
10-second steps and the [5-Second Timer](FIVE_SECOND_TIMER.md) in 5-second
steps, both on one cube; neither can show single seconds. Open it from the
application chooser, at `ms-timer.html`, or with `index.html?application=ms-timer`.

The plan and the owner decisions of 2026-11-01 are in
[the M/S Timer plan](../knowledge/plans/ms-timer.md).

## Behavior

- **Two cubes, one stage.** Both cubes carry print S3 of the
  [M/S Counter](MS_COUNTER.md): the left one is set to M, the right one to S.
  They share one scene and one camera (the Live Clock stage with two cubes).
- **Countdown** starts at 15:00 by default, counts down and stops at 00:00.
  **Stopwatch** starts at 00:00, counts up and stops at 59:59 without wrapping.
  Neither continues past its end; the end state is a displayed value of the print.
- **Whole seconds.** The clock is the monotonic clock of the existing timers
  with a one-second profile. Countdown rounds a partial second up, Stopwatch
  down. Pause keeps the fraction: pausing a Stopwatch at 12.5 s shows 00:12
  and keeps the 0.5 s, so Resume reaches 00:13 half a second later. The live
  readout and the target of the cubes come from one monotonic sample.
- **Controls** are those of the other timers: one Start / Pause / Resume
  button, Reset, Set, and the Countdown / Stopwatch mode switch. Set takes
  `MM:SS` from 00:00 to 59:59; anything else (for example 60:00 or 15:6) is
  rejected with a message and never rounded. Reset returns to the configured
  duration (Countdown) or to 00:00 (Stopwatch).
- **Timer speed is 1× only** in this version; the page shows it as fixed. The
  tests use a virtual clock and need no acceleration.
- **Rotation Speed** defaults to 100 ms per HTM move. It is a preference: the
  scheduler shortens it per step so that the turns fit the budget (below).
- **Set and Reset walk the saved periods** of both cubes turn by turn, the way
  the M/S Counter does (the direction with fewer HTM, no free jumps). A newer
  target interrupts a walk between two turns of a saved word.
- The seconds cube's S3 period has **two laps** (120 steps). The display repeats
  after 60 steps while the full pose differs; the timer plans this internally
  (lap-aware, fewest HTM, as in the M/S Counter) and does not show the lap.

## Carry and deadlines

A carry (59→00 up, 00→59 down on the seconds cube) changes the minutes cube in
the same step. Both cubes turn **in parallel**. The existing predictive
scheduler (`planSequence`, the contiguous deadline windows of
[the timing note](TIMER_CONTIGUOUS_TIMING.md)) runs **once per cube**: each cube
has its own plan, its own time budget (planned for its own word, up to 4 HTM
for the minutes) and its own effective turn time, and each cube's last turn ends
at the same one-second boundary. The deadline of a cube is set through its
`setDeadline`, its progress and state are read through `progress` and `state`.
A cube that does not change in a second has nothing to schedule.

The budget formula is that of the other timers: at most half the interval, with
`overhead = 75·N + 8` ms and `effective = min(preferred, max(10, (B − overhead − 20) / N))`.
Derived arithmetic at 1× (`B = 500` ms), **not a measurement**: about 82 ms per
move for 3 moves, 43 ms for 4 moves. A serial turn of both cubes (3 + 4 = 7
moves) has no feasible plan under the formula, so serial turning is excluded
and not offered. A missed carry or an infeasible budget is **reported** in the
status line ("Late", "Budget infeasible") through the existing mechanism and is
never shown late silently. The 20 ms endpoint tolerance of the other timers
applies. Faster Timer speeds are not offered: from about 1.36× on, even 4 moves
no longer fit (derived), and the first version stays at 1×.

## What the tests cover

`tests/ms-timer-clock.test.mjs` pins the one-second profile, rounding, pause
fractions, both ends and rejected Set input. `tests/ms-timer.test.mjs` runs the
real controllers, the pair, the per-cube schedulers and the production turn
interpolation on a virtual clock, and replays every turn on a separate cube
model built from the saved S3 words: the last turn of each cube within 20 ms of
the boundary at 1×, the 4-HTM minutes edges 14:59→15:00, 35:59→36:00 and
55:59→56:00 in both directions, the other carries, both laps of the seconds
cube, Set and Reset across carries, and reported infeasible and late carries.
`tests/browser/ms-timer.spec.mjs` opens the page in a browser. The millisecond
timing is deterministic in virtual time only; no physical or real-browser timing
guarantee is claimed.

```sh
node --test tests/ms-timer-clock.test.mjs tests/ms-timer.test.mjs
npx playwright test tests/browser/ms-timer.spec.mjs
```

## Boundaries

The M/S Timer reuses the research candidate of the M/S Counter; read
[its boundaries](MS_COUNTER.md#boundaries) first.

- S3 is a research candidate from research PR #138, not a settled result. The
  maximum of 4 HTM per step is witnessed by replay, not proven optimal; "max 3
  HTM for both units" is `UNKNOWN`.
- Both research checkers (Julia and Flix) accept S3, but the Flix checker is a
  structural port of the Julia checker. [proof-checkers/AUTHORITY.md](../proof-checkers/AUTHORITY.md)
  has no M/S profile, so nothing here is confirmed under it.
- No sticker sheets exist for S3.
- The timing numbers above are derived from the scheduler formula and checked
  in virtual time. They are not measurements on a physical cube or on every
  browser; slow rendering can still make the display lag, and the status line
  says so when it does.
- Combining two S3 cubes (one M, one S) is a reuse of the one-unit data, not new
  puzzle mathematics, and not a new proof claim.
- The wording of the labels in the page (buttons, status text) is not final;
  the owner has not yet decided it.
